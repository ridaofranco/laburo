"use server";

/**
 * Gate del login de staff (Lote 2 de seguridad).
 *
 * El form mandaba el magic link con shouldCreateUser:true directo desde el
 * browser a cualquier email → email-bombing (mandar links a casillas ajenas) +
 * auth.users lleno de cuentas basura. Ahora el envío pasa por acá:
 *  1. Validamos server-side, con service-role, si el email está en el pool
 *     (RPC staff_app_email_in_pool, granteada SOLO a service_role).
 *  2. Solo si está en el pool mandamos el OTP.
 *  3. Devolvemos SIEMPRE la misma respuesta (`{ ok: true }`), esté o no en el
 *     pool: sin oráculo de enumeración, nadie puede averiguar quién es staff.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { signInWithPassword as entrarConContrasena } from "@/lib/auth-password";
import { linkParaElegirContrasena, mandarLinkDeAcceso } from "@/lib/auth-link";
import { sendMail } from "@/lib/email/mailer";
import { LinkDeAccesoEmail } from "@/components/emails/link-de-acceso-email";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function requestStaffMagicLink(email: string): Promise<{ ok: boolean }> {
  const clean = (email || "").trim().toLowerCase();
  // Respuesta uniforme siempre (no revelamos validez del email ni pertenencia al pool).
  if (!clean || !EMAIL_RE.test(clean)) return { ok: true };

  // FRENO DE ABUSO. Cada pedido válido manda un mail por Supabase Auth, y ese tope
  // es del PROYECTO ENTERO, compartido con PASE: un script pidiendo acceso mil
  // veces deja sin poder entrar a las 699 personas de la tanda de bienvenida.
  // 5 por minuto por IP (una persona real necesita uno, dos si se equivocó) y 20
  // por hora por dirección, para el caso de varias personas en la misma oficina.
  // La respuesta sigue siendo la misma de siempre: al que abusa no se le dice ni
  // que existe un límite, ni si el mail estaba en el pool.
  const ip = await clientIp();
  if (!rateLimit(`staff-link:ip:${ip}`, 5, 60_000).ok) return { ok: true };
  if (!rateLimit(`staff-link:ip-hora:${ip}`, 20, 3_600_000).ok) return { ok: true };
  if (!rateLimit(`staff-link:mail:${clean}`, 3, 600_000).ok) return { ok: true };

  // ¿Está en el pool? (service-role; la RPC no está granteada a anon/authenticated)
  const admin = createServiceRoleClient();
  const { data: inPool, error } = await admin.rpc("staff_app_email_in_pool", {
    p_email: clean,
  });
  if (error || inPool !== true) return { ok: true };

  // Recién acá mandamos el link (y recién acá se puede crear la cuenta).
  //
  // ⭐ NUESTRO MAIL, NO EL DE SUPABASE (2/9). El mail de Supabase traía un
  // `code` de PKCE, que solo se canjea en el MISMO navegador que lo pidió: quien
  // pedía el link en el celular y lo abría desde el visor de Gmail veía "ese
  // link ya se usó o venció" con un link perfectamente válido. Es el camino que
  // le toca a las 686 fichas del pool viejo, porque el cron de bienvenida las
  // manda justo a esta pantalla. Ver lib/auth-link.ts.
  //
  // ⚠️ Y ahora va con `como: "staff"`, que antes no iba. Sin el hint, alguien
  // que es staff Y productora aterrizaba en el panel equivocado por el orden
  // natural del callback. Es gratis y corresponde: esta pantalla sabe con
  // certeza que quien pide es staff, porque lo acaba de verificar contra el pool.
  const mandado = await mandarLinkDeAcceso(admin, clean, {
    como: "staff",
    crearSiNoExiste: true,
    etiqueta: "acceso-staff",
  });

  // LA VÁLVULA: si el link propio no se pudo armar o el mail no salió, sale el
  // de siempre. El peor caso de este cambio es "quedó como estaba".
  if (!mandado) {
    const origin = SITE_URL;
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
  }
  return { ok: true };
}

/**
 * ⭐ PEDIR EL LINK PARA CREAR O CAMBIAR LA CONTRASEÑA (decisión de Franco, 26/7).
 *
 * ── POR QUÉ EXISTE ──
 * Hasta ahora al staff le llegaba el magic link con la plantilla POR DEFECTO de
 * Supabase: en inglés, sin marca y sin logo. Franco: "es horrible y me quita
 * credibilidad". Y tiene razón en algo más grave que lo estético: quien recibe
 * la bienvenida linda de LABURO y después ESO, piensa que es phishing y no entra.
 * Son las 699 personas del pool.
 *
 * La decisión fue: que cada uno tenga su contraseña, y que el mail para
 * definirla salga con nuestro diseño y desde nuestra casilla.
 *
 * ── EL DETALLE QUE DEFINE ESTA FUNCIÓN ──
 * `resetPasswordForEmail` SOLO manda el mail si la cuenta ya existe en
 * auth.users, y **las 699 no tienen cuenta**: hoy se les crea recién cuando
 * piden su primer magic link. Si llamáramos directo al reset, a la persona no le
 * llegaría nada y no habría forma de saber por qué.
 *
 * Por eso la cuenta se crea primero, en el momento en que la persona la pide
 * (que es lo que eligió Franco: nadie recibe una contraseña por mail y no se
 * crean 699 cuentas de golpe). Se crea con `email_confirm: true` porque el mail
 * ya se está por verificar con el propio link que sale a continuación.
 *
 * ⭐ ESO YA NO SE HACE ACÁ (2/9): lo hace `linkParaElegirContrasena`, que es la
 * misma función que usan el alta de /sumate y el alta de productora. Esta
 * función dejó de tener su propia copia del `createUser` y del envío. Lo que
 * cambió de verdad es que el link ahora lleva `token_hash` en vez del `code` de
 * PKCE del mail de Supabase, que solo se podía canjear en el mismo navegador
 * que lo pidió: abrirlo desde el visor de Gmail fallaba siempre.
 *
 * ── SEGURIDAD, IGUAL QUE EL MAGIC LINK ──
 * · Solo se le manda a quien está en el pool (RPC service-role).
 * · Respuesta SIEMPRE uniforme: no se puede averiguar quién es staff ni qué mail
 *   existe. Ni siquiera se dice si la cuenta ya estaba creada.
 * · Mismo freno de abuso: cada pedido manda un mail y ese tope es del proyecto
 *   entero, compartido con PASE.
 */
