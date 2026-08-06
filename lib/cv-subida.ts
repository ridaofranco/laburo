"use server";

/**
 * Permiso de subida directa del CV: el navegador sube el archivo A SUPABASE, no
 * a Vercel.
 *
 * EL PROBLEMA QUE RESUELVE. Hasta el 6/8 el CV viajaba dos veces por una función
 * de Vercel: adentro de un Server Action para guardarlo, y en base64 para
 * leerlo. Los dos caminos chocaban contra topes de infraestructura (4 MB el
 * Server Action, 4,5 MB el body de la función) que terminaban en pantalla como
 * "no pudimos leer el CV" y "no te deja enviar". Con esto el archivo va derecho
 * al bucket y por Vercel pasa el nombre del objeto: unos 200 bytes. Los dos
 * topes dejan de existir, no se corren de lugar.
 *
 * CÓMO. Supabase emite una URL de subida firmada para un path puntual, de un
 * solo uso y con vencimiento corto. El navegador sube contra esa URL con la
 * clave anon; el bucket sigue privado y nadie gana permiso de escritura general.
 * El path vuelve FIRMADO por el servidor (ver lib/cv-firma.ts) para que después
 * `/api/parse-cv`, que es pública, lea solamente lo que este servidor emitió.
 */

import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CV_BUCKET, CV_MAX_BYTES } from "@/lib/cv";
import { firmarPathCv } from "@/lib/cv-firma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export interface PermisoSubidaCv {
  ok: boolean;
  reason?: string;
  /** Path dentro del bucket. */
  path?: string;
  /** Token de la URL firmada, para `uploadToSignedUrl`. */
  token?: string;
  /** Firma del path: hay que devolvérsela al servidor al guardar o al leer. */
  firma?: string;
}

/**
 * Pide permiso para subir un CV. No recibe el archivo: solo su tamaño y su
 * nombre, para poder rebotar temprano y para armar un path legible.
 */
export async function pedirSubidaCv(
  tamano: number,
  nombreArchivo: string,
): Promise<PermisoSubidaCv> {
  if (!Number.isFinite(tamano) || tamano <= 0) {
    return { ok: false, reason: "Elegí un archivo." };
  }
  if (tamano > CV_MAX_BYTES) {
    return {
      ok: false,
      reason: `El CV no puede pesar más de ${Math.round(CV_MAX_BYTES / 1024 / 1024)} MB.`,
    };
  }

  // Esta acción la puede llamar cualquiera (el registro es público). El freno es
  // por si alguien la usa para llenar el bucket de basura; una persona que se
  // anota la llama una vez, dos si se equivocó de archivo.
  const ip = await clientIp();
  if (!rateLimit(`cv-subida:${ip}`, 10, 60_000).ok) {
    return { ok: false, reason: "Esperá un minuto y volvé a intentar." };
  }
  if (!rateLimit(`cv-subida:hora:${ip}`, 40, 3_600_000).ok) {
    return { ok: false, reason: "Demasiadas subidas desde esta conexión. Probá más tarde." };
  }

  // El nombre original se limpia y se acorta: entra al path solo para que Franco
  // reconozca el archivo cuando lo abre, no cumple ninguna función.
  const safe = (nombreArchivo || "cv").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${Date.now()}_${randomUUID().slice(0, 8)}_${safe}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from(CV_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[cv-subida] createSignedUploadUrl falló:", error?.message);
    return { ok: false, reason: "No se pudo preparar la subida del CV. Probá de nuevo." };
  }

  return { ok: true, path, token: data.token, firma: firmarPathCv(path) };
}
