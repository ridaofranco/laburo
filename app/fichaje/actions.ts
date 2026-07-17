"use server";

/**
 * Server actions de FICHAJE (fork "staff con cuenta"). check-in / check-out por
 * GPS vía los RPC SECURITY DEFINER staff_app_check_in/out (0012), que verifican
 * que el caller sea el staff (email) Y esté confirmado (oferta 'accepted') en ese
 * gig antes de registrar. La geolocalización la toma el cliente y la pasa acá.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function call(
  fn: "staff_app_check_in" | "staff_app_check_out",
  gigId: string,
  lat: number | null,
  lng: number | null,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "No hay sesión activa." };

  const { data, error } = await supabase.rpc(fn, {
    p_gig_id: gigId,
    p_lat: lat,
    p_lng: lng,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudo registrar." };
  }
  revalidatePath("/fichaje");
  revalidatePath("/panel-staff");
  return { ok: true };
}

export async function checkIn(gigId: string, lat: number | null, lng: number | null) {
  return call("staff_app_check_in", gigId, lat, lng);
}

export async function checkOut(gigId: string, lat: number | null, lng: number | null) {
  return call("staff_app_check_out", gigId, lat, lng);
}
