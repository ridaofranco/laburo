import type { CSSProperties } from "react";

/**
 * EL TAMAÑO DEL TÍTULO SEGÚN EL TEXTO (26/11).
 *
 * Los h1 de las fichas (el nombre lo escribe el proveedor o el salón), de las
 * notas del blog y de /para tenían un solo tamaño, pensado para un texto
 * corto. Con uno largo el título se partía en 6, 8 y hasta 13 renglones, con
 * palabras cortadas por la mitad, y empujaba todo lo demás fuera de pantalla.
 *
 * Acá se calcula, en el servidor, el tamaño más grande con el que ese texto
 * entra en pocos renglones. Un título corto queda como estaba.
 *
 * LA CUENTA. Syne extrabold en mayúsculas es MUY ancha (más de 1 em por
 * letra, y la M y la W bastante más), así que no alcanza con contar letras:
 * `ANCHO` tiene el ancho real de cada una, medido en el navegador. Con eso,
 * para que un texto de E em entre en R renglones de una caja de C px:
 *
 *     tamaño = C × factor / (E / R + holgura)
 *
 * `holgura` es lo que se pierde por renglón al cortar por palabra y `factor`
 * un margen. Los dos salieron de probar TODOS los títulos y nombres
 * publicados al 26/11 (552 notas, 107 fichas) y quedarse con el peor caso.
 * Aparte, la palabra más larga tiene que entrar entera en la caja.
 *
 * Lo vigila `scripts/control-visual.mjs` antes de cada publicación.
 */

/** Ancho de cada letra en em, con `tracking-tighter` (-0.05em) ya restado. */
const ANCHO: Record<string, number> = {
  A: 1.11, B: 1.09, C: 1.27, D: 1.25, E: 1.09, F: 1.08, G: 1.29, H: 1.23,
  I: 0.37, J: 0.95, K: 1.16, L: 0.89, M: 1.53, N: 1.25, O: 1.28, P: 1.13,
  Q: 1.28, R: 1.18, S: 1.01, T: 1.05, U: 1.24, V: 1.11, W: 1.83, X: 1.09,
  Y: 1.02, Z: 1.15,
  "0": 1.02, "1": 0.48, "2": 0.95, "3": 1.01, "4": 1.04, "5": 0.97,
  "6": 1.08, "7": 1.09, "8": 1.03, "9": 1.11,
  " ": 0.26, ".": 0.3, ",": 0.25, ":": 0.3, ";": 0.3, "!": 0.34, "?": 0.81,
  "(": 0.36, ")": 0.36, "/": 0.44, "-": 0.54, "·": 0.3, "&": 1.17, "'": 0.25,
  "’": 0.25, "+": 0.73, "@": 1.45,
};
const ANCHO_DESCONOCIDO = 1.15;

/** Ancho de un texto en em, en mayúsculas y sin contar los acentos. */
function anchoEm(texto: string, interletra = 0): number {
  let total = 0;
  for (const letra of texto.toUpperCase().normalize("NFD")) {
    if (/\p{M}/u.test(letra)) continue; // el acento va arriba, no ocupa ancho
    total += (ANCHO[letra] ?? ANCHO_DESCONOCIDO) + interletra;
  }
  return total;
}

type Ajuste = {
  /** Tamaño máximo de la plantilla, el del escritorio (px). */
  tope: number;
  /** Tamaño mínimo de la plantilla, el del celular (px). */
  base: number;
  /** Ancho de la caja del título a 1440 px y en un celular de 360 px (los
   *  Android más comunes; a 390 sobra un poco). */
  cajaEscritorio: number;
  cajaCelular: number;
  /** Renglones que puede ocupar; sin esto solo se cuida la palabra larga. */
  renglonesEscritorio?: number;
  renglonesCelular?: number;
  holgura: number;
  factor: number;
  /** Diferencia de interletra con `tracking-tighter`, en em. */
  interletra?: number;
  /** Que la palabra más larga entre entera en un renglón. */
  cuidarPalabra: boolean;
  piso: number;
};

function medidas(texto: string | null | undefined, a: Ajuste) {
  const limpio = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  const total = anchoEm(limpio, a.interletra);
  const palabra = Math.max(...limpio.split(" ").map((p) => anchoEm(p, a.interletra)));

  const tamano = (limite: number, caja: number, renglones?: number) => {
    let t = limite;
    if (renglones) t = Math.min(t, (caja * a.factor) / (total / renglones + a.holgura));
    if (a.cuidarPalabra) t = Math.min(t, (caja * 0.97) / palabra);
    return Math.floor(Math.max(a.piso, t));
  };
  const max = tamano(a.tope, a.cajaEscritorio, a.renglonesEscritorio);
  const min = Math.min(max, tamano(a.base, a.cajaCelular, a.renglonesCelular));
  return { min, max, palabra, igualQueLaPlantilla: max >= a.tope && min >= a.base };
}

