import "server-only";

/**
 * LA COOKIE QUE DICE EN NOMBRE DE QUIÉN SE ESTÁ ACTUANDO.
 *
 * Vive en su propio archivo y no adentro de `lib/org.ts` porque la escribe una
 * server action (`app/(portal)/org-actions.ts`) y la lee el resolvedor: si el
 * nombre o las opciones estuvieran duplicados en los dos lados, el día que uno
 * cambie el otro sigue leyendo una cookie que ya nadie escribe, y el síntoma
 * sería "el selector no hace nada" sin ningún error.
 *
 * ── POR QUÉ `httpOnly`, QUE NO ES COSMÉTICO ─────────────────────────────────
 * Esta cookie decide a qué organización van las ESCRITURAS. Si el navegador la
 * pudiera tocar desde JavaScript, cualquier script de la página podría cambiar
 * en nombre de quién escribe el usuario. La validación de membresía del lado
 * del servidor la ataja igual (ver `orgActual()`), pero eso es la segunda
 * barrera, no la primera.
 *
 * ── POR QUÉ NO TIENE `maxAge`: ES DE SESIÓN ─────────────────────────────────
 * Elegir una organización es un gesto de "ahora estoy trabajando en esto", no
 * una preferencia permanente. Que se borre al cerrar el navegador es lo
 * deseado: al volver, el que entra arranca donde arranca siempre, y elige otra
 * vez si quiere. Una cookie persistente haría que alguien vuelva una semana
 * después, no se acuerde de que había cambiado de contexto, y escriba en la
 * organización equivocada creyendo que está en la suya.
 */

/** Nombre de la cookie. Fijado por Franco. */
export const LABURO_ORG_COOKIE = "laburo_org_id";

/** Opciones de escritura. Sin `maxAge` a propósito: ver el header. */
export const LABURO_ORG_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

/**
 * ¿Esto tiene forma de UUID? La cookie es entrada NO confiable, igual que los
 * parámetros de `lib/search-params.ts`: llega del navegador y puede traer
 * cualquier cosa. Se valida el formato ANTES de que el string toque una
 * consulta.
 */
export function esUuid(v: string | undefined | null): v is string {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
