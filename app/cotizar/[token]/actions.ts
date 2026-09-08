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
 *
 * ⚠️ Y EL TOTAL NO SE MANDA CUANDO HAY ÍTEMS (8/9). La pantalla muestra la suma
 * mientras se escribe, pero el número que queda guardado lo calcula la base
 * sumando las líneas. Si el total viajara desde acá, la tabla comparativa del
 * otro lado podría ordenar por un número que no es la suma de lo que se ve
 * debajo, y nadie se enteraría.
 */

import { createClient } from "@/lib/supabase/server";

const MENSAJES: Record<string, string> = {
  invalido: "Este link no es válido. Pedile uno nuevo a quien te lo mandó.",
  cerrado: "El pedido se cerró y ya no se pueden cargar presupuestos.",
  monto_required: "Poné el precio: sin un número, esto no se puede comparar.",
  incluye_required: "Contá qué incluye ese precio. Es lo que lo hace comparable.",
  respuestas_invalidas: "Algo quedó mal en el detalle. Recargá la página.",
  // Los cuatro de las líneas. Los tres primeros no los puede provocar la
  // pantalla (arma las líneas ella misma sobre los ítems que le llegaron), así
  // que si aparecen es que el pedido cambió abajo: recargar es la salida.
  lineas_invalidas: "El desglose quedó mal armado. Recargá la página.",
  linea_desconocida: "El pedido cambió mientras cargabas. Recargá la página.",
  linea_sin_monto: "Algún ítem quedó sin precio y sin marcar. Recargá la página.",
  nada_cotizado:
    "Marcaste todo como que no lo hacés. Poné el precio de al menos un ítem, o contestale que no a quien te lo pidió.",
};

/**
 * Una línea del desglose, tal como la manda la pantalla.
 *
 * ⚠️ `monto` en null Y `noCotiza` en false NO se manda nunca: eso es "todavía no
 * lo cargué", y se dice no mandando la línea. La base lo rechaza igual
 * (linea_sin_monto), pero el que decide qué es qué es el que la arma.
 */
export interface LineaAGuardar {
  itemId: string;
  monto: number | null;
  noCotiza: boolean;
  comentario?: string;
}

export async function guardarCotizacion(input: {
  token: string;
  /** null cuando el pedido viene partido en ítems: ahí el total lo suma la base. */
  monto: number | null;
  incluye: string;
  noIncluye?: string;
  moneda?: string;
  validezDias?: number | null;
  respuestas: Record<string, string>;
  lineas?: LineaAGuardar[];
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
    p_lineas: (input.lineas ?? []).map((l) => ({
      item_id: l.itemId,
      monto: l.monto,
      no_cotiza: l.noCotiza,
      comentario: (l.comentario || "").trim() || null,
    })),
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
