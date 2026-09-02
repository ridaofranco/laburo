"use server";

/**
 * Server action de CREAR + ENVIAR oferta (OFER-02/03), member-gated.
 *
 * Orquesta el slice vertical de Fase 3:
 *  1. Gate de membresía (T-3-09) copiado de cv-actions.ts: si el caller no es
 *     miembro, throw "forbidden" ANTES de tocar la RPC o el email. Defensa en
 *     profundidad sobre el (app) layout y sobre el is_org_writer de la RPC.
 *  2. Validación server-side (molde de rating-actions.ts): rol, monto y fecha del
 *     evento, ANTES de llamar a la RPC. El formulario ya frena, pero una server
 *     action es un endpoint POST invocable: sin esto se podían crear ofertas sin
 *     plata y sin día. La migración 0068 pone la misma guarda en la base; esto es
 *     defensa en profundidad, no un reemplazo.
 *  3. supabase.rpc('staff_app_create_offer', ...) con el CLIENTE AUTENTICADO
 *     (JWT del caller) — NUNCA service-role (T-3-10): la RPC SECURITY DEFINER
 *     gatea is_org_writer y valida org de gig/candidato ella misma. Devuelve
 *     el raw token UNA sola vez. Si dice que no, el motivo se traduce a
 *     castellano (MOTIVOS): antes la productora leía "role_required" en pantalla.
 *  4. Arma el link mágico ${SITE_URL}/o/${token} y el mensaje wa.me (voseo, sin
 *     em dash). El raw token vive SÓLO en memoria para el link; nunca se loguea
 *     ni se re-persiste (T-3-11).
 *  5. Renderiza el OfferEmail (react-email v2 → render() es ASYNC, Pitfall 4) y
 *     lo manda con sendMail (mailer honesto: nunca tira, devuelve MailResult).
 *  6. Devuelve estado honesto (D-02): si el mail falla, ok:true con mail.ok:false
 *     para que la UI ofrezca el wa.me de fallback con el link que funciona —
 *     nunca un success silencioso (T-3-07 / Pitfall 6).
 *
 * NO importa el cliente service-role (createServiceRoleClient) — grep-negativo.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";
import { sendMail, type MailResult } from "@/lib/email/mailer";
import { OfferEmail } from "@/components/emails/offer-email";
import { waLink } from "@/lib/wa";
import { fmtFechaHora } from "@/lib/dates";
import { siteUrl } from "@/lib/site";
import { PAGO_TEXTO } from "@/lib/pago";

export interface CreateOfferInput {
  staffProfileId: string;
  role: string;
  firstName: string;
  email: string | null;
  telefono: string | null;
  /** gig existente elegido (pick). Si es null/undefined → quick-create. */
  gigId?: string | null;
  /** título del gig: el del gig elegido (copy) o el del quick-create. */
  gigTitle?: string | null;
  /** starts_at del gig: ISO / datetime-local. Copy + quick-create. */
  gigStartsAt?: string | null;
  gigVenue?: string | null;
  amount?: number | null;
  conditions?: string | null;
}

export type CreateOfferResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      offerId: string;
      link: string;
      waLink: string;
      mail: MailResult;
    };

/** Forma del jsonb que devuelve public.staff_app_create_offer. */
interface RpcOffer {
  ok: boolean;
  reason?: string;
  offer_id?: string;
  gig_id?: string;
  token?: string;
  /** Lo agrega la migración 0030, para poder decir hasta cuándo hay tiempo. */
  expires_at?: string;
}

// PAGO_TEXTO (cuándo se cobra) ahora vive en lib/pago.ts: lo comparte con el
// mail "Tu pago está listo". Sigue habiendo UN solo lugar donde cambiarlo.

/**
 * Los motivos que devuelve la RPC, en castellano. Molde de
 * app/registrar-proveedor/actions.ts. Hasta hoy el `reason` crudo se pintaba tal
 * cual en el formulario, así que la productora leía "candidate_not_found".
 * Si aparece uno sin traducir, cae al texto genérico de más abajo.
 */
const MOTIVOS: Record<string, string> = {
  no_org: "Tu cuenta todavía no está asociada a ninguna productora.",
  forbidden: "No tenés permiso para mandar ofertas en esta productora.",
  role_required: "Poné para qué rol es la propuesta.",
  amount_required: "Poné el monto que le vas a pagar. Sin plata no es una propuesta.",
  gig_required: "Elegí un evento o escribí el nombre de uno nuevo.",
  gig_starts_at_required: "Poné cuándo arranca el evento.",
  gig_not_found: "Ese evento no existe o no es de tu productora.",
  candidate_not_found: "Ese candidato no existe o no es de tu productora.",
};

