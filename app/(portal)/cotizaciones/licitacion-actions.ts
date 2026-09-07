"use server";

/**
 * La licitación pública: el pedido deja de vivir solo en la casilla de los
 * invitados y pasa a tener su propia página.
 *
 * ── LO QUE PIDIÓ FRANCO (7/9/2026) ──────────────────────────────────────────
 * *"estaría bueno que sea una licitación donde también pueda elegir si es
 * privada o pública, si es pública que tenga una página web, tipo, FIEBRE DISCO
 * está cotizando lo siguiente, o por ahí también consultar si quieren que sea
 * privado o público el nombre de quien cotiza"*.
 *
 * Son DOS interruptores distintos y a propósito:
 *   1. `pública`  → cualquiera puede ver el pedido y pedir el link para cotizar.
 *   2. `mostrar el nombre` → si está apagado, la página dice "Una productora".
 * El segundo existe porque a veces conviene pedir precio sin que se sepa quién
 * pide: el proveedor que sabe de quién es el evento cotiza distinto.
 *
 * ⚠️ LA PÁGINA PÚBLICA NO ESTRENA FORMA DE COTIZAR, solo estrena forma de
 * ENTRAR. El que quiere cotizar deja su mail y recibe el mismo link con token
 * de siempre. Así el circuito que ya está probado (token hasheado, vencimiento,
 * una cotización por invitación) no se duplica en una versión nueva y más
 * floja.
 */

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";
import { sendMail } from "@/lib/email/mailer";
import { siteUrl } from "@/lib/site";
import { cotizarUrl } from "@/lib/cotizaciones";
import { InvitacionCotizar } from "@/components/emails/invitacion-cotizar-email";

export const licitacionUrl = async (slug: string) => siteUrl(`/licitaciones/${slug}`);

/** Publica o vuelve a privado, y decide si se muestra quién pide. */
export async function cambiarVisibilidad(
  requestId: string,
  publica: boolean,
  mostrarProductora: boolean,
): Promise<{ ok: true; slug: string | null; publica: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_visibilidad_pedido", {
    p_request_id: requestId,
    p_publica: publica,
    p_mostrar_productora: mostrarProductora,
    p_org: org.organizationId,
  });
  if (error) {
    console.error("[licitacion] no se pudo cambiar la visibilidad:", error.message);
    return { ok: false, error: "No pudimos cambiarlo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string; slug?: string | null } | null;
  if (!r?.ok) {
    return {
      ok: false,
      error:
        r?.reason === "forbidden"
          ? "No tenés permiso para publicar este pedido."
          : "No encontramos el pedido.",
    };
  }

  revalidatePath(`/cotizaciones/${requestId}`);
  revalidatePath("/licitaciones");
  return { ok: true, slug: r.slug ?? null, publica };
}

/**
 * Un proveedor pide el link para cotizar desde la página pública.
 *
 * ⚠️ RESPUESTA SIEMPRE UNIFORME, salga o no el mail: esta pantalla la abre
 * cualquiera de internet, así que decir "esa dirección ya estaba invitada"
 * convertiría la página en un oráculo de quién fue invitado a qué licitación.
 */
export async function pedirLinkParaCotizar(
  slug: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  // Honeypot: invisible para una persona, tentador para un script.
  if (String(formData.get("sitio") ?? "").trim() !== "") return { ok: true };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ese email no parece válido. Revisalo." };
  }

  const { data, error } = await supabase.rpc("staff_app_quiero_cotizar", {
    p_slug: slug,
    p_email: email,
    p_nombre: nombre || null,
  });
  if (error) {
    console.error("[licitacion] quiero_cotizar falló:", error.message);
    return { ok: false, error: "No pudimos mandarte el link. Probá de nuevo." };
  }

  const r = data as
    | { ok?: boolean; reason?: string; token?: string; titulo?: string; cierra_at?: string }
    | null;
  if (!r?.ok) {
    if (r?.reason === "cerrada") return { ok: false, error: "Esta licitación ya cerró." };
    if (r?.reason === "email_invalido") return { ok: false, error: "Ese email no parece válido." };
    return { ok: false, error: "No encontramos esta licitación." };
  }

  // El pedido, para armar el mail con los mismos datos que ve la página.
  const { data: lic } = await supabase.rpc("staff_app_licitacion", { p_slug: slug });
  const l = (lic as Record<string, unknown> | null) ?? {};

  try {
    const html = await render(
      createElement(InvitacionCotizar, {
        nombre: nombre || null,
        productora: String(l.quien ?? "Una productora"),
        titulo: String(l.titulo ?? r.titulo ?? "Pedido de cotización"),
        descripcion: (l.descripcion as string | null) ?? null,
        categoria: (l.categoria as string | null) ?? null,
        donde: [l.ciudad, l.provincia].filter(Boolean).join(", ") || null,
        necesarioPara: null,
        cierra: fechaHora(String(l.cierra_at ?? r.cierra_at ?? "")),
        link: cotizarUrl(r.token as string),
      }),
    );
    await sendMail({
      to: email,
      subject: `Tu link para cotizar · ${String(l.titulo ?? "pedido de precio")}`,
      html,
    });
  } catch (e) {
    console.error("[licitacion] no se pudo mandar el link:", (e as Error).message);
    // ⚠️ Se devuelve ok igual: la invitación ya está creada y el proveedor puede
    // volver a pedirla. Decirle "falló" lo manda a reintentar y a duplicar.
  }

  return { ok: true };
}

function fechaHora(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}
