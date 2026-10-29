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
import { exigirOrg, orgActual, orgsDelUsuario } from "@/lib/org";
import { sendMail } from "@/lib/email/mailer";
import { InvitacionCotizar } from "@/components/emails/invitacion-cotizar-email";
import {
  ResultadoCotizacionEmail,
  type ResultadoCotizacion,
} from "@/components/emails/resultado-cotizacion-email";
import {
  cotizarUrl,
  fmtCantidad,
  fmtMonto,
  type InvitadoNuevo,
  type ItemNuevo,
  type ItemPedido,
  type LineaCotizacion,
} from "@/lib/cotizaciones";
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
  /** El más barato DENTRO de una moneda (pesos primero), desde la 0090. */
  mejor: number | null;
  /** En qué moneda está `mejor`. Antes de la 0090 no venía: se asume ARS. */
  mejor_moneda?: string | null;
  /** Hay presupuestos en otra moneda que no entraron en `mejor`. */
  otras_monedas?: boolean;
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
  /** Los renglones que se piden con precio. Vacío es el caso normal y simple. */
  items: ItemPedido[];
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
  /**
   * El desglose por ítem, si cotizó por renglones. Vacío cuando cotizó el
   * paquete cerrado, que sigue siendo válido: ahí `monto` es lo único que hay.
   */
  lineas: LineaCotizacion[];
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

/**
 * Un proveedor del directorio, para elegirlo en vez de escribir su mail.
 *
 * ⚠️ NO trae el mail, y no es un olvido: la productora no ve el contacto de un
 * proveedor (decisión de Franco del 2/8, migración 0058). Se manda el
 * `profile_id` y el mail lo resuelve la base al invitar.
 */
export interface ProveedorInvitable {
  profile_id: string;
  display_name: string | null;
  headline: string | null;
  provincia: string | null;
  ciudad: string | null;
  is_verified: boolean;
  categorias: string[];
  ya_invitado: boolean;
}

/* ────────────────────────────── lecturas ────────────────────────────── */

export async function listarPedidos(): Promise<PedidoResumen[]> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_mis_pedidos", {
    p_org: org.organizationId,
  });
  if (error) console.error("[cotizaciones] no se pudo leer mis_pedidos:", error.message);
  const r = data as { ok?: boolean; pedidos?: PedidoResumen[] } | null;
  return r?.ok ? (r.pedidos ?? []) : [];
}

export async function getPedido(requestId: string): Promise<PedidoDetalle | null> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_pedido_detalle", {
    p_request_id: requestId,
    p_org: org.organizationId,
  });
  if (error) console.error("[cotizaciones] no se pudo leer pedido_detalle:", error.message);
  const r = data as { ok?: boolean; pedido?: PedidoDetalle } | null;
  return r?.ok ? (r.pedido ?? null) : null;
}

export async function getCotizaciones(requestId: string): Promise<{
  cotizaciones: CotizacionFila[];
  sinCotizar: InvitadoSinCotizar[];
}> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_listar_cotizaciones", {
    p_request_id: requestId,
    p_org: org.organizationId,
  });
  if (error) console.error("[cotizaciones] no se pudo leer listar_cotizaciones:", error.message);
  const r = data as
    | { ok?: boolean; cotizaciones?: CotizacionFila[]; sin_cotizar?: InvitadoSinCotizar[] }
    | null;
  if (!r?.ok) return { cotizaciones: [], sinCotizar: [] };
  return { cotizaciones: r.cotizaciones ?? [], sinCotizar: r.sin_cotizar ?? [] };
}

/**
 * LOS PEDIDOS QUE TENÉS EN OTRA DE TUS PRODUCTORAS.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Una misma persona puede ser miembro de más de una organización, y el portal
 * trabaja con UNA por vez (la cookie `laburo_org_id`). El resultado, cuando el
 * selector quedó en la otra, es una pantalla vacía que dice "todavía no pediste
 * ningún precio" teniendo doce pedidos a un click de distancia. Eso no se lee
 * como "estás mirando la otra cuenta": se lee como que la app perdió los datos.
 *
 * ⚠️ Solo se llama cuando la lista de la organización actual está VACÍA. No es
 * una optimización: con pedidos a la vista, contar los de las otras no cambia
 * ninguna decisión y sí agrega ruido a la pantalla.
 *
 * ── POR QUÉ NO HAY UNA RPC NUEVA ────────────────────────────────────────────
 * Porque `staff_app_mis_pedidos` ya hace exactamente esto y ya valida la
 * membresía: se la llama una vez por organización. Son dos o tres, y solo
 * cuando la pantalla está vacía. Una función nueva que consulte varias
 * organizaciones de una es un lugar más donde equivocarse con el gate de
 * membresía, que es el que sostiene toda la separación entre productoras.
 */
