"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Search, SlidersHorizontal } from "lucide-react";
import { OFICIOS_FRECUENTES } from "@/lib/oficios";
import {
  buildQueryString,
  activeFineFilterCount,
  type SearchFilters,
} from "@/lib/search-params";
import { CandidateCard, type StaffCard } from "./candidate-card";
import { EmptyResults, ErrorResults, LoadingResults } from "./results-states";
import { FiltrosSheet, type FineFilters } from "./filtros-sheet";

interface Props {
  candidates: StaffCard[];
  error: boolean;
  initialFilters: SearchFilters;
  /** Total REAL de fichas que matchean los filtros (no las de esta página). */
  total: number;
  /** Cuántas fichas entran en una página (lo define el server component). */
  porPagina: number;
}

/**
 * Región focal de la búsqueda (UI-SPEC visual anchor): input + fila de chips
 * de oficios arriba, resultados abajo. Los cambios actualizan la URL y el
 * server component re-consulta (payload chico, filtrado en Postgres).
 *
 * La página también vive en la URL (`?p=N`). Dos caminos distintos a propósito:
 * `composeAndPush` (cambiar un filtro) NO propaga la página y la deja en 1, y
 * `irAPagina` (los controles de abajo) sí la manda. El por qué está en el
 * comentario de buildQueryString.
 */
