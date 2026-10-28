import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_ORIGIN } from "@/lib/blog";
import { ctaDe, getAllPara, getPara } from "@/lib/para";
import { BlogFooter, BlogHeader, WRAP } from "../../blog/chrome";
import { Faq } from "../../blog/faq";

/**
 * Página por público (/para/<slug>), 28/10/2026.
 *
 * Mismo esqueleto que un post del blog (HTML estático, canonical del
 * frontmatter, FAQPage), pero el schema es `WebPage` + `Service` en vez de
 * `Article`, y el cierre cambia según a quién le habla (`audiencia`).
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPara().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPara(slug);
  if (!page) return {};

  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: page.canonical },
    openGraph: {
      type: "website",
      url: page.canonical,
      siteName: "LABURO",
      locale: "es_AR",
      title: page.metaTitle,
      description: page.description,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.description,
    },
  };
}

export default async function ParaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPara(slug);
  if (!page) notFound();

  const cta = ctaDe(page.audiencia);
  // Primero las de la misma audiencia, después el resto: quien llegó buscando
  // trabajo sigue leyendo sobre trabajo.
  const otras = getAllPara()
    .filter((p) => p.slug !== page.slug)
    .sort((a, b) => Number(b.audiencia === page.audiencia) - Number(a.audiencia === page.audiencia))
    .slice(0, 4);

  const organizacion = {
    "@type": "Organization",
    "@id": `${BLOG_ORIGIN}/#organization`,
    name: "LABURO",
    url: BLOG_ORIGIN,
    parentOrganization: { "@id": "https://www.somosder.ar/#organization", name: "SOMOS DER" },
  };

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": page.canonical,
      url: page.canonical,
      name: page.title,
      description: page.description,
      inLanguage: "es-AR",
      dateModified: page.date,
      isPartOf: { "@type": "WebSite", "@id": `${BLOG_ORIGIN}/#website`, url: BLOG_ORIGIN, name: "LABURO" },
      publisher: organizacion,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.title,
      description: page.description,
      serviceType: "Plataforma de staff, proveedores y salones para eventos",
      areaServed: { "@type": "Country", name: "Argentina" },
      provider: organizacion,
      url: page.canonical,
      offers: { "@type": "Offer", price: "0", priceCurrency: "ARS", description: "Crear la cuenta y usar LABURO es gratis." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Para quién es", item: `${BLOG_ORIGIN}/para` },
        { "@type": "ListItem", position: 3, name: page.title, item: page.canonical },
      ],
    },
  ];

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeader />

      <main className="flex-1">
        <article>
          <header className="border-b border-[#1a1a1a]">
            <div className={`${WRAP} py-16 md:py-24`}>
              <nav aria-label="Migas de pan" className="max-w-[820px]">
                <ol className="flex flex-wrap items-center gap-2 label-tech text-[10px] tracking-[0.2em] text-[#565656]">
                  <li>
                    <Link href="/" className="hover:text-[#0047ff] transition-colors">
                      Inicio
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link href="/para" className="hover:text-[#0047ff] transition-colors">
                      Para quién es
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="max-w-[900px]">
                <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block mt-10">
                  {page.kicker}
                </span>
                <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.95] text-[clamp(26px,6.5vw,80px)] break-words [hyphens:auto] mt-5">
                  {page.title}
                </h1>
                <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] mt-8 max-w-[680px]">
                  {page.description}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-10">
                  <Link
                    href={cta.principal.href}
                    className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
                  >
                    {cta.principal.label}
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <div className={WRAP}>
            <div
              className="prose-laburo max-w-[760px] py-16 md:py-24"
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
          </div>
        </article>

        <Faq faqs={page.faqs} />

        <section className="border-t border-[#1a1a1a] bg-[#050505]">
          <div className={`${WRAP} py-20 md:py-28`}>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
              LABURO · por SOMOS DER
            </span>
            <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(32px,6vw,72px)] leading-none mt-4">
              {cta.titulo}
            </h2>
            <p className="text-[16px] md:text-[18px] leading-[1.7] text-[#8a8a8a] max-w-[560px] mt-8">
              {cta.texto}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <Link
                href={cta.principal.href}
                className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
              >
                {cta.principal.label}
              </Link>
              <Link
                href={cta.secundario.href}
                className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
              >
                {cta.secundario.label}
              </Link>
            </div>
          </div>
        </section>

        {otras.length > 0 && (
          <section className="border-t border-[#1a1a1a]">
            <div className={`${WRAP} py-16 md:py-24`}>
              <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
                También te puede servir
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 border border-[#1a1a1a] mt-10">
                {otras.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`/para/${p.slug}`}
                    className={`group p-8 md:p-12 border-[#1a1a1a] transition-colors hover:bg-[#050505] ${
                      i > 0 ? "border-t" : ""
                    } ${i === 1 ? "md:border-t-0 md:border-l" : ""} ${i === 3 ? "md:border-l" : ""}`}
                  >
                    <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
                      {p.kicker}
                    </span>
                    <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[20px] md:text-[24px] mt-5 break-words group-hover:text-[#0047ff] transition-colors">
                      {p.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <BlogFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
}
