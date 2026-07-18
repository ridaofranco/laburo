/**
 * Webhook de MercadoPago (notificación de pagos). Fase 1: cobro al cliente.
 *
 * MP avisa cuando cambia un pago. NO confiamos en el body: re-fetcheamos el pago
 * desde la API de MP con nuestro access token (autoritativo). Si está approved,
 * marcamos el gig como cobrado por su external_reference (= gig id) vía RPC
 * service-role. Idempotente (la RPC no repite si ya estaba pagado). Siempre 200
 * para que MP no reintente en loop ante casos que no nos aplican.
 */

import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return NextResponse.json({ ok: true });

  let body: { type?: string; action?: string; data?: { id?: string } } = {};
  try {
    body = await request.json();
  } catch {
    // MP a veces notifica sin body JSON (query params); seguimos.
  }
  const url = new URL(request.url);
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const paymentId =
    body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";

  if (type !== "payment" || !paymentId) return NextResponse.json({ ok: true });

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const p = await new Payment(client).get({ id: String(paymentId) });
    const gigId = p.external_reference || null;
    const pid = String(p.id ?? paymentId);
    const admin = createServiceRoleClient();

    // Registrar SIEMPRE el intento (aprobado, rechazado, pendiente...) para el panel.
    await admin.rpc("staff_app_log_payment_event", {
      p_gig_id: gigId,
      p_payment_id: pid,
      p_status: p.status ?? null,
      p_status_detail: p.status_detail ?? null,
      p_amount: p.transaction_amount ?? null,
    });

    // Marcar el evento cobrado solo si el pago fue aprobado.
    if (p.status === "approved" && gigId) {
      await admin.rpc("staff_app_mark_gig_paid", { p_gig_id: gigId, p_payment_id: pid });
    }
  } catch {
    // Si falla el fetch, devolvemos 200 igual; MP reintenta la notificación.
  }
  return NextResponse.json({ ok: true });
}
