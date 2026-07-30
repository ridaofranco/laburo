import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ORIGIN, getAllPosts } from "@/lib/blog";
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

export default function BlogIndexPage() {
  const posts = getAllPosts();

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

        <section>
          <div className={`${WRAP} py-16 md:py-24`}>
            <div className="border-t border-[#1a1a1a]">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block border-b border-[#1a1a1a] py-10 md:py-14 transition-colors hover:bg-[#050505]"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 md:items-start">
                    <div className="md:col-span-3">
                      <span className="label-tech text-[10px] tracking-[0.25em] text-[#0047ff]">
                        {p.kicker}
                      </span>
                      <span className="label-tech block text-[10px] tracking-[0.2em] text-[#565656] mt-3">
                        {p.readingTime} de lectura
                      </span>
                    </div>
                    <div className="md:col-span-9">
                      <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.05] text-[clamp(24px,3.4vw,40px)] group-hover:text-[#0047ff] transition-colors">
                        {p.title}
                      </h2>
                      <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] mt-5 max-w-[720px]">
                        {p.description}
                      </p>
                      <span className="label-tech inline-flex items-center gap-2 text-[11px] tracking-[0.25em] text-[#f5f5f5] mt-7">
                        Leer
                        <span className="transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

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
