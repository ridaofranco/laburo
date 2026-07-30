import type { BlogFaq } from "@/lib/blog";
import { WRAP } from "./chrome";

/**
 * Bloque de preguntas frecuentes + JSON-LD `FAQPage`.
 *
 * Port del `Faq.astro` de somosder-web: mismo contrato (una lista de {q, a} del
 * frontmatter) y misma decisión de fondo — la respuesta visible y la del schema
 * son EL MISMO texto. Es lo que hace que Google y los asistentes de IA puedan
 * citar el post sin inventar: la respuesta ya está escrita, entera, en el HTML.
 */
export function Faq({ faqs }: { faqs: BlogFaq[] }) {
  if (faqs.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="border-t border-[#1a1a1a]">
      <div className={`${WRAP} py-20 md:py-28`}>
        <div className="max-w-[820px]">
          <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
            Preguntas frecuentes
          </span>
          <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(28px,5vw,56px)] leading-none mt-4">
            Lo que más nos preguntan.
          </h2>

          <div className="mt-12 border-t border-[#1a1a1a]">
            {faqs.map((f) => (
              <details key={f.q} className="faq-item group border-b border-[#1a1a1a]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 font-[family-name:var(--font-syne)] font-bold text-[17px] md:text-[19px] leading-snug text-[#f5f5f5] transition-colors hover:text-[#0047ff]">
                  <span>{f.q}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-[#0047ff] transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-6 pr-8 text-[16px] leading-[1.7] text-[#8a8a8a]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  );
}
