/**
 * 404 propia (estética LABURO: negro absoluto, Syne monumental, radio 0). La
 * muestra Next cuando una ruta no existe y el usuario está logueado, o cuando
 * una página llama notFound(). Para usuarios sin sesión, el middleware manda las
 * rutas desconocidas a /login (postura defensiva: no revela qué rutas existen).
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 text-center">
      <p className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#8a8a8a] mb-6">
        Error 404
      </p>
      <h1 className="font-[family-name:var(--font-syne)] text-[clamp(4rem,20vw,180px)] font-extrabold leading-none tracking-tighter">
        404
      </h1>
      <p className="text-[18px] text-[#cfc4c5] mt-6 max-w-[420px] leading-[1.6]">
        Esta página no existe o se movió. Volvé al inicio y seguí desde ahí.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <Link
          href="/"
          className="border border-[#e5e2e1] bg-transparent text-[#e5e2e1] px-8 py-4 label-tech text-[12px] uppercase tracking-[0.2em] hover:bg-[#e5e2e1] hover:text-black transition-colors"
        >
          Ir al inicio
        </Link>
        <Link
          href="/login"
          className="label-tech text-[12px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#e5e2e1] transition-colors"
        >
          Ingresar
        </Link>
      </div>
    </main>
  );
}
