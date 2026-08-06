"use client";

/**
 * Los filtros de la vidriera de salones.
 *
 * Es un <form method="get"> de verdad, igual que el de /servicios y por las
 * mismas dos razones: sin JS igual funciona (esta pantalla la abre gente desde
 * el link de un WhatsApp, a veces con la conexión de un colectivo), y los
 * filtros terminan en la URL, que es lo que hace que la búsqueda se pueda
 * compartir e indexar.
 *
 * ── LO QUE CAMBIA RESPECTO DE PROVEEDORES ───────────────────────────────────
 * El filtro del medio no es "rubro", es CUÁNTA GENTE. Es la diferencia entera
 * entre las dos vidrieras: un salón se elige por si entra tu fiesta.
 *
 * El campo va primero en el orden visual de la fila en escritorio, pero en el
 * teléfono queda arriba de todo igual, porque la grilla colapsa a una columna en
 * el orden del DOM y ese es el orden en que la persona piensa: cuántos somos,
 * dónde, y recién ahí qué tipo de lugar.
 */

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const inputCls =
  "w-full min-h-[52px] bg-[#0a0a0a] border border-[#1a1a1a] focus:border-[#0047ff] outline-none text-[16px] text-[#f5f5f5] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";

const labelCls = "label-tech text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]";

export function FiltrosSalones({
  provincias,
  inicial,
}: {
  provincias: string[];
  inicial: { texto: string; provincia: string; personas: string };
}) {
  const router = useRouter();
  const hayFiltros = Boolean(inicial.texto || inicial.provincia || inicial.personas);

  return (
    <form method="get" action="/salones" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <label className="flex flex-col gap-2 md:col-span-3" htmlFor="personas">
          <span className={labelCls}>Cuántos son</span>
          <input
            id="personas"
            name="personas"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            defaultValue={inicial.personas}
            placeholder="180"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-3" htmlFor="provincia">
          <span className={labelCls}>Dónde</span>
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

        <label className="flex flex-col gap-2 md:col-span-6" htmlFor="q">
          <span className={labelCls}>Qué buscás</span>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={inicial.texto}
            placeholder="Casamiento, quincho, salón con pileta…"
            maxLength={80}
            className={inputCls}
          />
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
            onClick={() => router.push("/salones")}
            className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors"
          >
            <X size={14} aria-hidden="true" />
            Limpiar
          </button>
        ) : null}
      </div>

      {/* Lo que la búsqueda por capacidad significa de verdad, dicho una vez.
       *  Sin esto, alguien que pone 180 y ve pocos resultados piensa que no hay
       *  salones, cuando lo que pasa es que se están escondiendo los que le
       *  quedan demasiado grandes o demasiado chicos. */}
      <p className="text-[13px] leading-[1.6] text-[#8a8a8a] max-w-[620px]">
        Si ponés cuántos son, te mostramos solo los salones donde esa cantidad
        entra: los que llegan a ese número y no le quedan demasiado grandes.
      </p>
    </form>
  );
}
