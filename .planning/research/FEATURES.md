# Feature Research

**Domain:** Event / temp staffing — internal crew-hiring tool (v1), multi-employer marketplace (v2)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (comparables verified against vendor product pages; offer-flow specifics MEDIUM — vendor marketing, not docs)

## Reframing: What This Product Actually Is

The comparables in the question (Nowsta, Ubeya, Rosterfy, LASSO, Instawork, Qwick, Connecteam) are **full workforce-management suites** — they bundle scheduling, time-tracking (geofenced clock-in), payroll, and compliance. The SOMOS DER v1 is a **much narrower slice**: an ATS-lite (applicant search over a real pool) + a **single job-offer → accept/decline** flow that writes into an existing crew data layer (HITO).

The correct mental model for v1 is: **"filter a candidate pool, send one offer, get a yes/no."** Not "schedule a workforce." Almost everything the big platforms do around clock-in, timesheets, payroll, and shift-swapping is **v2-or-never** for this product because HITO already owns crew data and Franco's pay/fiscal circuit stays manual by explicit decision. This framing drives the categorization below.

## Feature Landscape

### Table Stakes (Users Expect These)

For v1, "users" = Franco (the hirer) and the candidate receiving an offer. Missing any of these makes the tool feel broken versus the Google Sheet + WhatsApp it replaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Candidate search by role/oficio | The core job — find a bartender, a stagehand, a promoter. Every comparable leads with tag/skill filtering (Nowsta "tags and filters to find the best person"; Ubeya "dynamic fields per worker"). | LOW | Filter over `staff_profiles`. 64 oficios already captured by the web form. Multi-select role + free-text search. |
| Availability filter | Can't offer a shift to someone unavailable those dates. Ubeya/Rosterfy match by availability as a first-class field. | MEDIUM | **Key gotcha:** the pool has NO structured availability yet (form doesn't capture per-date availability). v1 realistic version = "not already assigned to an overlapping event in HITO" + optional manual availability note. True calendar availability is v2 (needs staff panel). See Pitfalls. |
| Candidate profile view (data, oficios, experience, CV) | You don't hire from a name in a list. Every ATS/staffing tool has a profile card. | LOW | Data already in `staff_profiles` (29 cols) + `staff-cvs` bucket. Signed URL for private CV. |
| Create job offer (event, role, dates, pay, conditions) | The offer is the product. LASSO/Ubeya post shifts with role + dates + pay upfront ("view pay rates upfront"). | LOW-MEDIUM | Pay is informational-only in v1 (explicit decision) — store, don't process. Link offer to a HITO `event`. |
| Send offer via a channel the worker actually uses | Event staff live on phones/WhatsApp. LASSO sends via "text, email, or mobile app." | LOW | v1 = SMTP email + `wa.me` deep link with pre-filled message. No WhatsApp Business API (cost/approval — explicit decision). |
| Accept / decline by the candidate | The yes/no is the whole point. LASSO: "view, approve or decline"; Nowsta/Ubeya: accept in-app. | MEDIUM | v1 = magic link, no account (token + SECURITY DEFINER pattern already proven in HITO). This is the signature UX bet. |
| Offer status tracking (sent / viewed / accepted / declined / expired) | Franco needs to know who's answered without chasing on WhatsApp. LASSO tracks opens + confirmation receipts explicitly. | MEDIUM | Already an Active requirement. "Viewed" = magic-link opened (email open-tracking is unreliable; use link-click as the signal). |
| On-accept → create crew record | Otherwise the accept is a dead end and Franco re-enters data in HITO. | MEDIUM | Writes `crew_member` + `crew_assignment` tied to the event. This is the "leave the Sheet behind" payoff. |
| Multi-tenant scoping from day 1 | Not user-visible, but structurally table-stakes given the v2 marketplace vision. | MEDIUM | `organization_id` on every new table; migrate `staff_profiles` to org model. Cheap now, a rewrite later. |
| Mobile-first UI | Both Franco and staff operate from phones (explicit constraint). All comparables ship worker mobile apps. | LOW-MEDIUM | Responsive web is enough for v1; no native app needed (magic link works in any browser). |

### Differentiators (Competitive Advantage)

