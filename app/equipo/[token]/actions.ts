"use server";

import { createClient } from "@/lib/supabase/server";

const MENSAJES: Record<string, string> = {
  sin_sesion: "Entrá con tu cuenta y volvé a apretar el botón.",
  no_existe: "Este link no es válido.",
  revocada: "La productora canceló esta invitación.",
  aceptada: "Esta invitación ya la usaste. Entrá con tu cuenta.",
  ya_aceptada: "Esta invitación ya la usaste. Entrá con tu cuenta.",
  vencida: "Esta invitación venció. Pedile a la productora que te invite de nuevo.",
};

export async function aceptarInvitacion(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_aceptar_invitacion_miembro", {
    p_token: token,
  });
  if (error) {
    console.error("[equipo] aceptar falló:", error.message);
    return { ok: false, error: "No pudimos sumarte. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string; esperado?: string } | null;
  if (r?.ok) return { ok: true };

  // ⚠️ El caso de "otro mail" se explica con la dirección esperada, si no la
  // persona no tiene forma de saber por qué le rebota.
  if (r?.reason === "otro_mail") {
    return {
      ok: false,
      error: `Esta invitación es para ${r.esperado ?? "otra dirección"}. Salí y entrá con esa cuenta.`,
    };
  }
  return { ok: false, error: MENSAJES[r?.reason ?? ""] ?? "No pudimos sumarte al equipo." };
}
