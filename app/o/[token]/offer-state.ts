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
 *
 * Fix UX 28/7: el texto ya NO dice "escribinos por WhatsApp" (antes lo repetía
 * en las 4 vistas sin ningún link real). El canal ahora es un botón wa.me
 * (WhatsAppCta) con mensaje precargado por caso: una acción, un canal. La vista
 * "aceptada" además ofrece el portal de staff (portal: true).
 */
export const TERMINAL_COPY: Record<
  TerminalView,
  {
    title: string;
    body: string;
    wa: { label: string; mensaje: string };
    portal?: boolean;
  }
> = {
  aceptada: {
    title: "Ya confirmaste esta propuesta",
    body: "Quedás confirmado/a para este laburo. Nos vemos ahí.",
    wa: {
      label: "Coordinar por WhatsApp",
      mensaje:
        "Hola, confirmé una propuesta de LABURO y quiero coordinar los detalles.",
    },
    portal: true,
  },
  rechazada: {
    title: "Ya rechazaste esta propuesta",
    body: "Gracias por avisar. Si fue un error o cambiaste de idea, todavía estás a tiempo.",
    wa: {
      label: "Avisar por WhatsApp",
      mensaje:
        "Hola, rechacé una propuesta de LABURO pero me interesa revisarla.",
    },
  },
  vencida: {
    title: "Este link venció",
    body: "Esta propuesta ya no está activa. Si el laburo te interesa, vemos de reprogramar.",
    wa: {
      label: "Escribinos por WhatsApp",
      mensaje:
        "Hola, me llegó una propuesta de LABURO pero el link venció. Sigo interesado/a.",
    },
  },
  invalida: {
    title: "Este link no es válido",
    body: "Puede que lo hayan copiado mal. Probá abrirlo de nuevo desde el mail que te llegó.",
    wa: {
      label: "Escribinos por WhatsApp",
      mensaje: "Hola, tengo un problema con el link de una propuesta de LABURO.",
    },
  },
};
