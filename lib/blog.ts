import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";

/**
 * Motor del blog de LABURO.
 *
 * Los posts son archivos .md en `content/blog/`, con frontmatter YAML. Se leen
 * en build time (las rutas son estáticas vía generateStaticParams), así que no
 * hay ni una query ni un fetch en runtime: el blog es HTML plano servido desde
 * el CDN.
 *
 * El frontmatter replica el del blog de somosder-web (el motor maduro del
 * ecosistema) para que un post se pueda mover de un lado al otro sin reescribir
 * nada: title, description, metaTitle, slug, canonical, kicker, date,
 * readingTime, order, lang y `faqs`.
 *
 * `faqs` no es decorativo: alimenta el bloque de preguntas visible Y el
 * JSON-LD FAQPage. Eso es lo que hace que un post sea citable por buscadores y
 * por asistentes de IA (AEO), no solo indexable.
 */

/**
 * Origen canónico del blog. A propósito NO usa `SITE_URL`: esa variable vale
 * `http://localhost:3000` en desarrollo, así que un build local emitiría
 * `<link rel="canonical" href="http://localhost:3000/blog">` y un schema con
 * URLs muertas. El canonical de un post tiene que apuntar SIEMPRE a producción
 * — es exactamente lo que el frontmatter de los .md ya hace en su campo
 * `canonical`, y acá lo replicamos para el índice y los breadcrumbs.
 */
export const BLOG_ORIGIN = "https://laburo.somosder.ar";

export type BlogFaq = { q: string; a: string };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  metaTitle: string;
  canonical: string;
  kicker: string;
  /** ISO corto (YYYY-MM-DD), para <time datetime> y para el schema. */
  date: string;
  readingTime: string;
  order: number;
  lang: string;
  faqs: BlogFaq[];
  /** Solo en las páginas por público: contrata | trabaja | proveedor | salon. */
  audiencia?: string;
  /**
   * Solo en las traducciones (content/blog/<idioma>/*.md): el slug de la nota
   * ESPAÑOLA de la que salen. Es lo que une las versiones para el hreflang, el
   * sitemap y el selector de idioma. Ver editorial/BLOG-5-IDIOMAS.md.
   */
  traduccionDe?: string;
  /** HTML ya renderizado del cuerpo del post. */
  html: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/**
 * Los .md son nuestros y entran al repo por commit — no hay input de usuario en
 * este pipeline, así que no hace falta sanitizar. `gfm` para listas y tablas;
 * `breaks` apagado para que un salto de línea suelto no meta un <br> de más.
 */
const marked = new Marked({ gfm: true, breaks: false });

/** `date` puede venir como Date (YAML la castea) o como string. Normalizamos. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}

function toFaqs(value: unknown): BlogFaq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (f): f is { q: unknown; a: unknown } =>
        typeof f === "object" && f !== null && "q" in f && "a" in f,
    )
    .map((f) => ({ q: String(f.q), a: String(f.a) }))
    .filter((f) => f.q.length > 0 && f.a.length > 0);
}

function parsePost(fileName: string, dir = BLOG_DIR, base = "blog", lang = "es"): BlogPost {
  const raw = fs.readFileSync(path.join(dir, fileName), "utf8");
  const { data, content } = matter(raw);

  // El slug del frontmatter manda; el nombre del archivo es el fallback.
  const slug = String(data.slug ?? fileName.replace(/\.md$/, ""));
  const title = String(data.title ?? "");

  return {
    slug,
    title,
    description: String(data.description ?? ""),
    // `seoTitle` y `pubDate` son los nombres que usan las notas de somosder-web
    // y de hito-agency: se aceptan igual para que un traductor no tenga que
    // acordarse de cuál es cuál.
    metaTitle: String(data.metaTitle ?? data.seoTitle ?? `${title} | LABURO`),
    canonical: String(data.canonical ?? `${BLOG_ORIGIN}/${base}/${slug}`),
    kicker: String(data.kicker ?? KICKER_POR_IDIOMA[lang] ?? "Guía"),
    date: toIsoDate(data.date ?? data.pubDate),
    readingTime: String(data.readingTime ?? ""),
    order: Number(data.order ?? 99),
    lang: String(data.lang ?? lang),
    faqs: toFaqs(data.faqs),
    audiencia: data.audiencia ? String(data.audiencia) : undefined,
    // `es:` es un alias corto de `traduccionDe:` (mismo dato).
    traduccionDe: (data.traduccionDe ?? data.es) ? String(data.traduccionDe ?? data.es) : undefined,
    html: marked.parse(content, { async: false }),
  };
}

/**
 * Lee una carpeta de .md con el formato del blog. La usan el blog y las páginas
 * por público (`content/para`, lib/para.ts): mismo frontmatter, mismo motor.
 */
