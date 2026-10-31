import type { MetadataRoute } from "next";
import { BLOG_ORIGIN, getAllPosts } from "@/lib/blog";
import { getAllPara } from "@/lib/para";
import { buscarPublico } from "./servicios/actions";
import { buscarSalones } from "./salones/actions";
import { createClient } from "@/lib/supabase/server";

// Las licitaciones abiertas, para el sitemap. Misma regla que las vidrieras: si
// la consulta falla o no hay ninguna, no entra nada (ni el índice vacío).
async function licitacionesAbiertas(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_licitaciones_abiertas", { p_limit: 40 });
  if (error) {
    console.error("sitemap: licitaciones", error.message);
    return [];
  }
  return (Array.isArray(data) ? data : [])
    .map((l: Record<string, unknown>) => (typeof l.slug === "string" ? l.slug : null))
    .filter((s): s is string => !!s);
}

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
  const para = getAllPara();
  // Las dos vidrieras van juntas: son independientes y encadenarlas sería un
  // viaje de más para nada. Cada una cae sola con su propio catch, así que si
  // una falla el sitemap igual sale con la otra.
  const [proveedores, salones, licitaciones] = await Promise.all([
    buscarPublico({}).catch(() => []),
    buscarSalones({}).catch(() => []),
    licitacionesAbiertas().catch(() => []),
  ]);
  const ultimoPost = posts
    .map((p) => p.date)
    .sort()
    .at(-1);

  return [
    { url: BLOG_ORIGIN, changeFrequency: "monthly", priority: 1 },
    { url: `${BLOG_ORIGIN}/sumate`, changeFrequency: "monthly", priority: 0.8 },
    // Las puertas de alta (29/10): son públicas, indexables y es por donde se
    // anota cada actor. No estaban, así que Google solo las encontraba por links.
    { url: `${BLOG_ORIGIN}/registrarme`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BLOG_ORIGIN}/registrar-productora`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BLOG_ORIGIN}/registrar-proveedor`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BLOG_ORIGIN}/registrar-salon`, changeFrequency: "monthly", priority: 0.7 },
    // Privacidad y términos (31/10): indexables y con canonical, pero solo se
    // llegaba por el pie. Google y las IA las miran para confiar en un sitio que pide datos.
    { url: `${BLOG_ORIGIN}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BLOG_ORIGIN}/terminos`, changeFrequency: "yearly", priority: 0.3 },
    ...(licitaciones.length > 0
      ? [
          { url: `${BLOG_ORIGIN}/licitaciones`, changeFrequency: "daily" as const, priority: 0.8 },
          ...licitaciones.map((slug) => ({
            url: `${BLOG_ORIGIN}/licitaciones/${slug}`,
            changeFrequency: "daily" as const,
            priority: 0.6,
          })),
        ]
      : []),
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
    // Los salones, con la MISMA regla: solo entran si hay alguno publicado.
    // Mandar a indexar una vidriera vacía es pedirle a Google que guarde una
    // página que dice "todavía no hay salones", y después cuesta sacársela.
    ...(salones.length > 0
      ? [
          {
            url: `${BLOG_ORIGIN}/salones`,
            changeFrequency: "weekly" as const,
            priority: 0.9,
          },
          ...salones.map((s) => ({
            url: `${BLOG_ORIGIN}/salones/${s.slug}`,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          })),
        ]
      : []),
    // Páginas por público (28/10): mismo motor que el blog, por eso también
    // están en outputFileTracingIncludes de next.config.ts.
    ...(para.length > 0
      ? [
          { url: `${BLOG_ORIGIN}/para`, changeFrequency: "monthly" as const, priority: 0.8 },
          ...para.map((p) => ({
            url: p.canonical,
            lastModified: p.date,
            changeFrequency: "monthly" as const,
            priority: 0.8,
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
