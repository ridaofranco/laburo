/**
 * Formateo de plata (pesos argentinos), fuente única. Antes había 3 copias del
 * mismo Intl.NumberFormat (rentabilidad, pagos, panel-staff) + 2 copias del
 * compacto ($1.2M / $840K).
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
