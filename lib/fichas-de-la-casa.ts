/**
 * Las fichas de la vidriera que son de SOMOS DER (16/11/2026).
 *
 * Franco: «deberías crear como productos en LABURO a mis productos y ofrecer sus
 * servicios, ahí tenés el principal directorio propio». Están cargadas en la base
 * como cualquier proveedor (verificadas, salen primero). Lo único que cambia en
 * el código es el enlace al sitio: al resto se le pone `nofollow` porque el texto
 * lo escribe un tercero; a estas no, porque son nuestras.
 */
export const FICHAS_DE_LA_CASA = new Set(["somos-der", "pase", "hito", "entra"]);

export function esFichaDeLaCasa(slug: string | null | undefined): boolean {
  return FICHAS_DE_LA_CASA.has((slug ?? "").toLowerCase());
}

/** Los otros productos de SOMOS DER, con la búsqueda de cada uno como texto del enlace. */
export const FAMILIA_DER: { href: string; busqueda: string; marca: string }[] = [
  { href: "https://www.somosder.ar", busqueda: "Producción de eventos", marca: "SOMOS DER" },
  { href: "https://pase.somosder.ar", busqueda: "Acreditaciones para eventos", marca: "PASE" },
  { href: "https://www.entratickets.com", busqueda: "Ticketera para vender entradas", marca: "ENTRÁ" },
  { href: "https://hito.agency", busqueda: "Consultoría y web para negocios de eventos", marca: "HITO" },
];
