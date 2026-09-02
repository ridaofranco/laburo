/**
 * /registrarme — "¿qué querés publicar?", antes de mandar a nadie a un formulario.
 *
 * Franco (6/8), mirando el botón "Crear mi cuenta gratis" de la landing: *"tiene
 * que elegir qué quiere registrar de las 3, medio como en ingresar, que elija"*.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * El botón mandaba SIEMPRE a `/registrar-productora`. Cuando LABURO era una sola
 * cosa, eso estaba bien. Hoy hay cuatro puertas de alta distintas y cada una pide
 * datos que las otras no: la productora crea cuenta, el staff carga su CV, el
 * proveedor sus rubros y el salón su capacidad. Mandar a todo el mundo a la de
 * productora es garantizar que tres de cada cuatro se anoten en el lugar
 * equivocado, o se vayan.
 *
 * Es el mismo problema que resolvió `/entrar` del lado de ingresar, y por eso es
 * la misma pantalla: primero preguntamos qué sos, después te llevamos.
 *
 * ── POR QUÉ NO REUSA /entrar ────────────────────────────────────────────────
 * Porque `/entrar` pide mail y contraseña: es la puerta del que YA está. Acá no
 * hay nada que pedir todavía, solo hay que elegir a dónde ir. Meter las dos cosas
 * en una pantalla la volvía a complicar, que es justo lo que Franco pidió evitar.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";

export const metadata: Metadata = {
  title: "LABURO. | Registrarme",
  description:
    "Elegí qué querés hacer en LABURO: buscar staff para tus eventos, trabajar en eventos, publicar tus servicios o publicar tu salón. Es gratis.",
};

const OPCIONES = [
  {
    titulo: "Busco staff para mis eventos",
    bajada:
      "Productora, agencia, marca, empresa o particular. Cargo mi evento y contrato personal del pool.",
    href: "/registrar-productora",
    cta: "Crear mi cuenta",
  },
  {
    titulo: "Quiero trabajar en eventos",
    bajada:
      "Me sumo al pool con mi perfil y mi CV, y me llegan ofertas de trabajo.",
    href: "/sumate",
    cta: "Sumarme al pool",
  },
  {
    titulo: "Presto un servicio",
    bajada:
      "Sonido, catering, seguridad, fotografía, estructuras, lo que sea.",
    href: "/registrar-proveedor",
    cta: "Publicar mis servicios",
  },
  {
    titulo: "Tengo un salón o un espacio",
    bajada:
      "Un salón, un quincho, un galpón, una terraza. Me consultan fechas.",
    href: "/registrar-salon",
    cta: "Publicar mi salón",
  },
];

export default function RegistrarmePage() {
  return (
    <main className="relative min-h-dvh bg-black text-[#e5e2e1] px-6 py-14 md:py-20">
      <div className="relative z-10 w-full max-w-[860px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col items-start gap-4">
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[40px] md:h-[52px] w-auto" priority />
          </Link>
          <p className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5]">
            Registrarme
          </p>
          <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.95] text-[clamp(32px,6vw,60px)]">
            ¿Qué querés hacer?
          </h1>
          <p className="text-[16px] md:text-[17px] leading-[1.7] text-[#8a8a8a] max-w-[560px]">
            Elegí una y te llevamos al formulario que va. Todo es gratis, y salvo
            que busques staff, no hace falta crear ninguna cuenta.
          </p>
        </div>

        {/* Sin animación de entrada envolviendo esto: si el JS no corre, la
         * pantalla tiene que mostrarse igual. Ya pasó dos veces el 5/8 que un
         * contenido quedó invisible adentro de un `opacity: 0` que nunca
         * animó, y no hay error que lo explique. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1a1a1a] border border-[#1a1a1a]">
          {OPCIONES.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className="group bg-black hover:bg-[#0a0a0a] p-7 md:p-9 flex flex-col gap-4 transition-colors duration-300"
            >
              <h2 className="font-[family-name:var(--font-syne)] text-[22px] md:text-[26px] font-bold uppercase tracking-tight leading-[1.1] text-[#e5e2e1]">
                {o.titulo}
              </h2>
              <p className="text-[15px] md:text-[16px] leading-[1.65] text-[#8a8a8a]">
                {o.bajada}
              </p>
              <span className="mt-auto pt-2 inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-[0.2em] text-[#cfc4c5] group-hover:text-[#0047ff] transition-colors">
                {o.cta}
                <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-2">
          <Link
            href="/entrar"
            className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
          >
            Ya tengo cuenta, quiero entrar
          </Link>
          <Link
            href="/"
            className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