export interface PedidosEnOtraCuenta {
  organizationId: string;
  nombre: string;
  pedidos: number;
}

export async function pedidosEnOtrasCuentas(): Promise<PedidosEnOtraCuenta[]> {
  try {
    const actual = await orgActual();
    // `orgsDelUsuario` puede traer filas con el id o el nombre en null (la vista
    // es un LEFT JOIN). Una organización sin id no se puede elegir y una sin
    // nombre no se puede nombrar, así que no sirven para este aviso.
    const otras = (await orgsDelUsuario()).filter(
      (o): o is typeof o & { organizationId: string; nombre: string } =>
        !!o.organizationId &&
        !!o.nombre &&
        o.organizationId !== actual?.organizationId,
    );
    if (otras.length === 0) return [];

    const supabase = await createClient();
    const cuentas = await Promise.all(
      otras.map(async (o) => {
        const { data, error } = await supabase.rpc("staff_app_mis_pedidos", {
          p_org: o.organizationId,
        });
        if (error) console.error("[cotizaciones] no se pudo leer mis_pedidos de otra cuenta:", error.message);
        const r = data as { ok?: boolean; pedidos?: unknown[] } | null;
        return {
          organizationId: o.organizationId,
          nombre: o.nombre,
          pedidos: r?.ok ? (r.pedidos?.length ?? 0) : 0,
        };
      }),
    );
    return cuentas.filter((c) => c.pedidos > 0);
  } catch (e) {
    // Un aviso que falla no puede voltear la pantalla: sin él se ve el vacío de
    // siempre, que es exactamente como estaba antes.
    console.error(
      "[cotizaciones] no se pudieron contar los pedidos de las otras cuentas:",
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

export async function proveedoresParaInvitar(
  requestId: string,
  categoria?: string | null,
): Promise<ProveedorInvitable[]> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_proveedores_para_invitar", {
    p_request_id: requestId,
    p_categoria: categoria?.trim() || null,
    p_org: org.organizationId,
  });
  if (error) console.error("[cotizaciones] no se pudo leer proveedores_para_invitar:", error.message);
  const r = data as { ok?: boolean; proveedores?: ProveedorInvitable[] } | null;
  return r?.ok ? (r.proveedores ?? []) : [];
}

/* ────────────────────────────── crear ────────────────────────────── */