For v1 these aren't "beat Instawork" — they're "make Franco never open the Sheet again" and "make the offer feel professional to the candidate." Aligns with Core Value: find + hire real staff in one flow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-friction accept (no signup) | Instawork/Ubeya require the worker to install an app + create an account. A magic link that just works is a genuine edge for one-off event labor who won't install anything. | MEDIUM | Already the plan. The differentiator is precisely *not* building a worker account. |
| Pre-filled `wa.me` handoff | Meets staff where they already are (WhatsApp is the real channel in LATAM events) without paying for WhatsApp API. One tap, message pre-written. | LOW | Small feature, outsized adoption impact for the region. |
| Offer expiry + auto-reminder | Prevents offers rotting unanswered; LASSO's "automatic reminders" is a named selling point. Gives Franco a deadline to plan around. | MEDIUM | Expiry = a timestamp + a cron/edge check. Reminder = one scheduled email before expiry. Keep it to ONE reminder in v1. Depends on offer status + email. |
| Backup / next-candidate queue | If #1 declines or expires, offer cascades or Franco one-taps the next person. Instawork's "roster / first dibs" and no-show mitigation are core to their fill-rate pitch. | MEDIUM-HIGH | v1 can be manual ("declined → here's your filtered list again, pick next"). Automated cascade is v1.x. Don't auto-offer to multiple people at once in v1 (double-booking risk). |
| Favorites / trusted-crew list | Franco already knows who's reliable. Instawork "add favorite workers to roster for first dibs" is their retention hook. | LOW | A boolean/tag on the profile. Cheap, high daily value for a repeat operator. |
| Internal notes on candidates | Recruiter memory ("great with clients", "late last time"). Standard in every ATS. | LOW | Free-text note per profile, org-scoped, private. Do NOT expose to candidate. |
| Simple status pipeline / tags | Beyond per-offer status: a lightweight per-candidate pipeline (new / contacted / hired-before / blacklist). Ubeya dynamic fields, ATS columns. | LOW-MEDIUM | Tags cover most of this without a rigid Kanban. Resist building a full ATS board in v1. |
| Post-event rating | Instawork's 4.8-avg rating + skill/attitude/work-ethic scoring drives their reliability moat and feeds the marketplace. | MEDIUM | Defer to v1.x/v2 — it's the seed data for marketplace matching. Capture is easy (1–5 + note after event); the *value* only compounds at scale. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full scheduling / rostering calendar (drag-drop shifts, master schedule) | It's what Nowsta/LASSO/Ubeya *look* like; feels like "real" staffing software. | Massive scope; HITO already owns crew assignment; Franco already found the 40-section HITO over-scoped and never launched it. Would sink v1. | v1 = one offer per role per event. Let HITO/`events` hold the schedule shape. |
| Time-tracking / geofenced clock-in / timesheets | Ubiquitous in comparables; seems "complete." | Requires the staff to have an app + be on-site with the app open; pay is informational in v1 so timesheets have no consumer. Pure cost, zero v1 value. | Out of scope. Attendance stays in Franco's current circuit. |
| Real payment processing / payroll | "Contratar" implies paying; feels incomplete without it. | Explicit decision to defer — fiscal/CBU complexity, and the zero-paid-services constraint. Nowsta/Ubeya's payroll is their heaviest module. | Store pay as informational; pay via existing manual circuit. |
| Staff login / worker portal (profile, availability, history) | Every marketplace has one; feels necessary for "availability." | Adds auth, account recovery, RLS surface, and friction — the exact friction the magic link is designed to avoid. Kills the v1 UX bet. | Magic link for v1. Worker panel is v2, when availability + history + ratings justify accounts. |
| WhatsApp Business API (official) | WhatsApp is THE channel; official API feels more legit than `wa.me`. | Per-conversation cost + Meta template approval + business verification — violates zero-paid-services and adds weeks. Explicit decision against. | `wa.me` one-tap deep link (manual send) + automated email. |
| Auto-offer to many candidates simultaneously ("blast") | Fills shifts faster; marketplaces broadcast open shifts. | For a small trusted pool it risks double-booking / over-commit and burns goodwill (multiple people prep, one gets it). Broadcast only makes sense at marketplace scale with real-time claim. | v1 = sequential single offers with expiry + manual next-candidate. Broadcast/claim is a v2 marketplace mechanic. |
| Insurance (MeCubro) integration | Part of Franco's full vision; per-contratado seguro. | Belongs after the base cycle is validated (explicit decision); external integration + per-hire trigger is real work with no value until hiring actually flows through the app. | v2. Keep the data shape (crew_member) ready. |
| AI matching / demand forecasting | Nowsta/Ubeya lead marketing with "AI-powered scheduling." | Needs volume + historical data the pool doesn't have (146 profiles, no assignment history in-app yet). Premature; Gemini free-tier is better spent on CV autofill (already built). | Deterministic filters in v1. Revisit matching once ratings + history accumulate (v2). |
| Rigid import template for the candidate pool | Feels tidy to normalize everyone into one schema. | Franco explicitly never used HITO partly for rigid molds; the web form already feeds `staff_profiles` flexibly. | Read the pool as-is from `staff_profiles`; the form is the intake, no re-import mold. |

