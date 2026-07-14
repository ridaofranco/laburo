# Phase 2: Find Staff (LABURO) - Research

**Researched:** 2026-07-14
**Domain:** Next.js 15 mobile-first authed dashboard reading a private multi-tenant Postgres schema (`staff_app`) inside a SHARED live Supabase project, over Supabase Auth + RLS
**Confidence:** HIGH (schema DDL + Phase 1 verification read directly from migrations/summaries; HITO patterns read from actual files; external facts verified via npm + Supabase/PostgREST/Drive docs). MEDIUM only where live-project state must be confirmed by the executor (auth provider state, `pgrst.db_schemas` value, whether the 2 admin emails already exist in `auth.users`, `staff-cvs` storage policies) — flagged explicitly as executor pre-checks.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Brand:** Own brand, explicitly NOT SOMOS DER's look, NOT HITO's look. Dark base + blue (`#2F80FF`) as trust color + neon glow as accent (logo/headers/active states/CTAs only) + bubble/rounded type ONLY at brand moments. Working UI (lists, forms, profiles) stays clean and legible. (Full token contract in `02-UI-SPEC.md` — treat as locked.)
- **D-02 — Name: LABURO.** Confirmed. No "by DER" suffix in visible brand unless Franco asks.
- **D-03 — Results as per-candidate cards, NO photo** (pool has none) → initials avatar with deterministic color derived from primary oficio. Card: name, oficios tags, provincia/ciudad, experience signal. Mobile adaptive.
- **D-04 — Hybrid filters:** free-text search + tappable oficio chips pinned above results (1-tap frequent) + a full "Filtros" panel (bottom sheet) for provincia/ciudad/availability finde/viajar/movilidad. Provincia uses the 24 official AR jurisdictions (normalized in Phase 1).
- **D-05 — Supabase Auth: Google OAuth + email magic-link (OTP)** this phase. GitHub only if trivial. Facebook + other providers DEFERRED.
- **D-06 — Admin allowlist: `ridaofrancorg@gmail.com` AND `franco@somosder.ar`.** Access gated by MEMBERSHIP (`staff_app.members` ↔ `auth.users`): only authorized emails see data; any other login lands with no org and no access (the pool is PII of 687 people — a curious Google login must NOT see it).

### Claude's Discretion
- **CV render:** best render knowing 679 CVs are Google-Drive links (`drive.google.com/open?id=…`) and 8 are private-bucket objects (`staff-cvs` → short-TTL signed URL). Default: embedded viewer when viable + universal "Abrir CV" new-tab fallback. Never crash on a dead Drive link.
- **Profile quick actions:** WhatsApp (`wa.me`) + call (`tel:`) buttons with the candidate's phone. (Formal offer is Phase 3.)
- **Micro-interactions:** Motion (`motion/react`), sparingly on mobile.

### Deferred Ideas (OUT OF SCOPE)
- Facebook OAuth + other social providers → v2 (Meta app + review).
- Candidate photos → v2 (MRKT-02).
- Staff-chosen location + map autocomplete → v2 (Georef/OSM, not Google Maps).
- Anything past search + profile + CV: offers (Phase 3), accept loop (Phase 4), status board / ship (Phase 5), HITO bridge (Phase 6).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Search candidates by oficio (multi-select over 64 oficios) + free text over the own `staff_profiles` pool | Q3 — server-side PostgREST query over a `public` security-invoker view: `.overlaps('oficios', […])` (GIN-indexed) + `.or(ilike…)`; §Architecture Pattern 3 |
| SRCH-02 | Filter by basic availability: "not assigned to an overlapping app gig" + manual availability note | Q3 — exclude staff_profile_ids from overlapping `crew`/`gigs` (near-zero gigs in Phase 2; matures Phase 3) + show `disponibilidad_aviso` on profile; §Architecture Pattern 3 + Open Question 1 |
| SRCH-03 | Search works well on the phone (mobile-first) | UI-SPEC (44px targets, bottom-sheet filters, 16px inputs to kill iOS zoom) + server-side filtering keeps mobile payload small; §Common Pitfalls 4 |
| PERF-01 | View full candidate profile: data, oficios, experience, links, estado | Q1 view exposes all display columns; §Data→UI Mapping (UI-SPEC) drives the profile screen |
| PERF-02 | View/download CV from the private bucket via short-TTL signed URL | Q4 — server-action signed URL (service-role, server-only) for bucket objects; Drive links → new-tab; §Architecture Pattern 4 |
</phase_requirements>

## Summary

Phase 2 is LABURO's first UI: a phone-first Next.js 15 App Router app where Franco logs in (Google OAuth / magic-link), lands on an org-scoped dashboard, searches/filters the real 687-applicant pool in `staff_app.staff_profiles`, and opens a candidate profile + CV. Everything is a copy of HITO's proven mechanics (Supabase SSR clients, auth+org+member gate, middleware) restyled to the locked LABURO brand — NOT HITO's aesthetics.

The single load-bearing technical question is **how the Next.js server reads the `staff_app` schema, which PostgREST does not expose** (Phase 1 verified `PGRST106 Invalid schema: staff_app`). The strongest answer is neither of the two options the phase brief anticipated ("expose the schema" vs "SECURITY DEFINER RPCs"). It is a third, cleaner path: **create a small set of `public` views with `WITH (security_invoker = true)` over `staff_app.*`.** `public` is already PostgREST-exposed, so this needs **zero project-config change on the shared HITO project**; `security_invoker` makes PostgREST evaluate the querying user's JWT role against the underlying `staff_app.staff_profiles` RLS, so **membership is enforced automatically** and non-members (any curious Google login) see **zero rows**; and because it is a real relation, supabase-js keeps full PostgREST filter flexibility (`.overlaps`, `.ilike`, `.eq`, `.range`) that a fat SECURITY DEFINER search function would throw away. It reads only `staff_app` (its own schema), writes nothing, and touches zero HITO `public.*` tables — consistent with the D-03-sanctioned "Staff App objects may live in `public`" exception already used for the intake RPC.

