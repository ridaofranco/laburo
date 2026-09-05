/**
 * El molde compartido de Términos y Privacidad.
 *
 * Existe para que las dos páginas no se separen de a poco: mismo ancho, misma
 * tipografía, misma fecha de última actualización, mismo camino de vuelta.
 */

import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";

export function LegalShell({
  titulo,
  bajada,
  actualizado,
  children,
}: {
  titulo: string;
  bajada: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased">
      <div className="max-w-[720px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-8">
        <header className="flex flex-col items-start gap-3">
          <Link href="/">
            <LaburoWordmark className="h-[28px] w-auto" />
          </Link>
          <h1 className="t-display text-[#e5e2e1] mt-4">{titulo}</h1>
          <p className="text-[16px] text-[#cfc4c5] leading-[1.6]">{bajada}</p>
          <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#988e90] mt-2">
            Última actualización: {actualizado}
          </p>
        </header>

        {/* El contenido va con su propio ritmo de lectura: interlineado
            generoso y bloques separados, porque nadie lee esto con ganas. */}
        <div className="flex flex-col gap-8 text-[16px] leading-[1.7] text-[#cfc4c5]">
          {children}
        </div>

        <footer className="border-t border-[#4c4546]/60 pt-8 mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Link
            href="/terminos"
            className="label-tech text-[11px] tracking-[0.2em] text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
          >
            Términos
          </Link>
          <Link
            href="/privacidad"
            className="label-tech text-[11px] tracking-[0.2em] text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
          >
            Privacidad
          </Link>
          <Link
            href="/"
            className="label-tech text-[11px] tracking-[0.2em] text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
          >
            Volver
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** Un bloque con su título. Para no repetir clases en cada sección. */
export function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-section text-[#e5e2e1] uppercase">{titulo}</h2>
      {children}
    </section>
  );
}
