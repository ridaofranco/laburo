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

export async function subirCvDirecto(file: File): Promise<ResultadoSubida> {
  // El tipo se decide por los primeros bytes, nunca por file.type: cuando el
  // archivo llega al teléfono por WhatsApp o Drive, el navegador lo reporta
  // vacío y un PDF perfecto quedaba afuera sin intentar.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
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

  const permiso = await pedirSubidaCv(file.size, file.name);
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
  const blob = new Blob([await file.arrayBuffer()], { type: mime });
  const { error } = await supabase.storage
    .from(CV_BUCKET)
    .uploadToSignedUrl(permiso.path, permiso.token, blob, { contentType: mime });
  if (error) {
    return { ok: false, reason: "No se pudo subir el CV. Revisá tu conexión y probá de nuevo." };
  }

  return { ok: true, cv: { path: permiso.path, firma: permiso.firma, mime } };
}