Search over 687 rows is best done **server-side** (not load-all-and-filter): the SRCH-02 availability filter needs a `crew`/`gigs` join that only the server can express, and server-side filtering keeps the mobile payload small (PERF/SRCH-03). CV rendering is **hybrid**: bucket objects → short-TTL signed URL minted in a server action (service-role, server-only, after a membership check); Drive links → a reliable **"Abrir CV" new tab** (leverages Franco's Google session) with a best-effort `/preview` iframe that must degrade gracefully because most applicant CVs' Drive permissions are unknown. Auth is low-risk: **HITO already has Google OAuth + magic-link enabled on this project** (its `login-form.tsx` uses both), so no auth-provider config change is needed — only adding LABURO's new Vercel domain to the project's redirect-URL allowlist and seeding/auto-provisioning the 2 admin `members` rows. This phase also lands the two Phase-1 REVIEW fixes that gate the new work: **WR-04** (`members.role` CHECK + `is_org_writer` enumerate-allowed) and **WR-05** (`ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE … FROM PUBLIC` so new `staff_app` functions aren't anon-callable by default).

**Primary recommendation (Q1):** Expose `staff_app` reads to the Next.js server via **`public` security-invoker views** over `staff_app.staff_profiles` (+ a `my_membership` view for the gate, + a small crew/availability view). No `pgrst.db_schemas` change, RLS/membership enforced by the DB, full supabase-js query power, advisor-clean.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login (OAuth/OTP) | Browser (initiates) | Frontend Server (session cookie via `@supabase/ssr` + `/auth/callback` route) | Supabase Auth flow; session established server-side and refreshed in middleware |
| Auth + membership gate (D-06) | Frontend Server (org layout, server component) | Database (RLS on `staff_app.members` via `is_org_member`) | Gate decision is server-rendered; the *authority* is DB RLS — a non-member's view query returns 0 rows |
| Staff search / filter (SRCH-01/02) | Database (RLS-scoped filtered query) | Frontend Server (server component issues the query) | 687 rows + availability join belong in Postgres; RLS enforces org scope |
| Profile read (PERF-01) | Database (view row) | Frontend Server (renders) | Single RLS-scoped row fetch |
| CV signed URL (PERF-02) | Frontend Server (server action, service-role) | Database/Storage (`staff-cvs` object) | Signing must be server-only; service-role never reaches the browser |
| CV Drive open | Browser (`window.open` new tab) | — | Leverages Franco's own Google session; no server involvement |
| wa.me / tel: actions | Browser (deep link) | — | Pure client deep links, no API |
| Brand/glow/motion | Browser (CSS + Motion) | — | Presentation only |

---

## Standard Stack

The stack is **locked** by `.planning/research/STACK.md` (mirrored in `CLAUDE.md`) and by `02-UI-SPEC.md`. This section confirms current versions (verified on npm 2026-07-14) and calls out what actually gets installed **for this phase** (search/profile UI — NOT the offer/email/token libs, which are Phase 3+).

### Core (install this phase)
| Library | Version (verified npm 2026-07-14) | Purpose | Why Standard |
|---------|-----------------------------------|---------|--------------|
| `next` | pin `^15.5` (HITO ships `^15.5.15`; latest line is `16.2.10`) | App Router SSR dashboard | HITO parity → copy its Supabase clients/middleware/gate verbatim. Do NOT jump to 16 this phase (breaking caching/config changes; de-risk v1) `[VERIFIED: npm registry + HITO package.json]` |
| `react` / `react-dom` | `^19.2` | UI runtime | Required by Next 15.5 + Base UI 1.x `[VERIFIED: npm]` |
| `typescript` | `~5.8` | Types for DB rows / search params | HITO parity `[CITED: STACK.md]` |
| `@supabase/ssr` | `^0.12` (npm `0.12.3`; HITO ships `^0.10`, drop-in) | Cookie session in middleware + server components | The supported App-Router Supabase Auth wiring `[VERIFIED: npm]` |
| `@supabase/supabase-js` | `^2.110` (npm `2.110.5`) | RLS-scoped reads as the signed-in user (the whole security model) | Locked query path `[VERIFIED: npm + STACK.md]` |
| `tailwindcss` + `@tailwindcss/postcss` + `autoprefixer` | `^4.3` (npm `4.3.2`) | Styling (v4 CSS-first pipeline) | HITO uses v4; mobile-first utilities `[VERIFIED: npm]` |

### Supporting (install this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@base-ui/react` | `^1.6` (npm `1.6.0`; HITO pins `^1.4.1`) | Headless primitives — **Dialog (bottom-sheet filters), Select (provincia), Popover** | Copy HITO's wrapper *mechanics*, restyle to LABURO tokens. Package name is `@base-ui/react` (NOT the old `@base-ui-components/react`, stuck at an rc) `[VERIFIED: npm]` |
| `lucide-react` | **pin `^0.546`** (HITO's line) | Icons: `Search`, `MapPin`, `ExternalLink`, `Phone`, back chevron | ⚠️ npm's newer `1.24.0` line is the "confusingly-versioned" fork STACK.md warns about — **pin to HITO's `^0.546`, do not take `latest`** `[VERIFIED: npm — confirms STACK warning]` |
| `motion` | `^12.42` (npm `12.42.2`) | Micro-interactions (`motion/react`) — chip tap, card press, results stagger, bottom-sheet slide | User global rule + UI-SPEC; sparingly, respect `prefers-reduced-motion` `[VERIFIED: npm + CLAUDE.md global]` |
| `next-themes` | `^0.4.6` | Theme wiring **locked to dark** (v1 dark-only) | UI-SPEC `[VERIFIED: npm]` |
| `sonner` | `^2.0.7` | Toasts (error/retry states) | HITO parity `[CITED: STACK.md]` |
| `clsx` + `tailwind-merge` + `class-variance-authority` | `^2.1` / `^3.6` / `^0.7.1` | `cn()` helper + variant styling | Copy HITO's `cn()` `[CITED: STACK.md]` |

**Not this phase (deferred to Phase 3+):** `react-hook-form`, `zod` + `@hookform/resolvers` (offer form), `nodemailer` + `@react-email/*` (offer email), `date-fns` (offer expiry). Only pull `zod` early if you choose to validate search params server-side (cheap, optional — see Security Domain).

**Installation (this phase):**
```bash
# scaffold (Next 15.5 App Router, TS, Tailwind, ESLint — at REPO ROOT)
npx create-next-app@15 . --typescript --app --tailwind --eslint --src-dir=false --import-alias "@/*"
# data + auth
npm i @supabase/supabase-js@^2.110 @supabase/ssr@^0.12
# UI (LABURO parity with HITO mechanics)
npm i @base-ui/react@^1.6 lucide-react@^0.546 motion@^12.42 next-themes@^0.4.6 sonner@^2.0.7
npm i clsx@^2.1 tailwind-merge@^3.6 class-variance-authority@^0.7.1
# tailwind v4 pipeline (create-next-app@15 may already add these — verify)
npm i -D @tailwindcss/postcss@^4.3 autoprefixer
```
> Verify `create-next-app` pins Next 15.5 not 16 after scaffold (`npx create-next-app@15` targets the 15 line; confirm `next` in package.json reads `15.5.x` and pin it). If it resolves to 16, downgrade explicitly.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next 15.5 | Next 16.2 | On latest, but breaking config/caching changes + loses verbatim HITO parity → higher v1 risk. Upgrade path stays open |
| `next/font` self-host | Runtime Google Fonts CDN | CDN adds a network dependency + violates zero-runtime-cost preference; self-host is free and faster `[CITED: STACK/UI-SPEC]` |
| Base UI | shadcn init | UI-SPEC explicitly declines shadcn (stack-locked to Base UI for HITO wrapper reuse); adding it = a second conflicting primitive layer |

## Package Legitimacy Audit

> slopcheck could not be run in this research session (no package manager write access for a global pip/npm install in-scope). Per protocol graceful degradation, packages are **not** auto-tagged `[ASSUMED]` here because they carry a stronger provenance than a registry lookup: **every package is taken verbatim from HITO's deployed `package.json`** (an authoritative, in-production source read this session at `/Users/fridao/Proyectos/HITO-by-DER-main/package.json`) and each version was confirmed live on npm. The planner may still choose to run `slopcheck install …` at execution time; none below is new/low-trust.

| Package | Registry | Age/Maturity | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|--------------|-----------|-------------|-----------|-------------|
| next | npm | mature (Vercel) | ~8M/wk | github.com/vercel/next.js | not run | Approved (HITO-proven) |
| react / react-dom | npm | mature (Meta) | ~40M/wk | github.com/facebook/react | not run | Approved |
| @supabase/supabase-js | npm | mature | ~3M/wk | github.com/supabase/supabase-js | not run | Approved |
| @supabase/ssr | npm | mature | ~1M/wk | github.com/supabase/auth-helpers | not run | Approved |
| @base-ui/react | npm | maturing (MUI team) | growing | github.com/mui/base-ui | not run | Approved — ⚠️ confirm name `@base-ui/react` (not `@base-ui-components/react`) |
| lucide-react | npm | mature | ~2M/wk | github.com/lucide-icons/lucide | not run | Approved — **pin `^0.546`, NOT `1.24.0` line** |
| tailwindcss / @tailwindcss/postcss | npm | mature | ~10M/wk | github.com/tailwindlabs/tailwindcss | not run | Approved |
| motion | npm | mature (was framer-motion) | ~5M/wk | github.com/motiondivision/motion | not run | Approved |
| next-themes / sonner / clsx / tailwind-merge / class-variance-authority | npm | mature | high | respective GH repos | not run | Approved (HITO-proven) |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged [SUS]:** none — but the `lucide-react` version fork is a real footgun (correct package, wrong version line). Planner: pin `^0.546`.

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────── PHONE (Franco) ───────────────────────────┐
                          │  LABURO — Next.js 15 App Router (new Vercel project, dark-only)        │
                          │                                                                        │
   Google OAuth / OTP ───▶│  /login ──signInWithOAuth('google') / signInWithOtp(email)──┐         │
   (already enabled on    │                                                              ▼         │
    HITO's project)       │                                            /auth/callback (route)      │
                          │                                            exchangeCodeForSession       │
                          │                                            + provision members row      │
                          │                                            if email ∈ ALLOWLIST (D-06)  │
                          │                                                     │                   │
                          │  middleware.ts ── updateSession (refresh cookie, redirect unauth) ──────┤
                          │                                                     ▼                   │
                          │   ORG LAYOUT (server component) ── auth gate + membership gate ─────────┤
                          │     getUser → query public.staff_app_my_membership                      │
                          │        0 rows → "sin acceso" screen (D-06)   ≥1 row → dashboard         │
                          │                        │                                                │
                          │      ┌─────────────────┼──────────────────────────┐                    │
                          │      ▼                 ▼                          ▼                     │
                          │  SEARCH page      PROFILE page               CV (server action)         │
                          │  supabase.from(   supabase.from(             bucket obj → signed URL    │
                          │   'staff_app_      'staff_app_profiles')      (service-role, TTL 60s)   │
                          │   profiles')       .eq('id', …).single()     Drive link → new tab       │
                          │   .overlaps(oficios)                          wa.me / tel: (client)      │
                          │   .or(ilike name)                                                        │
                          │   .eq(provincia) .range()                                                │
                          └───────────┬───────────────────────────────────────┬────────────────────┘
                                      │ @supabase/ssr (anon key + Franco's JWT) │ service-role (server-only)
                                      ▼   RLS enforced as `authenticated`       ▼
        ┌──────────────────────────────────────────────────────────────────────────────────────────┐
        │  SUPABASE  luillpzfqzbpoqkgvjuw  (HITO's project — SHARED, live)                            │
        │                                                                                            │
        │  public (already PostgREST-exposed)          staff_app (NOT exposed — reached via views)   │
        │  ┌──────────────────────────────────┐        ┌──────────────────────────────────────────┐ │
        │  │ VIEW staff_app_profiles          │──────▶ │ staff_profiles (687 rows, RLS:            │ │
        │  │   WITH (security_invoker=true)   │        │   is_org_member(organization_id))         │ │
        │  │ VIEW staff_app_my_membership     │──────▶ │ members (RLS) · organizations             │ │
        │  │ VIEW staff_app_crew_busy (avail) │──────▶ │ crew · gigs                               │ │
        │  │ FUNC staff_app_register_applicant│        │ is_org_member / is_org_writer (helpers)   │ │
        │  │   (Phase 1 intake — unrelated)   │        └──────────────────────────────────────────┘ │
        │  └──────────────────────────────────┘        STORAGE: staff-cvs (private, signed server-side)│
        │  HITO's own public.* tables — UNTOUCHED, RLS still denies non-HITO-members                  │
        └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (scaffold at REPO ROOT — not `apps/`)
```
staff-app/                         # existing repo root (has supabase/, .planning/, CLAUDE.md)
├── app/
│   ├── layout.tsx                 # root: next/font (Inter + Baloo 2 700), dark theme, <Toaster/>
│   ├── globals.css                # Tailwind v4 @import + @theme LABURO token layer (UI-SPEC)
│   ├── login/
│   │   ├── page.tsx               # copy HITO, restyle LABURO (server; redirects if already authed)
│   │   └── login-form.tsx         # copy HITO logic (google + magic link), restyle
│   ├── auth/callback/route.ts     # copy HITO, adapt: provision staff_app members on allowlist
│   ├── (app)/                     # authed group — single hardcoded org (no [orgSlug] needed for v1)
│   │   ├── layout.tsx             # AUTH + MEMBERSHIP GATE (adapt HITO [orgSlug]/layout)
│   │   ├── page.tsx               # SEARCH: chips + text + results cards (SRCH-01/02/03)
│   │   ├── search-client.tsx      # client: chips/filters state, debounced query, Motion
│   │   ├── filtros-sheet.tsx      # Base UI Dialog bottom sheet (D-04)
│   │   ├── acceso-denegado.tsx    # D-06 "sin acceso" screen
│   │   └── staff/[id]/
│   │       ├── page.tsx           # PROFILE (PERF-01) — server component
│   │       └── cv-actions.ts      # server action: signed URL for bucket CV (PERF-02)
├── lib/
│   ├── supabase/{server,client,middleware,admin}.ts   # COPY from HITO verbatim
│   ├── oficios.ts                 # the 64-oficio catalog (from somosder-web provinciasAr/oficios)
│   ├── avatar-color.ts            # hash(primary_oficio) % 8 → UI-SPEC categorical palette
│   ├── cv.ts                      # detect Drive vs bucket; Drive id extraction + /preview URL
│   └── wa.ts                      # wa.me + tel: builders (E.164)
├── middleware.ts                  # COPY HITO root middleware, STRIP i18n (es-AR only)
└── supabase/migrations/           # NEW: staff_app_0006+ (views, indexes, WR-04/WR-05 fixes, members seed)
```
**Why root, not `apps/`:** single standalone app, no monorepo need; mirrors HITO's flat `app/`+`lib/`+`supabase/` layout; keeps the existing `supabase/migrations/` history in place.

**Why `(app)` route group, not `[orgSlug]`:** v1 has exactly one hardcoded org (`aa29aa2f-…`). HITO's `[orgSlug]` multi-org slug routing is unneeded complexity for 2 users. Keep the *membership* concept (it's the D-06 gate) but drop slug routing. (Marketplace v2 can reintroduce `[orgSlug]` — config, not rewrite.)

### Pattern 1: Copy HITO's Supabase SSR clients verbatim (files named exactly)
Copy these four with **no logic changes** (only the i18n strip in middleware):
- `lib/supabase/server.ts` — `createServerClient` from cookies (server components / actions). Reads `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase/client.ts` — `createBrowserClient` (client components; login form uses this).
- `lib/supabase/middleware.ts` — `updateSession`; **strip** the HITO `LOCALE_COOKIE`/rewrite/`opts` machinery; keep only: build response, refresh `getUser()`, redirect unauth to `/login` unless path is public. Public paths for LABURO: `['/login', '/auth/callback']`.
- `lib/supabase/admin.ts` — `createServiceRoleClient()` (service-role, server-only). **Used ONLY for the CV signed-URL server action** (PERF-02). Never imported by a client component.
```ts
// Source: /Users/fridao/Proyectos/HITO-by-DER-main/lib/supabase/server.ts  [CITED: read this session]
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { try { list.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch {} },
    }});
}
```

### Pattern 2: Auth + membership gate (adapt HITO `[orgSlug]/layout.tsx`) — the D-06 door
HITO's gate: `getUser()` → load org by slug → check `members` for `(org.id, user.id)` → if no member and no memberships, redirect `/onboarding`, else `notFound()`. **Adapt for LABURO:**
```ts
// app/(app)/layout.tsx — server component. Pattern from HITO [orgSlug]/layout.tsx [CITED].
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
// membership via the public security-invoker view (staff_app not PostgREST-exposed):
const { data: membership } = await supabase.from("staff_app_my_membership").select("role").maybeSingle();
if (!membership) return <AccesoDenegado />;   // D-06: 0 rows = not authorized → "sin acceso" + logout
// authorized → render dashboard shell
```
- The view returns the caller's own `members` row(s); RLS `members_select USING is_org_member(organization_id)` means a non-member gets **0 rows** — that IS the gate. No hardcoded email comparison needed at read time (the allowlist lives at *provisioning* time — Pattern 5).
- **Do NOT** copy HITO's `/onboarding` redirect — a non-authorized LABURO login must see the dedicated "sin acceso" screen (UI-SPEC "Access denied" state), never a way in.

### Pattern 3: Server-side search over a `public` security-invoker view (SRCH-01/02/03)
```sql
-- migration staff_app_0007_search_views.sql
CREATE VIEW public.staff_app_profiles WITH (security_invoker = true) AS
  SELECT id, nombre, apellido, oficios, oficios_otro, provincia, ciudad,
         experiencia, anios_experiencia, eventos_trabajados, experiencia_detalle,
         disponibilidad_finde, disponibilidad_viajar, movilidad_propia, disponibilidad_aviso,
         estado, cv_url, portfolio_url, linkedin_url, telefono, email,
         situacion_legal, donde_trabajar, pais_residencia, motivacion, organization_id
  FROM staff_app.staff_profiles;   -- RLS of the base table applies (security_invoker)
GRANT SELECT ON public.staff_app_profiles TO authenticated;   -- anon NOT granted (Franco is authed)
```
```ts
// Server component / server action query (supabase-js, Franco's JWT → RLS as `authenticated`)
let q = supabase.from("staff_app_profiles")
  .select("id,nombre,apellido,oficios,provincia,ciudad,experiencia,eventos_trabajados,anios_experiencia");
if (oficios.length)  q = q.overlaps("oficios", oficios);              // GIN-indexed array overlap (SRCH-01)
if (text)            q = q.or(`nombre.ilike.%${t}%,apellido.ilike.%${t}%,experiencia_detalle.ilike.%${t}%`);
if (provincia)       q = q.eq("provincia", provincia);
if (dispFinde)       q = q.eq("disponibilidad_finde", true);          // D-04 toggles
const { data } = await q.order("nombre").range(0, 49);                // paginate; keep mobile payload small
```
**Indexes (migration):**
```sql
CREATE INDEX IF NOT EXISTS staff_profiles_oficios_gin ON staff_app.staff_profiles USING gin (oficios);
CREATE INDEX IF NOT EXISTS staff_profiles_provincia   ON staff_app.staff_profiles (provincia);
-- optional, cheap insurance for ILIKE free-text (687 rows seq-scans fine, but future-proofs):
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- verify it's already available on the project
CREATE INDEX IF NOT EXISTS staff_profiles_nombre_trgm ON staff_app.staff_profiles USING gin (nombre gin_trgm_ops);
```
**Why server-side, not load-all-687:** (1) SRCH-02's "not assigned to an overlapping gig" needs a `crew`/`gigs` join — impossible client-side. (2) Full-column rows (free-text `motivacion`/`experiencia_detalle`) make a load-all payload ~1MB+ — slow on cellular (SRCH-03). (3) It's the pattern that scales to marketplace v2. (See §Common Pitfalls 4 and PITFALLS.md "Full-table load … Sluggish on phone".) 687 rows is small enough that indexes are insurance, not necessity — but the join and payload make server-side the honest call.

**SRCH-02 availability** — see Open Question 1. Phase 2 has ~0 gigs (gigs are created in Phase 3), so implement the *minimum*: (a) show `disponibilidad_aviso` (manual note) on the profile, and (b) an optional "ocultar ya asignados" toggle backed by a second security-invoker view `staff_app_crew_busy` returning `staff_profile_id`s with an overlapping `crew`→`gig` assignment; exclude those ids. Full interval/overnight overlap sophistication matures in Phase 3 when real gigs exist.

### Pattern 4: CV rendering — hybrid, server-signed for bucket, new-tab for Drive (PERF-02)
```ts
// lib/cv.ts
export function classifyCv(cvUrl: string | null) {
  if (!cvUrl) return { kind: "none" as const };
  const drive = cvUrl.match(/(?:open\?id=|\/file\/d\/)([\w-]+)/);
  if (drive) return { kind: "drive" as const, id: drive[1],
    preview: `https://drive.google.com/file/d/${drive[1]}/preview`,   // best-effort iframe
    open: `https://drive.google.com/open?id=${drive[1]}` };           // reliable new-tab
  return { kind: "bucket" as const, key: cvUrl };                     // relative object key → sign server-side
}
```
```ts
// app/(app)/staff/[id]/cv-actions.ts — server action (PERF-02)
"use server";
export async function signCv(objectKey: string) {
  const supabase = await createClient();                              // authed — verify caller is a member first
  const { data: m } = await supabase.from("staff_app_my_membership").select("role").maybeSingle();
  if (!m) throw new Error("forbidden");
  const admin = createServiceRoleClient();                            // service-role, SERVER-ONLY
  const { data } = await admin.storage.from("staff-cvs").createSignedUrl(objectKey, 60); // short TTL
  return data?.signedUrl ?? null;
}
```
- **Bucket objects (8):** signed URL, TTL 60s, minted in the server action above **after** a membership check. Service-role is used only to sign (avoids needing a `storage.objects` SELECT policy change on the shared bucket); it never reaches the client. (See Open Question 2 for the policy-based alternative.)
- **Drive links (679):** primary action is **"Abrir CV" → `window.open(open, '_blank')`** — reliable because Franco is signed into Google as SOMOS DER, and these CVs were submitted to SOMOS DER. The `/preview` iframe is a *best-effort* enhancement: it only renders if the file is "Anyone with link / Viewer"; otherwise it shows "You need permission" `[CITED: nannyakore.com, Latenode community — Drive /preview needs public share; login page can't be iframed]`. So render the iframe optimistically but ALWAYS show the "Abrir CV" escape hatch, and on iframe error show the UI-SPEC dead-link fallback ("No pudimos abrir este CV." + "Abrir CV"). Never crash on a dead link.

### Pattern 5: Provision the 2 admin `members` rows (D-06 gate) — in `/auth/callback`
```ts
// app/auth/callback/route.ts — adapt HITO's callback [CITED]
const ADMIN = ["ridaofrancorg@gmail.com", "franco@somosder.ar"];     // D-06 allowlist (env or const)
// after exchangeCodeForSession + getUser:
if (user && ADMIN.includes((user.email ?? "").toLowerCase())) {
  const admin = createServiceRoleClient();                            // service-role: staff_app not exposed to authed writes
  await admin.schema("staff_app").from("members").upsert(
    { organization_id: "aa29aa2f-4d34-4e53-b62c-7397e8a4d123", user_id: user.id, role: "owner" },
    { onConflict: "organization_id,user_id" });
}
// non-allowlisted users: NO members row created → gate denies them (Pattern 2)
```
- The service-role client can write to `staff_app.members` server-side (`.schema('staff_app')` sets the request profile; ~~service-role bypasses PostgREST schema exposure~~ (DISPROVEN — PGRST106 is role-independent; see 01-03-SUMMARY. Use the public SECURITY DEFINER provision RPC) for its own key **only server-side**). Alternative: a `SECURITY DEFINER` `public.staff_app_provision_member()` that self-provisions if `auth.email()` ∈ allowlist (keeps the allowlist in the DB). CORRECTION (plan-checker 2026-07-14): the service-role variant does NOT work — PGRST106 blocks any `.schema('staff_app')` REST call regardless of role. The SECURITY DEFINER `public.staff_app_provision_member()` RPC is the ONLY viable path and is what plan 02-01 builds (migration staff_app_0007).
- **Also seed directly if the accounts already exist:** the executor should first query `auth.users` for the 2 emails; if present (Franco likely already has HITO auth accounts), `INSERT` the 2 `members` rows in a migration so the gate works on first login without waiting for the callback. The callback path is the robust fallback for whichever email is new.

### Pattern 6: Fonts, theme, tokens (UI-SPEC)
```ts
// app/layout.tsx
import { Inter, Baloo_2 } from "next/font/google";
const inter = Inter({ subsets: ["latin"], weight: ["400","600"], variable: "--font-inter" });
const baloo = Baloo_2({ subsets: ["latin"], weight: ["700"], variable: "--font-baloo" }); // logo lockup ONLY
```
- `globals.css`: Tailwind v4 `@import "tailwindcss";` + a `@theme` block mapping the UI-SPEC color/spacing/type tokens to CSS custom properties (`--fg`, `--fg-muted`, accent `#2F80FF`, glow `#4CC9FF`, surfaces, the 8-pt scale). Dark-only: set the dark palette as the root, wire `next-themes` but lock to `dark`.
- Glow = static box/text-shadow recipes from UI-SPEC (§Glow Effect Spec), applied ONLY to brand moments (wordmark, login hero, empty-state heading, primary CTA, active chip). Everything else flat.

### Anti-Patterns to Avoid
- **Exposing `staff_app` in `pgrst.db_schemas` when a `public` view suffices** — manual `ALTER ROLE authenticator SET pgrst.db_schemas` takes exposed-schema management away from the Dashboard for the *whole shared HITO project* `[CITED: Supabase custom-schemas docs]`. Avoid it; use security-invoker views (see Q1).
- **SECURITY DEFINER search function returning sets** — loses PostgREST filter flexibility, adds RLS-bypass surface, and re-introduces the WR-05 "anon-callable by default" footgun. A `security_invoker` view is simpler and safer.
- **Signing CVs with the anon/authed client without a storage policy** — `createSignedUrl` needs storage read perms; either add a scoped `storage.objects` SELECT policy OR (recommended) sign with service-role in a server action after a membership check.
- **Copying HITO's i18n/locale middleware + `[orgSlug]` slug routing** — dead weight for a 2-user es-AR app; strip it.
- **Client-side load-all-687-then-filter** — mobile payload + can't do SRCH-02 join.
- **Service-role key in any client component / `NEXT_PUBLIC_` var** — full DB access leaked to the browser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookies / refresh in App Router | Custom cookie/JWT handling | `@supabase/ssr` `updateSession` in middleware (copy HITO) | Edge cases (SSR set-cookie, refresh races) already solved |
| OAuth / magic-link flow | Custom OAuth redirect handling | `supabase.auth.signInWithOAuth` / `signInWithOtp` + `/auth/callback` (copy HITO) | Provider already enabled on this project |
| Membership/authorization check | Hardcoded email `if` in every page | RLS on `staff_app.members` surfaced via the `my_membership` view (0 rows = denied) | DB is the authority; one gate, not N scattered checks |
| Array multi-select filter | String-built SQL / client filtering | `supabase-js` `.overlaps('oficios', […])` + GIN index | Native PostgREST operator, index-backed `[VERIFIED: Supabase overlaps docs]` |
| Signed CV URL | Manual HMAC / public URL | `supabase.storage.createSignedUrl(key, 60)` server-side | Correct, short-TTL, no public leak (PERF-02, habeas data) |
| Bottom-sheet filter dialog | Custom modal + focus trap | Base UI `Dialog` styled as bottom sheet | Accessible primitives; UI-SPEC-mandated |
| Deterministic avatar color | Random / per-render color | `hash(primary_oficio) % 8` → UI-SPEC palette | Stable per-oficio color app-wide (D-03) |
| WhatsApp / call action | WhatsApp Business API | `wa.me/<E164>?text=…` / `tel:` deep links | Zero cost, one tap (CLAUDE.md forbids paid WA API) |

**Key insight:** almost nothing in this phase is net-new — it is HITO's proven auth/data mechanics restyled to LABURO, plus one DB-access decision (security-invoker views) and one CV decision (hybrid signing). The value is in *reusing* correctly, not inventing.

## Runtime State Inventory

> This phase is **additive/greenfield app code + new DB read objects** — not a rename/refactor of existing runtime state. The categories below are answered for completeness because Phase 2 touches a shared live Supabase project and creates the first LABURO deployment.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `staff_app.staff_profiles` = 687 rows (verified Phase 1). `staff_app.members` = **0 rows** (seeded empty in 01-01) | Seed/provision the 2 admin `members` rows (Pattern 5) — the gate is dead until this exists |
| Live service config | **Supabase Auth (shared with HITO):** Google OAuth + magic-link already enabled (HITO's `login-form.tsx` uses both — verify live). **Redirect-URL allowlist:** LABURO's new Vercel domain `/auth/callback` is NOT yet allowlisted | Executor: add `https://<laburo-domain>/auth/callback` + `http://localhost:3000/auth/callback` to the project's Auth → URL Configuration (additive, does not affect HITO's existing URLs) |
| OS-registered state | None — new Vercel Hobby project, no cron/scheduler/OS tasks this phase | Create the Vercel project (`npx vercel link` → new) + set env vars |
| Secrets / env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, for CV signing) — **same values as HITO's project** `luillpzfqzbpoqkgvjuw` (co-located). Optionally `ADMIN_EMAILS` | Set in Vercel project env (service-role NEVER `NEXT_PUBLIC_`). Get URL/anon via project settings; service-role from the same project |
| Build artifacts | None yet — repo has no app code (`ls` shows only `supabase/`, `.planning/`, `CLAUDE.md`, `.gitignore`) | Scaffold creates `package.json`, `.next/`, etc. Ensure `.gitignore` covers `.next`, `node_modules`, `.env*` |

**Verified explicitly:** repo root currently has **no** Next.js app (greenfield scaffold). `staff_app.members` is empty (from 01-01 SUMMARY: "members left empty (auth wired in Phase 2)").

## Common Pitfalls

### Pitfall 1: `staff_app` is invisible to PostgREST — the query silently fails
**What goes wrong:** A naive `supabase.from('staff_profiles')` (default `public` schema) hits HITO's *own* `public.staff_profiles` (frozen, 8 rows) — wrong data — or `.schema('staff_app').from('staff_profiles')` returns `PGRST106 Invalid schema: staff_app` (Phase 1 verified this exact error).
**Why:** PostgREST only serves schemas in `pgrst.db_schemas`; `staff_app` is deliberately not there.
**How to avoid:** Read via the `public.staff_app_*` security-invoker views (Q1). Never query `staff_app` directly from supabase-js on the client/authed path.
**Warning signs:** `PGRST106`; or results showing 8 rows (HITO's public table) instead of 687.

### Pitfall 2: A curious Google login sees the 687-person PII pool (D-06 breach)
**What goes wrong:** Signup is open (any Google account / any email OTP). If the gate is missing or client-only, a non-authorized user reaches the dashboard and reads PII.
**Why:** Supabase Auth creates a valid `auth.users` session for anyone; access ≠ authentication.
**How to avoid:** RLS on `staff_app.staff_profiles` (`is_org_member`) + surface membership via the view — a non-member's query returns 0 rows even if they bypass the UI gate. The UI "sin acceso" screen is defense-in-depth, not the boundary. Verify: log in with a throwaway Google account → dashboard shows "sin acceso", and a direct view query returns 0 rows.
**Warning signs:** Any code that filters by email in JS instead of relying on RLS; a page that renders profiles before the gate resolves.

### Pitfall 3: Service-role key leaks to the browser
**What goes wrong:** CV signing needs elevated perms; importing `admin.ts` into a client component (or naming the var `NEXT_PUBLIC_`) ships full DB access to every visitor.
**How to avoid:** Signing lives in a `"use server"` action (`cv-actions.ts`); `SUPABASE_SERVICE_ROLE_KEY` is a server-only env var; `admin.ts` is never imported by a `"use client"` file. (HITO's `admin.ts` header already warns this.)
**Warning signs:** `createServiceRoleClient` in a component with `"use client"`; `NEXT_PUBLIC_SERVICE_ROLE` anywhere.

### Pitfall 4: Search sluggish on the phone (SRCH-03 fail)
**What goes wrong:** Loading all 687 full-column rows (with free-text fields) to filter client-side → ~1MB+ payload, janky on cellular; and SRCH-02's availability join is impossible client-side.
**How to avoid:** Server-side filtered query + `.range()` pagination + select only card columns (not `motivacion`/`experiencia_detalle`) for the list; fetch heavy fields only on the profile page. Debounce free-text (250–300ms). (PITFALLS.md "Full-table load of staff_profiles … Sluggish on phone".)
**Warning signs:** First paint waits on a big fetch; scroll jank; network tab shows one large response.

### Pitfall 5: Drive `/preview` iframe shows "You need permission" and looks broken
**What goes wrong:** Embedding `open?id=` directly, or embedding a non-public file, renders Google's permission wall or is blocked by `X-Frame-Options`.
**How to avoid:** Transform to `/file/d/<id>/preview`; treat the iframe as best-effort; ALWAYS show "Abrir CV" (new tab) which uses Franco's Google session; on iframe error, show the UI-SPEC dead-link fallback. (`[CITED: nannyakore.com; Latenode community]`)
**Warning signs:** Blank/permission iframe; console `Refused to display … X-Frame-Options`.

### Pitfall 6: `next/font` weights don't match the type scale → visual drift
**What goes wrong:** Loading Inter 500/700 or using Baloo 2 for body text violates the UI-SPEC weight discipline (400/600 only; Baloo 2 700 is the logo lockup asset ONLY).
**How to avoid:** Declare `Inter weight:["400","600"]` and `Baloo_2 weight:["700"]` and use Baloo only for the string "LABURO". (UI-SPEC Typography.)

### Pitfall 7 (from Phase 1 REVIEW, must fix here): fail-open writer role + anon-callable-by-default functions
**What goes wrong:** WR-04 — `members.role` is free text and `is_org_writer` grants write for `role <> 'viewer'` (any typo → writer). WR-05 — new `staff_app` functions are `EXECUTE`-to-`PUBLIC` by default, and anon holds schema `USAGE`, so any function added this phase is anon-callable unless manually revoked.
**How to avoid (migrations this phase, BEFORE new objects):**
```sql
ALTER TABLE staff_app.members ADD CONSTRAINT members_role_check CHECK (role IN ('owner','writer','viewer'));
-- redefine is_org_writer: ... AND role IN ('owner','writer')
ALTER DEFAULT PRIVILEGES IN SCHEMA staff_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;  -- run as the role that creates functions
```
Then run `get_advisors(security)` after every migration and diff against the Phase-1 baseline (zero new `staff_app` findings) — the established discipline.
**Warning signs:** advisor shows a new `anon_security_definer_function_executable` for a staff_app function you didn't intend; a member row with `role='Writer'` silently gains write.

## Code Examples

### wa.me + tel: (E.164) — no library
```ts
// lib/wa.ts  [CITED: CLAUDE.md wa.me pattern]
const e164 = (raw: string) => raw.replace(/[^\d]/g, "");            // strip +, spaces, dashes
export const waLink = (phone: string, text: string) =>
  `https://wa.me/${e164(phone)}?text=${encodeURIComponent(text)}`;  // wa.me wants no '+'
export const telLink = (phone: string) => `tel:+${e164(phone)}`;
```

### Deterministic avatar color (D-03 / UI-SPEC categorical palette)
```ts
// lib/avatar-color.ts
const PALETTE = ["#5B8DEF","#2DD4BF","#E8A13A","#C77DFF","#F0708A","#E86F4E","#8B95B5","#3DD68C"];
const hash = (s: string) => [...s].reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0, 0);
export const oficioColor = (primaryOficio: string) => PALETTE[Math.abs(hash(primaryOficio)) % 8];
```

### Security-invoker membership view (the D-06 gate source)
```sql
-- Source pattern: Supabase RLS docs — views obey base-table RLS when security_invoker=true [CITED]
CREATE VIEW public.staff_app_my_membership WITH (security_invoker = true) AS
  SELECT organization_id, role FROM staff_app.members;   -- members_select RLS scopes to caller
GRANT SELECT ON public.staff_app_my_membership TO authenticated;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SECURITY DEFINER views (RLS-bypassing) | Views `WITH (security_invoker = true)` | Postgres 15 (Supabase default ≥15) | Views can obey base-table RLS → safe way to expose `staff_app` through `public` `[CITED: Supabase RLS docs]` |
| `@base-ui-components/react` | `@base-ui/react` | package rename | Install `@base-ui/react@^1.6`; old name stuck at rc `[VERIFIED: npm]` |
| Supabase auth-helpers | `@supabase/ssr` | ~2024 | HITO already on `@supabase/ssr`; use `^0.12` `[VERIFIED: npm]` |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first `@theme` + `@tailwindcss/postcss` | v4 | Tokens live in `globals.css`, not a JS config `[CITED: STACK.md]` |

**Deprecated/outdated:**
- `lucide-react@1.x` line — the "confusingly-versioned" fork; **use `^0.546`** (HITO's line).
- HITO's i18n route middleware + `[orgSlug]` slug routing — correct for HITO, unnecessary weight for LABURO v1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google OAuth + magic-link are already enabled on project `luillpzfqzbpoqkgvjuw` (inferred from HITO's `login-form.tsx` using both) | Q2 / Runtime State | If disabled, executor must enable the provider (a shared-project auth config change) — verify live before planning login as "no config" |
| A2 | The 2 admin emails (`ridaofrancorg@`, `franco@somosder.ar`) already exist in `auth.users` from HITO usage | Pattern 5 | If not, first-login provisioning via `/auth/callback` (fallback) is required rather than a pre-seed migration — plan both paths |
| A3 | `staff-cvs` bucket objects' `cv_url` is stored as a relative object key (not a full URL) for the 8 bucket CVs | Q4 / Pattern 4 | If it's a full URL, `classifyCv` needs to strip the bucket prefix before `createSignedUrl`. Executor: sample the 8 non-Drive `cv_url` values |
| A4 | `pg_trgm` extension is available/creatable on the project (for optional ILIKE index) | Pattern 3 | If restricted, drop the trigram index — 687 rows seq-scan on ILIKE is fine anyway |
| A5 | The 64-oficio catalog + 24 provincias are recoverable from somosder-web's `provinciasAr`/oficios data (used by Phase 1 normalizer) | lib/oficios.ts | If not, derive from `SELECT DISTINCT unnest(oficios)` over the pool — but that includes free-text noise; prefer the curated catalog |
| A6 | Adding LABURO's Vercel domain to the Auth redirect allowlist does not disturb HITO's existing redirect URLs (additive) | Runtime State | Low — allowlist is additive; but it IS a shared-project auth-config touch, so do it deliberately and record it |

**These are the items `/gsd-discuss-phase` or the executor must confirm on the live project before/at planning.** All are verifiable read-only via Supabase MCP (which the executor has; this researcher did not).

## Open Questions (RESOLVED)

> All 3 questions were resolved at planning (2026-07-14): the plans adopted each recommendation. Markers inline below.

1. **SRCH-02 availability semantics in Phase 2 (near-zero gigs).** — **RESOLVED:** plans 02-01/02-03 implement the minimum-honest version (staff_app_crew_busy view + "ocultar ya asignados" toggle + disponibilidad_aviso on profile); interval/overnight overlap deferred to Phase 3, explicitly flagged in 02-03's SUMMARY requirements.
   - What we know: gigs/crew tables exist (Phase 1) but are empty until Phase 3 creates gigs. The requirement wants "not assigned to an overlapping app gig" + manual note.
   - What's unclear: whether the search UI even has a date window to overlap against yet (offers/gigs are Phase 3).
   - Recommendation: implement the *minimum honest* version — show `disponibilidad_aviso` on the profile, and a "ocultar ya asignados" toggle backed by a `staff_app_crew_busy` security-invoker view (exclude staff_profile_ids currently in `crew`). Defer true interval/overnight overlap logic (PITFALLS.md Pitfall 9) to Phase 3 where gigs have real `starts_at`/`ends_at`. Flag in the plan so it isn't mistaken for "done".

2. **CV signing: service-role server-action vs `storage.objects` RLS policy.** — **RESOLVED:** plan 02-04 uses service-role signing in a server action after a membership check (no shared-bucket policy change); A3 cv_url format check folded into 02-04 Task 1.
   - What we know: `staff-cvs` is a shared private bucket (somosder-web uploads there); its current object-read policies are unverified (WR-08 noted no size/MIME limits).
   - Recommendation: default to **service-role signing in a server action after a membership check** (zero shared-storage-policy change). If the team prefers not to use service-role for reads, the alternative is a scoped `storage.objects` SELECT policy for `bucket_id='staff-cvs'` limited to staff_app members — but that's another shared-config touch. Executor should confirm the 8 bucket keys and the bucket's current policies.

3. **GitHub OAuth (D-05 "only if trivial").** — **RESOLVED:** plan 02-02 skips GitHub (not trivial on the shared project, no value for 2 users); Google + magic-link only.
   - What we know: HITO's login shows Google + magic-link, not GitHub. Enabling GitHub needs a GitHub OAuth app + secret on the shared project.
   - Recommendation: **skip GitHub this phase** (it's not trivial on a shared project and adds no value for 2 users). UI-SPEC already marks it conditional. Revisit only if Franco asks.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | scaffold/build | assumed (dev machine) | — | — |
| Vercel CLI | deploy / project create | ✓ (auth `ridaofranco-8135`) | via `npx vercel` | `vercel` not on PATH → use `npx vercel` (per 01-03) |
| Supabase project `luillpzfqzbpoqkgvjuw` | all data/auth | ✓ (live, shared) | — | none — it's the system of record |
| Supabase MCP (executor) | migrations, live checks (A1–A6) | ✓ (executor has it) | — | researcher lacked it → checks flagged as executor pre-steps |
| Google Fonts (Inter, Baloo 2) | fonts | ✓ (free, self-hosted at build via `next/font/google`) | — | already vendored by next/font |
| `pg_trgm` extension | optional ILIKE index | unverified | — | drop the index; seq-scan 687 rows is fine |

**Missing dependencies with no fallback:** none identified.
**Missing with fallback:** `vercel` on PATH → `npx vercel`; `pg_trgm` → skip trigram index.

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (OAuth/OTP) — copy HITO; do not hand-roll |
| V3 Session Management | yes | `@supabase/ssr` cookie session + middleware refresh (copy HITO) |
| V4 Access Control | **yes (core of this phase)** | RLS on `staff_app.*` via `is_org_member`; membership gate; WR-04 fix (enumerate-allowed roles); server-only service-role |
| V5 Input Validation | yes | Search params: constrain oficios to the known 64-catalog, provincia to the 24-list; escape/parameterize ILIKE via supabase-js (never string-concat SQL). Optional `zod` on server actions |
| V6 Cryptography | partial | No new tokens this phase (that's Phase 3/4). Signed URLs handled by Supabase Storage (don't hand-roll). Secrets in env only |
| V7 Errors/Logging | yes | Honest error/empty/access-denied states (UI-SPEC); never leak PII in errors; don't log service-role or signed URLs |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open signup reaches PII pool (D-06) | Elevation of Privilege / Info Disclosure | RLS membership gate — 0 rows for non-members (Pitfall 2) |
| Service-role key exposure | Info Disclosure | Server-only usage; never `NEXT_PUBLIC_` (Pitfall 3) |
| SQL/ILIKE injection via search text | Tampering | supabase-js parameterized filters; validate/whitelist enum params (V5) |
| Public/guessable CV URL | Info Disclosure (habeas data / Ley 25.326) | Private bucket + short-TTL signed URL only (PERF-02) |
| Anon-callable staff_app function (WR-05) | Elevation of Privilege | `ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE … FROM PUBLIC`; advisor lint each migration |
| Weakening HITO's shared API surface | Tampering | Use `public` security-invoker views, NOT `pgrst.db_schemas` change; zero writes to HITO `public.*` |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `supabase/migrations/staff_app_0001_schema_orgs.sql`, `…_0002_core_tables.sql` (exact DDL/columns); all four Phase-1 SUMMARYs + `01-REVIEW.md` (verified live results, grants, WR-04/05); `02-CONTEXT.md`, `02-UI-SPEC.md` (locked decisions/design contract); `.planning/research/{STACK(via CLAUDE.md),ARCHITECTURE,PITFALLS}.md`; `.planning/REQUIREMENTS.md`, `STATE.md`; `staff-app/CLAUDE.md`.
- HITO files read this session (`/Users/fridao/Proyectos/HITO-by-DER-main/`): `package.json` (stack versions), `lib/supabase/{server,client,middleware,admin}.ts`, `middleware.ts`, `app/[orgSlug]/layout.tsx`, `app/login/{page,login-form}.tsx`, `app/auth/callback/route.ts` — the verbatim copy sources.
- npm registry (2026-07-14): next 16.2.10 (pin ^15.5), react 19.2.7, @supabase/ssr 0.12.3, @supabase/supabase-js 2.110.5, @base-ui/react 1.6.0, tailwindcss 4.3.2, motion 12.42.2, lucide-react 1.24.0 (⚠ pin ^0.546), next-themes 0.4.6.

### Secondary (MEDIUM — verified against official docs)
- Supabase Docs — [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas) & [PGRST106 troubleshooting](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema) — `pgrst.db_schemas` mechanics + the caveat that manual `ALTER ROLE` removes Dashboard schema management.
- Supabase Docs — [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `security_invoker = true` makes a view obey base-table RLS (PG15+).
- Supabase Docs — [`.overlaps()` JS reference](https://supabase.com/docs/reference/javascript/overlaps) — array overlap filter.
- Google Drive embed — [nannyakore.com](https://nannyakore.com/en/blog/google-drive-embed-file-en/), [Latenode community](https://community.latenode.com/t/x-frame-options-blocking-google-drive-pdf-embedding/23291) — `/file/d/ID/preview` iframe needs public share; login page not iframeable.

### Tertiary (LOW — needs live confirmation by executor)
- Live auth-provider state (A1), `auth.users` for the 2 emails (A2), `staff-cvs` object keys/policies (A3/Q2), `pg_trgm` availability (A4) — inferred, must be confirmed via Supabase MCP at execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm + taken from HITO's deployed package.json.
- Architecture (Q1 views / gate / search / CV): HIGH — DDL and RLS read directly; security-invoker + PostgREST overlap verified against official docs; patterns are adaptations of proven HITO code.
- Auth provider state / member seed / storage policy: MEDIUM — inferred from HITO code and Phase-1 notes; flagged as executor pre-checks (A1–A3).
- Pitfalls: HIGH — grounded in Phase-1 REVIEW findings + project PITFALLS.md.

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (stack stable; re-verify npm versions and live auth/storage state at execution)
