"use server";

/**
 * Server Actions de la puerta del proveedor (marketplace, movimiento 2).
 *
 * CONTRATO, calcado de app/o/[token]/offer-actions.ts:
 *
 * 1. TODA mutación vive acá y sólo acá. Next 15 invoca los Server Actions por
 *    POST y con validación de origen, así que los bots de preview de mail y de
 *    WhatsApp, que hacen GET, no pueden escribir nada. El page.tsx sólo lee.
 *
 * 2. Se usa el cliente server ANON (@/lib/supabase/server). Nunca el cliente con
 *    la clave de servicio, nunca una llamada directa al schema staff_app (que
 *    además no está expuesto por PostgREST, PGRST106). La única puerta son las
 *    RPCs public.staff_app_proveedor_* de la 0042, que validan el token adentro.
 *
 * 3. El token viaja como argumento porque es la identidad del proveedor: acá no
 *    hay sesión ni cookie. Toda la autorización pasa adentro de la RPC, que
 *    resuelve el perfil DEL TOKEN y filtra por ese profile_id. El cliente nunca
 *    manda un profile_id y la RPC nunca lo aceptaría.
 *
 * 4. Los `reason` de la base se traducen acá a castellano. El caso especial es
 *    token_invalido: no es un error del formulario, es que la puerta se cerró
 *    (venció, la revocaron o la regeneraron). Se marca `terminal: true` y la
 *    pantalla se refresca para mostrar la vista sin acceso, en vez de dejar al
 *    proveedor tocando un botón que ya no puede funcionar.
 */

import { createClient } from "@/lib/supabase/server";

export type ResultadoAccion =
  | { ok: true }
  | { ok: false; mensaje: string; terminal?: boolean; faltan?: string[] };

/** Forma mínima del jsonb que devuelven las RPCs de escritura. */
interface RespuestaRpc {
  ok?: boolean;
  reason?: string;
  faltan?: string[];
}

/** Mensajes por `reason`. El default nunca muestra el código crudo. */
const MENSAJES: Record<string, string> = {
  token_invalido: "Este link ya no anda. Pedinos uno nuevo por WhatsApp.",
  nombre_requerido: "Poné el nombre con el que querés que te vean.",
  categoria_requerida: "Elegí o escribí una categoría para el servicio.",
  titulo_requerido: "Poné un título para el servicio.",
  precio_invalido: "El precio no puede ser negativo.",
  demasiadas_provincias: "Elegiste demasiadas provincias. Dejá las que trabajás de verdad.",
  servicio_no_encontrado: "Ese servicio ya no está. Actualizá la pantalla.",
  faltan_datos: "Te falta completar algo antes de publicarte.",
};

function traducir(reason: string | undefined): string {
  if (!reason) return "Algo falló. Probá de nuevo en un momento.";
  return MENSAJES[reason] ?? "Algo falló. Probá de nuevo en un momento.";
}

/**
 * Normaliza la respuesta de cualquiera de las RPCs de escritura.
 * `error` de PostgREST (red caída, función que no existe) se trata igual que un
 * fallo genérico: nunca se le muestra al proveedor un mensaje de Postgres.
 */
function resolver(data: unknown, error: { message: string } | null): ResultadoAccion {
  if (error) {
    console.error("[acceso-proveedor] la RPC falló:", error.message);
    return { ok: false, mensaje: "Algo falló. Probá de nuevo en un momento." };
  }
  const r = (data ?? null) as RespuestaRpc | null;
  if (r?.ok) return { ok: true };

  const reason = r?.reason;
  return {
    ok: false,
    mensaje: traducir(reason),
    // La puerta se cerró: la pantalla tiene que cambiar entera, no mostrar un
    // error al lado de un formulario que ya no puede guardar.
    terminal: reason === "token_invalido",
    faltan: Array.isArray(r?.faltan) ? r.faltan : undefined,
  };
}

/** Los datos que el proveedor edita de sí mismo. Ni email, ni slug, ni verificación. */
export interface DatosPerfilInput {
  display_name: string;
  headline: string;
  bio: string;
  telefono: string;
  website: string;
  instagram: string;
  ciudad: string;
  provincia: string;
}

/** Guardar los datos del perfil (RPC staff_app_proveedor_guardar_perfil). */
export async function guardarPerfil(
  token: string,
  datos: DatosPerfilInput,
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_proveedor_guardar_perfil", {
    p_token: token,
    p_display_name: datos.display_name,
    p_headline: datos.headline,
    p_bio: datos.bio,
    p_telefono: datos.telefono,
    p_website: datos.website,
    p_instagram: datos.instagram,
    p_ciudad: datos.ciudad,
    p_provincia: datos.provincia,
  });

  return resolver(data, error);
}

/** Un servicio, tal como lo carga el proveedor desde el teléfono. */
export interface ServicioInput {
  servicio_id: string | null; // null = alta, con valor = edición
  categoria: string;
  titulo: string;
  descripcion: string;
  precio_desde: number | null;
  moneda: string;
  unidad: string;
  provincias: string[];
}

/**
 * Alta o edición de un servicio (RPC staff_app_proveedor_guardar_servicio).
 *
 * Ojo con el orden de los parámetros de la RPC: en Postgres los que tienen
 * DEFAULT van después de los que no, así que p_servicio_id va cuarto. Acá se
 * llama por nombre, así que el orden no importa, pero la firma sí.
 *
 * El cliente NUNCA manda un profile_id: la RPC lo resuelve del token y filtra
 * por él, así que un servicio_id de otro perfil no modifica nada y vuelve como
 * servicio_no_encontrado.
 */
export async function guardarServicio(
  token: string,
  servicio: ServicioInput,
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_proveedor_guardar_servicio", {
    p_token: token,
    p_categoria: servicio.categoria,
    p_titulo: servicio.titulo,
    p_servicio_id: servicio.servicio_id,
    p_descripcion: servicio.descripcion,
    p_precio_desde: servicio.precio_desde,
    p_moneda: servicio.moneda || "ARS",
    p_unidad: servicio.unidad,
    p_provincias: servicio.provincias,
  });

  return resolver(data, error);
}

/** Baja de un servicio (RPC staff_app_proveedor_borrar_servicio). */
export async function borrarServicio(
  token: string,
  servicioId: string,
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_proveedor_borrar_servicio", {
    p_token: token,
    p_servicio_id: servicioId,
  });

  return resolver(data, error);
}

/**
 * Publicarse o despublicarse (RPC staff_app_proveedor_publicar).
 *
 * Cuando la RPC devuelve faltan_datos, el array `faltan` sube tal cual hasta la
 * pantalla para que liste QUÉ falta, en castellano y accionable, en vez de un
 * "no se pudo" que no le dice nada al proveedor. Esta acción sólo mueve
 * is_public: la verificación la activa DER y no se toca desde ningún lado del
 * flujo por token.
 */
export async function publicar(
  token: string,
  quierePublicarse: boolean,
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_proveedor_publicar", {
    p_token: token,
    p_publicar: quierePublicarse,
  });

  return resolver(data, error);
}
