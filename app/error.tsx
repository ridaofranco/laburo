"use client";

/**
 * Pantalla de error propia (30/10). Antes no había ninguna: si una página tiraba
 * (una lectura de la base que falla, un corte), se veía la de Next en inglés
 * («Application error: a server-side exception has occurred»). Misma estética
 * que la 404. El `digest` es el código que aparece en los logs de Vercel.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error.tsx]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 text-center">
      <p className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#8a8a8a] mb-6">
        Algo falló
      </p>
      <h1 className="t-section break-words max-w-[520px]">No pudimos cargar esta página</h1>
      <p className="text-[18px] text-[#cfc4c5] mt-6 max-w-[420px] leading-[1.6]">
        Fue un problema nuestro, no de lo que hiciste. Probá de nuevo en un momento.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <button
          type="button"
          onClick={() => reset()}
          className="border border-[#e5e2e1] bg-transparent text-[#e5e2e1] px-8 py-4 label-tech text-[12px] uppercase tracking-[0.2em] hover:bg-[#e5e2e1] hover:text-black transition-colors"
        >
          Probar de nuevo
        </button>
        <Link
          href="/"
          className="label-tech text-[12px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#e5e2e1] transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-10 text-[12px] text-[#8a8a8a]">Código: {error.digest}</p>
      ) : null}
    </main>
  );
}
