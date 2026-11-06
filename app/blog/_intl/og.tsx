import { getPostByLang, type IdiomaTraduccion } from "@/lib/blog";
import { OG_SIZE, ogImage } from "@/lib/og";

/** Imagen para compartir de una nota traducida (opengraph-image y twitter-image de cada idioma). */
export const OG_ALT = "LABURO. Event staff";
export { OG_SIZE };

export function notaOgImage(lang: IdiomaTraduccion, slug: string) {
  const p = getPostByLang(lang, slug);
  return ogImage({ kicker: p ? p.kicker : "LABURO", title: p?.title ?? "LABURO" });
}
