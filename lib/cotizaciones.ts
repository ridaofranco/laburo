import { siteUrl } from "@/lib/site";

/**
 * Pedidos de cotización: el link del que cotiza, las plantillas de desglose por
 * rubro, y el parseo de la lista de mails pegada.
 *
 * El "por qué" entero de este producto está en LICITACIONES.md, y las tres
 * reglas que lo ordenan viven en la base (migración 0078). Acá está lo que
 * necesita la interfaz.
 */

/** La URL que le llega al que cotiza. El token es opaco y viaja en la ruta. */
export function cotizarUrl(token: string): string {
  return siteUrl(`/cotizar/${encodeURIComponent(token)}`);
}

/** Un campo del desglose que se le pide a cada invitado, además del precio. */
export interface CampoDesglose {
  clave: string;
  etiqueta: string;
}

/**
 * ── LAS PLANTILLAS, Y POR QUÉ EXISTEN ───────────────────────────────────────
 * "Arrancar de cero" es la forma más rápida de escribir un pedido al que le
 * falta el dato que después obliga a quince mails de ida y vuelta. En el caso
 * del pallet, de 45 respuestas 43 eran pedidos de aclaración: casi todas se
 * evitaban preguntando bien la primera vez.
 *
 * ⚠️ Son SUGERENCIAS, no un formulario fijo: se editan y se borran. Es la misma
 * decisión que `lib/categorias-proveedor.ts` (rubro como texto libre), por la
 * misma razón: clavar un formulario por rubro en el código obliga a tocar el
 * código cada vez que aparece un caso que no encaja.
 *
 * ⚠️ Y NINGUNA plantilla pide un requisito como condición para cotizar. La
 * regla 2 dice que un requisito excluyente devuelve cero: "¿tenés portón
 * hidráulico?" va como PREGUNTA, y el que compara decide. Espantar a alguien
 * antes de que cotice es perder una cotización que quizás servía igual.
 */
export const PLANTILLAS: Record<string, CampoDesglose[]> = {
  Logística: [
    { clave: "seguro", etiqueta: "¿El precio incluye seguro? ¿Por qué monto?" },
    { clave: "carga", etiqueta: "¿Incluye carga y descarga, o va por nuestra cuenta?" },
    { clave: "transito", etiqueta: "¿Cuántos días de tránsito?" },
    { clave: "vehiculo", etiqueta: "¿Qué vehículo mandarías? ¿Tiene portón hidráulico?" },
    { clave: "extra_destino", etiqueta: "¿Cuánto costaría sumar un destino más?" },
  ],
  Sonido: [
    { clave: "equipo", etiqueta: "¿Qué equipo entra en el precio? (marca y potencia)" },
    { clave: "tecnico", etiqueta: "¿Viene con técnico? ¿Cuántas horas?" },
    { clave: "armado", etiqueta: "¿Armado y desarme incluidos? ¿Cuántas horas antes?" },
    { clave: "flete", etiqueta: "¿El flete está incluido?" },
  ],
  Iluminación: [
    { clave: "equipo", etiqueta: "¿Qué equipo entra en el precio?" },
    { clave: "tecnico", etiqueta: "¿Viene con técnico? ¿Cuántas horas?" },
    { clave: "estructura", etiqueta: "¿Incluye estructura o trussing?" },
    { clave: "consumo", etiqueta: "¿Cuánto consume? ¿Necesita grupo electrógeno?" },
  ],
  Catering: [
    { clave: "por_persona", etiqueta: "Precio por persona y qué incluye" },
    { clave: "personal", etiqueta: "¿Cuánto personal de servicio y por cuántas horas?" },
    { clave: "vajilla", etiqueta: "¿Vajilla, mantelería y cristalería incluidas?" },
    { clave: "restricciones", etiqueta: "¿Contemplás celíacos, veganos y alergias?" },
    { clave: "minimo", etiqueta: "¿Hay mínimo de personas?" },
    // ⚠️ Esta no es teoría: en CABA casi no hay cocinas de producción para
    // alquilar, así que si el catering necesita cocina EN el lugar y la sede no
    // la tiene, el evento se complica y el precio cambia. Franco la pone en
    // todos sus pedidos de catering, y la IA no la sacó sola.
    { clave: "cocina", etiqueta: "¿Necesitás cocina en el lugar o trabajás con producción externa y traslado?" },
  ],
  Seguridad: [
    { clave: "personas", etiqueta: "¿Cuánta gente y en qué puestos?" },
    { clave: "horas", etiqueta: "¿Cuántas horas entran y cómo se cobra la hora extra?" },
    { clave: "habilitacion", etiqueta: "¿Tenés habilitación vigente para la jurisdicción?" },
    { clave: "art", etiqueta: "¿ART y seguro de responsabilidad civil al día?" },
  ],
  Fotografía: [
    { clave: "horas", etiqueta: "¿Cuántas horas de cobertura?" },
    { clave: "entrega", etiqueta: "¿Cuántas fotos editadas y en cuántos días?" },
    { clave: "adelanto", etiqueta: "¿Entregás un adelanto el mismo día?" },
    { clave: "derechos", etiqueta: "¿Cómo quedan los derechos de uso?" },
  ],
  Estructuras: [
    { clave: "medidas", etiqueta: "¿Qué medidas y qué materiales?" },
    { clave: "montaje", etiqueta: "¿Montaje y desmontaje incluidos? ¿Cuántos días antes?" },
    { clave: "calculo", etiqueta: "¿Entregás cálculo estructural firmado?" },
    { clave: "clima", etiqueta: "¿Resiste viento y lluvia? ¿Hasta cuánto?" },
  ],
  Transporte: [
    { clave: "vehiculos", etiqueta: "¿Qué vehículos y con cuántas plazas?" },
    { clave: "horas", etiqueta: "¿Cuántas horas de disposición entran?" },
    { clave: "chofer", etiqueta: "¿Chofer, combustible y peajes incluidos?" },
    { clave: "espera", etiqueta: "¿Cómo cobrás la hora de espera?" },
  ],
};

