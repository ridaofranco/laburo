import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_ORIGIN, formatBlogDate, getAllPosts, getPost } from "@/lib/blog";
import { BlogCta, BlogFooter, BlogHeader, WRAP } from "../chrome";
import { Faq } from "../faq";

/**
 * Post del blog (/blog/<slug>).
 *
 * Todo el SEO/AEO del post vive acá:
 * - `generateStaticParams` → las rutas se prerenderizan en el build (HTML puro).
 * - `generateMetadata` → title/description/canonical/OG por post.
 * - JSON-LD `Article` + `BreadcrumbList` en esta página, y `FAQPage` en <Faq/>.
 *
 * El canonical sale del frontmatter (`canonical`), igual que en el blog de
 * somosder-web, para que el post sea portable entre dominios sin duplicar.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.metaTitle,
    description: post.description,
    alternates: { canonical: post.canonical },
    openGraph: {
      type: "article",
      url: post.canonical,
      siteName: "LABURO",
      locale: "es_AR",
      title: post.metaTitle,
      description: post.description,
      publishedTime: post.date,
      images: [
        { url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO. Staff para eventos" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.description,
      images: ["/brand/laburo-og.png"],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const otros = getAllPosts().filter((p) => p.slug !== post.slug);

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      inLanguage: "es-AR",
      datePublished: post.date,
      dateModified: post.date,
      // Autoría organizacional: el contenido sale de la operación de SOMOS DER,
      // no de una firma personal inventada.
      author: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.ar" },
      publisher: {
        "@type": "Organization",
        name: "LABURO",
        url: BLOG_ORIGIN,
        parentOrganization: { "@type": "Organization", name: "SOMOS DER", url: "https://somosder.ar" },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": post.canonical },
      url: post.canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BLOG_ORIGIN}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: post.canonical },
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
                    <Link href="/blog" className="hover:text-[#0047ff] transition-colors">
                      Blog
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="max-w-[900px]">
                <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block mt-10">
                  {post.kicker}
                </span>
                <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.95] text-[clamp(34px,6.5vw,80px)] mt-5">
                  {post.title}
                </h1>
                <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] mt-8 max-w-[680px]">
                  {post.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-10 label-tech text-[10px] tracking-[0.2em] text-[#565656]">
                  <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{post.readingTime} de lectura</span>
                  <span aria-hidden="true">·</span>
                  <span>Por SOMOS DER</span>
                </div>
              </div>
            </div>
          </header>

          <div className={WRAP}>
            <div
              className="prose-laburo max-w-[760px] py-16 md:py-24"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </div>
        </article>

        <Faq faqs={post.faqs} />

        {otros.length > 0 && (
          <section className="border-t border-[#1a1a1a]">
            <div className={`${WRAP} py-16 md:py-24`}>
              <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
                Seguir leyendo
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 border border-[#1a1a1a] mt-10">
                {otros.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className={`group p-8 md:p-12 border-[#1a1a1a] transition-colors hover:bg-[#050505] ${
                      i > 0 ? "border-t md:border-t-0 md:border-l" : ""
                    }`}
                  >
                    <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
                      {p.kicker}
                    </span>
                    <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[22px] md:text-[26px] mt-5 group-hover:text-[#0047ff] transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-[15px] leading-[1.7] text-[#8a8a8a] mt-4">
                      {p.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

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
