import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token del link de VISIBILIDAD ("¿querés que otras productoras te vean?").
 *
 * Mismo mecanismo que `lib/baja.ts`, con otro prefijo: HMAC del id de la ficha
 * con un secreto del servidor. Sin login, sin guardar nada en la base, y sin
 * que se puedan fabricar links para fichas ajenas probando UUIDs.
 *
 * ── POR QUÉ ESTE MAIL EXISTE ────────────────────────────────────────────────
 * Las 1.050 personas del pool se anotaron en el formulario de SOMOS DER.
 * Consintieron que SOMOS DER tenga sus datos para convocarlas a SUS eventos.
 * **No consintieron aparecer en un catálogo que ven otras productoras.**
 *
 * Abrir el pool sin preguntar cambia quién trata sus datos, y eso no se arregla
 * con un término de uso nuevo: el consentimiento se pide antes, no después.
 * Este link es esa pregunta.
 *
 * ⚠️ El prefijo tiene que ser DISTINTO al de la baja. Con el mismo, un link de
 * baja serviría para cambiar la visibilidad y al revés: dos acciones muy
 * distintas con la misma llave.
 *
 * ── EL DEFAULT ES NO ────────────────────────────────────────────────────────
 * Sin respuesta, la ficha NO se comparte. El silencio no es un sí. Es lo que
 * hace que este mecanismo sea un consentimiento y no un aviso.
 */

const PREFIX = "visibilidad:v1:";

function secret(): string {
  return (
    process.env.BAJA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

/** ¿Podemos firmar links de visibilidad? */
export function visibilidadReady(): boolean {
  return secret().length > 16;
}

/** Token para una ficha. */
export function visibilidadToken(profileId: string): string {
  return createHmac("sha256", secret())
    .update(PREFIX + profileId)
    .digest("hex")
    .slice(0, 32);
}

/** ¿El token corresponde a esa ficha? Falso también si falta el secreto. */
export function visibilidadTokenOk(
  profileId: string,
  token: string | null | undefined,
): boolean {
  if (!visibilidadReady() || !profileId || !token) return false;
  const expected = Buffer.from(visibilidadToken(profileId), "utf8");
  const got = Buffer.from(String(token), "utf8");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}
