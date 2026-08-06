"use client";

/**
 * El lado del navegador de la subida directa: pide permiso, sube a Supabase y
 * devuelve el nombre del objeto. El archivo NO pasa por Vercel en ningún momento,
 * que es justamente lo que borra los dos límites de tamaño.
 * Ver el porqué largo en lib/cv-subida.ts.
 */

import { createClient } from "@/lib/supabase/client";
import { pedirSubidaCv } from "@/lib/cv-subida";
import { CV_BUCKET, CV_MAX_BYTES, sniffCvMime } from "@/lib/cv";

/** Lo que hay que mandarle al servidor después de subir. */
export interface CvSubido {
  path: string;
  firma: string;
  mime: string;
}

export type ResultadoSubida = { ok: true; cv: CvSubido } | { ok: false; reason: string };

/**
 * Techo de espera de la subida. SIN ESTO LA PANTALLA SE CUELGA PARA SIEMPRE.
 *
 * Pasó el 6/8, en Safari, apenas se deployó: el cartel quedó en "Subiendo tu
 * CV…" y no volvía nunca, y como el botón de enviar se deshabilita mientras
 * sube, la persona quedaba encerrada sin poder ni anotarse a mano. Ni `fetch` ni
 * el cliente de Supabase traen timeout propio: si el pedido se queda colgado, la
 * promesa no resuelve NUNCA y no hay error que mostrar.
 *
 * Una espera que no termina es peor que un error: con el error la persona sabe
 * qué hacer.
 */
const TIMEOUT_MS = 45_000;

