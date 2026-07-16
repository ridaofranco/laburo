# Phase 5: Status Board, Extras & Real Hire - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary
Franco runs his entire hiring workflow in-app: an offer board per gig (roles covered vs open + each offer's status), favorites + private org-scoped notes, one-tap return to the filtered list minus already-offered candidates, post-event star rating, and offers that expire on time with exactly one auto-reminder email. Then the app is deployed to its own Vercel project (SPF/DKIM verified) and ONE real hire is completed end to end. STAT-02, XTRA-01/02/03/04, SHIP-01/02.
</domain>

<decisions>
## Implementation Decisions
- **D-01 (design deferred, LAST phase before reskin):** build with the current placeholder tokens/components (same as Phase 2/3/4). The premium reskin (Franco's Stitch "Minimalista Radical" ecosystem) happens ALL AT ONCE right AFTER this phase. Keep everything token-driven so the reskin is a swap. See [[franco-diseno-cero-ia]].
- **D-02 (STAT-02 board per gig):** a per-gig coverage view — for each gig, the roles and, per role/offer, the status (enviada/vista/aceptada/rechazada/vencida, "vencida" DERIVED from `now() > expires_at`). Reuse the `public.staff_app_offers` view (built in 04-01) + a gigs read. This is ALSO the fix for the real UX gap found in testing: Franco should NOT have to hunt for a candidate to see status — the board is the single at-a-glance surface.
- **D-03 (XTRA-01 favorites + private notes):** favorites and notes are org-scoped and NEVER visible to the candidate (they live on the app/producer side only, not in any candidate-facing RPC/page). New `staff_app` table(s) (e.g. `staff_app.candidate_notes` / a favorite flag), RLS org-scoped, exposed to the authenticated producer via a `public` security_invoker view or SECURITY DEFINER RPC (staff_app not PostgREST-exposed — same pattern as every prior phase; WR-05 explicit REVOKE). Migration applied LIVE by the orchestrator.
- **D-04 (XTRA-02 next-candidate re-filter):** after a reject/expiry, one tap returns Franco to the same filtered search minus candidates already offered for that gig. Likely a search param + a "not in (offered for this gig)" exclusion, mirroring the Phase-2 crew_busy exclusion pattern.
- **D-05 (XTRA-03 expiry + ONE reminder, free):** offers expire on `expires_at` (already enforced in the accept RPC; "vencida" derived on read). Send EXACTLY ONE auto-reminder email before expiry via a **free Vercel Cron** hitting a route handler that finds offers nearing expiry (not yet reminded, still sent/viewed) and sends via the Phase-3 mailer. Needs a `reminded_at` (or similar) column to guarantee exactly-once. **GATED on SMTP creds** (same as OFER-02) — build the cron + logic now; it only actually sends once Franco supplies the encrypted SMTP secret.
- **D-06 (XTRA-04 post-event rating):** Franco rates staff 1-5 + optional note after a gig. New `staff_app` rating table, org-scoped, producer-only. Same access pattern (view/RPC + WR-05, live-applied migration).
- **D-07 (SHIP-01 deploy) — GATED ON FRANCO:** deploy to a NEW own Vercel project (Hobby, free) with env vars (Supabase URL/anon/service, SITE_URL, SMTP_*). SPF/DKIM verified on the Ferozo/DER domain so offers don't hit spam (the long-standing untested deliverability item). Needs: Franco's OK to create the Vercel project + the SMTP creds + DNS access for SPF/DKIM records. The dev-login bypass (LABURO_DEV_BYPASS) must NOT ship (route already 404s in production, but confirm).
- **D-08 (SHIP-02 real hire) — GATED ON FRANCO:** one REAL person found, offered, accepted via the link, recorded as crew in the app. Inherently a human milestone Franco performs once the app is deployed + email works. HITO push stays out (Phase 6; gigs remain hito_event_id NULL).
- **Copy:** Argentine voseo, warm, NO em dash (hard rule).

## What I build autonomously vs what needs Franco
- **Buildable now (no external dep):** STAT-02 board, XTRA-01 favorites/notes, XTRA-02 re-filter, XTRA-04 rating, and the XTRA-03 cron+logic (code, not live-sending). Plus the live migrations (orchestrator applies).
- **Gated on Franco:** SMTP creds (unlocks OFER-02 real send + XTRA-03 reminders), Vercel project creation + deploy (SHIP-01), DNS/SPF/DKIM records (SHIP-01), the real person + real hire (SHIP-02).
</decisions>

<canonical_refs>
- .planning/phases/04-accept-close-loop/04-01-SUMMARY.md — `public.staff_app_offers` view (status/expires_at/gig_title) for the board + derived "vencida".
- .planning/phases/03-create-send-offers/03-02-SUMMARY.md — the honest mailer (for the reminder cron) + the SMTP env gate.
- .planning/phases/02-find-staff/* — the search + crew_busy exclusion pattern (for XTRA-02 re-filter) + the profile page (favorites/notes/rating surfaces).
- supabase/migrations/staff_app_0007/0008/0009 — the view + SECURITY DEFINER RPC + WR-05 patterns for the new notes/favorites/rating objects.
- Vercel: CLI logged in (ridaofranco-8135); free Cron on Hobby.
</canonical_refs>

<code_context>
- New `staff_app` tables (notes/favorites/rating) → RLS org-scoped, reached via `public` views/RPCs (schema not PostgREST-exposed), WR-05 explicit REVOKE, migrations applied LIVE by the orchestrator.
- The reminder cron = a route handler + `vercel.json` cron entry (free), guarded by exactly-once (`reminded_at`), using the Phase-3 mailer (honest; no-op until SMTP env present).
- Deploy = a new Vercel project for staff-app (NOT somosder-web's). Env + SPF/DKIM are Franco-gated USER-SETUP.
</code_context>

<deferred>
- HITO bridge (BRDG-*) → Phase 6.
- Premium visual reskin (Stitch Minimalista Radical ecosystem) → immediately AFTER this phase, all at once.
- The Stitch "extras" NOT in the roadmap (notifications center, payments processing, chat, interactive onboarding, master calendar) → v2. This phase's XTRA-01..04 are the curated v1 extras only.
</deferred>

---
*Phase: 05-status-board-extras-real-hire · 2026-07-16*
