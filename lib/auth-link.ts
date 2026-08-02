import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

/**
 * EL LINK PARA QUE ALGUIEN ELIJA SU CONTRASEÑA, generado sin mandar ningún mail.
 *
 * ── POR QUÉ VIVE ACÁ Y NO ADENTRO DE UNA PANTALLA ────────────────────────────
 * Lo usan el alta de staff (/sumate) y el alta de productora
 * (/registrar-productora). Nació adentro de sumate/actions.ts, y el 1/8 quedó
 * clarísimo lo que pasa cuando algo así se copia en vez de compartirse: el botón
 * de Google se arregló del lado del staff y el del productor quedó roto. Franco:
 * "lo que hacés para empleados no lo hacés para productores".
 *
 * ── POR QUÉ generateLink Y NO resetPasswordForEmail ──────────────────────────
 * `resetPasswordForEmail` manda SU PROPIO mail, con la plantilla de Supabase que
 * Franco ya había señalado como "parece phishing". `generateLink` DEVUELVE el
 * token sin mandar nada, así el link viaja adentro de nuestro mail, con nuestra
 * marca. Un mail, un click.
 *
 * ── POR QUÉ NUNCA UNA CONTRASEÑA ARMADA POR NOSOTROS ─────────────────────────
 * Era la idea original de Franco y el resultado para la persona sería el mismo,
 * pero una contraseña escrita en un mail queda en su casilla para siempre, la ve
 * cualquiera que le mire el teléfono, y cuando la pierda no hay de dónde
 * recuperarla. Con el link, la elige la persona y nunca viaja una clave.
 *
 * Devuelve null si algo falla. El que llama TIENE que seguir andando igual: un
 * problema de auth nunca puede voltear un alta que ya se guardó.
 */
export async function linkParaElegirContrasena(
  admin: SupabaseClient,
  email: string,
  etiqueta = "auth-link",
): Promise<string | null> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return null;

  try {
    // Si ya tiene cuenta, createUser falla y seguimos igual: lo único que
    // importa es que exista antes de generar el link.
    await admin.auth.admin
      .createUser({ email: limpio, email_confirm: true })
      .catch(() => undefined);

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: limpio,
    });
    if (error) {
      console.error(`[${etiqueta}] generateLink falló:`, error.message);
      return null;
    }
    const hashed = data?.properties?.hashed_token;
    if (!hashed) {
      console.error(`[${etiqueta}] generateLink no devolvió hashed_token`);
      return null;
    }
    // Apunta al CANJE (route handler), NO a la pantalla: el canje escribe las
    // cookies de sesión y un Server Component no puede. Ese fue exactamente el
    // bug que dejaba a todo el mundo con "el link venció" hasta el 1/8.
    return siteUrl(
      `/definir-contrasena/confirmar?token_hash=${encodeURIComponent(hashed)}&type=recovery`,
    );
  } catch (e) {
    console.error(
      `[${etiqueta}] linkParaElegirContrasena threw:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
