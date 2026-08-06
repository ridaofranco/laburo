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
import { classifyCv, CV_BUCKET } from "@/lib/cv";
import { verificarCvSubido } from "@/lib/cv-servidor";
import { getMyStaffProfile } from "@/lib/staff";


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

  // La persona acaba de GUARDAR su perfil: eso es confirmarlo. Se estampa
  // perfil_confirmado_at (migración 0034) para que el recordatorio de perfil
  // incompleto no la persiga. TOLERANTE a propósito: hasta que la 0034 se
  // aplique la RPC no existe y esto solo loguea; el guardado ya salió bien y
  // un fallo acá jamás lo convierte en error.
  try {
    const profile = await getMyStaffProfile();
    if (profile) {
      const admin = createServiceRoleClient();
      const { error: markErr } = await admin.rpc("staff_app_mark_perfil_confirmado", {
        p_profile_id: profile.id,
      });
      if (markErr) {
        console.error(
          "[perfil] mark_perfil_confirmado failed (¿falta aplicar la 0034?):",
          markErr.message,
        );
      }
    }
  } catch (e) {
    console.error(
      "[perfil] mark_perfil_confirmado threw:",
      e instanceof Error ? e.message : String(e),
    );
  }

  revalidatePath("/editar-perfil-staff");
  revalidatePath("/panel-staff");
  return { ok: true };
}

/**
 * Guarda el cv_url del staff apuntando a un CV QUE YA ESTÁ SUBIDO.
 *
 * El archivo ya no viaja por acá: lo subió el navegador derecho a Supabase con
 * una URL firmada (lib/cv-subida.ts) y lo que llega es el nombre del objeto más
 * la firma que acredita que ese path lo emitió este servidor. Eso saca de encima
 * el límite de 4 MB del Server Action, que era el que hacía que "no te deje
 * enviar" sin ningún mensaje. La validación del tipo real por magic bytes sigue
 * pasando, ahora sobre el objeto ya subido (ver lib/cv-servidor.ts).
 */
export async function uploadMyCv(
  cvPath: string,
  cvFirma: string,
): Promise<{ ok: boolean; reason?: string }> {
  // Solo un staff logueado puede subir su CV.
  const profile = await getMyStaffProfile();
  if (!profile) return { ok: false, reason: "No sos staff." };

  const v = await verificarCvSubido(cvPath, cvFirma);
  if (!v.ok) return { ok: false, reason: v.reason };
  const path = cvPath;

  const admin = createServiceRoleClient();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_update_my_cv", {
    p_cv_url: `${CV_BUCKET}/${path}`,
  });
  const res = data as { ok: boolean; reason?: string } | null;
  if (error || !res?.ok) {
    // Borrar el huérfano recién subido si el RPC no persistió el cv_url.
    await admin.storage.from(CV_BUCKET).remove([path]);
    return { ok: false, reason: res?.reason ?? "No se pudo guardar el CV." };
  }

  // Borrar el CV anterior si era un objeto del bucket (no un link de Drive) y es
  // distinto del nuevo, para no acumular archivos muertos.
  const prev = classifyCv(profile.cv_url);
  if (prev.kind === "bucket" && prev.key && prev.key !== path) {
    await admin.storage.from(CV_BUCKET).remove([prev.key]);
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
