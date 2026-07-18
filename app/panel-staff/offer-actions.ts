"use server";

/**
 * Server actions del STAFF para responder sus propias ofertas desde la cuenta
 * (no solo por el link mágico del email). Usan los RPC SECURITY DEFINER
 * staff_app_accept_my_offer / decline_my_offer (0013), que verifican por email
 * que la oferta sea del caller y esté vigente. Aceptar crea el crew (igual que el
 * flujo por token).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function respond(
  fn: "staff_app_accept_my_offer" | "staff_app_decline_my_offer",
  offerId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "No hay sesión activa." };

  const { data, error } = await supabase.rpc(fn, { p_offer_id: offerId });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudo procesar." };
  }
  revalidatePath("/panel-staff");
  revalidatePath("/fichaje");
  return { ok: true };
}

export async function acceptMyOffer(offerId: string) {
  return respond("staff_app_accept_my_offer", offerId);
}

export async function declineMyOffer(offerId: string) {
  return respond("staff_app_decline_my_offer", offerId);
}