## Feature Dependencies

```
Candidate search (role/oficio + availability)
    └──requires──> staff_profiles migrated to multi-tenant (org_id)
    └──feeds──────> Candidate profile view (CV via signed URL)
                        └──enables──> Create job offer (event + role + dates + pay)
                                          └──requires──> HITO event to attach to
                                          └──sends via──> Email (SMTP) + wa.me link
                                                              └──carries──> Magic-link token (SECURITY DEFINER)
                                                                                └──drives──> Accept / Decline
                                                                                                └──updates──> Offer status (sent/viewed/accepted/declined/expired)
                                                                                                └──on accept──> Create crew_member + crew_assignment

Offer expiry + reminder ──enhances──> Offer status  (needs a scheduled job)
Backup / next-candidate ──enhances──> Offer status  (triggers on decline/expire; reuses search)
Favorites + notes + tags ──enhance──> Candidate search (better ranking/recall)
Post-event rating ──feeds──> (v2) marketplace matching + Favorites
Staff login ──conflicts──> Magic-link zero-friction accept (don't build both in v1)
```

### Dependency Notes

- **Everything depends on the `staff_profiles` → multi-tenant migration.** It's the first structural task; search, offers, and RLS all assume `organization_id`. Do it first.
- **Offer flow depends on a HITO `event` existing.** v1 must let Franco pick (or quick-create) the event the offer attaches to, or the crew_assignment write has nothing to bind to.
- **Expiry + reminder depend on a scheduled runner** (Supabase cron / edge function / Vercel cron). This is the one piece of always-on infra beyond request/response — scope it deliberately.
- **"Viewed" status depends on the magic link, not email opens.** Email open-tracking is unreliable and privacy-fraught; treat link-click as the reliable "seen it" signal.
- **Backup queue reuses candidate search** — build search well and the backup flow is nearly free (re-run the same filtered list minus already-offered).
- **Staff login conflicts with the magic-link bet** — building both in v1 doubles the auth surface and undercuts the zero-friction differentiator. Pick magic link for v1.

## MVP Definition

### Launch With (v1)

- [ ] Migrate `staff_profiles` to multi-tenant (`organization_id`) — everything else depends on it
- [ ] Candidate search by role/oficio + basic availability (not-already-assigned + manual note) — the core job
- [ ] Candidate profile view with CV (signed URL) — can't hire blind
- [ ] Create job offer (event, role, dates, informational pay/conditions) tied to a HITO event
- [ ] Send offer: automated email (SMTP) + one-tap `wa.me` pre-filled — meet staff where they are
- [ ] Magic-link accept/decline, no account — the friction-killing bet
- [ ] Offer status (sent / viewed / accepted / declined / expired) visible to Franco
- [ ] On accept → write `crew_member` + `crew_assignment` — the "leave the Sheet" payoff
- [ ] Favorites flag + private notes on candidates — cheap, high daily value for a repeat operator

### Add After Validation (v1.x)

- [ ] Offer expiry + single auto-reminder — trigger: Franco reports offers going stale unanswered
- [ ] Backup / next-candidate cascade (semi-automated) — trigger: first decline/expire happens in real use
- [ ] Post-event rating capture (1–5 + note) — trigger: after first real hire completes, to seed reliability data
- [ ] Candidate status pipeline / richer tags — trigger: pool interaction volume outgrows favorites + notes

### Future Consideration (v2+)

