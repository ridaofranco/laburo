/**
 * Clasificador de CV (PERF-02 / RESEARCH Pattern 4).
 *
 * El pool tiene CVs de dos orígenes:
 *  - 678 links de Google Drive (`drive.google.com/open?id=…` o `/file/d/…`) →
 *    se abren en pestaña nueva usando la sesión de Google de Franco; iframe
 *    `/preview` best-effort.
 *  - 9 objetos del bucket privado `staff-cvs` → signed URL de TTL corta firmada
 *    server-side (ver cv-actions.ts).
 *
 * A3 (verificado en vivo 2026-07-15, proyecto luillpzfqzbpoqkgvjuw):
 *  - 8 de los 9 `cv_url` de bucket guardan el path CON el prefijo del nombre del
 *    bucket, p.ej. `staff-cvs/1782713556134_..._CV_ENG.pdf`.
 *  - 1 es un nombre pelado sin prefijo (`Screenshot_..._Sabrina Luana Soler.jpg`)
 *    y además su objeto NO existe en el bucket → ejercita el estado dead-link.
 *  `storage.from('staff-cvs').createSignedUrl(key)` espera la key RELATIVA al
 *  bucket, así que `classifyCv` normaliza sacando el prefijo `staff-cvs/`.
 */

export type CvClassification =
  | { kind: "none" }
  | { kind: "drive"; id: string; preview: string; open: string }
  | { kind: "bucket"; key: string };

/**
 * Detecta el MIME real de un CV por sus magic bytes (primeros ~12 bytes), sin
 * confiar en file.type (que el cliente puede falsear). Devuelve el MIME si es un
 * formato permitido (PDF / PNG / JPEG / WebP), o null si no lo reconoce.
 * Server-side: recibe los primeros bytes del archivo como Uint8Array.
 */
export function sniffCvMime(bytes: Uint8Array): string | null {
  // %PDF
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  // PNG \x89PNG
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  // JPEG \xFF\xD8\xFF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** True si el string es una URL http(s) absoluta (para separar links reales de texto libre). */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Clasifica un `cv_url` en Drive / bucket / none.
 * - Drive: extrae el id y arma `/file/d/<id>/preview` (iframe best-effort) y
 *   `open?id=<id>` (pestaña nueva confiable).
 * - Bucket: normaliza a la object key (saca el prefijo `staff-cvs/` si está).
 * - none: null/vacío.
 */
export function classifyCv(cvUrl: string | null | undefined): CvClassification {
  if (!cvUrl || !cvUrl.trim()) return { kind: "none" };
  const url = cvUrl.trim();

  const drive = url.match(/(?:open\?id=|\/file\/d\/)([\w-]+)/);
  if (drive) {
    const id = drive[1];
    return {
      kind: "drive",
      id,
      preview: `https://drive.google.com/file/d/${id}/preview`,
      open: `https://drive.google.com/open?id=${id}`,
    };
  }

  // Objeto de bucket. Normalizar a la key relativa al bucket (A3).
  const key = url.replace(/^staff-cvs\//, "");
  return { kind: "bucket", key };
}
