/**
 * Color de avatar de iniciales derivado del oficio principal (D-03 / UI-SPEC
 * § Color → paleta categórica). Sin fotos en el pool → color determinístico:
 * mismo oficio → mismo color en toda la app. Es DATA, no acento (no cuenta
 * contra el presupuesto del 10% de azul).
 */

/** Paleta categórica UI-SPEC (8 colores, baja saturación, seguros en oscuro). */
export const AVATAR_PALETTE: string[] = [
  "#5B8DEF",
  "#2DD4BF",
  "#E8A13A",
  "#C77DFF",
  "#F0708A",
  "#E86F4E",
  "#8B95B5",
  "#3DD68C",
];

/** hash estable de string (djb2-ish, determinístico). */
function hash(s: string): number {
  return [...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
}

/** hash(primary_oficio) % 8 → hex de la paleta. Mismo oficio → mismo color. */
export function oficioColor(primaryOficio: string | null | undefined): string {
  const key = (primaryOficio ?? "").trim() || "—";
  return AVATAR_PALETTE[Math.abs(hash(key)) % AVATAR_PALETTE.length];
}

/** Iniciales a partir de nombre + apellido (máx 2, mayúsculas). */
export function initials(
  nombre: string | null | undefined,
  apellido?: string | null | undefined,
): string {
  const a = (nombre ?? "").trim();
  const b = (apellido ?? "").trim();
  const first = a.charAt(0);
  const second = b.charAt(0) || a.split(/\s+/)[1]?.charAt(0) || "";
  return (first + second).toUpperCase() || "?";
}
