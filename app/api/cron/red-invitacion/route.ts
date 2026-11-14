/**
 * Tanda de INVITACIÓN A LA RED de proveedores y salones (0110, 14/11).
 *
 * Prendida por defecto (decisión de Franco: «hacé todo»): 50 por corrida, para
 * no pasar el tope diario del plan gratis de Resend junto con los otros mails de
 * LABURO. RED_INVITACION_BATCH en Vercel lo cambia (0 la apaga).
 *
 * Exactly-once en la RPC: estampa invitado_at AL SELECCIONAR. Si un mail falla,
 * ese perfil no se reintenta (preferimos perder uno antes que mandar dos).
 * Se llama desde /api/cron/diario (TANDAS); a mano también, con CRON_SECRET.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, emailEnabled } from "@/lib/email/mailer";
import { RedInvitacionEmail, asuntoRedInvitacion, idiomaDePais } from "@/components/emails/red-invitacion-email";
import { siteUrl } from "@/lib/site";
import { alerta } from "@/lib/alerta";

export const dynamic = "force-dynamic";

function batchSize(): number {
  const env = process.env.RED_INVITACION_BATCH;
  if (env === undefined || env === "") return 50;
  const n = Number(env);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 200);
}

interface Fila {
  profile_id: string;
  email: string | null;
  nombre: string | null;
  tipo: string;
  pais: string | null;
  rubro: string | null;
  token: string;
  baja_token: string;
}

export async function GET(request: Request) {
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = request.headers.get("authorization");
  if (!aceptados.length || !aceptados.some((s) => auth === `Bearer ${s}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = batchSize();
  const supabase = createServiceRoleClient();

  if (limit === 0) {
    const { data: pending } = await supabase.rpc("staff_app_red_invitar_pending");
    return Response.json({ ok: true, tanda: "apagada", pending: pending ?? null, sent: 0 });
  }
  if (!emailEnabled()) {
    return Response.json({ ok: false, error: "sin_email", sent: 0 }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("staff_app_red_invitar_batch", { p_limit: limit });
  if (error) {
    console.error("[cron/red-invitacion] rpc failed:", error.message);
    await alerta({ titulo: "La tanda de invitación a la red se rompió", detalle: error.message });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const filas = (data as Fila[] | null) ?? [];
  let sent = 0;
  let failed = 0;
  for (const f of filas) {
    const to = f.email?.trim();
    if (!to) continue;
    const idioma = idiomaDePais(f.pais);
    const nombre = (f.nombre ?? "").replace(/\s*\(.*?\)\s*/g, " ").trim() || "Hola";
    const linkBaja = siteUrl(`/red?a=baja&t=${f.baja_token}`);
    try {
      const html = await render(
        createElement(RedInvitacionEmail, {
          idioma,
          nombre,
          rubro: f.rubro,
          linkPanel: siteUrl(`/acceso-proveedor/${f.token}`),
          linkPerfil: null,
          linkPrecios: siteUrl(`/red?a=precios&t=${f.baja_token}`),
          linkBaja,
        }),
      );
      const r = await sendMail({
        to,
        subject: asuntoRedInvitacion(idioma, nombre),
        html,
        headers: { "List-Unsubscribe": `<${linkBaja}>` },
      });
      if (r.ok) sent += 1;
      else failed += 1;
    } catch (e) {
      console.error("[cron/red-invitacion] send failed", f.profile_id, e instanceof Error ? e.message : String(e));
      failed += 1;
    }
  }

  const { data: pending } = await supabase.rpc("staff_app_red_invitar_pending");
  return Response.json({ ok: true, tanda: limit, invitados: filas.length, sent, failed, pending: pending ?? null });
}
