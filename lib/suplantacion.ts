import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { esUuid } from "@/lib/org-cookie";

/**
 * ACTUAR COMO UNA PRODUCTORA: todo el mecanismo, en un solo archivo.
 *
 * La plataforma (SOMOS DER) puede entrar a operar la cuenta de una productora
 * para resolverle un problema. Es la capacidad más delicada del producto: mal
 * hecha, deja a alguien escribiendo en la organización de otro.
 *
 * ── LOS CUATRO INVARIANTES, QUE NO SE NEGOCIAN ──────────────────────────────
 *
 * 1. **Solo la plataforma.** El gate es `is_platform_admin()` **adentro de la
 *    base** (RPC de la 0073), no acá. Un server action es un endpoint POST
 *    invocable: esconder el botón no es un gate. Este archivo no decide nada de
 *    permisos, solo transporta.
 * 2. **Fail-closed.** Cualquier duda —cookie rara, sesión que no valida, RPC que
 *    falla, error de red— se resuelve **no suplantando**, y además borrando la
 *    cookie. Nunca al revés.
 * 3. **Temporal.** Cookie de sesión (sin `maxAge`), así no sobrevive al cierre
 *    del navegador. **Y además vence en SQL, a los 60 minutos**: aunque alguien
 *    manipule la cookie, la base corta sola. El vencimiento NO se reimplementa
 *    acá a propósito — vive en la 0073 y en un solo lugar.
 * 4. **Visible.** El banner del layout del portal, en todas las pantallas.
 *
 * ── POR QUÉ LA COOKIE GUARDA DOS COSAS ──────────────────────────────────────
 * Guarda el **id de sesión de auditoría** y el **id de organización**, no solo
 * el segundo. Un valor solo se puede adivinar; los dos tienen que coincidir con
 * una fila viva de `impersonation_log` que además sea del usuario que consulta.
 *
 * ── SIN service_role, NUNCA ─────────────────────────────────────────────────
 * Todo pasa por el cliente normal, con el JWT del usuario, para que la RLS y el
 * gate de la base se apliquen. `service_role` se saltea la RLS entera: un bug de
 * scope dejaría al admin escribiendo en cualquier organización, no solo en la
 * elegida.
 */

/** Nombre de la cookie de suplantación. */
export const LABURO_SUPLANTACION_COOKIE = "laburo_actuando_como";

const OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  // Sin maxAge: de sesión. Invariante 3.
};

export interface SuplantacionActiva {
  sesionId: string;
  organizationId: string;
  nombre: string | null;
  slug: string | null;
  iniciadaAt: string | null;
}

/** `<sesionId>:<organizationId>`, los dos UUID. */
function parseCookie(v: string | undefined): { sesionId: string; orgId: string } | null {
  if (!v) return null;
  const [sesionId, orgId] = v.split(":");
  if (!esUuid(sesionId) || !esUuid(orgId)) return null;
  return { sesionId, orgId };
}

/**
 * La suplantación viva, o null.
 *
 * **Valida SIEMPRE contra la base y no cachea nada.** Es tentador guardarse el
 * resultado por request, pero esto decide en nombre de quién se escribe: el
 * costo de una consulta es menor que el de operar con un permiso que ya venció.
 *
 * Si la cookie no valida, se devuelve null. La cookie no se borra acá: este
 * módulo se llama desde componentes de servidor, donde escribir cookies tira
 * error en Next. La limpieza la hace la server action de salir.
 */
export async function suplantacionActiva(): Promise<SuplantacionActiva | null> {
  try {
    const raw = (await cookies()).get(LABURO_SUPLANTACION_COOKIE)?.value;
    const parsed = parseCookie(raw);
    if (!parsed) return null;

    const supabase = await createClient();
    // La ventana de 60 minutos la aplica la RPC. Acá no se repite: si se
    // repitiera, el día que cambie habría dos verdades y ganaría la más
    // permisiva sin que nadie se entere.
    const { data, error } = await supabase.rpc("staff_app_suplantacion_activa", {
      p_sesion_id: parsed.sesionId,
    });
    if (error) return null;

    const r = data as {
      ok?: boolean;
      organization_id?: string;
      name?: string | null;
      slug?: string | null;
      iniciada_at?: string | null;
    } | null;
    if (!r?.ok || !r.organization_id) return null;

    // La organización que dice la cookie tiene que ser la misma que dice la
    // base. Si no coinciden, alguien tocó la cookie: fail-closed.
    if (r.organization_id !== parsed.orgId) return null;

    return {
      sesionId: parsed.sesionId,
      organizationId: r.organization_id,
      nombre: r.name ?? null,
      slug: r.slug ?? null,
      iniciadaAt: r.iniciada_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Abre una sesión de suplantación. El permiso lo decide la base: acá solo se
 * guarda lo que la RPC devolvió si dijo que sí.
 */
export async function iniciarSuplantacion(
  orgId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!esUuid(orgId)) return { ok: false, error: "No se pudo entrar a esa productora." };
    if (!motivo.trim()) return { ok: false, error: "Hace falta un motivo." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("staff_app_actuar_como", {
      p_org: orgId,
      p_motivo: motivo.trim(),
    });
    if (error) return { ok: false, error: "No se pudo entrar a esa productora." };

    const r = data as { ok?: boolean; reason?: string; sesion_id?: string } | null;
    if (!r?.ok || !r.sesion_id) {
      // Los motivos se traducen, pero sin decir de más: quien no tenga permiso
      // no aprende desde acá si la organización existe.
      const msg =
        r?.reason === "falta_motivo"
          ? "Hace falta un motivo."
          : "No se pudo entrar a esa productora.";
      return { ok: false, error: msg };
    }

    (await cookies()).set(LABURO_SUPLANTACION_COOKIE, `${r.sesion_id}:${orgId}`, OPTS);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo entrar a esa productora." };
  }
}

/**
 * Cierra la suplantación.
 *
 * ⚠️ **La cookie se borra SIEMPRE, incluso si la RPC falla.** Salir tiene que
 * funcionar aunque la base no conteste: si el borrado de la cookie dependiera de
 * que la RPC salga bien, un error de red dejaría a alguien atrapado adentro de
 * la organización de otro. En el peor caso queda una fila sin `terminada_at`,
 * que vence sola a los 60 minutos.
 */
export async function terminarSuplantacion(): Promise<{ ok: boolean }> {
  const store = await cookies();
  const parsed = parseCookie(store.get(LABURO_SUPLANTACION_COOKIE)?.value);

  store.delete(LABURO_SUPLANTACION_COOKIE);

  if (parsed) {
    try {
      const supabase = await createClient();
      await supabase.rpc("staff_app_dejar_de_actuar", { p_sesion_id: parsed.sesionId });
    } catch {
      // Ver el comentario de arriba: la cookie ya se fue, que es lo que importa.
    }
  }
  return { ok: true };
}
