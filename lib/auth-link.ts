import "server-only";

import { createElement } from "react";
import { render } from "@react-email/components";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";
import { sendMail } from "@/lib/email/mailer";
import { LinkDeAccesoEmail } from "@/components/emails/link-de-acceso-email";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LOS DOS LINKS DE AUTENTICACIÓN DE LABURO, EN UN SOLO LUGAR.
 *
 * Acá viven los dos links que llegan por mail:
 *   · `linkParaElegirContrasena` → para DEFINIR la contraseña (/definir-contrasena)
 *   · `linkParaEntrar`           → para ENTRAR de una (/auth/callback)
 *
 * ── POR QUÉ LOS DOS ESQUIVAN LAS PLANTILLAS DE SUPABASE ──────────────────────
 * Por dos motivos distintos que apuntan al mismo lado:
 *
 *   1. MARCA: la plantilla por defecto está en inglés, sin logo y sin firma.
 *      Franco: "parece phishing". Quien recibe la bienvenida linda de LABURO y
 *      después ESO, no entra.
 *   2. EL LINK QUE VENCÍA SIENDO VÁLIDO (2/9): el mail de Supabase manda un
 *      `code` de PKCE, que solo se puede canjear en el MISMO navegador que lo
 *      pidió (ahí quedó el `code_verifier`). Abrirlo desde el visor interno de
 *      Gmail, que es otro navegador, falla siempre. `generateLink` en cambio
 *      devuelve un `hashed_token` que se canja con `verifyOtp` desde cualquier
 *      lado.
 *
 * La salida obvia al punto 2 sería cambiar la plantilla a `{{ .TokenHash }}`.
 * ⚠️ ESTÁ PROHIBIDO: el proyecto de Supabase lo comparten LABURO y HITO y la
 * plantilla es UNA sola por proyecto. Arreglaría LABURO y rompería HITO.
 *
 * ── EL CONTRATO, IGUAL PARA LOS DOS ──────────────────────────────────────────
 * Ninguna de las dos funciones tira nunca, y devuelven null / false cuando algo
 * falla. El que llama TIENE que seguir andando igual, cayendo al camino de
 * antes (`signInWithOtp` / `resetPasswordForEmail`). El peor caso posible de
 * este archivo es "quedó como estaba", nunca "no entra nadie".
 * ══════════════════════════════════════════════════════════════════════════════
 */

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

/**
 * El hint de rol que /entrar le pasa a /auth/callback. Es una preferencia para
 * desempatar a quien tiene más de un perfil, NUNCA un permiso: cada rama del
 * callback igual verifica contra la base. Las cuatro bases son las mismas que
 * valida `comoValido()` en app/auth/callback/route.ts.
 */
export type RolHint = "productora" | "staff" | "proveedor" | "salon";

export interface OpcionesDeLink {
  /** El rol que la persona eligió en la puerta. /login no manda ninguno. */
  como?: RolHint | null;
  /**
   * ⚠️ ESTA DECISIÓN NO ES DEL HELPER, ES DEL QUE LLAMA, y por eso es un
   * parámetro obligatorio y no un default.
   *
   * `generateLink({type:'magiclink'})` falla si el mail no tiene cuenta en
   * auth.users. Crearla resuelve eso, pero crear cuentas de más convierte la
   * puerta en un oráculo de mails y llena auth.users de basura. Hoy cada puerta
   * ya tiene su criterio y acá se respeta tal cual:
   *   · /acceso-staff  → true, DESPUÉS de confirmar que el mail está en el pool
   *   · /entrar        → true solo para proveedor/salón cuya ficha ya existe
   *                      (nacieron sin cuenta: el diseño original era por token)
   *   · /login         → false, como su `shouldCreateUser: false` de siempre
   */
  crearSiNoExiste: boolean;
  /** Para los logs, así se sabe qué puerta falló. */
  etiqueta?: string;
}

