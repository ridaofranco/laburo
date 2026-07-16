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
}

/**
 * Región focal de la búsqueda (UI-SPEC visual anchor): input + fila de chips
 * de oficios arriba, resultados abajo. Los cambios actualizan la URL y el
 * server component re-consulta (payload chico, filtrado en Postgres).
 */
export function SearchClient({ candidates, error, initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();

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

  const fineCount = activeFineFilterCount(initialFilters);

  return (
    <section className="flex flex-col gap-md">
      {/* Input de búsqueda (focal) */}
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-md top-1/2 -translate-y-1/2 text-fg-muted"
        />
        <input
          type="text"
          inputMode="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscá por oficio, nombre o zona…"
          aria-label="Buscar candidatos"
          className="w-full h-11 rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted pl-[42px] pr-md outline-none focus:ring-[3px] focus:ring-accent/45"
        />
      </div>

      {/* Fila: Filtros + chips de oficios (1-tap) */}
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={() => setShowFiltros(true)}
          aria-expanded={showFiltros}
          className="shrink-0 inline-flex items-center gap-xs min-h-[44px] rounded-full bg-surface-2 border border-border text-fg text-label font-semibold px-md"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtros
          {fineCount > 0 && (
            <span className="ml-xs grid place-items-center min-w-5 h-5 rounded-full bg-accent text-fg text-[12px] font-semibold px-1">
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
                  "shrink-0 min-h-[44px] rounded-full px-md text-label font-semibold whitespace-nowrap transition-colors " +
                  (active
                    ? "bg-accent text-fg box-glow"
                    : "bg-surface-2 text-fg")
                }
              >
                {oficio}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Resultados */}
      {error ? (
        <ErrorResults onRetry={retry} />
      ) : pending ? (
        <LoadingResults />
      ) : candidates.length === 0 ? (
        <EmptyResults onClear={clearAll} />
      ) : (
        <div className="flex flex-col gap-sm">
          <p className="text-label font-normal text-fg-subtle">
            {candidates.length}{" "}
            {candidates.length === 1 ? "candidato" : "candidatos"}
          </p>
          <ul className="flex flex-col gap-md">
            {candidates.map((c, i) => (
              <motion.li
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: reduce ? 0 : Math.min(i, 8) * 0.025,
                }}
              >
                <CandidateCard candidate={c} />
              </motion.li>
            ))}
          </ul>
        </div>
      )}

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
