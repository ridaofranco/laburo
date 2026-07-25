"use server";

/**
 * Server action de CREAR + ENVIAR oferta (OFER-02/03), member-gated.
 *
 * Orquesta el slice vertical de Fase 3:
 *  1. Gate de membresía (T-3-09) copiado de cv-actions.ts: si el caller no es
 *     miembro, throw "forbidden" ANTES de tocar la RPC o el email. Defensa en
 *     profundidad sobre el (app) layout y sobre el is_org_writer de la RPC.
 *  2. supabase.rpc('staff_app_create_offer', ...) con el CLIENTE AUTENTICADO
 *     (JWT del caller) — NUNCA service-role (T-3-10): la RPC SECURITY DEFINER
 *     gatea is_org_writer y valida org de gig/candidato ella misma. Devuelve
 *     el raw token UNA sola vez.
 *  3. Arma el link mágico ${SITE_URL}/o/${token} y el mensaje wa.me (voseo, sin
 *     em dash). El raw token vive SÓLO en memoria para el link; nunca se loguea
 *     ni se re-persiste (T-3-11).
 *  4. Renderiza el OfferEmail (react-email v2 → render() es ASYNC, Pitfall 4) y
 *     lo manda con sendMail (mailer honesto: nunca tira, devuelve MailResult).
 *  5. Devuelve estado honesto (D-02): si el mail falla, ok:true con mail.ok:false
 *     para que la UI ofrezca el wa.me de fallback con el link que funciona —
 *     nunca un success silencioso (T-3-07 / Pitfall 6).
 *
 * NO importa el cliente service-role (createServiceRoleClient) — grep-negativo.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { sendMail, type MailResult } from "@/lib/email/mailer";
import { OfferEmail } from "@/components/emails/offer-email";
import { waLink } from "@/lib/wa";
import { fmtFechaHora } from "@/lib/dates";
import { siteUrl } from "@/lib/site";

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
}

/** Fecha legible para el email (hora AR, no la del server UTC). null si inválida. */
function formatWhen(iso?: string | null): string | null {
  return fmtFechaHora(iso);
}

export async function createAndSendOffer(
  input: CreateOfferInput,
): Promise<CreateOfferResult> {
  const supabase = await createClient();

  // 1. Gate de membresía (T-3-09) — molde de cv-actions.ts.
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();
  if (!membership) throw new Error("forbidden");

  // 2. Crear oferta (+ gig quick si hace falta), atómico → raw token una vez.
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
    return {
      ok: false,
      reason: res?.reason ?? error?.message ?? "No se pudo crear la oferta",
    };
  }

  // 3. Link mágico + mensaje wa.me. El raw token SÓLO se usa acá para el link.
  const link = siteUrl(`/o/${res.token}`);
  const firstName = input.firstName.trim();
  const saludo = firstName ? `Hola ${firstName}, ` : "Hola, ";
  const enGig = input.gigTitle?.trim() ? ` en ${input.gigTitle.trim()}` : "";
  const waMsg = `${saludo}te paso la propuesta para ${input.role.trim()}${enGig}. Mirá los detalles y confirmá acá: ${link}`;
  const wa = input.telefono?.trim() ? waLink(input.telefono, waMsg) : "";

  // 4. Render del email (ASYNC) + envío honesto. Sin email → mail honesto 'none'.
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

  // 5. Estado honesto (D-02): la oferta YA existe aunque el mail falle.
  return { ok: true, offerId: res.offer_id, link, waLink: wa, mail };
}
