/**
 * Normalizador de `cv_data` (la ficha que Gemini extrajo de cada CV).
 *
 * POR QUÉ ES TOLERANTE: los 660 CVs se procesaron en julio con un prompt que pedía
 * `{titular, experiencia[], formacion[], oficios[], idiomas[]}`, pero un modelo
 * extrayendo texto libre de 660 archivos distintos no devuelve siempre la misma
 * forma: a veces `puesto`, a veces `rol` o `cargo`; a veces un objeto con campos,
 * a veces una sola línea de texto. Si la pantalla asume UNA forma exacta, alcanza
 * con que 20 fichas vengan distintas para que 20 perfiles se vean vacíos o rotos.
 *
 * Así que acá se acepta todo lo razonable y se devuelve UNA forma predecible. Lo
 * que no se entiende se descarta en silencio: es mejor mostrar 3 de 4 experiencias
 * que romper la pantalla.
 *
 * NUNCA tira: cualquier basura devuelve una ficha vacía y el caller cae al PDF.
 */

export interface CvItem {
  /** Puesto / rol / título del ítem. */
  titulo: string;
  /** Empresa, organización o institución. */
  lugar?: string;
  /** Período: "2019 - 2022", "marzo 2023", lo que haya. */
  periodo?: string;
  /** Descripción libre. */
  detalle?: string;
}

export interface CvFichaData {
  titular?: string;
  experiencia: CvItem[];
  formacion: CvItem[];
  oficios: string[];
  idiomas: string[];
  /** true si hay algo que valga la pena mostrar. */
  hayAlgo: boolean;
}

const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

/** Primer valor no vacío entre varias claves posibles. */
function pick(o: Record<string, unknown>, claves: string[]): string {
  for (const k of claves) {
    const v = txt(o[k]);
    if (v) return v;
  }
  return "";
}

/** Une desde/hasta cuando el período viene partido en dos campos. */
function periodoDe(o: Record<string, unknown>): string {
  const directo = pick(o, ["periodo", "período", "fechas", "fecha", "anios", "años", "duracion", "duración"]);
  if (directo) return directo;
  const desde = pick(o, ["desde", "inicio", "from", "start", "anio_inicio"]);
  const hasta = pick(o, ["hasta", "fin", "to", "end", "anio_fin"]);
  if (desde && hasta) return `${desde} a ${hasta}`;
  return desde || hasta || "";
}

function item(v: unknown): CvItem | null {
  // Caso simple: la experiencia vino como una línea de texto.
  if (typeof v === "string") {
    const t = v.trim();
    return t ? { titulo: t } : null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;

  const titulo = pick(o, [
    "puesto", "rol", "cargo", "titulo", "título", "position", "role", "nombre", "carrera", "estudio",
  ]);
  const lugar = pick(o, [
    "empresa", "organizacion", "organización", "lugar", "company", "institucion", "institución",
    "establecimiento", "cliente", "evento",
  ]);
  const periodo = periodoDe(o);
  const detalle = pick(o, ["detalle", "descripcion", "descripción", "tareas", "resumen", "notas", "observaciones"]);

  // Si no hay ni título ni lugar, no hay nada que mostrar como encabezado: se usa
  // el detalle como título antes de descartarlo.
  if (!titulo && !lugar) {
    return detalle ? { titulo: detalle } : null;
  }
  return {
    titulo: titulo || lugar,
    lugar: titulo ? lugar || undefined : undefined,
    periodo: periodo || undefined,
    detalle: detalle || undefined,
  };
}

function lista(v: unknown): CvItem[] {
  if (Array.isArray(v)) return v.map(item).filter((x): x is CvItem => !!x);
  // Un string con saltos de línea o punto y coma también sirve.
  if (typeof v === "string") {
    return v
      .split(/\n|;|·/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ titulo: s }));
  }
  return [];
}

function strings(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x.trim() : txt((x as Record<string, unknown>)?.nombre ?? (x as Record<string, unknown>)?.idioma ?? "")))
      .filter(Boolean);
  }
  if (typeof v === "string") {
    return v.split(/,|\n|;|·/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const VACIA: CvFichaData = { experiencia: [], formacion: [], oficios: [], idiomas: [], hayAlgo: false };

/** Convierte el jsonb crudo en algo que la pantalla pueda renderizar sin sorpresas. */
export function normalizarCv(raw: unknown): CvFichaData {
  try {
    let data = raw;
    // A veces el jsonb quedó guardado como string JSON.
    if (typeof data === "string") {
      const t = data.trim();
      if (!t) return VACIA;
      try {
        data = JSON.parse(t);
      } catch {
        // Texto suelto que no es JSON: no es una ficha, es basura o el mensaje de
        // error de la extracción. Se devuelve vacía para que el perfil caiga al
        // PDF, en vez de mostrar esa línea como si fuera el resumen del CV.
        return VACIA;
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return VACIA;
    const o = data as Record<string, unknown>;

    const titular = pick(o, ["titular", "resumen", "perfil", "headline", "summary", "sobre_mi"]);
    const experiencia = lista(o.experiencia ?? o.experience ?? o.trabajos ?? o.laboral);
    const formacion = lista(o.formacion ?? o["formación"] ?? o.educacion ?? o["educación"] ?? o.estudios);
    const oficios = strings(o.oficios ?? o.skills ?? o.habilidades ?? o.rubros);
    const idiomas = strings(o.idiomas ?? o.languages);

    const hayAlgo = !!(titular || experiencia.length || formacion.length || oficios.length || idiomas.length);
    return { titular: titular || undefined, experiencia, formacion, oficios, idiomas, hayAlgo };
  } catch {
    return VACIA;
  }
}
