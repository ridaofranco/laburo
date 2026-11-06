import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import type { IdiomaTraduccion } from "@/lib/blog";
import { TEXTOS, waLink } from "@/lib/blog-i18n";
import { WRAP } from "../chrome";

/**
 * Header, pie y cierre del blog traducido (/en, /pt, /fr, /it), calcados del
 * chrome del blog en español (app/blog/chrome.tsx). Mismas reglas de marca:
 * wordmark solo, sin símbolo. El cierre va a WhatsApp con el texto en el idioma
 * de la nota, porque la app de LABURO es solo en castellano.
 */

export function BlogHeaderIntl({ lang }: { lang: IdiomaTraduccion }) {
  const t = TEXTOS[lang];
  return (
    <header className="border-b border-[#1a1a1a]">
      <div className={`${WRAP} py-6 flex items-center justify-between`}>
        <Link href={`/${lang}/blog`} aria-label="LABURO">
          <LaburoWordmark className="h-[22px] w-auto" />
        </Link>
        <nav className="flex items-center gap-6 md:gap-10">
          <Link
            href={`/${lang}/blog`}
            className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
          >
            {t.blog}
          </Link>
          <a
            href={waLink(t.ctaWa)}
            target="_blank"
            rel="noopener"
            className="label-tech text-[11px] tracking-[0.2em] px-6 py-3 border border-[#f5f5f5] text-[#f5f5f5] hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
          >
            WhatsApp
          </a>
        </nav>
      </div>
    </header>
  );
}

export function BlogFooterIntl({ lang }: { lang: IdiomaTraduccion }) {
  const t = TEXTOS[lang];
  const link = "label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors";
  return (
    <footer className="border-t border-[#1a1a1a]">
      <div className={`${WRAP} py-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-8`}>
        <div className="flex flex-col gap-3">
          <Link href={`/${lang}/blog`} aria-label="LABURO">
            <LaburoWordmark className="h-[22px] w-auto" />
          </Link>
          <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">{t.pie}</span>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <Link href={`/${lang}/blog`} className={link}>
            {t.blog}
          </Link>
          <Link href="/blog" hrefLang="es" className={link}>
            Blog (ES)
          </Link>
          <a href="https://somosder.com" target="_blank" rel="noopener noreferrer" className={link}>
            somosder.com
          </a>
          <a href="https://pase.somosder.ar" target="_blank" rel="noopener" className={link}>
            PASE
          </a>
        </div>
      </div>
    </footer>
  );
}

export function BlogCtaIntl({ lang }: { lang: IdiomaTraduccion }) {
  const t = TEXTOS[lang];
  return (
    <section className="border-t border-[#1a1a1a] bg-[#050505]">
      <div className={`${WRAP} py-20 md:py-28`}>
        <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">LABURO</span>
        <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(32px,6vw,72px)] leading-none mt-4">
          {t.ctaTitulo[0]}
          <br />
          {t.ctaTitulo[1]}
        </h2>
        <p className="text-[16px] md:text-[18px] leading-[1.7] text-[#8a8a8a] max-w-[560px] mt-8">{t.ctaTexto}</p>
        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <a
            href={waLink(t.ctaWa)}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
          >
            {t.ctaBoton}
          </a>
        </div>
      </div>
    </section>
  );
}
