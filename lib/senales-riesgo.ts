/**
 * SEÑALES DE RIESGO EN UNA BÚSQUEDA PUBLICADA.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 * Franco decidió el 2/8 que nadie aprueba las búsquedas antes de publicar. Es la
 * decisión correcta para que el marketplace arranque, y mueve el riesgo de
 * "antes" a "después": cuando ve una búsqueda que discrimina, ya se publicó.
 *
 * Esto no bloquea nada y no reemplaza el criterio de nadie. Solo levanta la mano
 * para que, en una lista de cien, mire primero las cinco que valen la pena.
 *
 * ── LO QUE MIRA, Y POR QUÉ CADA UNA ──────────────────────────────────────────
 * · Sin pago declarado: es lo que más hace que la gente no se postule, y una
 *   búsqueda sin monto es la que después termina en discusión.
 * · Palabras de discriminación: edad, género, nacionalidad y apariencia. En
 *   Argentina un aviso que pide "buena presencia" o "hasta 25 años" es
 *   discriminatorio y es el tipo de cosa por la que le reclaman a la PLATAFORMA,
 *   no a la productora.
 * · Promesa de relación laboral: es el riesgo que Franco ya tenía anotado desde
 *   el 26/7 y por el que el mail de bienvenida NO dice "sos parte del equipo".
 *   Quien está en el pool no es empleado, y escribirlo se usa después para
 *   reclamar una relación que no existe.
 *
 * Las listas se leen sin acentos y en minúscula, así "jóvenes" y "jovenes"
 * pegan igual.
 */

export interface Senal {
  clave: string;
  texto: string;
  /** alta = miralo ya. media = conviene mirarlo. */
  nivel: "alta" | "media";
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const DISCRIMINACION = [
  "buena presencia",
  "excelente presencia",
  "muy buena presencia",
  "solo mujeres",
  "solo hombres",
  "solo chicas",
  "solo chicos",
  "unicamente mujeres",
  "unicamente hombres",
  "sexo femenino",
  "sexo masculino",
  "menores de 25",
  "menores de 30",
  "hasta 25 anos",
  "hasta 30 anos",
  "no mayores de",
  "edad maxima",
  "solo argentinos",
  "sin extranjeros",
  "argentinos unicamente",
  "sin tatuajes",
  "sin sobrepeso",
  "buena figura",
];

const RELACION_LABORAL = [
  "en relacion de dependencia",
  "efectivizacion",
  "efectivizado",
  "puesto fijo",
  "trabajo estable",
  "contrato indeterminado",
  "sos parte del equipo",
  "formaras parte del equipo",
  "empleado de planta",
  "obra social",
  "aguinaldo",
  "vacaciones pagas",
];

/**
 * Devuelve las señales de una búsqueda. Vacío = nada que mirar.
 * `pago` en null o 0 cuenta como sin declarar.
 */
export function senalesDeRiesgo(input: {
  role: string | null;
  notas: string | null;
  pago: number | null;
}): Senal[] {
  const out: Senal[] = [];
  const texto = norm(`${input.role ?? ""} ${input.notas ?? ""}`);

  if (input.pago == null || Number(input.pago) <= 0) {
    out.push({
      clave: "sin_pago",
      texto: "No declara cuánto se paga",
      nivel: "media",
    });
  }

  const disc = DISCRIMINACION.filter((f) => texto.includes(f));
  if (disc.length) {
    out.push({
      clave: "discriminacion",
      texto: `Puede discriminar: "${disc[0]}"`,
      nivel: "alta",
    });
  }

  const rel = RELACION_LABORAL.filter((f) => texto.includes(f));
  if (rel.length) {
    out.push({
      clave: "relacion_laboral",
      texto: `Sugiere relación de dependencia: "${rel[0]}"`,
      nivel: "alta",
    });
  }

  return out;
}