/**
 * ── LAS PREGUNTAS QUE NUNCA PUEDEN FALTAR, SEA EL RUBRO QUE SEA ─────────────
 *
 * Hay dos tipos de pregunta en un pedido de precio, y se consiguen de maneras
 * distintas:
 *
 *  · **Las del caso** ("¿tenés rampa para cargar sin autoelevador?"). Salen de
 *    leer el brief, y ahí la IA es muy buena.
 *  · **Las de plaza**: las que valen para cualquier cotización en Argentina, y
 *    que no dependen de lo que diga el brief. Esas NO se le pueden dejar a un
 *    modelo, porque las va a olvidar justo cuando el caso sea interesante.
 *
 * Esta lista es la segunda clase, y sale de comparar el pedido de catering que
 * Franco escribió a mano (5 al 7 de octubre, 100 personas) contra lo que armó
 * la IA con el mismo brief: la IA sacó 4 de las 7 preguntas y sumó 2 buenas,
 * pero se comió las tres que Franco pone SIEMPRE. Y no por casualidad: son las
 * que se aprenden cobrando.
 *
 *  · **El precio desagregado.** Palabras de Franco: *"los paquetes cerrados no
 *    dejan mover nada: si el cliente recorta una cena, con un paquete hay que
 *    volver a pedir todo"*.
 *  · **Validez y actualización.** Con inflación, un precio sin fecha de validez
 *    no es un precio. Es LA pregunta argentina.
 *  · **Anticipo y forma de pago.** Define si el negocio se puede hacer, y no
 *    aparece en ningún brief del mundo.
 *
 * Se suman al final del desglose y solo si no están ya cubiertas, así que
 * cuando la IA hace bien su trabajo no se duplica nada.
 */
export const PREGUNTAS_DE_PLAZA: CampoDesglose[] = [
  { clave: "desagregado", etiqueta: "¿Podés mandarlo desagregado por ítem, y no como un paquete cerrado?" },
  { clave: "validez_precio", etiqueta: "¿Hasta cuándo vale ese precio? ¿Lo actualizás por índice si el evento se corre?" },
  { clave: "pago", etiqueta: "¿Qué forma de pago necesitás y cuánto anticipo pedís para reservar?" },
];

