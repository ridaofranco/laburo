import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BLOG_ORIGIN,
  blogIndexUrl,
  getPostByLang,
  getPostsByLang,
  HREFLANG,
  hreflangDe,
  type IdiomaTraduccion,
} from "@/lib/blog";
import { formatFecha, TEXTOS } from "@/lib/blog-i18n";
import { WRAP } from "../chrome";
import { Faq } from "../faq";
import { SelectorIdioma } from "../idiomas";
import { BlogCtaIntl, BlogFooterIntl, BlogHeaderIntl } from "./chrome-intl";

/**
 * Nota traducida (la usan app/<idioma>/blog/[slug]/page.tsx) (/<idioma>/blog/<slug>), 06/11/2026. Mismo diseño y mismo SEO
 * que la nota en español (app/blog/[slug]/page.tsx): estática, con canonical
 * propio, hreflang recíproco con todas sus versiones + x-default a la española,
 * JSON-LD Article + BreadcrumbList y FAQPage en <Faq/>.
 */

export function notaStaticParams(lang: IdiomaTraduccion) {
  return getPostsByLang(lang).map((p) => ({ slug: p.slug }));
}

export function notaMetadata(lang: IdiomaTraduccion, slug: string): Metadata {
  const post = getPostByLang(lang, slug);
  if (!post) return {};
  const t = TEXTOS[lang];
  return {
    title: post.metaTitle,
    description: post.description,
    alternates: { canonical: post.canonical, languages: hreflangDe(post) },
    openGraph: {
      type: "article",
      url: post.canonical,
      siteName: "LABURO",
      locale: t.locale,
      title: post.metaTitle,
      description: post.description,
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: post.metaTitle, description: post.description },
  };
}

export function NotaIntl({ lang, slug }: { lang: IdiomaTraduccion; slug: string }) {
  const post = getPostByLang(lang, slug);
  if (!post) notFound();
  const t = TEXTOS[lang];
  const otros = getPostsByLang(lang).filter((p) => p.slug !== post.slug);
  const indice = blogIndexUrl(lang);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      inLanguage: HREFLANG[lang],
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.com" },
      publisher: {
        "@type": "Organization",
        name: "LABURO",
        url: BLOG_ORIGIN,
        logo: { "@type": "ImageObject", url: `${BLOG_ORIGIN}/brand/laburo-wordmark.png`, width: 716, height: 128 },
        parentOrganization: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.com" },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": post.canonical },
      url: post.canonical,
      image: { "@type": "ImageObject", url: `${post.canonical}/opengraph-image`, width: 1200, height: 630 },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "LABURO", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: t.blog, item: indice },
        { "@type": "ListItem", position: 3, name: post.title, item: post.canonical },
      ],
    },
  ];

  return (
    <div lang={lang} className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeaderIntl lang={lang} />

      <main className="flex-1">
        <article>
          <header className="border-b border-[#1a1a1a]">
            <div className={`${WRAP} py-16 md:py-24`}>
              <nav aria-label={t.blog} className="max-w-[820px]">
                <ol className="flex flex-wrap items-center gap-2 label-tech text-[10px] tracking-[0.2em] text-[#565656]">
                  <li>
                    <Link href={`/${lang}/blog`} className="hover:text-[#0047ff] transition-colors">
                      {t.blog}
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="max-w-[900px]">
                <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block mt-10">{post.kicker}</span>
                <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tight leading-[1.1] text-[clamp(21px,4vw,50px)] break-words [hyphens:auto] mt-5">
                  {post.title}
                </h1>
                <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] mt-8 max-w-[680px]">{post.description}</p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-10 label-tech text-[10px] tracking-[0.2em] text-[#565656]">
                  <time dateTime={post.date}>{formatFecha(post.date, t.locale)}</time>
                  {post.readingTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {post.readingTime} {t.lectura}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{t.por}</span>
                </div>
                <SelectorIdioma post={post} />
              </div>
            </div>
          </header>

          <div className={WRAP}>
            <div className="prose-laburo max-w-[760px] py-16 md:py-24" dangerouslySetInnerHTML={{ __html: post.html }} />
          </div>
        </article>

        <Faq faqs={post.faqs} eyebrow={t.faqEyebrow} titulo={t.faqTitulo} />

        {otros.length > 0 && (
          <section className="border-t border-[#1a1a1a]">
            <div className={`${WRAP} py-16 md:py-24`}>
              <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">{t.seguirLeyendo}</span>
              <div className="grid grid-cols-1 md:grid-cols-2 border border-[#1a1a1a] mt-10">
                {otros.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`/${lang}/blog/${p.slug}`}
                    className={`group p-8 md:p-12 border-[#1a1a1a] transition-colors hover:bg-[#050505] ${
                      i > 0 ? "border-t md:border-t-0 md:border-l" : ""
                    }`}
                  >
                    <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">{p.kicker}</span>
                    <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[22px] md:text-[26px] mt-5 group-hover:text-[#0047ff] transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-[15px] leading-[1.7] text-[#8a8a8a] mt-4">{p.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <BlogCtaIntl lang={lang} />
      </main>

      <BlogFooterIntl lang={lang} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </div>
  );
}
