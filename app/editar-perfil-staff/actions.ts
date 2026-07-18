"use server";

/**
 * Server actions del perfil de staff (fork "staff con cuenta"):
 *  - updateMyStaffProfile: guarda TODOS los campos del formulario de postulación
 *    (RPC staff_app_update_my_staff_profile v2, scoped por email).
 *  - uploadMyCv: sube el archivo de CV al bucket privado staff-cvs (service-role,
 *    server-only) y guarda el cv_url del propio staff (RPC update_my_cv).
 *  - signMyStaffCv: firma/clasifica el CV propio para verlo (bucket → signed URL
 *    60s; drive → preview). Nunca expone la service-role al cliente.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { classifyCv } from "@/lib/cv";
import { getMyStaffProfile } from "@/lib/staff";

const CV_BUCKET = "staff-cvs";

export interface UpdateStaffProfileInput {
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string;
  fecha_nacimiento: string | null;
  pais_residencia: string;
  provincia: string;
  ciudad: string;
  donde_trabajar: string[];
  situacion_legal: string;
  oficios: string[];
  oficios_otro: string;
  experiencia: boolean | null;
  anios_experiencia: string;
  experiencia_detalle: string;
  disponibilidad_finde: boolean;
  disponibilidad_viajar: boolean;
  movilidad_propia: boolean;
  disponibilidad_aviso: string;
  linkedin_url: string;
  portfolio_url: string;
  motivacion: string;
}

export async function updateMyStaffProfile(
  input: UpdateStaffProfileInput,
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "No hay sesión activa." };

  const { data, error } = await supabase.rpc("staff_app_update_my_staff_profile", {
    p_nombre: input.nombre,
    p_apellido: input.apellido,
    p_telefono: input.telefono,
    p_documento: input.documento,
    p_fecha_nacimiento: input.fecha_nacimiento,
    p_pais_residencia: input.pais_residencia,
    p_provincia: input.provincia,
    p_ciudad: input.ciudad,
    p_donde_trabajar: input.donde_trabajar,
    p_situacion_legal: input.situacion_legal,
    p_oficios: input.oficios,
    p_oficios_otro: input.oficios_otro,
    p_experiencia: input.experiencia,
    p_anios_experiencia: input.anios_experiencia,
    p_experiencia_detalle: input.experiencia_detalle,
    p_disponibilidad_finde: input.disponibilidad_finde,
    p_disponibilidad_viajar: input.disponibilidad_viajar,
    p_movilidad_propia: input.movilidad_propia,
    p_disponibilidad_aviso: input.disponibilidad_aviso,
    p_linkedin_url: input.linkedin_url,
    p_portfolio_url: input.portfolio_url,
    p_motivacion: input.motivacion,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? error?.message ?? "No se pudo guardar." };
  }
  revalidatePath("/editar-perfil-staff");
  revalidatePath("/panel-staff");
  return { ok: true };
}

/** Sube el CV al bucket privado y guarda el cv_url del staff. */
export async function uploadMyCv(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, reason: "Elegí un archivo." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, reason: "El archivo es muy grande (máximo 10MB)." };
  }

  // Solo un staff logueado puede subir su CV.
  const profile = await getMyStaffProfile();
  if (!profile) return { ok: false, reason: "No sos staff." };

  const admin = createServiceRoleClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${profile.id}_${Date.now()}_${safe}`;
  const { error: upErr } = await admin.storage
    .from(CV_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { ok: false, reason: "No se pudo subir el archivo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_update_my_cv", {
    p_cv_url: `${CV_BUCKET}/${path}`,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    return { ok: false, reason: res?.reason ?? "No se pudo guardar el CV." };
  }
  revalidatePath("/editar-perfil-staff");
  return { ok: true };
}

/** Firma / clasifica el CV propio para verlo (bucket → signed URL; drive → preview). */
export async function signMyStaffCv(): Promise<{
  kind: "bucket" | "drive" | "none";
  url: string | null;
  open: string | null;
}> {
  const profile = await getMyStaffProfile();
  if (!profile) return { kind: "none", url: null, open: null };
  const c = classifyCv(profile.cv_url);
  if (c.kind === "drive") return { kind: "drive", url: c.preview, open: c.open };
  if (c.kind === "bucket") {
    const admin = createServiceRoleClient();
    const { data } = await admin.storage.from(CV_BUCKET).createSignedUrl(c.key, 60);
    return { kind: "bucket", url: data?.signedUrl ?? null, open: data?.signedUrl ?? null };
  }
  return { kind: "none", url: null, open: null };
}
