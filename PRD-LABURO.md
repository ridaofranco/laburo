# LABURO — Product Requirements Document (PRD)

> ## ⚠️ Read this first (added 2026-09-05)
>
> **This is the ORIGINAL intent document, written before the product grew.** It is
> kept for its historical value: it records what LABURO was meant to be, and the
> decisions in section 6 are still binding. It is **not** the current map.
>
> **What changed since:** this PRD describes **two** actors. The product has
> **five**, and four separate pools (staff, providers, venues, production
> companies). Multi-tenancy, the platform organization, the provider and venue
> marketplaces and the staff portal all arrived afterwards.
>
> **The current map lives in [`ACTORES.md`](./ACTORES.md)** — in Spanish, like the
> rest of the repo. **Where the two disagree, `ACTORES.md` wins.**
>
> **Language:** this PRD stays in English on purpose; translating it whole is a
> separate job and would destroy its value as a record. `ACTORES.md` and
> `README.md` are in Spanish. Please don't "fix" this inconsistency.

## 1. Product Overview

**LABURO** is the staff-hiring app of **SOMOS DER**. It lets an event operator (Franco)
find, hire and manage temporary event staff (crew) end-to-end in a single flow, without
falling back to a Google Sheet or manual WhatsApp.

It is an **independent product with its own database** that runs on its own, and is
**optionally integrated with HITO** (SOMOS DER's event-management app). It has its own
workers, its own events/gigs and its own crew. When a gig is flagged as a HITO event, an
accepted offer is also pushed into HITO as a `crew_member` + `crew_assignment`.

**Core value:** Franco finds and hires real staff for a real event inside one app.
The HITO integration is an optional bridge, not a requirement for the app to work.

Long-term vision: a multi-employer marketplace for temporary event staff.

## 2. Users / Roles

> ⚠️ **This section described two actors. There are five.** What follows is
> corrected; the full map, with routes and permissions, is in
> [`ACTORES.md`](./ACTORES.md).

- **Platform (SOMOS DER):** the organization that owns the product. Marked by
  `es_plataforma = true` on its row — a column, not a role (migration `0044`).
  Sees every organization, moderates providers and venues, and reads
  cross-tenant profitability. The real gate is `is_platform_admin()` **inside
  the database functions**, not in the UI.
- **Production company (client):** a tenant organization with its own members.
  Open self-signup — nobody approves anything. Publishes events, searches the
  staff pool, sends offers, hires. Roles inside an organization are `owner`,
  `writer` and `viewer`, and the role is **per organization**.
- **Staff / Candidate (worker):** applies through a public form, receives an
  offer via a **magic link**, and accepts or declines it **without creating an
  account**. Separately, and only if they ask for it, they can have an account
  with a staff portal (jobs, check-in, profile). The rule for when one becomes
  the other is written in [`PRUEBAS.md`](./PRUEBAS.md), section 6.
- **Provider:** sells services for events. Open self-signup. **Never has a
  password** — always enters through a magic link. Has a public listing.
- **Venue:** the space where the event happens. Signs up separately and shares
  the provider's door. Has its own public listing.

**Today there are ZERO client production companies.** The product is
multi-tenant with a single tenant.

## 3. Tech Stack

- **Framework:** Next.js 15.5 (App Router), React 19, TypeScript 5.
- **Data / Auth:** Supabase (Postgres + Auth), `@supabase/ssr`, RLS on every table.
  Public magic-link pages use `SECURITY DEFINER` RPCs by token.
- **UI:** Tailwind CSS v4, Base UI (`@base-ui/react`), lucide-react icons, `sonner`
  toasts, `next-themes` (dark/light), Motion for animations.
- **Email:** nodemailer + @react-email/components over the SOMOS DER SMTP (zero paid ESP).
- **Hosting:** Vercel (Hobby). Runs locally at `http://localhost:3000`.

## 4. Key Screens & Routes

### Public / auth
- `/login` — operator login.
- `/sumate` — public "join us" staff registration form.
- `/acceso-staff` — staff access entry point.
- `/onboarding-staff` — staff onboarding flow.
- `/editar-perfil-staff` — staff profile editing.
- `/panel-staff` — staff panel/home.
- `/o/[token]` — **public magic-link offer page** (view + accept/decline an offer, no login).
- `/fichaje` — staff check-in / clock-in (time tracking).
- `/auth/callback` — Supabase auth callback.
- `/dev-login`, `/dev-login-staff` — local development login helpers.

### Operator portal `(portal)`
- `/dashboard` — operator home / overview.
- `/tablero` — gigs board; `/tablero/nuevo` create gig; `/tablero/[gigId]` gig detail;
  `/tablero/[gigId]/editar` edit gig.
- `/buscar` — search & filter the candidate pool by role and availability.
- `/staff` — staff list; `/staff/[id]` candidate profile;
  `/staff/[id]/oferta` — create/send an offer to a candidate.
- `/calendario` — calendar of gigs/events.
- `/pagos` — payments; `/billetera` — wallet; `/rentabilidad` — profitability.
- `/mensajes` — messages; `/notificaciones` — notifications.
- `/favoritos` — saved/favorite candidates.
- `/confirmacion` — confirmation screens.
- `/config` — settings.

### API
- `/api/parse-cv` — parse an uploaded CV.
- `/api/cron/reminders` — scheduled reminders.

## 5. Core User Flows

### Flow A — Operator hires staff (happy path)
1. Operator logs in at `/login`.
2. Creates a gig at `/tablero/nuevo` (role, dates, pay, location; can flag as HITO event).
3. Searches the pool at `/buscar` filtering by role and availability.
4. Opens a candidate at `/staff/[id]`, reviews profile/CV.
5. Sends an offer at `/staff/[id]/oferta` (pay + dates). An email with a magic link goes out.
6. Tracks the offer status on the dashboard: **sent → viewed → accepted / declined / expired**.

### Flow B — Staff accepts an offer (magic link, no account)
1. Staff receives the email and opens `/o/[token]`.
2. The page loads the offer via `get_public_offer(token)` (valid token, not expired, still open).
3. Staff accepts (or declines). On accept, `accept_offer(token)` atomically flips status and
   creates the crew member + assignment; if the gig is a HITO event, it is pushed to HITO.
4. Staff is now contracted crew of the app.

### Flow C — Staff onboarding & profile
1. A worker applies via the public `/sumate` form.
2. Completes `/onboarding-staff`.
3. Can edit their data at `/editar-perfil-staff` and see `/panel-staff`.
4. On an event day, clocks in via `/fichaje` (time tracking).

## 6. Business Rules / Constraints

- **Zero paid services** — free tiers only (Supabase, Vercel Hobby, own SMTP).
- **LABURO charges nobody** (decided 2026-09-02, added here 2026-09-05). It is free
  for every actor: no commission, no access fee. The MercadoPago flow is fully
  built and **switched off by a flag** in `lib/cobros.ts` — a commercial decision,
  not a missing feature. This PRD never claimed otherwise, but the codebase used
  to say the charge "already works"; it does not, on purpose.
- **Independence** — the app owns its data and runs without HITO; the HITO bridge is optional per gig.
- **Security** — RLS mandatory on every table; public access only via `SECURITY DEFINER`
  token functions with a fixed `search_path`; magic-link tokens expire (e.g. 7 days).
- **Offer state machine** — `sent`, `viewed`, `accepted`, `declined`, `expired`
  (`viewed` set on first offer-page load; `expired` derived from the token expiry).
- **Mobile-first** — both operator and staff operate primarily from a phone.

## 7. Success Criteria

- Operator can complete the full **create gig → search → send offer → offer accepted** cycle
  inside the app without leaving for the Sheet or WhatsApp.
- A staff member can accept an offer from the magic link **without creating an account**.
- Offer status is accurately tracked and displayed to the operator.
- All authenticated data access is correctly scoped by RLS (org isolation).
