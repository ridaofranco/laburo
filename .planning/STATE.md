---
gsd_state_version: '1.0'
status: planning
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 13
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10)

**Core value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual.
**Current focus:** Phase 1 — Data Foundation & Hardened RPCs

## Current Position

Phase: 1 of 5 (Data Foundation & Hardened RPCs)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-07-10 — Roadmap created (5 phases, coarse granularity, 22/22 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: — min
- Total execution time: — hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture: standalone Next.js 15 app on a new Vercel project, talking to the shared HITO Supabase — copy (not import) HITO's auth gate, org pattern, mailer, and token-accept RPC.
- Data model: `staff_profiles` migrated multi-tenant via expand-migrate-contract (nullable org_id + trigger default + backfill + RLS), never `NOT NULL` up front — the live public web form must not break.
- Security: anon touches the DB only through `get_public_offer` / `accept_offer` / `decline_offer` SECURITY DEFINER RPCs with pinned `search_path`; accept is POST-only, token hashed, expiring, single-use.
- Scope discipline: nothing off the search → offer → accept → crew-record path ships until that path works with 1 real hire (XTRA-* deferred to Phase 5). This is the #1 documented risk (HITO was over-scoped and never launched).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- **Org/account consolidation unresolved** — Franco has 2 Google accounts and the real SOMOS DER org with live data sits under his partner's account. Blocks the Phase 1 backfill; resolve or fix a target `organization_id` before migrating the 146 applicants.
- **Exact `staff_profiles` column list is MEDIUM confidence** (29 cols owner-stated, not live-queried) — verify with `list_tables` / a live query at the start of Phase 1 before writing the migration.
- **Ferozo SMTP deliverability untested** — treat Phase 5's SPF/DKIM verification as the first real deliverability test, not an assumption.
- **PII/consent notice on the live web form** likely incomplete under Ley 25.326 — a live-now obligation; flag for a quick fix alongside Phase 1 RLS hardening.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-10
Stopped at: Roadmap and STATE initialized; requirements traceability updated
Resume file: None
