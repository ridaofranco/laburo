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
 * - Numero real del pool en el hero, redondeado hacia abajo. Al 2/8/2026 son
 *   1016 personas activas medidas contra produccion (antes decia "+680" sobre
 *   los 687 de julio, y habia quedado corto por mas de 300). Se publica "+1000"
 *   para que la cifra no quede vieja ni prometa de mas.
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
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { waLink } from "@/lib/wa";
import { PAGO_TEXTO } from "@/lib/pago";

const DESCRIPCION =
  "Staff para eventos con perfil y CV a la vista: más de 1000 mozos, barras, seguridad, sonido y producción. Contanos qué necesita tu evento, sin planillas ni cadenas de WhatsApp. Y si trabajás en eventos, sumate al pool.";

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

/**
 * El WhatsApp de SOMOS DER (el mismo de la web, de los mails y de la ruta /o).
 * La landing no tenía NINGÚN link de WhatsApp: el productor apurado que no
 * quiere llenar un formulario no tenía por dónde entrar.
 */
const WA_NUMERO = "5491171540675";
const WA_MENSAJE =
  "Hola, los encontré por LABURO. Necesito staff para un evento y quería consultarles.";
const WA_HREF = waLink(WA_NUMERO, WA_MENSAJE);

/**
 * Link a WhatsApp, discreto a propósito: el CTA principal sigue siendo el
 * formulario (deja el lead guardado y trazable). Esto es la salida para el que
 * prefiere escribir. Glifo OFICIAL de WhatsApp (regla dura de marca).
 */
function WhatsAppLink({
  children,
  className = "",
  size = 15,
}: {
  children: React.ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <a
      href={WA_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 label-tech transition-colors duration-300 ${className}`}
    >
      <WhatsAppGlyph size={size} className="shrink-0" />
      {children}
    </a>
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
  { valor: "+1000", label: "Postulantes con perfil en el pool" },
  { valor: "+100", label: "Eventos operados" },
  { valor: "+150.000", label: "Asistentes" },
  { valor: "6", label: "Países" },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      {/* Header minimalista, mismo patron que la landing anterior.
       *
       * EL BOTON PRIMARIO ES COMERCIAL, NO EL LOGIN (diagnostico de conversion
       * 2026-07-30, L3): antes el unico boton del header era "Ingresar" -> /login,
       * y /login usa shouldCreateUser:false (login-form.tsx), asi que el productor
       * nuevo que ponia su mail ahi NUNCA recibia el link y se quedaba esperando.
       * En movil ese boton era uno de los dos elementos que entran arriba del
       * pliegue: el lugar mas caro de la pantalla para la accion menos rentable.
       * Ahora el relleno se lo lleva "Necesito staff" -> #productores (el
       * formulario que si guarda el lead) y "Ingresar" baja a link de texto. */}
      <header className="fixed top-0 inset-x-0 z-50 mix-blend-difference">
        <div className={`${WRAP} py-6 md:py-8 flex items-center justify-between gap-4`}>
          {/* 18px en movil: con "Necesito staff" + "Ingresar" al lado, el
           * wordmark a 26px desbordaba el ancho de 390px. El header padre tiene
           * mix-blend-difference y el blend sigue funcionando sobre la imagen. */}
          <LaburoWordmark className="h-[18px] md:h-[26px] w-auto" priority />
          <div className="flex items-center gap-3 md:gap-8 shrink-0">
            <Link
              href="/login"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.1em] md:tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
            >
              Ingresar
            </Link>
            <a
              href="#productores"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.08em] md:tracking-[0.2em] whitespace-nowrap bg-white text-black px-4 md:px-7 py-3 hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
            >
              Necesito staff
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──
         *
         * MOVIL: contenido arrancando arriba, no abajo (diagnostico de conversion
         * 2026-07-30, L6). Antes era `justify-end pt-40`: 160px de aire muerto
         * arriba MAS el anclaje al piso, y los dos CTA quedaban tapados por la
         * barra de Safari en un iPhone 13 (el area visible real ronda los 664px,
         * no los 844 del viewport). Con `justify-start pt-28` el boton primario
         * queda entero arriba del pliegue. En md+ se mantiene el hero monumental
         * anclado al piso, que ahi entra sin problema. */}
        <section className="min-h-dvh flex flex-col justify-start md:justify-end pb-20 md:pb-28 pt-28 md:pt-40 relative overflow-hidden">
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
            {/* Los tres bloques del hero van con visibleDeArranque: sin JS, el
             * resto de la landing se cae pero el hero (titulo, cifra del pool,
             * parrafo y los dos CTA) se sirve visible. */}
            <Reveal visibleDeArranque>
              <Eyebrow>Staff para eventos // por SOMOS DER</Eyebrow>
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.85] text-[clamp(64px,15vw,180px)] mt-6">
                <span className="block">Staff</span>
                <span className="block text-transparent [-webkit-text-stroke:1.5px_#f5f5f5]">
                  real.
                </span>
              </h1>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-10 md:mt-20 md:items-end">
              <Reveal visibleDeArranque delay={0.1} className="md:col-span-5">
                <p className="font-[family-name:var(--font-syne)] font-extrabold text-[clamp(48px,7vw,88px)] leading-none text-[#0047ff]">
                  +1000
                </p>
                <p className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] mt-3">
                  Postulantes con perfil y CV en el pool
                </p>
              </Reveal>
              <Reveal
                visibleDeArranque
                delay={0.2}
                className="md:col-span-7 lg:col-start-7 lg:col-span-6"
              >
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
                {/* CUANDO SE COBRA, arriba y no despues de aceptar (diagnostico
                 * de conversion 2026-07-30, L5). Es la pregunta numero uno de
                 * cualquiera que trabaja en eventos y el argumento mas fuerte
                 * del lado oferta, y hasta ahora solo aparecia en el mail de la
                 * oferta, o sea despues de que la persona ya estaba adentro.
                 * El plazo se lee de lib/pago.ts: un solo lugar en todo el
                 * sistema, asi la landing no se despega de lo que dice el mail. */}
                <p className="text-[15px] leading-[1.7] text-[#cfc4c5] border-l-2 border-[#0047ff] pl-5">
                  Cargar tu perfil es gratis. {PAGO_TEXTO} El monto está escrito
                  en la oferta, antes de que aceptes.
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
                <div className="mt-8 pt-8 border-t border-[#1a1a1a] max-w-[420px]">
                  <p className="text-[15px] leading-[1.7] text-[#8a8a8a]">
                    ¿Es para ya? Escribinos directo:
                  </p>
                  <WhatsAppLink
                    size={17}
                    className="mt-3 text-[13px] tracking-[0.14em] text-[#25D366] hover:opacity-70"
                  >
                    11 7154-0675
                  </WhatsAppLink>
                </div>
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
            <LaburoWordmark className="h-[22px] w-auto" />
            <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
              © 2026 LABURO · SOMOS DER. Todos los derechos reservados.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <WhatsAppLink className="text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#25D366]">
              WhatsApp
            </WhatsAppLink>
            {/* La vidriera de proveedores (Fase 4).
             *
             * Va en el footer y NO como un tercer camino arriba, a propósito y
             * por ahora: al 2/8 el directorio está vacío, y mandar tráfico
             * desde el lugar más caro de la landing a un empty state quema a la
             * primera persona que entra. En cuanto Franco publique los primeros
             * diez proveedores, esto sube a la sección "Dos caminos", que pasa a
             * ser tres: productores, staff y quien arma su propia fiesta. */}
            <Link
              href="/servicios"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Proveedores
            </Link>
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
