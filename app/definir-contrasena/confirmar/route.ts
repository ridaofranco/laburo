import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Canje del link que llega por mail para DEFINIR LA CONTRASEÑA.
 *
 * El mail de Supabase (plantilla "Reset Password", la que está en
 * supabase/email-templates/definir-contrasena.html) apunta acá con un `code`.
 * Este handler lo canjea por sesión y manda a la pantalla del formulario.
 *
 * ── POR QUÉ UN ROUTE HANDLER Y NO LA PÁGINA DIRECTO ──
 * El canje ESCRIBE cookies de sesión, y un Server Component de Next no puede
 * escribir cookies: el `setAll` del cliente de Supabase se traga el error en
 * silencio (está comentado en lib/supabase/server.ts). O sea que si se canjeara
 * dentro de la página, la sesión no quedaría guardada y la persona vería el form
 * pero al guardar le diría que no está logueada, sin ninguna pista de por qué.
 * Es el mismo patrón que ya usa /auth/callback.
 *
 * Los errores mandan a /acceso-staff con un motivo, porque el caso más común es
 * de verdad frecuente: el link ya se usó, o venció. Mandar a una pantalla muda
 * deja a la persona sin saber qué hacer.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase avisa acá cuando el link venció o ya se usó.
  const errorCode = searchParams.get("error_code") || searchParams.get("error");
  if (errorCode) {
    return NextResponse.redirect(`${origin}/acceso-staff?motivo=link_vencido`);
  }

  const supabase = await createClient();

  // ── DOS FORMATOS DE LINK, PORQUE HAY DOS CAMINOS PARA LLEGAR ACÁ ──
  //
  // `code`       → lo pone resetPasswordForEmail, o sea el botón "es mi primera
  //                vez / no me acuerdo la contraseña" de /acceso-staff.
  // `token_hash` → lo genera admin.generateLink en el registro, que es el link
  //                que ahora viaja DENTRO de nuestro mail de bienvenida.
  //
  // Se aceptan los dos a propósito y no se migra uno al otro: los mails ya
  // enviados siguen circulando en casillas reales y tienen que seguir andando.
  const tokenHash = searchParams.get("token_hash");
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) {
      return NextResponse.redirect(`${origin}/acceso-staff?motivo=link_vencido`);
    }
    return NextResponse.redirect(`${origin}/definir-contrasena`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/acceso-staff?motivo=link_invalido`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/acceso-staff?motivo=link_vencido`);
  }

  return NextResponse.redirect(`${origin}/definir-contrasena`);
}
