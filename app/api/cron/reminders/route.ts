/**
 * Cron de RECORDATORIO de propuestas por vencer (XTRA-02 / D-05).
 *
 * Route Handler App Router disparado por Vercel Cron (vercel.json, 1/día en
 * Hobby). Cierra el ciclo de vencimiento gratis: nudgea UNA sola vez a cada
 * candidato con una oferta a ~2 días de vencer, sin romper el link original.
 *
 * SEGURIDAD (T-5-20, fail-closed): Vercel manda el header
 * `Authorization: Bearer ${CRON_SECRET}` sólo a las rutas de cron. Validamos
 * ESO primero: si CRON_SECRET no está seteado o el header no coincide EXACTO,
 * 401 sin tocar nada más. Disparo externo del endpoint sin el bearer → 401.
 *
 * SERVICE-ROLE (T-5-21): el cron corre sin sesión de usuario, así que no hay JWT
 * y no puede depender de RLS via auth. Usa createServiceRoleClient (server-only)
 * para llamar el RPC public.staff_app_offers_due_reminder, que está GRANTeado
 * SÓLO a service_role (05-01). Es el único lugar del repo, además del webhook,
 * que usa service-role. NUNCA el cliente anon/autenticado acá.
 *
 * EXACTLY-ONCE (T-5-22): vive dentro del RPC (reminded_at IS NULL + UPDATE en la
 * misma sentencia, 05-01). Acá sólo consumimos la lista que ya quedó marcada.
 *
 * A1: el RPC NO devuelve ni rota ningún link/token. El ReminderEmail nudgea sin
 * link accionable nuevo (el original sigue válido).
 *
 * NO-OP HONESTO (D-05 / T-5-24): el mailer nunca tira; sin SMTP devuelve
 * channel:none. El route envuelve el render en try/catch defensivo y SIEMPRE
 * devuelve 200 con un resumen honesto ({ ok, due, sent, failed, skipped, smtp }).
 * Un SMTP caído o ausente NO rompe el scheduler.
 *
 * TRADE-OFF (research Pitfall 1, best-effort): el RPC ya estampó reminded_at
 * aunque después el SMTP falle o esté ausente. El recordatorio es best-effort;
 * la oferta igual vence y se ve como "vencida" en el board (05-03). No
 * reintentamos ni desmarcamos reminded_at (eso rompería el exactly-once).
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, smtpEnabled } from "@/lib/email/mailer";
import { ReminderEmail } from "@/components/emails/reminder-email";
import { fmtFechaHora } from "@/lib/dates";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

/** Ventana del recordatorio: ofertas a ~2 días de vencer (el RPC la aplica). */
const WITHIN_DAYS = 2;

/** Forma de cada fila due que devuelve el RPC (05-01). */
interface DueOffer {
  offer_id: string;
  email: string | null;
  first_name: string | null;
  gig_title: string | null;
  role: string | null;
  expires_at: string | null;
}

/** Fecha legible para el email (hora AR, no la del server UTC). null si inválida. */
function formatExpires(iso?: string | null): string | null {
  return fmtFechaHora(iso);
}

export async function GET(request: Request) {
  // 1. Auth fail-closed (T-5-20): sin CRON_SECRET seteado o header que no
  //    coincida EXACTO → 401 sin tocar nada.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Service-role → RPC due-reminder (exactly-once + PII, service_role-only).
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("staff_app_offers_due_reminder", {
    p_within_days: WITHIN_DAYS,
  });

  if (error) {
    // 500 (no 200): con 200 Vercel Cron marca la ejecución como exitosa y un RPC
    // roto queda invisible en el dashboard durante meses. El scheduler no se
    // "rompe" por un 500, solo lo reporta como fallido, que es la verdad.
    console.error("[cron/reminders] rpc failed:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const offers = (data as DueOffer[] | null) ?? [];

  // 3. Por cada oferta due: render + envío honesto. NUNCA throw.
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const offer of offers) {
    const to = offer.email?.trim();
    if (!to) {
      skipped += 1;
      continue;
    }

    try {
      const html = await render(
        createElement(ReminderEmail, {
          firstName: offer.first_name ?? "",
          gigTitle: offer.gig_title ?? "",
          role: offer.role ?? "",
          expiresText: formatExpires(offer.expires_at),
        }),
      );
      const gig = offer.gig_title?.trim();
      const result = await sendMail({
        to,
        subject: `Tu propuesta está por vencer${gig ? ` · ${gig}` : ""}`,
        html,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      // Defensa en profundidad: aunque el mailer no tira, envolvemos el render.
      console.error(
        "[cron/reminders] send failed for",
        offer.offer_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  // 4. Resumen honesto (D-05): sin SMTP → sent=0, smtp=false, no-op limpio.
  return Response.json({
    ok: true,
    due: offers.length,
    sent,
    failed,
    skipped,
    smtp: smtpEnabled(),
  });
}
