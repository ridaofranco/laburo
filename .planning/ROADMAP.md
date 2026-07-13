# Roadmap: Staff App (by DER)

## Overview

Revised for the architecture change: the app is now an **independent product with its own Supabase database** (staff, gigs, crew, offers), **integrated to HITO by a bridge — not fused**. The journey still delivers Franco's core value one load-bearing layer at a time, but the foundation is now doubly load-bearing: the app's own DB + its own hardened magic-link RPCs, **plus** the DB-side bridge to HITO (a SECURITY DEFINER receiver in HITO and the ability to read HITO events). All of that is SQL-proven before any UI exists. Then Franco gets a phone-first way to find the right person from the real 146-applicant pool; then he turns a candidate into an offer tied to an app **gig** (optionally linked to a HITO event); then the candidate accepts with no account and lands as crew **in the app** — and, if that gig is linked to HITO, the accept fires the bridge to also create crew in HITO. Finally the status board, the daily-workflow extras, and the production ship land one real hire.

Structure is derived from the revised build order (own data + bridge first, critical path before breadth) and the #1 documented risk: over-scoping. Everything off the search → offer → accept → crew-record path waits until that path works with one real hire. The app must run for a client with no HITO at all — the bridge is optional per gig, never a dependency.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Own Data Foundation & HITO Bridge** - App's own Supabase (staff/gigs/crew/offers) + form repoint + 146 backfill + SQL-tested magic-link RPCs + HITO bridge receiver & event-read
- [ ] **Phase 2: Find Staff** - App scaffold (dual-DB server) + phone-first search/filter and profile/CV view over the app's own pool
- [ ] **Phase 3: Create & Send Offers** - Offer tied to an app gig (optionally linked to a HITO event), auto-email with magic link + one-tap wa.me
- [ ] **Phase 4: Accept & Close the Loop** - No-account accept/decline that atomically creates crew in the app and fires the HITO bridge when the gig is linked, with per-offer status
- [ ] **Phase 5: Status Board, Extras & Real Hire** - Coverage board, favorites/notes, expiry+reminder, ratings, production ship + 1 real hire

## Phase Details

### Phase 1: Own Data Foundation & HITO Bridge
**Goal**: The app has its own Supabase database owning staff/gigs/crew/offers, a secure single-use magic-link offer lifecycle, and a working DB-level bridge to HITO — all proven directly in SQL before any UI exists, and without ever breaking the live web intake.
**Mode:** mvp
**Depends on**: Nothing (first phase). Prerequisite: Franco's account/org consolidation resolved (or a fixed target HITO org/event chosen) before the bridge pushes crew; exact `staff_profiles` columns verified via live query before backfilling the 146 real applicants.
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, BRDG-01, BRDG-02
**Success Criteria** (what must be TRUE):
  1. The app's own Supabase project exists ($0) with its own org-scoped, RLS-enabled schema — `staff_profiles`, `gigs` (with a nullable `hito_event_id`), `crew`, `offers` — and no table is readable by anon directly.
  2. The somosder-web "Trabajá con nosotros" form (+ CV upload) writes into the APP database and its CV bucket, with zero downtime during the cutover; the existing 146+ applicants are copied into the app DB and verified with no loss.
  3. Calling `get_public_offer` / `accept_offer` / `decline_offer` against a real token in SQL behaves correctly in the APP DB: accept atomically creates crew in the app, is single-use/idempotent, rejects expired or replayed tokens, tokens are 256-bit and hashed at rest, and `get_advisors` reports no `function_search_path_mutable` or RLS findings.
  4. A HITO-side SECURITY DEFINER function exists that receives a crew push from the app (creates `crew_member` + `crew_assignment` atomically in the correct HITO org/event, idempotent, token/service-authenticated) and is proven in SQL; the app can also read the list of HITO events through the bridge to later link a gig.
**Plans**: TBD

Plans:
- [ ] 01-01: New app Supabase project + own schema (`staff_profiles`, `gigs` w/ nullable `hito_event_id`, `crew`, `offers`), org-scoped with RLS from day 1 (DATA-01)
- [ ] 01-02: Repoint somosder-web form + CV bucket to the app DB (no downtime) and backfill the 146+ applicants, verified (DATA-02, DATA-03)
- [ ] 01-03: App magic-link RPCs (`get_public_offer`/`accept_offer`/`decline_offer`, SECURITY DEFINER, hashed token) + HITO bridge receiver function + HITO events read — all SQL-tested (DATA-04, BRDG-01, BRDG-02)

