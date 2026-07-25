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

  if ((data as RpcAck | null)?.ok) {
    await avisarRespuesta(token, true);
    return { ok: true };
  }
  return { ok: false, view: await freshTerminalView(supabase, token) };
}

/** Rechazar la oferta (POST). Un solo arg (p_token). Mismo manejo de fallo. */
export async function declineOffer(token: string): Promise<OfferActionResult> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("staff_app_decline_offer", {
    p_token: token,
  });

  if ((data as RpcAck | null)?.ok) {
    await avisarRespuesta(token, false);
    return { ok: true };
  }
  return { ok: false, view: await freshTerminalView(supabase, token) };
}

/**
 * Los DOS mails que salen cuando alguien responde una propuesta:
 *   1. Si aceptó, la confirmación a la persona ("quedaste en el equipo") con los
 *      cinco datos que necesita y hoy no tenía juntos en ningún lado: evento, rol,
 *      cuándo, dónde y cuánto se paga. Antes de esto aceptaba y no recibía NADA.
 *   2. El aviso a Franco, acepte o rechace, con la línea que de verdad sirve:
 *      cuántos roles del evento quedan por cubrir.
 *
 * NUNCA TIRA, y eso es lo importante: si el mail falla, la aceptación ya está
 * hecha en la base y no se puede deshacer. Un error de SMTP no puede convertirse en
 * "no pude aceptar" para alguien que sí aceptó.
 *
 * SE AWAITEA a propósito, no es fire-and-forget: en Vercel la función se congela
 * cuando el handler devuelve, y ese es justo el bug por el que ENTRÁ nunca mandó
 * los mails de sus entradas. El mailer tiene sus propios timeouts cortos.
 */
async function avisarRespuesta(token: string, accepted: boolean): Promise<void> {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/admin");
    const { sendMail, emailEnabled, adminEmail } = await import("@/lib/email/mailer");
    if (!emailEnabled()) return;

    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("staff_app_offer_notice", { p_token: token });
    if (error) {
      console.error("[offer-actions] no pude leer los datos para el aviso:", error.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          gig_id: string;
          staff_email: string | null;
          first_name: string | null;
          role: string | null;
          amount: number | null;
          conditions: string | null;
          gig_title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          venue_name: string | null;
          staff_nombre: string | null;
          staff_apellido: string | null;
          slots_total: number | null;
          crew_total: number | null;
        }
      | null
      | undefined;
    if (!row) return;

    const { fmtFechaHora } = await import("@/lib/dates");
    const { createElement } = await import("react");
    const { render } = await import("@react-email/components");
    const { siteUrl } = await import("@/lib/site");

    const inicio = fmtFechaHora(row.starts_at, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const fin = fmtFechaHora(row.ends_at, { hour: "2-digit", minute: "2-digit" });
    const whenText = inicio && fin ? `${inicio} a ${fin}` : inicio;
    const amountText =
      row.amount != null && !Number.isNaN(Number(row.amount))
        ? `$${Number(row.amount).toLocaleString("es-AR")}`
        : null;
    const gigTitle = row.gig_title ?? "";
    const role = row.role ?? "";
    const nombreCompleto = [row.staff_nombre, row.staff_apellido].filter(Boolean).join(" ");

    // 1. Confirmación a la persona (solo si aceptó y tenemos su mail).
    if (accepted && row.staff_email) {
      const { HiredEmail } = await import("@/components/emails/hired-email");
      const html = await render(
        createElement(HiredEmail, {
          firstName: row.first_name ?? "",
          gigTitle,
          role,
          whenText,
          venue: row.venue_name,
          amountText,
          conditions: row.conditions,
          link: siteUrl("/panel-staff"),
        }),
      );
      const res = await sendMail({
        to: row.staff_email,
        subject: `Confirmado: ${role}${gigTitle ? ` en ${gigTitle}` : ""}`,
        html,
      });
      if (!res.ok) console.error("[offer-actions] no salió la confirmación al staff:", res.error);
    }

    // 2. Aviso interno, acepte o rechace.
    const to = adminEmail();
    if (to) {
      const { OfferAnswerEmail } = await import("@/components/emails/offer-answer-email");
      const html = await render(
        createElement(OfferAnswerEmail, {
          accepted,
          staffName: nombreCompleto,
          gigTitle,
          role,
          amountText,
          slotsTotal: row.slots_total,
          crewTotal: row.crew_total,
          // /tablero es el board con los eventos y su equipo. NO existe una ruta
          // /tablero/[gigId] (solo /editar), así que linkear ahí daría 404.
          link: siteUrl("/tablero"),
        }),
      );
      const res = await sendMail({
        to,
        subject: `${nombreCompleto || "Alguien"} ${accepted ? "aceptó" : "rechazó"}: ${role}${gigTitle ? ` en ${gigTitle}` : ""}`,
        html,
      });
      if (!res.ok) console.error("[offer-actions] no salió el aviso interno:", res.error);
    }
  } catch (e) {
    // Defensa en profundidad: la respuesta a la oferta ya está registrada, los
    // mails son secundarios. Que nunca tire.
    console.error("[offer-actions] aviso de respuesta falló:", e instanceof Error ? e.message : String(e));
  }
}
