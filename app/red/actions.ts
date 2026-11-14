"use server";

/**
 * Acciones de los links del mail de invitación a la red (0108/0110).
 * Solo por POST: los prefetchers de Gmail y WhatsApp abren los links del mail,
 * y con un GET que cambia algo, media tanda quedaría dada de baja sola.
 * El token es el baja_token del perfil (32 hex, uno por perfil, único).
 */

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const TOKEN_OK = /^[a-f0-9]{32}$/;

export async function accionRed(formData: FormData) {
  const t = String(formData.get("t") ?? "");
  const a = String(formData.get("a") ?? "");
  if (!TOKEN_OK.test(t) || (a !== "baja" && a !== "precios")) redirect("/red?estado=invalido");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc(
    a === "baja" ? "staff_app_red_baja" : "staff_app_red_aceptar_precios",
    { p_token: t },
  );
  const ok = !error && (data as { ok?: boolean } | null)?.ok === true;
  if (error) console.error("[red] rpc failed:", error.message);
  redirect(`/red?estado=${ok ? `${a}-ok` : "invalido"}`);
}