### Phase 2: Find Staff
**Goal**: Franco can log into a phone-first standalone app and find the right candidate from the app's own 146-applicant pool faster than the Google Sheet.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Franco can log in and land on an org-scoped dashboard (auth gate + Supabase SSR clients copied from HITO), with the server able to reach both the app DB and, when needed, HITO through the bridge.
  2. Franco can search/filter the app's own `staff_profiles` pool by role/oficio (multi-select over the 64 oficios) plus free text and see matching candidates.
  3. Franco can filter out candidates already assigned to an overlapping gig in the app, with a manual availability note.
  4. Franco can open a candidate profile (data, oficios, experience, links, status) and view/download the CV via a short-TTL signed URL from the app's private CV bucket.
  5. The full search-to-profile flow is usable one-handed on a phone.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: Standalone Next.js 15 scaffold + auth gate / org layout copied from HITO, dual-DB server config (app DB + HITO bridge creds)
- [ ] 02-02: Search + filter over the app's `staff_profiles` (role/oficio multi-select, text, availability), mobile-first
- [ ] 02-03: Candidate profile page + CV signed-URL view from the app bucket

### Phase 3: Create & Send Offers
**Goal**: Franco can turn a chosen candidate into a job offer tied to an app gig — which he can optionally link to a real HITO event — and get it into the person's hands by email and WhatsApp in one flow.
**Mode:** mvp
**Depends on**: Phase 2 (and Phase 1 `offers`/RPCs, HITO event-read)
**Requirements**: OFER-01, OFER-02, OFER-03
**Success Criteria** (what must be TRUE):
  1. Franco can create an offer tied to an app gig (pick an existing gig or quick-create one) with role, dates, informational amount, and conditions, scoped to org + candidate; the gig can be linked to a HITO event (chosen from the bridge event list) or left unlinked.
  2. Submitting the offer automatically sends an email via the DER SMTP mailer containing the magic link.
  3. Franco gets a one-tap wa.me button with a pre-filled message (offer summary + same link) to reinforce over WhatsApp.
  4. Franco sees honest send feedback (sending / sent / failed), never a silent 250-OK success.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: Create-offer form + server action (app gig pick/quick-create, optional HITO-event link, role, dates, amount, conditions)
- [ ] 03-02: Copied `mailer.ts` send with honest state + wa.me link builder

### Phase 4: Accept & Close the Loop
**Goal**: A candidate can accept or decline the offer from the link with no account; an acceptance creates crew **in the app** atomically, and if the gig is linked to HITO it also fires the bridge to create crew in HITO — closing the hire loop end to end.
**Mode:** mvp
**Depends on**: Phase 3 (and Phase 1 RPCs + bridge)
**Requirements**: ACPT-01, ACPT-02, ACPT-03, BRDG-03, STAT-01
**Success Criteria** (what must be TRUE):
  1. The candidate can open the magic link on their phone and see the offer (role, gig, dates, amount, conditions) without creating an account.
  2. The candidate accepts or declines via an explicit button POST; email/WhatsApp link-preview bots cannot trigger acceptance (no state-changing GET).
  3. On accept, crew is created atomically in the APP; a second tap never double-books.
  4. If the gig is linked to a HITO event, the app calls the bridge and stores the returned `hito_event_id` / `hito_crew_member_id`; if the gig is unlinked there is no call; a bridge failure never loses the app-side hire (retryable).
  5. Franco sees each offer's status flip to viewed / accepted / rejected as it happens.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Public `/o/[token]` page — `get_public_offer` display (safe GET) + viewed tracking + status reflection (ACPT-01, ACPT-02 read side, STAT-01)
- [ ] 04-02: Accept/decline POST → `accept_offer` creates app crew; on linked gigs fire the HITO bridge, store refs, retryable (ACPT-02 write side, ACPT-03, BRDG-03)

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
  5. The app is deployed to production on its own Vercel project with SPF/DKIM verified, and one real person has been found, offered, accepted via the link, recorded as crew in the app — and, because the gig was linked, in HITO too.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Offer status board per gig (coverage view) (STAT-02)
- [ ] 05-02: Favorites + private notes, next-candidate re-filter, post-event rating, expiry/reminder cron (XTRA-01, XTRA-02, XTRA-03, XTRA-04)
- [ ] 05-03: Vercel deploy + SPF/DKIM verification, then 1 real end-to-end hire through the bridge (SHIP-01, SHIP-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Own Data Foundation & HITO Bridge | 0/3 | Not started | - |
| 2. Find Staff | 0/3 | Not started | - |
| 3. Create & Send Offers | 0/2 | Not started | - |
| 4. Accept & Close the Loop | 0/2 | Not started | - |
| 5. Status Board, Extras & Real Hire | 0/3 | Not started | - |
