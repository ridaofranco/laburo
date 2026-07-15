"use server";

/**
 * Firma server-side del CV de bucket (PERF-02 / T-02-14/15/16).
 *
 * Orden estricto:
 *  1. Verificar que el caller es MIEMBRO (staff_app_my_membership via su JWT,
 *     RLS-scoped); un no-miembro NUNCA obtiene una URL, ni llamando la action
 *     directo (T-02-16).
 *  2. Recién ahí firmar con el cliente service-role (server-only) contra el
 *     bucket privado staff-cvs, TTL 60s.
 *
 * La service-role key vive SOLO acá (via lib/supabase/admin.ts, env server-only);
 * al cliente vuelve únicamente el string de la URL firmada de vida corta.
 * Q2 resuelto: firmar con service-role tras el check de membresía evita tocar
 * las storage policies del bucket compartido.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const CV_BUCKET = "staff-cvs";
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Devuelve una signed URL de 60s para una object key del bucket staff-cvs,
 * o null si el objeto no existe / no se pudo firmar (el caller muestra el
 * estado dead-link, nunca crashea).
 * @throws Error("forbidden") si el caller no es miembro.
 */
export async function signCv(objectKey: string): Promise<string | null> {
  const supabase = await createClient();

  // 1. Gate de membresía (D-06): la vista devuelve 0 filas para no-miembros.
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();

  if (!membership) throw new Error("forbidden");

  // 2. Firmar con service-role, server-only, TTL corta.
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(CV_BUCKET)
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
