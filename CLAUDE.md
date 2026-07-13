<!-- GSD:project-start source:PROJECT.md -->

## Project

**Staff App (nombre pendiente — familia "by DER")**

App de contratación de staff eventual para eventos — **producto independiente con base de datos propia**, que corre por su cuenta y a la vez está **integrado a HITO** (no fusionado). Tiene sus propios trabajadores, sus propios eventos/gigs y su propio crew. En v1 es la herramienta interna de SOMOS DER: Franco busca personal por rol y disponibilidad sobre su pool real de postulantes, ve el perfil/CV, manda una oferta con pago y fechas, y la persona acepta con un link mágico — al aceptar queda contratada como crew **de la app**. Si ese gig está marcado como evento de HITO, además se empuja a HITO como `crew_member` + `crew_assignment` para gestionarlo/evaluarlo/pagarlo desde HITO. La visión de largo plazo es un marketplace multi-empleador de staff eventual.

**Core Value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual. La integración con HITO es un puente opcional, no un requisito para que la app funcione.

### Constraints

- **Presupuesto**: CERO gasto en servicios pagos — regla dura de Franco (no pagar APIs, no Zapier). Todo en tiers gratis (Supabase nuevo $0, Vercel hobby, SMTP propio, Gemini free tier).
- **Independencia**: la app es dueña de sus datos y corre sin HITO. HITO es un puente OPCIONAL por gig, no una dependencia. (Debe poder correr para un cliente que no tenga HITO.)
- **Integración**: el puente app→HITO es una función/RPC segura de HITO (patrón existente), NO un MCP y NO escritura directa cruda a las tablas de HITO. HITO controla qué se puede escribir.
- **Seguridad**: RLS obligatoria en toda tabla nueva; acceso público (link mágico) solo vía funciones SECURITY DEFINER por token con `search_path` fijado.
- **UX**: mobile-first — Franco y el staff operan desde el teléfono.
- **Animaciones**: librería Motion (`motion`) — preferencia global del usuario.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR Decision

