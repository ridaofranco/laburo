/**
 * Formateo de fechas/horas en la zona horaria de Argentina.
 *
 * ⚠️ Por qué existe: Vercel corre en UTC. Sin fijar timeZone, todo
 * toLocaleDateString/Time/String server-side muestra la hora corrida +3
 * (un gig a las 21:00 se veía 00:00). En localhost NO se nota porque la Mac
 * está en hora AR. Estas helpers pasan SIEMPRE timeZone America/Argentina/
 * Buenos_Aires, así el productor y el staff ven la hora real del evento sin
 * importar dónde corra el server ni desde qué dispositivo miren.
 *
 * Los eventos suceden en Argentina → se muestran en hora AR tanto en el
 * servidor como en el cliente (consistencia total). Todas devuelven
 * `string | null` (null = fecha vacía/inválida) para componer con `?? "—"`.
 */

export const AR_TZ = "America/Argentina/Buenos_Aires";

type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha (por defecto "19 jul"). Pasá `{}` para el formato largo dd/mm/aaaa. */
export function fmtFecha(
  v: DateInput,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
): string | null {
  const d = toDate(v);
  return d ? d.toLocaleDateString("es-AR", { timeZone: AR_TZ, ...options }) : null;
}

/** Hora (por defecto "21:00"). */
export function fmtHora(
  v: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string | null {
  const d = toDate(v);
  return d ? d.toLocaleTimeString("es-AR", { timeZone: AR_TZ, ...options }) : null;
}

/** Fecha + hora (por defecto "19 de julio, 21:00"). */
export function fmtFechaHora(
  v: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  },
): string | null {
  const d = toDate(v);
  return d ? d.toLocaleString("es-AR", { timeZone: AR_TZ, ...options }) : null;
}

/**
 * Edad en años a partir de la fecha de nacimiento (formato "AAAA-MM-DD").
 *
 * ⚠️ NO usar `new Date("1995-07-19")`: eso parsea medianoche UTC, así que en
 * un server UTC la edad puede quedar corrida un día. Acá parseamos los dígitos
 * a mano y comparamos contra "hoy" calculado en hora AR. Devuelve null si no
 * hay fecha, no matchea, o el resultado es absurdo (<=0 o >=120).
 */
export function calcEdad(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const nac = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento.trim());
  if (!nac) return null;
  const by = Number(nac[1]);
  const bm = Number(nac[2]);
  const bd = Number(nac[3]);

  // "Hoy" en el calendario AR (en-CA da AAAA-MM-DD).
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoy);
  if (!t) return null;
  const ty = Number(t[1]);
  const tm = Number(t[2]);
  const td = Number(t[3]);

  let edad = ty - by;
  if (tm < bm || (tm === bm && td < bd)) edad--;
  return edad > 0 && edad < 120 ? edad : null;
}
