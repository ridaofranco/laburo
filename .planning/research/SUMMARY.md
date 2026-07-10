# Project Research Summary

**Project:** Staff App (nombre pendiente — familia "by DER")
**Domain:** Mobile-first event-staffing web app — internal hiring dashboard (v1) + public no-auth magic-link accept/decline pages, on an existing Supabase (HITO) data layer, zero-budget
**Researched:** 2026-07-10
**Confidence:** HIGH

## Executive Summary

This is a narrow ATS-lite, not a workforce-management suite. The comparables (Nowsta, Ubeya, Instawork, LASSO) are full scheduling/timesheet/payroll platforms; SOMOS DER's v1 is one slice of that: filter a real candidate pool (`staff_profiles`, 146 rows already live), send one job offer, get a yes/no via a no-account magic link, and land the hire straight into HITO's existing `crew_members`/`crew_assignments` tables. All four research tracks converge on the same architecture: a **standalone Next.js 15 app** (not Astro, not a module inside the sprawling, unlaunched `HITO-by-DER` repo) that talks to the **same shared Supabase project** as the single source of truth, reusing HITO's proven patterns (Supabase SSR auth, org-scoped RLS, `SECURITY DEFINER` token RPCs, SMTP mailer) by copy-paste rather than import.

The single biggest risk is not technical — it's the one already proven true by this exact codebase: Franco built HITO to ~40 sections and never launched it. Everything in the research (features, architecture, pitfalls) is built around avoiding a repeat: ship the thinnest vertical slice (search → offer → accept → crew record) before any breadth, and treat "1 real hire + Franco stops opening the Sheet" as the only definition of done. The secondary risk cluster is technical-but-high-blast-radius: `staff_profiles` is a *live production table* fed by a public anon-insert web form, so the multi-tenant migration must be done as an expand-migrate-contract (nullable column → trigger default → backfill → NOT NULL), gated behind resolving Franco's unconsolidated Google accounts/orgs first. On top of that, the magic-link token is the entire security boundary of the accept flow (no login exists) — it must be a hashed, expiring, single-use token behind a POST-only accept (never GET, or WhatsApp/email link-preview bots will "accept" offers on their own), and every `SECURITY DEFINER` function needs `search_path` pinned and per-row scoping or it becomes an anon superuser hole.

The recommended build order is data-first: harden the shared Supabase schema and RPCs (SQL-tested before any UI exists), then scaffold the authenticated app shell, then the read-side dashboard (search/profile/CV), then offer creation + sending (email deliverability is a first-class deliverable here, not an afterthought — DNS/SPF/DKIM/DMARC must be verified before the first real send), then the public accept page wired to the pre-tested RPCs, then polish. Confidence is high across all four research areas because the architecture and stack conclusions are grounded in directly-read HITO source code and live migrations, not just documentation — the main open gaps are Franco's org consolidation (unresolved, blocks the data migration) and the exact live column list of `staff_profiles` (owner-stated, not queried).

## Key Findings

### Recommended Stack

