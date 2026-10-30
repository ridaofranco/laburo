import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ORIGIN, type BlogPost, getAllPosts } from "@/lib/blog";
import { type Audiencia, CTA_POR_AUDIENCIA, paraDeNota } from "@/lib/para";
import { BlogCta, BlogFooter, BlogHeader, WRAP } from "./chrome";

/**
 * Índice del blog de LABURO (/blog).
 *
 * Estático: los posts salen de `content/blog/*.md` en build time. Sin fetch,
 * sin base de datos, sin sesión — es contenido público y así se sirve.
 */

const TITULO = "Blog de LABURO. Staff para eventos";
const DESCRIPCION =
  "Guías prácticas sobre cómo se arma el staff de un evento, qué verificar antes de contratar personal eventual y cómo es trabajar en eventos. Escritas desde la operación real de SOMOS DER.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  // Absoluto a propósito (ver BLOG_ORIGIN en lib/blog.ts): relativo se resolvería
  // contra metadataBase, que en local es http://localhost:3000.
  alternates: { canonical: `${BLOG_ORIGIN}/blog` },
  openGraph: {
    type: "website",
    url: `${BLOG_ORIGIN}/blog`,
    siteName: "LABURO",
    locale: "es_AR",
    title: TITULO,
    description: DESCRIPCION,
    images: [
      { url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO. Staff para eventos" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: ["/brand/laburo-og.png"],
  },
};

/**
 * El índice va agrupado por público (30/10). Con 79 notas en una sola lista,
 * en el celular había que bajar decenas de pantallas para encontrar lo tuyo.
 * El público de cada nota es el de su PRIMERA página de «Para tu caso»
 * (PARA_POR_NOTA en lib/para.ts), el mismo que decide su barra de registro.
 */
const GRUPOS: { id: Audiencia; titulo: string; bajada: string }[] = [
  {
    id: "contrata",
    titulo: "Si armás un evento",
    bajada: "Qué roles hacen falta, cuánta gente, qué pedir y qué verificar antes de confirmar a alguien.",
  },
  {
    id: "trabaja",
    titulo: "Si trabajás en eventos",
    bajada: "Oficios, cómo se cobra, qué llevar, cómo conseguir más fechas y cómo cuidarte.",
  },
  {
    id: "proveedor",
    titulo: "Si sos proveedor",
    bajada: "Cómo armar tu ficha, responder pedidos de precio y llegar a la temporada alta.",
  },
  {
    id: "salon",
    titulo: "Si tenés un salón",
    bajada: "Cómo describir tu espacio, contestar consultas y preparar la visita.",
  },
];

function audienciaDe(slug: string): Audiencia {
  const a = paraDeNota(slug)[0]?.audiencia;
  return GRUPOS.some((g) => g.id === a) ? (a as Audiencia) : "contrata";
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const porGrupo = GRUPOS.map((g) => ({
    ...g,
    posts: posts.filter((p) => audienciaDe(p.slug) === g.id),
  })).filter((g) => g.posts.length > 0);

  // Blog + breadcrumbs. El ItemList le dice a los buscadores qué posts hay y en
  // qué orden, sin depender de que crawleen cada link.
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Blog de LABURO",
      description: DESCRIPCION,
      url: `${BLOG_ORIGIN}/blog`,
      publisher: {
        "@type": "Organization",
        name: "LABURO",
        url: BLOG_ORIGIN,
        parentOrganization: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.ar" },
      },
      blogPost: posts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        url: `${BLOG_ORIGIN}/blog/${p.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BLOG_ORIGIN}/blog` },
      ],
    },
  ];

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeader />

      <main className="flex-1">
        <section className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-20 md:py-32`}>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
              Blog // Staff para eventos
            </span>
            <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(44px,10vw,120px)] mt-6">
              Cómo se arma
              <br />
              un equipo.
            </h1>
            <p className="text-[17px] md:text-[20px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-10">
              Lo que aprendimos armando el staff de nuestras propias
              operaciones, en guías cortas: qué roles hacen falta, qué verificar
              antes de confirmar a alguien y cómo es el trabajo del otro lado.
            </p>
          </div>
        </section>

        <nav aria-label="Elegí tu caso" className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-8 flex flex-wrap gap-3`}>
            {porGrupo.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                className="label-tech inline-flex items-center gap-2 min-h-[44px] rounded-full border border-[#262626] px-5 text-[11px] tracking-[0.2em] text-[#f5f5f5] hover:border-[#0047ff] hover:text-[#0047ff] transition-colors"
              >
                {g.titulo}
                <span className="text-[#565656]">{g.posts.length}</span>
              </a>
            ))}
          </div>
        </nav>

        {porGrupo.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-6 border-b border-[#1a1a1a]">
            <div className={`${WRAP} py-14 md:py-20`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
                <div className="md:col-span-4 min-w-0">
                  <h2 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.95] text-[clamp(24px,4.4vw,52px)] break-words">
                    {g.titulo}
                  </h2>
                  <p className="text-[16px] leading-[1.7] text-[#8a8a8a] mt-5 max-w-[420px]">{g.bajada}</p>
                  <Link
                    href={CTA_POR_AUDIENCIA[g.id].principal.href}
                    className="label-tech inline-flex items-center gap-2 min-h-[44px] text-[11px] tracking-[0.25em] text-[#0047ff] mt-6"
                  >
                    {CTA_POR_AUDIENCIA[g.id].principal.label} →
                  </Link>
                </div>
                <ul className="md:col-span-8 min-w-0 border-t border-[#1a1a1a]">
                  {g.posts.map((p) => (
                    <NotaFila key={p.slug} p={p} />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}

        <BlogCta />
      </main>

      <BlogFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
}

function NotaFila({ p }: { p: BlogPost }) {
  return (
    <li className="border-b border-[#1a1a1a]">
      <Link href={`/blog/${p.slug}`} className="group block py-6 md:py-7 transition-colors hover:bg-[#050505]">
        <span className="label-tech text-[10px] tracking-[0.25em] text-[#0047ff]">
          {p.kicker} · {p.readingTime}
        </span>
        <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[clamp(19px,2.2vw,26px)] mt-3 break-words group-hover:text-[#0047ff] transition-colors">
          {p.title}
        </h3>
        <p className="text-[15px] leading-[1.6] text-[#8a8a8a] mt-3 max-w-[680px]">{p.description}</p>
      </Link>
    </li>
  );
}
