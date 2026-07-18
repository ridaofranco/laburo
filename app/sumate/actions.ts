"use server";

/**
 * Registro nativo de staff en la plataforma (arista "registro para trabajar").
 * Escribe al MISMO pool que somosder.ar llamando el MISMO RPC SECURITY DEFINER
 * public.staff_app_register_applicant (anon). Si adjuntan CV, se sube al bucket
 * privado staff-cvs con service-role (server-only) y se guarda el path como cv_url.
 * Un solo producto, dos aristas: el registro entra igual desde la web o desde acá.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const CV_BUCKET = "staff-cvs";

export interface RegisterInput {
  nombre: string;
  apellido: string;
  email: string;
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

export async function registerApplicant(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, reason: "Datos inválidos." };
  let input: RegisterInput;
  try {
    input = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Datos inválidos." };
  }
  if (!input.nombre?.trim() || !input.email?.trim()) {
    return { ok: false, reason: "Nombre y email son obligatorios." };
  }

  // CV opcional → bucket privado (service-role).
  let cvUrl: string | null = null;
  const file = formData.get("cv");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { ok: false, reason: "El CV es muy grande (máx 10MB)." };
    const admin = createServiceRoleClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await admin.storage
      .from(CV_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (!error) cvUrl = `${CV_BUCKET}/${path}`;
  }

  // Mismo RPC que la web. createClient sin sesión = cliente anon (RPC granteado a anon).
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_app_register_applicant", {
    p_nombre: input.nombre.trim(),
    p_apellido: input.apellido.trim() || null,
    p_email: input.email.trim(),
    p_telefono: input.telefono.trim() || null,
    p_documento: input.documento.trim() || null,
    p_fecha_nacimiento: input.fecha_nacimiento,
    p_pais_residencia: input.pais_residencia.trim() || null,
    p_provincia: input.provincia.trim() || null,
    p_ciudad: input.ciudad.trim() || null,
    p_donde_trabajar: input.donde_trabajar.length ? input.donde_trabajar : null,
    p_situacion_legal: input.situacion_legal.trim() || null,
    p_oficios: input.oficios.length ? input.oficios : null,
    p_oficios_otro: input.oficios_otro.trim() || null,
    p_experiencia: input.experiencia,
    p_anios_experiencia: input.anios_experiencia.trim() || null,
    p_experiencia_detalle: input.experiencia_detalle.trim() || null,
    p_disponibilidad_finde: input.disponibilidad_finde,
    p_disponibilidad_viajar: input.disponibilidad_viajar,
    p_movilidad_propia: input.movilidad_propia,
    p_disponibilidad_aviso: input.disponibilidad_aviso.trim() || null,
    p_cv_url: cvUrl,
    p_portfolio_url: input.portfolio_url.trim() || null,
    p_linkedin_url: input.linkedin_url.trim() || null,
    p_motivacion: input.motivacion.trim() || null,
  });
  if (error) return { ok: false, reason: "No se pudo enviar el registro. Probá de nuevo." };
  return { ok: true };
}