- **Astro is wrong for this** — the core of the app is an authenticated, interactive dashboard (search/filter candidates, offer state machine, server mutations writing to Supabase). That is app-shell territory, Astro's islands model fights it. Astro stays the right tool for `somosder-web` (content + the public `StaffRegistro` form).
- **A module inside `HITO-by-DER` is wrong for v1** — HITO is a ~40-section app Franco considers over-scoped and never launched. Coupling a must-ship product to that repo inherits its weight and its deploy. Standalone ships faster and keeps a clean surface for the future marketplace.
- **Standalone-but-stack-identical is the sweet spot** — same framework, same Supabase clients, same Base UI + Tailwind components, same `nodemailer` email lib. You copy-paste HITO's `lib/supabase/*` SSR clients, its `email.js`, and its UI primitives instead of re-solving them. The write path into `crew_members` / `crew_assignments` is just Supabase RPC calls into the same DB.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js (App Router)** | `15.5.x` (pin `^15.5`, latest backport `15.5.20`) | Full-stack React framework: SSR dashboard + Route Handlers for public token pages + Server Actions for mutations | Matches HITO exactly → copy its Supabase SSR clients, middleware, and Base UI components verbatim. App Router Server Actions are the clean way to do RLS-scoped writes without hand-rolling an API. Runs free on Vercel Hobby. Next 16 is stable (see Alternatives) but 15.5 maximizes HITO parity and de-risks v1. |
| **React** | `19.x` (`^19.2`) | UI runtime | Required by Next 15.5/16 and by Base UI 1.x. Same major as HITO (`^19.0`). |
| **TypeScript** | `~5.8` | Type safety across DB rows, forms, RPC payloads | HITO parity; lets you generate Supabase row types and share them app-wide. |
| **@supabase/supabase-js** | `^2.110` | **Primary data layer** — RLS-aware reads/writes as the signed-in user, RPC calls to `SECURITY DEFINER` token functions | This is the whole security model. The authenticated client carries Franco's JWT so RLS (`is_org_member`/`is_org_writer`) is enforced automatically. The public magic-link pages use the anon client to call `get_public_offer(token)` / `accept_offer(token)` RPCs — identical to HITO's proven `get_public_proposal` / `accept_proposal` pattern. |
| **@supabase/ssr** | `^0.12` | Cookie-based session handling in Next middleware + server components | The supported way to wire Supabase Auth into App Router (server client, browser client, `updateSession` middleware). HITO ships `^0.10`; `0.12` is a drop-in and current. |
| **Tailwind CSS** | `4.x` (`^4.3`) | Styling | HITO uses v4. Mobile-first utilities are exactly what "both Franco and staff on phones" needs. Requires the `@tailwindcss/postcss` plugin (v4 changed the pipeline). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@base-ui/react** | `^1.6` | Headless, accessible UI primitives (dialog, popover, select, etc.) | HITO's UI foundation → reuse its styled wrappers. Note the package moved to `@base-ui/react` (HITO pins `^1.4.1`; `1.6.0` is current). Accessible-by-default matters for the offer dialogs. |
| **lucide-react** | `^0.546` (HITO) / `latest` | Icon set | HITO parity. Note npm has a confusingly-versioned newer line — pin to the HITO range unless you deliberately upgrade. |
| **class-variance-authority** | `^0.7.1` | Component variant styling | Standard shadcn/Base-UI companion; HITO uses it. |
| **clsx** + **tailwind-merge** | `^2.1` / `^3.6` | Conditional + conflict-free class merging (the `cn()` helper) | Copy HITO's `cn()` util directly. |
| **sonner** | `^2.0.7` | Toast notifications ("Oferta enviada", "Aceptada") | HITO uses it; perfect for the offer state-machine feedback. |
| **next-themes** | `^0.4.6` | Dark/light theming | HITO parity; matches the DER dark theme already applied to `app.somosder.ar`. |
| **react-hook-form** | `^7.81` | Form state for the offer-creation form | HITO parity; performant, minimal re-renders on mobile. |
| **zod** | `^4.4` | Schema validation (offer payload, token params, env vars) | Validate on both server action and client. Note: Zod **v4** requires `@hookform/resolvers` **v5+**. HITO already runs Zod 4. |
| **@hookform/resolvers** | `^5.4` | Bridges Zod ↔ react-hook-form | Must be v5 for Zod v4 compatibility. |
| **nodemailer** | `^9.0` (HITO ships `^8`) | Send transactional email through the DER Ferozo SMTP | Zero-cost — reuses the existing `src/lib/email.js` from `somosder-web`. No SendGrid/Resend/Postmark needed. `9.x` is current; `8.x` (HITO) also fine — pin whichever you copy from. |
| **@react-email/components** + **@react-email/render** | `^1.0` | Author the offer email as a React component, render to an HTML string | The free, modern way to build good-looking transactional email. `render(<OfferEmail/>)` returns HTML you hand straight to nodemailer's `html:` field. No paid ESP required. Skip the `react-email` dev/preview package unless you want the local preview server. |
| **date-fns** | `^4.4` | Format/compare offer dates, expiry countdowns | HITO parity; tree-shakeable, good for "vence en 2 días". |
| **motion** | `^12.42` | Animations (user global preference) | Import from `motion/react`. Use sparingly on mobile — micro-interactions on offer accept, list transitions. |

### Magic-Link Token Pattern (the load-bearing security piece)

| Piece | Recommendation | Why |
|-------|----------------|-----|
| Token generation | **Postgres-side**: `encode(gen_random_bytes(32), 'hex')` (or `gen_random_uuid()`) stored on the offer row at insert time | Keeps the secret creation server-authoritative; no app dep needed. `pgcrypto` is already available in Supabase. If you prefer app-side, `crypto.randomUUID()` (built into Node/Next, zero deps) or `nanoid` for shorter URL-safe tokens. |
| Storage | Column `access_token text unique` + `token_expires_at timestamptz` on the offers table | Mirror `proposals`. Optionally store a hash instead of the raw token for defense-in-depth (raw token only in the emailed URL). |
| Expiry | `token_expires_at = now() + interval '7 days'` (or per-offer) | Checked inside the RPC, not in app code, so it can't be bypassed. |
| Read access | `SECURITY DEFINER` function `get_public_offer(p_token text)` returning the offer + candidate view **only if** token matches and `now() < token_expires_at` and status is still open | Exactly HITO's `get_public_proposal`. RLS stays on; the function is the single controlled door. |
| Write access | `SECURITY DEFINER` function `accept_offer(p_token text)` / `decline_offer(p_token text)` that validates token+expiry+status, flips offer status, and (on accept) inserts `crew_member` + `crew_assignment` atomically, tagged with `organization_id` | Mirror `accept_proposal`. Single transaction = no half-contracted state. `GRANT EXECUTE ... TO anon` on these functions only. |
| Status tracking | Offer `status enum('sent','viewed','accepted','declined','expired')`; set `viewed` on first `get_public_offer` hit | Powers the "enviada / vista / aceptada / rechazada / vencida" column in Franco's dashboard. `expired` is derived (`now() > token_expires_at`) — compute in a view or on read, no cron needed. |

