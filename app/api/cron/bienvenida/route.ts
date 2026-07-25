/**
 * Cron de la TANDA DE BIENVENIDA a LABURO.
 *
 * Le manda a las fichas que ya están en la base (699 al momento de escribir esto,
 * import del Sheet + formulario viejo de somosder.ar) el mail que las invita a
 * entrar a revisar y completar su perfil. Es la última parte de la Pieza 2 del
 * plan de LABURO: hasta ahora el mail de bienvenida solo salía cuando alguien se
 * registraba de cero por la web, así que las 699 que ya estaban no tenían por
 * dónde enterarse de que existe la app.
 *
 * APAGADO POR DEFECTO (lo más importante de este archivo): sin la env var
 * BIENVENIDA_BATCH cargada, o con valor 0, la route responde 200 y NO manda
 * NADA. Es un no-op honesto. Franco prende la tanda cargando
 * BIENVENIDA_BATCH=50 en Vercel y la apaga borrándola o poniéndola en 0. El
 * scheduler puede quedar dado de alta sin que salga un solo mail.
 *
 * EN TANDAS, no los 699 de una. Dos límites reales, los dos gratis:
 *   1. El SMTP de Ferozo de LABURO no es para masivos (lento, entregabilidad de
 *      hosting compartido). 699 de una golpea el límite y quema reputación.
 *   2. El código de acceso lo manda SUPABASE AUTH, y el tope de mails del tier
 *      free es DEL PROYECTO ENTERO, compartido con PASE (se comprobó en vivo:
 *      tres pedidos con mails distintos dieron over_email_send_rate_limit). Si
 *      los 699 entran a pedir su código el mismo día, buena parte no puede
 *      entrar. Repartiendo en tandas diarias, la demanda de códigos se reparte.
 *      ⚠️ Igual conviene tener el SMTP propio cargado en Supabase Auth antes de
 *      arrancar: con eso el tope pasa a ser el nuestro y no el compartido.
 *
 * SEGURIDAD (mismo patrón que /api/cron/reminders, que ya corre en prod):
 *   * Fail-closed: Vercel manda `Authorization: Bearer ${CRON_SECRET}` solo a las
 *     rutas de cron. Sin CRON_SECRET seteado, o si el header no coincide EXACTO,
 *     401 sin tocar nada. Un disparo externo sin el bearer no manda mails.
 *   * Service-role: el cron corre sin sesión, no hay JWT y no puede depender de
 *     RLS. Usa createServiceRoleClient para la RPC staff_app_welcome_batch, que
 *     está granteada SOLO a service_role.
 *   * Exactly-once: vive en la RPC (bienvenida_enviada_at IS NULL + UPDATE en la
 *     misma sentencia). Acá solo consumimos la lista que ya quedó marcada.
 *
 * TRADE-OFF asumido (igual que en reminders): la RPC estampa
 * bienvenida_enviada_at ANTES de que sepamos si el SMTP entregó. Preferimos
 * perder alguna bienvenida antes que mandarle dos, o peor, entrar en un loop que
 * le escriba todos los días a la misma persona. Los que fallan quedan en los logs
 * (failed) y se los puede invitar a mano.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { WelcomeEmail } from "@/components/emails/welcome-email";
import { siteUrl } from "@/lib/site";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

/** Cuántas invitaciones por corrida. 0 o ausente = tanda apagada. Techo 200 (la RPC también lo limita). */
function batchSize(): number {
  const raw = Number(process.env.BIENVENIDA_BATCH);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), 200);
}

/** Forma de cada fila que devuelve public.staff_app_welcome_batch. */
interface WelcomeRow {
  profile_id: string;
  email: string | null;
  first_name: string | null;
}

export async function GET(request: Request) {
  // 1. Auth fail-closed: sin CRON_SECRET o header que no coincida EXACTO → 401.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = batchSize();
  const supabase = createServiceRoleClient();

  // 2. Tanda apagada: reportamos cuántas quedan y nos vamos sin mandar nada ni
  //    marcar ninguna ficha. Es el estado por defecto.
  if (limit === 0) {
    const { data: pending } = await supabase.rpc("staff_app_welcome_pending");
    return Response.json({
      ok: true,
      tanda: "apagada",
      hint: "Cargá BIENVENIDA_BATCH=50 en Vercel para arrancar.",
      pending: pending ?? null,
      email: emailEnabled(),
      sent: 0,
    });
  }

  // 3. Sin ninguna vía de envío configurada NO pedimos la tanda: la RPC estampa
  //    al seleccionar, así que pedirla sin poder mandar quemaría las fichas.
  if (!emailEnabled()) {
    const { data: pending } = await supabase.rpc("staff_app_welcome_pending");
    return Response.json(
      {
        ok: false,
        error: "sin_email",
        hint: "Falta RESEND_API_KEY o el SMTP en el env. No se pidió la tanda para no marcar fichas sin poder enviarles.",
        pending: pending ?? null,
        sent: 0,
      },
      { status: 503 },
    );
  }

  // 4. La tanda: la RPC devuelve las fichas y las marca en la misma sentencia.
  const { data, error } = await supabase.rpc("staff_app_welcome_batch", {
    p_limit: limit,
  });

  if (error) {
    // 500 y no 200: con 200 Vercel Cron marca la ejecución como exitosa y una RPC
    // rota queda invisible en el dashboard durante meses.
    console.error("[cron/bienvenida] rpc failed:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data as WelcomeRow[] | null) ?? [];
  const link = siteUrl("/acceso-staff");

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const to = row.email?.trim();
    if (!to) {
      skipped += 1;
      continue;
    }
    try {
      const html = await render(
        createElement(WelcomeEmail, {
          firstName: (row.first_name ?? "").split(/\s+/)[0] ?? "",
          link,
        }),
      );
      const result = await sendMail({
        to,
        subject: "Bienvenido/a a LABURO · SOMOS DER",
        html,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      // Defensa en profundidad: el mailer no tira, pero envolvemos el render.
      console.error(
        "[cron/bienvenida] send failed for",
        row.profile_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  const { data: pending } = await supabase.rpc("staff_app_welcome_pending");

  return Response.json({
    ok: true,
    tanda: limit,
    invitadas: rows.length,
    sent,
    failed,
    skipped,
    pending: pending ?? null,
  });
}
