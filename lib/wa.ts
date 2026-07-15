/**
 * Deep links de WhatsApp y teléfono (sin librería — CLAUDE.md prohíbe la
 * WhatsApp Business API paga). Acciones rápidas del perfil (Claude's Discretion).
 */

/** Deja solo dígitos (saca +, espacios, guiones, paréntesis). */
const e164 = (raw: string): string => raw.replace(/[^\d]/g, "");

/** https://wa.me/<E.164 sin +>?text=… (wa.me NO quiere el +). */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(text)}`;
}

/** tel:+<dígitos> */
export function telLink(phone: string): string {
  return `tel:+${e164(phone)}`;
}
