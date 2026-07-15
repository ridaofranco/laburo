/**
 * Las 24 jurisdicciones oficiales de Argentina (D-04).
 * Copiadas de somosder-web/src/data/paises.ts § provinciasAr — las mismas
 * strings que el normalizador de la Fase 1 guardó en
 * staff_app.staff_profiles.provincia. NO importar cross-repo.
 */
export const PROVINCIAS: string[] = [
  "Buenos Aires (Provincia)",
  "Ciudad Autónoma de Buenos Aires (CABA)",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const PROVINCIAS_SET = new Set(PROVINCIAS);

/** ¿Es una provincia oficial conocida? (whitelist para search params — V5). */
export function isKnownProvincia(value: string): boolean {
  return PROVINCIAS_SET.has(value);
}
