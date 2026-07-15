---
phase: 02-find-staff
plan: 02
subsystem: ui
tags: [nextjs, supabase-ssr, auth, oauth, magic-link, tailwind-v4, laburo-brand, membership-gate]

requires:
  - phase: 02-find-staff (plan 02-01)
    provides: "public.staff_app_my_membership (auth.uid()-filtered, .maybeSingle()-safe), public.staff_app_provision_member() RPC, 2 admins pre-seeded as owners"
provides:
  - "Next.js 15.5.20 app at repo root (App Router, TS, Tailwind v4) with pinned HITO-parity deps (lucide-react ^0.546, @supabase/ssr ^0.12, @base-ui/react ^1.6, motion ^12.42)"
  - "lib/supabase/{server,client,admin}.ts byte-identical to HITO; lib/supabase/middleware.ts i18n-stripped (public paths exactly ['/login','/auth/callback'])"
  - "LABURO brand token layer: Tailwind v4 @theme (all D-01/UI-SPEC hex values) + text-glow/box-glow/font-lockup utilities; Inter 400/600 + Baloo 2 700 (lockup only) via next/font"
  - "/login: Google OAuth + email magic link (D-05), exact UI-SPEC copy, wordmark hero 40px with glow"
  - "/auth/callback: exchangeCodeForSession + rpc('staff_app_provision_member') with the regular authed client (D-06 allowlist inside the RPC)"
  - "(app) route group: server-side membership gate via staff_app_my_membership; 0 rows renders AccesoDenegado (never the pool); dashboard shell + placeholder home"
affects: [02-03, 02-04, phase-3-offers]

tech-stack:
  added: [next@15.5.20, react@19.1, "@supabase/ssr@0.12", "@supabase/supabase-js@2.110", tailwindcss@4, "@base-ui/react@1.6", lucide-react@0.546, motion@12.42, next-themes@0.4.6, sonner@2.0.7]
  patterns:
    - "HITO-verbatim Supabase SSR clients; only middleware adapted (i18n stripped)"
    - "Auth gate = server layout reading an auth.uid()-filtered public view; DB RLS is the authority, UI screen is defense-in-depth"
    - "Callback provisioning ONLY via supabase.rpc('staff_app_provision_member'); never a PostgREST call into the staff_app schema (PGRST106)"
    - "Tailwind v4 @theme token layer as the single brand source; glow via @utility recipes applied to brand moments only"

key-files:
  created:
    - "package.json / next.config.ts / tsconfig.json / postcss.config.mjs (scaffold)"
    - "middleware.ts"
    - "lib/supabase/server.ts, client.ts, admin.ts, middleware.ts"
    - "lib/utils.ts"
    - "app/layout.tsx, app/globals.css"
    - "app/login/page.tsx, app/login/login-form.tsx"
    - "app/auth/callback/route.ts"
    - "app/(app)/layout.tsx, app/(app)/acceso-denegado.tsx, app/(app)/page.tsx"
  modified:
    - ".gitignore (env/next/node_modules)"

key-decisions:
  - "Callback uses window.location.origin for redirectTo (HITO's exact logic) instead of a SITE_URL env read: client components can't read non-public env; identical value in dev and self-correct per deployment"
  - "next.config.ts sets outputFileTracingRoot because a stray package-lock.json exists in the parent 'SOMOS DER' directory (silences Next workspace-root misdetection)"
  - "Root app/page.tsx removed: app/(app)/page.tsx owns '/' behind the gate"

patterns-established:
  - "Gate pattern: getUser() -> redirect('/login'); staff_app_my_membership .maybeSingle() -> AccesoDenegado on null"
  - "Brand copy rule enforced: no em dash in any user-facing string (checked by grep over app/**/*.tsx)"

requirements-completed: [SRCH-03]

duration: ~45min (execution after checkpoint)
completed: 2026-07-15
---

# Phase 2 Plan 02: LABURO scaffold + login + membership gate Summary

**Next 15.5 app live at the repo root with HITO-verbatim Supabase SSR mechanics restyled to the LABURO neon-blue brand: Google/magic-link login, allowlist provisioning via the 02-01 SECURITY DEFINER RPC, and the D-06 membership gate proven at the DB layer (non-member = 0 rows).**

## Performance

- **Duration:** ~45 min execution (plus human checkpoint wait)
- **Completed:** 2026-07-15T14:26Z
- **Tasks:** 1 checkpoint (human-action) + 2 auto tasks, committed atomically
- **Files:** 17 created/modified in Task 1, 7 in Task 2

## Checkpoint (human-action) resolution

- `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local` by Franco (verified present, `sb_secret_…` format; file git-ignored via `.env*`).
- **A1 confirmed:** Google + Email OTP providers enabled (Franco: "el resto está todo prendido").
- **A6 / redirect allowlist:** Franco's confirmation was ambiguous on the specific `http://localhost:3000/auth/callback` entry. Local verification could not surface a redirect error (full OAuth round-trip needs a real Google login). ⚠️ Recorded as the one open item in `02-USER-SETUP.md`: if the first real login bounces to the wrong URL, add that entry in Auth → URL Configuration (additive only).
- Executor pre-automation: URL + anon key fetched via Supabase MCP into `.env.local`; both admin accounts re-confirmed in `auth.users` (and both already seeded as members from 02-01, so the gate is live regardless of the callback fallback).

## Accomplishments

