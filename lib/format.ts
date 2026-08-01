/**
 * Formateo de plata (pesos argentinos), fuente única. Antes había 3 copias del
 * mismo Intl.NumberFormat (rentabilidad, pagos, panel-staff) + 2 copias del
 * compacto ($1.2M / $840K).
 *
 * Desde el 31/7 este módulo también cubre lo que ESCRIBE una persona, no sólo
 * lo que se le muestra: parseArs, formatArsInput y normalizarWebsite. El motivo
 * está escrito arriba de cada una, y es siempre el mismo: la pantalla no puede
 * exigirle a la persona que escriba como programa una computadora.
 */

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Pesos sin decimales: $12.500 */
export function money(n: number): string {
  return ars.format(n);
}

/** Compacto para números grandes: $1.2M, $840K, y $12.500 por debajo de 10K. */
export function moneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return money(n);
}

/** Lo que devuelve parseArs: o es un número válido (que puede ser null si el
 *  campo está vacío, porque el precio es opcional) o directamente no se pudo. */
export type ResultadoArs = { ok: true; valor: number | null } | { ok: false };

/**
 * Parsea plata escrita a mano en formato argentino.
 *
 * POR QUÉ EXISTE, y por qué nunca se usa Number() sobre el texto crudo:
 * `Number("15.000")` devuelve 15. En Argentina el punto es el separador de
 * miles, así que el parser genérico del lenguaje está leyendo quince mil como
 * quince. Ese bug le guardaba 15 al proveedor que escribía 15.000 y encima le
 * decía que el número estaba mal.
 *
 * La regla del parser, en una línea: si hay coma, la coma es el decimal y los
 * puntos son miles; si no hay coma, todos los puntos son miles y se sacan.
 * Todo lo que no sea dígito, punto o coma se descarta antes ("$ 15.000" vale).
 */
export function parseArs(raw: string): ResultadoArs {
  const texto = (raw ?? "").trim();
  // Vacío es válido y significa "sin precio": el campo es opcional.
  if (texto === "") return { ok: true, valor: null };

  const limpio = texto.replace(/[^\d.,]/g, "");
  if (limpio === "") return { ok: false };

  const comas = (limpio.match(/,/g) ?? []).length;
  if (comas > 1) return { ok: false };

  let entero: string;
  let decimales = "";
  if (comas === 1) {
    const corte = limpio.indexOf(",");
    entero = limpio.slice(0, corte).replace(/\./g, "");
    decimales = limpio.slice(corte + 1);
  } else {
    entero = limpio.replace(/\./g, "");
  }

  if (entero === "" && decimales === "") return { ok: false };
  if (!/^\d*$/.test(entero) || !/^\d*$/.test(decimales)) return { ok: false };

  const valor = Number(
    `${entero === "" ? "0" : entero}.${decimales === "" ? "0" : decimales}`,
  );
  if (!Number.isFinite(valor)) return { ok: false };
  return { ok: true, valor };
}

/**
 * El texto que se ve en el input de plata MIENTRAS la persona escribe: puntos
 * de miles en vivo, coma decimal con dos lugares como máximo, y el signo menos
 * descartado (un precio negativo no se puede ni tipear, así que después no hace
 * falta acusar a nadie de haberlo escrito).
 *
 * Es idempotente a propósito: formatArsInput(formatArsInput(x)) es igual a
 * formatArsInput(x). Si no lo fuera, el input pelearía contra cada tecla.
 */
export function formatArsInput(raw: string): string {
  const limpio = (raw ?? "").replace(/[^\d.,]/g, "");
  if (limpio === "") return "";

  const corte = limpio.indexOf(",");
  const tieneComa = corte >= 0;
  const enteroCrudo = (tieneComa ? limpio.slice(0, corte) : limpio).replace(/\D/g, "");
  const decimales = tieneComa
    ? limpio.slice(corte + 1).replace(/\D/g, "").slice(0, 2)
    : "";

  if (!tieneComa && enteroCrudo === "") return "";

  const entero =
    enteroCrudo === "" ? "" : enteroCrudo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return tieneComa ? `${entero},${decimales}` : entero;
}

/**
 * Completa el esquema de una dirección web escrita como la escribe una persona.
 *
 * POR QUÉ EXISTE: el proveedor escribe "somosder.ar" y eso es correcto para
 * cualquier humano. El validador nativo del navegador y cualquier parser de URL
 * lo rechazan por no traer https://. El que tiene que poner el prefijo somos
 * nosotros, no la persona que carga.
 */
export function normalizarWebsite(raw: string): string {
  const texto = (raw ?? "").trim();
  if (texto === "") return "";
  if (/^https?:\/\//i.test(texto)) return texto;
  if (texto.startsWith("//")) return `https:${texto}`;
  return `https://${texto}`;
}
