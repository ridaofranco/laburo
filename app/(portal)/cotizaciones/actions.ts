"use server";

/**
 * Pedidos de cotización, del lado del que pide (etapas 2 y 4 de LICITACIONES.md).
 *
 * ── LO QUE HAY QUE SABER ANTES DE TOCAR ESTE ARCHIVO ────────────────────────
 *
 * 1. **`p_org` viaja SIEMPRE.** Sin él, la RPC resuelve con
 *    `coalesce(p_org, current_org_id(), default_org_id())` y el pedido puede
 *    caer en la organización equivocada cuando alguien es miembro de dos. Es el
 *    mismo arreglo que se hizo en las ocho escrituras de la tanda 1.
 *
 * 2. **El orden es guardar → mandar → marcar.** La invitación se crea en la
 *    base, después sale el mail, y recién ahí se estampa `enviado_at` con los
 *    ids de los que salieron de verdad. Si el mail falla, la invitación existe
 *    igual (el link es válido y se puede reenviar) y la pantalla dice que ese
 *    mail no salió. Al revés (marcar antes) diríamos "enviado" de algo que
 *    nunca salió, y esa columna es justo la que decide a quién recordarle.
 *
 * 3. **El token en crudo vive SOLO en memoria, para armar el link del mail.**
 *    De la base sale una vez y ahí queda solo su sha256. No se loguea, no se
 *    devuelve a la pantalla y no se guarda en ningún lado.
 *
 * 4. **Un mail que falla no voltea nada.** Ni la invitación ni la adjudicación:
 *    las dos ya están escritas en la base cuando se manda. Se devuelve cuántos
 *    salieron para que la pantalla diga la verdad en vez de un "listo".
 */

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";
import { sendMail } from "@/lib/email/mailer";
import { InvitacionCotizar } from "@/components/emails/invitacion-cotizar-email";
import {
  ResultadoCotizacionEmail,
  type ResultadoCotizacion,
} from "@/components/emails/resultado-cotizacion-email";
import { cotizarUrl, fmtMonto, type InvitadoNuevo } from "@/lib/cotizaciones";
import { fmtFecha, fmtFechaHora } from "@/lib/dates";

/* ────────────────────────────── tipos ────────────────────────────── */

export interface PedidoResumen {
  id: string;
  titulo: string;
  categoria: string | null;
  estado: string;
  cierra_at: string;
  necesario_para: string | null;
  created_at: string;
  cerrado: boolean;
  invitados: number;
  cotizaron: number;
  mejor: number | null;
}

export interface PedidoDetalle {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  provincia: string | null;
  ciudad: string | null;
  necesario_para: string | null;
  cierra_at: string;
  campos: { clave: string; etiqueta: string }[];
  estado: string;
  gig_id: string | null;
  adjudicada_at: string | null;
  cerrado: boolean;
}

export interface CotizacionFila {
  quote_id: string;
  invite_id: string;
  proveedor: string;
  email: string;
  profile_id: string | null;
  monto: number;
  moneda: string;
  incluye: string;
  no_incluye: string | null;
  validez_dias: number | null;
  respuestas: Record<string, string>;
  estado: string;
  updated_at: string;
}

export interface InvitadoSinCotizar {
  invite_id: string;
  proveedor: string;
  email: string;
  enviado_at: string | null;
  visto_at: string | null;
}

/* ────────────────────────────── lecturas ────────────────────────────── */

export async function listarPedidos(): Promise<PedidoResumen[]> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data } = await supabase.rpc("staff_app_mis_pedidos", {
    p_org: org.organizationId,
  });
  const r = data as { ok?: boolean; pedidos?: PedidoResumen[] } | null;
  return r?.ok ? (r.pedidos ?? []) : [];
}

export async function getPedido(requestId: string): Promise<PedidoDetalle | null> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data } = await supabase.rpc("staff_app_pedido_detalle", {
    p_request_id: requestId,
    p_org: org.organizationId,
  });
  const r = data as { ok?: boolean; pedido?: PedidoDetalle } | null;
  return r?.ok ? (r.pedido ?? null) : null;
}

export async function getCotizaciones(requestId: string): Promise<{
  cotizaciones: CotizacionFila[];
  sinCotizar: InvitadoSinCotizar[];
}> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data } = await supabase.rpc("staff_app_listar_cotizaciones", {
    p_request_id: requestId,
    p_org: org.organizationId,
  });
  const r = data as
    | { ok?: boolean; cotizaciones?: CotizacionFila[]; sin_cotizar?: InvitadoSinCotizar[] }
    | null;
  if (!r?.ok) return { cotizaciones: [], sinCotizar: [] };
  return { cotizaciones: r.cotizaciones ?? [], sinCotizar: r.sin_cotizar ?? [] };
}

