import { esIdiomaTraduccion, getPostByLang, getPostsByLang, IDIOMAS_TRADUCCION } from "@/lib/blog";
import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "LABURO. Event staff";
export const dynamicParams = false;

export function generateStaticParams() {
  return IDIOMAS_TRADUCCION.flatMap((lang) => getPostsByLang(lang).map((p) => ({ lang, slug: p.slug })));
}

export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const p = esIdiomaTraduccion(lang) ? getPostByLang(lang, slug) : undefined;
  return ogImage({ kicker: p ? p.kicker : "LABURO", title: p?.title ?? "LABURO" });
}
