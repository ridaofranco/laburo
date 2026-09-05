"use server";

/**
 * Guardar la cotización del proveedor. Sin sesión: el gate es el token.
 *
 * ⚠️ Server Action y no un GET: un preview de link (WhatsApp, Gmail, un
 * antivirus corporativo) no puede dejar un precio cargado. Misma razón por la
 * que aceptar una oferta de staff tampoco es un GET.
 *
 * ⚠️ Las validaciones de verdad viven en la RPC, no acá: monto mayor a cero,
 * "qué incluye" no vacío, y el pedido abierto y sin cerrar. Esto solo traduce el
 * motivo a una frase que se entienda. Validar únicamente en el cliente sería
 * dejar la regla 1 (sin número no hay cotización) del lado que se puede saltear.
 */

import { createClient } from "@/lib/supabase/server";

const MENSAJES: Record<string, string> = {
  invalido: "Este link no es válido. Pedile uno nuevo a quien te lo mandó.",
  cerrado: "El pedido se cerró y ya no se pueden cargar presupuestos.",
  monto_required: "Poné el precio: sin un número, esto no se puede comparar.",
  incluye_required: "Contá qué incluye ese precio. Es lo que lo hace comparable.",
  respuestas_invalidas: "Algo quedó mal en el detalle. Recargá la página.",
};

export async function guardarCotizacion(input: {
  token: string;
  monto: number;
  incluye: string;
  noIncluye?: string;
  moneda?: string;
  validezDias?: number | null;
  respuestas: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_cotizar", {
    p_token: input.token,
    p_monto: input.monto,
    p_incluye: input.incluye.trim(),
    p_no_incluye: input.noIncluye?.trim() || null,
    p_moneda: input.moneda?.trim() || "ARS",
    p_validez_dias: input.validezDias ?? null,
    p_respuestas: input.respuestas ?? {},
  });

  if (error) {
    console.error("[cotizar] falló:", error.message);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }

  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) {
    return { ok: false, error: MENSAJES[r?.reason ?? ""] ?? "No se pudo guardar. Probá de nuevo." };
  }
  return { ok: true };
}
