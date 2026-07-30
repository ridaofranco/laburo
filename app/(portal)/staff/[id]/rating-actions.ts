"use server";

/**
 * Server action de RATING post-evento del candidato (XTRA-04, D-06),
 * member-gated.
 *
 * Producer-only: la calificación siembra la confiabilidad del marketplace v2 y es
 * invisible para el candidato (Pitfall 2 — nada en /o ni en get_public_offer). La
 * escritura pasa por el RPC public.staff_app_rate_staff (SECURITY DEFINER,
 * is_org_writer) con el CLIENTE AUTENTICADO — NUNCA service-role (grep-negativo
 * del cliente admin).
 *
 * Orden estricto, molde de offer-actions.ts / notes-actions.ts:
 *  1. Gate de membresía (staff_app_my_membership.maybeSingle) → throw "forbidden".
 *  2. Validar score entero 1..5 server-side: si no, ok:false reason
 *     score_out_of_range SIN llamar al RPC (T-5-18). El RPC + el CHECK de la tabla
 *     son la última línea; esto es defensa en profundidad.
 *  3. supabase.rpc('staff_app_rate_staff', ...) con el cliente autenticado.
 */

import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";

export interface RateStaffInput {
  staffProfileId: string;
  gigId: string;
  score: number;
  note: string | null;
}

/** Forma del jsonb que devuelve public.staff_app_rate_staff. */
interface RpcRating {
  ok: boolean;
  reason?: string;
}

/**
 * Persiste la calificación 1..5 + nota opcional del candidato en un gig vía RPC.
 * @throws Error("forbidden") si el caller no es miembro.
 */
export async function rateStaff(
  input: RateStaffInput,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();

  // 1. Gate de membresía (T-5-17) — molde de notes-actions.ts.
  // exigirOrg(): mismo gate, pero aguanta que el usuario sea miembro de más de
  // una productora (el .maybeSingle() de antes tiraba PGRST116 con dos filas).
  await exigirOrg();

  // 2. Validación de score server-side (T-5-18): entero 1..5, sin tocar el RPC.
  if (
    !Number.isInteger(input.score) ||
    input.score < 1 ||
    input.score > 5
  ) {
    return { ok: false, reason: "score_out_of_range" };
  }
  if (!input.gigId) {
    return { ok: false, reason: "missing_gig" };
  }

  // 3. Persistir vía RPC con el cliente autenticado. Nota vacía → null.
  const note = (input.note ?? "").trim() || null;
  const { data, error } = await supabase.rpc("staff_app_rate_staff", {
    p_staff_profile_id: input.staffProfileId,
    p_gig_id: input.gigId,
    p_score: input.score,
    p_note: note,
  });

  const res = data as RpcRating | null;
  if (error || !res?.ok) {
    return {
      ok: false,
      reason: res?.reason ?? error?.message ?? "No se pudo guardar la calificación",
    };
  }
  return { ok: true };
}
