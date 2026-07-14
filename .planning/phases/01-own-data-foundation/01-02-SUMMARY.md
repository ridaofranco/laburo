---
phase: 01-own-data-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, security-definer, rpc, magic-link, pgcrypto, sha256, rls, staff_app]

requires:
  - phase: 01-own-data-foundation (01-01)
    provides: "staff_app schema + offers (token_hash/status/expires_at) + crew (UNIQUE gig_id+staff_profile_id) + seeded org UUID aa29aa2f-4d34-4e53-b62c-7397e8a4d123 + is_org_member/is_org_writer helpers"
provides:
  - "staff_app.get_public_offer(text) — GET-safe SECURITY DEFINER read: first name + offer/gig/org only, flips sent->viewed; returns NULL for a bad token"
  - "staff_app.accept_offer(text,text) — POST-invoked SECURITY DEFINER: atomic single crew INSERT (ON CONFLICT DO NOTHING) + offer accepted; guards status IN (sent,viewed) AND expires_at > now()"
  - "staff_app.decline_offer(text) — POST-invoked SECURITY DEFINER: same token+status+expiry guard, flips to declined"
  - "anon+authenticated EXECUTE on exactly those 3 RPCs; anon schema USAGE granted; helpers locked to authenticated (no other anon-callable function in staff_app)"
  - "SQL-provable full offer lifecycle (accept/decline/expire/replay/garbage) with clean get_advisors"
affects: [01-03, phase-4-accept-loop, phase-3-create-offers, phase-6-hito-link]

tech-stack:
  added: []
  patterns:
    - "Magic-link SECURITY DEFINER RPCs with pinned SET search_path = staff_app, pg_temp + schema-qualified extensions.* (staff_app tables resolve via search_path)"
    - "256-bit token (extensions.gen_random_bytes(32)) hashed at rest as sha256 hex token_hash; raw token never persisted; RPC hashes the incoming raw token to match"
    - "In-RPC expiry + single-use guard (status IN ('sent','viewed') AND expires_at > now()); idempotency via crew UNIQUE(gig_id,staff_profile_id) ON CONFLICT DO NOTHING"
    - "Least-privilege anon exposure: REVOKE default PUBLIC EXECUTE, GRANT only the intended RPCs; grant schema USAGE so the EXECUTE grant is reachable; lock helpers to authenticated"

key-files:
  created:
    - "supabase/migrations/staff_app_0003_magic_link_rpcs.sql"
    - "supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql"
  modified: []

key-decisions:
  - "Granted anon USAGE ON SCHEMA staff_app (0001 had revoked it) — required so the RPC EXECUTE grants are actually reachable; the security boundary is only real if anon can call the three doors"
  - "Locked staff_app.is_org_member/is_org_writer from PUBLIC to authenticated-only — once anon holds schema USAGE, keeping the default PUBLIC EXECUTE would make the helpers anon-callable, violating 'no other anon-callable function in staff_app'"
  - "Second accept on an accepted token returns {ok:false, reason:'invalid_or_expired'} (benign, no second crew insert) — Phase 4 UI must translate this to an 'already accepted' message (existing STATE.md todo)"
  - "get_public_offer is VOLATILE plpgsql (not STABLE sql) so it can flip sent->viewed on first hit and still return the payload"

patterns-established:
  - "Persist SQL test harnesses under supabase/tests/ (version-controlled, re-runnable) — the pure-SQL analog of persisting migrations under supabase/migrations/"
  - "Read persisted RPC side effects in a SEPARATE execute_sql statement from the RPC call (a sibling sub-SELECT reads the statement-start MVCC snapshot and shows pre-write values)"

requirements-completed: [DATA-04]

duration: 18 min
completed: 2026-07-14
---

# Phase 1 Plan 02: Magic-Link RPCs (staff_app) Summary