/**
 * Fichas de /servicios/<slug> y /salones/<slug>: hasta 4 renglones en
 * escritorio y 6 en celular, sin palabras cortadas.
 *
 * Devuelve variables CSS y no un `fontSize` porque la caja cambia de forma
 * con la pantalla: hasta 1024 px el nombre va a todo el ancho y desde ahí en
 * media pantalla (50vw − 144px: 576 px a 1440, 368 px a 1024). La clase
 * `CLASE_TITULO_FICHA` usa las variables en los dos casos: abajo de 1024 el
 * tamaño crece como siempre (5vw, en proporción al mínimo) y de 1024 en
 * adelante acompaña al ancho de la columna. Antes, a 1024 px se
 * cortaban hasta nombres cortos («NOMADE», «DOCTOR BUS»).
 */
export function estiloTituloFicha(nombre: string | null | undefined): CSSProperties | undefined {
  const m = medidas(nombre, {
    tope: 64,
    base: 32,
    cajaEscritorio: 576,
    cajaCelular: 312,
    renglonesEscritorio: 4,
    renglonesCelular: 6,
    holgura: 3,
    factor: 0.89,
    cuidarPalabra: true,
    piso: 15,
  });
  if (!m) return undefined;
  return {
    "--t-min": `${m.min}px`,
    "--t-max": `${m.max}px`,
    "--t-esc": (m.max / 576).toFixed(4),
    "--t-f": (m.min / 32).toFixed(4),
  } as CSSProperties;
}

/** Tamaño del h1 de las fichas. Sin variables queda como siempre:
 *  clamp(32px, 5vw, 64px). */
export const CLASE_TITULO_FICHA =
  "text-[length:clamp(var(--t-min,32px),calc(5vw_*_var(--t-f,1)),var(--t-max,64px))] lg:text-[length:clamp(var(--t-min,32px),calc((50vw_-_144px)_*_var(--t-esc,0.1111)),var(--t-max,64px))]";

/**
 * Notas del blog (los 5 idiomas) y de /para/<slug>: plantilla en
 * clamp(21px,4vw,50px) dentro de una caja de 900 px; hasta 5 renglones en
 * escritorio y 8 en celular. Tienen `hyphens:auto`, así que no hace falta
 * cuidar la palabra más larga. Si el título entra con el tamaño de la
 * plantilla devuelve `undefined` y no cambia nada.
 */
export function estiloTituloNota(titulo: string | null | undefined): CSSProperties | undefined {
  const m = medidas(titulo, {
    tope: 50,
    base: 21,
    cajaEscritorio: 900,
    cajaCelular: 312,
    renglonesEscritorio: 5,
    renglonesCelular: 8,
    holgura: 4,
    factor: 0.86,
    interletra: 0.025, // `tracking-tight`, no `tighter`
    cuidarPalabra: false,
    piso: 16,
  });
  if (!m || m.igualQueLaPlantilla) return undefined;
  // De 1060 px para abajo la caja mide 100vw − 160px: el tamaño la acompaña.
  return {
    fontSize: `clamp(${m.min}px, calc((100vw - 160px) * ${(m.max / 900).toFixed(4)}), ${m.max}px)`,
  };
}

/**
 * Portada del blog en cada idioma: dos renglones gigantes en
 * clamp(44px,10vw,120px). Acá el problema no es el largo sino UNA palabra:
 * «COSTRUISCE» (it), «TOGETHER.» (en) y «COMMENT» (fr) no entran en un
 * celular a 44 px y la página se corría al costado. El tamaño se achica solo
 * lo necesario para que la palabra más larga entre en la caja.
 */
export function estiloPortadaBlog(renglones: readonly string[]): CSSProperties | undefined {
  const m = medidas(renglones.join(" "), {
    tope: 120,
    base: 44,
    cajaEscritorio: 1280,
    cajaCelular: 312,
    holgura: 0,
    factor: 1,
    cuidarPalabra: true,
    piso: 24,
  });
  if (!m || m.igualQueLaPlantilla) return undefined;
  return {
    fontSize: `clamp(${m.min}px, min(10vw, calc((100vw - 160px) * ${(0.97 / m.palabra).toFixed(4)})), ${m.max}px)`,
  };
}