export function SearchClient({
  candidates,
  error,
  initialFilters,
  total,
  porPagina,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();

  const pagina = initialFilters.pagina;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  /** Ancla para subir al principio de los resultados al cambiar de página. */
  const resultadosRef = useRef<HTMLDivElement | null>(null);

  const [text, setText] = useState(initialFilters.q);
  const [selected, setSelected] = useState<string[]>(initialFilters.oficios);
  const [showFiltros, setShowFiltros] = useState(false);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const textRef = useRef(text);
  textRef.current = text;

  const composeAndPush = useCallback(
    (q: string, oficios: string[], fine?: FineFilters) => {
      const qs = buildQueryString({
        q,
        oficios,
        provincia: fine ? fine.provincia : initialFilters.provincia,
        ciudad: fine ? fine.ciudad : initialFilters.ciudad,
        finde: fine ? fine.finde : initialFilters.finde,
        viajar: fine ? fine.viajar : initialFilters.viajar,
        movilidad: fine ? fine.movilidad : initialFilters.movilidad,
        ocultarAsignados: fine
          ? fine.ocultarAsignados
          : initialFilters.ocultarAsignados,
        // XTRA-02: conservar el modo "buscar reemplazo" al ajustar otros
        // filtros; se limpia sólo con "Ver todos" (href="/") o clearAll.
        gig: initialFilters.gig,
        // ⚠️ `pagina` NO se pasa a propósito: cambiar cualquier filtro vuelve a la
        // página 1. Si se propagara, alguien parado en la página 8 que escribe
        // "bartender" vería el vacío de "sin resultados" con 12 candidatos ahí
        // nomás, y lo leería como "la búsqueda no anda".
      });
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [initialFilters, pathname, router],
  );

  // Filtros finos aplicados desde el bottom sheet (SRCH-02 incluido).
  const applyFine = (fine: FineFilters) =>
    composeAndPush(textRef.current, selectedRef.current, fine);

  // Texto libre: debounce 280ms (Pitfall 4 — mantené el payload chico).
  useEffect(() => {
    if (text === initialFilters.q) return;
    const id = setTimeout(() => composeAndPush(text, selectedRef.current), 280);
    return () => clearTimeout(id);
  }, [text, initialFilters.q, composeAndPush]);

  const toggleOficio = (oficio: string) => {
    const next = selected.includes(oficio)
      ? selected.filter((o) => o !== oficio)
      : [...selected, oficio];
    setSelected(next);
    composeAndPush(textRef.current, next);
  };

  const clearAll = () => {
    setText("");
    setSelected([]);
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  const retry = () => router.refresh();

  /**
   * Navegación de páginas: es el ÚNICO camino que propaga `pagina`. Usa el mismo
   * startTransition + router.replace que composeAndPush, así el `pending` ya
   * existente muestra el LoadingResults mientras el server vuelve a consultar.
   */
  const irAPagina = (destino: number) => {
    const siguiente = Math.min(Math.max(1, destino), totalPaginas);
    if (siguiente === pagina) return;
    const qs = buildQueryString({ ...initialFilters, pagina: siguiente });
    startTransition(() => {
      // scroll: false como el resto (ajustar un filtro no tiene que patear la
      // pantalla), pero cambiar de página SÍ tiene que subir: quedarse abajo del
      // todo mirando el pie de la página 2 es desorientador. Por eso el scroll va
      // acá, explícito, y no cambiando el scroll:false de los otros llamados.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
    resultadosRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const fineCount = activeFineFilterCount(initialFilters);

  return (
    <section className="flex flex-col gap-8">
      {/* Header monumental (porteo de "Buscar Staff" de Stitch) */}
      <header className="flex flex-col gap-6 border-b border-[#4c4546] pb-10">
        <p className="label-tech text-[12px] text-[#cfc4c5]">Reclutamiento / Talento</p>
        <h1 className="t-display uppercase text-[#e5e2e1]">
          Buscar Staff
        </h1>
        {/* Search bar underline */}
        <div className="relative w-full max-w-[640px] mt-4">
          <input
            type="text"
            inputMode="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ID DE CANDIDATO, ROL O HABILIDAD"
            aria-label="Buscar candidatos"
            className="w-full bg-transparent border-0 border-b border-[#4c4546] text-[#e5e2e1] label-tech text-[12px] py-4 pl-0 pr-12 outline-none focus:border-[#c6c6c6] placeholder:text-[#cfc4c5] transition-colors"
          />
          <Search size={20} aria-hidden="true" className="absolute right-1 top-1/2 -translate-y-1/2 text-[#cfc4c5]" />
        </div>
      </header>

      {/* Fila: Filtros + chips de oficios (1-tap) */}
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={() => setShowFiltros(true)}
          aria-expanded={showFiltros}
          className="shrink-0 inline-flex items-center gap-xs min-h-[44px] rounded-none bg-surface-2 border border-border text-fg label-tech text-[12px] px-md transition-colors hover:border-accent"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtros
          {fineCount > 0 && (
            <span className="ml-xs grid place-items-center min-w-5 h-5 rounded-none bg-accent text-fg text-[12px] font-semibold px-1">
              {fineCount}
            </span>
          )}
        </button>

        <div className="flex-1 min-w-0 flex gap-sm overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {OFICIOS_FRECUENTES.map((oficio) => {
            const active = selected.includes(oficio);
            return (
              <motion.button
                key={oficio}
                type="button"
                onClick={() => toggleOficio(oficio)}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                transition={{ duration: 0.12 }}
                aria-pressed={active}
                className={
                  "shrink-0 min-h-[44px] rounded-none px-md label-tech text-[12px] whitespace-nowrap transition-colors border " +
                  (active
                    ? "border-accent text-accent bg-surface-2"
                    : "border-border bg-surface-2 text-fg-muted hover:border-fg-subtle")
                }
              >
                {oficio}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Resultados */}
      <div ref={resultadosRef} className="scroll-mt-8">
        {error ? (
          <ErrorResults onRetry={retry} />
        ) : pending ? (
          <LoadingResults />
        ) : candidates.length === 0 ? (
          pagina > 1 ? (
            // Página fuera de rango (por ejemplo ?p=999 escrito a mano): no es
            // "sin resultados", es una página que no existe. La salida es volver
            // a la primera, no limpiar los filtros.
            <div className="flex flex-col items-center text-center gap-md py-2xl">
              <h2 className="font-display text-[28px] text-fg">
                Esta página está vacía
              </h2>
              <p className="text-body text-fg-muted max-w-[300px]">
                Te fuiste más allá del último candidato.
              </p>
              <button
                type="button"
                onClick={() => irAPagina(1)}
                className="min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-lg py-sm transition-transform active:scale-[0.98]"
              >
                Volver a la primera página
              </button>
            </div>
          ) : (
            <EmptyResults onClear={clearAll} />
          )
        ) : (
          <div className="flex flex-col gap-4">
            <p className="label-tech text-[12px] text-[#cfc4c5]">
              {total.toLocaleString("es-AR")}{" "}
              {total === 1 ? "candidato" : "candidatos"}
              {totalPaginas > 1 && (
                <> · página {pagina} de {totalPaginas}</>
              )}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {candidates.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : Math.min(i, 8) * 0.025 }}
                >
                  <CandidateCard candidate={c} />
                </motion.li>
              ))}
            </ul>

            {/* Con una sola página no se dibujan los controles. Anterior y
                siguiente, sin tira de números: con 21 páginas no entra en un
                teléfono y no aporta. */}
            {totalPaginas > 1 && (
              <nav
                aria-label="Paginación de resultados"
                className="mt-4 flex items-center justify-between gap-sm border-t border-[#4c4546] pt-6"
              >
                <button
                  type="button"
                  onClick={() => irAPagina(pagina - 1)}
                  disabled={pagina <= 1}
                  className="inline-flex items-center min-h-[44px] px-md label-tech text-[12px] border border-border bg-surface-2 text-fg transition-colors hover:border-accent disabled:opacity-40 disabled:pointer-events-none"
                >
                  Anterior
                </button>
                <span className="label-tech text-[11px] text-[#cfc4c5]">
                  {pagina} / {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => irAPagina(pagina + 1)}
                  disabled={pagina >= totalPaginas}
                  className="inline-flex items-center min-h-[44px] px-md label-tech text-[12px] border border-border bg-surface-2 text-fg transition-colors hover:border-accent disabled:opacity-40 disabled:pointer-events-none"
                >
                  Siguiente
                </button>
              </nav>
            )}
          </div>
        )}
      </div>

      <FiltrosSheet
        open={showFiltros}
        onOpenChange={setShowFiltros}
        initial={{
          provincia: initialFilters.provincia,
          ciudad: initialFilters.ciudad,
          finde: initialFilters.finde,
          viajar: initialFilters.viajar,
          movilidad: initialFilters.movilidad,
          ocultarAsignados: initialFilters.ocultarAsignados,
        }}
        onApply={applyFine}
      />
    </section>
  );
}