**Three SECURITY DEFINER magic-link RPCs (`get_public_offer`/`accept_offer`/`decline_offer`) in `staff_app` with 256-bit sha256-hashed single-use expiring tokens, in-RPC expiry enforcement, atomic idempotent crew creation, PII-safe reads, and a 7-case SQL harness proving the full offer lifecycle — advisor-clean vs the 01-01 baseline.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-14T16:26:00Z
- **Completed:** 2026-07-14T16:44:00Z
- **Tasks:** 2
- **Files created:** 2 (1 migration + 1 test harness) + 1 applied migration in the DB

## Key Reference Values

- **Shared project ref:** `luillpzfqzbpoqkgvjuw` (HITO's project; D-03 co-location — no new project, no new keys)
- **Migration applied:** `staff_app_0003_magic_link_rpcs`
- **RPC signatures (all `staff_app`, all SECURITY DEFINER, `SET search_path = staff_app, pg_temp`):**
  - `staff_app.get_public_offer(p_token text) RETURNS jsonb` — VOLATILE
  - `staff_app.accept_offer(p_token text, p_user_agent text) RETURNS jsonb`
  - `staff_app.decline_offer(p_token text) RETURNS jsonb`
- **anon grants:** EXECUTE on those 3 RPCs only + USAGE on schema `staff_app`. Helpers `is_org_member`/`is_org_writer` are authenticated-only (NOT anon-callable).
- **Fixed SOMOS DER org UUID:** `aa29aa2f-4d34-4e53-b62c-7397e8a4d123` (used to stamp harness seed rows)

## Accomplishments

- Built the three magic-link RPCs, cloning HITO `00008_proposal_acceptance.sql`'s shape and closing its two documented gaps: **256-bit token hashed at rest** (`token_hash = encode(extensions.digest(raw,'sha256'),'hex')`, raw never stored) and **`expires_at > now()` enforced inside the state-changing RPCs**.
- `get_public_offer` returns ONLY safe display fields — offer role/amount/conditions/status/expires_at, gig title/dates/venue, org name, applicant **first name** (`split_part(nombre,' ',1)`) — and never cv_url/email/telefono/documento or other applicants; flips `sent->viewed` + sets `viewed_at` on first hit; returns NULL for a non-matching token.
- `accept_offer` is a single atomic transaction: guard → `INSERT INTO crew ... ON CONFLICT (gig_id, staff_profile_id) DO NOTHING` → `UPDATE offers SET status='accepted'`; returns `{ok:true,crew_id}` or `{ok:false,reason:'invalid_or_expired'}`.
- Least-privilege exposure: stripped default PUBLIC EXECUTE, granted the 3 RPCs to anon+authenticated, granted anon schema USAGE (so the grant is reachable), and locked the org helpers to authenticated-only — verified that **exactly** the 3 RPCs are anon-callable in `staff_app`.
- Ran the full 7-case SQL harness against real seeded `staff_app.*` rows and cleaned up, leaving all four tables empty for the real backfill.
- `get_advisors(security)` after the migration contains **0 `staff_app` mentions** and **0** references to the three RPCs → zero NEW `function_search_path_mutable` vs the 01-01 baseline.

## Task Commits

Each task was committed atomically:

1. **Task 1: three hardened magic-link RPCs in staff_app** — `703aeed` (feat)
2. **Task 2: 7-case SQL test harness** — `4ec5d1e` (test)

**Plan metadata:** this SUMMARY commit (docs).

## SQL Test Harness — Recorded Results (all 7 cases PASS)

Executed via Supabase MCP `execute_sql` against the seeded org, all rows in `staff_app.*`:

| # | Case | Assertion | Actual result |
|---|------|-----------|---------------|
| 1 | Seed | staff_profile + gig + offer inserted; token entropy | `gen_random_bytes(32)` → 64 hex chars (256-bit); `token_hash` = 64-hex sha256; offer status `sent` |
| 2 | Token at rest | only hash stored | `token_hash_hex_len = 64`; raw token never written |
| 3 | `get_public_offer(valid)` | safe fields only, no PII, sent→viewed | `ok:true`; keys = offer/gig/org/applicant(first_name="Juan"); `leaks_cv_url/email/telefono/documento = false`; **persisted** `status='viewed'`, `viewed_at` set |
| 4 | first `accept_offer(valid)` | ok:true, 1 crew, accepted | `{ok:true,crew_id:4d681e3a-…}`; `crew_count=1`; offer `status='accepted'`, `responded_at` set |
| 5 | second `accept_offer(same)` | idempotent no-op | `{ok:false,reason:'invalid_or_expired'}`; `crew_count` still **1** (no second insert) |
| 6 | expired token | accept + decline reject, 0 crew added | accept `{ok:false,invalid_or_expired}`; decline `{ok:false,invalid_or_expired}`; `crew_count_total=1`; expired offer still `sent` (untouched) |
| 7 | garbage token | no leak | `get_public_offer` → `NULL`; accept/decline → `{ok:false,invalid_or_expired}`; `crew_count_total=1` |
| — | Cleanup | staff_app.* empty | `crew=0, offers=0, gigs=0, staff_profiles=0` |

Deployed-body guard verification (`pg_get_functiondef`): `accept_offer` and `decline_offer` both contain `status IN ('sent','viewed')` AND `expires_at > now()` AND `extensions.digest(p_token,'sha256')`; `accept_offer` contains `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING`.

## Verification Evidence

- `pg_proc`: 3 RPCs in `staff_app`, all `prosecdef=true`, each `proconfig = ["search_path=staff_app, pg_temp"]`.
- `has_function_privilege('anon', …)`: true for all 3 RPCs; false for both helpers; `has_schema_privilege('anon','staff_app','USAGE')=true`.
- Anon-callable enumeration of `staff_app` functions returns **exactly** `accept_offer`, `decline_offer`, `get_public_offer`.
- `get_advisors(security)` saved output (205,326 chars): `grep` counts — `staff_app`=0, `get_public_offer`=0, `accept_offer`=0, `decline_offer`=0; `function_search_path_mutable` string count 60 = the 20 pre-existing HITO findings (baseline, ×3 per finding), none referencing staff_app.

## Files Created/Modified

- `supabase/migrations/staff_app_0003_magic_link_rpcs.sql` — the three RPCs + grants + least-privilege lockdown + Phase-4 REST-exposure note (COMMENT ON SCHEMA + header). Mirrors the applied migration `staff_app_0003_magic_link_rpcs`.
- `supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql` — version-controlled, re-runnable 7-case harness (seed → assert → cleanup) with expected-value comments.

## Decisions Made

- **Granted anon `USAGE ON SCHEMA staff_app`** (0001 had revoked it). Without it the RPC EXECUTE grants are inert and anon literally cannot call the three doors — the whole threat-model boundary ("anon reaches offers only via the 3 RPCs") requires this. It does NOT grant table access (RLS + no table grants still deny). See Deviations.
- **Locked `is_org_member`/`is_org_writer` from PUBLIC to authenticated-only.** They carried the default PUBLIC EXECUTE; once anon has schema USAGE that would make them anon-callable, breaking the "no other anon-callable function" criterion. Authenticated retains EXECUTE (RLS policies need it in Phase 2). See Deviations.
- **Phase-4 REST-exposure recorded, not built:** because the RPCs live in `staff_app` (not `public`), Phase 4 must either expose `staff_app` in the project's exposed-schemas config OR add thin `public` wrappers. Documented in the migration header and `COMMENT ON SCHEMA staff_app`. No wrappers built.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Grant anon USAGE on schema staff_app**
- **Found during:** Task 1 (grants)
- **Issue:** Plan specified only `GRANT EXECUTE ... TO anon` on the 3 RPCs. But migration 01-01 ran `REVOKE ALL ON SCHEMA staff_app FROM anon`, so an EXECUTE grant alone is unreachable — anon cannot invoke a function in a schema it has no USAGE on. The security boundary would be a dead grant.
- **Fix:** Added `GRANT USAGE ON SCHEMA staff_app TO anon, authenticated`. Verified `has_schema_privilege('anon','staff_app','USAGE')=true` and that anon still cannot SELECT any staff_app table (RLS + no table grants).
- **Files modified:** supabase/migrations/staff_app_0003_magic_link_rpcs.sql
- **Verification:** anon-callable function enumeration returns exactly the 3 RPCs; advisor clean.
- **Committed in:** `703aeed` (Task 1 commit)

**2. [Rule 1 - Correctness] Lock org helpers from PUBLIC to authenticated**
- **Found during:** Task 1 (least-privilege check)
- **Issue:** `staff_app.is_org_member`/`is_org_writer` had the default PUBLIC EXECUTE. After granting anon schema USAGE (deviation 1), PUBLIC-execute would make them anon-callable, violating the acceptance criterion "no other anon-callable function exists in staff_app."
- **Fix:** `REVOKE ALL ... FROM PUBLIC` on both helpers, then `GRANT EXECUTE ... TO authenticated` (RLS policy evaluation for signed-in users in Phase 2 needs it). anon now has no path to the helpers.
- **Files modified:** supabase/migrations/staff_app_0003_magic_link_rpcs.sql
- **Verification:** `has_function_privilege('anon', helper, 'EXECUTE')=false`; `authenticated`=true.
- **Committed in:** `703aeed` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical, 1 correctness).
**Impact on plan:** Both are grant-hardening necessary to make the anon security boundary real and to satisfy the "only the 3 RPCs are anon-callable" criterion. No scope creep, no new objects beyond the plan's three RPCs, zero writes to HITO public.*.

