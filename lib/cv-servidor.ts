import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CV_BUCKET, CV_MAX_BYTES, sniffCvMime } from "@/lib/cv";
import { verificarFirmaCv } from "@/lib/cv-firma";

/**
 * Lo que hace el servidor con un CV que subió el navegador por su cuenta.
 *
 * La subida directa saca el archivo del camino de Vercel, pero no puede sacar la
 * verificación: la URL firmada de Supabase deja al navegador elegir el
 * `contentType`, así que el servidor no puede creerle. Igual que en el camino
 * viejo, el tipo real se decide mirando los primeros bytes.
 */

export interface CvVerificado {
  ok: true;
  /** El valor que se guarda en `cv_url`: `staff-cvs/<path>`. */
  cvUrl: string;
  /** El MIME real, sacado de los magic bytes. */
  mime: string;
  /** El archivo entero, para que quien ya lo bajó no lo baje dos veces. */
  bytes: Uint8Array;
}

export type CvVerificacion = CvVerificado | { ok: false; reason: string };

/**
 * Baja el objeto recién subido, comprueba que lo haya emitido este servidor y
 * que sea de verdad un PDF o una imagen. Devuelve también los bytes, porque el
 * lector de CV los necesita justo después y bajarlo dos veces sería al pedo.
 */
export async function verificarCvSubido(
  path: unknown,
  firma: unknown,
): Promise<CvVerificacion> {
  if (typeof path !== "string" || !path || path.includes("..") || path.startsWith("/")) {
    return { ok: false, reason: "El CV no se subió bien. Probá de nuevo." };
  }
  // Solo leemos paths que emitió este servidor. Ver lib/cv-firma.ts.
  if (!verificarFirmaCv(path, firma)) {
    return { ok: false, reason: "El CV no se subió bien. Probá de nuevo." };
  }

  const admin = createServiceRoleClient();
  const { data: blob, error } = await admin.storage.from(CV_BUCKET).download(path);
  if (error || !blob) {
    return { ok: false, reason: "No encontramos el CV que subiste. Probá de nuevo." };
  }
  if (blob.size > CV_MAX_BYTES) {
    await admin.storage.from(CV_BUCKET).remove([path]);
    return { ok: false, reason: "El CV es muy grande." };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = sniffCvMime(bytes.slice(0, 12));
  if (!mime) {
    // Lo que subieron no es lo que dijeron. No se deja tirado en el bucket.
    await admin.storage.from(CV_BUCKET).remove([path]);
    return { ok: false, reason: "El CV tiene que ser un PDF o una imagen." };
  }

  return { ok: true, cvUrl: `${CV_BUCKET}/${path}`, mime, bytes };
}

/** Borra un objeto del bucket (para no dejar CV huérfanos si algo falla después). */
export async function borrarCvSubido(path: string): Promise<void> {
  try {
    await createServiceRoleClient().storage.from(CV_BUCKET).remove([path]);
  } catch {
    // Un huérfano en el bucket no puede tumbar el registro de una persona.
  }
}
