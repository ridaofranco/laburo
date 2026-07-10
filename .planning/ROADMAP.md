# Roadmap: Staff App (by DER)

## Overview

The journey delivers Franco's core value one load-bearing layer at a time: first harden the shared HITO Supabase so multi-tenant staff data and a secure magic-link offer lifecycle exist and are SQL-proven before any UI is written; then give Franco a phone-first way to find the right person from the real 146-applicant pool; then let him turn a candidate into an offer that reaches them by email and WhatsApp; then let the candidate accept with no account and land as crew in HITO — closing the loop end to end; and finally give Franco the status board plus the daily-workflow extras and ship one real hire to production. Structure is derived from the research build order (data-first, critical path before breadth) and the #1 documented risk: over-scoping. Everything off the search → offer → accept → crew-record path waits until that path works with one real hire.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Data Foundation & Hardened RPCs** - Multi-tenant migration + `offers` table + SQL-tested magic-link RPCs on the shared Supabase
- [ ] **Phase 2: Find Staff** - App scaffold + phone-first search/filter and profile/CV view over the real pool
- [ ] **Phase 3: Create & Send Offers** - Offer form tied to a HITO event, auto-email with magic link + one-tap wa.me
- [ ] **Phase 4: Accept & Close the Loop** - No-account accept/decline that atomically writes crew into HITO, with per-offer status
- [ ] **Phase 5: Status Board, Extras & Real Hire** - Coverage board, favorites/notes, expiry+reminder, ratings, production ship + 1 real hire

## Phase Details

### Phase 1: Data Foundation & Hardened RPCs
**Goal**: The shared HITO Supabase safely supports multi-tenant staff data and a secure, single-use magic-link offer lifecycle — proven directly in SQL before any UI exists.
**Mode:** mvp
**Depends on**: Nothing (first phase). Prerequisite: Franco's account/org consolidation resolved (or a fixed target SOMOS DER `organization_id` chosen) before backfilling the 146 live applicants.
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. The live somosder-web "Trabajá con nosotros" form still inserts new applicants successfully, and every existing and new row carries the SOMOS DER `organization_id` (expand-migrate-contract, no outage).
  2. An org member can SELECT `staff_profiles` and `offers` only for their own org (RLS via `is_org_member`/`is_org_writer`); anon cannot read either table directly.
  3. Calling `get_public_offer` / `accept_offer` / `decline_offer` against a real token in SQL behaves correctly: accept atomically creates `crew_member` + `crew_assignment`, is single-use/idempotent, and rejects expired or replayed tokens.
  4. `get_advisors` reports no `function_search_path_mutable` or RLS findings on the new functions, table, and policies.
**Plans**: TBD

Plans:
- [ ] 01-01: `staff_profiles` multi-tenant migration (nullable org_id + trigger default + backfill) and RLS, form-safe
- [ ] 01-02: `offers` table (org-scoped, token, status, expiry) with RLS
- [ ] 01-03: `get_public_offer` / `accept_offer` / `decline_offer` SECURITY DEFINER RPCs, SQL-tested with a real token

### Phase 2: Find Staff
**Goal**: Franco can log into a phone-first app and find the right candidate from the real 146-applicant pool faster than the Google Sheet.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Franco can log in and land on an org-scoped dashboard (auth gate + Supabase SSR clients copied from HITO).
  2. Franco can search/filter the real `staff_profiles` pool by role/oficio (multi-select over the 64 oficios) plus free text and see matching candidates.
  3. Franco can filter out candidates already assigned to an overlapping HITO event, with a manual availability note.
  4. Franco can open a candidate profile (data, oficios, experience, links, status) and view/download the CV via a short-TTL signed URL from the private `staff-cvs` bucket.
  5. The full search-to-profile flow is usable one-handed on a phone.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: Standalone Next.js 15 scaffold + auth gate / org layout copied from HITO
- [ ] 02-02: Search + filter over `staff_profiles` (role/oficio multi-select, text, availability)
- [ ] 02-03: Candidate profile page + CV signed-URL view

### Phase 3: Create & Send Offers
**Goal**: Franco can turn a chosen candidate into a job offer tied to a real HITO event and get it into the person's hands by email and WhatsApp in one flow.
**Mode:** mvp
**Depends on**: Phase 2 (and Phase 1 `offers`/RPCs)
**Requirements**: OFER-01, OFER-02, OFER-03
**Success Criteria** (what must be TRUE):
  1. Franco can create an offer tied to a HITO event (pick existing or quick-create) with role, dates, informational amount, and conditions, scoped to org + candidate.
  2. Submitting the offer automatically sends an email via the DER SMTP mailer containing the magic link.
  3. Franco gets a one-tap wa.me button with a pre-filled message (offer summary + same link) to reinforce over WhatsApp.
  4. Franco sees honest send feedback (sending / sent / failed), never a silent 250-OK success.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: Create-offer form + server action (event pick/quick-create, role, dates, amount, conditions)
- [ ] 03-02: Copied `mailer.ts` send with honest state + wa.me link builder

### Phase 4: Accept & Close the Loop
**Goal**: A candidate can accept or decline the offer from the link with no account, and an acceptance lands them as crew in HITO — closing the hire loop end to end.
**Mode:** mvp
**Depends on**: Phase 3 (and Phase 1 RPCs)
**Requirements**: ACPT-01, ACPT-02, ACPT-03, STAT-01
**Success Criteria** (what must be TRUE):
  1. The candidate can open the magic link on their phone and see the offer (role, event, dates, amount, conditions) without creating an account.
  2. The candidate accepts or declines via an explicit button POST; email/WhatsApp link-preview bots cannot trigger acceptance (no state-changing GET).
  3. On accept, `crew_member` + `crew_assignment` are created atomically in HITO for that event/org; a second tap never double-books.
  4. Franco sees each offer's status flip to viewed / accepted / rejected as it happens.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: Public `/o/[token]` page — `get_public_offer` display (safe GET) + viewed tracking
- [ ] 04-02: Accept/decline POST wired to `accept_offer`/`decline_offer` (idempotent) + status reflection

### Phase 5: Status Board, Extras & Real Hire
**Goal**: Franco runs his entire hiring workflow in-app — seeing role coverage per event, managing candidates, handling rejections — and ships one real hire to production.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: STAT-02, XTRA-01, XTRA-02, XTRA-03, XTRA-04, SHIP-01, SHIP-02
**Success Criteria** (what must be TRUE):
  1. Franco sees an offer board per event showing which roles are covered vs open, with each offer's status (sent/viewed/accepted/rejected/expired).
  2. Franco can favorite candidates and add private org-scoped notes never visible to the candidate.
  3. Offers expire on their configured date and send exactly one auto-reminder email before expiry (free Vercel cron); on reject/expiry Franco returns in one tap to the filtered list minus already-offered candidates.
  4. Franco can rate staff post-event (1-5 + note).
  5. The app is deployed to production on its own Vercel project with SPF/DKIM verified, and one real person has been found, offered, accepted via the link, and recorded in HITO for a real event.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: Offer status board per event (coverage view)
- [ ] 05-02: Favorites + private notes, next-candidate re-filter, post-event rating
- [ ] 05-03: Vercel deploy + SPF/DKIM verification + expiry/reminder cron, then 1 real end-to-end hire

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation & Hardened RPCs | 0/3 | Not started | - |
| 2. Find Staff | 0/3 | Not started | - |
| 3. Create & Send Offers | 0/2 | Not started | - |
| 4. Accept & Close the Loop | 0/2 | Not started | - |
| 5. Status Board, Extras & Real Hire | 0/3 | Not started | - |
