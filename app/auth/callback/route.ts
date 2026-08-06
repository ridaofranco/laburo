import { NextResponse } from "next/server";
import { orgActual } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de OAuth / magic link. El ÚNICO lugar donde se decide identidad.
 *
 * Lo comparten las tres puertas (/entrar, y los viejos /login y /acceso-staff,
 * que quedan andando). Después de canjear el code por sesión, rutea:
 *
 *   productora → /dashboard      (staff_app_provision_member / orgActual)
 *   staff      → /panel-staff    (staff_app_my_staff_profile)
 *   proveedor  → /mi-proveedor   (staff_app_vincular_proveedor)   ← nuevo 5/8
 *
 * ⚠️ REGLA DURA, ya rompió LABURO tres veces: toda pantalla compartida por dos
 * actores sale por acá, NUNCA a un panel escrito a mano. Un `/panel-staff` o un
 * `/dashboard` hardcodeado en un formulario se saltea este ruteo, y la persona
 * termina en la pantalla del otro actor leyendo "esta cuenta no tiene acceso".
 *
 * ── EL HINT `como` (5/8) ────────────────────────────────────────────────────
 * `/entrar` pregunta primero qué sos y lo pasa acá. Sirve SOLO para desempatar
 * a quien tiene más de un perfil: si el hint no matchea nada real, se ignora y
 * se usa el orden natural. NUNCA da acceso a nada, porque cada rama igual
 * verifica contra la base. Es una preferencia, no un permiso.
 *
 * ── POR QUÉ EL PROVEEDOR VA ÚLTIMO EN EL ORDEN NATURAL ──────────────────────
 * Porque `vincular_proveedor` ESCRIBE (estampa `user_id` la primera vez); las
 * otras dos ramas solo leen. Yendo último, alguien que es productora y además
 * proveedora entra a su panel de productora sin que el login le toque un perfil
 * que no venía a usar. Si quiere el otro, lo elige en la puerta.
 *
 * NO se accede al schema staff_app por PostgREST (PGRST106): todo por RPC/vistas.
 */

/**
 * Las bases. Cualquier otra cosa que llegue en `como` se ignora.
 *
 * `salon` es un hint más y va a la MISMA rama que `proveedor` (6/8): desde la
 * migración 0066, `staff_app_vincular_proveedor` ata las fichas de los dos tipos
 * y `/mi-proveedor` muestra las dos. Se acepta como valor propio y no se lo hace
 * pasar por "proveedor" porque la puerta le pregunta a la persona qué es, y
 * mandarle un hint que no dijo sería mentirle al único lugar donde se decide
 * identidad.
 */
type Como = "productora" | "staff" | "proveedor" | "salon";

function comoValido(v: string | null): Como | null {
  return v === "productora" || v === "staff" || v === "proveedor" || v === "salon"
    ? v
    : null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const como = comoValido(searchParams.get("como"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // 1/8: antes rebotaba a /login MUDO. El canje falla casi siempre por lo
    // mismo (el link ya se usó o venció) y no decírselo a la persona es lo que
    // convierte un caso normal en "no me deja entrar".
    if (error) return NextResponse.redirect(`${origin}/entrar?motivo=link_vencido`);
  } else {
    // Sin `code` pero con sesión: es alguien que acaba de entrar con MAIL Y
    // CONTRASEÑA (26/7). Ahí la sesión ya la creó signInWithPassword y no hay
    // nada que canjear, pero el ruteo por identidad de abajo sigue haciendo
    // falta, porque es el que sabe a dónde mandarlo. Sin esta rama, entrar con
    // contraseña terminaba SIEMPRE en /login.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${origin}/entrar?motivo=sin_sesion`);
  }

  /** ¿Es productora? True si quedó (o ya era) miembro de una organización. */
  async function esProductora(): Promise<boolean> {
    const membership = await supabase.rpc("staff_app_provision_member");
    if (membership.data) return true;
    // ⚠️ NO leer staff_app_my_membership con .maybeSingle() acá: PostgREST tira
    // PGRST116 apenas el usuario pertenece a más de una organización, y ahí el
    // login del productor se cae con un error crudo en vez de entrar.
    // orgActual() pide las orgs ordenadas y se queda con la primera.
    return !!(await orgActual());
  }

  async function esStaff(): Promise<boolean> {
    const { data } = await supabase.rpc("staff_app_my_staff_profile");
    return !!data;
  }

  /** Vincula la cuenta con su perfil de proveedor por mail (idempotente, 0045). */
  async function esProveedor(): Promise<boolean> {
    const { data } = await supabase.rpc("staff_app_vincular_proveedor");
    return !!(data as { ok?: boolean } | null)?.ok;
  }

  // 1. Lo que la persona eligió en la puerta, si existe de verdad.
  if (como === "productora" && (await esProductora())) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }
  if (como === "staff" && (await esStaff())) {
    return NextResponse.redirect(`${origin}/panel-staff`);
  }
  if ((como === "proveedor" || como === "salon") && (await esProveedor())) {
    return NextResponse.redirect(`${origin}/mi-proveedor`);
  }

  // 2. Orden natural. Es exactamente el que corría antes del hint, con el
  // proveedor sumado al final.
  if (await esProductora()) return NextResponse.redirect(`${origin}/dashboard`);
  if (await esStaff()) return NextResponse.redirect(`${origin}/panel-staff`);
  if (await esProveedor()) return NextResponse.redirect(`${origin}/mi-proveedor`);

  // 3. La sesión es válida pero este mail no está en ninguna de las tres bases.
  // No es un error de contraseña, y decirle "no tenés acceso" no le sirve de
  // nada: lo que necesita es registrarse, así que se lo manda a elegir dónde.
  return NextResponse.redirect(`${origin}/entrar?motivo=sin_perfil`);
}
