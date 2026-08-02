"use server";

/**
 * El marketplace, del lado de la persona que busca trabajo.
 *
 * Hasta la 0052 LABURO era de una sola dirección: la productora buscaba y
 * mandaba una oferta, y la persona esperaba. Acá la persona ve qué hay abierto y
 * levanta la mano.
 *
 * Todo pasa por los RPC SECURITY DEFINER de la 0052, que resuelven la identidad
 * por `my_staff_profile_id` (email verificado de la sesión). El browser manda un
 * id de búsqueda y NADA más: que esté publicada, que sea de su organización y
 * que el evento no haya pasado lo valida el servidor. Acá no se decide nada.
 */

import { createClient } from "@/lib/supabase/server";

export interface TrabajoAbierto {
  opening_id: string;
  role: string;
  cupo: number;
  pago: number | null;
  notas: string | null;
  gig_id: string;
  gig_title: string | null;
  gig_starts_at: string | null;
  gig_ends_at: string | null;
  gig_venue: string | null;
  ya_me_postule: boolean;
  mi_estado: string | null;
}

/** Las búsquedas abiertas para el caller. Vacío si no es staff. */
export async function getTrabajosAbiertos(): Promise<TrabajoAbierto[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_trabajos_abiertos");
  return (data as TrabajoAbierto[] | null) ?? [];
}

/** Motivos del servidor traducidos a algo que se pueda leer Y resolver. */
function motivo(reason: string | undefined): string {
  switch (reason) {
    case "no_disponible":
      return "Esa búsqueda ya no está abierta. Actualizá la lista.";
    case "ya_paso":
      return "Ese evento ya pasó.";
    case "not_staff":
      return "Se cerró tu sesión. Entrá de nuevo y probá otra vez.";
    case "no_se_puede":
      return "No te podés bajar: ya te mandaron la oferta. Respondela desde tu panel.";
    default:
      return "No se pudo. Probá de nuevo.";
  }
}

export async function postularme(
  openingId: string,
  mensaje?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_postularme", {
    p_opening_id: openingId,
    p_mensaje: mensaje?.trim() || null,
  });
  if (error) {
    console.error("[trabajos] postularme falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) return { ok: false, error: motivo(r?.reason) };
  return { ok: true };
}

export async function despostularme(
  openingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_despostularme", {
    p_opening_id: openingId,
  });
  if (error) {
    console.error("[trabajos] despostularme falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) return { ok: false, error: motivo(r?.reason) };
  return { ok: true };
}
