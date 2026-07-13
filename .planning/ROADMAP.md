# Roadmap: Staff App (by DER)

## Overview

Revised 2026-07-13 (Franco's direction): **the app is a standalone work/hiring app first — ALL HITO integration is deferred to the final phase.** The app owns its Supabase database (staff, gigs, crew, offers) and delivers Franco's core value one load-bearing layer at a time: first the data foundation and hardened magic-link RPCs (SQL-proven before any UI), then a phone-first way to find the right person from the real 146-applicant pool, then turning a candidate into an offer tied to an app gig, then the no-account accept that lands the hire as crew in the app, then the status board + extras + production ship with one real hire. Only after the app works end to end does Phase 6 make it **linkable to HITO** — by whatever mechanism proves right (the researched default is a DB-level SECURITY DEFINER bridge; API alternatives may be reconsidered then).

Structure is derived from the build order (own data first, critical path before breadth) and the #1 documented risk: over-scoping. Everything off the search → offer → accept → crew-record path waits until that path works with one real hire. The app must run for a client with no HITO at all — HITO is an optional link, never a dependency, and never a reason to slow the app down.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Own Data Foundation** - App's own Supabase (staff/gigs/crew/offers) + form repoint + 146 backfill + SQL-tested magic-link RPCs
- [ ] **Phase 2: Find Staff** - App scaffold + phone-first search/filter and profile/CV view over the app's own pool
- [ ] **Phase 3: Create & Send Offers** - Offer tied to an app gig, auto-email with magic link + one-tap wa.me
- [ ] **Phase 4: Accept & Close the Loop** - No-account accept/decline that atomically creates crew in the app, with per-offer status
- [ ] **Phase 5: Status Board, Extras & Real Hire** - Coverage board, favorites/notes, expiry+reminder, ratings, production ship + 1 real hire
- [ ] **Phase 6: HITO Link (optional bridge)** - Link a gig to a HITO event and push confirmed crew into HITO — mechanism chosen when we get here

## Phase Details

### Phase 1: Own Data Foundation
**Goal**: The app has its own Supabase database owning staff/gigs/crew/offers and a secure single-use magic-link offer lifecycle — all proven directly in SQL before any UI exists, and without ever breaking the live web intake.
**Mode:** mvp
**Depends on**: Nothing (first phase). Prerequisite: exact `staff_profiles` columns verified via live query before backfilling the 146 real applicants.
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. The app's own Supabase project exists ($0) with its own org-scoped, RLS-enabled schema — `staff_profiles`, `gigs` (with a nullable `hito_event_id` kept as a cheap future-link reference), `crew`, `offers` — and no table is readable by anon directly.
  2. The somosder-web "Trabajá con nosotros" form (+ CV upload) writes into the APP database and its CV bucket, with zero downtime during the cutover; the existing 146+ applicants are copied into the app DB and verified with no loss.
  3. Calling `get_public_offer` / `accept_offer` / `decline_offer` against a real token in SQL behaves correctly in the APP DB: accept atomically creates crew in the app, is single-use/idempotent, rejects expired or replayed tokens, tokens are 256-bit and hashed at rest, and `get_advisors` reports no `function_search_path_mutable` or RLS findings.
**Plans**: TBD

Plans:
- [ ] 01-01: New app Supabase project + own schema (`staff_profiles`, `gigs` w/ nullable `hito_event_id`, `crew`, `offers`), org-scoped with RLS from day 1 (DATA-01)
- [ ] 01-02: Repoint somosder-web form + CV bucket to the app DB (no downtime) and backfill the 146+ applicants, verified (DATA-02, DATA-03)
- [ ] 01-03: App magic-link RPCs (`get_public_offer`/`accept_offer`/`decline_offer`, SECURITY DEFINER, hashed token) — all SQL-tested (DATA-04)

### Phase 2: Find Staff
**Goal**: Franco can log into a phone-first standalone app and find the right candidate from the app's own 146-applicant pool faster than the Google Sheet.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Franco can log in and land on an org-scoped dashboard (auth gate + Supabase SSR clients copied from HITO's codebase patterns), with the server talking to the app's own DB.
  2. Franco can search/filter the app's own `staff_profiles` pool by role/oficio (multi-select over the 64 oficios) plus free text and see matching candidates.
  3. Franco can filter out candidates already assigned to an overlapping gig in the app, with a manual availability note.
  4. Franco can open a candidate profile (data, oficios, experience, links, status) and view/download the CV via a short-TTL signed URL from the app's private CV bucket.
  5. The full search-to-profile flow is usable one-handed on a phone.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: Standalone Next.js 15 scaffold + auth gate / org layout copied from HITO patterns, app-DB server config
- [ ] 02-02: Search + filter over the app's `staff_profiles` (role/oficio multi-select, text, availability), mobile-first
- [ ] 02-03: Candidate profile page + CV signed-URL view from the app bucket

