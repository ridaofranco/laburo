---
phase: 05-status-board-extras-real-hire
plan: 03
subsystem: board + search
tags: [STAT-02, XTRA-02, tablero, re-filtro]
requires: ["05-01"]
provides: ["ruta /tablero", "nav Buscar/Tablero", "PARAM.gig", "re-filtro por gig"]
affects: ["app/(app)/page.tsx", "app/(app)/layout.tsx", "app/(app)/search-client.tsx", "lib/search-params.ts"]
key-files:
  created:
    - app/(app)/tablero/page.tsx
    - app/(app)/tablero/gig-board.tsx
  modified:
    - app/(app)/layout.tsx
    - app/(app)/page.tsx
    - app/(app)/search-client.tsx
    - lib/search-params.ts
decisions:
  - "Cobertura DERIVADA por gig (no slots): offerLabel() -> cubierto/pendiente/abierto"
  - "'Vencida' = now()>expires_at reusando offerLabel del perfil (fuente unica), sin duplicar logica"
  - "?gig= validado como UUID (T-5-12); exclusion via ids devueltos por la vista RLS, no input crudo"
  - "gig sticky en search-client para que el modo re-oferta no se pierda al filtrar"
metrics:
  duration: ~35m
  completed: 2026-07-16
  tasks: 2
  files: 6
---

# Phase 5 Plan 05-03: Tablero de cobertura por gig + re-filtro XTRA-02 Summary

Board `/tablero` que muestra todos los gigs del org con su cobertura DERIVADA por rol (cubierto/pendiente/abierto via `offerLabel()`), más el re-filtro "buscar reemplazo" que oculta en la home a los candidatos ya ofertados para un gig.

## What shipped

### Task 1 — Ruta /tablero + nav (STAT-02) · commit `8acc954`
- **`app/(app)/tablero/page.tsx`** (RSC): con el cliente autenticado (RLS `is_org_member`) hace dos lecturas en paralelo — `staff_app_gigs` (todos los eventos, incluidos los sin ofertas) y `staff_app_offers` (con `staff_nombre`/`staff_apellido` de 05-01). Left-join en memoria (Map por `gig_id`); gigs ordenados por `starts_at` desc; pasa `{gig, offers}[]` ya agrupado a `<GigBoard>`.
- **`app/(app)/tablero/gig-board.tsx`** (client): card/acordeón por gig con resumen "{X} cubiertos · {Y} pendientes · {Z} abiertos" DERIVADO reusando `offerLabel()` (import de `@/app/(app)/staff/[id]/offer-status`, fuente única). Cada fila: nombre del candidato + rol + badge por etiqueta. Roles abiertos (Rechazada/Vencida) muestran CTA "Buscar reemplazo" → `<Link href={/?gig=<id>}>`. Gigs sin ofertas: "Sin ofertas todavía" + CTA Buscar staff. Acordeón con `motion` (abierto por defecto si hay roles abiertos, respeta `useReducedMotion`).
- **`app/(app)/layout.tsx`**: nav pill "Buscar" (/) y "Tablero" (/tablero) en el header, targets ≥44px, sin romper el lockup LABURO ni el `max-w-[520px]`.

### Task 2 — Re-filtro por gig (XTRA-02) · commit `f4d8927`
- **`lib/search-params.ts`**: `PARAM.gig` + `SearchFilters.gig`; `parseSearchParams` valida contra `UUID_RE` (input no confiable → `null` si no matchea, T-5-12); `buildQueryString` serializa `gig`; NO cuenta en `activeFineFilterCount` (es un modo, no un filtro fino visible).
- **`app/(app)/page.tsx`**: con `?gig=<uuid>` lee `staff_app_offers.staff_profile_id` con `.eq("gig_id", filters.gig)`, dedup, y excluye con `query.not("id","in",(...))` — mismo molde EXACTO que el bloque `crew_busy`. Aditivo (convive con oficios/q/toggles/crew_busy) y degrada en silencio si la lectura falla. Banner "Buscando reemplazo · ocultando a los que ya ofertaste" + link "Ver todos" (/).
- **`app/(app)/search-client.tsx`**: `gig` sticky en `composeAndPush` para que el modo re-oferta no se pierda al tocar chips/texto.

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing critical functionality] gig sticky en search-client.tsx**
- **Found during:** Task 2
- **Issue:** `composeAndPush` reconstruye la query string desde campos explícitos; sin incluir `gig`, el primer toque de chip/texto en modo "buscar reemplazo" borraba `?gig=` y los ya-ofertados reaparecían — rompiendo justo el flujo de buscar un reemplazo por oficio.
- **Fix:** agregar `gig: initialFilters.gig` al `buildQueryString` de `composeAndPush`. Se limpia solo con "Ver todos" (href="/") o `clearAll` (que ya empujan sólo el pathname).
- **Files modified:** `app/(app)/search-client.tsx` (no estaba en `files_modified` del plan; 1 línea funcional necesaria para que el re-filtro se sostenga)
- **Commit:** `f4d8927`

**2. [Rule 1 - Lint] `<a>` → `<Link>` en el banner de page.tsx**
- Lint `@next/next/no-html-link-for-pages` marcó el `<a href="/">`. Cambiado a `<Link>` de next/link.
- **Commit:** `f4d8927`

## Verification

- Greps del plan (Task 1 y Task 2): OK.
- Criterios de cierre por grep: cobertura derivada (`coberturaDe(offerLabel(o))`), vencida derivada (import de `offerLabel`), exclusión re-filtro (`eq("gig_id")` + `not("id","in")`), CTA `/?gig=${gig.id}`, validación UUID (`UUID_RE`). Todos presentes.
- `npm run typecheck`: limpio.
- `npm run lint`: limpio para los archivos tocados (queda 1 warning PREEXISTENTE fuera de scope en `app/(app)/staff/[id]/cv-actions.ts` — unused eslint-disable, no tocado).
- `npm run build`: pasa (rutas compilan; `ƒ /tablero` dinámica). Nota: hubo fallos flaky de build por `next/font/google` (Inter) que descarga de Google Fonts en build-time bajo red intermitente del entorno; reintento con la fuente cacheada → build limpio. No relacionado con el código de este plan (aislado: build en HEAD sin los cambios de Task 2 fallaba igual por la fuente, y con los cambios pasa una vez cacheada).

## Known Stubs

Ninguno. El board lee datos reales de ambas vistas; sin valores hardcodeados ni placeholders de datos.

## Threat Flags

Ninguno nuevo. El board lee sólo `staff_app_offers`/`staff_app_gigs` (security_invoker, RLS org-scoped); el `?gig=` se valida como UUID y la exclusión usa ids devueltos por la vista, no el input crudo (T-5-12/T-5-13 mitigados como en el register).

## Self-Check: PASSED
- FOUND: app/(app)/tablero/page.tsx
- FOUND: app/(app)/tablero/gig-board.tsx
- FOUND commit 8acc954
- FOUND commit f4d8927
