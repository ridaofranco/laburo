/**
 * LA VIDRIERA DE SALONES: /salones (cuarto pool, 6/8).
 *
 * La puerta del que está buscando dónde hacer su fiesta. Entra alguien que ya
 * sabe cuántos son y para cuándo, y lo único que necesita saber es dónde entran.
 *
 * ── POR QUÉ LA BÚSQUEDA VA POR searchParams Y NO POR ESTADO EN EL CLIENTE ──
 * Por lo mismo que /servicios: con los filtros en la URL,
 * /salones?personas=180&provincia=Córdoba es un link que se pega en un WhatsApp,
 * se comparte en un grupo de egresados y lo puede indexar un buscador. Con el
 * estado adentro del cliente, todo eso sería la misma página vacía. Es la
 * diferencia entre un directorio y una pantalla.
 *
 * ── EL VOCABULARIO ──────────────────────────────────────────────────────────
 * Acá no se dice "venue", que es como se llama la tabla en HITO. Se dice salón,
 * que es como lo dice todo el mundo en Argentina. El nombre técnico se queda en
 * la base.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { PROVINCIAS } from "@/lib/provincias";
import { buscarSalones } from "./actions";
import { FiltrosSalones } from "./filtros";
import { TarjetaSalon } from "./tarjeta";

const DESCRIPCION =
  "Salones y espacios para casamientos, cumpleaños de 15, egresados y eventos de empresa. Buscá por cuánta gente entra y por dónde queda, y consultá la fecha directo, sin cuenta y sin vueltas.";

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

/**
 * La metadata es dinámica por el `noindex`, igual que en /servicios.
 *
 * Al 6/8 no hay un solo salón publicado. Dejar que Google guarde una página que
 * dice "todavía no hay salones" es quedarse con ese resultado en el índice
 * durante semanas, justo cuando empiece a haber algo que mostrar. Se destraba
 * solo: en cuanto haya uno publicado, la página vuelve a ser indexable sin que
 * nadie toque nada.
 */
export async function generateMetadata(): Promise<Metadata> {
  const hayAlgo = (await buscarSalones({})).length > 0;

  return {
    title: "Salones para eventos | LABURO",
    description: DESCRIPCION,
    alternates: { canonical: "/salones" },
    robots: hayAlgo ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: "/salones",
      siteName: "LABURO",
      locale: "es_AR",
      title: "Salones para eventos | LABURO",
      description: DESCRIPCION,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

interface Props {
  searchParams: Promise<{ q?: string; provincia?: string; personas?: string }>;
}

export default async function SalonesPage({ searchParams }: Props) {
  const sp = await searchParams;

  // El número llega como texto de la URL y puede ser cualquier cosa: alguien
  // edita el link a mano, o llega "personas=abc" de un share mal copiado.
  // Number.parseInt de basura da NaN, y NaN viajando a la RPC es un 400 mudo.
  const personasNum = Number.parseInt(sp.personas ?? "", 10);
  const personas = Number.isFinite(personasNum) && personasNum > 0 ? personasNum : null;

  const filtros = {
    texto: sp.q ?? "",
    provincia: sp.provincia ?? "",
    // Se refleja el valor SANEADO y no el crudo: si alguien llegó con
    // "personas=abc", el campo tiene que aparecer vacío y no repetirle su error.
    personas: personas ? String(personas) : "",
  };

  const salones = await buscarSalones({
    texto: filtros.texto,
    provincia: filtros.provincia,
    personas,
  });

  const hayFiltros = Boolean(filtros.texto || filtros.provincia || filtros.personas);

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          {/* El que llega a una vidriera de salones es, muchas veces, el dueño de
           * uno. Es el lugar más barato del sitio para conseguir el primero. */}
          <div className="flex items-center gap-5 md:gap-7">
            <Link
              href="/registrar-salon"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white hover:text-[#0047ff] transition-colors duration-300"
            >
              ¿Tenés un salón? Publicalo gratis
            </Link>
            <Link
              href="/servicios"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
            >
              Proveedores
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`${WRAP} pt-16 md:pt-24 pb-10`}>
          <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
            Salones // por SOMOS DER
          </span>
          <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(34px,5.5vw,64px)] mt-5">
            ¿Dónde
            <br />
            entran todos?
          </h1>
          <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-8">
            Decinos cuántos son y dónde es, y te mostramos los salones donde tu
            fiesta entra. Después consultás la fecha directo, sin crear ninguna
            cuenta.
          </p>
        </section>

        <section className={`${WRAP} pb-12`}>
          <FiltrosSalones provincias={PROVINCIAS} inicial={filtros} />
        </section>

        <section className={`${WRAP} pb-28`}>
          {salones.length === 0 ? (
            /* El vacío se dice con honestidad y con una salida.
             *
             * Al 6/8 el directorio de salones está vacío de verdad. Esta pantalla
             * se construyó igual porque el día que se anote el primero ya está
             * prendida, pero mientras tanto NO puede simular que hay algo. Una
             * persona que llega y lee "no hay resultados" a secas no vuelve; una
             * que encuentra por dónde seguir, capaz sí. */
            <div className="border border-[#1a1a1a] p-10 md:p-16 flex flex-col gap-6 items-start">
              <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                {hayFiltros ? "Sin resultados" : "Todavía no hay salones publicados"}
              </span>
              <h2 className="font-[family-name:var(--font-syne)] text-[28px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05] max-w-[620px]">
                {hayFiltros
                  ? "No encontramos ninguno con esa búsqueda"
                  : "Estamos armando el directorio"}
              </h2>
              <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] max-w-[560px]">
                {hayFiltros
                  ? "Probá con menos filtros, o con un número redondo de invitados. Si no aparece lo que buscás, escribinos y te lo conseguimos nosotros: SOMOS DER produce eventos hace años y trabaja con salones de todo el país."
                  : "Todavía no hay salones publicados acá. Mientras tanto, escribinos y te conseguimos el lugar con los salones con los que ya trabajamos."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                {hayFiltros ? (
                  <Link
                    href="/salones"
                    className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                  >
                    Ver todos
                  </Link>
                ) : (
                  <Link
                    href="/registrar-salon"
                    className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                  >
                    Tengo un salón, publicarlo
                  </Link>
                )}
                <a
                  href="https://somosder.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
                >
                  Hablar con SOMOS DER
                </a>
              </div>
            </div>
          ) : (
            <>
              <p className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] pb-6 border-b border-[#1a1a1a]">
                {salones.length === 1 ? "1 salón" : `${salones.length} salones`}
                {personas ? ` para ${personas} personas` : ""}
              </p>
              <div>
                {salones.map((s) => (
                  <TarjetaSalon key={s.slug} s={s} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-[#1a1a1a]">
        <div className={`${WRAP} py-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
          <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
            © 2026 LABURO · SOMOS DER
          </span>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href="/entrar"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Tengo un salón
            </Link>
            <Link
              href="/servicios"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Proveedores
            </Link>
            <Link
              href="/"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Necesito staff
            </Link>
            <a
              href="https://somosder.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              somosder.ar
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
