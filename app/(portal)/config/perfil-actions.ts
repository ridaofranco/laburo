"use server";

/**
 * El perfil de la productora, editable.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Hasta el 7/9/2026 esta tarjeta decía "SOLO LECTURA" y mostraba, para TODA
 * productora, un texto escrito a mano en la pantalla:
 *
 *   "Producción de eventos. LABURO es la herramienta para buscar, contratar y
 *    coordinar staff eventual sobre el pool real de postulantes."
 *
 * O sea que FIEBRE DISCO entraba a SU perfil y leía una descripción de LABURO.
 * Franco: *"El perfil de la agencia también debería ser posible editarlo porque
 * además podrían ofrecerse como una productora más que brinda servicios"*.
 *
 * ⚠️ `p_org` VIAJA SIEMPRE. Sin él la RPC resuelve con la organización por
 * defecto, y quien es miembro de dos productoras termina editando la que no
 * eligió en el selector. Es el mismo cuidado que el resto del módulo.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirOrg } from "@/lib/org";

export interface PerfilOrg {
  id: string;
  name: string;
  descripcion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  web: string | null;
  instagram: string | null;
  telefono: string | null;
  categoria: string | null;
  puede_editar: boolean;
}

/** Lee el perfil de la organización elegida. `null` si no hay o no es miembro. */
export async function leerPerfil(): Promise<PerfilOrg | null> {
  const supabase = await createClient();
  const org = await exigirOrg();
  const { data, error } = await supabase.rpc("staff_app_perfil_org", {
    p_org: org.organizationId,
  });
  if (error) {
    console.error("[config] no se pudo leer el perfil:", error.message);
    return null;
  }
  return (data as PerfilOrg | null) ?? null;
}

const MENSAJES: Record<string, string> = {
  no_org: "No encontramos tu organización.",
  forbidden: "No tenés permiso para editar el perfil de esta organización.",
  descripcion_larga: "La descripción es muy larga: máximo 600 caracteres.",
  org_no_encontrada: "No encontramos tu organización.",
};

export async function guardarPerfil(
  formData: FormData,
): Promise<{ ok: true; perfil: PerfilOrg } | { ok: false; error: string }> {
  const supabase = await createClient();
  const org = await exigirOrg();

  const t = (k: string) => String(formData.get(k) ?? "").trim();

  const { data, error } = await supabase.rpc("staff_app_guardar_perfil_org", {
    p_descripcion: t("descripcion"),
    p_ciudad: t("ciudad"),
    p_provincia: t("provincia"),
    p_pais: t("pais"),
    p_web: t("web"),
    p_instagram: t("instagram"),
    p_telefono: t("telefono"),
    p_org: org.organizationId,
  });

  if (error) {
    console.error("[config] no se pudo guardar el perfil:", error.message);
    return { ok: false, error: "No pudimos guardar los cambios. Probá de nuevo." };
  }

  const r = data as { ok?: boolean; reason?: string; organizacion?: PerfilOrg } | null;
  if (!r?.ok) {
    return { ok: false, error: MENSAJES[r?.reason ?? ""] ?? "No pudimos guardar los cambios." };
  }

  // La tarjeta de Ajustes y el encabezado del portal leen estos datos.
  revalidatePath("/config");
  return { ok: true, perfil: r.organizacion as PerfilOrg };
}
