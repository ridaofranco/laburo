import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/site";

/**
 * Token del link de BAJA ("no quiero formar parte").
 *
 * El problema a resolver: el pie de cada mail lleva un link para darse de baja, y
 * ese link tiene que identificar a la persona SIN pedirle que se loguee (si le
 * pedimos login para irse, no se va: se queja o marca spam, que es peor). Pero
 * tampoco puede ser `/baja?id=<uuid>` pelado, porque entonces cualquiera podría
 * ir probando UUIDs y dar de baja gente ajena.
 *
 * La solución: el link lleva el id MÁS un token, que es un HMAC-SHA256 del id con
 * un secreto del servidor. Sin el secreto no se puede fabricar un token válido, y
 * el token no dice nada del secreto. No hace falta guardar nada en la base ni
 * expirar nada: el mismo link sirve hoy y en dos años, que es lo correcto para
 * una baja (nadie quiere descubrir que el link para irse venció).
 *
 * SECRETO: usa BAJA_SECRET si está cargada. Si no, deriva de la
 * SUPABASE_SERVICE_ROLE_KEY, que ya está en el env de LABURO. El HMAC es de una
 * sola vía, así que el token NO filtra la key. Es a propósito: evita depender de
 * que alguien cargue una env var nueva antes de poder mandar un mail con baja.
 *
 * COMPARACIÓN: timingSafeEqual, para no filtrar el token de a un byte por
 * diferencia de tiempo de respuesta.
 */

const PREFIX = "baja:v1:";

function secret(): string {
  const s =
    process.env.BAJA_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  return s;
}

/** ¿Podemos firmar links de baja? (sin secreto no se fabrican ni se validan). */
export function bajaReady(): boolean {
  return secret().length > 16;
}

/** Token para una ficha. 32 hex = 128 bits, de sobra para esto. */
export function bajaToken(profileId: string): string {
  return createHmac("sha256", secret())
    .update(PREFIX + profileId)
    .digest("hex")
    .slice(0, 32);
}

/** ¿El token corresponde a esa ficha? Falso también si falta el secreto. */
export function bajaTokenOk(profileId: string, token: string | null | undefined): boolean {
  if (!bajaReady() || !profileId || !token) return false;
  const expected = Buffer.from(bajaToken(profileId), "utf8");
  const got = Buffer.from(String(token), "utf8");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/** La URL que va al pie del mail: la PÁGINA de baja (GET no da de baja nada). */
export function bajaUrl(profileId: string): string {
  return `${siteUrl("/baja")}?p=${encodeURIComponent(profileId)}&t=${bajaToken(profileId)}`;
}

/**
 * La URL del one-click de Gmail/Outlook (RFC 8058). Es la MISMA página pero por
 * POST: los clientes que soportan el header List-Unsubscribe-Post pegan acá y la
 * baja queda hecha sin que la persona vea ninguna pantalla. Los que no lo
 * soportan muestran el link normal de arriba.
 */
export function bajaOneClickUrl(profileId: string): string {
  return `${siteUrl("/api/baja")}?p=${encodeURIComponent(profileId)}&t=${bajaToken(profileId)}`;
}

/**
 * Headers de baja para un envío. Gmail y Outlook los usan para mostrar su propio
 * botón "Cancelar suscripción" arriba del mail, y sobre todo para NO castigar al
 * dominio: un envío a varios cientos de personas sin List-Unsubscribe es la
 * definición de correo masivo sin salida. Con esto, el que no quiere estar se va
 * en un click en vez de marcarnos como spam.
 */
export function bajaHeaders(profileId: string): Record<string, string> | undefined {
  if (!bajaReady() || !profileId) return undefined;
  return {
    "List-Unsubscribe": `<${bajaOneClickUrl(profileId)}>, <${bajaUrl(profileId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
