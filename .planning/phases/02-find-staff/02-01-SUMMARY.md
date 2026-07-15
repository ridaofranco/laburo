---
phase: 02-find-staff
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-invoker-views, pg_trgm, security-definer, staff_app]

requires:
  - phase: 01-own-data-foundation
    provides: "staff_app schema + org-scoped RLS tables (staff_profiles 687 rows, members, gigs, crew), is_org_member/is_org_writer helpers, org UUID aa29aa2f-4d34-4e53-b62c-7397e8a4d123"
provides:
  - "public.staff_app_profiles — security_invoker view over staff_app.staff_profiles (26 display cols); the SRCH-01/02 + PERF-01 read surface"
  - "public.staff_app_my_membership — security_invoker view filtered to auth.uid(); the D-06 gate source (0 rows = denied, .maybeSingle()-safe)"
  - "public.staff_app_crew_busy — security_invoker view (DISTINCT staff_profile_id from crew⋈gigs); SRCH-02 'ocultar ya asignados' source"
  - "Search indexes: staff_profiles_oficios_gin (GIN), staff_profiles_provincia (btree), staff_profiles_nombre_trgm (pg_trgm, in extensions schema)"
  - "2 seeded staff_app.members owner rows (both admin auth.users ids) — D-06 gate live on first login"
  - "public.staff_app_provision_member() — SECURITY DEFINER, authenticated-only, allowlist self-provision RPC (login-time D-06 fallback for 02-02 /auth/callback)"
  - "WR-04 closed: members_role_check CHECK + is_org_writer enumerate-allowed"
affects: [02-02, 02-03, 02-04, phase-3-offers, phase-4-accept-loop]

tech-stack:
  added: [pg_trgm (extensions schema)]
  patterns:
    - "public security_invoker views over a non-PostgREST-exposed schema (staff_app) → RLS enforced as the querying JWT role, zero pgrst.db_schemas change"
    - "authenticated granted base-table SELECT on staff_app.* so security_invoker views resolve (RLS still gates rows); anon explicitly REVOKEd on the public views"
    - "SECURITY DEFINER self-provision RPC reading auth.uid()/auth.email() server-side with an in-DB allowlist; per-function REVOKE FROM PUBLIC/anon is the enforced not-anon-callable control"

key-files:
  created:
    - "supabase/migrations/staff_app_0006_hardening.sql"
    - "supabase/migrations/staff_app_0007_read_layer.sql"
  modified: []

key-decisions:
  - "security_invoker views require the invoking role's own base-table privileges → granted authenticated SELECT on staff_app.{staff_profiles,members,crew,gigs} (RLS still returns 0 rows to non-members; staff_app stays PostgREST-unexposed)"
  - "Supabase public-schema DEFAULT PRIVILEGES auto-grant anon on any new public view → explicit REVOKE ALL ... FROM anon on the 3 views is required (a bare GRANT TO authenticated does not keep anon out)"
  - "staff_app_my_membership MUST filter WHERE user_id = auth.uid() — members_select RLS scopes to the caller's ORG (all member rows visible), so an unfiltered view returns every admin's row and breaks the gate's .maybeSingle()"
  - "WR-05 ALTER DEFAULT PRIVILEGES REVOKE FROM PUBLIC records no catalog entry on this managed project (empirically verified); enforced not-anon-callable control is the per-function REVOKE, applied to the provision RPC"

patterns-established:
  - "Pattern: expose an app-owned non-exposed schema through public security_invoker views + authenticated base grants + explicit anon REVOKE"
  - "Pattern: impersonated-JWT SQL proofs via BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=...; assert; COMMIT"

requirements-completed: [SRCH-01, SRCH-02]

duration: 27 min
completed: 2026-07-15
---

# Phase 2 Plan 01: DB Read Layer (security-invoker views) + Phase-1 Hardening Summary

**Public security-invoker views over the non-exposed `staff_app` schema (profiles/membership/crew-busy) with RLS-enforced org scoping, search indexes (oficios GIN + provincia + pg_trgm), 2 seeded admin owners + an authenticated-only self-provision RPC, plus the WR-04/WR-05 Phase-1 REVIEW fixes — advisor-clean except the one sanctioned SECURITY DEFINER RPC.**

## Performance

- **Duration:** ~27 min
- **Completed:** 2026-07-15T13:45:37Z
- **Tasks:** 2 (both committed atomically)
- **Files created:** 2 SQL migrations (applied via Supabase MCP `apply_migration`)

