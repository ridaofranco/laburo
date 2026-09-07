"use server";

/**
 * El equipo de la productora: invitar, revocar, cambiar el rol y sacar.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Ajustes decía "Invitar miembros: próximamente" desde que la pantalla se porteó
 * de Stitch. El efecto práctico es que una productora se quedaba sola adentro:
 * el único que entraba era el que creó la cuenta. Franco, 7/9/2026: *"que
 * invitar miembros esté activo"*.
 *
 * ── EL ORDEN ES GUARDAR → MANDAR → MARCAR ───────────────────────────────────
 * La invitación se crea en la base, después sale el mail, y recién ahí se
 * estampa `enviado_at`. Si el mail falla, la invitación existe igual (el link es
 * válido y se puede reenviar) y la pantalla lo dice. Al revés diríamos "enviado"
 * de algo que nunca salió. Es el mismo criterio del módulo de cotizaciones.
 *
 * ⚠️ EL TOKEN EN CRUDO VIVE SOLO EN MEMORIA, para armar el link del mail. De la
 * base sale una vez y ahí queda solo su sha256: no se loguea, no se devuelve a
 * la pantalla y no se guarda en ningún lado.
 */

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";
import { sendMail } from "@/lib/email/mailer";
import { siteUrl } from "@/lib/site";
import { InvitacionEquipo } from "@/components/emails/invitacion-equipo-email";

export interface Miembro {
  id: string;
  user_id: string;
  email: string | null;
  rol: string;
  desde: string;
}
export interface Invitacion {
  id: string;
  email: string;
  rol: string;
  vence: string | null;
  enviado: boolean;
  creada: string;
}
export interface Equipo {
  puede_invitar: boolean;
  yo: string | null;
  miembros: Miembro[];
  invitaciones: Invitacion[];
}

export async function leerEquipo(): Promise<Equipo> {
  const vacio: Equipo = { puede_invitar: false, yo: null, miembros: [], invitaciones: [] };
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_equipo", { p_org: org.organizationId });
  if (error) {
    console.error("[equipo] no se pudo leer:", error.message);
    return vacio;
  }
  return { ...vacio, ...((data as Partial<Equipo> | null) ?? {}) };
}

const MENSAJES: Record<string, string> = {
  no_org: "No encontramos tu organización.",
  forbidden: "Solo el dueño o un gerente pueden invitar.",
  email_invalido: "Ese email no parece válido. Revisalo.",
  rol_invalido: "Ese rol no existe.",
  ya_es_miembro: "Esa persona ya está en tu equipo.",
  no_existe: "No encontramos esa invitación.",
  es_owner: "Al dueño de la cuenta no se lo puede sacar ni cambiar de rol.",
  sos_vos: "No podés sacarte a vos mismo del equipo.",
};
const traducir = (r?: string) => MENSAJES[r ?? ""] ?? "No pudimos hacerlo. Probá de nuevo.";

/** Fecha larga en castellano, para el mail. */
const fechaLarga = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(iso))
    : null;

export async function invitarMiembro(
  formData: FormData,
): Promise<{ ok: true; aviso?: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const email = String(formData.get("email") ?? "").trim();
  const rol = String(formData.get("rol") ?? "writer").trim();

  // ── 1) GUARDAR ──
  const { data, error } = await supabase.rpc("staff_app_invitar_miembro", {
    p_email: email,
    p_role: rol,
    p_org: org.organizationId,
  });
  if (error) {
    console.error("[equipo] invitar falló:", error.message);
    return { ok: false, error: "No pudimos crear la invitación. Probá de nuevo." };
  }
  const r = data as
    | { ok?: boolean; reason?: string; id?: string; email?: string; rol?: string; token?: string }
    | null;
  if (!r?.ok || !r.token) return { ok: false, error: traducir(r?.reason) };

  // ── 2) MANDAR ──
  const link = siteUrl(`/equipo/${r.token}`);
  let salio = false;
  try {
    const html = await render(
      createElement(InvitacionEquipo, {
        productora: org.nombre ?? "Una productora",
        email: r.email ?? email,
        rol: r.rol ?? rol,
        vence: fechaLarga(new Date(Date.now() + 14 * 864e5).toISOString()),
        link,
      }),
    );
    const envio = await sendMail({
      to: r.email ?? email,
      subject: `${org.nombre ?? "Una productora"} te sumó a su equipo en LABURO`,
      html,
    });
    salio = envio.ok;
    if (!envio.ok) console.error("[equipo] no salió el mail:", envio.error);
  } catch (e) {
    console.error("[equipo] no se pudo armar el mail:", (e as Error).message);
  }

  // ── 3) MARCAR ──
  if (salio && r.id) {
    await supabase.rpc("staff_app_invitacion_enviada", {
      p_invite_id: r.id,
      p_org: org.organizationId,
    });
  }

  revalidatePath("/config");
  return salio
    ? { ok: true }
    : {
        ok: true,
        // ⚠️ La invitación EXISTE aunque el mail no haya salido, y decirlo es lo
        // que evita que se invite tres veces a la misma persona creyendo que no
        // se creó nada.
        aviso:
          "La invitación quedó creada, pero el mail no salió. Podés reenviarla desde la lista.",
      };
}

export async function revocarInvitacion(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_revocar_invitacion_miembro", {
    p_invite_id: id,
    p_org: org.organizationId,
  });
  if (error) return { ok: false, error: "No pudimos cancelar la invitación." };
  const r = data as { ok?: boolean; reason?: string } | null;
  revalidatePath("/config");
  return r?.ok ? { ok: true } : { ok: false, error: traducir(r?.reason) };
}

export async function quitarMiembro(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_quitar_miembro", {
    p_member_id: id,
    p_org: org.organizationId,
  });
  if (error) return { ok: false, error: "No pudimos sacar a esa persona." };
  const r = data as { ok?: boolean; reason?: string } | null;
  revalidatePath("/config");
  return r?.ok ? { ok: true } : { ok: false, error: traducir(r?.reason) };
}

export async function cambiarRol(id: string, rol: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_cambiar_rol_miembro", {
    p_member_id: id,
    p_role: rol,
    p_org: org.organizationId,
  });
  if (error) return { ok: false, error: "No pudimos cambiar el rol." };
  const r = data as { ok?: boolean; reason?: string } | null;
  revalidatePath("/config");
  return r?.ok ? { ok: true } : { ok: false, error: traducir(r?.reason) };
}
