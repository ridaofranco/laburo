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
/**
 * EL LINK PARA ENTRAR (magic link), generado sin mandar ningún mail.
 *
 * ── EL BUG QUE ARREGLA (3/8) ─────────────────────────────────────────────────
 * Hasta hoy el link de acceso lo mandaba `supabase.auth.signInWithOtp()` desde
 * el NAVEGADOR. `createBrowserClient` de @supabase/ssr usa PKCE, y PKCE guarda
 * una llave privada (`code_verifier`) en una cookie del navegador que pidió el
 * link. Para terminar de entrar hay que presentar esa llave.
 *
 * En el teléfono el mail no lo abre tu navegador: lo abre el visor interno de
 * Gmail, que a efectos de cookies ES OTRO NAVEGADOR. La llave no está, el canje
 * falla, y la app te muestra "el link venció".
 *
 * Y lo peor: para cuando el canje falla, Supabase YA quemó el token de un solo
 * uso en /verify. Así que volvés a tocar el link y esa segunda vez el error es
 * verdadero (403 "one-time token not found"). El mensaje se vuelve cierto
 * después de haber mentido, y por eso parecía imposible de arreglar.
 *
 * Medido en los logs de auth de producción del 3/8:
 *   16:27:11  /verify -> LOGIN OK   (el link andaba)
 *   16:27:23  /verify -> 403        (ya quemado)
 *   16:27:38  /verify -> 403
 * y cero filas nuevas en auth.sessions: el login moría entre la puerta y la casa.
 *
 * ── POR QUÉ ESTO LO ARREGLA ──────────────────────────────────────────────────
 * `token_hash` + `verifyOtp` NO usa code_verifier. No hay nada guardado en el
 * navegador que tenga que coincidir, así que el link funciona aunque lo abras en
 * otro navegador, en otra app o en otro teléfono. Es el mismo camino que ya usa
 * `linkParaElegirContrasena` acá abajo, que es justamente el que nunca falló.
 *
 * ── POR QUÉ NO SE TOCA LA PLANTILLA DE SUPABASE ──────────────────────────────
 * Este proyecto de Supabase lo comparten LABURO y HITO, así que la plantilla de
 * magic link es la MISMA para los dos. Cambiarla habría arreglado LABURO y roto
 * el login de HITO. Generando el link acá y mandándolo en NUESTRO mail, HITO no
 * se entera. De paso el mail sale con nuestra marca y no con la plantilla de
 * Supabase que Franco ya había marcado como "parece phishing".
 *
 * Devuelve null si la cuenta no existe (generateLink falla) o si algo sale mal.
 * Eso es lo correcto y además es el gate: equivale al `shouldCreateUser:false`
 * que tenía el login. El que llama muestra SIEMPRE la misma pantalla, exista o
 * no la cuenta (decisión de Franco, 28/7: no revelar qué mails tienen cuenta).
 */
export async function linkMagicoParaEntrar(
  admin: SupabaseClient,
  email: string,
  etiqueta = "auth-link",
  /**
   * Crear la cuenta si todavía no existe. Es el equivalente del viejo
   * `shouldCreateUser`. En /login va en false (solo entran los que ya tienen
   * cuenta). En /acceso-staff va en true, PERO recién después de confirmar que
   * la persona está en el pool: ese chequeo es el gate y no se puede mover acá.
   */
  crearSiNoExiste = false,
): Promise<string | null> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return null;

  try {
    if (crearSiNoExiste) {
      // Si ya tiene cuenta, createUser falla y seguimos igual: lo único que
      // importa es que exista antes de generar el link.
      await admin.auth.admin
        .createUser({ email: limpio, email_confirm: true })
        .catch(() => undefined);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: limpio,
    });
    if (error) {
      // Caso normalísimo: la cuenta no existe. No es un incidente.
      console.info(`[${etiqueta}] magiclink no generado para ${limpio}:`, error.message);
      return null;
    }
    const hashed = data?.properties?.hashed_token;
    if (!hashed) {
      console.error(`[${etiqueta}] generateLink no devolvió hashed_token`);
      return null;
    }
    // Apunta al route handler, NO a una pantalla: el canje escribe las cookies
    // de sesión y un Server Component no puede.
    return siteUrl(
      `/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink`,
    );
  } catch (e) {
    console.error(
      `[${etiqueta}] linkMagicoParaEntrar threw:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

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
