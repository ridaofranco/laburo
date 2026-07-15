---
phase: 02-find-staff
plan: 03
subsystem: ui
tags: [nextjs, search, supabase, base-ui, motion, tailwind, laburo, mobile-first, postgrest]

requires:
  - phase: 02-find-staff (plan 02-01)
    provides: "public.staff_app_profiles + staff_app_crew_busy security_invoker views; oficios GIN / provincia btree / nombre trgm indexes"
  - phase: 02-find-staff (plan 02-02)
    provides: "(app) authed shell + membership gate; LABURO @theme tokens + glow utilities; HITO-verbatim Supabase SSR server client; motion + @base-ui/react + lucide installed"
provides:
  - "Server-side search over public.staff_app_profiles (card columns only): oficios overlap + parameterized ilike text + eq toggles + crew_busy exclusion + range pagination"
  - "lib/oficios.ts — curated 64-oficio catalog (from somosder-web) + pool-observed normalizer labels + verified OFICIOS_FRECUENTES chip list + isKnownOficio whitelist (V5)"
  - "lib/provincias.ts — 24 official AR jurisdictions + isKnownProvincia whitelist (V5)"
  - "lib/avatar-color.ts — deterministic oficioColor(primary) over the 8-color UI-SPEC palette + initials()"
  - "lib/wa.ts — waLink/telLink E.164 builders"
  - "lib/search-params.ts — parse/validate/whitelist search params + buildQueryString + activeFineFilterCount + sanitizeText"
  - "app/(app)/search-client.tsx — chips (multi-select) + debounced text + Motion results, URL-driven"
  - "app/(app)/candidate-card.tsx — D-03 card (initials avatar, oficio tags, ciudad/provincia, experience pill; no photo/glow) linking to /staff/[id]"
  - "app/(app)/results-states.tsx — loading skeletons / empty / error with exact UI-SPEC copy"
  - "app/(app)/filtros-sheet.tsx — Base UI Dialog bottom sheet (D-04): provincia Select + ciudad + finde/viajar/movilidad + SRCH-02 toggle"
affects: [02-04, phase-3-offers]

tech-stack:
  added: []
  patterns:
    - "URL searchParams as the single source of truth: client writes them (router.replace), the server component re-queries — small mobile payload, shareable state"
    - "Free-text ilike sanitized (strip PostgREST .or() grammar chars) + structured params whitelisted against catalogs (V5) — no SQL string concatenation"
    - "Base UI Dialog controlled as a mobile bottom sheet with Motion (AnimatePresence slide-up + backdrop fade), gated on prefers-reduced-motion"

key-files:
  created:
    - "lib/oficios.ts"
    - "lib/provincias.ts"
    - "lib/avatar-color.ts"
    - "lib/wa.ts"
    - "lib/search-params.ts"
    - "app/(app)/search-client.tsx"
    - "app/(app)/candidate-card.tsx"
    - "app/(app)/results-states.tsx"
    - "app/(app)/filtros-sheet.tsx"
  modified:
    - "app/(app)/page.tsx"

key-decisions:
  - "Catalog reconciled with live data: Phase-1 normalizer stored category-level labels (Producción/Catering/Técnica/Orientador/a/Acomodador/a) not in the somosder-web item list; lib/oficios.ts includes them (OFICIOS_EXTRA_POOL) + a verified OFICIOS_FRECUENTES chip list so chips return >0 and the V5 whitelist accepts every chip/select value"
  - "SRCH-02 = minimum-honest (excludes current crew members only; crew_busy=0 today); interval/overnight overlap deferred to Phase 3 when gigs have real starts_at/ends_at"
  - "Free-text OR extended to oficios_otro/ciudad/provincia to honor the placeholder 'oficio, nombre o zona'; structured oficio filtering stays on the chips (D-04 hybrid design)"
  - "State lives in URL searchParams; chips/filters mutate the URL and the server component re-runs the RLS-scoped query (payload stays card-columns-only)"

patterns-established:
  - "Whitelist-or-drop for every structured search param (isKnownOficio / isKnownProvincia); sanitizeText for free text"
  - "Deterministic oficio->color mapping shared by avatar + tags (categorical, not accent)"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03]

duration: ~85 min
completed: 2026-07-15
---

# Phase 2 Plan 03: Search Home (chips + free text + Filtros sheet + candidate cards) Summary

**Phone-first search over the real 687-applicant pool: URL-driven server query on `public.staff_app_profiles` (oficio overlap + parameterized ilike + availability toggles + crew_busy exclusion), 1-tap oficio chips, a Base UI bottom-sheet for provincia/ciudad/availability, and D-03 initials-avatar cards with no photos — proven live at 390px against real candidate counts.**

## Performance

