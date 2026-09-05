"use server";

/**
 * Server actions de EVENTOS (gigs) del productor. Crear/editar vía los RPC
 * SECURITY DEFINER staff_app_create_gig / update_gig (0013, is_org_writer). El
 * cliente autenticado lleva el JWT; jamás service-role.
 *
 * ── POR QUÉ ACÁ SE PASA p_org (arreglo de seguridad, no cosmético) ──────────
 * Las cuatro RPC de este archivo resuelven su organización adentro de la base
 * con `staff_app.resolve_org(p_org)`, que es
 * `coalesce(p_org, current_org_id(), default_org_id())`. Si p_org no viaja,
 * `current_org_id()` devuelve LA MEMBRESÍA MÁS ANTIGUA del usuario, no la que
 * validó la app. Con dos membresías eso está verificado contra producción: el
 * evento se creó en SOMOS DER (la organización plataforma) en vez de en la
 * productora. O sea que la organización la terminaba eligiendo Postgres.
 *
 * ⚠️ Este archivo NO tenía ningún gate de organización: era el que más fácil
 * escribía en la organización equivocada. Ahora cada action resuelve la
 * membresía con exigirOrg() y le pasa ese id a la RPC. El molde es
 * app/(portal)/pagos/pago-actions.ts, el primer lugar del repo que lo hizo bien.
 *
 * ⚠️ NO hay bloque de reintento con la firma vieja (pago-actions sí lo tiene,
 * porque su migración estaba sin aplicar). Acá las cuatro firmas YA aceptan
 * p_org en producción, verificado. Un reintento sin p_org sería volver a
 * silencio a la conducta que este archivo arregla: si alguna vez apareciera un
 * PGRST202, tiene que verse como error, no taparse.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";

/**
 * Gate de organización para las actions de este archivo.
 *
 * Es exigirOrg() con el throw traducido a un `{ ok: false }`, porque las cuatro
 * actions de acá tienen contrato `{ ok, reason }` y un throw suelto le llega al
 * navegador como error de server action, no como mensaje. El chequeo es el
 * mismo: si no sos miembro de ninguna organización, no escribís.
 *
 * Devuelve el organizationId tal cual, que puede ser null si lib/org.ts tuvo que
 * caer a la vista vieja `staff_app_my_membership` (deploy anterior a la 0035).
 * En ese caso p_org viaja null y la base resuelve como antes: es el mismo
 * fallback que ya usa pago-actions.ts.
 */
async function orgDeEscritura(): Promise<
  { ok: true; orgId: string | null } | { ok: false; reason: string }
> {
  try {
    const org = await exigirOrg();
    return { ok: true, orgId: org.organizationId };
  } catch {
    return { ok: false, reason: "No sos miembro de ninguna productora." };
  }
}

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
  const org = await orgDeEscritura();
  if (!org.ok) return org;

  const supabase = await createClient();
  const clean = slots
    .map((s) => ({ role: s.role.trim(), quantity: Math.round(s.quantity) }))
    .filter((s) => s.role !== "" && s.quantity > 0);
  const { data, error } = await supabase.rpc("staff_app_set_gig_slots", {
    p_gig_id: gigId,
    p_slots: clean,
    p_org: org.orgId,
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
  const org = await orgDeEscritura();
  if (!org.ok) return org;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_set_gig_details", {
    p_gig_id: gigId,
    p_client_budget: input.clientBudget,
    p_venue_lat: input.venueLat,
    p_venue_lng: input.venueLng,
    p_venue_address: input.venueAddress,
    p_org: org.orgId,
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
  const org = await orgDeEscritura();
  if (!org.ok) return org;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_create_gig", {
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_venue: input.venue,
    p_org: org.orgId,
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
  const org = await orgDeEscritura();
  if (!org.ok) return org;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_update_gig", {
    p_gig_id: gigId,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_venue: input.venue,
    p_status: null,
    p_org: org.orgId,
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
