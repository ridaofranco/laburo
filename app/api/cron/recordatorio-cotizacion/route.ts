/**
 * Cron del RECORDATORIO DE COTIZACIÓN (etapa 5 de LICITACIONES.md).
 *
 * Le escribe a los invitados que todavía no cotizaron, de los pedidos que
 * cierran dentro de las próximas 48 horas. Sobre 370 correos, esto solo
 * probablemente valga más que todo el resto del producto: la diferencia entre 2
 * respuestas y 6 no es una pantalla más linda, es avisar antes de que cierre.
 *
 * ⚠️ ESTA TANDA **NO** TIENE INTERRUPTOR DE ENCENDIDO, y es a propósito. Las
 * otras dos (bienvenida, visibilidad) le escriben a cientos de personas que no
 * están esperando nada, y por eso salen apagadas por defecto. Esta le escribe a
 * alguien que hace días recibió una invitación explícita de una productora, a
 * la que todavía puede responder, y con la que ese mail es un favor. Ponerle
 * una variable que hay que acordarse de prender sería garantizar que el día que
 * sirva esté apagada.
 *
 * Igual no puede escribir de más: las cuatro condiciones viven en la RPC (0080),
 * el ancla `recordado_at` se estampa al seleccionar, y sin pedidos abiertos no
 * manda nada. Hoy, con 0 pedidos, es un no-op que corre en milisegundos.
 *
 * SEGURIDAD: misma auth fail-closed que las otras rutas de cron. Sin
 * CRON_SECRET/CF_CRON_SECRET, o con un bearer que no coincida EXACTO, 401.
 *
 * TRADE-OFF: la RPC estampa `recordado_at` ANTES de saber si el SMTP entregó.
 * Se prefiere perder un recordatorio antes que mandarle dos al mismo proveedor.
 * Un recordatorio es un favor; dos son spam.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { RecordatorioCotizar } from "@/components/emails/recordatorio-cotizar-email";
import { cotizarUrl } from "@/lib/cotizaciones";
import { fmtFechaHora } from "@/lib/dates";
import { alerta } from "@/lib/alerta";

export const dynamic = "force-dynamic";

/** Cuántas horas antes del cierre se avisa. 48 por defecto, configurable. */
function horas(): number {
  const raw = Number(process.env.RECORDATORIO_COTIZACION_HORAS);
  if (!Number.isFinite(raw) || raw <= 0) return 48;
  return Math.min(Math.floor(raw), 168);
}

interface Fila {
  invite_id: string;
  email: string | null;
  nombre: string | null;
  token: string | null;
  titulo: string | null;
  categoria: string | null;
  provincia: string | null;
  ciudad: string | null;
  cierra_at: string | null;
  organizacion: string | null;
}

/**
 * "mañana a las 18:00" cuando falta menos de un día y medio, y la fecha
 * completa cuando falta más. Una fecha se archiva; "mañana" mueve.
 */
function cuandoCierra(iso: string | null): string {
  if (!iso) return "pronto";
  const faltan = new Date(iso).getTime() - Date.now();
  const hs = faltan / 3_600_000;
  const hora = fmtFechaHora(iso, { hour: "2-digit", minute: "2-digit" });
  if (hs <= 14) return `hoy a las ${hora}`;
  if (hs <= 38) return `mañana a las ${hora}`;
  return (
    fmtFechaHora(iso, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "pronto"
  );
}

export async function GET(request: Request) {
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = request.headers.get("authorization");
  if (!aceptados.length || !aceptados.some((s) => auth === `Bearer ${s}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const p_horas = horas();

  // Sin vía de envío no se pide la tanda: la RPC estampa al seleccionar, así que
  // pedirla sin poder mandar quemaría los recordatorios.
  if (!emailEnabled()) {
    const { data: pendientes } = await supabase.rpc("staff_app_recordatorios_pendientes", {
      p_horas,
    });
    return Response.json(
      {
        ok: false,
        error: "sin_email",
        hint: "Falta RESEND_API_KEY o el SMTP en el env. No se pidió la tanda.",
        pendientes: pendientes ?? null,
        sent: 0,
      },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("staff_app_recordatorios_cotizacion", {
    p_horas,
    p_limit: 100,
  });

  if (error) {
    console.error("[cron/recordatorio-cotizacion] rpc failed:", error.message);
    await alerta({
      titulo: "El recordatorio de cotizaciones se rompió",
      detalle: error.message,
    });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const filas = (data as Fila[] | null) ?? [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const f of filas) {
    const to = f.email?.trim();
    if (!to) {
      skipped += 1;
      continue;
    }
    try {
      const html = await render(
        createElement(RecordatorioCotizar, {
          nombre: f.nombre,
          productora: f.organizacion ?? "Una productora",
          titulo: f.titulo ?? "",
          categoria: f.categoria,
          donde: [f.ciudad, f.provincia].filter(Boolean).join(", ") || null,
          cuandoCierra: cuandoCierra(f.cierra_at),
          // El token del recordatorio (0080). NO es el original: ese no se puede
          // reconstruir. Los dos valen a la vez, así que el mail viejo tampoco
          // se rompe.
          link: f.token ? cotizarUrl(f.token) : null,
        }),
      );
      const res = await sendMail({
        to,
        subject: `Cierra ${cuandoCierra(f.cierra_at)} · ${f.titulo ?? "pedido de presupuesto"}`,
        html,
      });
      if (res.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      console.error(
        "[cron/recordatorio-cotizacion] send failed for",
        f.invite_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  const { data: pendientes } = await supabase.rpc("staff_app_recordatorios_pendientes", {
    p_horas,
  });

  return Response.json({
    ok: true,
    horas: p_horas,
    recordados: filas.length,
    sent,
    failed,
    skipped,
    pendientes: pendientes ?? null,
  });
}
