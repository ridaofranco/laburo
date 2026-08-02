"use client";

/**
 * Los filtros de la vidriera.
 *
 * Es un <form method="get"> de verdad y no un puñado de onChange que empujan al
 * router. Dos razones:
 *   1. Sin JS igual funciona. Esta pantalla la abre gente desde el link de un
 *      WhatsApp, a veces con la conexión de un colectivo.
 *   2. Los filtros terminan en la URL, que es lo que hace que la búsqueda se
 *      pueda compartir y guardar. Ver el comentario de page.tsx.
 *
 * El submit lo maneja el navegador; useRouter solo se usa para "limpiar", que es
 * ir a /servicios sin nada.
 */

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const inputCls =
  "w-full min-h-[52px] bg-[#0a0a0a] border border-[#1a1a1a] focus:border-[#0047ff] outline-none text-[16px] text-[#f5f5f5] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";

const labelCls = "label-tech text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]";

export function FiltrosVidriera({
  categorias,
  provincias,
  inicial,
}: {
  categorias: string[];
  provincias: string[];
  inicial: { texto: string; categoria: string; provincia: string };
}) {
  const router = useRouter();
  const hayFiltros = Boolean(inicial.texto || inicial.categoria || inicial.provincia);

  return (
    <form method="get" action="/servicios" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <label className="flex flex-col gap-2 md:col-span-5" htmlFor="q">
          <span className={labelCls}>Qué necesitás</span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={inicial.texto}
            placeholder="Catering, fotógrafo, barra…"
            maxLength={80}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-4" htmlFor="categoria">
          <span className={labelCls}>Rubro</span>
          <select
            id="categoria"
            name="categoria"
            defaultValue={inicial.categoria}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Todos los rubros</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 md:col-span-3" htmlFor="provincia">
          <span className={labelCls}>Dónde es</span>
          <select
            id="provincia"
            name="provincia"
            defaultValue={inicial.provincia}
            className={`${inputCls} appearance-none`}
          >
            <option value="">Todo el país</option>
            {provincias.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
        >
          <Search size={16} aria-hidden="true" />
          Buscar
        </button>
        {hayFiltros ? (
          <button
            type="button"
            onClick={() => router.push("/servicios")}
            className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors"
          >
            <X size={14} aria-hidden="true" />
            Limpiar
          </button>
        ) : null}
      </div>
    </form>
  );
}
