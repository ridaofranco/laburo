# Deferred items — Phase 04 (Accept & Close the Loop)

Out-of-scope discoveries logged during execution. NOT fixed by the discovering plan.

## From 04-03 (STAT-01, Wave 2)

- **`next build` no cierra limpio mientras 04-02 corre en paralelo.** Dos síntomas observados en runs consecutivos:
  1. `./app/o/[token]/page.tsx Module not found: Can't resolve './accept-decline'` — el componente cliente de 04-02 (ruta pública `/o/[token]`) todavía no existía en el momento del primer build. `app/o/` está untracked (WIP de 04-02).
  2. `TypeError: a[d] is not a function` en el prerender de `/login` (`.next/server/webpack-runtime.js`) — aparece/desaparece entre runs; síntoma típico de dos `next build` concurrentes (Wave 2 en paralelo) pisándose el directorio `.next` compartido.
  - **Fuera de scope de 04-03:** 04-03 sólo toca `app/(app)/staff/[id]/*`. Los archivos de 04-03 compilan (`✓ Compiled successfully`), pasan `tsc --noEmit` con 0 errores y `eslint` con 0 problemas. El build global cierra limpio una vez que 04-02 aterriza su `accept-decline.tsx` y no hay builds concurrentes corrompiendo `.next`. Verificación estática de 04-03 = greps + typecheck + lint (todos OK).

- **Warning pre-existente (no de 04-03):** `app/(app)/staff/[id]/cv-actions.ts:52` — `Unused eslint-disable directive (no-control-regex)`. Es de Fase 2, no lo introdujo 04-03. Sólo warning, no rompe el build.