## Issues Encountered

- **MVCC snapshot artifact in the harness (not an RPC bug):** a sibling sub-SELECT reading `offers.status` in the SAME statement as the `get_public_offer` call showed `sent` while the RPC's returned JSON correctly showed `viewed`. Within one SQL statement all reads use the statement-start snapshot, so the in-statement UPDATE isn't visible to a sibling read. Confirmed the flip persisted with a fresh statement (`status='viewed'`, `viewed_at` set). Harness restructured to read persisted side effects in separate statements; documented in the harness file header.
- The `get_advisors` MCP output (205K chars) exceeds the tool's inline token limit; handled by grepping the saved file for `staff_app`/RPC names (same tooling detail as 01-01), not a plan issue.

## User Setup Required

None - no external service configuration required. No new Supabase project, no new keys; the existing HITO project keys are unchanged.

## Next Phase Readiness

- **01-03** (form repoint + Source-A backfill) is unblocked: `staff_app.staff_profiles` awaits the anon INSERT policy + `organization_id`-stamp trigger + column grants (deferred here as planned). Note: 01-02 granted anon USAGE on the schema, which 01-03's anon-INSERT work can rely on.
- **Phase 3** (create & send offers): the app will generate the raw 256-bit token server-side, store only its sha256 hash into `offers.token_hash`, and email the raw token — matching these RPCs exactly.
- **Phase 4** (accept loop): must (a) expose `staff_app` via PostgREST OR add `public` wrappers to reach the RPCs from the anon client, and (b) translate the accepted-token `{ok:false,reason:'invalid_or_expired'}` into a friendly "already accepted" message (existing STATE.md todo). accept/decline are POST-only — never wire them to a GET/preview fetch.
- No blockers introduced.

## Self-Check: PASSED

- Both files exist on disk (`supabase/migrations/staff_app_0003_magic_link_rpcs.sql`, `supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql`).
- `git log --grep="01-02"` returns 1 feat + 1 test commit.
- All task `<acceptance_criteria>` re-verified via live `execute_sql` (evidence above): 3 SECURITY DEFINER RPCs with pinned search_path; exactly 3 anon-callable; guards present; no PII keys in get_public_offer; 7 harness cases pass; staff_app.* empty after cleanup.
- Plan `<verification>` re-run: pg_proc/grants correct, get_advisors zero NEW staff_app findings, harness all-pass + cleanup empty.

---
*Phase: 01-own-data-foundation*
*Completed: 2026-07-14*
