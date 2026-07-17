"use server";

/**
 * Server action de FAVORITO + NOTA PRIVADA del candidato (XTRA-01, D-03),
 * member-gated.
 *
 * Producer-only: esto NUNCA toca ninguna superficie candidate-facing (Pitfall 2).
 * La escritura pasa por el RPC public.staff_app_set_candidate_note (SECURITY
 * DEFINER, is_org_writer) con el CLIENTE AUTENTICADO (JWT del caller) — NUNCA
 * service-role (grep-negativo del cliente admin).
 *
 * Orden estricto, molde de offer-actions.ts / cv-actions.ts:
 *  1. Gate de membresía (staff_app_my_membership.maybeSingle): si el caller no es
 *     miembro, throw "forbidden" ANTES de tocar el RPC. Defensa en profundidad
 *     sobre el (app) layout y sobre el is_org_writer del propio RPC.
 *  2. supabase.rpc('staff_app_set_candidate_note', ...) con el cliente autenticado.
 *  3. Devolver estado honesto según el jsonb {ok} / {ok:false, reason}.
 */

import { createClient } from "@/lib/supabase/server";

export interface SetCandidateNoteInput {
  staffProfileId: string;
  isFavorite: boolean;
  note: string | null;
}

/** Forma del jsonb que devuelve public.staff_app_set_candidate_note. */
interface RpcNote {
  ok: boolean;
  reason?: string;
}

/**
 * Marca/desmarca favorito y persiste la nota privada del candidato vía RPC.
 * @throws Error("forbidden") si el caller no es miembro.
 */
export async function setCandidateNote(
  input: SetCandidateNoteInput,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();

  // 1. Gate de membresía (T-5-17) — molde de offer-actions.ts.
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();
  if (!membership) throw new Error("forbidden");

  // 2. Persistir vía RPC con el cliente autenticado. Nota vacía → null.
  const note = (input.note ?? "").trim() || null;
  const { data, error } = await supabase.rpc("staff_app_set_candidate_note", {
    p_staff_profile_id: input.staffProfileId,
    p_is_favorite: input.isFavorite,
    p_note: note,
  });

  const res = data as RpcNote | null;
  if (error || !res?.ok) {
    return {
      ok: false,
      reason: res?.reason ?? error?.message ?? "No se pudo guardar la nota",
    };
  }
  return { ok: true };
}
