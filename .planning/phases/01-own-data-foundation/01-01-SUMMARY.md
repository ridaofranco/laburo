---
phase: 01-own-data-foundation
plan: 01
subsystem: database
tags: [supabase, postgres, rls, multi-tenant, schema, staff_app]

requires: []
provides:
  - "staff_app schema inside HITO's Supabase project luillpzfqzbpoqkgvjuw (D-03, no new project)"
  - "staff_app.organizations + staff_app.members (org-scoped, RLS-enabled)"
  - "staff_app.is_org_member / staff_app.is_org_writer helpers (SECURITY DEFINER, pinned empty search_path, own names — no collision with HITO public helpers)"
  - "staff_app.staff_profiles superset of HITO's live 31 columns + nullable organization_id"
  - "staff_app.gigs (nullable hito_event_id, no FK), staff_app.crew (UNIQUE gig_id+staff_profile_id), staff_app.offers (token_hash NOT NULL UNIQUE, 5-value status enum)"
  - "Seeded SOMOS DER org with fixed UUID aa29aa2f-4d34-4e53-b62c-7397e8a4d123"
affects: [01-02, 01-03, 01-04, phase-2-find-staff, phase-4-accept-loop, phase-6-hito-link]

tech-stack:
  added: []
  patterns:
    - "Logical multi-tenant isolation via a dedicated Postgres schema inside a shared project (D-03)"
    - "RLS on every table from creation; SECURITY DEFINER helpers with SET search_path = '' + fully schema-qualified refs"
    - "Applied migrations persisted as SQL files under supabase/migrations/ for version control"

key-files:
  created:
    - "supabase/migrations/staff_app_0001_schema_orgs.sql"
    - "supabase/migrations/staff_app_0002_core_tables.sql"
  modified: []

key-decisions:
  - "Fixed SOMOS DER org UUID = aa29aa2f-4d34-4e53-b62c-7397e8a4d123 (every later plan/backfill stamps organization_id with this)"
  - "Helpers named staff_app.is_org_member/is_org_writer (own schema) — no collision with HITO's pre-existing public.is_org_member/is_org_writer"
  - "organization_id is NULLABLE on staff_profiles (pitfall #3 — live-insert table); anon INSERT policy + org-stamp trigger deferred to plan 01-03"
  - "Migrations prefixed staff_app_ because they share HITO's migration history in the same project"

patterns-established:
  - "Own-schema logical isolation: all app objects under staff_app, zero writes/creates in HITO public.*"
  - "get_advisors baseline captured before first migration; NEW-finding detection = grep applied advisor output for 'staff_app'"

requirements-completed: [DATA-01]

duration: 6 min
completed: 2026-07-14
---

# Phase 1 Plan 01: Own Data Foundation (staff_app schema) Summary

**Created the app's logically-independent `staff_app` schema inside HITO's Supabase project (`luillpzfqzbpoqkgvjuw`) with six org-scoped, RLS-enabled tables, SECURITY DEFINER org helpers with pinned search_path, and a seeded SOMOS DER org — advisor-clean vs baseline, zero writes to HITO's public.***

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-14T16:14:01Z
- **Completed:** 2026-07-14T16:20:14Z
- **Tasks:** 2
- **Files created:** 2 (SQL migration files) + 2 applied migrations in the DB

## Key Reference Values (downstream plans depend on these)

