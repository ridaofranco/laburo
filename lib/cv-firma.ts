import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma de los paths de CV recién subidos.
 *
 * POR QUÉ EXISTE ESTO. Con la subida directa a Supabase, el navegador ya no le
 * manda el archivo a la función: le manda el NOMBRE del objeto en el bucket. Eso
 * es lo que saca los límites de tamaño, pero abre una puerta: `/api/parse-cv` es
 * una ruta PÚBLICA, así que sin nada más cualquiera podría pasarle el path del
 * CV de otra persona y hacer que se lo lean. Los paths llevan un componente al
 * azar y no son adivinables, pero "difícil de adivinar" no es un permiso.
 *
 * Entonces el servidor firma el path cuando lo emite, y solo lee lo que él mismo
 * firmó. Es sin estado (no hay nada que guardar ni que expirar en una tabla) y
 * no agrega ninguna variable de entorno nueva: la clave es la service-role, que
 * ya existe, vive solo en el servidor y nunca sale de ahí. Un HMAC no la expone.
 */

function clave(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para firmar el CV.");
  return k;
}

/** Firma un path de CV. Lo que se le entrega al navegador junto con el path. */
export function firmarPathCv(path: string): string {
  return createHmac("sha256", clave()).update(`cv:${path}`).digest("hex");
}

/**
 * Verifica que ese path lo haya emitido este servidor.
 * Comparación en tiempo constante: comparar hashes con `===` filtra, byte a
 * byte, cuánto de la firma acertaste.
 */
export function verificarFirmaCv(path: string, firma: unknown): boolean {
  if (typeof firma !== "string" || firma.length === 0) return false;
  const esperada = Buffer.from(firmarPathCv(path), "utf8");
  const recibida = Buffer.from(firma, "utf8");
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}
