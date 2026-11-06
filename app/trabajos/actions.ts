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
import { getMyStaffProfile } from "@/lib/staff";
import { registrarDenuncia, motivoValido } from "@/lib/denuncias";

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
  // 0107: condiciones separadas, quién publica y por qué encaja.
  horario?: string | null;
  vestimenta?: string | null;
  comida?: string | null;
  traslado?: string | null;
  forma_pago?: string | null;
  plazo_pago?: string | null;
  gig_address?: string | null;
  productora?: string | null;
  encaje?: { rubro: boolean; zona: boolean; disponible: boolean } | null;
}

/** Las búsquedas abiertas para el caller. Vacío si no es staff. */
export async function getTrabajosAbiertos(): Promise<TrabajoAbierto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_trabajos_abiertos");
  // Un error no es «no hay búsquedas abiertas».
  if (error) throw new Error(`[trabajos] no se pudo leer la lista: ${error.message}`);
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

/**
 * Denunciar una búsqueda abierta (Franco 31/10). Solo para staff con sesión, y
 * solo sobre una búsqueda que ESA persona ve abierta: el id que manda el browser
 * se busca en su propia lista, así no se puede usar para mandar avisos al voleo.
 */
export async function denunciarTrabajo(
  openingId: string,
  motivoDenuncia: string,
  detalle: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!motivoValido(motivoDenuncia)) return { ok: false, error: "Elegí un motivo." };
  const perfil = await getMyStaffProfile();
  if (!perfil) return { ok: false, error: "Se cerró tu sesión. Entrá de nuevo y probá otra vez." };
  let trabajo: TrabajoAbierto | undefined;
  try {
    trabajo = (await getTrabajosAbiertos()).find((t) => t.opening_id === openingId);
  } catch {
    trabajo = undefined;
  }
  if (!trabajo) return { ok: false, error: "Esa búsqueda ya no está abierta. Si igual querés denunciarla, escribí a hola@laburo.somosder.ar." };
  const ok = await registrarDenuncia({ tipo: "busqueda", openingId: trabajo.opening_id }, {
    motivo: motivoDenuncia,
    detalle,
    donde: "Trabajos disponibles (portal de staff)",
    rol: trabajo.role,
    evento: trabajo.gig_title,
    referencia: `búsqueda ${trabajo.opening_id} · evento ${trabajo.gig_id}`,
    denunciante: [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") + (perfil.email ? ` <${perfil.email}>` : ""),
  });
  if (!ok) return { ok: false, error: "No se pudo mandar. Escribí a hola@laburo.somosder.ar." };
  return { ok: true };
}
