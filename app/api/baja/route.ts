/**
 * One-click unsubscribe (RFC 8058) para la baja del pool de LABURO.
 *
 * Gmail y Outlook muestran su propio botón "Cancelar suscripción" arriba del mail
 * cuando ven los headers List-Unsubscribe + List-Unsubscribe-Post (los pone
 * lib/baja.ts). Al apretarlo, el cliente de correo pega un POST acá, sin abrir
 * ninguna pantalla, y espera un 2xx. Si no existiera este endpoint, el botón del
 * cliente fallaría y la persona terminaría marcando el mail como spam, que es lo
 * que de verdad quema el dominio.
 *
 * SOLO POST. El GET NO da de baja a nadie: los prefetchers de Gmail y de WhatsApp
 * abren los links de los mails para armar la preview, así que un GET mutante daría
 * de baja media tanda sin que nadie lo pida. El GET redirige a la página, que
 * muestra el formulario.
 *
 * El gate es el token HMAC del link (lib/baja.ts), no una sesión: quien llega no
 * tiene cuenta. Sin token válido, 400 y no se toca nada.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { bajaTokenOk } from "@/lib/baja";
import { alerta } from "@/lib/alerta";
import { avisoBajaAdmin, leerFichaParaAviso } from "@/lib/baja-aviso";

export const dynamic = "force-dynamic";

/** GET: no muta. Manda a la pantalla con el formulario. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const p = searchParams.get("p") ?? "";
  const t = searchParams.get("t") ?? "";
  return NextResponse.redirect(
    `${origin}/baja?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}`,
  );
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = searchParams.get("p") ?? "";
  const t = searchParams.get("t") ?? "";

  if (!bajaTokenOk(p, t)) {
    return NextResponse.json({ ok: false, error: "token" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  // El nombre se lee ANTES de la baja: apenas la RPC marca baja_at, la ficha
  // desaparece de la vista y ya no hay de dónde sacarlo (ver lib/baja-aviso).
  const ficha = await leerFichaParaAviso(supabase, p);
  const { data, error } = await supabase.rpc("staff_app_set_baja", {
    p_id: p,
    p_motivo: null,
    p_baja: true,
  });

  if (error) {
    console.error("[api/baja] rpc failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // 200 aunque la fila no exista: al cliente de correo hay que contestarle 2xx o
  // le muestra un error a la persona. Si data es false, queda en los logs.
  if (data !== true) {
    console.warn("[api/baja] token válido pero la ficha no existe:", p);
  } else {
    // AVISO DE BAJA: mail dedicado al admin, uno POR baja, con el nombre (el
    // one-click no trae motivo: el cliente de correo pega el POST sin pantalla).
    // Sin dedupe a propósito: varias bajas en pocos días son la señal más honesta
    // sobre el último mail que salió, y cada una es un dato. Telegram va aparte
    // por alerta, sinMail para no duplicar con el mail genérico.
    await avisoBajaAdmin({ profileId: p, ficha, motivo: null, origen: "one-click" });
    await alerta({
      titulo: "Alguien pidió la baja del pool",
      datos: { ficha: p },
      detalle: "El detalle con nombre salió por mail a MAIL_ADMIN_TO. Vino por el one-click del cliente de correo (sin motivo).",
      clave: "baja-pool",
      sinMail: true,
    });
  }
  return NextResponse.json({ ok: true });
}
