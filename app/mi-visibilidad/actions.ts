"use server";

/**
 * Guardar la respuesta de visibilidad. Sin login: el gate es el token HMAC del
 * link, igual que la baja.
 *
 * ⚠️ El token se valida ANTES de tocar la base. Y la respuesta se escribe con
 * service role porque la persona no tiene sesión ni cuenta: es la misma razón
 * por la que la baja lo hace así.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { visibilidadTokenOk } from "@/lib/visibilidad";

export async function responderVisibilidad(
  profileId: string,
  token: string,
  quiere: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!visibilidadTokenOk(profileId, token)) {
      // Motivo genérico: quien pruebe un token no aprende si la ficha existe.
      return { ok: false, error: "Este link no es válido." };
    }

    // Por RPC, igual que la baja: nada de tocar el esquema directo desde acá.
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("staff_app_set_visibilidad", {
      p_profile_id: profileId,
      p_quiere: quiere,
    });

    if (error) return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
    const r = data as { ok?: boolean } | null;
    if (!r?.ok) return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
}