1. **Scaffold (Task 1):** create-next-app@15 → next 15.5.20 (NOT 16), all RESEARCH pins honored including `lucide-react ^0.546` (not the 1.x fork). `lib/supabase/{server,client,admin}.ts` byte-identical to HITO (diff-verified); middleware stripped to es-AR-only with public paths exactly `['/login','/auth/callback']`. LABURO `@theme` token layer with every UI-SPEC hex + glow recipes; Inter 400/600 + Baloo 2 700 (lockup only); `lang="es-AR"`, dark-locked, `viewport-fit=cover`.
2. **Auth slice (Task 2):** login with the exact copy contract ("Entrar con Google" / "Tu email" / "Mandame un link", no GitHub); callback does `exchangeCodeForSession` then `supabase.rpc('staff_app_provision_member')` with the regular authed server client; `(app)` layout gates on `staff_app_my_membership` and renders `AccesoDenegado` ("Esta cuenta no tiene acceso." + "Cerrar sesión") on 0 rows; placeholder dashboard home behind the gate.

## Task Commits

1. **Task 1: scaffold + clients + token layer** - `15be020` (feat)
2. **Task 2: login + callback + gate + acceso-denegado** - `17ef648` (feat)

**Plan metadata:** this SUMMARY commit (docs).

## Verification Evidence

**Builds/gates (all PASS):**
- `npm run build` exits 0 (routes: `/` dynamic, `/login`, `/auth/callback`); `npx tsc --noEmit` clean.
- `package.json`: `"next": "^15.5.20"`, `"lucide-react": "^0.546.0"`.
- `app/globals.css` contains `2F80FF`, `4CC9FF` and all 9 UI-SPEC hex tokens.
- Callback: contains `exchangeCodeForSession` and `rpc("staff_app_provision_member"`; `.schema('staff_app')` ABSENT anywhere in app/ + lib/.
- Gate: contains `staff_app_my_membership` + `redirect("/login")`; no `onboarding`/`orgSlug` anywhere in the file.
- `admin.ts` reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix); nothing imports it yet (first consumer is 02-04's CV signing action); no `"use client"` file references it.
- Em dash check: no `—` in any rendered TSX copy (only in code comments; `admin.ts` comment kept for HITO byte-equivalence).

**Gate proof (D-06, impersonated-JWT SQL via MCP — independent of UI):**
- Non-member (`curioso@gmail.com`, random uid): `staff_app_my_membership` = **0 rows**, `staff_app_profiles` = **0 rows** → layout renders AccesoDenegado; even a UI bypass reads nothing.
- Seeded admin (`ridaofrancorg@gmail.com`): membership = **1 row, role owner**, `staff_app_profiles` = **687 rows** → dashboard.

**Live smoke (dev server + Playwright, mobile 390x844):**
- `GET /` unauthenticated → **307 → /login** (curl + Playwright both confirm).
- `/login` renders wordmark + "Entrar con Google" + "Tu email" + "Mandame un link"; zero console errors/warnings.
- Screenshot: `.planning/phases/02-find-staff/02-02-login-screen.png` (LABURO lockup with blue glow, accent CTA with box-glow, neutral form).

## Deviations from Plan

**1. [Rule 1 - Bug] Removed scaffold `app/page.tsx`** — Found during Task 1. The boilerplate root page would collide with Task 2's `app/(app)/page.tsx` (two pages resolving `/`). Deleted in Task 1; `/` is owned by the gated group. Commit `15be020`.

**2. [Rule 2 - Missing Critical] `next.config.ts` → `outputFileTracingRoot`** — Found during Task 2 smoke (Next dev "1 Issue" overlay). A parent-directory `package-lock.json` (`Proyectos/SOMOS DER/`) made Next misinfer the workspace root. Pinned the root to the repo. Verified: warning gone, zero console issues. Commit `17ef648`.

**3. [Minor] `redirectTo` uses `window.location.origin` instead of a `SITE_URL` read** — the plan's action text said `SITE_URL + '/auth/callback'`, but the same plan mandates "copy HITO logic", which computes the origin client-side (a client component cannot read non-`NEXT_PUBLIC_` env anyway). Equivalent value in dev; env var kept in `.env.local` for future server-side use.

**Total deviations:** 3 (2 auto-fixed, 1 documented equivalence). **Impact:** none on scope; all required for the plan's own acceptance criteria.

## Copy note (Franco's hard rule)

No em dash appears in any user-facing copy. The UI-SPEC copy strings used this phase contained none, so no replacements were needed; code comments were also kept em-dash-free where new (HITO-verbatim `admin.ts` keeps its original comment to preserve byte-equivalence).

## Issues Encountered

- Redirect-URL allowlist entry (`http://localhost:3000/auth/callback`) could not be verified programmatically and Franco's confirmation was ambiguous — tracked in `02-USER-SETUP.md`. Symptom if missing: OAuth/magic-link lands on the wrong origin after login. One-line dashboard fix.
- Vercel project NOT created this plan: no plan task requires it (deploy + domain arrive with a later plan; the allowlist entry for the Vercel domain is queued in USER-SETUP).

## Next Phase Readiness

- **02-03 (search UI)** renders inside the authed `(app)` shell; brand tokens, glow utilities, 44px targets and 16px inputs are in place; query `public.staff_app_profiles` via the copied server client.
- **Human verify pending:** Franco logs in on his phone (Google or magic link) → dashboard shell; a throwaway login → "Esta cuenta no tiene acceso."

## Self-Check: PASSED

- All key files exist on disk; `git log --grep="02-02"` returns 2 feat commits (`15be020`, `17ef648`).
- All acceptance criteria re-run post-implementation (build, typecheck, greps, DB gate proof, live smoke) — evidence above.

---
*Phase: 02-find-staff*
*Completed: 2026-07-15*
