import type { MetadataRoute } from "next";
import { BLOG_ORIGIN, getAllPosts } from "@/lib/blog";
import { buscarPublico } from "./servicios/actions";

/**
 * Sitemap de LABURO.
 *
 * El repo no tenía ninguno: publicar el blog sin sitemap es dejarlo esperando a
 * que un crawler lo encuentre de casualidad. Solo van las páginas públicas —
 * el resto de la app está detrás del login y no tiene nada que hacer acá.
 *
 * Usa BLOG_ORIGIN (producción hardcodeada) por la misma razón que los
 * canonicals: SITE_URL vale http://localhost:3000 en desarrollo.
 *
 * ── LAS FICHAS DE PROVEEDORES ENTRAN ACÁ (Fase 4) ──
 * Cada proveedor publicado es una página propia con su nombre y su rubro, y esa
 * es toda la presencia en buscadores que un proveedor chico va a tener. Se leen
 * de la base en vez de escribirlas a mano porque la lista cambia sola cada vez
 * que alguien se publica o se despublica. Si la consulta falla, el sitemap sale
 * igual con el resto: un sitemap incompleto es mucho mejor que ninguno.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPosts();
  const proveedores = await buscarPublico({}).catch(() => []);
  const ultimoPost = posts
    .map((p) => p.date)
    .sort()
    .at(-1);

  return [
    { url: BLOG_ORIGIN, changeFrequency: "monthly", priority: 1 },
    { url: `${BLOG_ORIGIN}/sumate`, changeFrequency: "monthly", priority: 0.8 },
    // El directorio solo entra si tiene algo adentro. Mandar a indexar una
    // vidriera vacía es pedirle a Google que guarde una página que dice "no hay
    // proveedores", y después cuesta sacársela.
    ...(proveedores.length > 0
      ? [
          {
            url: `${BLOG_ORIGIN}/servicios`,
            changeFrequency: "weekly" as const,
            priority: 0.9,
          },
          ...proveedores.map((p) => ({
            url: `${BLOG_ORIGIN}/servicios/${p.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          })),
        ]
      : []),
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
