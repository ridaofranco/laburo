import { FAMILIA_DER } from "@/lib/fichas-de-la-casa";

/**
 * El renglón del pie con los otros productos de SOMOS DER (16/11/2026).
 * Franco: «mis productos entre sí deberían hablarse». El texto del enlace es la
 * búsqueda de cada producto, que es lo que Google lee para saber de qué trata.
 */
export function FamiliaDer({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Otros productos de SOMOS DER"
      className={`flex flex-wrap items-center gap-x-8 gap-y-3 ${className}`}
    >
      <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
        También de SOMOS DER
      </span>
      {FAMILIA_DER.map((f) => (
        <a
          key={f.href}
          href={f.href}
          target="_blank"
          rel="noopener"
          className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
        >
          {f.busqueda} · {f.marca}
        </a>
      ))}
    </nav>
  );
}
