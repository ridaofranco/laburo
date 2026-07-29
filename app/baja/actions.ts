"use server";

/**
 * Acciones de la baja del pool ("no quiero formar parte").
 *
 * Las dos validan el token HMAC del link ANTES de tocar la base, y las dos usan
 * el cliente service-role porque la persona no tiene sesión (llega desde el pie
 * de un mail) y la RPC está granteada solo a service_role.
 *
 * NUNCA por GET: los prefetchers de Gmail y de WhatsApp abren los links de un
 * mail para armar la preview. Si la baja se hiciera con un GET, media tanda
 * quedaría dada de baja sola. La página solo muestra el formulario; el cambio de
 * estado pasa por estos POST.
 */

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { bajaTokenOk } from "@/lib/baja";
import { alerta } from "@/lib/alerta";
import { avisoBajaAdmin, leerFichaParaAviso } from "@/lib/baja-aviso";

async function setBaja(
  profileId: string,
  token: string,
  baja: boolean,
  motivo?: string,
): Promise<boolean> {
  if (!bajaTokenOk(profileId, token)) return false;
  const supabase = createServiceRoleClient();
  // El nombre se lee ANTES de la baja: apenas la RPC marca baja_at, la ficha
  // desaparece de la vista y ya no hay de dónde sacarlo (ver lib/baja-aviso).
  const ficha = baja ? await leerFichaParaAviso(supabase, profileId) : null;
  const { data, error } = await supabase.rpc("staff_app_set_baja", {
    p_id: profileId,
    p_motivo: motivo?.trim() ? motivo.trim() : null,
    p_baja: baja,
  });
  if (error) {
    console.error("[baja] rpc failed:", error.message);
    return false;
  }
  // Aviso solo cuando es una BAJA de verdad (no cuando alguien vuelve al pool).
  if (data === true && baja) {
    // Mail dedicado al admin, uno POR baja, con nombre y motivo (sin dedupe:
    // cada baja es un dato). Telegram va aparte por alerta, sinMail para no
    // mandar el mail genérico de "algo se rompió" encima del dedicado.
    await avisoBajaAdmin({
      profileId,
      ficha,
      motivo,
      origen: "formulario",
    });
    await alerta({
      titulo: "Alguien pidió la baja del pool",
      datos: { ficha: profileId, motivo: motivo?.trim() || "(no dejó motivo)" },
      detalle: "El detalle con nombre y motivo salió por mail a MAIL_ADMIN_TO.",
      clave: "baja-pool",
      sinMail: true,
    });
  }
  return data === true;
}

/** Dar de baja: sale del pool y de todos los envíos. */
export async function darDeBaja(formData: FormData) {
  const p = String(formData.get("p") ?? "");
  const t = String(formData.get("t") ?? "");
  const motivo = String(formData.get("motivo") ?? "");
  const ok = await setBaja(p, t, true, motivo);
  redirect(
    ok
      ? `/baja?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}&estado=baja`
      : `/baja?estado=error`,
  );
}

/** Volver al pool, para el que se arrepintió o se dio de baja sin querer. */
export async function volverAlPool(formData: FormData) {
  const p = String(formData.get("p") ?? "");
  const t = String(formData.get("t") ?? "");
  const ok = await setBaja(p, t, false);
  redirect(
    ok
      ? `/baja?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}&estado=alta`
      : `/baja?estado=error`,
  );
}
