/**
 * Landing publica de LABURO ("/").
 *
 * Reemplaza el app/route.ts anterior (HTML estatico exportado de Stitch, con
 * Tailwind por CDN, Google Fonts por CDN e imagenes hoteadas en Google). Esta
 * version es una page real del App Router: usa las fuentes self-hosted del
 * layout (next/font), los tokens del design system (globals.css) y Motion para
 * las apariciones.
 *
 * Decisiones de venta (diagnostico 2026-07-28):
 * - DOS caminos separados: productor -> formulario de lead SIN login (antes el
 *   CTA "Buscar staff" chocaba contra el login gateado) y trabajador -> /sumate.
 * - Numero real del pool en el hero: 687 postulantes verificados en la base
 *   (.planning/REQUIREMENTS.md DATA-02). Se publica "+680" para que la cifra
 *   no quede vieja ni prometa de mas.
 * - Prueba social con las cifras OFICIALES de SOMOS DER: +100 eventos,
 *   +150.000 asistentes, 6 paises. Nunca otra cifra de asistentes.
 * - Meta description + OG image 1200x630 (public/brand/laburo-og.png, del
 *   brand kit oficial).
 * - Copy legal-safe: nadie "forma parte del equipo"; la persona "queda
 *   confirmada para ese evento".
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "./landing/reveal";
import { LeadForm } from "./landing/lead-form";

const DESCRIPCION =
  "Staff para eventos con perfil y CV a la vista: más de 680 mozos, barras, seguridad, sonido y producción. Contanos qué necesita tu evento, sin planillas ni cadenas de WhatsApp. Y si trabajás en eventos, sumate al pool.";

export const metadata: Metadata = {
  title: "LABURO. Staff real para eventos",
  description: DESCRIPCION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LABURO",
    locale: "es_AR",
    title: "LABURO. Staff real para eventos",
    description: DESCRIPCION,
    images: [
      {
        url: "/brand/laburo-og.png",
        width: 1200,
        height: 630,
        alt: "LABURO. Staff para eventos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LABURO. Staff real para eventos",
    description: DESCRIPCION,
    images: ["/brand/laburo-og.png"],
  },
};

/* Idioma visual: Radical Minimalist (globals.css). Negro absoluto, hairlines
 * #1a1a1a, acento #0047ff con cuentagotas, Syne monumental, Geist para labels. */

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
      {children}
    </span>
  );
}

const PASOS = [
  {
    n: "PASO 01",
    titulo: "Contanos tu evento",
    texto:
      "Fecha, lugar y qué roles necesitás. Un formulario de dos minutos, sin crear ninguna cuenta.",
  },
  {
    n: "PASO 02",
    titulo: "Buscamos en el pool",
    texto:
      "Filtramos por rol, zona y disponibilidad sobre perfiles reales, con experiencia y CV cargados por cada persona.",
  },
  {
    n: "PASO 03",
    titulo: "Se confirma el staff",
    texto:
      "Cada persona recibe una oferta con pago, fechas y horarios, y la acepta con un click. Queda confirmada para tu evento y todo queda registrado.",
  },
];

