"use server";

/**
 * Server action de AVISAR QUE EL PAGO ESTÁ LISTO (botón de /pagos).
 *
 * ⚠️ REQUIERE LA MIGRACIÓN staff_app_0032_pago_listo APLICADA. Hasta que se
 * aplique, la RPC no existe y esta acción devuelve {ok:false} con un mensaje
 * honesto: el botón avisa que falta la migración, no rompe nada.
 *
 * El flujo, calcado del patrón de offer-actions:
 *  1. Gate de membresía con el CLIENTE AUTENTICADO (staff_app_my_membership):
 *     si el caller no es miembro de la org, throw "forbidden" antes de tocar
 *     nada. La RPC es service_role-only (devuelve email = PII del modelo
 *     broker), así que el gate es lo que separa el botón del mundo.
 *  2. RPC staff_app_marcar_pago_listo con service-role: estampa
 *     offers.pago_listo_at SOLO si la oferta está accepted y sin avisar
 *     (exactly-once: doble click, un solo mail) y devuelve los datos del mail.
 *  3. Render de PagoListoEmail + sendMail (mailer honesto, nunca tira).
 *
 * ORDEN ASUMIDO (el mismo trade-off que la tanda de bienvenida): se estampa
 * ANTES de saber si el mail salió. Preferimos que un fallo de SMTP deje un
 * pago marcado sin mail (se ve en la UI y se resuelve por WhatsApp) antes que
 * un retry mande dos avisos de plata a la misma persona.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail, type MailResult } from "@/lib/email/mailer";
import { PagoListoEmail } from "@/components/emails/pago-listo-email";
import { PAGO_TEXTO } from "@/lib/pago";
import { money } from "@/lib/format";

export type PagoListoResult =
  | { ok: false; reason: string }
  | { ok: true; already: true }
  | { ok: true; already: false; mail: MailResult };

/** Forma del jsonb que devuelve public.staff_app_marcar_pago_listo (0032). */
interface RpcPagoListo {
  ok: boolean;
  reason?: string;
  already?: boolean;
  email?: string | null;
  first_name?: string | null;
  staff_nombre?: string | null;
  staff_apellido?: string | null;
  gig_title?: string | null;
  role?: string | null;
  amount?: number | null;
}

export async function avisarPagoListo(offerId: string): Promise<PagoListoResult> {
  // 1. Gate de membresía (molde de offer-actions/cv-actions).
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();
  if (!membership) throw new Error("forbidden");

  // 2. Estampar exactly-once + traer los datos del mail (service-role).
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("staff_app_marcar_pago_listo", {
    p_offer_id: offerId,
  });

  if (error) {
    // El caso más probable hoy: la 0032 no está aplicada y la RPC no existe.
    console.error("[pagos] marcar_pago_listo falló:", error.message);
    const faltaMigracion = /function .*staff_app_marcar_pago_listo/i.test(error.message);
    return {
      ok: false,
      reason: faltaMigracion
        ? "Falta aplicar la migración 0032 en Supabase. Hasta eso, el aviso de pago no se puede mandar."
        : "No se pudo marcar el pago. Probá de nuevo.",
    };
  }

  const res = (data ?? null) as RpcPagoListo | null;
  if (!res?.ok) {
    return {
      ok: false,
      reason:
        res?.reason === "not_accepted"
          ? "Esa oferta no está aceptada: no hay pago para avisar."
          : "No se encontró la oferta.",
    };
  }
  if (res.already) {
    // Ya se había avisado: NO se reenvía (exactly-once). La UI lo dice tal cual.
    return { ok: true, already: true };
  }

  // 3. El mail. Si la persona no tiene email, el resultado es honesto: el pago
  //    quedó marcado igual (el estado es real) y el aviso va por WhatsApp a mano.
  const to = res.email?.trim();
  if (!to) {
    return {
      ok: true,
      already: false,
      mail: { ok: false, channel: "none", error: "La persona no tiene email cargado." },
    };
  }

  const html = await render(
    createElement(PagoListoEmail, {
      firstName: res.first_name ?? "",
      gigTitle: res.gig_title,
      role: res.role,
      amountText:
        res.amount != null && Number(res.amount) > 0 ? money(Number(res.amount)) : null,
      paymentText: PAGO_TEXTO,
    }),
  );
  const gig = res.gig_title?.trim();
  const mail = await sendMail({
    to,
    subject: `Tu pago está listo${gig ? ` · ${gig}` : ""}`,
    html,
  });
  if (!mail.ok) console.error("[pagos] el aviso de pago no salió:", mail.error);
  return { ok: true, already: false, mail };
}
