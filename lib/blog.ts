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

function parsePost(fileName: string): BlogPost {
  const raw = fs.readFileSync(path.join(BLOG_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  // El slug del frontmatter manda; el nombre del archivo es el fallback.
  const slug = String(data.slug ?? fileName.replace(/\.md$/, ""));
  const title = String(data.title ?? "");

  return {
    slug,
    title,
    description: String(data.description ?? ""),
    metaTitle: String(data.metaTitle ?? `${title} | LABURO`),
    canonical: String(data.canonical ?? `${BLOG_ORIGIN}/blog/${slug}`),
    kicker: String(data.kicker ?? "Guía"),
    date: toIsoDate(data.date),
    readingTime: String(data.readingTime ?? ""),
    order: Number(data.order ?? 99),
    lang: String(data.lang ?? "es"),
    faqs: toFaqs(data.faqs),
    html: marked.parse(content, { async: false }),
  };
}

/** Todos los posts, ordenados por `order` (y por título ante empate). */
export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parsePost)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es"));
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
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
