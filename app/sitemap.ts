import type { MetadataRoute } from "next";
import {
  BLOG_ORIGIN,
  blogIndexUrl,
  getAllPosts,
  getPostsByLang,
  hreflangDe,
  hreflangIndices,
  IDIOMAS_TRADUCCION,
} from "@/lib/blog";
import { getAllPara } from "@/lib/para";
import { createClient } from "@supabase/supabase-js";

// 09/11: el sitemap quedaba colgado y Google no lo podía leer. Ahora consulta la base
// con la llave pública y SIN cookies (así Next lo puede guardar armado una hora), con
// un tope de 8 s por consulta: si la base no contesta, el sitemap sale igual sin esa parte.
function supabasePublico() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpcConTope(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const pedido = supabasePublico()
    .rpc(fn, args)
    .then(({ data, error }) => {
      if (error) {
        console.error(`sitemap: ${fn}`, error.message);
        return [];
      }
      return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    }, () => []);
  const tope = new Promise<Record<string, unknown>[]>((r) => setTimeout(() => r([]), 8000));
  return Promise.race([pedido, tope]);
}

const slugs = (filas: Record<string, unknown>[]) =>
  filas.map((f) => (typeof f.slug === "string" ? f.slug : null)).filter((x): x is string => !!x);

/** `alternates` del sitemap solo para las notas que tienen traducciones. */
function alternatesDe(p: Parameters<typeof hreflangDe>[0]) {
  const languages = hreflangDe(p);
  return Object.keys(languages).length > 0 ? { alternates: { languages } } : {};
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
// Se arma como mucho una vez por hora y se sirve desde caché.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = getAllPosts();
  const para = getAllPara();
  // Las dos vidrieras van juntas: son independientes y encadenarlas sería un
  // viaje de más para nada. Cada una cae sola con su propio catch, así que si
  // una falla el sitemap igual sale con la otra.
  const [proveedores, salones, licitaciones] = await Promise.all([
    rpcConTope("staff_app_vidriera_buscar", { p_texto: null, p_categoria: null, p_provincia: null }).then(slugs),
    rpcConTope("staff_app_vidriera_salones", { p_texto: null, p_provincia: null, p_personas: null }).then(slugs),
    rpcConTope("staff_app_licitaciones_abiertas", { p_limit: 40 }).then(slugs),
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
          ...proveedores.map((slug) => ({
            url: `${BLOG_ORIGIN}/servicios/${slug}`,
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
          ...salones.map((slug) => ({
            url: `${BLOG_ORIGIN}/salones/${slug}`,
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
      alternates: { languages: hreflangIndices() },
    },
    ...posts.map((p) => ({
      url: `${BLOG_ORIGIN}/blog/${p.slug}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...alternatesDe(p),
    })),
    // BLOG EN 5 IDIOMAS (06/11): índices y notas de content/blog/<idioma>/, con
    // los alternates del grupo (hreflang recíproco + x-default a la española).
    // content/blog/**/* ya está en outputFileTracingIncludes (next.config.ts).
    ...IDIOMAS_TRADUCCION.flatMap((lang) => {
      const notas = getPostsByLang(lang);
      return [
        {
          url: blogIndexUrl(lang),
          lastModified: notas.map((p) => p.date).sort().at(-1),
          changeFrequency: "weekly" as const,
          priority: 0.6,
          alternates: { languages: hreflangIndices() },
        },
        ...notas.map((p) => ({
          url: p.canonical,
          lastModified: p.date,
          changeFrequency: "monthly" as const,
          priority: 0.6,
          ...alternatesDe(p),
        })),
      ];
    }),
  ];
}
