/**
 * Cron del AVISO DE CIERRE del pedido de precio (0098, LICITACIONES.md pregunta 3).
 *
 * A quien hizo el pedido le llega UN mail cuando el pedido llega a su fecha de
 * cierre sin que nadie haya elegido ni cerrado a mano: cuántos presupuestos
 * llegaron y el botón para elegir, o, si no llegó ninguno, para darle más
 * tiempo o invitar a más. Antes vencía en silencio.
 *
 * Igual que el recordatorio, NO tiene interruptor: le escribe a la persona que
 * armó el pedido, sobre su propio pedido, una sola vez. Con 0 pedidos abiertos
 * es un no-op.
 *
 * EXACTLY-ONCE: la RPC estampa `cierre_avisado_at` al seleccionar. Se prefiere
 * perder un aviso antes que mandar dos. Solo mira pedidos que cerraron en los
 * últimos 7 días: uno de hace meses no sirve de nada.
 *
 * SEGURIDAD: misma auth fail-closed que las otras rutas de cron.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { CierrePedido, asuntoCierrePedido } from "@/components/emails/cierre-pedido-email";
import { siteUrl } from "@/lib/site";
import { alerta } from "@/lib/alerta";

export const dynamic = "force-dynamic";

interface Fila {
  request_id: string;
  email: string | null;
  titulo: string | null;
  categoria: string | null;
  cierra_at: string | null;
  organizacion: string | null;
  invitados: number | null;
  cotizaron: number | null;
}

export async function GET(request: Request) {
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = request.headers.get("authorization");
  if (!aceptados.length || !aceptados.some((s) => auth === `Bearer ${s}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Sin vía de envío no se pide la tanda: la RPC estampa al seleccionar, así que
  // pedirla sin poder mandar quemaría los avisos.
  if (!emailEnabled()) {
    return Response.json(
      {
        ok: false,
        error: "sin_email",
        hint: "Falta RESEND_API_KEY o el SMTP en el env. No se pidió la tanda.",
        sent: 0,
      },
      { status: 503 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("staff_app_avisos_de_cierre", {
    p_dias: 7,
    p_limit: 50,
  });

  if (error) {
    console.error("[cron/aviso-cierre-cotizacion] rpc failed:", error.message);
    await alerta({
      titulo: "El aviso de cierre de pedidos de precio se rompió",
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
    const titulo = f.titulo ?? "Tu pedido de precio";
    const cotizaron = f.cotizaron ?? 0;
    try {
      const html = await render(
        createElement(CierrePedido, {
          titulo,
          categoria: f.categoria,
          productora: f.organizacion ?? "",
          invitados: f.invitados ?? 0,
          cotizaron,
          link: siteUrl(`/cotizaciones/${f.request_id}`),
        }),
      );
      const res = await sendMail({ to, subject: asuntoCierrePedido(titulo, cotizaron), html });
      if (res.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      console.error(
        "[cron/aviso-cierre-cotizacion] send failed for",
        f.request_id,
        e instanceof Error ? e.message : String(e),
      );
      failed += 1;
    }
  }

  return Response.json({ ok: true, avisados: filas.length, sent, failed, skipped });
}