- **Duration:** ~85 min
- **Completed:** 2026-07-15
- **Tasks:** 3 (all committed atomically) + 1 copy-rule fix
- **Files:** 9 created, 1 modified

## Accomplishments

- **SRCH-01 (server-side search):** ONE query over `public.staff_app_profiles` selecting only card columns; `.overlaps('oficios',…)` (GIN), parameterized `.or(ilike…)` free text, `.eq` toggles, `.range(0,49)`. Live proof: `oficios && ARRAY['Control de accesos']` = **246 rows** on the 687-pool; UI "Bartender" chip → **6 candidatos** (= DB).
- **SRCH-02 (availability, minimum-honest):** `staff_app_crew_busy` exclusion behind the "ocultar ya asignados a un gig solapado" toggle; interval overlap deferred to Phase 3 (crew_busy = 0 today).
- **SRCH-03 (mobile-first):** 44px targets, 16px search input (kills iOS zoom), horizontal chip scroll, Base UI bottom sheet with `safe-area-inset-bottom`, small card-only payload, debounced text (280ms), Motion gated on `prefers-reduced-motion`.
- **D-03 cards / D-04 hybrid filters:** initials avatars colored by `oficioColor(oficios[0])`, oficio tags (categorical palette ~14% fill), ciudad/provincia + MapPin, experience pill omitted when false/null; chips + Filtros sheet.
- **Security (V5):** every structured param whitelisted against the catalogs; free text sanitized of PostgREST `.or()` grammar chars; no SQL string concatenation.

## Task Commits

1. **Task 1: catalogs + helpers + server search** - `617179b` (feat)
2. **Task 2: search client + candidate card + screen states** - `6a72bb1` (feat)
3. **Task 3: Filtros bottom sheet (D-04) + SRCH-02 wiring** - `1d749f7` (feat)
4. **Copy-rule fix (em dash in avatar hash key)** - `dc51529` (fix)

**Plan metadata:** this SUMMARY commit (docs).

## Files Created/Modified

- `lib/oficios.ts` - oficio catalog + pool labels + frequent chips + whitelist
- `lib/provincias.ts` - 24 AR jurisdictions + whitelist
- `lib/avatar-color.ts` - deterministic oficio color + initials
- `lib/wa.ts` - wa.me / tel: E.164 builders
- `lib/search-params.ts` - parse/validate/whitelist + serialize + counts + sanitizeText
- `app/(app)/page.tsx` - server component: the single RLS-scoped card query
- `app/(app)/search-client.tsx` - chips + debounced text + Motion results, URL-driven
- `app/(app)/candidate-card.tsx` - D-03 card
- `app/(app)/results-states.tsx` - loading/empty/error states (exact copy)
- `app/(app)/filtros-sheet.tsx` - Base UI Dialog bottom sheet (D-04)

## Verification Evidence

**Build/type:** `npm run build` exits 0 (route `/` dynamic); `npx tsc --noEmit` clean.

**Greps (acceptance):** `page.tsx` has `.overlaps(` + `staff_app_profiles` + `.range(` + `staff_app_crew_busy`; `search-params.ts` uses `isKnownOficio`; `candidate-card.tsx` uses `oficioColor`; `search-client.tsx` imports `motion/react` + exact placeholder "Buscá por oficio, nombre o zona…"; `results-states.tsx` has "Sin resultados" + "Reintentar"; `filtros-sheet.tsx` has `Dialog` + `Aplicar` + `Limpiar filtros` + "ocultar ya asignados" + `lib/provincias` import + `safe-area-inset-bottom`. Weight discipline: only `font-semibold` (600) in the working UI; the sole `700` is `app/layout.tsx` Baloo 2 lockup font.

**Live MCP proof (project luillpzfqzbpoqkgvjuw):** total 687; `['Control de accesos']` overlap = 246; Córdoba = 18; Bartender oficio = 6; crew_busy = 0; all 24 stored `provincia` values ∈ the 24 official jurisdictions; top-20 stored oficios all resolve in the whitelist.

**Live UI smoke (Playwright, mobile 390x844, authed via a minted `verifyOtp` session):**
- Search home renders LABURO glow header + input + Filtros + oficio chip row + "50 candidatos" + D-03 cards (colored avatars, tags, experience pills, MapPin). Screenshot `02-03-search-home.png`.
- Tap "Bartender" chip → active accent+box-glow chip, **"6 candidatos"** (= DB); all cards carry the Bartender tag. Screenshot `02-03-search-oficio.png`.
- Open Filtros → bottom sheet slides up over dimmed backdrop (provincia Select, ciudad, 4 toggles, sticky Aplicar/Limpiar). Screenshot `02-03-filtros-sheet.png`.
- Select Córdoba → Aplicar → **"18 candidatos"** (= DB), Filtros badge "1". Zero console errors throughout.