/**
 * Suma las preguntas de plaza que falten, sin duplicar.
 *
 * La comparación es floja a propósito (por palabra clave, sin acentos): si la
 * IA ya preguntó por el anticipo con otras palabras, no se pregunta dos veces.
 * Preferimos perder una de plaza antes que mandarle al proveedor dos preguntas
 * que dicen lo mismo, que es la señal más rápida de que el pedido lo armó una
 * máquina sin mirar.
 */
export function conPreguntasDePlaza(campos: CampoDesglose[]): CampoDesglose[] {
  const norm = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const yaEsta = (claves: string[]) =>
    campos.some((c) => claves.some((k) => norm(c.etiqueta).includes(k)));

  const faltan = PREGUNTAS_DE_PLAZA.filter((p) => {
    if (p.clave === "desagregado") return !yaEsta(["desagreg", "por item", "por separado", "discrimin"]);
    if (p.clave === "validez_precio") return !yaEsta(["validez", "hasta cuando vale", "vale ese precio", "actualiza"]);
    return !yaEsta(["anticipo", "forma de pago", "sena", "pago"]);
  });

  return [...campos, ...faltan];
}

/** El desglose genérico, para el rubro que no tiene plantilla propia. */
export const PLANTILLA_GENERICA: CampoDesglose[] = [
  { clave: "detalle", etiqueta: "¿Qué entra exactamente en ese precio?" },
  { clave: "plazo", etiqueta: "¿En cuánto tiempo lo entregás?" },
  { clave: "extras", etiqueta: "¿Qué cosas se cobrarían aparte?" },
  { clave: "pago", etiqueta: "¿Qué forma de pago necesitás?" },
];

/**
 * La plantilla de un rubro, o la genérica, SIEMPRE con las preguntas de plaza.
 * Nunca devuelve vacío.
 */
export function plantillaDe(categoria: string | null | undefined): CampoDesglose[] {
  const c = (categoria ?? "").trim();
  return conPreguntasDePlaza(PLANTILLAS[c] ?? PLANTILLA_GENERICA);
}

/** Un invitado, tal como lo manda la pantalla. */
export interface InvitadoNuevo {
  email: string;
  nombre?: string | null;
  profileId?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parsea la lista pegada. Acepta lo que sale de una planilla o de un mail:
 * uno por línea, separados por coma o punto y coma, y las formas
 * `Nombre <mail@x.com>` y `mail@x.com, Nombre`.
 *
 * ⚠️ Deduplica por mail en minúscula ANTES de mandar nada. La base también lo
 * corta (índice único sobre `(request_id, lower(email))`), pero hacerlo acá es
 * lo que permite decir "de los 40 que pegaste, 3 estaban repetidos" en vez de
 * que desaparezcan en silencio.
 */
export function parsearInvitados(texto: string): {
  invitados: InvitadoNuevo[];
  repetidos: number;
  invalidos: string[];
} {
  const vistos = new Set<string>();
  const invitados: InvitadoNuevo[] = [];
  const invalidos: string[] = [];
  let repetidos = 0;

  const crudos = (texto || "")
    .split(/[\n;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const crudo of crudos) {
    // `Nombre <mail@x.com>` → nombre + mail.
    const conAngulos = crudo.match(/^(.*?)<([^>]+)>$/);
    const email = (conAngulos ? conAngulos[2] : crudo).trim().toLowerCase();
    const nombre = conAngulos ? conAngulos[1].trim().replace(/^["']|["']$/g, "") : "";

    if (!EMAIL_RE.test(email)) {
      invalidos.push(crudo);
      continue;
    }
    if (vistos.has(email)) {
      repetidos += 1;
      continue;
    }
    vistos.add(email);
    invitados.push({ email, nombre: nombre || null });
  }

  return { invitados, repetidos, invalidos };
}

/** Monto en pesos (o la moneda que sea), formateado es-AR. */
export function fmtMonto(monto: number | string | null | undefined, moneda = "ARS"): string {
  const n = typeof monto === "string" ? Number(monto) : monto;
  if (n == null || Number.isNaN(n)) return "";
  const simbolo = moneda === "USD" ? "USD " : "$";
  return `${simbolo}${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}