- [ ] Staff login + worker panel (profile, structured availability, history) — defer: undercuts magic-link UX until there's a reason to hold accounts
- [ ] Multi-employer marketplace (third-party signup, billing, moderation) — defer: validate own-operation flow first (explicit decision)
- [ ] MeCubro insurance per-hire — defer: integrate once base cycle validated
- [ ] Real payment/payroll tracking — defer: fiscal complexity + zero-paid-services
- [ ] AI matching / demand forecasting — defer: needs volume + rating/history data
- [ ] WhatsApp Business API — defer/likely-never: cost + approval vs. `wa.me` working fine

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `staff_profiles` multi-tenant migration | HIGH (unblocks all) | MEDIUM | P1 |
| Candidate search (role + basic availability) | HIGH | MEDIUM | P1 |
| Candidate profile + CV view | HIGH | LOW | P1 |
| Create job offer | HIGH | LOW-MEDIUM | P1 |
| Email + wa.me send | HIGH | LOW | P1 |
| Magic-link accept/decline | HIGH | MEDIUM | P1 |
| Offer status tracking | HIGH | MEDIUM | P1 |
| On-accept crew write to HITO | HIGH | MEDIUM | P1 |
| Favorites + notes | MEDIUM | LOW | P2 |
| Offer expiry + reminder | MEDIUM | MEDIUM | P2 |
| Backup / next-candidate | MEDIUM | MEDIUM-HIGH | P2 |
| Post-event rating | MEDIUM (compounds later) | MEDIUM | P2/P3 |
| Status pipeline / rich tags | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Staff login / worker panel | HIGH (v2) | HIGH | P3 (v2) |
| Marketplace / billing / MeCubro / payments | HIGH (v2) | HIGH | P3 (v2) |

## Competitor Feature Analysis

| Feature | Nowsta / LASSO (crew suites) | Instawork / Qwick (gig marketplaces) | Ubeya / Rosterfy | Our v1 Approach |
|---------|------------------------------|--------------------------------------|------------------|-----------------|
| Candidate discovery | Tags + filters, work requests | Post shift, workers browse & claim | Dynamic fields, AI match | Deterministic filter over own pool (role + availability) |
| Offer channel | Text / email / app | In-app push | In-app | Email + `wa.me`, no app |
| Accept/decline | In-portal approve/decline + e-sign | In-app claim | In-app | Magic link, no account |
| Status/confirmation | Track opens + require receipt (LASSO) | Fill-rate / no-show metrics | Confirmations | sent/viewed/accepted/declined/expired |
| Reminders/expiry | Automatic reminders (LASSO) | Auto rebooking | Automated | v1.x: expiry + one reminder |
| Reliability signal | — | Ratings (skill/attitude), favorites roster | Ratings | Favorites (v1), ratings (v1.x/v2) |
| Time/pay | Clock-in, payroll | Pay upfront, in-app pay | Timesheets, payroll | **None** — informational pay, manual circuit |
| Account model | Crew accounts | Worker accounts | Worker app | **No account** (magic link) |

## Sources

- Nowsta — [product](https://nowsta.com/), [staff management](https://www.nowsta.com/nowsta-staff-management-software-aw/) (tags/filters, accept-decline in app, event-centric scheduling)
- Ubeya — [platform](https://www.ubeya.com/platform), [scheduling](https://www.ubeya.com/platform/scheduling), [worker app](https://www.ubeya.com/platform/worker-app) (dynamic fields per worker, multiple positions, accept shifts in app)
- Instawork — [worker ratings help](https://help.instawork.com/en/articles/2281199-worker-ratings-and-feedback), [vs Qwick](https://www.instawork.com/compared-to/qwick) (ratings on skill/attitude/work-ethic, favorites roster / first dibs, fill/no-show rates)
- Qwick vs Instawork — [shiftNOW](https://www.shiftnow.com/blog/qwick-vs-instawork) (pay upfront, browse & claim, rebooking/backup)
- LASSO — [scheduling](https://www.lasso.io/scheduling/), [FAQs](https://www.lasso.io/faqs/) (view/approve/decline in portal, automatic reminders, require confirmation receipt, e-sign)
- Rosterfy — [features](https://www.rosterfy.com/features), [onboarding](https://www.rosterfy.com/features-automated-onboarding) (availability/skill match, automated onboarding workflows)
- Connecteam / Workforce.com — [scheduling](https://connecteam.com/online-employee-scheduling-apps/), [shift swapping](https://www.workforce.com/software/shift-swapping) (publish open shifts, first-come claim, qualification checks)

---
*Feature research for: event/temp staffing internal-hiring tool → marketplace*
*Researched: 2026-07-10*
