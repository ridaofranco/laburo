/**
 * Estados de pantalla de resultados (UI-SPEC § Screen States + Copywriting).
 * Copy exacta del contrato. Sin em dash en copy visible (regla dura de Franco).
 */

/** Loading: 3-5 skeleton cards con shimmer (estáticas bajo reduced-motion). */
export function LoadingResults() {
  return (
    <ul className="flex flex-col gap-md" aria-busy="true" aria-label="Buscando…">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="rounded-2xl bg-surface-1 border border-border p-md animate-pulse motion-reduce:animate-none"
        >
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full bg-surface-2" />
            <div className="h-4 w-1/2 rounded bg-surface-2" />
          </div>
          <div className="flex gap-xs mt-sm">
            <div className="h-5 w-20 rounded-full bg-surface-2" />
            <div className="h-5 w-16 rounded-full bg-surface-2" />
          </div>
          <div className="h-3 w-1/3 rounded bg-surface-2 mt-sm" />
        </li>
      ))}
    </ul>
  );
}

/** Empty: crown LABURO (chico) + "Sin resultados" (glow) + copy + "Limpiar filtros". */
export function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-md py-2xl">
      <span className="font-lockup text-glow text-[20px] select-none opacity-80">
        LABURO
      </span>
      <h2 className="text-heading font-semibold text-glow">Sin resultados</h2>
      <p className="text-body text-fg-muted max-w-[300px]">
        Probá con otro oficio o sacá algún filtro.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-lg py-sm transition-transform active:scale-[0.98]"
      >
        Limpiar filtros
      </button>
    </div>
  );
}

/** Error: card neutral, mensaje honesto + "Reintentar". */
export function ErrorResults({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-md py-2xl">
      <h2 className="text-heading font-semibold text-fg">
        No pudimos cargar los candidatos.
      </h2>
      <p className="text-body text-fg-muted max-w-[300px]">
        Revisá la conexión y probá de nuevo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-lg py-sm transition-transform active:scale-[0.98]"
      >
        Reintentar
      </button>
    </div>
  );
}
