/**
 * Cron del RECORDATORIO DE PERFIL INCOMPLETO. Clon de /api/cron/bienvenida con
 * otra columna de ancla (spec definida así): persigue a las fichas que
 * recibieron la bienvenida hace unos días y NUNCA entraron a confirmar su
 * perfil (perfil_confirmado_at NULL). Un solo recordatorio por ficha,
 * exactly-once en la RPC (0034).
 *
 * ⚠️ APAGADO POR DEFECTO, DOS VECES:
 *   1. Sin la env var RECORDATORIO_PERFIL_BATCH (o con 0), la route responde
 *      200 y NO manda nada: no-op honesto, igual que la bienvenida.
 *   2. El cron NO está dado de alta en vercel.json a propósito (29/7/2026,
 *      decisión de Franco: quiere ver cómo responde la primera tanda de
 *      bienvenida antes de prender este). Además este recordatorio recién tiene
 *      sentido cuando la tanda a los 699 lleve unos días corriendo: hasta
 *      entonces no hay nadie con bienvenida vieja y perfil sin confirmar.
 *
 * PARA ACTIVARLO, en orden:
 *   1. Aplicar la migración staff_app_0034_recordatorio_perfil.
 *   2. Cargar RECORDATORIO_PERFIL_BATCH=50 en Vercel (y opcional
 *      RECORDATORIO_PERFIL_DIAS, default 5: cuántos días después de la
 *      bienvenida se manda).
 *   3. Agregar el schedule en vercel.json, por ejemplo:
 *        { "path": "/api/cron/recordatorio-perfil", "schedule": "0 14 * * *" }
 *      (14 UTC = 11 AM AR, buena hora de lectura).
 *      ⚠️ VERCEL HOBBY PERMITE 2 CRONS POR PROYECTO y ya hay 1 activo
 *      (/api/cron/reminders) + 1 reservado para la bienvenida. Si los dos están
 *      dados de alta, este no entra como tercero. Alternativa que no gasta
 *      cron: cuando la tanda de bienvenida TERMINE (pending=0), reemplazar el
 *      path de ese cron por este: la máquina es la misma, cambia el mail.
 *
 * SEGURIDAD (mismo patrón que bienvenida): fail-closed con CRON_SECRET,
 * service-role para las RPCs (service_role-only), exactly-once en la RPC, y NO
 * se pide la tanda sin vía de envío (la RPC estampa al seleccionar: pedirla
 * sin poder mandar quemaría las fichas).
 *
 * TRADE-OFF asumido (el mismo de la bienvenida): la RPC estampa ANTES de saber
 * si el envío salió. Preferimos perder algún recordatorio antes que mandarle
 * dos a la misma persona.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { PerfilReminderEmail } from "@/components/emails/perfil-reminder-email";
import { siteUrl } from "@/lib/site";
import { bajaHeaders, bajaReady, bajaUrl } from "@/lib/baja";
import { alerta } from "@/lib/alerta";

// Nunca cachear: cada disparo del cron debe ejecutar de verdad.
export const dynamic = "force-dynamic";

/** Cuántos recordatorios por corrida. 0 o ausente = tanda apagada. Techo 200 (la RPC también lo limita). */
function batchSize(): number {
  const raw = Number(process.env.RECORDATORIO_PERFIL_BATCH);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.floor(raw), 200);
}

/** Cuántos días después de la bienvenida se recuerda. Default 5, entre 1 y 60 (la RPC también lo limita). */
function diasEspera(): number {
  const raw = Number(process.env.RECORDATORIO_PERFIL_DIAS);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.min(Math.floor(raw), 60);
}

/** Forma de cada fila que devuelve public.staff_app_perfil_reminder_batch (0034). */
interface ReminderRow {
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
  const dias = diasEspera();
  const supabase = createServiceRoleClient();

  // 2. Tanda apagada: reportamos cuántas quedan y nos vamos sin mandar nada ni
  //    marcar ninguna ficha. Es el estado por defecto.
  if (limit === 0) {
    const { data: pending } = await supabase.rpc("staff_app_perfil_reminder_pending", {
      p_dias: dias,
    });
    return Response.json({
      ok: true,
      tanda: "apagada",
      hint: "Cargá RECORDATORIO_PERFIL_BATCH=50 en Vercel para arrancar.",
      dias,
      pending: pending ?? null,
      email: emailEnabled(),
      sent: 0,
    });
  }

  // 3. Sin ninguna vía de envío NO pedimos la tanda: la RPC estampa al
  //    seleccionar, así que pedirla sin poder mandar quemaría las fichas.
  if (!emailEnabled()) {
    const { data: pending } = await supabase.rpc("staff_app_perfil_reminder_pending", {
      p_dias: dias,
    });
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
  const { data, error } = await supabase.rpc("staff_app_perfil_reminder_batch", {
    p_limit: limit,
    p_dias: dias,
  });

  if (error) {
    console.error("[cron/recordatorio-perfil] rpc failed:", error.message);
    await alerta({
      titulo: "El recordatorio de perfil incompleto se rompió",
      detalle: error.message,
    });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data as ReminderRow[] | null) ?? [];
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
        createElement(PerfilReminderEmail, {
          firstName: (row.first_name ?? "").trim(),
          link,
          bajaLink: bajaReady() ? bajaUrl(row.profile_id) : undefined,
        }),
      );
      const result = await sendMail({
        to,
        subject: "Tu perfil de LABURO sigue sin revisar",
        html,
        // List-Unsubscribe + one-click: mail de tanda, sale con vía de baja
        // SIEMPRE (misma regla que la bienvenida).
        headers: bajaHeaders(row.profile_id),
      });
      if (result.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      // Defensa en profundidad: el mailer no tira, pero envolvemos el render.
      console.error(
        "[cron/recordatorio-perfil] send failed for",
        row.profile_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  const { data: pending } = await supabase.rpc("staff_app_perfil_reminder_pending", {
    p_dias: dias,
  });

  return Response.json({
    ok: true,
    tanda: limit,
    dias,
    recordadas: rows.length,
    sent,
    failed,
    skipped,
    pending: pending ?? null,
  });
}
