"use server";

/**
 * LA VIDRIERA PÚBLICA DE PROVEEDORES (Fase 4).
 *
 * Es el mismo motor que usa la productora en /proveedores, con la puerta abierta:
 * acá entra alguien que está organizando su casamiento, su cumpleaños de 15 o el
 * egreso de la escuela, y que no tiene ni va a tener una cuenta.
 *
 * ── POR QUÉ VIVE ADENTRO DE LABURO ──
 * Se había propuesto un subdominio propio de SOMOS DER. Franco lo corrigió el
 * 2/8 y tiene razón: el proveedor es UN lado del marketplace que sirve a los
 * tres a la vez (le vende a la productora, le da trabajo al personal, y es
 * vidriera para el cliente final). Un directorio partido en dos dominios sería
 * dos directorios, y el problema de este producto es justamente que hay pocos
 * proveedores para repartir.
 *
 * ── LAS RPC SON OTRAS, Y NO POR CAPRICHO ──
 * Las de /proveedores arrancan resolviendo la productora del que llama y sin
 * sesión devuelven vacío. Las de acá (`staff_app_vidriera_*`, migración 0059) no
 * miran quién llama, solo miran que el proveedor esté publicado. Ninguna de las
 * dos familias devuelve el mail ni el teléfono del proveedor: si la consulta va
 * por el formulario, entregar igual la dirección deja abierta la puerta de atrás
 * y nos deja sin el registro.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email/mailer";
import { ConsultaCliente } from "@/components/emails/consulta-cliente-email";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { CampoFormulario, RespuestaConsulta } from "@/lib/formulario-consulta";

export interface ServicioPublico {
  categoria: string;
  titulo: string;
  descripcion: string | null;
  precio_desde: number | null;
  moneda: string;
  unidad: string | null;
  provincias: string[];
}

export interface ProveedorPublico {
  profile_id: string;
  slug: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  ciudad: string | null;
  provincia: string | null;
  website: string | null;
  instagram: string | null;
  is_verified: boolean;
  servicios: ServicioPublico[];
}

/** La ficha: el proveedor con su formulario, todo en una sola llamada. */
export interface FichaProveedor extends ProveedorPublico {
  campos: CampoFormulario[];
  intro: string | null;
}

export async function buscarPublico(filtros: {
  texto?: string;
  categoria?: string;
  provincia?: string;
}): Promise<ProveedorPublico[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_vidriera_buscar", {
    p_texto: filtros.texto?.trim() || null,
    p_categoria: filtros.categoria?.trim() || null,
    p_provincia: filtros.provincia?.trim() || null,
  });
  if (error) {
    console.error("[servicios] búsqueda pública falló:", error.message);
    return [];
  }
  return (data as ProveedorPublico[] | null) ?? [];
}

export async function getCategoriasPublicas(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_vidriera_categorias");
  return (data as string[] | null) ?? [];
}

export async function getFichaProveedor(slug: string): Promise<FichaProveedor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_vidriera_proveedor", {
    p_slug: slug,
  });
  if (error) {
    console.error("[servicios] ficha falló:", error.message);
    return null;
  }
  const r = data as (FichaProveedor & { ok?: boolean }) | null;
  if (!r?.ok) return null;
  return r;
}

/**
 * Manda la consulta del cliente final al proveedor.
 *
 * ── EL FRENO DE SPAM, QUE ES EL RIESGO REAL DE ESTA FASE ──
 * Un formulario público que dispara mails es un cañón apuntado a la casilla de
 * los proveedores, y el que se quema y se va no somos nosotros: es el proveedor.
 * Por eso el freno va en dos capas y las dos hacen falta:
 *   · Acá por IP, que corta antes de gastar siquiera una conexión a la base.
 *     Límite honesto: en serverless el contador es por instancia, así que frena
 *     un script desde una IP (el caso real) pero no un ataque distribuido.
 *   · Adentro de la RPC (0059) por mail, por proveedor y en total. Ese cuenta
 *     filas en la base, no le importa de dónde vino el pedido, y es el que de
 *     verdad no se puede esquivar.
 *
 * ── EL ORDEN: GUARDAR PRIMERO, MANDAR DESPUÉS ──
 * Igual que en /proveedores. Si el mail falla, la consulta ya está registrada y
 * aparece en /plataforma, así que el negocio se puede rescatar a mano. Al revés,
 * un mail entregado sin fila sería un contacto del que nadie se entera nunca.
 * Por eso se devuelve `mailEnviado`: a la persona se le dice la verdad en vez de
 * un "listo" que puede ser mentira.
 */
