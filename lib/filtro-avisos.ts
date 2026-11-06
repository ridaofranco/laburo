/**
 * FILTRO DE PALABRAS AL PUBLICAR UNA BÚSQUEDA (Franco 31/10, plan fase 2 punto 7).
 *
 * Dos niveles:
 * · PROHIBIDO: no se publica. Pedirle plata al postulante (inscripción, curso,
 *   adelanto, seña) o discriminar de forma explícita (edad, sexo, aspecto,
 *   nacionalidad). La persona ve qué frase lo frenó y por qué.
 * · DUDOSO: se crea, pero queda bajada «en revisión» (moderada_at, 0106) hasta que
 *   alguien la mira en /plataforma. Son frases que a veces tienen una razón válida
 *   (un vestuario con talle, «mayores de 18») y a veces esconden un pedido ilegal.
 *
 * Se lee sin acentos y en minúscula. Las frases de discriminación salen de
 * lib/senales-riesgo.ts para no tener dos listas que se separen.
 */

import { DISCRIMINACION } from "@/lib/senales-riesgo";

export function normalizar(s: string): string {
  return ` ${s}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$]+/g, " ")
    .replace(/\s+/g, " ")
    .concat(" ");
}

type Regla = { re: RegExp; porque: string };

const PLATA = "LABURO no permite pedirle plata a quien se postula.";
const DISCRIMINA = "En Argentina un aviso no puede pedir edad, sexo, aspecto ni nacionalidad (ley 23.592).";

const PROHIBIDO: Regla[] = [
  { re: / (abonar|pagar|pagas|pagan|abonas|abona) (una |la |el |un )?(inscripcion|matricula|curso|capacitacion|kit|uniforme|book|credencial|seguro|alta) /, porque: PLATA },
  { re: / (costo|valor|arancel) (de )?(la |el )?(inscripcion|matricula|capacitacion|curso|book) /, porque: PLATA },
  { re: / (inscripcion|matricula|capacitacion) (paga|arancelada|con costo) /, porque: PLATA },
  { re: / (adelanto|anticipo|sena|deposito|transferencia) (previ[oa] |de \$|para (reservar|asegurar|confirmar)|a cargo del postulante)/, porque: PLATA },
  { re: / (reserva|asegura|confirma) tu lugar (con|abonando|pagando) /, porque: PLATA },
  { re: / (deben|debes|tenes que|tienen que|hay que) (pagar|abonar|transferir|depositar) /, porque: PLATA },
  { re: / (menores|mayores) de (2[0-9]|3[0-9]|4[0-9]|5[0-9]) /, porque: DISCRIMINA },
  { re: / (de|entre) (1[89]|[2-5][0-9]) (a|y) ([2-6][0-9]) anos /, porque: DISCRIMINA },
  { re: / (hasta|maximo|max) (2[0-9]|3[0-9]|4[0-9]) anos /, porque: DISCRIMINA },
  { re: / (solo|unicamente|exclusivamente) (mujeres|hombres|chicas|chicos|varones|senoritas|argentinos|argentinas) /, porque: DISCRIMINA },
  { re: / (sin|no) (extranjeros|tatuajes|sobrepeso|piercings) /, porque: DISCRIMINA },
  { re: / (buena|excelente|muy buena|linda) (presencia|figura|apariencia|imagen fisica) /, porque: DISCRIMINA },
  { re: / (sexo|genero) (femenino|masculino) /, porque: DISCRIMINA },
  { re: / (delgad[oa]s?|flac[oa]s?|rubi[oa]s?|tez blanca|sin canas) /, porque: DISCRIMINA },
];

const DUDOSO: Regla[] = [
  { re: / (jovenes|joven|edad|anos de edad|maximo de edad) /, porque: "menciona la edad" },
  { re: / (altura|estatura|talle|medidas|peso) /, porque: "menciona el cuerpo o el talle" },
  { re: / (presencia|apariencia|aspecto|fisico|atractiv[oa]s?|lind[oa]s?) /, porque: "menciona el aspecto" },
  { re: / (foto de cuerpo|foto cuerpo entero|fotos en malla|book) /, porque: "pide fotos del cuerpo" },
  { re: / (femenin[oa]s?|masculin[oa]s?|mujer|mujeres|hombre|hombres|chicas|chicos|varon|varones|promotoras) /, porque: "menciona el sexo" },
  { re: / (nacionalidad|argentin[oa]s?|extranjer[oa]s?|dni argentino) /, porque: "menciona la nacionalidad" },
  { re: / (pagar|abonar|transferir|deposit|adelanto|anticipo|sena|inscripcion|matricula|curso|capacitacion paga|costo) /, porque: "habla de plata que podría pagar quien se postula" },
];

export type ResultadoFiltro =
  | { nivel: "ok" }
  | { nivel: "prohibido"; frase: string; mensaje: string }
  | { nivel: "dudoso"; frase: string; motivo: string };

function encontrar(texto: string, reglas: Regla[]): { frase: string; porque: string } | null {
  for (const r of reglas) {
    const m = texto.match(r.re);
    if (m) return { frase: m[0].trim(), porque: r.porque };
  }
  return null;
}

/** Devuelve la frase tal como la escribió la persona (con acentos y ñ). */
function original(crudo: string, frase: string): string {
  const palabras = crudo.split(/\s+/).filter(Boolean);
  const buscadas = frase.split(" ");
  for (let i = 0; i < palabras.length; i++) {
    let j = i;
    let k = 0;
    while (j < palabras.length && k < buscadas.length) {
      const n = normalizar(palabras[j]).trim().split(" ");
      if (n.length === 1 && n[0] === "") { j++; continue; }
      if (n.some((x, idx) => x !== buscadas[k + idx])) break;
      k += n.length;
      j++;
    }
    if (k >= buscadas.length) return palabras.slice(i, j).join(" ").replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}]+$/gu, "");
  }
  return frase;
}

export function filtrarAviso(input: { role?: string | null; notas?: string | null }): ResultadoFiltro {
  const crudo = `${input.role ?? ""} ${input.notas ?? ""}`;
  const texto = normalizar(crudo);

  const p = encontrar(texto, PROHIBIDO);
  const lista = DISCRIMINACION.find((f) => texto.includes(` ${f} `));
  if (p || lista) {
    const frase = original(crudo, p?.frase ?? lista!);
    const porque = p?.porque ?? DISCRIMINA;
    return {
      nivel: "prohibido",
      frase,
      mensaje: `No se puede publicar: «${frase}». ${porque} Sacalo y volvé a intentar.`,
    };
  }

  const d = encontrar(texto, DUDOSO);
  if (d) {
    const frase = original(crudo, d.frase);
    return { nivel: "dudoso", frase, motivo: `En revisión: ${d.porque} («${frase}»)` };
  }

  return { nivel: "ok" };
}