export function readMarkdownDir(dir: string, base: string, lang = "es"): BlogPost[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parsePost(f, dir, base, lang))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es"));
}

/** Todos los posts, ordenados por `order` (y por título ante empate). */
export function getAllPosts(): BlogPost[] {
  return readMarkdownDir(BLOG_DIR, "blog");
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

/* ────────────────────────────────────────────────────────────────────────────
 * BLOG EN 5 IDIOMAS (06/11/2026), réplica del de somosder.ar.
 *
 * El español queda donde estuvo siempre (content/blog/*.md → /blog/<slug>) para
 * no romper ninguna URL. Cada traducción es un .md en content/blog/<idioma>/
 * con slug propio en ese idioma y `traduccionDe: <slug-español>`, y se publica
 * en /<idioma>/blog/<slug>. Con eso solo se arman el hreflang recíproco (más
 * x-default a la española), el sitemap con alternates y el selector de idioma.
 * Convención completa: editorial/BLOG-5-IDIOMAS.md.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Idiomas de las traducciones (el español es el original y no va acá). */
export const IDIOMAS_TRADUCCION = ["en", "pt", "fr", "it"] as const;
export type IdiomaTraduccion = (typeof IDIOMAS_TRADUCCION)[number];
export type Idioma = "es" | IdiomaTraduccion;
export const IDIOMAS: Idioma[] = ["es", ...IDIOMAS_TRADUCCION];

export function esIdiomaTraduccion(x: string): x is IdiomaTraduccion {
  return (IDIOMAS_TRADUCCION as readonly string[]).includes(x);
}

/** Código hreflang de cada idioma (el español es el de Argentina). */
export const HREFLANG: Record<Idioma, string> = {
  es: "es-AR",
  en: "en",
  pt: "pt",
  fr: "fr",
  it: "it",
};

const KICKER_POR_IDIOMA: Record<string, string> = {
  es: "Guía",
  en: "Guide",
  pt: "Guia",
  fr: "Guide",
  it: "Guida",
};

/** Índice del blog en cada idioma. */
export function blogIndexUrl(lang: Idioma): string {
  return lang === "es" ? `${BLOG_ORIGIN}/blog` : `${BLOG_ORIGIN}/${lang}/blog`;
}

/** Las notas de un idioma de traducción (content/blog/<idioma>/*.md). */
export function getPostsByLang(lang: IdiomaTraduccion): BlogPost[] {
  return readMarkdownDir(path.join(BLOG_DIR, lang), `${lang}/blog`, lang);
}

export function getPostByLang(lang: IdiomaTraduccion, slug: string): BlogPost | undefined {
  return getPostsByLang(lang).find((p) => p.slug === slug);
}

/**
 * Las versiones de una nota en todos los idiomas que existen, por idioma.
 * Sirve con la nota española o con cualquiera de sus traducciones: devuelve
 * siempre el mismo grupo, así el hreflang sale recíproco en las cinco.
 * Si la nota no tiene ninguna traducción devuelve solo la propia.
 */
export function versionesDe(post: BlogPost): Partial<Record<Idioma, BlogPost>> {
  const slugEs = post.lang === "es" ? post.slug : post.traduccionDe;
  const grupo: Partial<Record<Idioma, BlogPost>> = {};
  if (!slugEs) {
    grupo[post.lang as Idioma] = post;
    return grupo;
  }
  const es = getPost(slugEs);
  if (es) grupo.es = es;
  for (const lang of IDIOMAS_TRADUCCION) {
    const t = getPostsByLang(lang).find((p) => p.traduccionDe === slugEs);
    if (t) grupo[lang] = t;
  }
  if (!grupo[post.lang as Idioma]) grupo[post.lang as Idioma] = post;
  return grupo;
}

/**
 * `alternates.languages` para el metadata de Next y para el sitemap:
 * { "es-AR": url, en: url, ..., "x-default": url-española }. Vacío si la nota
 * no tiene traducciones (una sola versión no necesita hreflang).
 */
export function hreflangDe(post: BlogPost): Record<string, string> {
  const grupo = versionesDe(post);
  const langs = Object.keys(grupo) as Idioma[];
  if (langs.length < 2) return {};
  const out: Record<string, string> = {};
  for (const l of IDIOMAS) {
    const p = grupo[l];
    if (p) out[HREFLANG[l]] = p.canonical;
  }
  out["x-default"] = (grupo.es ?? grupo[langs[0]])!.canonical;
  return out;
}

/** hreflang de los índices del blog (existen en los cinco idiomas). */
export function hreflangIndices(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of IDIOMAS) out[HREFLANG[l]] = blogIndexUrl(l);
  out["x-default"] = blogIndexUrl("es");
  return out;
}

/** Fecha larga en castellano rioplatense: "29 de julio de 2026". */
export function formatBlogDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${meses[m - 1]} de ${y}`;
}
