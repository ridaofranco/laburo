/**
 * Cron del resumen "QUIÉN FICHÓ": cuando un evento termina, la productora/admin
 * (MAIL_ADMIN_TO) recibe un mail por evento con quién fichó (horarios y
 * distancia al predio, del geofencing de 0021) y quién estaba confirmado y no
 * fichó. Hoy esos datos se juntan y nadie los mira.
 *
 * ⚠️ CRON NO ACTIVADO A PROPÓSITO (29/7/2026, decisión de Franco: primero ver
 * cómo responde la primera tanda de bienvenida antes de prender mails nuevos).
 * La función queda lista y probada por tipo; PARA ACTIVARLA hacen falta DOS
 * cosas:
 *   1. Aplicar la migración staff_app_0033_fichaje_resumen (columna ancla + RPC).
 *   2. Agregar el schedule en vercel.json, por ejemplo a las 10 UTC (7 AM AR,
 *      el resumen del evento de anoche llega con el desayuno):
 *        { "path": "/api/cron/quien-ficho", "schedule": "0 10 * * *" }
 *      ⚠️ VERCEL HOBBY PERMITE 2 CRONS POR PROYECTO y LABURO ya tiene 1 activo
 *      (/api/cron/reminders) + 1 reservado para la tanda de bienvenida. Si los
 *      dos están dados de alta, este NO entra como tercero: la alternativa es
 *      colgar este trabajo dentro de /api/cron/reminders (mismo patrón que el
 *      recordatorio de turnos, que ya vive ahí como segundo trabajo).
 *
 * SEGURIDAD Y PATRÓN: calcado de /api/cron/bienvenida. Fail-closed con
 * CRON_SECRET, service-role para la RPC (PII, service_role-only), exactly-once
 * en la RPC (fichaje_resumen_enviado_at estampado en la misma sentencia que
 * selecciona). Y NO se pide la tanda si no hay vía de mail o no hay destino:
 * la RPC estampa al seleccionar, pedirla sin poder mandar quemaría los gigs.
 *
 * TRADE-OFF asumido (el mismo de bienvenida/reminders): se estampa ANTES de
 * saber si el mail salió. Un resumen perdido por SMTP caído se ve en los logs
 * (failed) y el dato sigue en la app; peor sería un loop que mande el mismo
 * resumen todos los días.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled, adminEmail } from "@/lib/email/mailer";
import {
  QuienFichoEmail,
  type FichadaRow,
} from "@/components/emails/quien-ficho-email";
import { fmtFechaHora, fmtHora } from "@/lib/dates";
import { siteUrl } from "@/lib/site";
import { alerta } from "@/lib/alerta";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

/** Forma de cada fila que devuelve public.staff_app_fichaje_resumen_batch (0033). */
interface ResumenRow {
  gig_id: string;
  gig_title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
  role: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_distance_m: number | null;
}

export async function GET(request: Request) {
  // 1. Auth fail-closed: sin CRON_SECRET o header que no coincida EXACTO → 401.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Sin vía de envío o sin destino NO se pide la tanda (la RPC estampa al
  //    seleccionar: pedirla sin poder mandar quema los resúmenes).
  const to = adminEmail();
  if (!to || !emailEnabled()) {
    return Response.json(
      {
        ok: false,
        error: to ? "sin_email" : "sin_admin",
        hint: to
          ? "Falta RESEND_API_KEY o el SMTP en el env."
          : "Falta MAIL_ADMIN_TO en el env.",
        sent: 0,
      },
      { status: 503 },
    );
  }

  // 3. La tanda: la RPC devuelve una fila por persona del equipo de cada gig
  //    terminado, y estampa el gig en la misma sentencia (exactly-once).
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("staff_app_fichaje_resumen_batch", {
    p_limit: 20,
  });

  if (error) {
    console.error("[cron/quien-ficho] rpc failed:", error.message);
    await alerta({
      titulo: "El resumen de quién fichó se rompió",
      detalle: error.message,
    });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data as ResumenRow[] | null) ?? [];

  // 4. Agrupar por evento: un mail por gig, no una fila suelta por persona.
  const porGig = new Map<string, ResumenRow[]>();
  for (const row of rows) {
    const list = porGig.get(row.gig_id) ?? [];
    list.push(row);
    porGig.set(row.gig_id, list);
  }

  let sent = 0;
  let failed = 0;

  for (const [gigId, personas] of porGig) {
    try {
      const primera = personas[0];
      const gigTitle = (primera.gig_title ?? "").trim() || "Evento";

      const ficharon: FichadaRow[] = [];
      const sinFichar: Array<{ nombre: string; role?: string | null }> = [];
      for (const p of personas) {
        const nombre =
          [p.staff_nombre, p.staff_apellido].filter(Boolean).join(" ").trim() ||
          "Sin nombre";
        if (p.check_in_at) {
          ficharon.push({
            nombre,
            role: p.role,
            entrada: fmtHora(p.check_in_at),
            salida: fmtHora(p.check_out_at),
            distanciaM: p.check_in_distance_m,
          });
        } else {
          sinFichar.push({ nombre, role: p.role });
        }
      }

      const html = await render(
        createElement(QuienFichoEmail, {
          gigTitle,
          whenText: fmtFechaHora(primera.starts_at, {
            weekday: "long",
            day: "2-digit",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          }),
          venue: primera.venue_name,
          ficharon,
          sinFichar,
          link: siteUrl("/tablero"),
        }),
      );
      const result = await sendMail({
        to,
        subject: `Quién fichó · ${gigTitle} (${ficharon.length} de ${personas.length})`,
        html,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      // Defensa en profundidad: el mailer no tira, pero envolvemos el render.
      console.error(
        "[cron/quien-ficho] send failed for gig",
        gigId,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  return Response.json({
    ok: true,
    eventos: porGig.size,
    personas: rows.length,
    sent,
    failed,
  });
}
