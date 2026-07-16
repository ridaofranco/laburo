/**
 * Derivación de estado de la oferta pública (04-02, Pattern 3 del research).
 *
 * Módulo SIN directiva ('use server'/'use client'): lo importan los tres
 * archivos de la ruta pública — el RSC (page.tsx), el Server Action
 * (offer-actions.ts) y el client component (accept-decline.tsx) — para no
 * duplicar la lógica de derivación ni el copy de los estados terminales.
 *
 * CRÍTICO (Pitfall 2): "vencida" SIEMPRE se deriva de now() > expires_at.
 * `get_public_offer` NO chequea expiry y el enum status nunca se auto-flipea a
 * 'expired' (no hay cron), así que el status puede seguir en 'sent'/'viewed'
 * aunque la oferta ya haya vencido. El vencimiento es puramente derivado.
 */

/** Forma del jsonb que devuelve public.staff_app_get_public_offer (token match). */
export interface PublicOffer {
  ok: boolean;
  offer: {
    role: string | null;
    amount: number | null;
    conditions: string | null;
    status: string;
    expires_at: string;
  };
  gig: {
    title: string | null;
    starts_at: string | null;
    ends_at: string | null;
    venue: string | null;
  };
  org: { name: string | null };
  applicant: { first_name: string | null };
}

/** Las 5 vistas de cara al candidato. Sólo "activa" monta el form. */
export type OfferView = "activa" | "aceptada" | "rechazada" | "vencida" | "invalida";

/** Estados terminales (todo menos "activa"): no muestran botones. */
export type TerminalView = Exclude<OfferView, "activa">;

/**
 * Deriva la vista a partir del payload de get_public_offer.
 * - data null (token malo / inexistente) → "invalida" (la RPC devuelve SQL NULL).
 * - status 'accepted' → "aceptada" · 'declined' → "rechazada".
 * - now() > expires_at → "vencida" (prioriza sobre 'sent'/'viewed', Pitfall 2).
 * - resto → "activa".
 */
export function deriveView(data: unknown): OfferView {
  if (!data || typeof data !== "object") return "invalida";
  const offer = (data as Partial<PublicOffer>).offer;
  if (!offer || typeof offer.status !== "string") return "invalida";
  if (offer.status === "accepted") return "aceptada";
  if (offer.status === "declined") return "rechazada";
  const expired = new Date(offer.expires_at).getTime() <= Date.now();
  if (expired) return "vencida";
  return "activa";
}

/**
 * Copy cálido en voseo, sin em dash, para cada estado terminal (D-03). Se
 * comparte entre el render server-side y el client component así el candidato
 * ve el mismo mensaje venga de un GET a una oferta ya resuelta o del fallo de
 * un POST re-leído.
 */
export const TERMINAL_COPY: Record<TerminalView, { title: string; body: string }> = {
  aceptada: {
    title: "Ya confirmaste esta propuesta",
    body: "Nos vemos ahí. Si tenés alguna duda, escribinos por WhatsApp.",
  },
  rechazada: {
    title: "Ya rechazaste esta propuesta",
    body: "Si fue un error o cambiaste de idea, escribinos por WhatsApp y lo vemos.",
  },
  vencida: {
    title: "Este link venció",
    body: "Si seguís interesado/a, escribinos por WhatsApp y vemos de reprogramar.",
  },
  invalida: {
    title: "Este link no es válido",
    body: "Puede que lo hayan copiado mal. Si tenías una propuesta, escribinos por WhatsApp.",
  },
};
