/**
 * Catálogo de OFICIOS para LABURO (SRCH-01).
 *
 * Fuente base: somosder-web/src/data/oficios.ts (las etiquetas `es` son las
 * mismas strings que el normalizador de la Fase 1 guardó en
 * staff_app.staff_profiles.oficios[]). Copiado, no importado cross-repo (A5).
 *
 * IMPORTANTE (verificado contra la data viva, 2026-07-15): el normalizador de
 * Source-B también emitió algunas etiquetas a nivel categoría que NO están en
 * la lista de items del catálogo web ("Producción", "Catering", "Técnica",
 * "Audiovisual", "Orientador/a", "Acomodador/a"). Son de las MÁS frecuentes del
 * pool, así que las chips y el whitelist deben incluir las strings reales tal
 * cual se guardaron. Ver OFICIOS_FRECUENTES + OFICIOS_EXTRA_POOL.
 */

export interface OficioCat {
  cat: string;
  items: string[];
}

/** Catálogo curado (categorías + items) — fuente del multi-select en Filtros. */
export const OFICIOS_CATALOGO: OficioCat[] = [
  {
    cat: "Bar y gastronomía",
    items: [
      "Bartender",
      "Ayudante de barra",
      "Mozo / Camarero",
      "Runner",
      "Cocinero/a",
      "Ayudante de cocina",
      "Bachero/a",
      "Barista",
      "Sommelier",
      "Maître",
      "Operador de food truck",
    ],
  },
  {
    cat: "Accesos y acreditación",
    items: [
      "Control de accesos",
      "Acreditador/a",
      "Operador de escáner / ticketing",
      "Seguridad de puerta",
      "Guardarropa",
      "Pulseras y credenciales",
    ],
  },
  {
    cat: "Producción y logística",
    items: [
      "Asistente de producción",
      "Productor/a de campo",
      "Stage manager",
      "Régisseur",
      "Montaje y desmontaje",
      "Carga y descarga (peón)",
      "Pañolero/a",
      "Utilero/a",
      "Coordinador/a de logística",
    ],
  },
  {
    cat: "Técnica (sonido, luces, video)",
    items: [
      "Técnico/a de sonido",
      "Técnico/a de luces",
      "Técnico/a de video / LED",
      "Operador/a de switcher",
      "Stagehand",
      "Rigger",
      "Electricista",
      "Backline",
    ],
  },
  {
    cat: "Audiovisual",
    items: [
      "Fotógrafo/a",
      "Camarógrafo/a",
      "Operador/a de dron",
      "Editor/a",
      "Streaming / transmisión",
    ],
  },
  {
    cat: "Atención y experiencia",
    items: [
      "Promotor/a",
      "Azafata / Edecán",
      "Recepcionista",
      "Host / Anfitrión",
      "Sampling / degustación",
      "Brand ambassador",
      "Animador/a",
      "Coordinador/a de invitados",
    ],
  },
  {
    cat: "Comercial y ventas",
    items: ["Vendedor/a", "Cajero/a", "Venta de merchandising"],
  },
  {
    cat: "Limpieza y mantenimiento",
    items: ["Personal de limpieza", "Mantenimiento", "Sanitarios"],
  },
  {
    cat: "Salud y seguridad",
    items: ["Médico/a", "Enfermero/a", "Brigadista / bombero", "Socorrista"],
  },
  {
    cat: "Transporte",
    items: ["Chofer", "Conductor/a de shuttle", "Valet parking"],
  },
  {
    cat: "Otros perfiles",
    items: [
      "Traductor/a / intérprete",
      "Coordinador/a de voluntarios",
      "Community manager en vivo",
      "Locución / cabina",
    ],
  },
];

/**
 * Etiquetas nivel-categoría/normalizador presentes en el pool pero fuera de la
 * lista de items del catálogo web. Necesarias para que las chips y el whitelist
 * (V5) acepten las strings reales que se guardaron. (Frecuencias verificadas.)
 */
export const OFICIOS_EXTRA_POOL: string[] = [
  "Producción", // 192
  "Catering", // 149
  "Técnica", // 61
  "Orientador/a", // 15
  "Acomodador/a", // 10
  "Organización", // 8
  "Atención al cliente", // 6
  "Hidratación", // 6
];

/** Todos los items del catálogo (flat). */
export const OFICIOS_ITEMS: string[] = OFICIOS_CATALOGO.flatMap((c) => c.items);

/**
 * Chips de 1-tap (D-04): los oficios más comunes del pool real, en strings
 * exactas tal cual se guardaron (verificado contra la data viva 2026-07-15).
 * Tapear cualquiera de estas devuelve >0 candidatos. "Audiovisual" es una
 * etiqueta nivel-categoría guardada como valor (70 filas).
 */
export const OFICIOS_FRECUENTES: string[] = [
  "Control de accesos", // 246
  "Producción", // 192
  "Catering", // 149
  "Fotógrafo/a", // 74
  "Audiovisual", // 70
  "Técnica", // 61
  "Promotor/a", // 16
  "Acreditador/a", // 15
  "Mozo / Camarero", // 13
  "Asistente de producción", // 11
  "Coordinador/a de logística", // 11
  "Cajero/a", // 10
  "Recepcionista", // 8
  "Bartender", // 6
];

/**
 * Whitelist completo de oficios conocidos (V5): items del catálogo + etiquetas
 * del pool + chips frecuentes. Cualquier valor que una chip o el multi-select
 * pueda emitir DEBE estar acá, o el whitelist lo descarta.
 */
export const OFICIOS: string[] = [
  ...new Set([...OFICIOS_ITEMS, ...OFICIOS_EXTRA_POOL, ...OFICIOS_FRECUENTES]),
];

const OFICIOS_SET = new Set(OFICIOS);

/** ¿Es un oficio conocido? (whitelist para search params — V5). */
export function isKnownOficio(value: string): boolean {
  return OFICIOS_SET.has(value);
}
