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
    // AVISO DE BAJA. Una sola baja no dice nada; varias en pocos días son la señal
    // más honesta que vamos a tener sobre el último mail que salió. Sin este aviso
    // quedaba registrado en la base y nadie lo miraba.
    // Se usa la MISMA clave de anti-repetición para todas, así una tanda de bajas
    // manda un aviso y no cincuenta.
    await alerta({
      titulo: "Alguien pidió la baja del pool",
      datos: { ficha: p },
      detalle: "Si se repite en pocos días, mirá qué mail salió último. El motivo que dejó la persona está en baja_motivo.",
      clave: "baja-pool",
    });
  }
  return NextResponse.json({ ok: true });
}
