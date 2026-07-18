"use server";

/**
 * Server actions de EVENTOS (gigs) del productor. Crear/editar vía los RPC
 * SECURITY DEFINER staff_app_create_gig / update_gig (0013, is_org_writer). El
 * cliente autenticado lleva el JWT; jamás service-role.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface GigInput {
  title: string;
  startsAt: string | null; // ISO o null
  endsAt: string | null;
  venue: string;
}

export interface GigDetailsInput {
  clientBudget: number | null;
  venueLat: number | null;
  venueLng: number | null;
  venueAddress: string | null;
}

/**
 * Setea los "extras" del gig (ingreso del cliente para el margen + ubicación del
 * predio para geofencing) vía RPC dedicada, sin tocar create/update_gig. Se llama
 * siempre con el set completo (el form es la fuente), así no pisa lo que ya había.
 */
/**
 * Geocodifica una dirección a lat/lng con Nominatim (OpenStreetMap, gratis). Uso
 * bajo volumen (el productor carga eventos de a poco), dentro de la policy de OSM
 * (User-Agent + poca frecuencia). Devuelve null si no encuentra o falla; el que
 * llama guarda la dirección igual y el geofencing simplemente no aplica.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = (address ?? "").trim();
  if (q.length < 4) return null;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "LABURO/1.0 (staff app; contacto rrhh@somosder.com.ar)" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export interface GigSlot {
  role: string;
  quantity: number;
}

/** Reemplaza la dotación requerida del gig (puestos {rol, cantidad}) vía RPC. */
export async function setGigSlots(
  gigId: string,
  slots: GigSlot[],
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const clean = slots
    .map((s) => ({ role: s.role.trim(), quantity: Math.round(s.quantity) }))
    .filter((s) => s.role !== "" && s.quantity > 0);
  const { data, error } = await supabase.rpc("staff_app_set_gig_slots", {
    p_gig_id: gigId,
    p_slots: clean,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudieron guardar los puestos." };
  }
  revalidatePath("/tablero");
  return { ok: true };
}

export async function setGigDetails(
  gigId: string,
  input: GigDetailsInput,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_set_gig_details", {
    p_gig_id: gigId,
    p_client_budget: input.clientBudget,
    p_venue_lat: input.venueLat,
    p_venue_lng: input.venueLng,
    p_venue_address: input.venueAddress,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudieron guardar los datos del evento." };
  }
  revalidatePath("/tablero");
  revalidatePath("/rentabilidad");
  return { ok: true };
}

export async function createGig(
  input: GigInput,
): Promise<{ ok: boolean; reason?: string; gigId?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_create_gig", {
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_venue: input.venue,
  });
  const res = data as { ok: boolean; reason?: string; gig_id?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudo crear el evento." };
  }
  revalidatePath("/tablero");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  return { ok: true, gigId: res.gig_id };
}

export async function updateGig(
  gigId: string,
  input: GigInput,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_update_gig", {
    p_gig_id: gigId,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_venue: input.venue,
    p_status: null,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudo guardar el evento." };
  }
  revalidatePath("/tablero");
  revalidatePath("/dashboard");
  revalidatePath("/calendario");
  return { ok: true };
}