### Phase 3: Create & Send Offers
**Goal**: Franco can turn a chosen candidate into a job offer tied to an app gig and get it into the person's hands by email and WhatsApp in one flow.
**Mode:** mvp
**Depends on**: Phase 2 (and Phase 1 `offers`/RPCs)
**Requirements**: OFER-01, OFER-02, OFER-03
**Success Criteria** (what must be TRUE):
  1. Franco can create an offer tied to an app gig (pick an existing gig or quick-create one) with role, dates, informational amount, and conditions, scoped to org + candidate. (HITO event linking arrives in Phase 6 — gigs stay unlinked here.)
  2. Submitting the offer automatically sends an email via the DER SMTP mailer containing the magic link.
  3. Franco gets a one-tap wa.me button with a pre-filled message (offer summary + same link) to reinforce over WhatsApp.
  4. Franco sees honest send feedback (sending / sent / failed), never a silent 250-OK success.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: Create-offer form + server action (app gig pick/quick-create, role, dates, amount, conditions)
- [ ] 03-02: Copied `mailer.ts` send with honest state + wa.me link builder

### Phase 4: Accept & Close the Loop
**Goal**: A candidate can accept or decline the offer from the link with no account; an acceptance creates crew **in the app** atomically — closing the hire loop end to end inside the app.
**Mode:** mvp
**Depends on**: Phase 3 (and Phase 1 RPCs)
**Requirements**: ACPT-01, ACPT-02, ACPT-03, STAT-01
**Success Criteria** (what must be TRUE):
  1. The candidate can open the magic link on their phone and see the offer (role, gig, dates, amount, conditions) without creating an account.
  2. The candidate accepts or declines via an explicit button POST; email/WhatsApp link-preview bots cannot trigger acceptance (no state-changing GET).
  3. On accept, crew is created atomically in the APP; a second tap never double-books.
  4. Franco sees each offer's status flip to viewed / accepted / rejected as it happens.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Public `/o/[token]` page — `get_public_offer` display (safe GET) + viewed tracking + status reflection (ACPT-01, ACPT-02 read side, STAT-01)
- [ ] 04-02: Accept/decline POST → `accept_offer` creates app crew atomically, idempotent (ACPT-02 write side, ACPT-03)

### Phase 5: Status Board, Extras & Real Hire
**Goal**: Franco runs his entire hiring workflow in-app — seeing role coverage per gig, managing candidates, handling rejections — and ships one real hire to production.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: STAT-02, XTRA-01, XTRA-02, XTRA-03, XTRA-04, SHIP-01, SHIP-02
**Success Criteria** (what must be TRUE):
  1. Franco sees an offer board per gig showing which roles are covered vs open, with each offer's status (sent/viewed/accepted/rejected/expired).
  2. Franco can favorite candidates and add private org-scoped notes never visible to the candidate.
  3. Offers expire on their configured date and send exactly one auto-reminder email before expiry (free Vercel cron); on reject/expiry Franco returns in one tap to the filtered list minus already-offered candidates.
  4. Franco can rate staff post-event (1-5 + note).
  5. The app is deployed to production on its own Vercel project with SPF/DKIM verified, and one real person has been found, offered, accepted via the link, and recorded as crew in the app.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Offer status board per gig (coverage view) (STAT-02)
- [ ] 05-02: Favorites + private notes, next-candidate re-filter, post-event rating, expiry/reminder cron (XTRA-01, XTRA-02, XTRA-03, XTRA-04)
- [ ] 05-03: Vercel deploy + SPF/DKIM verification, then 1 real end-to-end hire in the app (SHIP-01, SHIP-02)

### Phase 6: HITO Link (optional bridge)
**Goal**: A gig in the app can be linked to a real HITO event and a confirmed hire flows into HITO (`crew_member` + `crew_assignment`) — without the app ever depending on HITO to function.
**Mode:** mvp
**Depends on**: Phase 4 (accept loop working); ideally after Phase 5 (app shipped and validated). Prerequisite: Franco's account/org consolidation resolved (or a fixed target HITO org/event chosen) before the bridge pushes crew.
**Requirements**: BRDG-01, BRDG-02, BRDG-03
**Success Criteria** (what must be TRUE):
  1. A HITO-side receiver exists (researched default: SECURITY DEFINER function; the mechanism — RPC/API/other — is confirmed at phase start) that creates `crew_member` + `crew_assignment` atomically in the correct HITO org/event, idempotent, token/service-authenticated, proven in SQL.
  2. Franco can link an app gig to an existing HITO event (the app reads the HITO event list); a gig can also stay unlinked.
  3. On accept of a linked gig, the app calls the bridge and stores the returned `hito_event_id` / `hito_crew_member_id`; unlinked gigs make no call; a bridge failure never loses the app-side hire (retryable).
**Plans**: TBD

Plans:
- [ ] 06-01: HITO-side receiver function + HITO event read, SQL-tested (BRDG-01, BRDG-02)
- [ ] 06-02: Gig↔HITO-event link UI + accept-time bridge call with stored refs + retry (BRDG-03)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Own Data Foundation | 0/3 | Not started | - |
| 2. Find Staff | 0/3 | Not started | - |
| 3. Create & Send Offers | 0/2 | Not started | - |
| 4. Accept & Close the Loop | 0/2 | Not started | - |
| 5. Status Board, Extras & Real Hire | 0/3 | Not started | - |
| 6. HITO Link (optional bridge) | 0/2 | Not started | - |
