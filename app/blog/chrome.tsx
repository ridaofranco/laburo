import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";

/**
 * Chrome compartido del blog (header + footer), calcado del de la landing para
 * que el blog no parezca un sitio aparte.
 *
 * Regla de marca dura: LABURO va con WORDMARK solo, sin símbolo. Nada de logo,
 * ícono ni monograma acá, y el wordmark es siempre el PNG oficial.
 *
 * El "LABURO" del BlogCta más abajo NO es el lockup: es un eyebrow en
 * `label-tech` (Geist con tracking amplio) que etiqueta la sección, así que se
 * queda como texto.
 */

export const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

export function BlogHeader() {
  return (
    <header className="border-b border-[#1a1a1a]">
      <div className={`${WRAP} py-6 flex items-center justify-between`}>
        <Link href="/">
          <LaburoWordmark className="h-[22px] w-auto" />
        </Link>
        <nav className="flex items-center gap-6 md:gap-10">
          <Link
            href="/blog"
            className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/sumate"
            className="label-tech text-[11px] tracking-[0.2em] px-6 py-3 border border-[#f5f5f5] text-[#f5f5f5] hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
          >
            Sumate
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className="border-t border-[#1a1a1a]">
      <div
        className={`${WRAP} py-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-8`}
      >
        <div className="flex flex-col gap-3">
          <Link href="/">
            <LaburoWordmark className="h-[22px] w-auto" />
          </Link>
          <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
            © 2026 LABURO · SOMOS DER. Todos los derechos reservados.
          </span>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-3">
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
  );
}

/**
 * Cierre comercial de cada post: los dos caminos de la landing, sin inventar
 * nada que la app no haga.
 */
export function BlogCta() {
  return (
    <section className="border-t border-[#1a1a1a] bg-[#050505]">
      <div className={`${WRAP} py-20 md:py-28`}>
        <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
          LABURO
        </span>
        <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(32px,6vw,72px)] leading-none mt-4">
          Staff real,
          <br />
          para tu evento.
        </h2>
        <p className="text-[16px] md:text-[18px] leading-[1.7] text-[#8a8a8a] max-w-[560px] mt-8">
          Contanos qué necesitás y te acercamos perfiles del pool, con
          experiencia y CV a la vista. Y si trabajás en eventos, cargá tu perfil
          una vez y recibí propuestas con pago y fechas.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <Link
            href="/#productores"
            className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
          >
            Necesito staff
          </Link>
          <Link
            href="/sumate"
            className="inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
          >
            Quiero trabajar
          </Link>
        </div>
      </div>
    </section>
  );
}
