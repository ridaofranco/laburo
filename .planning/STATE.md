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

See: .planning/PROJECT.md (updated 2026-07-13, after architecture revision)

**Core value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual; la integración con HITO es un puente opcional, no un requisito.
**Current focus:** Phase 1 — Own Data Foundation & HITO Bridge

## Current Position

Phase: 1 of 5 (Own Data Foundation & HITO Bridge)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-07-13 — Roadmap regenerated for revised architecture (app owns its data; HITO via bridge, not fusion)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: — min
- Total execution time: 0 hours

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

- Architecture (2026-07-13): App has its OWN Supabase DB (staff/gigs/crew/offers); NOT sharing HITO's DB.
- Integration (2026-07-13): HITO reached via a PUENTE — SECURITY DEFINER receiver in HITO + event-read — not fusion, not direct table writes, not MCP.
- Build order: own data + bridge (SQL-tested) first, UI after; bridge is optional per gig — app must run without HITO.

### Pending Todos

None yet.

### Blockers/Concerns

- **Org/account consolidation unresolved**: Franco has 2 accounts (ridaofrancorg@, franco@somosder.ar); real SOMOS DER org data lives under partner's account (cottludmila@). Determines which HITO org/event the bridge pushes crew to — resolve before Phase 1 bridge push and before backfill target is fixed.
- **Verify exact `staff_profiles` columns via live query** before the 146 backfill (column list is owner-stated, not queried).
- **Ferozo SMTP deliverability untested**: no mail-tester/Postmaster data yet; Phase 5 SPF/DKIM verification is the first real test, not an assumption.
- **Web-form PII/consent gap (Ley 25.326)**: the live form collects CVs without a compliant consent notice — live-now obligation, fix alongside the Phase 1 repoint, not a v2 concern.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-13
Stopped at: ROADMAP.md + STATE.md regenerated for revised architecture; REQUIREMENTS.md traceability updated (26/26 mapped)
Resume file: None