Build a **standalone Next.js 15.5 (App Router) + React 19 + TypeScript** app that mirrors the HITO stack exactly so its Supabase clients, auth gate, mailer, and UI primitives can be copied verbatim rather than re-solved. Data access uses **`@supabase/supabase-js` (RLS-enforcing, user's JWT) as the only runtime query path** — Drizzle is explicitly ruled out for tenant-scoped reads/writes because its typical service-role connection bypasses RLS, which would silently defeat org isolation; Drizzle (or plain SQL migrations) is fine for schema/migrations only. The public accept/decline flow does **not** use Supabase Auth magic links (that creates auth users, contradicting "staff sin cuenta") — instead it replicates HITO's proven opaque-token + `SECURITY DEFINER` RPC pattern (`get_public_offer`, `accept_offer`), generated Postgres-side with `gen_random_bytes(32)`.

**Core technologies:**
- **Next.js 15.5 + React 19**: full-stack framework for an authenticated dashboard + public token pages — matches HITO exactly, so its SSR clients/middleware/UI are copy-paste, not net-new design.
- **@supabase/supabase-js + @supabase/ssr**: the entire multi-tenant security model — RLS (`is_org_member`/`is_org_writer`) enforced automatically because the client carries the real user's JWT.
- **Tailwind 4 + @base-ui/react + Motion**: HITO-parity UI stack, mobile-first utilities, headless accessible primitives; Motion per the user's global animation preference.
- **nodemailer + @react-email**: zero-cost transactional email via the existing DER Ferozo SMTP — no paid ESP needed for v1.
- **wa.me deep link**: no library — just a built URL; the deliverability fallback and the channel staff actually live on.

### Expected Features

This is "filter a pool → send one offer → get a yes/no," not a scheduling suite. Almost everything the big staffing platforms bundle (clock-in, timesheets, payroll, shift-swapping) is explicitly out of scope because HITO owns crew data and Franco's pay circuit stays manual.

**Must have (table stakes):**
- Candidate search by role/oficio + basic availability (v1 realistic version = "not already assigned to an overlapping event," not true calendar availability)
- Candidate profile view with CV (signed URL from the private `staff-cvs` bucket)
- Create job offer (event, role, dates, informational pay) tied to a HITO event
- Send via automated email + one-tap pre-filled `wa.me` link
- Magic-link accept/decline, no account
- Offer status tracking (sent/viewed/accepted/declined/expired), visible to Franco
- On-accept → atomic write of `crew_member` + `crew_assignment` into HITO
- `staff_profiles` multi-tenant migration (structurally table-stakes — everything else depends on it)

**Should have (competitive, cheap, high daily value):**
- Favorites flag + private internal notes on candidates
- Offer expiry + a single auto-reminder (needs a scheduled runner — the one piece of always-on infra beyond request/response)
- Semi-manual backup/next-candidate queue on decline/expiry

**Defer (v2+):**
- Staff login/worker panel — conflicts directly with the magic-link zero-friction bet, don't build both
- Full scheduling/rostering calendar, time-tracking/clock-in, real payment/payroll processing
- Multi-employer marketplace, MeCubro insurance integration, official WhatsApp Business API, AI matching (needs volume/history data this pool doesn't have yet)
- Post-event rating capture (valuable but only compounds at scale — seed it in v1.x)

### Architecture Approach

**Standalone app, shared Supabase.** New repo, new Vercel project, talking to the existing HITO Supabase project as the single source of truth — copying (not importing) HITO's auth gate, org pattern, mailer, and token-accept RPC. The dominant reason: HITO itself is the evidence that bolting a must-ship feature into an over-scoped, unlaunched codebase is the highest-probability way to never ship. The ~2-3 days of copy-paste boilerplate this costs is far cheaper than the coupling risk.

**Major components:**
1. **Authenticated dashboard** (`app/[orgSlug]/`) — Franco's search/filter/profile/offer-creation/status-board UI, gated by the copied HITO org-membership layout, all reads/writes going through RLS as the signed-in user.
2. **Public accept pages** (`app/o/[token]/`, top-level, outside the auth gate) — staff view one offer and accept/reject with no account, via `get_public_offer`/`accept_offer` SECURITY DEFINER RPCs.
3. **RPC layer in shared Postgres** — the atomic, security-critical door between anon callers and the DB; `accept_offer` is a single plpgsql transaction that upserts `crew_member` and inserts `crew_assignment` so there's never a half-contracted state.
4. **Email sender + wa.me builder** — copied `mailer.ts` cascade for SMTP send; client-side URL builder for the WhatsApp deep link, no Meta API.

### Critical Pitfalls

1. **Guessable/unexpiring/replayable magic-link token** — the token is the *only* security boundary (no login). Use a 256-bit token, store only its hash, add `expires_at`, and make accept idempotent (a second click never re-inserts crew rows).
2. **State-changing GET request auto-triggered by link-preview bots** — WhatsApp/email clients prefetch URLs to render previews; if "accept" is a GET, bots silently accept offers before a human ever taps. The emailed/wa.me link must only *display* the offer; accept/reject must be a POST from a button tap.
3. **Offer email lands in spam and nothing errors** — SMTP returns 250 OK regardless of inbox placement. Verify SPF/DKIM/DMARC on the Ferozo domain *before* the first real send, and treat `wa.me` as the human-primary deliverability fallback, not a nicety.
4. **Building the marketplace (or org-management UI, or anything in "Out of Scope") before v1 is adopted** — this is the literal HITO failure mode repeating. Multi-tenant means "every row carries `organization_id`," not org-onboarding UI. Hardcode SOMOS DER's org id in v1.
5. **`org_id` migration on a live table with an active public form** — `staff_profiles` receives real anon inserts today. Must be expand-migrate-contract (nullable column + trigger default + backfill + only then NOT NULL), gated behind resolving Franco's unconsolidated Google accounts/orgs, or applicants get lost or orphaned.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Foundation & Multi-Tenant Migration
**Rationale:** Every other feature (search, offers, RLS) assumes `organization_id` exists; this is also the highest-blast-radius work because it touches a live production table with an active public form. Must be SQL-tested before any UI is written.
**Delivers:** `staff_profiles` migrated to multi-tenant (nullable column → trigger default → backfill → RLS), new `offers` table (with `timestamptz` intervals decided up front, not a naive date), hardened anon-insert policy on `staff_profiles`, and the `get_public_offer`/`accept_offer` SECURITY DEFINER RPCs tested directly in SQL with a real token.
**Addresses:** the multi-tenant table-stakes requirement; sets up offer status tracking and the atomic crew-write.
**Avoids:** Pitfall 8 (org migration outage/data loss), Pitfall 7 (anon-insert abuse), Pitfall 6 (SECURITY DEFINER over-broad/mutable search_path), Pitfall 9 (naive scheduling model) — and is blocked by the still-unresolved account/org consolidation (Franco has 2 Google accounts; the real SOMOS DER org data lives under his partner's account), which must be resolved as a prerequisite, not discovered mid-migration.

### Phase 2: App Scaffold & Auth
**Rationale:** Standalone repo needs its own auth shell before dashboard features can be built; this is low-risk, mostly copy-paste from HITO.
**Delivers:** New Next.js 15 repo/Vercel project; copied `lib/supabase/{server,client,middleware,admin}.ts`, login page, `auth/callback`, and the `[orgSlug]/layout.tsx` org gate (i18n routing stripped).
**Uses:** Next.js 15.5, React 19, @supabase/ssr, Tailwind 4, Base UI (stack research).
**Implements:** Dashboard component boundary (architecture research).

### Phase 3: Candidate Search & Profile (Dashboard Read)
**Rationale:** The core daily job — must be demonstrably faster than the Google Sheet on a phone, or Franco reverts and the project dies regardless of what else ships.
**Delivers:** Search/filter over `staff_profiles` by role/oficio + basic availability (not-already-assigned check); profile view with CV via short-TTL signed URL from `staff-cvs`.
**Addresses:** Candidate search, availability filter, candidate profile view (FEATURES.md table stakes).
**Avoids:** Pitfall 5 (adoption — operator flow must beat the Sheet), Pitfall 10 (CV must be signed-URL only, never public).

### Phase 4: Offer Creation & Sending
**Rationale:** Depends only on the scaffold and the data layer; deliverability needs early, dedicated attention since a "successful send" that lands in spam looks identical to success and silently kills the flow.
**Delivers:** Create-offer form + server action (event/role/dates/informational pay); copied `mailer.ts` with SPF/DKIM/DMARC verified on the Ferozo domain before first real send; `wa.me` link builder.
**Uses:** react-hook-form + zod, nodemailer + @react-email (STACK.md).
**Avoids:** Pitfall 3 (email deliverability treated as a first-class deliverable, not an afterthought).

### Phase 5: Magic-Link Accept/Decline
**Rationale:** This closes the loop end-to-end and cannot be trusted until Phase 1's RPCs are SQL-tested — it's the load-bearing security surface with no login to fall back on.
**Delivers:** `/o/[token]` public page wired to `get_public_offer` (display, safe GET) and `accept_offer` (state change, POST-only, idempotent); offer status flips to viewed/accepted/declined.
**Addresses:** Magic-link accept/decline, offer status tracking, on-accept crew write (FEATURES.md table stakes).
**Avoids:** Pitfall 1 (token security — hashed, expiring, single-use), Pitfall 2 (preview-bot auto-accept via GET).

### Phase 6: Status Board, Favorites/Notes & Polish
**Rationale:** Everything Franco needs to run his daily workflow entirely in-app instead of returning to the Sheet, once the core cycle is proven end-to-end.
**Delivers:** Offer status board (sent/viewed/accepted/declined/expired at a glance), favorites flag + private notes on candidates, mobile-first pass, Motion micro-interactions.
**Addresses:** Offer status visibility, favorites/notes (FEATURES.md differentiators).

### Phase Ordering Rationale

- Data layer must come first because it's both the dependency root (everything assumes `organization_id`) and the highest-risk surface (live table, public form, security-critical RPCs) — testing it in isolation before any UI exists de-risks every later phase.
- Search/profile before offer-send/accept because the search UX is the actual adoption test (Pitfall 5) and doesn't depend on email or tokens being solved yet.
- Offer send is deliberately separated from magic-link accept so email deliverability (DNS, SPF/DKIM/DMARC) gets dedicated attention rather than being bundled into "send an offer" as an afterthought.
- Status board/favorites/polish is last and explicitly scoped to avoid the HITO trap — nothing off the critical path (search → offer → accept → crew record) ships before that path works end-to-end with one real hire.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** SECURITY DEFINER hardening and the expand-migrate-contract sequencing are security/data-integrity-critical and org consolidation status is still unresolved going in — worth a dedicated `--research-phase` pass on RLS policies and the migration order.
- **Phase 5:** Magic-link token design (hashing, expiry, idempotency, forward-resistance) is the single highest-stakes security surface in the whole app with no prior in-house pattern beyond HITO's `accept_proposal` — verify that template itself before cloning it.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Pure copy-paste from a working, directly-read HITO codebase (auth gate, SSR clients, middleware) — low ambiguity.
- **Phase 3:** Standard CRUD search/filter/profile-view pattern, well-precedented in HITO's own `crew` section.
- **Phase 6:** Status board and favorites/notes are simple, low-risk UI features with no novel security or data model questions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified directly against HITO's `package.json` (deployed, proven stack) plus live npm registry versions; PROJECT.md constraints cross-checked. |
| Features | MEDIUM-HIGH | Comparables verified against vendor product pages (Nowsta, Ubeya, Instawork, LASSO, etc.), but offer-flow specifics are vendor marketing, not documentation — treat exact mechanics as directional. |
| Architecture | HIGH | Read directly from `/Users/fridao/Proyectos/HITO-by-DER-main` source (auth gate, crew actions, token-accept migration `00008_proposal_acceptance.sql`); MEDIUM only on the exact `staff_profiles` column list, which comes from PROJECT.md (owner-stated) rather than a live query. |
| Pitfalls | HIGH (Supabase security, deliverability, over-scoping) / MEDIUM (Argentina PDPA specifics) | Over-scoping risk is corroborated by Franco's own HITO history, not inference. Ley 25.326 text is stable and HIGH, but a 2025 GDPR-aligned modernization bill is mid-process in Congress — build to current law, don't assume the reform. |

**Overall confidence:** HIGH

### Gaps to Address

- **Org/account consolidation is unresolved** (Franco has 2 Google accounts; the real SOMOS DER org with live data sits under his partner's account) — this blocks the Phase 1 data migration and must be resolved or at minimum have a fixed target `organization_id` before backfilling 146 real applicants.
- **Exact `staff_profiles` column list is MEDIUM confidence** (29 cols per PROJECT.md, not a live Supabase query) — verify with `list_tables`/a live query at the start of Phase 1 before writing the migration.
- **Ferozo SMTP deliverability is untested** — no mail-tester/Postmaster data exists yet; treat Phase 4's DNS verification as the first real test, not an assumption.
- **PII/consent notice on the existing web form** is likely missing or incomplete under Ley 25.326 — this is a live-now obligation (the form already collects CVs in production), not a v2 concern; flag for a quick fix alongside Phase 1's RLS hardening.

## Sources

### Primary (HIGH confidence)
- `/Users/fridao/Proyectos/HITO-by-DER-main/` — directly read: auth gate, crew actions, `lib/supabase/*`, `lib/email/mailer.ts`, `lib/events/modules.ts`
- `supabase/migrations/00008_proposal_acceptance.sql`, `00018_crew_payroll.sql` — the exact SECURITY DEFINER accept pattern and `crew_assignments` shape being cloned
- npm registry (live, 2026-07-10) — verified current package versions
- Supabase Docs — Row Level Security, Database Advisors (`function_search_path_mutable`)
- `.planning/PROJECT.md` — constraints, requirements, HITO history

### Secondary (MEDIUM confidence)
- Vendor product pages (Nowsta, Ubeya, Instawork, LASSO, Rosterfy, Qwick, Connecteam) — feature landscape and comparables
- Supabase community discussions on SECURITY DEFINER/RLS bypass; AuditYour.App RPC security guide
- Ley 25.326 (Infoleg) — stable HIGH on law text, MEDIUM on 2025 reform status (bill in process, not enacted)

### Tertiary (LOW confidence)
- None flagged — all findings traced to at least a secondary source or direct code read

---
*Research completed: 2026-07-10*
*Ready for roadmap: yes*
