/**
 * Una búsqueda de la bolsa de trabajo pública (0111). Es el link que se
 * comparte: tiene que decir todo lo que hace falta para decidir si postularse
 * (rol, fecha, lugar, pago, condiciones, quién publica) y llevar a postularse
 * en un toque. La dirección exacta del evento no se publica.
 *
 * JSON-LD JobPosting: es lo que lee Google para mostrar la búsqueda en su
 * buscador de empleos.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { money } from "@/lib/format";
import { fmtFecha, fmtHora } from "@/lib/dates";
import { jsonLdSeguro } from "@/lib/schema-vidriera";
import { siteUrl } from "@/lib/site";
import { capitalizar, condiciones, getEmpleoPublico, haySesion, type EmpleoPublico } from "@/lib/empleos";

interface Props {
  params: Promise<{ id: string }>;
}

function resumen(e: EmpleoPublico): string {
  const partes = [
    `${capitalizar(e.role)}${e.cupo > 1 ? ` (${e.cupo} lugares)` : ""}`,
    e.lugar?.trim() ? `en ${capitalizar(e.lugar)}` : null,
    fmtFecha(e.empieza) ? `desde el ${fmtFecha(e.empieza)}` : null,
    e.pago != null && Number(e.pago) > 0 ? `· ${money(Number(e.pago))} por persona` : null,
  ];
  return partes.filter(Boolean).join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await getEmpleoPublico(id);
  if (!e) return { title: "Búsqueda cerrada | LABURO", robots: { index: false, follow: true } };
  const titulo = `${capitalizar(e.role)}${e.lugar?.trim() ? ` en ${capitalizar(e.lugar)}` : ""} | Trabajo en eventos | LABURO`;
  const descripcion = `${resumen(e)}. Publica ${e.publica ?? "una productora"}. Postulate gratis en LABURO.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/empleos/${e.id}` },
    openGraph: {
      type: "website",
      url: `/empleos/${e.id}`,
      siteName: "LABURO",
      locale: "es_AR",
      title: titulo,
      description: descripcion,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

function schemaEmpleo(e: EmpleoPublico) {
  const descripcion = [resumen(e), e.notas, ...condiciones(e).map(([k, v]) => `${k}: ${v}`)]
    .filter(Boolean)
    .join("\n");
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: capitalizar(e.role),
    description: descripcion,
    datePosted: e.publicado_at ?? undefined,
    validThrough: e.empieza ?? undefined,
    employmentType: "TEMPORARY",
    totalJobOpenings: e.cupo,
    directApply: false,
    url: siteUrl(`/empleos/${e.id}`),
    hiringOrganization: { "@type": "Organization", name: e.publica ?? "Productora en LABURO" },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: e.lugar ? capitalizar(e.lugar) : undefined, addressCountry: "AR" },
    },
    ...(e.pago != null && Number(e.pago) > 0
      ? { baseSalary: { "@type": "MonetaryAmount", currency: "ARS", value: { "@type": "QuantitativeValue", value: Number(e.pago) } } }
      : {}),
  };
}

const WRAP = "max-w-[960px] mx-auto w-full px-6 md:px-10";
const BTN_CLARO =
  "inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300";
const BTN_BORDE =
  "inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300";

export default async function EmpleoPage({ params }: Props) {
  const { id } = await params;
  const [e, sesion] = await Promise.all([getEmpleoPublico(id), haySesion()]);
  if (!e) notFound();

  const link = siteUrl(`/empleos/${e.id}`);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${resumen(e)}. Postulate gratis en LABURO: ${link}`)}`;
  const conds = condiciones(e);
  const cuando = [fmtFecha(e.empieza, {}), fmtHora(e.empieza)].filter(Boolean).join(" · ");
  const hasta = e.termina ? fmtFecha(e.termina, {}) : null;

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(schemaEmpleo(e)) }} />
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          <Link
            href="/empleos"
            className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
          >
            Todas las búsquedas
          </Link>
        </div>
      </header>

      <main className={`${WRAP} pt-14 md:pt-20 pb-28 flex flex-col gap-10`}>
        <section className="flex flex-col gap-5">
          <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff]">
            Búsqueda abierta · {e.cupo === 1 ? "1 lugar" : `${e.cupo} lugares`}
          </span>
          <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.95] text-[clamp(32px,5vw,56px)]">
            {capitalizar(e.role)}
          </h1>
          <p className="text-[17px] text-[#8a8a8a]">
            {e.publica?.trim() ? `Publica ${e.publica}` : "Publica una productora"}
            {e.evento?.trim() ? ` · Evento: ${e.evento}` : ""}
          </p>
        </section>

        <dl className="grid sm:grid-cols-3 gap-px bg-[#1a1a1a] border border-[#1a1a1a]">
          <div className="bg-black p-5 flex flex-col gap-1">
            <dt className="label-tech text-[10px] tracking-[0.2em] text-[#8a8a8a]">Pago por persona</dt>
            <dd className="text-[20px] font-semibold">
              {e.pago != null && Number(e.pago) > 0 ? money(Number(e.pago)) : "A confirmar"}
            </dd>
          </div>
          <div className="bg-black p-5 flex flex-col gap-1">
            <dt className="label-tech text-[10px] tracking-[0.2em] text-[#8a8a8a]">Cuándo</dt>
            <dd className="text-[16px]">
              {cuando || "A confirmar"}
              {hasta && hasta !== fmtFecha(e.empieza, {}) ? <span className="text-[#8a8a8a]"> hasta el {hasta}</span> : null}
            </dd>
          </div>
          <div className="bg-black p-5 flex flex-col gap-1">
            <dt className="label-tech text-[10px] tracking-[0.2em] text-[#8a8a8a]">Dónde</dt>
            <dd className="text-[16px]">{e.lugar?.trim() ? capitalizar(e.lugar) : "A confirmar"}</dd>
          </div>
        </dl>

        {e.notas?.trim() ? (
          <section className="flex flex-col gap-3">
            <h2 className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">Lo que hay que saber</h2>
            <p className="text-[17px] leading-[1.7] whitespace-pre-line">{e.notas}</p>
          </section>
        ) : null}

        {conds.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">Condiciones</h2>
            <dl className="flex flex-col gap-2">
              {conds.map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row sm:gap-3">
                  <dt className="text-[#8a8a8a] sm:w-[140px] shrink-0">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="border border-[#1a1a1a] p-6 md:p-10 flex flex-col gap-5">
          <h2 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[30px] font-bold uppercase tracking-tight leading-[1.05]">
            ¿Te interesa?
          </h2>
          {sesion ? (
            <>
              <p className="text-[16px] leading-[1.7] text-[#8a8a8a]">
                Postulate desde Trabajos disponibles. La empresa ve tu perfil y te contesta por LABURO.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/trabajos" className={BTN_CLARO}>
                  Postularme
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-[16px] leading-[1.7] text-[#8a8a8a]">
                Para postularte necesitás tu perfil en LABURO: es gratis y lo armás en unos minutos.
                Si ya lo tenés, entrá y la encontrás en Trabajos disponibles.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/sumate" className={BTN_CLARO}>
                  Crear mi perfil y postularme
                </Link>
                <Link href="/acceso-staff" className={BTN_BORDE}>
                  Ya tengo perfil
                </Link>
              </div>
            </>
          )}
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#7FA2FF] underline w-fit">
            Compartir por WhatsApp
          </a>
        </section>

        <p className="text-[14px] text-[#8a8a8a]">
          ¿Necesitás gente para tu evento?{" "}
          <Link href="/registrar-productora" className="text-[#f5f5f5] underline hover:text-[#0047ff]">
            Publicá tu búsqueda gratis
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
