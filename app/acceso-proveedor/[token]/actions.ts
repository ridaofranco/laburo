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
import { normalizarWebsite } from "@/lib/format";
import { rpcDe, type Acceso } from "@/lib/proveedor-acceso";
import type { CampoFormulario } from "@/lib/formulario-consulta";

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
  // Formulario de consulta (0058). Los códigos los devuelve
  // staff_app.validar_campos_formulario, que es la validación que manda.
  demasiados_campos:
    "Son demasiadas preguntas. Cuantas más ponés, menos gente termina de completarlo.",
  campo_sin_texto: "Hay una pregunta sin texto. Escribila o borrala.",
  campo_muy_largo: "Hay una pregunta demasiado larga. Hacela más corta.",
  campo_repetido: "Hay dos preguntas iguales. Dejá una sola.",
  campo_sin_id: "Se rompió una pregunta. Actualizá la pantalla y probá de nuevo.",
  tipo_invalido: "Una de las preguntas quedó con un tipo que no existe.",
  pocas_opciones: "Una pregunta de elegir de una lista necesita al menos dos opciones.",
  demasiadas_opciones: "Una de las preguntas tiene demasiadas opciones.",
  opciones_invalidas: "Se rompieron las opciones de una pregunta. Probá de nuevo.",
  campos_invalidos: "El formulario quedó mal armado. Actualizá la pantalla.",
  // Salón (0066). `sin_perfil` acá NO significa "no existís": significa que el
  // link venció o que se cerró la sesión, que es lo mismo que `token_invalido`
  // del otro lado y por eso dice lo mismo.
  sin_perfil: "Este link ya no anda. Pedinos uno nuevo por WhatsApp.",
  no_es_salon: "Este perfil no es un salón, así que no lleva capacidad.",
  falta_capacidad: "Poné cuánta gente entra como máximo. Es con lo que te buscan.",
  capacidad_invertida: "El mínimo no puede ser más grande que el máximo.",
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
  acceso: Acceso,
  datos: DatosPerfilInput,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const r = rpcDe(acceso, "guardar_perfil");

  const { data, error } = await supabase.rpc(r.nombre, {
    ...r.identidad,
    p_display_name: datos.display_name,
    p_headline: datos.headline,
    p_bio: datos.bio,
    p_telefono: datos.telefono,
    // El esquema lo completamos nosotros. El proveedor escribe "somosder.ar",
    // que es como lo escribe cualquiera, y antes eso se rechazaba por no traer
    // el https:// adelante. Va en el SERVIDOR y no solo en el form porque el
    // form se puede saltear, y un website sin esquema guardado en la base se
    // rompe después, en el momento de mostrarlo como enlace.
    p_website: normalizarWebsite(datos.website),
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
  acceso: Acceso,
  servicio: ServicioInput,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const r = rpcDe(acceso, "guardar_servicio");

  const { data, error } = await supabase.rpc(r.nombre, {
    ...r.identidad,
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
  acceso: Acceso,
  servicioId: string,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const r = rpcDe(acceso, "borrar_servicio");

  const { data, error } = await supabase.rpc(r.nombre, {
    ...r.identidad,
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
  acceso: Acceso,
  quierePublicarse: boolean,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const r = rpcDe(acceso, "publicar");

  const { data, error } = await supabase.rpc(r.nombre, {
    ...r.identidad,
    p_publicar: quierePublicarse,
  });

  return resolver(data, error);
}

/**
 * Guardar el formulario con el que recibe consultas (RPC
 * staff_app_proveedor_guardar_formulario, migración 0058).
 *
 * Un array vacío NO es un error: significa "volvé a usar el template de SOMOS
 * DER". Es la forma de deshacer sin tener que borrar campo por campo, y es el
 * estado en el que arranca todo el mundo.
 */
export async function guardarFormulario(
  acceso: Acceso,
  campos: CampoFormulario[],
  intro: string,
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const r = rpcDe(acceso, "guardar_formulario");

  const { data, error } = await supabase.rpc(r.nombre, {
    ...r.identidad,
    p_campos: campos,
    p_intro: intro.trim() || null,
  });

  return resolver(data, error);
}

/** Lo propio de un salón: cuánta gente entra y con qué cuenta. */
export interface DatosSalonInput {
  capacidad_max: number | null;
  capacidad_min: number | null;
  superficie_m2: number | null;
  direccion: string;
  amenities: string[];
  tipos_evento: string[];
  /** null es "no lo dijo", y NO es lo mismo que false. */
  catering_propio: boolean | null;
  estacionamiento: boolean | null;
}

/**
 * Guardar la capacidad y el resto de lo propio del salón
 * (RPC staff_app_salon_guardar_detalles, migración 0066).
 *
 * ── POR QUÉ ACÁ NO SE USA `rpcDe` ───────────────────────────────────────────
 * Porque no hay dos familias de funciones para esto: hay UNA sola, que resuelve
 * la identidad por sesión y, si no hay, por token. Se escribió así en la 0066
 * justamente para no repetir el desdoblamiento del proveedor, que existe por
 * historia (las dos familias venían de la 0042 y de la 0045) y no porque haga
 * falta. El token viaja como un parámetro más y queda en null cuando hay sesión.
 *
 * ── POR QUÉ EL SALÓN PUEDE EDITAR SU CAPACIDAD ──────────────────────────────
 * Es el ÚNICO dato con el que se lo busca. Si se equivoca al anotarse y no lo
 * puede corregir, queda invisible o mal listado para siempre, y la única salida
 * sería tocarle la base a mano.
 */
export async function guardarSalon(
  acceso: Acceso,
  datos: DatosSalonInput,
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_salon_guardar_detalles", {
    p_capacidad_max: datos.capacidad_max,
    p_capacidad_min: datos.capacidad_min,
    p_superficie_m2: datos.superficie_m2,
    p_direccion: datos.direccion.trim() || null,
    p_amenities: datos.amenities,
    p_tipos_evento: datos.tipos_evento,
    p_catering_propio: datos.catering_propio,
    p_estacionamiento: datos.estacionamiento,
    p_token: acceso.por === "token" ? acceso.token : null,
  });

  return resolver(data, error);
}
