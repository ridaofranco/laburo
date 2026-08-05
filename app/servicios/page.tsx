/**
 * LA VIDRIERA: /servicios (Fase 4).
 *
 * La puerta del cliente final. Entra alguien que está organizando su casamiento,
 * el cumpleaños de 15 de su hija o el egreso de la escuela, busca "catering en
 * zona norte" y le pide presupuesto a quien le sirva. Sin cuenta y sin llamar a
 * nadie.
 *
 * ── POR QUÉ LA BÚSQUEDA VA POR searchParams Y NO POR ESTADO EN EL CLIENTE ──
 * Porque esta pantalla existe para que la encuentren de afuera. Con los filtros
 * en la URL, /servicios?categoria=Catering+y+gastronomía es un link que se pega
 * en un WhatsApp, se comparte en un grupo de egresados y lo puede indexar un
 * buscador. Con el estado adentro del cliente, todo eso serían la misma página
 * vacía. Es la diferencia entre un directorio y una pantalla.
 *
 * ── EL VOCABULARIO CAMBIA, LA MÁQUINA NO ──
 * Es literalmente el mismo motor que usa la productora en /proveedores. Lo único
 * distinto son las palabras: acá no se dice "evento", "gig" ni "productora", se
 * dice casamiento, cumpleaños de 15 y fiesta. Una novia que lee "gestioná tus
 * búsquedas" no entiende dónde cayó.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { PROVINCIAS } from "@/lib/provincias";
import { buscarPublico, getCategoriasPublicas } from "./actions";
import { FiltrosVidriera } from "./filtros";
import { TarjetaProveedor } from "./tarjeta";

const DESCRIPCION =
  "Catering, sonido, fotografía, seguridad y todo lo que necesita tu fiesta, en un solo lugar. Pedile presupuesto directo a cada proveedor, sin cuenta y sin vueltas.";

/**
 * La metadata es dinámica por UNA razón concreta: el `noindex` de abajo.
 *
 * Al 2/8 el directorio está vacío (1016 personas en el pool contra cero
 * proveedores publicados). Dejar que Google guarde una página que dice "todavía
 * no hay proveedores" es quedarse con ese resultado en el índice durante
 * semanas, justo cuando empiece a haber algo que mostrar. Se destraba solo: en
 * cuanto haya un proveedor publicado, la página vuelve a ser indexable sin que
 * nadie toque nada.
 */
export async function generateMetadata(): Promise<Metadata> {
  const hayAlgo = (await buscarPublico({})).length > 0;

  return {
    title: "Proveedores para tu evento | LABURO",
    description: DESCRIPCION,
    alternates: { canonical: "/servicios" },
    robots: hayAlgo ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: "/servicios",
      siteName: "LABURO",
      locale: "es_AR",
      title: "Proveedores para tu evento | LABURO",
      description: DESCRIPCION,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

interface Props {
  searchParams: Promise<{ q?: string; categoria?: string; provincia?: string }>;
}

export default async function ServiciosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filtros = {
    texto: sp.q ?? "",
    categoria: sp.categoria ?? "",
    provincia: sp.provincia ?? "",
  };

  const [proveedores, categorias] = await Promise.all([
    buscarPublico(filtros),
    getCategoriasPublicas(),
  ]);

  const hayFiltros = Boolean(filtros.texto || filtros.categoria || filtros.provincia);

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          {/* La primera de las dos puertas del alta abierta (decision 2 de
           * Franco, 3/8). Va acá arriba porque el que llega a la vidriera es
           * justo el publico: o busca un proveedor, o es uno. */}
          <div className="flex items-center gap-5 md:gap-7">
            <Link
              href="/registrar-proveedor"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white hover:text-[#0047ff] transition-colors duration-300"
            >
              ¿Sos proveedor? Sumate gratis
            </Link>
            <Link
              href="/sumate"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
            >
              Trabajo en eventos
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`${WRAP} pt-16 md:pt-24 pb-10`}>
          <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
            Proveedores // por SOMOS DER
          </span>
          <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(40px,9vw,104px)] mt-5">
            Todo lo que
            <br />
            necesita tu fiesta.
          </h1>
          <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-8">
            Catering, sonido, fotos, seguridad, ambientación. Buscá lo que te
            falta, entrá al perfil y pedile el presupuesto directo. No hace falta
            crear ninguna cuenta.
          </p>
        </section>

        <section className={`${WRAP} pb-12`}>
          <FiltrosVidriera
            categorias={categorias}
            provincias={PROVINCIAS}
            inicial={filtros}
          />
        </section>

        <section className={`${WRAP} pb-28`}>
          {proveedores.length === 0 ? (
            /* El vacío se dice con honestidad y con una salida.
             *
             * Al 2/8 el directorio está vacío de verdad: hay 1016 personas en el
             * pool y cero proveedores publicados. Esta pantalla se construyó
             * igual porque el día que Franco cargue los primeros diez ya está
             * prendida, pero mientras tanto NO puede simular que hay algo. Una
             * persona que llega y lee "no hay resultados" a secas no vuelve; una
             * que encuentra por dónde seguir, capaz sí. */
            <div className="border border-[#1a1a1a] p-10 md:p-16 flex flex-col gap-6 items-start">
              <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                {hayFiltros ? "Sin resultados" : "Todavía no hay proveedores publicados"}
              </span>
              <h2 className="font-[family-name:var(--font-syne)] text-[28px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05] max-w-[620px]">
                {hayFiltros
                  ? "No encontramos nada con esa búsqueda"
                  : "Estamos armando el directorio"}
              </h2>
              <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] max-w-[560px]">
                {hayFiltros
                  ? "Probá con menos filtros o con otra palabra. Si no aparece lo que buscás, escribinos y te lo conseguimos nosotros: SOMOS DER produce eventos hace años y trabaja con proveedores de todos los rubros."
                  : "Todavía no hay proveedores publicados acá. Mientras tanto, escribinos y te armamos el evento con los proveedores con los que ya trabajamos."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                {hayFiltros ? (
                  <Link
                    href="/servicios"
                    className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                  >
                    Ver todos
                  </Link>
                ) : null}
                {/* El que mira un directorio vacio es, muchas veces, alguien
                 * que podria estar adentro. Antes del alta abierta esto no se
                 * podia ofrecer porque no habia puerta; ahora sí, y es el lugar
                 * mas barato de todo el sitio para conseguir el primer
                 * proveedor de verdad. */}
                {!hayFiltros ? (
                  <Link
                    href="/registrar-proveedor"
                    className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
                  >
                    Sos proveedor, publicate
                  </Link>
                ) : null}
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
                {proveedores.length === 1
                  ? "1 proveedor"
                  : `${proveedores.length} proveedores`}
              </p>
              <div>
                {proveedores.map((p) => (
                  <TarjetaProveedor key={p.profile_id} p={p} />
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
            {/* La puerta del proveedor que quiere estar acá. Sin esto, el
             *  directorio solo puede crecer si Franco carga a cada uno a mano. */}
            <Link
              href="/entrar"
              className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
            >
              Soy proveedor
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
