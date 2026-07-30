import type { MetadataRoute } from "next";
import { BLOG_ORIGIN, getAllPosts } from "@/lib/blog";

/**
 * Sitemap de LABURO.
 *
 * El repo no tenía ninguno: publicar el blog sin sitemap es dejarlo esperando a
 * que un crawler lo encuentre de casualidad. Solo van las páginas públicas —
 * el resto de la app está detrás del login y no tiene nada que hacer acá.
 *
 * Usa BLOG_ORIGIN (producción hardcodeada) por la misma razón que los
 * canonicals: SITE_URL vale http://localhost:3000 en desarrollo.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const ultimoPost = posts
    .map((p) => p.date)
    .sort()
    .at(-1);

  return [
    { url: BLOG_ORIGIN, changeFrequency: "monthly", priority: 1 },
    { url: `${BLOG_ORIGIN}/sumate`, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${BLOG_ORIGIN}/blog`,
      lastModified: ultimoPost,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts.map((p) => ({
      url: `${BLOG_ORIGIN}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