function conTimeout<T>(p: Promise<T>, ms: number, queEs: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout: ${queEs} tardó más de ${ms / 1000}s`)), ms),
    ),
  ]);
}

export async function subirCvDirecto(file: File): Promise<ResultadoSubida> {
  try {
    return await subir(file);
  } catch (e) {
    /**
     * NUNCA propagar. Quien llama hace `setSubiendo(true)` antes y
     * `setSubiendo(false)` después: si esto tira, ese segundo `setSubiendo`
     * jamás corre y la pantalla queda colgada. Ese fue exactamente el bug del
     * 6/8. Acá todo camino termina en un objeto, nunca en una excepción.
     *
     * El motivo va en el mensaje a propósito: lo primero que hace falta cuando
     * alguien avisa "no anda" es saber QUÉ falló.
     */
    const detalle = e instanceof Error ? e.message : String(e);
    console.error("[cv-subida]", detalle);
    return {
      ok: false,
      reason: `No se pudo subir el CV (${detalle.slice(0, 120)}). Podés anotarte igual: escribí tu nombre y tu mail.`,
    };
  }
}

async function subir(file: File): Promise<ResultadoSubida> {
  /**
   * ── PRIMERO: ¿SE PUEDEN LEER LOS BYTES? ────────────────────────────────────
   *
   * ESTA ERA LA CAUSA DEL CASO DE FRANCO, encontrada el 6/8. Su CV vivía en la
   * carpeta de Google Drive del Finder y el archivo NO ESTABA EN EL DISCO: la
   * ficha decía 143.133 bytes pero ocupaba 0 bloques, y al leerlo daba
   * `Operation timed out`. Lo mismo con TODOS sus CV de Drive. Pasa igual con
   * los archivos que iCloud saca del disco para liberar espacio.
   *
   * Para el navegador ese archivo existe y tiene tamaño (eso sale de la ficha),
   * pero al pedir los bytes falla o no vuelve nunca. Por eso fallaba idéntico en
   * LABURO y en somosder.ar, con cualquier tamaño, y por eso NUNCA llegó un
   * pedido al servidor: no había nada que mandar. El código viejo lo tragaba en
   * un catch y decía "no pudimos leer el CV", que mandaba a la persona a cambiar
   * de archivo cuando el archivo estaba perfecto: lo que no estaba era acá.
   */
  let head: Uint8Array;
  try {
    head = new Uint8Array(await conTimeout(file.slice(0, 12).arrayBuffer(), 15_000, "leer el archivo"));
  } catch {
    return {
      ok: false,
      reason:
        "No pudimos leer el archivo desde tu computadora. Suele pasar cuando está en Google Drive o iCloud y no está descargado: abrilo una vez (doble click) y, cuando se vea entero, volvé a elegirlo. O arrastralo antes a tu Escritorio.",
    };
  }
  // El tipo se decide por esos bytes, nunca por file.type: cuando el archivo
  // llega al teléfono por WhatsApp o Drive, el navegador lo reporta vacío y un
  // PDF perfecto quedaba afuera sin intentar.
  const mime = sniffCvMime(head);
  if (!mime) {
    return {
      ok: false,
      reason:
        "El CV tiene que ser un PDF o una imagen. Si lo tenés en Word: Archivo, Guardar como, PDF.",
    };
  }
  if (file.size > CV_MAX_BYTES) {
    return {
      ok: false,
      reason: `Tu CV pesa más de ${Math.round(CV_MAX_BYTES / 1024 / 1024)} MB. Subilo más liviano.`,
    };
  }

  /**
   * Server Action. Si la pestaña quedó abierta desde ANTES de un deploy, su id
   * ya no existe del otro lado y esta llamada TIRA en vez de devolver: por eso
   * va con timeout y adentro del try de arriba.
   */
  const permiso = await conTimeout(
    pedirSubidaCv(file.size, file.name),
    TIMEOUT_MS,
    "pedir el permiso de subida",
  );
  if (!permiso.ok || !permiso.path || !permiso.token || !permiso.firma) {
    return { ok: false, reason: permiso.reason ?? "No se pudo preparar la subida del CV." };
  }

  /**
   * SE SUBE UN BLOB CON EL TIPO REAL, NO EL File TAL CUAL. Y no es un detalle.
   *
   * El bucket tiene su propia lista de MIME permitidos y rechaza con 415 lo que
   * no esté en ella. Cuando el archivo llegó al teléfono por WhatsApp o Drive,
   * `file.type` viene vacío o `application/octet-stream`, y el cliente de
   * Supabase toma el tipo DEL BLOB, ignorando el `contentType` que uno le pase
   * cuando el cuerpo es un File. O sea que el PDF se subía como octet-stream y
   * el bucket lo rebotaba. Medido el 6/8: 400 con
   * `{"error":"invalid_mime_type","message":"mime type application/octet-stream
   * is not supported"}`. Envolverlo en un Blob con el tipo sniffeado lo arregla
   * de raíz, y de paso el objeto queda guardado con su tipo correcto.
   */
  const supabase = createClient();
  // El archivo entero, con el mismo cuidado: los primeros 12 bytes pueden venir
  // de un cache y el resto no.
  let bytes: ArrayBuffer;
  try {
    bytes = await conTimeout(file.arrayBuffer(), TIMEOUT_MS, "leer el archivo entero");
  } catch {
    return {
      ok: false,
      reason:
        "No pudimos leer el archivo entero desde tu computadora. Suele pasar cuando está en Google Drive o iCloud y no está descargado: abrilo una vez y volvé a elegirlo.",
    };
  }
  const blob = new Blob([bytes], { type: mime });
  const { error } = await conTimeout(
    supabase.storage
      .from(CV_BUCKET)
      .uploadToSignedUrl(permiso.path, permiso.token, blob, { contentType: mime }),
    TIMEOUT_MS,
    "la subida del archivo",
  );
  if (error) {
    return {
      ok: false,
      reason: `No se pudo subir el CV (${error.message.slice(0, 120)}). Podés anotarte igual: escribí tu nombre y tu mail.`,
    };
  }

  return { ok: true, cv: { path: permiso.path, firma: permiso.firma, mime } };
}