const MENSAJES: Record<string, string> = {
  no_org: "No estás operando ninguna productora.",
  forbidden: "No tenés permiso para esto.",
  titulo_required: "Poné un título: es lo primero que lee el que va a cotizar.",
  cierra_at_required: "Falta la fecha de cierre, y tiene que ser futura.",
  campos_invalidos: "El desglose quedó mal armado. Recargá la página.",
  items_invalidos: "La lista de ítems quedó mal armada. Recargá la página.",
  gig_not_found: "Ese evento no es de tu productora.",
  pedido_no_encontrado: "Ese pedido no existe o no es de tu productora.",
  pedido_cerrado: "Ese pedido ya está cerrado.",
  ya_adjudicada: "Ese pedido ya está adjudicado.",
  cancelada: "Ese pedido está cancelado.",
  cotizacion_no_encontrada: "Esa cotización no es de este pedido.",
  invitados_invalidos: "La lista de invitados quedó mal armada.",
  no_encontrada: "Esa invitación no existe o no es de tu productora.",
  ya_cotizo: "Ese proveedor ya cargó su presupuesto.",
  cerrado: "El pedido ya está cerrado.",
  no_esta_abierto: "Solo se puede editar un pedido abierto.",
  ya_cotizaron:
    "Ya hay presupuestos cargados, así que los ítems no se pueden cambiar: cambiarlos borraría los precios que ya te mandaron. Lo demás sí.",
  fecha_invalida: "La fecha nueva tiene que ser futura.",
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
  items?: ItemNuevo[];
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
    // Los ítems sin título no viajan: la base también los descarta, pero
    // cortarlos acá evita mandar renglones fantasma que nadie escribió.
    p_items: (input.items ?? [])
      .filter((i) => (i.titulo || "").trim())
      .map((i) => ({
        titulo: i.titulo.trim(),
        detalle: (i.detalle || "").trim() || null,
        cantidad: (i.cantidad || "").trim() || null,
        unidad: (i.unidad || "").trim() || null,
        obligatorio: !!i.obligatorio,
      })),
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

/**
 * EDITAR UN PEDIDO SIN REHACERLO.
 *
 * Hasta hoy de un pedido solo se podía correr la fecha, cerrarlo o cancelarlo:
 * un título mal escrito obligaba a rehacerlo entero y perder las invitaciones,
 * que son lo caro (cada una es un mail que ya salió y un token que alguien
 * puede tener abierto).
 *
 * ⚠️ `items` es opcional Y ESO SIGNIFICA ALGO: sin él, la base no los toca. La
 * pantalla lo manda solo cuando todavía no cotizó nadie, porque borrar un ítem
 * con cotizaciones adentro se llevaría en cascada las líneas de cada proveedor
 * y el total quedaría siendo la suma de algo que ya no existe. Si igual llega,
 * la base devuelve `ya_cotizaron` y no cambia nada.
 *
 * ⚠️ Y NO toca la fecha de cierre: eso es `extenderCierre`, que además corre los
 * tokens de las invitaciones. Dos funciones para dos cosas.
 */
export async function editarPedido(
  requestId: string,
  input: {
    titulo: string;
    descripcion?: string;
    categoria?: string;
    provincia?: string;
    ciudad?: string;
    necesarioPara?: string;
    campos: { clave: string; etiqueta: string }[];
    items?: ItemNuevo[] | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_editar_pedido", {
    p_request_id: requestId,
    p_titulo: input.titulo.trim(),
    p_descripcion: input.descripcion?.trim() || null,
    p_categoria: input.categoria?.trim() || null,
    p_provincia: input.provincia?.trim() || null,
    p_ciudad: input.ciudad?.trim() || null,
    p_necesario_para: input.necesarioPara?.trim() || null,
    p_campos: input.campos,
    p_items:
      input.items == null
        ? null
        : input.items
            .filter((i) => (i.titulo || "").trim())
            .map((i) => ({
              titulo: i.titulo.trim(),
              detalle: (i.detalle || "").trim() || null,
              cantidad: (i.cantidad || "").trim() || null,
              unidad: (i.unidad || "").trim() || null,
              obligatorio: !!i.obligatorio,
            })),
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[cotizaciones] editar falló:", error.message);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  revalidatePath("/cotizaciones");
  revalidatePath(`/cotizaciones/${requestId}`);
  return { ok: true };
}

/**
 * Los ítems de un pedido, en las líneas de texto que van adentro del mail.
 *
 * Vive acá y no en la plantilla porque los DOS lugares que mandan la invitación
 * (invitar y reenviar) tienen que armar lo mismo: si cada uno lo escribe, en
 * tres meses uno dice la cantidad y el otro no.
 */
function itemsParaElMail(items: ItemPedido[]): string[] {
  return items.map((i) => {
    const cantidad = fmtCantidad(i);
    return [i.titulo, cantidad || null, i.obligatorio ? "lo necesitan sí o sí" : null]
      .filter(Boolean)
      .join(" · ");
  });
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
          items: itemsParaElMail(pedido.items ?? []),
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
    cancelado: `Se dio de baja · ${pedido.titulo}`,
    cerrado: `Se cerró la recepción de presupuestos · ${pedido.titulo}`,
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

/**
 * Cierra o cancela el pedido, Y LE AVISA A LOS QUE COTIZARON.
 *
 * ⚠️ Esto faltaba, y apareció con el primer pedido real (el catering de octubre):
 * el evento se cayó, se canceló el pedido, y a la única que había cotizado hubo
 * que escribirle a mano. Adjudicar avisaba a todos; cancelar no avisaba a nadie.
 * Es el mismo problema —el que cotizó y nunca supo nada no te vuelve a cotizar—
 * cubierto a medias.
 *
 * ⚠️ "Cancelado" y "cerrado" son mails DISTINTOS, y no es un detalle: "no se
 * hizo" no es "elegimos a otro". Si se confunden, el que cotizó bien se queda
 * creyendo que perdió.
 *
 * ⚠️ Solo se le escribe a quien COTIZÓ. Al invitado que nunca contestó no: es
 * ruido, y encima le recuerda que no contestó.
 */
export async function cerrarPedido(
  requestId: string,
  cancelar: boolean,
): Promise<
  { ok: true; estado: string; avisados: number; fallados: number } | { ok: false; error: string }
> {
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
  const r = data as {
    ok?: boolean;
    reason?: string;
    estado?: string;
    titulo?: string;
    avisar?: { email: string; nombre: string | null }[];
  } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  // Los mails salen DESPUÉS de que la base ya cerró. Si falla el envío, el
  // pedido está cerrado igual y se puede avisar a mano.
  const resultado: ResultadoCotizacion = cancelar ? "cancelado" : "cerrado";
  const titulo = r.titulo ?? "";
  const productora = org.nombre ?? "Una productora";
  let avisados = 0;
  let fallados = 0;

  for (const d of r.avisar ?? []) {
    try {
      const html = await render(
        createElement(ResultadoCotizacionEmail, {
          nombre: d.nombre,
          productora,
          titulo,
          resultado,
        }),
      );
      const res = await sendMail({
        to: d.email,
        subject: cancelar
          ? `Se dio de baja · ${titulo}`
          : `Se cerró la recepción de presupuestos · ${titulo}`,
        html,
      });
      if (res.ok) avisados += 1;
      else fallados += 1;
    } catch (e) {
      console.error(
        "[cotizaciones] no salió el aviso de cierre:",
        e instanceof Error ? e.message : String(e),
      );
      fallados += 1;
    }
  }

  revalidatePath(`/cotizaciones/${requestId}`);
  revalidatePath("/cotizaciones");
  return { ok: true, estado: r.estado ?? "cerrada", avisados, fallados };
}

/* ──────────────────── reenviar y correr la fecha ──────────────────── */

/**
 * Reenvía la invitación de alguien que todavía no cotizó.
 *
 * Existe porque la pantalla ya mostraba "el mail no salió" y no dejaba hacer
 * nada al respecto: información sin salida. Y no alcanza con volver a mandar el
 * mismo mail, porque **el token original no se puede reconstruir** (de él solo
 * queda el sha256). La RPC emite uno nuevo; los dos valen.
 */
export async function reenviarInvitacion(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_reenviar_invitacion", {
    p_invite_id: inviteId,
    p_org: org.organizationId,
  });
  if (error) {
    console.error("[cotizaciones] reenviar falló:", error.message);
    return { ok: false, error: "No se pudo reenviar. Probá de nuevo." };
  }
  const r = data as {
    ok?: boolean;
    reason?: string;
    email?: string;
    nombre?: string | null;
    token?: string;
    pedido?: {
      titulo: string;
      descripcion: string | null;
      categoria: string | null;
      provincia: string | null;
      ciudad: string | null;
      necesario_para: string | null;
      cierra_at: string;
      /** Los renglones que se cotizan por separado (0089). */
      items: ItemPedido[];
    };
  } | null;
  if (!r?.ok || !r.token || !r.email || !r.pedido) {
    return { ok: false, error: traducir(r?.reason) };
  }

  const p = r.pedido;
  try {
    const html = await render(
      createElement(InvitacionCotizar, {
        nombre: r.nombre ?? null,
        productora: org.nombre ?? "Una productora",
        titulo: p.titulo,
        descripcion: p.descripcion,
        categoria: p.categoria,
        donde: [p.ciudad, p.provincia].filter(Boolean).join(", ") || null,
        necesarioPara: p.necesario_para
          ? fmtFecha(p.necesario_para, { day: "2-digit", month: "long", year: "numeric" })
          : null,
        cierra:
          fmtFechaHora(p.cierra_at, {
            weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
          }) ?? "la fecha de cierre",
        items: itemsParaElMail(p.items ?? []),
        link: cotizarUrl(r.token),
      }),
    );
    const res = await sendMail({
      to: r.email,
      subject: `${org.nombre ?? "Una productora"} te pide un presupuesto · ${p.titulo}`,
      html,
    });
    if (!res.ok) {
      // El token nuevo ya está guardado: el link sirve igual y se puede volver a
      // intentar. Lo que no se hace es marcarlo como enviado.
      return { ok: false, error: "El mail no salió. Probá de nuevo en un rato." };
    }
  } catch (e) {
    console.error("[cotizaciones] reenviar: render/envío falló:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "El mail no salió. Probá de nuevo en un rato." };
  }

  await supabase.rpc("staff_app_marcar_enviadas", {
    p_invite_ids: [inviteId],
    p_org: org.organizationId,
  });

  revalidatePath(`/cotizaciones`);
  return { ok: true };
}

/**
 * Corre la fecha de cierre de un pedido abierto.
 *
 * El caso real: cierra mañana, cotizaron dos de doce, y lo único razonable es
 * darle tres días más. Sin esto había que cancelar y rehacer el pedido entero,
 * perdiendo las invitaciones y las cotizaciones que ya habían entrado.
 *
 * ⚠️ La RPC también corre el vencimiento de los tokens: extender sin eso dejaría
 * un pedido vivo con links muertos.
 */
export async function extenderCierre(
  requestId: string,
  cierraAt: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const { data, error } = await supabase.rpc("staff_app_extender_cierre", {
    p_request_id: requestId,
    p_cierra_at: cierraAt,
    p_org: org.organizationId,
  });
  if (error) {
    console.error("[cotizaciones] extender falló:", error.message);
    return { ok: false, error: "No se pudo cambiar la fecha. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) return { ok: false, error: traducir(r?.reason) };

  revalidatePath(`/cotizaciones/${requestId}`);
  revalidatePath("/cotizaciones");
  return { ok: true };
}
