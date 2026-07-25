/**
 * URL pública de la app, en un solo lugar.
 *
 * Antes cada archivo resolvía esto por su cuenta y con defaults distintos:
 * `offer-actions.ts` caía a `""` (el link mágico del email salía relativo, o sea
 * muerto en cualquier cliente de correo) y `payment-actions.ts` /
 * `acceso-staff/actions.ts` caían a `laburo-henna.vercel.app`, que ya no es el
 * dominio de producción. Un mismo deploy podía mandar links a dos dominios
 * distintos según qué acción los generara.
 *
 * Nota: esto es un fallback, no un reemplazo. `SITE_URL` tiene que estar cargada
 * en Vercel igual, porque el `notification_url` de MercadoPago y los links
 * mágicos dependen de que apunte al dominio real.
 */
export const SITE_URL =
  process.env.SITE_URL?.trim().replace(/\/+$/, "") || "https://laburo.somosder.ar";

/** Une SITE_URL con un path, sin barras duplicadas. */
export function siteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
