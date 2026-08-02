/**
 * EL FORMULARIO DE CONSULTA DEL PROVEEDOR.
 *
 * ── QUÉ REEMPLAZA (decisión de Franco, 2/8) ──
 * La Fase 3 salió contactando al proveedor por WhatsApp o por un `mailto:`. Los
 * dos abren una app de afuera con un mensaje vacío, así que el proveedor recibía
 * "hola, te escribo por un evento" y tenía que preguntar todo de cero: qué día,
 * dónde, para cuánta gente. Franco lo cortó de raíz: **la consulta se llena en un
 * formulario acá adentro y le llega al proveedor a su mail, ya completa.**
 *
 * ── POR QUÉ EL PROVEEDOR PUEDE ARMAR EL SUYO ──
 * Porque nadie sabe mejor que él qué necesita saber para poder cotizar. Un
 * catering pregunta cuántos cubiertos y si hay celíacos; un servicio de sonido
 * pregunta si es al aire libre y cuántos kW hay disponibles. Un formulario único
 * armado por nosotros les serviría a medias a todos.
 *
 * Pero armar un formulario es trabajo, y el proveedor entró a LABURO a conseguir
 * clientes, no a configurar. Por eso el default es el TEMPLATE de acá abajo: si
 * no toca nada, su formulario ya funciona desde el minuto cero. Armar el propio
 * es la opción, no el requisito.
 *
 * ── POR QUÉ ESTE ARCHIVO NO TIENE DIRECTIVA ──
 * Lo importan los tres mundos, igual que acceso-proveedor/[token]/estados.ts: el
 * server component que renderiza, el Server Action que valida y los client
 * components que editan. Los topes se escriben UNA vez acá y se vuelven a
 * chequear en la base, que es la única fuente de verdad (un cliente se puede
 * saltear, la RPC no).
 */

/** Los tipos de campo que puede poner un proveedor en su formulario. */
export type TipoCampo = "texto" | "parrafo" | "numero" | "fecha" | "opciones";

export interface CampoFormulario {
  /** Estable y propio del campo. Sobrevive a que se le cambie la etiqueta. */
  id: string;
  /** Lo que lee quien consulta: "¿Para cuántas personas?". */
  label: string;
  tipo: TipoCampo;
  requerido: boolean;
  /** Solo para tipo 'opciones'. En el resto va vacío. */
  opciones: string[];
}

/**
 * Topes. Están para que un formulario siga siendo un formulario y no una
 * encuesta de 40 preguntas que nadie completa: cada campo que el proveedor
 * agrega es gente que abandona antes de mandarle la consulta.
 *
 * Se revalidan en la RPC. Estos números tienen que ser IGUALES a los de la
 * migración 0058; si cambian, cambian en los dos lados.
 */
export const TOPES = {
  MAX_CAMPOS: 12,
  MAX_LABEL: 120,
  MAX_OPCIONES: 12,
  MAX_LARGO_OPCION: 60,
  MAX_RESPUESTA: 2000,
  MAX_INTRO: 400,
} as const;

/**
 * EL TEMPLATE DE SOMOS DER. Lo que ve una productora si el proveedor no tocó
 * nada, y el punto de partida cuando elige armar el suyo.
 *
 * Son las seis cosas sin las cuales NINGÚN proveedor de eventos puede cotizar,
 * sacadas de cómo SOMOS DER pide presupuestos hoy: qué evento es, cuándo, dónde,
 * para cuánta gente, qué necesita y con cuánta plata cuenta. El resto es propio
 * de cada rubro y por eso no está acá.
 *
 * El presupuesto va último y NO es obligatorio a propósito: es la pregunta que
 * más incomoda, y ponerla arriba o exigirla hace que la gente cierre la pantalla.
 */
export const TEMPLATE_CONSULTA: CampoFormulario[] = [
  {
    id: "tipo_evento",
    label: "¿Qué tipo de evento es?",
    tipo: "opciones",
    requerido: true,
    opciones: [
      "Corporativo",
      "Fiesta privada",
      "Casamiento",
      "Recital o festival",
      "Institucional",
      "Otro",
    ],
  },
  {
    id: "fecha_evento",
    label: "¿Qué día es?",
    tipo: "fecha",
    requerido: true,
    opciones: [],
  },
  {
    id: "lugar",
    label: "¿Dónde es? (lugar y localidad)",
    tipo: "texto",
    requerido: true,
    opciones: [],
  },
  {
    id: "cantidad",
    label: "¿Para cuántas personas?",
    tipo: "numero",
    requerido: false,
    opciones: [],
  },
  {
    id: "detalle",
    label: "Contale qué necesitás",
    tipo: "parrafo",
    requerido: true,
    opciones: [],
  },
  {
    id: "presupuesto",
    label: "¿Tenés un presupuesto aproximado? (opcional)",
    tipo: "texto",
    requerido: false,
    opciones: [],
  },
];