## Live Pre-Checks (A2 / A4) — recorded

- **A2 (admin emails in `auth.users`):** BOTH exist → `franco@somosder.ar` = `37987a10-d822-437a-b158-af8cc27cf54e`, `ridaofrancorg@gmail.com` = `73fc15e0-69a6-4fc2-a832-696bd6f0f95c`. ⇒ both pre-seeded in Task 2 (no callback fallback strictly needed, but the RPC is built as the robust fallback).
- **A4 (`pg_trgm`):** available (`default_version 1.6`, not yet installed) ⇒ created `WITH SCHEMA extensions` + trigram GIN index on `nombre`.
- **Next free migration numbers:** confirmed 0006 / 0007 (latest staff_app migration was 0005).

## get_advisors(security) Baseline & Diff

- **Working baseline (before 0006):** 203 lints. staff_app mentions = exactly **2**, both for the Phase-1 `public.staff_app_register_applicant` RPC (`anon_` + `authenticated_security_definer_function_executable`). Category counts: anon_sec_def 86, authenticated_sec_def 87, function_search_path_mutable 20, rls_enabled_no_policy 4, rls_policy_always_true 2, public_bucket_allows_listing 2, extension_in_public 1, auth_leaked_password_protection 1.
- **After 0006:** byte-identical (203 lints, zero NEW staff_app lints).
- **After 0007:** 204 lints. **Only NEW staff_app lint = `staff_app_provision_member` under `authenticated_security_definer_function_executable` (87→88)** — the sanctioned door, same category as the 0004 intake RPC. `anon_security_definer_function_executable` unchanged (86→86, provision RPC not anon-callable). `function_search_path_mutable` unchanged (20). **No `security_definer_view` lint** (views are security_invoker). `extension_in_public` unchanged (pg_trgm went to `extensions`, not `public`).

## Accomplishments

- **WR-04 closed:** `staff_app.members` now has `members_role_check CHECK (role IN ('owner','writer','viewer'))`; `staff_app.is_org_writer` redefined to enumerate-allowed `role IN ('owner','writer')` (was fail-open `role <> 'viewer'`), still SECURITY DEFINER STABLE with `search_path=''`.
- **3 public security_invoker views** exposing `staff_app.*` with zero `pgrst.db_schemas` change; RLS enforced as the JWT role.
- **Search indexes:** `staff_profiles_oficios_gin`, `staff_profiles_provincia`, `staff_profiles_nombre_trgm` (pg_trgm in `extensions`).
- **2 admin `members` owner rows** seeded → D-06 gate live on first login.
- **`public.staff_app_provision_member()`** — authenticated-only self-provision RPC (login-time D-06 fallback).

## Task Commits

1. **Task 1: WR-04/WR-05 hardening** — `7e178bb` (feat) — `supabase/migrations/staff_app_0006_hardening.sql`
2. **Task 2: read layer + indexes + seed + provision RPC** — `0527e93` (feat) — `supabase/migrations/staff_app_0007_read_layer.sql`

**Plan metadata:** this SUMMARY commit (docs).

## Verification Evidence (live `execute_sql`)

