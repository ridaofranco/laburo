import type { Metadata } from "next";
import Link from "next/link";
import {
  BLOG_ORIGIN,
  blogIndexUrl,
  getPostsByLang,
  HREFLANG,
  hreflangIndices,
  type IdiomaTraduccion,
} from "@/lib/blog";
import { TEXTOS } from "@/lib/blog-i18n";
import { WRAP } from "../chrome";
import { BlogCtaIntl, BlogFooterIntl, BlogHeaderIntl } from "./chrome-intl";

/**
 * Índice del blog traducido (lo usan app/<idioma>/blog/page.tsx) (/en/blog, /pt/blog, /fr/blog, /it/blog), 06/11/2026.
 * Estático como el español: las notas salen de content/blog/<idioma>/*.md al
 * compilar. Los cuatro índices existen siempre (aunque un idioma tenga pocas
 * notas) para que el hreflang de los índices sea recíproco entre los cinco.
 */

export function indiceMetadata(lang: IdiomaTraduccion): Metadata {
  const t = TEXTOS[lang];
  const url = blogIndexUrl(lang);
  return {
    title: t.indiceTitulo,
    description: t.indiceDescripcion,
    alternates: { canonical: url, languages: hreflangIndices() },
    openGraph: {
      type: "website",
      url,
      siteName: "LABURO",
      locale: t.locale,
      title: t.indiceTitulo,
      description: t.indiceDescripcion,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.indiceTitulo,
      description: t.indiceDescripcion,
      images: ["/brand/laburo-og.png"],
    },
  };
}

export function IndiceIntl({ lang }: { lang: IdiomaTraduccion }) {
  const t = TEXTOS[lang];
  const posts = getPostsByLang(lang);
  const url = blogIndexUrl(lang);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: t.indiceTitulo,
      description: t.indiceDescripcion,
      inLanguage: HREFLANG[lang],
      url,
      publisher: {
        "@type": "Organization",
        name: "LABURO",
        url: BLOG_ORIGIN,
        parentOrganization: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.com" },
      },
      blogPost: posts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        url: p.canonical,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "LABURO", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: t.blog, item: url },
      ],
    },
  ];

  return (
    <div lang={lang} className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeaderIntl lang={lang} />

      <main className="flex-1">
        <section className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-20 md:py-32`}>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">{t.indiceEyebrow}</span>
            <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(44px,10vw,120px)] mt-6">
              {t.indiceH1[0]}
              <br />
              {t.indiceH1[1]}
            </h1>
            <p className="text-[17px] md:text-[20px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-10">{t.indiceBajada}</p>
          </div>
        </section>

        <section className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-14 md:py-20`}>
            <ul className="border-t border-[#1a1a1a] max-w-[900px]">
              {posts.map((p) => (
                <li key={p.slug} className="border-b border-[#1a1a1a]">
                  <Link href={`/${lang}/blog/${p.slug}`} className="group block py-6 md:py-7 transition-colors hover:bg-[#050505]">
                    <span className="label-tech text-[10px] tracking-[0.25em] text-[#0047ff]">
                      {p.kicker} · {p.readingTime}
                    </span>
                    <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[clamp(19px,2.2vw,26px)] mt-3 break-words group-hover:text-[#0047ff] transition-colors">
                      {p.title}
                    </h2>
                    <p className="text-[15px] leading-[1.6] text-[#8a8a8a] mt-3 max-w-[680px]">{p.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-14 max-w-[680px]">
              <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight text-[20px] md:text-[24px]">
                {t.enEspanol}
              </h2>
              <p className="text-[15px] leading-[1.6] text-[#8a8a8a] mt-3">
                {t.enEspanolBajada}{" "}
                <Link href="/blog" hrefLang="es" className="text-[#0047ff]">
                  laburo.somosder.ar/blog
                </Link>
              </p>
            </div>
          </div>
        </section>

        <BlogCtaIntl lang={lang} />
      </main>

      <BlogFooterIntl lang={lang} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </div>
  );
}
