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
import { jsonLdSeguro, schemaListado } from "@/lib/schema-vidriera";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { PROVINCIAS } from "@/lib/provincias";
import { buscarPublico, getCategoriasPublicas, getPaisesPublicos } from "./actions";
import { FiltrosVidriera } from "./filtros";
import { TarjetaProveedor } from "./tarjeta";
import { FamiliaDer } from "@/components/familia-der";
import { Faq } from "../blog/faq";

// 16/11: decía «Proveedores para tu evento». La gente busca «proveedores para eventos».
const TITULO = "Proveedores para eventos: catering, sonido y más | LABURO";
// 27/11: la búsqueda principal («proveedores para eventos») va en la descripción,
// el primer párrafo y un H2 (control de los seis lugares, plan Número 1).
const DESCRIPCION =
  "Proveedores para eventos en un solo lugar: catering, sonido, fotografía, seguridad y ambientación. Pedí presupuesto directo a cada uno, sin cuenta y gratis.";

const FAQS = [
  {
    q: "¿Cómo pido presupuesto a proveedores para eventos en LABURO?",
    a: "Buscás por rubro, provincia o palabra, entrás a la ficha del proveedor y le mandás el pedido por el formulario con tu nombre, tu mail y los datos del evento. No hace falta crear cuenta. El pedido le llega al proveedor por mail y te contesta directo a vos.",
  },
  {
    q: "¿Cuánto cuesta pedir presupuesto?",
    a: "Nada. Pedir presupuesto es gratis y publicarse como proveedor también. El precio del servicio lo arreglás directo con cada proveedor: LABURO no cobra entre partes.",
  },
  {
    q: "¿Qué datos conviene mandar en el pedido?",
    a: "Fecha, lugar con dirección, cantidad de personas, horario del evento y horario disponible para montaje y desmontaje. Después, lo propio del rubro: qué equipo o servicio necesitás y qué querés que esté incluido. Cuanto más completo el primer pedido, menos idas y vueltas antes de tener un precio.",
  },
  {
    q: "¿Y si no encuentro el proveedor que necesito?",
    a: "Probá con menos filtros o con otra palabra. Si igual no aparece, escribinos: SOMOS DER produce eventos y trabaja con proveedores de todos los rubros, y si querés que alguien se ocupe del evento entero, eso es producción integral.",
  },
  {
    q: "Tengo un servicio para eventos, ¿cómo me publico?",
    a: "Te registrás gratis en /registrar-proveedor con el nombre de tu empresa, un contacto y una descripción, y cargás un servicio por cada cosa distinta que ofrecés. Los pedidos de presupuesto te llegan por mail y los ves en tu panel.",
  },
];

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
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical: "/servicios" },
    robots: hayAlgo ? undefined : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: "/servicios",
      siteName: "LABURO",
      locale: "es_AR",
      title: TITULO,
      description: DESCRIPCION,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

interface Props {
  searchParams: Promise<{ q?: string; categoria?: string; provincia?: string; pais?: string }>;
}

export default async function ServiciosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filtros = {
    texto: sp.q ?? "",
    categoria: sp.categoria ?? "",
    provincia: sp.provincia ?? "",
    pais: sp.pais ?? "",
  };

  const [proveedores, categorias, paises] = await Promise.all([
    buscarPublico(filtros),
    getCategoriasPublicas(),
    getPaisesPublicos("proveedor"),
  ]);

  const hayFiltros = Boolean(filtros.texto || filtros.categoria || filtros.provincia || filtros.pais);

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
            {/* El que está armando su fiesta necesita las dos cosas, y casi
             * siempre el salón primero. Cruzar las dos vidrieras es gratis y es
             * lo que evita que alguien crea que acá solo hay proveedores. */}
            <Link
              href="/salones"
              className="label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
            >
              Salones
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
          {/* El renglón chico va ADENTRO del h1 (16/11): el título grande no dice
           * qué es la página, y Google no la mostraba ni una vez para
           * «proveedores para eventos». Se ve igual que antes. */}
          <h1>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
              Proveedores para eventos // por SOMOS DER
            </span>
            <span className="block font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.9] text-[clamp(34px,5.5vw,64px)] mt-5">
              Todo lo que
              <br />
              necesita tu fiesta.
            </span>
          </h1>
          <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] max-w-[620px] mt-8">
            Proveedores para eventos de catering, sonido, fotos, seguridad y
            ambientación. Buscá lo que te falta, entrá al perfil y pedile el
            presupuesto directo. No hace falta crear ninguna cuenta.
          </p>
        </section>

        <section className={`${WRAP} pb-12`}>
          <FiltrosVidriera
            categorias={categorias}
            provincias={PROVINCIAS}
            paises={paises}
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
                  : "Todavía no hay proveedores publicados acá. Mientras tanto, volvé pronto: los proveedores se suman solos y gratis."}
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

        {/* 27/11: el «cómo funciona» y las preguntas, debajo del listado para no
         * empujar los resultados. El H2 lleva la búsqueda principal. */}
        <section className="border-t border-[#1a1a1a]">
          <div className={`${WRAP} py-20 md:py-28`}>
            <div className="max-w-[760px]">
              <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.05] text-[clamp(26px,4vw,44px)]">
                Cómo pedir presupuesto a proveedores para eventos
              </h2>
              <ol className="list-decimal pl-6 mt-8 space-y-3 text-[16px] md:text-[17px] leading-[1.7] text-[#c8c8c8]">
                <li>Filtrá por rubro y provincia, o escribí lo que buscás.</li>
                <li>Entrá a la ficha y mirá qué incluye cada servicio y dónde trabaja.</li>
                <li>Mandá el pedido con fecha, lugar, cantidad de personas y horarios. Te contesta el proveedor, directo.</li>
              </ol>
              <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] mt-8">
                Para armar un pedido que se pueda comparar, leé{" "}
                <Link href="/blog/como-pedir-presupuesto-a-proveedores-de-eventos" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  cómo pedir presupuesto a proveedores de eventos
                </Link>
                . El lugar lo buscás en{" "}
                <Link href="/salones" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  salones para eventos
                </Link>{" "}
                y el personal en{" "}
                <Link href="/para/personal-para-eventos" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  personal para eventos
                </Link>
                . Si preferís que una sola empresa produzca todo, eso hace{" "}
                <a href="https://www.somosder.ar" target="_blank" rel="noopener" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  SOMOS DER
                </a>
                ; para la acreditación y el control de accesos está{" "}
                <a href="https://pase.somosder.ar" target="_blank" rel="noopener" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  PASE
                </a>
                .
              </p>
              <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] mt-6">
                ¿Tenés un servicio para eventos?{" "}
                <Link href="/registrar-proveedor" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  Publicarte es gratis
                </Link>
                . Y si necesitás web, marketing o ordenar el negocio, eso es{" "}
                <a href="https://hito.agency" target="_blank" rel="noopener" className="text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors">
                  HITO
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <Faq faqs={FAQS} />
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
        <div className={`${WRAP} pb-10`}>
          <FamiliaDer />
        </div>
      </footer>

      {!hayFiltros && proveedores.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdSeguro(schemaListado("Proveedores para eventos", "/servicios", proveedores)),
          }}
        />
      ) : null}
    </div>
  );
}
