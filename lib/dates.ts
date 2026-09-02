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
 *
 * ⚠️ EL MISMO PROBLEMA DEL OTRO LADO DEL VIAJE (al ESCRIBIR, 2/9). Un
 * <input type="datetime-local"> devuelve un string SIN zona ("2026-09-10T20:00").
 * Si ese valor crudo se manda a una columna timestamptz, la zona la termina
 * eligiendo el server: en Supabase la sesión es UTC, así que la productora
 * escribía 20:00 y al candidato le llegaba 17:00. Por eso la conversión
 * datetime-local ↔ ISO vive acá abajo (aInputLocal / desdeInputLocal) y no
 * suelta en un formulario: es fecha del proyecto, igual que el formateo, y ya
 * había dos formularios resolviéndola cada uno por su cuenta (uno bien y otro
 * mal). Regla: a la base NUNCA le llega el valor crudo del input.
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

/**
 * ISO → valor para un <input type="datetime-local">, en la hora LOCAL del
 * dispositivo. Devuelve "" si no hay fecha o si es inválida, porque un input
 * controlado no puede recibir null.
 *
 * ⚠️ Usa la hora local del navegador a propósito, no AR_TZ: el input muestra y
 * edita en la zona del dispositivo, y desdeInputLocal() hace el viaje inverso
 * con el mismo criterio. Mezclarlos correría la hora al editar un evento desde
 * un dispositivo con otra zona.
 */
export function aInputLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Valor de un <input type="datetime-local"> → ISO con zona (o null).
 *
 * Es la que evita el bug de las tres horas: `new Date("2026-09-10T20:00")`
 * interpreta el string en la zona del dispositivo y `toISOString()` le pega la
 * zona explícita, así que el timestamptz de la base guarda el instante correcto
 * en vez de dejar que el server elija. Devuelve null con string vacío o basura.
 */
export function desdeInputLocal(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