export async function consultarPublico(input: {
  profileId: string;
  respuestas: RespuestaConsulta[];
  nombre: string;
  email: string;
  telefono: string;
}): Promise<{ ok: boolean; error?: string; mailEnviado?: boolean }> {
  const ip = await clientIp();
  if (!rateLimit(`consulta-publica:ip:${ip}`, 3, 10 * 60_000).ok) {
    return {
      ok: false,
      error: "Mandaste varias consultas seguidas. Esperá unos minutos y probá de nuevo.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_vidriera_consultar", {
    p_profile_id: input.profileId,
    p_respuestas: input.respuestas,
    p_nombre: input.nombre.trim(),
    p_email: input.email.trim(),
    p_telefono: input.telefono.trim() || null,
  });

  if (error) {
    console.error("[servicios] consulta pública falló:", error.message);
    return { ok: false, error: "No se pudo enviar. Probá de nuevo." };
  }

  const r = data as {
    ok?: boolean;
    reason?: string;
    contacto_id?: string;
    envio_token?: string;
    proveedor?: { display_name?: string; email?: string };
  } | null;

  if (!r?.ok) {
    const MENSAJES: Record<string, string> = {
      no_disponible: "Ese proveedor ya no está publicado.",
      consulta_vacia: "Completá al menos una pregunta antes de mandar.",
      demasiados_campos: "La consulta tiene demasiados campos.",
      email_invalido: "Poné un mail válido para que te puedan contestar.",
      falta_nombre: "Poné tu nombre para que sepan quién les escribe.",
      demasiadas_consultas:
        "Ya mandaste varias consultas en la última hora. Esperá un rato y seguí.",
      proveedor_saturado:
        "Este proveedor recibió muchas consultas recién. Probá de nuevo más tarde.",
      sistema_saturado: "Estamos recibiendo muchas consultas. Probá de nuevo en un rato.",
    };
    return { ok: false, error: MENSAJES[r?.reason ?? ""] ?? "No se pudo enviar. Probá de nuevo." };
  }

  // ── El mail. Un fallo acá NO voltea la consulta, que ya está guardada. ──
  let mailEnviado = false;
  const destino = r.proveedor?.email?.trim();
  if (destino) {
    try {
      const html = await render(
        createElement(ConsultaCliente, {
          proveedor: r.proveedor?.display_name ?? "",
          nombre: input.nombre.trim(),
          email: input.email.trim(),
          telefono: input.telefono.trim() || null,
          respuestas: input.respuestas,
        }),
      );
      const res = await sendMail({
        to: destino,
        subject: `${input.nombre.trim()} te está pidiendo un presupuesto`,
        html,
        // Apretar "responder" le escribe a la persona, no a nuestra casilla.
        replyTo: input.email.trim(),
      });
      mailEnviado = res.ok;
      if (!res.ok) {
        console.error("[servicios] mail de consulta no salió:", res.error ?? res.channel);
      }
    } catch (e) {
      console.error(
        "[servicios] render/send de la consulta falló:",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    console.error("[servicios] el proveedor no tiene mail cargado:", input.profileId);
  }

  if (mailEnviado && r.contacto_id && r.envio_token) {
    // Se marca con el cliente de service role y NO con el de la sesión: quien
    // consulta es anónimo, y `staff_app_vidriera_mail_enviado` está cerrada a
    // `anon` a propósito (dejarla abierta sería regalar intentos de adivinar un
    // uuid). El token prueba que este mismo servidor hizo la consulta.
    try {
      const admin = createServiceRoleClient();
      const { error: e2 } = await admin.rpc("staff_app_vidriera_mail_enviado", {
        p_contacto_id: r.contacto_id,
        p_token: r.envio_token,
      });
      if (e2) console.error("[servicios] no se pudo marcar el mail:", e2.message);
    } catch (e) {
      console.error(
        "[servicios] service role no disponible para marcar el mail:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return { ok: true, mailEnviado };
}
