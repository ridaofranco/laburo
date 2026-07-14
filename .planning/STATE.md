---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-07-14T16:44:00Z"
last_activity: 2026-07-14 -- Completed plan 01-02 (magic-link RPCs, SQL-tested)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 2
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13, after architecture revision)

**Core value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual; la integración con HITO es un puente opcional, no un requisito.
**Current focus:** Phase 1 — Own Data Foundation

## Current Position

Phase: 1 (Own Data Foundation) — EXECUTING
Plan: 3 of 4
Status: Executing Phase 1 (01-01, 01-02 complete)
Last activity: 2026-07-14 -- Completed plan 01-02 (magic-link RPCs, SQL-tested)

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: 12 min
- Total execution time: ~0.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Own Data Foundation | 2/4 | 24 min | 12 min |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture (2026-07-13): App has its OWN Supabase DB (staff/gigs/crew/offers); NOT sharing HITO's DB.
- Integration (2026-07-13): HITO reached via a PUENTE — SECURITY DEFINER receiver in HITO + event-read — not fusion, not direct table writes, not MCP.
- Build order: own data (SQL-tested) first, UI after; app must run without HITO.
- Priority (2026-07-13, discuss-phase 1): ALL HITO integration deferred to Phase 6 (last). Franco: "lo importante es que sea una app de trabajos; el enlace con HITO viene después por el medio que sea". Phase 1 = app foundation only (DATA-01..04); bridge mechanism re-confirmed at Phase 6 start.
- Data foundation (2026-07-14, plan 01-01): `staff_app` schema created inside HITO's project `luillpzfqzbpoqkgvjuw` (D-03, no new project). **Fixed SOMOS DER org UUID = `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`** — every later plan/backfill stamps `organization_id` with this value. Helpers named `staff_app.is_org_member`/`is_org_writer` (own schema, no collision with HITO public). `get_advisors(security)` post-migration is identical to the pre-migration baseline (zero NEW staff_app findings).
- Magic-link RPCs (2026-07-14, plan 01-02): migration `staff_app_0003_magic_link_rpcs` added `staff_app.get_public_offer`/`accept_offer`/`decline_offer` — SECURITY DEFINER, `SET search_path = staff_app, pg_temp`, 256-bit sha256-hashed tokens, in-RPC `expires_at > now()` + `status IN ('sent','viewed')` guard, atomic crew INSERT `ON CONFLICT (gig_id,staff_profile_id) DO NOTHING`. **Grant model:** anon has EXECUTE on those 3 RPCs + USAGE on schema `staff_app` (0001 had revoked schema usage — re-granted so the RPC grants are reachable); helpers `is_org_member`/`is_org_writer` locked from PUBLIC to authenticated-only (no other anon-callable function in staff_app). 7-case SQL harness passed; `get_advisors(security)` still clean vs baseline. **Phase-4 REST-exposure decision recorded (not built):** expose `staff_app` via PostgREST OR add thin `public` wrappers to call the RPCs from the anon client.

### Pending Todos

- **Phase 4 planning note (from plan-checker 2026-07-13):** `accept_offer` returns `{ok:false, reason:'invalid_or_expired'}` on an already-accepted token (idempotency guard) — Phase 4's public page must add a distinct "already accepted" reason code or handle the client-side messaging so the candidate doesn't see a misleading error.

### Blockers/Concerns

- **Org/account consolidation unresolved**: Franco has 2 accounts (ridaofrancorg@, franco@somosder.ar); real SOMOS DER org data lives under partner's account (cottludmila@). Only relevant to the HITO push destination — now blocks Phase 6 (HITO Link), NOT Phase 1. (Backfill source is HITO's `staff_profiles`, read-only — no org decision needed for that.)
- **Verify exact `staff_profiles` columns via live query** before the 146 backfill (column list is owner-stated, not queried).
- **Ferozo SMTP deliverability untested**: no mail-tester/Postmaster data yet; Phase 5 SPF/DKIM verification is the first real test, not an assumption.
- **Web-form PII/consent gap (Ley 25.326)**: the live form collects CVs without a compliant consent notice — live-now obligation, fix alongside the Phase 1 repoint, not a v2 concern.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-14T16:44:00Z
Stopped at: Completed 01-02-PLAN.md (magic-link RPCs, SQL-tested)
Resume file: None — next is 01-03 (form repoint + Source-A backfill) in Wave 2
