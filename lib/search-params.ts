/**
 * Parseo + validación de los search params de la búsqueda (SRCH-01/02, V5).
 *
 * Seguridad (T-02-11): TODO valor estructurado se valida contra un whitelist
 * conocido antes de tocar la query. Los oficios se filtran contra el catálogo,
 * la provincia contra las 24 jurisdicciones. El texto libre se sanea de los
 * caracteres significativos de PostgREST para que no pueda romper el grammar
 * del `.or()`. NUNCA se concatena crudo dentro de SQL/filtros.
 *
 * Paginación por parámetro de URL (`?p=N`) y no por un botón "ver más" que
 * acumula: en esta pantalla el estado YA vive en la URL (el cliente hace
 * router.replace y el server component vuelve a consultar), así que la página es
 * una clave más de PARAM y no pelea con nada. Un "ver más" obligaría a guardar
 * los resultados en estado del cliente y a mezclar dos fuentes de verdad; con
 * `?p=` además la búsqueda queda compartible y el botón "atrás" funciona.
 */
import { isKnownOficio } from "./oficios";
import { isKnownProvincia } from "./provincias";

/** Claves de URL (cortas, mobile payload chico). */
export const PARAM = {
  q: "q",
  oficios: "oficios",
  provincia: "prov",
  ciudad: "ciudad",
  finde: "finde",
  viajar: "viajar",
  movilidad: "movilidad",
  libres: "libres", // "ocultar ya asignados" (SRCH-02)
  gig: "gig", // modo "buscar reemplazo": re-filtro por gig (XTRA-02)
  pagina: "p", // página de resultados (1 en adelante); ausente = 1
} as const;

export interface SearchFilters {
  q: string;
  oficios: string[];
  provincia: string | null;
  ciudad: string;
  finde: boolean;
  viajar: boolean;
  movilidad: boolean;
  ocultarAsignados: boolean;
  gig: string | null;
  pagina: number;
}

/**
 * UUID (cualquier versión). El ?gig= entra desde la URL (input no confiable,
 * T-5-12): si no matchea un UUID, lo tratamos como ausente (null) y NUNCA lo
 * metemos crudo en la query.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tope duro de páginas. `?p=` es entrada NO confiable igual que el resto de este
 * archivo: sin tope, un `?p=99999999` genera un `.range()` absurdo contra la base.
 * 999 páginas de a 50 son 49.950 fichas, muy por encima del pool real.
 */
const MAX_PAGINA = 999;

/** Sólo dígitos, entero, entre 1 y MAX_PAGINA. Cualquier otra cosa cae a 1. */
function parsePagina(raw: string): number {
  if (!/^\d+$/.test(raw)) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGINA);
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

const isOn = (v: string | string[] | undefined): boolean => {
  const s = first(v).toLowerCase();
  return s === "1" || s === "true" || s === "on";
};

/**
 * Saca los caracteres que tienen significado en el grammar de PostgREST `.or()`
 * (comas, paréntesis, backslash) y en LIKE (%, *) para que el texto libre no
 * pueda inyectar filtros. Devuelve el texto seguro (o "" si queda vacío).
 */
export function sanitizeText(raw: string): string {
  return raw.replace(/[,()\\%*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Parsea + valida (whitelist) los search params. */
export function parseSearchParams(raw: RawSearchParams): SearchFilters {
  const oficiosRaw = first(raw[PARAM.oficios]);
  const oficios = oficiosRaw
    ? oficiosRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && isKnownOficio(s)) // V5 whitelist
    : [];

  const provinciaRaw = first(raw[PARAM.provincia]).trim();
  const provincia = provinciaRaw && isKnownProvincia(provinciaRaw)
    ? provinciaRaw // V5 whitelist
    : null;

  const gigRaw = first(raw[PARAM.gig]).trim();
  const gig = UUID_RE.test(gigRaw) ? gigRaw : null; // T-5-12: sólo UUID válido

  return {
    q: sanitizeText(first(raw[PARAM.q])),
    oficios,
    provincia,
    ciudad: sanitizeText(first(raw[PARAM.ciudad])),
    finde: isOn(raw[PARAM.finde]),
    viajar: isOn(raw[PARAM.viajar]),
    movilidad: isOn(raw[PARAM.movilidad]),
    ocultarAsignados: isOn(raw[PARAM.libres]),
    gig,
    pagina: parsePagina(first(raw[PARAM.pagina]).trim()),
  };
}

/** Serializa filtros a query string (usado por el cliente para actualizar la URL). */
export function buildQueryString(filters: Partial<SearchFilters>): string {
  const p = new URLSearchParams();
  if (filters.q) p.set(PARAM.q, filters.q);
  if (filters.oficios && filters.oficios.length)
    p.set(PARAM.oficios, filters.oficios.join(","));
  if (filters.provincia) p.set(PARAM.provincia, filters.provincia);
  if (filters.ciudad) p.set(PARAM.ciudad, filters.ciudad);
  if (filters.finde) p.set(PARAM.finde, "1");
  if (filters.viajar) p.set(PARAM.viajar, "1");
  if (filters.movilidad) p.set(PARAM.movilidad, "1");
  if (filters.ocultarAsignados) p.set(PARAM.libres, "1");
  // gig se conserva para que el modo "buscar reemplazo" no se pierda al ajustar
  // otros filtros. NO cuenta como filtro fino visible (ver activeFineFilterCount).
  if (filters.gig) p.set(PARAM.gig, filters.gig);
  // La página 1 no ensucia la URL (mismo criterio que los toggles apagados).
  // ⚠️ El que arma la URL al CAMBIAR un filtro no tiene que pasar `pagina`: si
  // alguien parado en la página 8 escribe "bartender" y la búsqueda devuelve 12
  // fichas, la página 8 está vacía y la pantalla le muestra "sin resultados" con
  // 12 candidatos ahí nomás. Volver a 1 al tocar cualquier filtro es parte del
  // arreglo, no un detalle. Sólo la navegación de páginas manda `pagina`.
  if (filters.pagina && filters.pagina > 1)
    p.set(PARAM.pagina, String(filters.pagina));
  return p.toString();
}

/** Cuántos filtros "finos" están activos (para el badge del botón Filtros). */
export function activeFineFilterCount(filters: SearchFilters): number {
  let n = 0;
  if (filters.provincia) n++;
  if (filters.ciudad) n++;
  if (filters.finde) n++;
  if (filters.viajar) n++;
  if (filters.movilidad) n++;
  if (filters.ocultarAsignados) n++;
  // La página NO cuenta como filtro fino (igual que gig): no achica el resultado,
  // sólo elige qué tramo se está mirando. Sumarla mentiría en el badge.
  return n;
}