/** Los campos que hay que mostrar: los suyos si armó, si no el template. */
export function camposAMostrar(campos: CampoFormulario[] | null | undefined): CampoFormulario[] {
  return campos && campos.length > 0 ? campos : TEMPLATE_CONSULTA;
}

/** ¿Este proveedor armó el suyo, o está usando el nuestro? */
export function usaTemplate(campos: CampoFormulario[] | null | undefined): boolean {
  return !campos || campos.length === 0;
}

/** Un campo nuevo en blanco, para el botón de agregar. */
export function campoNuevo(): CampoFormulario {
  return {
    // crypto.randomUUID existe en el navegador moderno y en Node 19+. El id no
    // es un secreto ni una clave de base, solo tiene que ser único adentro del
    // mismo formulario.
    id: `c_${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    tipo: "texto",
    requerido: false,
    opciones: [],
  };
}

export const NOMBRE_TIPO: Record<TipoCampo, string> = {
  texto: "Respuesta corta",
  parrafo: "Respuesta larga",
  numero: "Un número",
  fecha: "Una fecha",
  opciones: "Elegir de una lista",
};

/**
 * Valida lo que el proveedor armó, del lado del cliente, para poder decirle qué
 * está mal ANTES de mandar. La base vuelve a validar lo mismo: esto es cortesía,
 * no seguridad.
 *
 * Devuelve el primer problema en castellano, o null si está todo bien.
 */
export function validarCampos(campos: CampoFormulario[]): string | null {
  if (campos.length > TOPES.MAX_CAMPOS) {
    return `Son demasiadas preguntas (máximo ${TOPES.MAX_CAMPOS}). Cuantas más ponés, menos gente termina de completarlo.`;
  }
  const vistos = new Set<string>();
  for (const c of campos) {
    const label = c.label.trim();
    if (!label) return "Hay una pregunta sin texto. Escribila o borrala.";
    if (label.length > TOPES.MAX_LABEL) {
      return `"${label.slice(0, 30)}…" es muy larga (máximo ${TOPES.MAX_LABEL} caracteres).`;
    }
    const clave = label.toLowerCase();
    if (vistos.has(clave)) return `La pregunta "${label}" está repetida.`;
    vistos.add(clave);

    if (c.tipo === "opciones") {
      const ops = c.opciones.map((o) => o.trim()).filter(Boolean);
      if (ops.length < 2) {
        return `"${label}" es de elegir de una lista, así que necesita al menos dos opciones.`;
      }
      if (ops.length > TOPES.MAX_OPCIONES) {
        return `"${label}" tiene demasiadas opciones (máximo ${TOPES.MAX_OPCIONES}).`;
      }
      if (ops.some((o) => o.length > TOPES.MAX_LARGO_OPCION)) {
        return `Hay una opción de "${label}" demasiado larga (máximo ${TOPES.MAX_LARGO_OPCION} caracteres).`;
      }
    }
  }
  return null;
}

/** Una respuesta ya cargada, tal como viaja a la base y al mail. */
export interface RespuestaConsulta {
  /** Se guarda la ETIQUETA, no solo el id: si el proveedor cambia el formulario
   *  mañana, la consulta vieja tiene que seguir leyéndose tal como se hizo. */
  label: string;
  valor: string;
}

/**
 * Chequea lo que completó quien consulta contra el formulario del proveedor.
 * Devuelve el primer faltante en castellano, o null.
 */
export function validarRespuestas(
  campos: CampoFormulario[],
  valores: Record<string, string>,
): string | null {
  for (const c of campos) {
    const v = (valores[c.id] ?? "").trim();
    if (c.requerido && !v) return `Falta completar "${c.label}".`;
    if (v.length > TOPES.MAX_RESPUESTA) {
      return `La respuesta de "${c.label}" es demasiado larga.`;
    }
    if (v && c.tipo === "numero" && !/^\d+([.,]\d+)?$/.test(v)) {
      return `"${c.label}" tiene que ser un número.`;
    }
  }
  return null;
}

/** Pasa el formulario completado a la forma que se guarda y se manda por mail. */
export function aRespuestas(
  campos: CampoFormulario[],
  valores: Record<string, string>,
): RespuestaConsulta[] {
  return campos
    .map((c) => ({ label: c.label.trim(), valor: (valores[c.id] ?? "").trim() }))
    .filter((r) => r.valor !== "");
}
