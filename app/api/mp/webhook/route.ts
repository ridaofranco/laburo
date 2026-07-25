/**
 * Webhook de MercadoPago (notificación de pagos). Fase 1: cobro al cliente.
 *
 * MP avisa cuando cambia un pago. NO confiamos en el body: re-fetcheamos el pago
 * desde la API de MP con nuestro access token (autoritativo). Si está approved,
 * marcamos el gig como cobrado por su external_reference (= gig id) vía RPC
 * service-role. Idempotente (la RPC no repite si ya estaba pagado).
 *
 * REINTENTOS (corregido 2026-07-25): MercadoPago reintenta la notificación SOLO
 * ante respuestas no-2xx. Antes este handler devolvía 200 aun cuando fallaba, con
 * un comentario que decía lo contrario, así que un fallo transitorio (Supabase
 * caído, timeout de la API de MP) perdía el pago para siempre: el cliente pagaba
 * y el gig quedaba pending eternamente. Ahora los errores devuelven 500 para que
 * MP reintente. Los casos que NO nos aplican (type != payment, sin paymentId,
 * sin token) siguen devolviendo 200 para no generar loops de reintento inútiles.
 * Mismo criterio que ENTRA (api/mp-webhook.ts).
 *
 * FIRMA (x-signature): se valida solo si MP_WEBHOOK_SECRET está configurado, para
 * no romper la integración existente mientras Franco no la cargue en Vercel. Sin
 * el secreto seguimos dependiendo de la re-consulta autoritativa a MP, que ya
 * hace que un paymentId inventado no sirva de nada.
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Valida el header `x-signature` de MercadoPago.
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Devuelve true si no hay secreto configurado (no bloqueamos lo que ya anda).
 */
function signatureOk(request: Request, paymentId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const sig = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const ts = /ts=([^,]+)/.exec(sig)?.[1]?.trim();
  const v1 = /v1=([^,]+)/.exec(sig)?.[1]?.trim();
  if (!ts || !v1) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparación en tiempo constante (evita timing attacks).
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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

  if (!signatureOk(request, String(paymentId))) {
    console.error("[mp/webhook] firma x-signature inválida para", paymentId);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const p = await new Payment(client).get({ id: String(paymentId) });
    const gigId = p.external_reference || null;
    const pid = String(p.id ?? paymentId);
    const admin = createServiceRoleClient();

    // Registrar SIEMPRE el intento (aprobado, rechazado, pendiente...) para el panel.
    // supabase-js NO tira ante error: devuelve { error }. Hay que mirarlo o el
    // fallo pasa desapercibido.
    const { error: logError } = await admin.rpc("staff_app_log_payment_event", {
      p_gig_id: gigId,
      p_payment_id: pid,
      p_status: p.status ?? null,
      p_status_detail: p.status_detail ?? null,
      p_amount: p.transaction_amount ?? null,
    });
    if (logError) throw logError;

    // Marcar el evento cobrado solo si el pago fue aprobado Y por el monto que
    // corresponde.
    //
    // POR QUÉ EL MONTO: el link de pago se genera con el presupuesto del evento
    // en ese momento, pero el presupuesto puede cambiar después (se agrega gente,
    // se suma un día). Si el cliente paga el link viejo, MercadoPago avisa
    // "approved" igual y el evento quedaba dado por cobrado por menos plata.
    // ENTRÁ tenía exactamente este agujero (se emitían tickets sin verificar
    // cuánto se había cobrado) y se cerró; acá se cierra antes de que pase.
    if (p.status === "approved" && gigId) {
      const pagado = Number(p.transaction_amount ?? 0);

      // Cuánto tendría que haber pagado. Se lee con service-role de la vista que
      // ya usa la pantalla que genera el link.
      const { data: gig, error: gigError } = await admin
        .from("staff_app_gigs")
        .select("client_budget")
        .eq("id", gigId)
        .maybeSingle();

      const esperado = Number((gig as { client_budget: number | null } | null)?.client_budget ?? 0);

      // FAIL-OPEN A PROPÓSITO en la lectura: si no pudimos averiguar el monto
      // esperado, marcamos cobrado igual. Un pago real sin registrar es peor que
      // un pago de menos registrado, y el evento queda en los logs para revisar.
      if (gigError || !(esperado > 0)) {
        console.warn(
          "[mp/webhook] no pude verificar el monto esperado del gig",
          gigId,
          gigError?.message ?? "sin client_budget",
        );
      } else if (pagado + 1 < esperado) {
        // Tolerancia de $1 por redondeos. Pagó de menos: NO se marca cobrado.
        // Devolvemos 200 (no 500) porque reintentar la notificación no va a
        // cambiar el monto: esto lo tiene que resolver una persona.
        console.error(
          `[mp/webhook] PAGO INSUFICIENTE, no marco cobrado → gig=${gigId} pago=${pid} pagado=${pagado} esperado=${esperado}`,
        );
        return NextResponse.json({ ok: true, warning: "monto_insuficiente" });
      }

      const { error: paidError } = await admin.rpc("staff_app_mark_gig_paid", {
        p_gig_id: gigId,
        p_payment_id: pid,
      });
      if (paidError) throw paidError;
    }
  } catch (e) {
    console.error(
      "[mp/webhook] fallo procesando el pago",
      paymentId,
      e instanceof Error ? e.message : String(e),
    );
    // 500 → MercadoPago reintenta la notificación más tarde. NO devolver 200 acá:
    // sería dar por procesado un pago que no se registró.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
