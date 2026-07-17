"use server";

/**
 * Server action de edición del propio perfil de staff (fork "staff con cuenta").
 * Escribe SOLO campos seguros vía el RPC SECURITY DEFINER
 * staff_app_update_my_staff_profile (0012), que confina el UPDATE a la fila del
 * caller (email verificado). NUNCA toca email/documento/organization_id. El
 * cliente autenticado lleva el JWT; jamás service-role.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface UpdateStaffProfileInput {
  telefono: string;
  provincia: string;
  ciudad: string;
  oficios: string[];
  oficios_otro: string;
  disponibilidad_aviso: string;
  disponibilidad_finde: boolean;
  disponibilidad_viajar: boolean;
  movilidad_propia: boolean;
  experiencia_detalle: string;
  anios_experiencia: string;
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
    p_telefono: input.telefono,
    p_provincia: input.provincia,
    p_ciudad: input.ciudad,
    p_oficios: input.oficios.length ? input.oficios : null,
    p_oficios_otro: input.oficios_otro,
    p_disponibilidad_aviso: input.disponibilidad_aviso,
    p_disponibilidad_finde: input.disponibilidad_finde,
    p_disponibilidad_viajar: input.disponibilidad_viajar,
    p_movilidad_propia: input.movilidad_propia,
    p_experiencia_detalle: input.experiencia_detalle,
    p_anios_experiencia: input.anios_experiencia,
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