/**
 * EL LINK PARA ENTRAR, generado sin mandar ningún mail.
 *
 * Hermano de `linkParaElegirContrasena`: mismo mecanismo (`generateLink` →
 * `hashed_token`), mismo contrato (null si algo falla), otro destino. Este
 * apunta a /auth/callback, que es el ÚNICO lugar donde se decide identidad, y
 * por eso el link nunca lleva a un panel escrito a mano.
 *
 * ⚠️⚠️ POR QUÉ `type: "recovery"` Y NO `type: "magiclink"`, QUE ES LO QUE PARECE
 * ────────────────────────────────────────────────────────────────────────────
 * Porque **`generateLink({type:'magiclink'})` CREA LA CUENTA si el mail no la
 * tiene**, y lo hace en silencio: no devuelve error, devuelve un link válido.
 * Verificado corriéndolo el 2/9 contra el proyecto real: se pidió un link para
 * un mail inventado y quedó un usuario nuevo en `auth.users`.
 *
 * Eso rompería el `shouldCreateUser: false` de /login y de /entrar sin que
 * nadie se entere: cualquiera que escriba un mail ajeno en la puerta le crea la
 * cuenta, y `auth.users` se llena de basura. Es exactamente lo que el gate
 * CR-01 y el chequeo de pool de /acceso-staff vinieron a evitar.
 *
 * `recovery` no hace eso: si el mail no tiene cuenta devuelve "User with this
 * email not found" y NO crea nada. Verificado igual, el mismo día. Y el token
 * que devuelve entra igual de bien: canjeado con `verifyOtp` desde un navegador
 * SIN cookies (o sea el caso del visor de Gmail, que es todo el punto de esto)
 * crea la sesión y aterriza en el panel que corresponde.
 *
 * O sea que la decisión de crear la cuenta vuelve a ser del que llama, que es
 * donde tiene que estar, y se toma con un `createUser` explícito. Es el mismo
 * mecanismo que `linkParaElegirContrasena` ya usaba desde el 1/8.
 *
 * "recovery" es el nombre del mecanismo, no lo que la persona ve: el mail dice
 * "entrá", el link entra, y en ninguna pantalla aparece la palabra recuperar.
 * Nada de la app se comporta distinto con una sesión de recovery (verificado:
 * no hay un solo `onAuthStateChange` ni nada que mire `amr` en todo el repo).
 *
 * Lo demás, también verificado corriéndolo: el `hashed_token` es de un solo uso
 * (el segundo canje devuelve "Email link is invalid or has expired") y
 * `verifyOtp` acepta el `type` que la propia API devuelve, que es lo que se usa
 * acá en vez de escribirlo a mano.
 */
export async function linkParaEntrar(
  admin: SupabaseClient,
  email: string,
  opciones: OpcionesDeLink,
): Promise<string | null> {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return null;
  const etiqueta = opciones.etiqueta ?? "auth-link";

  try {
    if (opciones.crearSiNoExiste) {
      // Si ya tiene cuenta, createUser falla y seguimos igual: lo único que
      // importa es que exista antes de generar el link. No se mira el motivo
      // del error a propósito, para no convertir esto en un oráculo de "este
      // mail ya tenía cuenta".
      await admin.auth.admin
        .createUser({ email: limpio, email_confirm: true })
        .catch(() => undefined);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: limpio,
    });
    if (error) {
      // El caso más común y esperado: el mail no tiene cuenta y el que llamó
      // dijo que no se puede crear. No es una falla, es la puerta funcionando.
      console.error(`[${etiqueta}] generateLink para entrar falló:`, error.message);
      return null;
    }
    const hashed = data?.properties?.hashed_token;
    if (!hashed) {
      console.error(`[${etiqueta}] generateLink no devolvió hashed_token`);
      return null;
    }
    const tipo = data?.properties?.verification_type || "recovery";

    const params = new URLSearchParams({ token_hash: hashed, type: tipo });
    if (opciones.como) params.set("como", opciones.como);
    // Apunta al CALLBACK (route handler), NO a un panel: el canje escribe las
    // cookies de sesión y solo puede hacerlo un route handler, y además es el
    // callback el que sabe a qué panel va cada persona.
    return siteUrl(`/auth/callback?${params.toString()}`);
  } catch (e) {
    console.error(
      `[${etiqueta}] linkParaEntrar threw:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

/**
 * ARMAR EL LINK Y MANDARLO ADENTRO DE NUESTRO MAIL. Devuelve si salió.
 *
 * ── POR QUÉ ESTÁ ACÁ Y NO COPIADO EN CADA PUERTA ─────────────────────────────
 * Porque son TRES puertas (/entrar, /login y /acceso-staff) haciendo lo mismo,
 * y este repo ya pagó dos veces el precio de copiar en vez de compartir: el
 * botón de Google se arregló del lado del staff y quedó roto del lado del
 * productor, y `signInWithPassword` vivió en el staff mientras el productor no
 * podía usar la contraseña que su propio mail le prometía.
 *
 * ── LA VÁLVULA ───────────────────────────────────────────────────────────────
 * Devuelve `false` si el link no se pudo armar O si el mail no salió, y NUNCA
 * tira. El que llama tiene que caer al `signInWithOtp` de siempre. Que el mail
 * nuestro falle no puede dejar a nadie afuera: como mucho le llega el feo.
 *
 * ⚠️ Si el link se generó pero el mail no salió, el `signInWithOtp` del fallback
 * genera un token nuevo y pisa a este. Está bien: el que se pisó nunca llegó a
 * ninguna casilla.
 */
export async function mandarLinkDeAcceso(
  admin: SupabaseClient,
  email: string,
  opciones: OpcionesDeLink,
): Promise<boolean> {
  const limpio = email.trim().toLowerCase();
  const etiqueta = opciones.etiqueta ?? "auth-link";

  try {
    const link = await linkParaEntrar(admin, limpio, opciones);
    if (!link) return false;

    const html = await render(createElement(LinkDeAccesoEmail, { link }));
    const result = await sendMail({
      to: limpio,
      subject: "Tu link para entrar a LABURO",
      html,
    });
    if (!result.ok) {
      console.error(
        `[${etiqueta}] el mail con el link no salió:`,
        result.error ?? result.channel,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      `[${etiqueta}] mandarLinkDeAcceso threw:`,
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}
