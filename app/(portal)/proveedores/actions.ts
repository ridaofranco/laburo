"use server";

/**
 * Buscar proveedores en el marketplace (Fase 3), del lado de la productora.
 *
 * La búsqueda CRUZA organizaciones a propósito: un proveedor publicado lo ve
 * cualquier productora. Es la misma Regla 1 que Franco eligió para el pool de
 * personas (2/8). Lo que no cruza es la nota interna y el favorito, que siguen
 * siendo de cada productora.
 *
 * ── EL CONTACTO CAMBIÓ (Franco, 2/8) ──
 * Esto salió el 2/8 contactando por WhatsApp o por un `mailto:`, o sea abriendo
 * una app de afuera con un saludo vacío. Franco lo cortó: la consulta se llena
 * en el FORMULARIO del proveedor acá adentro y le llega a su mail ya completa.
 * Ver lib/formulario-consulta.ts y la migración 0058.
 *
 * Consecuencia que se ve en este archivo: `Proveedor` ya no trae `email` ni
 * `telefono`. La RPC dejó de mandarlos al navegador a propósito, porque si la
 * consulta va por el formulario, entregar igual la dirección deja abierta la
 * puerta de atrás y nos deja sin el registro que Franco pidió.
 */

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { render } from "@react-email/components";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email/mailer";
import { ConsultaProveedor } from "@/components/emails/consulta-proveedor-email";
import type { CampoFormulario, RespuestaConsulta } from "@/lib/formulario-consulta";

export interface ServicioProveedor {
  categoria: string;
  titulo: string;
  descripcion: string | null;
  precio_desde: number | null;
  moneda: string;
  unidad: string | null;
  provincias: string[];
}

export interface Proveedor {
  profile_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  ciudad: string | null;
  provincia: string | null;
  website: string | null;
  instagram: string | null;
  is_verified: boolean;
  servicios: ServicioProveedor[];
  es_favorito: boolean;
  nota_interna: string | null;
  ya_contactado: boolean;
}

export async function buscarProveedores(filtros: {
  texto?: string;
  categoria?: string;
  provincia?: string;
}): Promise<Proveedor[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_buscar_proveedores", {
    p_texto: filtros.texto?.trim() || null,
    p_categoria: filtros.categoria?.trim() || null,
    p_provincia: filtros.provincia?.trim() || null,
  });
  return (data as Proveedor[] | null) ?? [];
}

export async function getCategorias(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_categorias_proveedores");
  return (data as string[] | null) ?? [];
}

/** El formulario de UN proveedor, para renderizarlo al pedirle presupuesto. */
export interface FormularioProveedor {
  display_name: string;
  campos: CampoFormulario[];
  intro: string | null;
}

export async function getFormularioProveedor(
  profileId: string,
): Promise<{ ok: true; form: FormularioProveedor } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_formulario_proveedor", {
    p_profile_id: profileId,
  });
  if (error) {
    console.error("[proveedores] formulario falló:", error.message);
    return { ok: false, error: "No se pudo abrir el formulario. Probá de nuevo." };
  }
  const r = data as
    | { ok?: boolean; reason?: string; display_name?: string; campos?: CampoFormulario[]; intro?: string | null }
    | null;
  if (!r?.ok) {
    return {
      ok: false,
      error:
        r?.reason === "no_disponible"
          ? "Ese proveedor ya no está publicado."
          : "No se pudo abrir el formulario. Probá de nuevo.",
    };
  }
  return {
    ok: true,
    form: {
      display_name: r.display_name ?? "",
      // `campos` vacío significa "usa el template nuestro". La pantalla lo
      // resuelve con camposAMostrar(), no acá: así el default vive en un solo lugar.
      campos: r.campos ?? [],
      intro: r.intro ?? null,
    },
  };
}

/** El mail de la cuenta, para no hacerle escribir a la productora lo que ya sabemos. */
export async function getMiEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

/**
 * Manda la consulta: la guarda y le manda el mail al proveedor.
 *
 * EL ORDEN IMPORTA. Primero guarda (la RPC), después manda. Si el mail falla, la
 * consulta YA está registrada y aparece en /plataforma, así que Franco se entera
 * igual y el negocio se puede rescatar a mano. Al revés, un mail entregado sin
 * fila sería un contacto del que nadie se entera nunca.
 *
 * Por eso también se devuelve `mailEnviado`: la pantalla le dice la verdad a la
 * productora en vez de un "listo" que puede ser mentira.
 */
export async function consultarProveedor(input: {
  profileId: string;
  respuestas: RespuestaConsulta[];
  nombre: string;
  email: string;
  telefono: string;
}): Promise<{ ok: boolean; error?: string; mailEnviado?: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_consultar_proveedor", {
    p_profile_id: input.profileId,
    p_respuestas: input.respuestas,
    p_nombre: input.nombre.trim() || null,
    p_email: input.email.trim() || null,
    p_telefono: input.telefono.trim() || null,
    p_gig_id: null,
  });

  if (error) {
    console.error("[proveedores] consultar falló:", error.message);
    return { ok: false, error: "No se pudo enviar. Probá de nuevo." };
  }

  const r = data as {
    ok?: boolean;
    reason?: string;
    contacto_id?: string;
    proveedor?: { display_name?: string; email?: string };
    productora?: string;
  } | null;

  if (!r?.ok) {
    const MENSAJES: Record<string, string> = {
      sin_permiso: "No tenés permiso para esto.",
      no_disponible: "Ese proveedor ya no está publicado.",
      consulta_vacia: "Completá al menos una pregunta antes de mandar.",
      demasiados_campos: "La consulta tiene demasiados campos.",
      email_invalido: "Poné un mail válido para que te pueda contestar.",
      gig_ajeno: "Ese evento no es de tu productora.",
    };
    return { ok: false, error: MENSAJES[r?.reason ?? ""] ?? "No se pudo enviar. Probá de nuevo." };
  }

  // ── El mail. Un fallo acá NO voltea la consulta, que ya está guardada. ──
  let mailEnviado = false;
  const destino = r.proveedor?.email?.trim();
  if (destino) {
    try {
      const html = await render(
        createElement(ConsultaProveedor, {
          proveedor: r.proveedor?.display_name ?? "",
          productora: r.productora ?? "Una productora",
          nombre: input.nombre.trim() || null,
          email: input.email.trim(),
          telefono: input.telefono.trim() || null,
          respuestas: input.respuestas,
        }),
      );
      const res = await sendMail({
        to: destino,
        subject: `${r.productora ?? "Una productora"} te está pidiendo un presupuesto`,
        html,
        // Lo que hace que apretar "responder" le escriba a la productora y no a
        // nuestra casilla. Ver el comentario de MailOptions.replyTo.
        replyTo: input.email.trim(),
      });
      mailEnviado = res.ok;
      if (!res.ok) {
        console.error("[proveedores] mail de consulta no salió:", res.error ?? res.channel);
      }
    } catch (e) {
      console.error(
        "[proveedores] render/send de la consulta falló:",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    console.error("[proveedores] el proveedor no tiene mail cargado:", input.profileId);
  }

  if (mailEnviado && r.contacto_id) {
    // Deja constancia de que salió. Sin esto no se puede distinguir después un
    // mail perdido de uno entregado.
    const { error: e2 } = await supabase.rpc("staff_app_consulta_mail_enviado", {
      p_contacto_id: r.contacto_id,
    });
    if (e2) console.error("[proveedores] no se pudo marcar el mail:", e2.message);
  }

  revalidatePath("/proveedores");
  return { ok: true, mailEnviado };
}
