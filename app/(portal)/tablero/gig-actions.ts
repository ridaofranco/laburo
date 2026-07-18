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
