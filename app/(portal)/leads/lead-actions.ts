"use server";

/**
 * Mover el estado de un lead de productor desde /leads.
 *
 * ⚠️ REQUIERE LA MIGRACIÓN staff_app_0039_producer_leads APLICADA. Hasta que se
 * aplique, la RPC no existe y esta acción devuelve {ok:false} con un mensaje
 * honesto: el botón avisa que falta la migración, no rompe la pantalla.
 *
 * Molde de pago-actions.ts:
 *  1. Gate de membresía con el CLIENTE AUTENTICADO (staff_app_my_membership).
 *  2. RPC con el MISMO cliente autenticado (no service-role): la 0039 la grantea
 *     a `authenticated` y adentro vuelve a chequear is_org_writer con el JWT
 *     real. O sea, el permiso lo decide Postgres, no esta función.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LeadEstado = "nuevo" | "contactado" | "descartado";

export interface LeadEstadoResult {
  ok: boolean;
  reason?: string;
}

export async function marcarLeadEstado(
  leadId: string,
  estado: LeadEstado,
): Promise<LeadEstadoResult> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();
  if (!membership) throw new Error("forbidden");

  const { data, error } = await supabase.rpc("staff_app_marcar_lead_estado", {
    p_lead_id: leadId,
    p_estado: estado,
  });

  if (error) {
    console.error("[leads] marcar_lead_estado falló:", error.message);
    const faltaMigracion = /staff_app_marcar_lead_estado/i.test(error.message);
    return {
      ok: false,
      reason: faltaMigracion
        ? "Falta aplicar la migración 0039 en Supabase. Hasta eso, el estado no se puede cambiar."
        : "No se pudo cambiar el estado. Probá de nuevo.",
    };
  }

  const res = (data ?? null) as { ok?: boolean; reason?: string } | null;
  if (!res?.ok) {
    return {
      ok: false,
      reason:
        res?.reason === "forbidden"
          ? "No tenés permiso para tocar los leads."
          : "No se encontró ese lead.",
    };
  }

  revalidatePath("/leads");
  return { ok: true };
}