export async function requestPasswordSetup(email: string): Promise<{ ok: boolean }> {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) return { ok: true };

  const ip = await clientIp();
  if (!rateLimit(`staff-pass:ip:${ip}`, 5, 60_000).ok) return { ok: true };
  if (!rateLimit(`staff-pass:ip-hora:${ip}`, 20, 3_600_000).ok) return { ok: true };
  if (!rateLimit(`staff-pass:mail:${clean}`, 3, 600_000).ok) return { ok: true };

  const admin = createServiceRoleClient();
  const { data: inPool, error } = await admin.rpc("staff_app_email_in_pool", {
    p_email: clean,
  });
  if (error || inPool !== true) return { ok: true };

  // ⭐ EL LINK LO ARMAMOS NOSOTROS (2/9), con la función que ya existía y que ya
  // se venía usando en el alta de /sumate y en el alta de productora. Ella se
  // encarga de crear la cuenta si hace falta (que es la mitad de lo que hacía
  // esta función a mano) y devuelve un link con `token_hash` que apunta a
  // /definir-contrasena/confirmar, que es una ruta que ese route handler ya
  // sabe canjear desde el 1/8.
  //
  // POR QUÉ SE CAMBIÓ: `resetPasswordForEmail` manda el mail de Supabase, y ese
  // mail trae un `code` de PKCE. El `code` solo se canjea en el MISMO navegador
  // que lo pidió, así que quien pedía el link en el celular y lo abría desde el
  // visor interno de Gmail veía "ese link ya se usó o venció" con un link
  // perfectamente válido. Con `token_hash` entra desde cualquier lado.
  const claveLink = await linkParaElegirContrasena(admin, clean, "acceso-staff");

  if (claveLink) {
    const html = await render(
      createElement(LinkDeAccesoEmail, {
        link: claveLink,
        paraElegirContrasena: true,
      }),
    );
    const result = await sendMail({
      to: clean,
      subject: "Tu link para elegir la contraseña de LABURO",
      html,
    });
    if (result.ok) return { ok: true };
    console.error(
      "[acceso-staff] el mail con el link de contraseña no salió:",
      result.error ?? result.channel,
    );
  }

  // LA VÁLVULA: si el link propio no se pudo armar o el mail no salió, sale el
  // de siempre, con la plantilla "Reset Password" del panel de Supabase (la que
  // está en el repo en supabase/email-templates/definir-contrasena.html). Es
  // peor experiencia, pero nunca una puerta cerrada.
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(clean, {
    // A /confirmar, NO a la página: el canje del `code` por sesión escribe
    // cookies y solo puede hacerlo el route handler. Apuntando a la página, el
    // code nunca se canjeaba, no había sesión, y guardarContrasena respondía
    // "el link venció o ya se usó" al 100% de la gente.
    redirectTo: `${SITE_URL}/definir-contrasena/confirmar`,
  });

  return { ok: true };
}

/**
 * Entrar con mail y contraseña.
 *
 * A diferencia de las de arriba, ACÁ SÍ se devuelve el error: la persona está
 * escribiendo su propia contraseña y necesita saber si se equivocó. No hay
 * oráculo que proteger, porque para llegar hasta acá ya sabe que la cuenta
 * existe (fue ella quien la creó).
 *
 * El mensaje no distingue entre "no existe" y "contraseña equivocada" igual, que
 * es lo estándar: si no, sirve para averiguar qué mails están registrados.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  // La implementación se mudó a lib/auth-password.ts el 3/8 para que la use
  // TAMBIÉN el login del productor. No tenía nada específico del staff, y
  // mientras vivió acá el productor no podía entrar con la contraseña que el
  // mail de bienvenida le decía que iba a usar siempre.
  return entrarConContrasena(email, password);
}
