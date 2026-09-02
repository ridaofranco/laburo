"use server";

/**
 * Cobro al cliente vía MercadoPago (Checkout Pro), Fase 1.
 *
 * createClientCheckout: crea una preferencia de pago por el monto del "ingreso
 * del cliente" del evento y devuelve el link para mandárselo al cliente. Guarda
 * la preferencia en el gig (queda 'pending'); el webhook la marca 'paid'.
 *
 * ⚠️ Seguridad de plata: en dev usamos SIEMPRE el sandbox_init_point (tarjetas de
 * prueba, cero plata real). En prod, el init_point real. Si en dev no hay sandbox
 * (credenciales de producción sin sandbox), NO devolvemos el link real: cortamos.
 *
 * ⚠️ HOY ESTE CIRCUITO ESTÁ ENTERO PERO APAGADO. LABURO es gratis por decisión de
 * producto (2/9/2026), así que la primera línea de la action corta con la bandera
 * de lib/cobros.ts. No se borró nada: para prenderlo, mirá ese archivo.
 */

import { revalidatePath } from "next/cache";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL as SITE } from "@/lib/site";
import { COBRO_AL_CLIENTE_ACTIVO, COBRO_APAGADO_MOTIVO } from "@/lib/cobros";

export async function createClientCheckout(
  gigId: string,
): Promise<{ ok: boolean; reason?: string; url?: string }> {
  // El cobro está apagado por decisión de producto. Va ANTES que todo: una server
  // action es un endpoint POST invocable, esconder el botón del tablero no alcanza.
  if (!COBRO_AL_CLIENTE_ACTIVO) return { ok: false, reason: COBRO_APAGADO_MOTIVO };

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, reason: "MercadoPago no está configurado todavía." };

  const supabase = await createClient();
  const { data: gig } = await supabase
    .from("staff_app_gigs")
    .select("id,title,client_budget")
    .eq("id", gigId)
    .maybeSingle();
  if (!gig) return { ok: false, reason: "Evento no encontrado." };

  const amount = Number((gig as { client_budget: number | null }).client_budget) || 0;
  if (!(amount > 0)) {
    return { ok: false, reason: "Cargá primero el ingreso del cliente en el evento." };
  }

  let created: { id?: string; init_point?: string; sandbox_init_point?: string };
  try {
    const client = new MercadoPagoConfig({ accessToken });
    created = await new Preference(client).create({
      body: {
        items: [
          {
            id: gig.id,
            title: `Evento: ${(gig as { title: string | null }).title ?? "LABURO"}`,
            quantity: 1,
            unit_price: amount,
            currency_id: "ARS",
          },
        ],
        external_reference: gig.id, // el webhook matchea el gig por acá
        notification_url: `${SITE}/api/mp/webhook`,
        back_urls: {
          success: `${SITE}/tablero`,
          pending: `${SITE}/tablero`,
          failure: `${SITE}/tablero`,
        },
      },
    });
  } catch {
    return { ok: false, reason: "No se pudo generar el link de pago. Probá de nuevo." };
  }

  // Money-safe: usamos el checkout SANDBOX (tarjetas de prueba, cero plata real)
  // salvo que estemos en prod Y MP_SANDBOX no esté prendido. Para probar en prod
  // sin cobrar de verdad, seteá MP_SANDBOX=true; para cobrar real, sacalo.
  const sandbox = process.env.NODE_ENV !== "production" || process.env.MP_SANDBOX === "true";
  const url = sandbox ? created.sandbox_init_point : created.init_point;
  if (!created.id || !url) {
    return {
      ok: false,
      reason: sandbox
        ? "El checkout de prueba no está disponible. Necesito credenciales de PRUEBA (TEST-) de MercadoPago."
        : "MercadoPago no devolvió el link.",
    };
  }

  const { data, error } = await supabase.rpc("staff_app_set_gig_payment_pref", {
    p_gig_id: gigId,
    p_preference_id: created.id,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? "No se pudo guardar la preferencia de pago." };
  }
  revalidatePath("/tablero");
  return { ok: true, url };
}