/* ────────────────────────────── crear ────────────────────────────── */

const MENSAJES: Record<string, string> = {
  no_org: "No estás operando ninguna productora.",
  forbidden: "No tenés permiso para esto.",
  titulo_required: "Poné un título: es lo primero que lee el que va a cotizar.",
  cierra_at_required: "Falta la fecha de cierre, y tiene que ser futura.",
  campos_invalidos: "El desglose quedó mal armado. Recargá la página.",
  gig_not_found: "Ese evento no es de tu productora.",
  pedido_no_encontrado: "Ese pedido no existe o no es de tu productora.",
  pedido_cerrado: "Ese pedido ya está cerrado.",
  ya_adjudicada: "Ese pedido ya está adjudicado.",
  cancelada: "Ese pedido está cancelado.",
  cotizacion_no_encontrada: "Esa cotización no es de este pedido.",
  invitados_invalidos: "La lista de invitados quedó mal armada.",
};

function traducir(reason: string | undefined, fallback = "No se pudo. Probá de nuevo."): string {
  return MENSAJES[reason ?? ""] ?? fallback;
}

export async function crearPedido(input: {
  titulo: string;
  descripcion?: string;
  categoria?: string;
  provincia?: string;
  ciudad?: string;
  necesarioPara?: string;
  cierraAt: string;
  campos: { clave: string; etiqueta: string }[];
  gigId?: string | null;
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_crear_pedido", {
    p_titulo: input.titulo.trim(),
    p_descripcion: input.descripcion?.trim() || null,
    p_categoria: input.categoria?.trim() || null,
    p_provincia: input.provincia?.trim() || null,
    p_ciudad: input.ciudad?.trim() || null,
    p_necesario_para: input.necesarioPara?.trim() || null,
    p_cierra_at: input.cierraAt,
    p_campos: input.campos,
    p_gig_id: input.gigId || null,
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[cotizaciones] crear falló:", error.message);
    return { ok: false, error: "No se pudo crear el pedido. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string; request_id?: string } | null;
  if (!r?.ok || !r.request_id) return { ok: false, error: traducir(r?.reason) };

  revalidatePath("/cotizaciones");
  return { ok: true, requestId: r.request_id };
}

/* ────────────────────────────── invitar ────────────────────────────── */

/**
 * Crea las invitaciones y manda un mail por cada una.
 *
 * Devuelve los tres números que la pantalla necesita para no mentir: cuántos
 * mails salieron, cuántos estaban repetidos (y por eso no se invitaron dos
 * veces) y cuántos fallaron al enviar.
 */
export async function invitar(
  requestId: string,
  invitados: InvitadoNuevo[],
): Promise<
  | { ok: true; enviados: number; fallados: number; repetidos: number; invalidos: number }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const pedido = await getPedido(requestId);
  if (!pedido) return { ok: false, error: MENSAJES.pedido_no_encontrado };

  const { data, error } = await supabase.rpc("staff_app_invitar_a_cotizar", {
    p_request_id: requestId,
    p_invitados: invitados.map((i) => ({
      email: i.email,
      nombre: i.nombre ?? null,
      profile_id: i.profileId ?? null,
    })),
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[cotizaciones] invitar falló:", error.message);
    return { ok: false, error: "No se pudieron crear las invitaciones. Probá de nuevo." };
  }
  const r = data as {
    ok?: boolean;
    reason?: string;
    invitados?: { invite_id: string; email: string; nombre: string | null; token: string }[];
    repetidos?: number;
    invalidos?: number;
  } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  const nuevos = r.invitados ?? [];
  const productora = org.nombre ?? "Una productora";
  const donde = [pedido.ciudad, pedido.provincia].filter(Boolean).join(", ") || null;
  const cierra =
    fmtFechaHora(pedido.cierra_at, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "la fecha de cierre";
  const necesarioPara = pedido.necesario_para
    ? fmtFecha(pedido.necesario_para, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const salieron: string[] = [];
  let fallados = 0;

  for (const inv of nuevos) {
    try {
      const html = await render(
        createElement(InvitacionCotizar, {
          nombre: inv.nombre,
          productora,
          titulo: pedido.titulo,
          descripcion: pedido.descripcion,
          categoria: pedido.categoria,
          donde,
          necesarioPara,
          cierra,
          // El token en crudo se usa acá y en ningún otro lado.
          link: cotizarUrl(inv.token),
        }),
      );
      const res = await sendMail({
        to: inv.email,
        // El asunto lleva el rubro y quién pide: en la casilla de un proveedor
        // este mail compite con otros veinte.
        subject: `${productora} te pide un presupuesto · ${pedido.titulo}`,
        html,
      });
      if (res.ok) salieron.push(inv.invite_id);
      else fallados += 1;
    } catch (e) {
      console.error(
        "[cotizaciones] no salió la invitación de",
        inv.invite_id,
        e instanceof Error ? e.message : String(e),
      );
      fallados += 1;
    }
  }

  // Recién ahora, y solo las que salieron de verdad.
  if (salieron.length) {
    await supabase.rpc("staff_app_marcar_enviadas", {
      p_invite_ids: salieron,
      p_org: org.organizationId,
    });
  }

  revalidatePath(`/cotizaciones/${requestId}`);
  return {
    ok: true,
    enviados: salieron.length,
    fallados,
    repetidos: r.repetidos ?? 0,
    invalidos: r.invalidos ?? 0,
  };
}

/* ────────────────────────────── adjudicar ────────────────────────────── */

/**
 * Marca la ganadora y avisa a todos: al que ganó, al que cotizó y no quedó, y
 * al que fue invitado y no llegó a cotizar.
 *
 * ⚠️ Los mails salen DESPUÉS de que la base ya decidió. Si falla el envío, la
 * adjudicación está hecha igual y se puede reintentar avisando a mano; al revés
 * sería elegir en un mail y no en la base.
 */
export async function adjudicar(
  requestId: string,
  quoteId: string,
): Promise<{ ok: true; avisados: number; fallados: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const pedido = await getPedido(requestId);
  if (!pedido) return { ok: false, error: MENSAJES.pedido_no_encontrado };

  const { data, error } = await supabase.rpc("staff_app_adjudicar", {
    p_request_id: requestId,
    p_quote_id: quoteId,
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[cotizaciones] adjudicar falló:", error.message);
    return { ok: false, error: "No se pudo adjudicar. Probá de nuevo." };
  }
  const r = data as {
    ok?: boolean;
    reason?: string;
    ganador?: { email: string; nombre: string | null; monto: number; moneda: string };
    no_elegidos?: { email: string; nombre: string | null }[];
    sin_cotizar?: { email: string; nombre: string | null }[];
  } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  const productora = org.nombre ?? "Una productora";
  const destinatarios: {
    email: string;
    nombre: string | null;
    resultado: ResultadoCotizacion;
    montoTexto?: string | null;
  }[] = [];

  if (r.ganador?.email) {
    destinatarios.push({
      email: r.ganador.email,
      nombre: r.ganador.nombre,
      resultado: "gano",
      montoTexto: fmtMonto(r.ganador.monto, r.ganador.moneda),
    });
  }
  for (const x of r.no_elegidos ?? []) {
    destinatarios.push({ email: x.email, nombre: x.nombre, resultado: "no_gano" });
  }
  for (const x of r.sin_cotizar ?? []) {
    destinatarios.push({ email: x.email, nombre: x.nombre, resultado: "sin_cotizar" });
  }

  const ASUNTO: Record<ResultadoCotizacion, string> = {
    gano: `Quedó elegido tu presupuesto · ${pedido.titulo}`,
    no_gano: `Se cerró el pedido · ${pedido.titulo}`,
    sin_cotizar: `Se cerró el pedido · ${pedido.titulo}`,
  };

  let avisados = 0;
  let fallados = 0;
  for (const d of destinatarios) {
    try {
      const html = await render(
        createElement(ResultadoCotizacionEmail, {
          nombre: d.nombre,
          productora,
          titulo: pedido.titulo,
          resultado: d.resultado,
          montoTexto: d.montoTexto ?? null,
        }),
      );
      const res = await sendMail({ to: d.email, subject: ASUNTO[d.resultado], html });
      if (res.ok) avisados += 1;
      else fallados += 1;
    } catch (e) {
      console.error(
        "[cotizaciones] no salió el aviso de resultado:",
        e instanceof Error ? e.message : String(e),
      );
      fallados += 1;
    }
  }

  revalidatePath(`/cotizaciones/${requestId}`);
  revalidatePath("/cotizaciones");
  return { ok: true, avisados, fallados };
}

/* ────────────────────────────── cerrar ────────────────────────────── */

export async function cerrarPedido(
  requestId: string,
  cancelar: boolean,
): Promise<{ ok: true; estado: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_cerrar_pedido", {
    p_request_id: requestId,
    p_cancelar: cancelar,
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[cotizaciones] cerrar falló:", error.message);
    return { ok: false, error: "No se pudo cerrar. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string; estado?: string } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  revalidatePath(`/cotizaciones/${requestId}`);
  revalidatePath("/cotizaciones");
  return { ok: true, estado: r.estado ?? "cerrada" };
}
