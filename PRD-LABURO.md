# LABURO — Product Requirements Document (PRD)

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

- **Operator / Admin (Franco):** logs into the internal portal, searches the candidate
  pool by role and availability, views profiles/CVs, creates gigs, sends paid offers,
  and tracks offer status. Operates mostly from the phone (mobile-first).
- **Staff / Candidate (worker):** applies through a public form, completes an onboarding,
  edits their staff profile, receives an offer via a **magic link** (no account needed),
  and accepts or declines it. On accept, they become crew of the app.

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
