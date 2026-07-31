"use server";

/**
 * Mover el estado de un lead de productor desde /leads.
 *
 * ⚠️ REQUIERE LA MIGRACIÓN staff_app_0039_producer_leads APLICADA. Hasta que se
 * aplique, la RPC no existe y esta acción devuelve {ok:false} con un mensaje
 * honesto: el botón avisa que falta la migración, no rompe la pantalla.
 *
 * Molde de pago-actions.ts:
 *  1. Gate de membresía con exigirOrg() (lib/org.ts).
 *  2. RPC con el MISMO cliente autenticado (no service-role): la 0039 la grantea
 *     a `authenticated` y adentro vuelve a chequear is_org_writer con el JWT
 *     real. O sea, el permiso lo decide Postgres, no esta función.
 *
 * ⚠️ POR QUÉ NO SE LEE staff_app_my_membership CON .maybeSingle()
 * Así estaba escrito al nacer esta pantalla (30/7) y es el patrón que rompe con
 * dos organizaciones: `maybeSingle()` tira PGRST116 apenas la consulta devuelve
 * más de una fila, y el día que Franco acompañe a una productora aliada va a
 * tener dos membresías. Toda la pantalla dejaría de cargar, con un error crudo.
 * `exigirOrg()` pide las orgs ordenadas y se queda con la primera.
 */

import { revalidatePath } from "next/cache";
import { exigirOrg } from "@/lib/org";
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
  await exigirOrg(); // tira "forbidden" si el caller no es miembro de ninguna org
  const supabase = await createClient();

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
