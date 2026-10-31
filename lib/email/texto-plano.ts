/**
 * La versión en texto plano de un mail, armada desde su HTML.
 *
 * Ningún mail de LABURO llevaba `text`: solo HTML. Algunos clientes (y los
 * filtros de spam) miran que exista la parte de texto, y el que lee en un reloj
 * o con un lector de pantalla recibe eso. Se arma acá, en un solo lugar, para
 * que el mailer la sume a todos los envíos sin tocar cada plantilla.
 *
 * No es un conversor general: alcanza para el HTML de react-email (tablas,
 * párrafos, links y botones). Los links quedan como «texto (url)».
 */

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
  laquo: "«",
  raquo: "»",
  middot: "·",
  ndash: "–",
  hellip: "…",
};

function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (ENTIDADES[k] !== undefined) return ENTIDADES[k];
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return m;
  });
}

export function htmlATexto(html: string): string {
  let s = html;
  // Lo que no se lee: head, estilos, scripts y el texto de vista previa oculto.
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, "");
  // Links: «texto (url)»; si el texto ya es la url, una sola vez.
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, txt: string) => {
    const t = decodificar(txt.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const url = decodificar(href);
    if (!url || url.startsWith("#")) return t;
    if (!t || t === url) return url;
    return `${t} (${url})`;
  });
  s = s.replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|tr|li|table|section)>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "- ");
  s = s.replace(/<\/t[dh]>/gi, " ");
  s = s.replace(/<hr\b[^>]*>/gi, "\n---\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodificar(s);
  // Espacios: sin los invisibles que mete react-email, renglones limpios y a lo
  // sumo una línea en blanco seguida.
  s = s.replace(/[\u200b-\u200f\u2028\u2029\u00ad\u034f\ufeff]/g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}