/** Fecha legible para el email (hora AR, no la del server UTC). null si inválida. */
function formatWhen(iso?: string | null): string | null {
  return fmtFechaHora(iso);
}

export async function createAndSendOffer(
  input: CreateOfferInput,
): Promise<CreateOfferResult> {
  const supabase = await createClient();

  // 1. Gate de membresía (T-3-09) — molde de cv-actions.ts.
  // exigirOrg(): mismo gate, pero aguanta que el usuario sea miembro de más de
  // una productora (el .maybeSingle() de antes tiraba PGRST116 con dos filas).
  await exigirOrg();

  // 2. Validación server-side, molde de rating-actions.ts. El formulario ya
  //    frena, pero esto es un endpoint POST invocable: sin estos tres chequeos se
  //    puede crear una propuesta sin monto y sobre un evento sin fecha, que es
  //    justo lo que le llega al candidato. La 0068 pone la misma guarda en la base.
  if (!input.role?.trim()) {
    return { ok: false, reason: MOTIVOS.role_required };
  }
  if (
    input.amount === null ||
    input.amount === undefined ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return { ok: false, reason: MOTIVOS.amount_required };
  }
  if (!input.gigStartsAt?.trim()) {
    return { ok: false, reason: MOTIVOS.gig_starts_at_required };
  }

  // 3. Crear oferta (+ gig quick si hace falta), atómico → raw token una vez.
  const { data, error } = await supabase.rpc("staff_app_create_offer", {
    p_staff_profile_id: input.staffProfileId,
    p_role: input.role,
    p_gig_id: input.gigId ?? null,
    p_gig_title: input.gigTitle ?? null,
    p_gig_starts_at: input.gigStartsAt ?? null,
    p_gig_venue: input.gigVenue ?? null,
    p_amount: input.amount ?? null,
    p_conditions: input.conditions ?? null,
  });

  const res = data as RpcOffer | null;
  if (error || !res?.ok || !res.token || !res.offer_id) {
    const motivo = res?.reason ? MOTIVOS[res.reason] : undefined;
    return {
      ok: false,
      reason: motivo ?? res?.reason ?? error?.message ?? "No se pudo crear la oferta",
    };
  }

  // 4. Link mágico + mensaje wa.me. El raw token SÓLO se usa acá para el link.
  const link = siteUrl(`/o/${res.token}`);
  const firstName = input.firstName.trim();
  const saludo = firstName ? `Hola ${firstName}, ` : "Hola, ";
  const enGig = input.gigTitle?.trim() ? ` en ${input.gigTitle.trim()}` : "";
  const waMsg = `${saludo}te paso la propuesta para ${input.role.trim()}${enGig}. Mirá los detalles y confirmá acá: ${link}`;
  const wa = input.telefono?.trim() ? waLink(input.telefono, waMsg) : "";

  // 5. Render del email (ASYNC) + envío honesto. Sin email → mail honesto 'none'.
  let mail: MailResult;
  const to = input.email?.trim();
  if (to) {
    const html = await render(
      createElement(OfferEmail, {
        firstName: input.firstName,
        gigTitle: input.gigTitle ?? "",
        role: input.role,
        amount: input.amount ?? null,
        conditions: input.conditions ?? null,
        whenText: formatWhen(input.gigStartsAt),
        link,
        // Los tres datos que faltaban (26/7). El lugar ya lo teníamos acá, solo
        // que no se lo mandábamos: quedaba del otro lado del link.
        venue: input.gigVenue?.trim() || null,
        expiresText: formatWhen(res.expires_at),
        paymentText: PAGO_TEXTO,
      }),
    );
    mail = await sendMail({
      to,
      subject: `Tenés una propuesta de laburo${
        input.gigTitle?.trim() ? ` · ${input.gigTitle.trim()}` : ""
      }`,
      html,
    });
  } else {
    mail = {
      ok: false,
      channel: "none",
      error: "El candidato no tiene email cargado.",
    };
  }

  // 6. Estado honesto (D-02): la oferta YA existe aunque el mail falle.
  return { ok: true, offerId: res.offer_id, link, waLink: wa, mail };
}