## Decisions Made

See frontmatter `key-decisions`. The load-bearing one: the live pool contains normalizer-emitted category labels absent from the somosder-web item catalog, so the catalog was extended (documented `OFICIOS_EXTRA_POOL`) and the frequent-chip list was derived from real counts — otherwise the highest-volume chips (Producción/Catering/Técnica) would have been rejected by the V5 whitelist and returned nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Oficio catalog did not match the live pool**
- **Found during:** Task 1 (spot-check vs `SELECT DISTINCT unnest(oficios)`).
- **Issue:** Assumption A5 held the somosder-web catalog fully covers stored oficios, but the Phase-1 normalizer stored category-level labels ("Producción" 192, "Catering" 149, "Técnica" 61, "Orientador/a", "Acomodador/a", …) not in the item list. Chips built from only the item catalog would emit strings the V5 whitelist rejects → zero results on the busiest facets.
- **Fix:** Added `OFICIOS_EXTRA_POOL` (pool-observed labels) + a verified `OFICIOS_FRECUENTES` chip list (exact stored strings, frequencies checked live); whitelist = items ∪ extra ∪ frecuentes.
- **Verification:** top-20 stored oficios all resolve in `isKnownOficio`; live UI chip "Bartender" → 6, chips render for Producción/Catering/Técnica.
- **Committed in:** `617179b`.

**2. [Rule 2 - Missing Critical] Free-text OR widened + sanitized for "zona" and injection safety**
- **Found during:** Task 1 (query authoring vs the "oficio, nombre o zona" placeholder + T-02-11).
- **Issue:** The plan's `.or` listed only nombre/apellido/experiencia_detalle; it did not cover "zona", and building `.or()` strings risks grammar injection.
- **Fix:** Extended the OR to `oficios_otro/ciudad/provincia` (all text ilike) and added `sanitizeText` (strips `,()\%*`, caps length) so free text can never break the PostgREST `.or()` grammar; structured oficio filtering stays on the chips (D-04).
- **Verification:** parameterized ilike only; no string concatenation into filters; build + live search pass.
- **Committed in:** `617179b`.

**3. [Rule 3 - Blocking, env] Stale `.next` vendor chunk after introducing Base UI submodules mid-session**
- **Found during:** Task 3 live smoke (dev server 500: `Cannot find module './vendor-chunks/@base-ui.js'`).
- **Issue:** The running dev server's incremental compile referenced a vendor chunk not regenerated when `@base-ui/react/{dialog,select,switch}` were first imported. Production `npm run build` was clean — code was fine.
- **Fix:** Restarted the dev server with a fresh `.next`. No code change.
- **Verification:** fresh dev server serves the sheet; live smoke passes.
- **Committed in:** n/a (environment, no code change).

---

**Total deviations:** 3 (2 auto-fixed code, 1 environment). **Impact:** the catalog + free-text fixes were required for the plan's own acceptance (chips return >0, "zona" honored, V5 whitelist). No scope creep.

## Issues Encountered

- Authenticated UI smoke required a real session (the callback is PKCE-only). Resolved by minting a session server-side via admin `generateLink` → `verifyOtp` and letting `@supabase/ssr` itself encode the exact auth cookies, then injecting them into Playwright — a real logged-in admin session, not a bypass.
- `next/font` Google Fonts fetch timed out once during a final build (ETIMEDOUT); a retry compiled clean (fonts are self-hosted/cached at build).

## User Setup Required

None - no new external service configuration. (Carried from 02-02: the `http://localhost:3000/auth/callback` redirect-allowlist entry remains unconfirmed in `02-USER-SETUP.md`; it does not affect this plan since the smoke used a minted session.)

## Next Phase Readiness

- **02-04 (profile + CV)** consumes the same `public.staff_app_profiles` view and the cards already link to `/staff/[id]` (currently 404 — that route lands in 02-04). `lib/wa.ts` (wa.me/tel) is ready for the profile quick actions; `lib/avatar-color.ts` + `initials()` reused for the profile header avatar.
- **SRCH-02 note carried forward:** availability is the minimum-honest crew-membership exclusion; true interval/overnight overlap is a Phase-3 task when gigs exist.
- **No blockers.**

## Self-Check: PASSED

- All 9 created files + `page.tsx` exist on disk; `git log --grep="02-03"` returns 4 commits (`617179b`, `6a72bb1`, `1d749f7`, `dc51529`).
- All three tasks' `<acceptance_criteria>` re-verified: build 0, greps, live MCP counts (246/18/6), live Playwright narrowing (50→6 chip, 50→18 provincia) with zero console errors, exact UI-SPEC copy + weight discipline.

---
*Phase: 02-find-staff*
*Completed: 2026-07-15*