const CIFRAS = [
  { valor: "+680", label: "Postulantes con perfil en el pool" },
  { valor: "+100", label: "Eventos operados" },
  { valor: "+150.000", label: "Asistentes" },
  { valor: "6", label: "Países" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      {/* Header minimalista, mismo patron que la landing anterior */}
      <header className="fixed top-0 inset-x-0 z-50 mix-blend-difference">
        <div className={`${WRAP} py-8 flex items-center justify-between`}>
          <span className="font-lockup text-[26px] text-white">LABURO.</span>
          <Link
            href="/login"
            className="label-tech text-[11px] tracking-[0.2em] px-7 py-3 border border-white text-white hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="min-h-dvh flex flex-col justify-end pb-20 md:pb-28 pt-40 relative overflow-hidden">
          {/* Grilla estructural de fondo (patron de /login) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none hidden md:grid grid-cols-12 gap-8 px-20 opacity-[0.05]"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border-r border-[#565656] h-full" />
            ))}
          </div>

          <div className={`${WRAP} relative z-10`}>
            <Reveal>
              <Eyebrow>Staff para eventos // por SOMOS DER</Eyebrow>
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.85] text-[clamp(64px,15vw,180px)] mt-6">
                <span className="block">Staff</span>
                <span className="block text-transparent [-webkit-text-stroke:1.5px_#f5f5f5]">
                  real.
                </span>
              </h1>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-14 md:mt-20 md:items-end">
              <Reveal delay={0.1} className="md:col-span-5">
                <p className="font-[family-name:var(--font-syne)] font-extrabold text-[clamp(48px,7vw,88px)] leading-none text-[#0047ff]">
                  +680
                </p>
                <p className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] mt-3">
                  Postulantes con perfil y CV en el pool
                </p>
              </Reveal>
              <Reveal delay={0.2} className="md:col-span-7 lg:col-start-7 lg:col-span-6">
                <p className="text-[18px] md:text-[21px] leading-[1.6] text-[#8a8a8a] max-w-[560px]">
                  Mozos, barras, seguridad, sonido y producción con datos reales
                  a la vista. Contanos qué necesita tu evento y te acercamos una
                  propuesta concreta, sin planillas eternas ni cadenas de
                  WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-10">
                  <a
                    href="#productores"
                    className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-10 py-5 font-[family-name:var(--font-syne)] font-bold text-[13px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
                  >
                    Necesito staff
                  </a>
                  <Link
                    href="/sumate"
                    className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-10 py-5 font-[family-name:var(--font-syne)] font-bold text-[13px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                  >
                    Quiero trabajar
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className="border-t border-[#1a1a1a]">
          <div className={`${WRAP} py-24 md:py-36`}>
            <Reveal>
              <Eyebrow>01 // Cómo funciona</Eyebrow>
              <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(40px,8vw,96px)] leading-none mt-4">
                El proceso.
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 mt-16 md:mt-24">
              {PASOS.map((p, i) => (
                <Reveal
                  key={p.n}
                  delay={i * 0.12}
                  className={`border-t border-[#1a1a1a] py-12 md:py-16 md:pr-10 ${
                    i > 0 ? "md:border-l md:pl-10" : ""
                  }`}
                >
                  <span className="font-[family-name:var(--font-syne)] text-[13px] font-bold text-[#0047ff] block mb-6">
                    {p.n}
                  </span>
                  <h3 className="font-[family-name:var(--font-syne)] text-[26px] md:text-[30px] font-bold uppercase tracking-tight mb-5">
                    {p.titulo}
                  </h3>
                  <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a]">
                    {p.texto}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Respaldo / prueba social ── */}
        <section id="respaldo" className="border-t border-[#1a1a1a] bg-[#050505]">
          <div className={`${WRAP} py-24 md:py-36`}>
            <Reveal>
              <Eyebrow>02 // Respaldo</Eyebrow>
              <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(40px,8vw,96px)] leading-none mt-4">
                No es una promesa.
                <br />
                Es operación.
              </h2>
              <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-8">
                LABURO nace adentro de SOMOS DER, productora de eventos. Es el
                mismo pool y el mismo sistema que usamos para armar el staff de
                nuestras propias operaciones.
              </p>
            </Reveal>
            {/* La cifra mas larga ("+150.000") dimensiona a todas: el clamp esta
             * calculado para que entre en la celda en cada breakpoint sin
             * desbordar sobre la celda vecina. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#1a1a1a] mt-16 md:mt-24">
              {CIFRAS.map((c, i) => (
                <Reveal
                  key={c.label}
                  delay={i * 0.1}
                  className={`p-6 md:p-8 border-[#1a1a1a] ${i % 2 === 1 ? "border-l" : ""} ${
                    i >= 2 ? "border-t lg:border-t-0" : ""
                  } ${i > 0 ? "lg:border-l" : ""}`}
                >
                  <p className="font-[family-name:var(--font-syne)] font-extrabold text-[clamp(22px,2.8vw,44px)] leading-none whitespace-nowrap">
                    {c.valor}
                  </p>
                  <p className="label-tech text-[10px] tracking-[0.2em] text-[#8a8a8a] mt-4">
                    {c.label}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Dos caminos ── */}
        <section id="caminos" className="border-t border-[#1a1a1a]">
          <div className={`${WRAP} py-24 md:py-36`}>
            <Reveal>
              <Eyebrow>03 // Dos caminos</Eyebrow>
              <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(40px,8vw,96px)] leading-none mt-4">
                ¿De qué lado
                <br />
                del evento estás?
              </h2>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 border border-[#1a1a1a] mt-16 md:mt-24">
              <Reveal className="p-10 md:p-14 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-[#1a1a1a]">
                <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                  Productores
                </span>
                <h3 className="font-[family-name:var(--font-syne)] text-[30px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05]">
                  Necesitás staff
                </h3>
                <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a]">
                  Contanos qué evento tenés y qué roles te faltan. Te
                  respondemos con perfiles reales del pool, con experiencia y
                  CV a la vista. Sin registro y sin compromiso.
                </p>
                <a
                  href="#productores"
                  className="mt-auto self-start inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
                >
                  Dejar mi consulta
                </a>
              </Reveal>
              <Reveal delay={0.12} className="p-10 md:p-14 flex flex-col gap-6">
                <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                  Staff
                </span>
                <h3 className="font-[family-name:var(--font-syne)] text-[30px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05]">
                  Trabajás en eventos
                </h3>
                <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a]">
                  Cargá tu perfil una sola vez. Cuando haya un evento que
                  encaje con tus roles y tu zona, te llega una oferta con pago
                  y fechas, y la aceptás con un click. Quedás confirmado/a para
                  ese evento.
                </p>
                <Link
                  href="/sumate"
                  className="mt-auto self-start inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                >
                  Sumate al pool
                </Link>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Formulario de productores ── */}
        <section id="productores" className="border-t border-[#1a1a1a] bg-[#050505] scroll-mt-16">
          <div className={`${WRAP} py-24 md:py-36`}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
              <Reveal className="md:col-span-5">
                <Eyebrow>04 // Productores</Eyebrow>
                <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(36px,6vw,72px)] leading-[0.95] mt-4">
                  Contanos qué necesitás.
                </h2>
                <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] mt-6 max-w-[420px]">
                  Sin registro, sin llamadas en frío. Dejás tu consulta y te
                  escribimos por mail para coordinar.
                </p>
              </Reveal>
              <Reveal delay={0.15} className="md:col-span-7">
                <LeadForm />
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a1a1a]">
        <div
          className={`${WRAP} py-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-8`}
        >
          <div className="flex flex-col gap-3">
            <span className="font-lockup text-[22px]">LABURO.</span>
            <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
              © 2026 LABURO · SOMOS DER. Todos los derechos reservados.
            </span>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {/* Entrada discreta al blog: no compite con los dos CTA de arriba. */}
            <Link
              href="/blog"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Blog
            </Link>
            <a
              href="https://somosder.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              somosder.ar
            </a>
            <Link
              href="/sumate"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Sumate al pool
            </Link>
            <Link
              href="/login"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
