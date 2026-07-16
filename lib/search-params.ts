/**
 * Parseo + validación de los search params de la búsqueda (SRCH-01/02, V5).
 *
 * Seguridad (T-02-11): TODO valor estructurado se valida contra un whitelist
 * conocido antes de tocar la query. Los oficios se filtran contra el catálogo,
 * la provincia contra las 24 jurisdicciones. El texto libre se sanea de los
 * caracteres significativos de PostgREST para que no pueda romper el grammar
 * del `.or()`. NUNCA se concatena crudo dentro de SQL/filtros.
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
}

/**
 * UUID (cualquier versión). El ?gig= entra desde la URL (input no confiable,
 * T-5-12): si no matchea un UUID, lo tratamos como ausente (null) y NUNCA lo
 * metemos crudo en la query.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return n;
}
