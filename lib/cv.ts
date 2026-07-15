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