- **Shared project ref:** `luillpzfqzbpoqkgvjuw` (HITO's project; D-03 co-location — NO new project created). Existing URL / anon / service keys are unchanged and already known; no new keys created.
- **Schema name:** `staff_app`
- **Fixed SOMOS DER org UUID:** `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`
- **Migrations applied:** `staff_app_0001_schema_orgs`, `staff_app_0002_core_tables`

## get_advisors Security Baseline (captured BEFORE first migration)

Baseline captured on `luillpzfqzbpoqkgvjuw` before any staff_app DDL. HITO's project already carries a large set of pre-existing findings — all OUT OF SCOPE. Notable baseline category counts:

- `function_search_path_mutable`: 20 findings (HITO's public functions)
- `rls_enabled_no_policy`: 4
- `rls_policy_always_true`: 2
- `anon_security_definer_function_executable`: 85 / `authenticated_security_definer_function_executable`: 86 (HITO's intended public RPCs)
- `extension_in_public`: 1 (informational) + `auth_leaked_password_protection`: 1 (auth-level, N/A this phase)
- **`staff_app` string appears 0 times in the baseline** — the schema did not exist yet, so any post-migration `staff_app` finding is definitionally NEW.

**Post-migration result:** After BOTH migrations, `get_advisors(security)` output is **byte-for-byte identical to the baseline** (205,326 chars; tokenized diff = IDENTICAL) and contains **0 `staff_app` mentions** → zero NEW `function_search_path_mutable`, zero NEW `rls_disabled`/`rls_enabled_no_policy` referencing staff_app objects.

## Accomplishments

- Schema `staff_app` created inside HITO's project; `organizations` + `members` tables with RLS and member-scoped SELECT policies.
- `staff_app.is_org_member` / `staff_app.is_org_writer` helpers copied from HITO `00001`/`00052`, hardened with `SET search_path = ''` and schema-qualified refs (SECURITY DEFINER STABLE) — own schema/names avoid collision with HITO's `public` helpers.
- One seeded SOMOS DER org with the fixed UUID above; `members` left empty (auth wired in Phase 2).
- `staff_app.staff_profiles` reproduces all 31 live HITO columns (identical name/type/default) + nullable `organization_id` (32 total).
- `staff_app.gigs` (nullable `hito_event_id`, NO FK — D-01), `staff_app.crew` (`UNIQUE(gig_id, staff_profile_id)`), `staff_app.offers` (`token_hash` NOT NULL UNIQUE, `status` 5-value CHECK enum default `'sent'`, 7-day default expiry) — all RLS-enabled, anon denied.
- Zero objects created in HITO's `public` schema; the 3 public tables sharing these names (staff_profiles/organizations/members) are HITO's pre-existing ones, untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: staff_app schema + org/membership tables + RLS helpers** - `aa0d7e9` (feat)
2. **Task 2: core tables staff_profiles/gigs/crew/offers with RLS** - `80136e1` (feat)

**Plan metadata:** this SUMMARY commit (docs).

## Verification Evidence

Task 1 (`execute_sql` assertions): schema_exists=1; org_count=1; org_uuid=`aa29aa2f-4d34-4e53-b62c-7397e8a4d123`; members_count=0; SECURITY DEFINER helpers=2, both carry search_path; RLS tables=2; anon SELECT on organizations=false. `SELECT extensions.gen_random_bytes(1)` succeeded (pgcrypto confirmed in `extensions` schema).

Task 2 (`execute_sql` assertions): RLS core tables=4; staff_profiles columns=32; organization_id nullable=yes; crew UNIQUE(gig_id,staff_profile_id)=1; gigs.hito_event_id present with 0 FKs; offers.token_hash NOT NULL + UNIQUE; offers.status default `'sent'` with 5-value CHECK; anon SELECT on staff_profiles/offers=false; anon INSERT policies=0.

Advisors: post-`0001` and post-`0002` runs both byte-identical to the pre-migration baseline, 0 `staff_app` mentions.

## Files Created/Modified

- `supabase/migrations/staff_app_0001_schema_orgs.sql` - schema + organizations/members + is_org_member/is_org_writer helpers + seeded SOMOS DER org (mirrors applied migration `staff_app_0001_schema_orgs`).
- `supabase/migrations/staff_app_0002_core_tables.sql` - staff_profiles superset + gigs + crew + offers with RLS policies (mirrors applied migration `staff_app_0002_core_tables`).

## Decisions Made

- **Persist applied migrations as repo SQL files.** This is a pure-SQL/Supabase phase (DDL applied via MCP `apply_migration`), so there were no incidental repo file changes to commit per task. To satisfy GSD atomic-commit contract and keep the DDL version-controlled, each applied migration's SQL was written to `supabase/migrations/` and committed with its task.
- **Own helper names in `staff_app`** rather than reusing `public.is_org_member` — different schema means no collision; RLS policies call the schema-qualified `staff_app.is_org_member`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. (The `get_advisors` MCP output exceeds the tool's inline token limit and is written to a file; handled by grepping the saved file for `staff_app` and tokenized-diffing against the captured baseline — this is a tooling detail, not a plan issue.)

## User Setup Required

None - no external service configuration required. No new Supabase project, no new keys; the existing HITO project URL/anon/service keys are unchanged and already known.

## Next Phase Readiness

- Ready for **01-02** (magic-link RPCs `get_public_offer`/`accept_offer`/`decline_offer`): `staff_app.offers` (token_hash/status/expires_at), `staff_app.crew` (UNIQUE idempotency anchor), and the org helpers are all in place. RPCs will schema-qualify `staff_app.*` and `extensions.digest`/`gen_random_bytes` under a pinned search_path.
- Ready for **01-03** (form repoint + Source-A backfill): `staff_app.staff_profiles` is a drop-in superset of the live form's columns; the anon INSERT policy + `organization_id`-stamp trigger + column grants are intentionally deferred here and land in 01-03.
- Downstream plans must stamp `organization_id = aa29aa2f-4d34-4e53-b62c-7397e8a4d123`.
- No blockers introduced.

## Self-Check: PASSED

- Both migration files exist on disk (`supabase/migrations/staff_app_0001_schema_orgs.sql`, `staff_app_0002_core_tables.sql`).
- `git log --grep="01-01"` returns 2 feat commits (aa0d7e9, 80136e1).
- All task `<acceptance_criteria>` re-verified via live `execute_sql` (evidence above).
- Plan `<verification>` re-run: schema/tables/RLS present, anon denied, zero new public objects, advisors identical to baseline, org UUID recorded.

---
*Phase: 01-own-data-foundation*
*Completed: 2026-07-14*
