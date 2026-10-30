import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ORIGIN } from "@/lib/blog";
import { getAllPara } from "@/lib/para";
import { BlogCta, BlogFooter, BlogHeader, WRAP } from "../blog/chrome";

/**
 * Índice de las páginas por público (/para), 28/10/2026.
 * Agrupa por audiencia: quien contrata, quien trabaja, quien publica.
 */

const TITULO = "Para quién es LABURO: staff, trabajo, proveedores y salones";
const DESCRIPCION =
  "LABURO sirve a los cuatro lados de un evento: quien contrata staff, quien trabaja en eventos, quien presta un servicio y quien tiene un salón. Elegí el tuyo.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: `${BLOG_ORIGIN}/para` },
  openGraph: {
    type: "website",
    url: `${BLOG_ORIGIN}/para`,
    siteName: "LABURO",
    locale: "es_AR",
    title: TITULO,
    description: DESCRIPCION,
    images: [
      { url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO. Staff para eventos" },
    ],
  },
};

const GRUPOS: { audiencias: string[]; titulo: string }[] = [
  { audiencias: ["contrata"], titulo: "Si armás eventos" },
  { audiencias: ["trabaja"], titulo: "Si trabajás en eventos" },
  { audiencias: ["proveedor", "salon"], titulo: "Si tenés un servicio o un espacio" },
];

export default function ParaIndexPage() {
  const paginas = getAllPara();

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITULO,
      description: DESCRIPCION,
      url: `${BLOG_ORIGIN}/para`,
      inLanguage: "es-AR",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: paginas.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.title,
          url: p.canonical,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Para quién es", item: `${BLOG_ORIGIN}/para` },
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
              Para quién es
            </span>
            <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(40px,10vw,120px)] mt-6 break-words">
              Cada lado
              <br />
              del evento.
            </h1>
            <p className="text-[17px] md:text-[20px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-10">
              Quien contrata, quien trabaja, quien presta un servicio y quien
              tiene el lugar. Elegí lo que te toca y te contamos cómo se hace,
              con la operación real de SOMOS DER atrás.
            </p>
          </div>
        </section>

        {GRUPOS.map((g) => {
          const items = paginas.filter((p) => g.audiencias.includes(p.audiencia ?? ""));
          if (items.length === 0) return null;
          return (
            <section key={g.titulo} className="border-b border-[#1a1a1a]">
              <div className={`${WRAP} py-16 md:py-20`}>
                <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(26px,4.5vw,48px)] leading-none">
                  {g.titulo}
                </h2>
                <div className="border-t border-[#1a1a1a] mt-10">
                  {items.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/para/${p.slug}`}
                      className="group block border-b border-[#1a1a1a] py-8 md:py-10 transition-colors hover:bg-[#050505]"
                    >
                      <span className="label-tech text-[10px] tracking-[0.25em] text-[#0047ff]">
                        {p.kicker}
                      </span>
                      <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.05] text-[clamp(22px,3vw,34px)] mt-3 break-words group-hover:text-[#0047ff] transition-colors">
                        {p.title}
                      </h3>
                      <p className="text-[16px] leading-[1.7] text-[#8a8a8a] mt-4 max-w-[720px]">
                        {p.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          );
        })}

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
