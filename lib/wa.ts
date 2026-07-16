/**
 * Deep links de WhatsApp y teléfono (sin librería — CLAUDE.md prohíbe la
 * WhatsApp Business API paga). Acciones rápidas del perfil (Claude's Discretion).
 */

/**
 * Normaliza un teléfono argentino a dígitos E.164 SIN el `+` (WR-06).
 *
 * Heurística determinística AR-only (cero-budget, sin libphonenumber):
 *  1. Deja sólo dígitos.
 *  2. Si ya empieza con `54` (código país), lo deja como está.
 *  3. Si no, saca el `0` inicial (prefijo troncal de larga distancia) y el
 *     `15` (prefijo de celular sobre el número de abonado), y prefija `54`.
 *
 * Ejemplos:
 *   "011 15 1234 5678"  → "541112345678"   (saca el 0 troncal y el 15 de abonado)
 *   "+54 9 351 555 0000"→ "5493515550000"  (ya tiene 54 → intacto)
 *   "351 15 555 0000"   → "543515550000"   (saca el 15, prefija 54)
 *   "1112345678"        → "541112345678"   (sin 0 ni 15 → sólo prefija 54)
 */
export function normalizeAr(raw: string): string {
  let d = (raw ?? "").replace(/[^\d]/g, "");
  if (!d) return "";

  // Ya viene con código de país argentino → no tocar.
  if (d.startsWith("54")) return d;

  // Saca el 0 troncal de larga distancia (ej. 011..., 0351...).
  if (d.startsWith("0")) d = d.slice(1);

  // Saca el 15 de abonado. En un número nacional el 15 va después del código
  // de área (2-4 dígitos), así que lo buscamos como el "15" que precede a los
  // últimos 6-8 dígitos del abonado, no como los primeros dos dígitos del área.
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m) d = m[1] + m[2];

  // Prefija el código de país.
  return "54" + d;
}

/** Deja solo dígitos (saca +, espacios, guiones, paréntesis). */
const e164 = (raw: string): string => normalizeAr(raw);

/** https://wa.me/<E.164 sin +>?text=… (wa.me NO quiere el +). */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(text)}`;
}

/** tel:+<dígitos> */
export function telLink(phone: string): string {
  return `tel:+${e164(phone)}`;
}