**Task 1**
- `members_role_check` present on `staff_app.members`: `CHECK ((role = ANY (ARRAY['owner','writer','viewer'])))`. (A same-named constraint exists on HITO's `public.members` — different table, allowed.)
- `is_org_writer` body contains `role IN ('owner','writer')`, does NOT contain `<> 'viewer'`; `prosecdef=true`, `proconfig=[search_path=""]`.
- Advisor diff after 0006: identical to baseline, 0 new staff_app lints.

**Task 2 — structure**
- 3 views `staff_app_profiles` / `staff_app_my_membership` / `staff_app_crew_busy` exist with `security_invoker=true`.
- View grants: `authenticated` SELECT = true on all 3; `anon` SELECT = **false** on all 3 (after explicit REVOKE).
- Indexes present: `{staff_profiles_nombre_trgm, staff_profiles_oficios_gin, staff_profiles_provincia}`.
- Seeded `staff_app.members`: 2 rows, both `role='owner'`, org `aa29aa2f-4d34-4e53-b62c-7397e8a4d123` (both admin user_ids).
- `staff_app_provision_member`: `prosecdef=true`, `proconfig=[search_path=staff_app, pg_temp]`; `has_function_privilege(anon,…)=false`, `has_function_privilege(authenticated,…)=true`.

**Task 2 — impersonated-JWT proofs**
- **Non-member** (`SET LOCAL ROLE authenticated` + claims `curioso@gmail.com`, random uid): `staff_app_profiles` = **0 rows**, `staff_app_my_membership` = **0 rows**, `staff_app_crew_busy` = 0.
- **Seeded admin** (claims `ridaofrancorg@gmail.com` / its uid): `staff_app_profiles` = **687**, `staff_app_my_membership` = **exactly 1 row**, role `owner`, org `aa29aa2f-…` (after the `WHERE user_id = auth.uid()` fix — see Deviations).
- **Provision, allowlisted + not pre-seeded** (deleted the admin's seed, then RPC): first call returned `{organization_id, role:"owner"}`; post-commit `staff_app.members` for that user = **exactly 1** row; second call returned the membership again with count still **1** (idempotent, `ON CONFLICT DO NOTHING`).
- **Provision, non-allowlisted** (claims `intruso@gmail.com`): returned **NULL**, created **0 rows**.
- **Final members state:** 2 rows (both admins, `owner`); 0 intruso rows.

## Decisions Made

See frontmatter `key-decisions`. The three environment-driven ones (base-table grants for security_invoker; explicit anon REVOKE vs Supabase default privileges; `auth.uid()` filter on the membership view) were all forced by live behavior and verified with before/after SQL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Granted `authenticated` base-table SELECT on `staff_app.{staff_profiles,members,crew,gigs}`**
- **Found during:** Task 2 (pre-write privilege check).
- **Issue:** `security_invoker` views check the INVOKER's privileges on the base relations. 0002 revoked all `staff_app` table privileges from `authenticated`, so the views would raise `permission denied` (not return 0 rows) for any authenticated caller — breaking both the gate and the 0-rows-for-non-member proof.
- **Fix:** `GRANT SELECT` on the 4 base tables to `authenticated` in 0007. RLS (`is_org_member`) still returns 0 rows to non-members; `staff_app` remains PostgREST-unexposed so there is no new REST reach; `anon` was NOT granted.
- **Verification:** non-member proof returns 0 rows (not an error); admin sees 687.
- **Committed in:** `0527e93`.

**2. [Rule 2 - Missing Critical] Explicit `REVOKE ALL ... FROM anon` on the 3 public views**
- **Found during:** Task 2 (post-apply grant check showed `anon` SELECT = true).
- **Issue:** Supabase's `public`-schema DEFAULT PRIVILEGES auto-grant `anon`/`authenticated`/`service_role` full privileges on every new `public` table/view created by `postgres`. So `GRANT SELECT ... TO authenticated` alone left `anon` with SELECT on the views (threat T-02-01 / D-06). (No data actually leaks — `anon` lacks base-table SELECT, so a view query errors rather than returning rows — but the grant must be removed.)
- **Fix:** `REVOKE ALL ON` each of the 3 views `FROM anon` in 0007.
- **Verification:** `has_table_privilege('anon', <view>, 'SELECT')` = false on all 3.
- **Committed in:** `0527e93`.

**3. [Rule 1 - Bug] `staff_app_my_membership` must filter `WHERE user_id = auth.uid()`**
- **Found during:** Task 2 (seeded-admin proof returned 2 membership rows).
- **Issue:** The plan/RESEARCH view was `SELECT organization_id, role FROM staff_app.members`, relying on `members_select` RLS "to scope to the caller." But `members_select` scopes to the caller's ORG (every member row of that org is visible), so an admin in the 2-admin SOMOS DER org saw BOTH rows. The Phase-2 gate (Pattern 2) uses `.maybeSingle()`, which raises on >1 row → the gate would break for both admins, and the view leaked the other admin's row.
- **Fix:** Added `WHERE user_id = auth.uid()` so the view returns the caller's OWN row(s) only; security_invoker + RLS kept as defense-in-depth.
- **Verification:** re-ran the admin proof → exactly 1 row (`owner`); non-member still 0.
- **Committed in:** `0527e93`.

**4. [Rule 2 - Environment Limitation] WR-05 `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM PUBLIC` is a no-op on this managed project**
- **Found during:** Task 1 (post-apply probe).
- **Issue:** The plan's WR-05 fix (make future `staff_app` functions not-anon-callable by default) does not take effect here: a bare `ALTER DEFAULT PRIVILEGES IN SCHEMA staff_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` records **no** `pg_default_acl` entry (verified: a probe function created afterward still carries `=X` PUBLIC and is anon-executable). A `GRANT` form does persist, but its entry is additive — the built-in `PUBLIC=EXECUTE` default remains. There is no global (`defaclnamespace=0`) default at play. In vanilla/self-hosted Postgres the same statement DOES create the subtractive entry.
- **Fix / disposition:** Kept the statement in `0006` for replay-correctness + documented intent (with an inline ENVIRONMENT NOTE). The ENFORCED not-anon-callable control remains the mandatory **per-function** `REVOKE EXECUTE ... FROM PUBLIC` — the Phase-1 convention, applied to `public.staff_app_provision_member` in 0007 (verified `anon` cannot execute it). Residual latent risk is bounded: `staff_app` is not PostgREST-exposed (`PGRST106`), so anon cannot reach any `staff_app` function over REST regardless.
- **Verification:** provision RPC `has_function_privilege('anon',…,'EXECUTE')=false`; advisor `anon_security_definer_function_executable` count unchanged.
- **Committed in:** `7e178bb` (statement + note).

---

**Total deviations:** 4 auto-fixed (3 Rule-2/Rule-1 correctness+security additions to make the security_invoker view model actually work + gate-safe; 1 documented environment limitation).
**Impact on plan:** All essential for correctness/security; no scope creep. The three additive fixes are required for the plan's own acceptance criteria (0-rows-for-non-member, anon-locked-out, `.maybeSingle()`-safe gate) to hold. WR-05's mechanism was substituted by the already-mandatory per-function control with the gap documented.

## Applied-migration vs file note

Migrations 0006/0007 were applied via MCP, then three corrective statements (anon REVOKE on the 3 views; the `auth.uid()` filter on `staff_app_my_membership`; documentary WR-05 revoke) were applied via `execute_sql` during verification. The committed `.sql` files are the authoritative, replay-correct source and MATCH live state (all re-verified). The `supabase_migrations` recorded query text for 0007 predates the two view corrections; the repo files supersede it.

## Issues Encountered

- The `get_advisors(security)` MCP output exceeds the tool's inline token limit (~211 KB); handled by saving to file and diffing category counts + staff_app lints programmatically (same discipline as Phase 1).
- `execute_sql` returns a single result set per call; impersonation/idempotency proofs were structured so the assertion is unambiguous (isolated verify SELECTs where CTE evaluation-order made an inline count unreliable).

## User Setup Required

None — pure SQL applied via MCP; no new Supabase project, keys, or external service config. (LABURO Vercel-domain redirect-allowlist + env vars are 02-02's concern.)

## Next Phase Readiness

- **02-02** (Next.js scaffold + login + membership gate) can query `public.staff_app_my_membership` (`.maybeSingle()`-safe now) for the D-06 gate, and call `supabase.rpc('staff_app_provision_member')` in `/auth/callback` as the login-time provisioning fallback. Both admins are already seeded, so the gate is live on first login without the callback.
- **02-03** (search UI) queries `public.staff_app_profiles` with `.overlaps('oficios',…)` (GIN), `.eq('provincia',…)` (btree), `.ilike` on `nombre` (trigram) — indexes in place. SRCH-01/SRCH-02 are foundation-complete here; user-facing delivery lands in 02-03/02-04.
- **No blockers.** Note carried forward: WR-05 default-privilege hardening is documented-not-effective on this managed project; every new `staff_app` function MUST keep the explicit per-function `REVOKE EXECUTE FROM PUBLIC/anon`.

## Self-Check: PASSED

- Both migration files exist on disk and were applied via MCP.
- `git log --grep="02-01"` returns 2 feat commits (`7e178bb`, `0527e93`).
- All Task 1 + Task 2 `<acceptance_criteria>` re-verified via live `execute_sql` (evidence above), including the impersonated-JWT proofs (non-member 0 rows; admin 687 + 1 owner membership; allowlisted provision 1 idempotent row; non-allowlisted NULL + 0 rows; anon cannot execute).
- Advisor diff clean: only the sanctioned `staff_app_provision_member` under `authenticated_security_definer_function_executable`; no `security_definer_view`; anon category unchanged.

---
*Phase: 02-find-staff*
*Completed: 2026-07-15*
