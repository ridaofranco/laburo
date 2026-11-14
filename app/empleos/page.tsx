/**
 * BOLSA DE TRABAJO PÚBLICA: /empleos (0111, 14/11).
 *
 * Franco: «que cualquiera pueda poner a disposición una posición de trabajo
 * para que se postulen, tipo LinkedIn». Las búsquedas ya existían adentro
 * (/trabajos, solo con cuenta de staff). Esta es la vidriera sin cuenta: se
 * comparte por WhatsApp e Instagram y la indexa Google. Para postularse sí hay
 * que entrar o crear el perfil (gratis), porque la empresa necesita ver a quién.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { money } from "@/lib/format";
import { fmtFecha } from "@/lib/dates";
import { capitalizar, getEmpleosPublicos } from "@/lib/empleos";

const TITULO = "Bolsa de trabajo para eventos | LABURO";
const DESCRIPCION =
  "Trabajos en eventos publicados por productoras y empresas: armado, promotoras, mozos, seguridad, técnica y más. Gratis para postularte y gratis para publicar.";

export async function generateMetadata(): Promise<Metadata> {
  const hayAlgo = (await getEmpleosPublicos()).length > 0;
  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical: "/empleos" },
    robots: hayAlgo ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: "/empleos",
      siteName: "LABURO",
      locale: "es_AR",
      title: TITULO,
      description: DESCRIPCION,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";
const BTN_CLARO =
  "inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300";
const BTN_BORDE =
  "inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300";
const NAV = "label-tech text-[10px] md:text-[11px] tracking-[0.2em] transition-colors duration-300 hover:text-[#0047ff]";

export default async function EmpleosPage() {
  const empleos = await getEmpleosPublicos();

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          <div className="flex items-center gap-5 md:gap-7">
            <Link href="/registrar-productora" className={`${NAV} text-white`}>
              Publicá una búsqueda gratis
            </Link>
            <Link href="/servicios" className={`${NAV} text-white/70 hidden sm:inline`}>
              Proveedores
            </Link>
            <Link href="/salones" className={`${NAV} text-white/70 hidden sm:inline`}>
              Salones
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`${WRAP} pt-16 md:pt-24 pb-12`}>
          <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
            Bolsa de trabajo // por SOMOS DER
          </span>
          <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(34px,5.5vw,64px)] mt-5">
            Laburo en eventos,
            <br />
            para todos.
          </h1>
          <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] max-w-[640px] mt-8">
            Productoras y empresas publican lo que necesitan para su próximo evento, y vos te
            postulás con tu perfil. Si estás arrancando, también: la primera oportunidad es la más
            difícil de conseguir. Gratis para postularte y gratis para publicar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-10">
            <Link href="/sumate" className={BTN_CLARO}>
              Crear mi perfil gratis
            </Link>
            <Link href="/registrar-productora" className={BTN_BORDE}>
              Publicar una búsqueda
            </Link>
          </div>
        </section>

        <section className={`${WRAP} pb-28`}>
          {empleos.length === 0 ? (
            <div className="border border-[#1a1a1a] p-10 md:p-16 flex flex-col gap-6 items-start">
              <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                Sin búsquedas abiertas ahora
              </span>
              <h2 className="font-[family-name:var(--font-syne)] text-[28px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05] max-w-[620px]">
                Hoy no hay búsquedas abiertas
              </h2>
              <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] max-w-[560px]">
                Creá tu perfil y te avisamos cuando aparezca algo que vaya con tu oficio y tu zona. Y
                si necesitás gente para un evento, publicá la búsqueda: es gratis.
              </p>
            </div>
          ) : (
            <>
              <p className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] mb-6">
                {empleos.length === 1 ? "1 búsqueda abierta" : `${empleos.length} búsquedas abiertas`}
              </p>
              <ul className="grid gap-4 md:grid-cols-2">
                {empleos.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/empleos/${e.id}`}
                      className="group flex flex-col gap-3 border border-[#1a1a1a] p-6 md:p-8 h-full hover:border-[#0047ff] transition-colors duration-300"
                    >
                      <span className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a]">
                        {[fmtFecha(e.empieza), e.lugar?.trim() ? capitalizar(e.lugar) : null]
                          .filter(Boolean)
                          .join(" · ") || "Fecha a confirmar"}
                      </span>
                      <h2 className="font-[family-name:var(--font-syne)] text-[22px] md:text-[26px] font-bold uppercase tracking-tight leading-[1.1] group-hover:text-[#0047ff] transition-colors duration-300">
                        {capitalizar(e.role)}
                      </h2>
                      <span className="text-[15px] text-[#8a8a8a]">
                        {e.publica?.trim() ? `Publica ${e.publica}` : "Publica una productora"}
                      </span>
                      <div className="flex flex-wrap items-center gap-4 mt-auto pt-2">
                        <span className="text-[18px] font-semibold">
                          {e.pago != null && Number(e.pago) > 0 ? `${money(Number(e.pago))} por persona` : "Pago a confirmar"}
                        </span>
                        <span className="label-tech text-[11px] uppercase tracking-widest text-[#8a8a8a]">
                          {e.cupo === 1 ? "1 lugar" : `${e.cupo} lugares`}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
