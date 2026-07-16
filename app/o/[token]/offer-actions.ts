"use server";

/**
 * Server Actions de Aceptar / Rechazar la oferta (ACPT-02/03), POST-only.
 *
 * D-02 (anti-bot): la mutación vive SÓLO acá, en un Server Action ("use server"),
 * que Next 15 invoca por POST con validación de origen. Los bots de preview de
 * email/WhatsApp hacen GET, así que no pueden disparar la aceptación. El GET del
 * page.tsx sólo lee (flip viewed, benigno).
 *
 * D-01: toda la lógica atómica/idempotente/expiry ya vive en las RPCs de Fase 1
 * (accept_offer inserta crew ON CONFLICT DO NOTHING en la misma transacción =
 * doble-tap seguro, ACPT-03). Acá NUNCA se inserta crew a mano ni se toca el
 * schema staff_app directo: sólo se llaman los wrappers public (anon-callable)
 * con el cliente server (anon). NUNCA el cliente service-role.
 *
 * Pitfall 1 (mensajería): accept/decline colapsan token-malo/vencido/ya-aceptado/
 * ya-rechazado en un único {ok:false, reason:'invalid_or_expired'}. En vez de
 * mostrar un error crudo, ante el fallo se RE-LEE get_public_offer y se deriva el
 * estado real (deriveView) para mensajear cálido (D-03). Esto también cubre la
 * carrera donde la oferta cambió de estado entre el render y el submit.
 *
 * D-04 (costura HITO, NO construir): al aceptar se crea crew SÓLO en la app. El
 * puente a HITO (empujar crew_member/crew_assignment) está diferido a Fase 6 y
 * los gigs de v1 tienen hito_event_id NULL, así que no hay ninguna llamada a HITO
 * acá. Esta es la costura marcada; se implementa en Fase 6.
 */

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { deriveView, type TerminalView } from "./offer-state";

export type OfferActionResult =
  | { ok: true }
  | { ok: false; view: TerminalView };

/** Forma mínima del jsonb de accept/decline: sólo miramos `ok`. */
interface RpcAck {
  ok?: boolean;
  reason?: string;
}

/**
 * Re-lee get_public_offer tras un fallo y deriva el estado terminal real. Si la
 * re-lectura devuelve "activa" (contradicción rara: falló pero sigue viva), se
 * degrada a "invalida" para no volver a ofrecer el form desde la pantalla de error.
 */
async function freshTerminalView(
  supabase: SupabaseClient,
  token: string,
): Promise<TerminalView> {
  const { data } = await supabase.rpc("staff_app_get_public_offer", {
    p_token: token,
  });
  const v = deriveView(data);
  return v === "activa" ? "invalida" : v;
}

/**
 * Aceptar la oferta (POST). Pasa DOS args al wrapper (p_token + p_user_agent,
 * Pitfall 3); el UA sale del header o va vacío. Éxito → crew creado en la app
 * (atómico, idempotente). Fallo → re-lectura para el estado real.
 */
export async function acceptOffer(token: string): Promise<OfferActionResult> {
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? "";

  const { data } = await supabase.rpc("staff_app_accept_offer", {
    p_token: token,
    p_user_agent: ua,
  });

  if ((data as RpcAck | null)?.ok) return { ok: true };
  return { ok: false, view: await freshTerminalView(supabase, token) };
}

/** Rechazar la oferta (POST). Un solo arg (p_token). Mismo manejo de fallo. */
export async function declineOffer(token: string): Promise<OfferActionResult> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("staff_app_decline_offer", {
    p_token: token,
  });

  if ((data as RpcAck | null)?.ok) return { ok: true };
  return { ok: false, view: await freshTerminalView(supabase, token) };
}