### wa.me Deep Link (no library)

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vercel (Hobby)** | Hosting + preview deploys | Free tier; CLI already logged in (`ridaofranco-8135`). Set env vars for Supabase URL/anon key, service-role (server-only), SMTP creds, `GEMINI_API_KEY`. |
| **drizzle-kit** (optional) | `0.31.x` — schema-as-code + migration generation | Optional. See "Data access" note below — use Drizzle for **migrations/typegen only**, not as the runtime query path. If you prefer, manage schema via Supabase SQL migrations and skip Drizzle entirely for a lighter app. |
| **Supabase CLI** | Local migrations, RPC/RLS testing before touching the live HITO DB | Strongly recommended — test the new `SECURITY DEFINER` functions and the `staff_profiles` multi-tenant migration locally first. HITO is production data. |
| **@tailwindcss/postcss** + **autoprefixer** | Tailwind v4 build pipeline | Required with Tailwind v4. |
| **vitest** / **@playwright/test** | Unit + e2e (optional for v1) | HITO parity. For v1, one Playwright happy-path test of the full offer→accept cycle is worth more than broad coverage. |

## Data Access: Supabase JS vs Drizzle (explicit ruling)

- **RLS is your entire multi-tenant security model.** The Supabase JS client (with the user's JWT) executes queries *as that user*, so `is_org_member`/`is_org_writer` policies are enforced by Postgres automatically. Drizzle connects via a direct `postgres` connection string that typically uses the **service role / owner**, which **bypasses RLS**. Routing tenant reads/writes through Drizzle would silently defeat the org-isolation the PROJECT mandates from day 1.
- **The magic-link flow *requires* supabase-js.** Public token pages call `SECURITY DEFINER` RPCs via `supabase.rpc('accept_offer', { p_token })` on the anon client. There's no Drizzle equivalent that fits this pattern cleanly.
- **HITO uses both, but for different jobs** — Drizzle for schema/migrations, supabase-js for RLS-scoped app data. Copy that split, and keep any Drizzle usage to `db:generate`/`db:migrate` and type generation. For a solo zero-budget v1, you can even skip Drizzle and write SQL migrations directly in Supabase.

## Installation

# Scaffold (matches HITO)

# Core data + auth

# UI (HITO parity — lets you copy its components)

# Forms + validation

# Email (own SMTP, zero cost)

# Dates

# Dev

# Optional: migrations/typegen only (not the runtime query path)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js 15.5** | **Next.js 16.2** (current stable latest) | If you decide HITO parity matters less than being on latest, Next 16 is stable and works with React 19. But 16 introduces breaking changes (caching/config); for a fast v1 that reuses HITO code, 15.5 is lower-risk. Upgrade path to 16 stays open. |
| **Next.js** | **Astro (islands)** | Only if the app were mostly static content with sprinkles of interactivity. It isn't — it's a dashboard with server mutations and auth. Keep Astro for `somosder-web`. |
| **Standalone app** | **Module inside `HITO-by-DER`** | If v2 marketplace consolidation happens and you want one codebase. Not for v1 — inherits HITO's over-scoped weight and shared deploy risk. |
| **Supabase JS (runtime)** | **Drizzle (runtime)** | Never for tenant-scoped data (bypasses RLS). Drizzle is fine for migrations/typegen only. |
| **@react-email + nodemailer** | **Resend / SendGrid / Postmark** | Only if deliverability of the Ferozo SMTP proves poor at volume. Paid → violates zero-budget rule for v1. Revisit only if emails land in spam. |
| **Custom token + SECURITY DEFINER** | **Supabase Auth magic link (OTP)** | Never for the staff flow — it creates auth users, contradicting "staff sin cuenta". Supabase Auth magic link *is* fine for **Franco's** admin login if he prefers passwordless. |
| **crypto.randomUUID / pg gen_random_bytes** | **nanoid / jsonwebtoken (JWT)** | `nanoid` if you want shorter prettier URLs. Avoid signed JWTs here — opaque DB-stored tokens are simpler, revocable (delete the row), and match HITO. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Astro for the app** | Islands model fights an auth'd interactive dashboard with server mutations | Next.js App Router |
| **Drizzle/`postgres` as the tenant runtime query path** | Direct connection bypasses RLS → breaks multi-tenant isolation | `@supabase/supabase-js` with the user's JWT |
| **Supabase Auth magic link for staff** | Creates auth accounts; v1 requires "staff sin cuenta" | Opaque token + `SECURITY DEFINER` RPC (HITO pattern) |
| **Paid ESP (Resend/SendGrid)** | Violates zero-budget constraint | `nodemailer` + existing DER Ferozo SMTP |
| **WhatsApp Business Cloud API** | Per-conversation cost + template approval | `wa.me` deep link (one tap, manual send) |
| **Writing to HITO's crew tables from the app** | ARCHITECTURE REVISION 2026-07-13: the app owns its data; HITO is an optional link deferred to Phase 6 | App-own `crew` table; HITO push only via the Phase 6 bridge |
| **Sharing HITO's database** | SUPERSEDED (2026-07-13): the app has its OWN Supabase project (org `wsvqlrjmizvivgrgnfpw`, $0) — .planning/ docs win over any older note here | App-own schema: `staff_profiles`, `gigs`, `crew`, `offers` |
| **Client-side service-role key** | Full DB access leaked to the browser | Service role only in server actions/route handlers; anon key client-side |
| **Zod v3 + resolvers v4** | Version mismatch with Zod v4 | Zod v4 + `@hookform/resolvers` v5 |

## Stack Patterns by Variant

- Use Supabase Auth email OTP / magic link for the *internal dashboard only* (Franco's account), gated by RLS org membership.
- Because it's zero-friction for a single internal user and doesn't affect the staff no-auth flow.
- Keep `@react-email` templates, swap only the transport — nodemailer → a free-tier ESP later is a one-line transport change.
- Because the templating layer stays decoupled from the sending layer.
- The org-scoped schema + `SECURITY DEFINER` token pattern already generalize; add employer onboarding + billing as new orgs.
- Because "multi-tenant desde el día 1" was designed for exactly this — configuration, not rewrite.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@15.5 / next@16 | react@19 | Both require React 19; don't pair with React 18. |
| @base-ui/react@1.x | react@19 | Base UI 1.x targets React 19. Package name is `@base-ui/react` (not the old `@base-ui-components/react`). |
| tailwindcss@4 | @tailwindcss/postcss | v4 requires the PostCSS plugin; v3 config/`postcss.config` won't work unchanged. |
| zod@4 | @hookform/resolvers@5 | resolvers v4 does not support Zod v4. |
| drizzle-orm@0.45 | drizzle-kit@0.31 | HITO's pairing; keep aligned. |
| @react-email/render | nodemailer@8/9 | `render()` → HTML string → nodemailer `html:`; transport-agnostic. |
| @supabase/ssr@0.12 | @supabase/supabase-js@2 | Use together for App Router cookie sessions. |

## Sources

- `HITO-by-DER-main/package.json` — authoritative reference for the proven, deployed stack (Next 15.5, React 19, Supabase SSR, Base UI, Tailwind 4, nodemailer, Motion, Zod 4, RHF) — HIGH
- `.planning/PROJECT.md` — constraints (zero-budget, RLS mandatory, `SECURITY DEFINER` token pattern, single Supabase source of truth, HITO crew tables) — HIGH
- npm registry (live, 2026-07-10) — verified current versions: next 16.2.10 (15.5.20 backport), react 19.2.7, @supabase/ssr 0.12.0, @supabase/supabase-js 2.110.2, @base-ui/react 1.6.0, tailwindcss 4.3.2, zod 4.4.3, @hookform/resolvers 5.4.0, nodemailer 9.0.3, @react-email/components 1.0.12, motion 12.42.2, drizzle-orm 0.45.2 — HIGH
- Supabase `SECURITY DEFINER` + RLS pattern — verified against HITO's existing `register_web_lead` / `get_public_proposal` / `accept_proposal` functions cited in PROJECT.md — HIGH

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
