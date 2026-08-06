/**
 * POST /api/bienvenida — manda la bienvenida de una ficha RECIÉN creada.
 *
 * ── EL AGUJERO QUE TAPA (medido el 6/8) ──────────────────────────────────────
 * De 1.020 personas en el pool, SOLO 2 habían recibido un mail alguna vez. El
 * que se anota por LABURO recibe la bienvenida al toque, pero el que se anota
 * por somosder.ar no recibía NADA: esa web guarda la ficha llamando la RPC de
 * registro desde el navegador y ahí termina. Se anotaban, no les llegaba nada, y
 * no tenían forma de saber que existe una app donde entrar.
 *
 * ── POR QUÉ ACÁ Y NO EN somosder.ar ──────────────────────────────────────────
 * somosder.ar tiene con qué mandar mails, así que la salida fácil era copiarle
 * la plantilla y el armado del link. Es exactamente lo que ya salió mal una vez:
 * el botón de Google se arregló del lado del staff y quedó roto del lado del
 * productor porque el código estaba copiado en vez de compartido (Franco: "lo
 * que hacés para empleados no lo hacés para productores"). La plantilla, el link
 * de contraseña y el envío viven en UN solo lugar, y la web los usa desde acá.
 *
 * ── POR QUÉ NO NECESITA NINGUNA CLAVE COMPARTIDA ─────────────────────────────
 * Recibe el id de la ficha, que es un uuid que solo conoce quien acaba de
 * registrarla (se lo devuelve la RPC al navegador). Y aunque alguien lo tuviera,
 * lo único que puede lograr es que se mande UNA vez el mail que esa persona ya
 * tenía que recibir, a la dirección que ya está guardada en su ficha: no elige
 * el destinatario ni el contenido. Encima solo acepta fichas creadas hace menos
 * de 30 minutos, así que no sirve para despertar al pool viejo.
 *
 * Es best-effort a propósito: si esto falla, el registro YA está guardado y la
 * tanda del cron la agarra después como red de seguridad. Nunca voltea un alta.
 */

import { NextResponse } from "next/server";
import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { WelcomeEmail } from "@/components/emails/welcome-email";
import { siteUrl } from "@/lib/site";
import { bajaHeaders, bajaReady, bajaUrl } from "@/lib/baja";
import { linkParaElegirContrasena } from "@/lib/auth-link";
import { clientIpFrom, rateLimitOr429 } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solo fichas nuevas: la ventana de 30 minutos es el candado que hace que el id
 * alcance como permiso. Pasada la media hora, la ficha ya no se puede despertar
 * desde acá y queda en manos de la tanda del cron. Vive DENTRO de la función
 * staff_app_bienvenida_ficha_nueva (migración 0065), no acá, para que no se
 * pueda saltear llamando la RPC de otro lado.
 */

/** Quién puede llamar. La web es el caso real; el mismo LABURO por las dudas. */
const ORIGENES = new Set([
  "https://somosder.ar",
  "https://www.somosder.ar",
  "https://laburo.somosder.ar",
]);

function cors(origin: string | null): Record<string, string> {
  // Sin origen permitido no se devuelve la cabecera: el navegador corta solo.
  if (!origin || !ORIGENES.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const headers = cors(request.headers.get("origin"));

  // Freno de abuso: cada llamada puede mandar un mail y generar un link de auth,
  // y el tope de mails del proyecto de Supabase es compartido con PASE.
  const ip = clientIpFrom(request);
  const frenado =
    rateLimitOr429(`bienvenida:${ip}`, 5, 60_000) ??
    rateLimitOr429(`bienvenida:hora:${ip}`, 30, 3_600_000);
  if (frenado) {
    console.warn(`[bienvenida] 429 freno de abuso · ip=${ip}`);
    return frenado;
  }

  let profileId = "";
  try {
    const body = (await request.json()) as { profile_id?: unknown };
    profileId = typeof body?.profile_id === "string" ? body.profile_id.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers });
  }
  // uuid o nada: sin esto, cualquier string entra a la consulta.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400, headers });
  }

  if (!emailEnabled()) {
    console.error("[bienvenida] no hay transporte de mail configurado");
    return NextResponse.json({ ok: false, error: "sin_mail" }, { status: 200, headers });
  }

  /**
   * Por RPC y no leyendo la tabla: el schema staff_app NO está expuesto por
   * PostgREST a propósito (es compartido con HITO). Los tres candados viven
   * adentro de la función: org fija, bienvenida_enviada_at IS NULL, y la ventana
   * de 30 minutos. Si no cumple alguno, no devuelve nada.
   */
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("staff_app_bienvenida_ficha_nueva", {
    p_profile_id: profileId,
  });

  if (error) {
    console.error("[bienvenida] no se pudo leer la ficha:", error.message);
    return NextResponse.json({ ok: false, error: "db" }, { status: 200, headers });
  }
  // Todas las salidas de abajo son 200: para el que llama esto es "ya está", no
  // un error que tenga que mostrarle a la persona que se acaba de anotar. Que no
  // devuelva nada es el caso NORMAL cuando ya se le mandó (la persona se anotó
  // por LABURO, que manda el mail en el acto) o cuando la ficha es vieja.
  const fila = Array.isArray(data) ? data[0] : null;
  if (!fila?.email) {
    return NextResponse.json({ ok: true, nada: true }, { status: 200, headers });
  }

  try {
    const email = String(fila.email).toLowerCase();
    const firstName = String(fila.first_name ?? "");
    // Mismo link de una sola vez que el registro por LABURO. Si falla, el mail
    // sale igual apuntando al camino largo: nunca una puerta cerrada.
    const claveLink = await linkParaElegirContrasena(admin, email, "bienvenida");
    const html = await render(
      createElement(WelcomeEmail, {
        firstName,
        link: claveLink ?? siteUrl("/acceso-staff"),
        conLinkDeClave: claveLink !== null,
        bajaLink: bajaReady() ? bajaUrl(profileId) : undefined,
      }),
    );
    const result = await sendMail({
      to: email,
      subject: "Bienvenido/a a LABURO · SOMOS DER",
      html,
      headers: bajaHeaders(profileId),
    });
    if (!result.ok) {
      console.error("[bienvenida] no salió:", result.error ?? result.channel);
      return NextResponse.json({ ok: false, error: "envio" }, { status: 200, headers });
    }
    // La marca se estampa SOLO si el envío salió. Si esto falla, como mucho la
    // tanda le manda el largo más adelante; peor sería marcarla sin haber
    // mandado nada y que no la agarre nunca nadie.
    const { error: markErr } = await admin.rpc("staff_app_mark_bienvenida", {
      p_profile_id: profileId,
    });
    if (markErr) console.error("[bienvenida] mark_bienvenida falló:", markErr.message);
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e) {
    console.error("[bienvenida] falló:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: "excepcion" }, { status: 200, headers });
  }
}
