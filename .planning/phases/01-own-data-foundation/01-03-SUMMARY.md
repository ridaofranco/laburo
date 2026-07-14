---
phase: 01-own-data-foundation
plan: 03
subsystem: database
tags: [supabase, postgres, security-definer, rpc, intake, cutover, backfill, astro, vercel, staff_app, ley-25326]

requires:
  - phase: 01-own-data-foundation (01-01)
    provides: "staff_app.staff_profiles (31 HITO cols + nullable organization_id) + fixed SOMOS DER org UUID aa29aa2f-4d34-4e53-b62c-7397e8a4d123 + anon USAGE on schema staff_app (from 01-02)"
provides:
  - "public.staff_app_register_applicant(...) — the ONLY Staff App object in public (D-03 sanctioned): SECURITY DEFINER intake RPC, validates nombre/email/telefono, forces organization_id/estado/source, inserts into staff_app.staff_profiles; anon+authenticated EXECUTE, anon has NO direct INSERT on the table"
  - "somosder-web Trabajá-con-nosotros form repointed from direct REST table insert to supabase .rpc('staff_app_register_applicant') — SAME project URL + anon key, CV bucket unchanged; deployed to production (Vercel)"
  - "Ley 25.326-compliant consent notice (names SOMOS DER/DER as data controller + access/rectify/delete rights via rrhh@somosder.com.ar)"
  - "Source-A backfill: 8 frozen HITO applicants copied into staff_app.staff_profiles, id + cv_url intact, org stamped, 8 in = 8 out"
affects: [01-04, phase-2-find-staff, phase-4-accept-loop, phase-6-hito-link]

tech-stack:
  added: []
  patterns:
    - "Public SECURITY DEFINER intake RPC as the single anon write choke point (validation + privileged-column forcing), placed in public so PostgREST exposes it without exposed-schemas config changes"
    - "Cutover-before-backfill: atomic Vercel deploy freezes the old source, then same-project INSERT...SELECT gives exact N in = N out (no delta race)"
    - "Same-project logical migration: read public.*, write staff_app.* only; cv_url stays relative (same bucket) so CV objects need no move"

key-files:
  created:
    - "supabase/migrations/staff_app_0004_intake_function.sql"
    - "supabase/backfills/staff_app_0004_source_a_backfill.sql"
  modified:
    - "/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro (separate repo — NOT git-tracked; shipped via Vercel deploy dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s)"

key-decisions:
  - "Intake function lives in public (not staff_app) — D-03 sanctioned exception so PostgREST serves /rest/v1/rpc/staff_app_register_applicant with no exposed-schemas change; it is the ONLY Staff App object in public and touches zero HITO public.* tables"
  - "Cutover = RPC swap, NOT a URL/key swap (D-03 same project); form lines 13-14 unchanged, CV upload + /api/lead + honeypot untouched"
  - "N captured at cutover = 8 (research said 7; +1 arrived 2026-07-14 01:08) — used the live captured N, not a hardcoded 7"
  - "Consent notice updated to name SOMOS DER (DER) as data controller + state access/rectify/delete rights + rrhh@somosder.com.ar contact (Ley 25.326)"

patterns-established:
  - "Anon intake hardening via a public SECURITY DEFINER RPC: required-field validation raises → PostgREST 400 → form shows honest failure; privileged columns forced server-side; no direct anon table grant"
  - "Persist one-time data migrations under supabase/backfills/ (version-controlled) alongside supabase/migrations/ and supabase/tests/"

requirements-completed: [DATA-03]  # DATA-02 Source-A portion done here; DATA-02 fully completes in 01-04 (Source B)

duration: 8 min
completed: 2026-07-14
---

# Phase 1 Plan 03: Form Repoint + Source-A Backfill (staff_app intake) Summary

**Repointed the live somosder-web staff form to write into `staff_app.staff_profiles` via a new public `staff_app_register_applicant` SECURITY DEFINER intake RPC (same project URL/anon key, CV bucket unchanged), deployed it to production, froze HITO's `public.staff_profiles`, and backfilled its 8 existing applicants into `staff_app` with 8 in = 8 out — cv_url + id intact, advisor-clean.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-14T16:44:30Z
- **Completed:** 2026-07-14T16:52:39Z
- **Tasks:** 3
- **Files created:** 2 (staff-app repo) + 1 modified (somosder-web, non-git, deployed) + 1 applied migration + 1 data migration in the DB

## Key Reference Values

- **Shared project ref:** `luillpzfqzbpoqkgvjuw` (HITO's project; D-03 — no new project, no new keys)
- **Cutover timestamp (UTC):** `2026-07-14T16:50:15Z` (Vercel production deploy READY)
- **N captured at cutover (frozen public.staff_profiles):** **8** (was 7; +1 arrived 2026-07-14 01:08)
- **Vercel production deployment:** `dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s` → aliased to `https://www.somosder.ar`
- **Fixed SOMOS DER org UUID:** `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`
- **New object (the D-03 public exception):** `public.staff_app_register_applicant(...)`

## Accomplishments

- Built `public.staff_app_register_applicant` (SECURITY DEFINER, `SET search_path = staff_app, public, pg_temp`, 24 `p_`-prefixed params matching the form). It validates `nombre/email/telefono`, forces `organization_id`/`estado='pendiente'`/`source='web_somosder'`, and inserts into `staff_app.staff_profiles`. `anon`+`authenticated` hold EXECUTE; anon has **no** direct INSERT on the table (and `staff_app` isn't even PostgREST-exposed).
- Repointed `StaffRegistro.astro`: the direct `POST /rest/v1/staff_profiles` insert became `POST /rest/v1/rpc/staff_app_register_applicant` (same client/URL/anon key). CV upload, `/api/lead` SMTP notify, and the `botcheck` honeypot are unchanged. Deployed to production via Vercel.
- Updated the consent notice to Ley 25.326 compliance (SOMOS DER/DER named as data controller; access/rectify/delete rights; `rrhh@somosder.com.ar`).
- Cut over BEFORE backfilling, freezing HITO's `public.staff_profiles`; captured the live N=8; backfilled all 8 into `staff_app.staff_profiles` (kept `id` + `cv_url`, stamped org) with exact **8 in = 8 out**, zero NULL org, zero dup emails.
- `get_advisors(security)` clean: zero new `function_search_path_mutable` (stays 20); the only advisor delta is the intended `anon`/`authenticated_security_definer_function_executable` entry for the sanctioned intake RPC.

## Task Commits

1. **Task 1: public.staff_app_register_applicant intake RPC + anon hardening** — `c7a62c7` (feat) — `supabase/migrations/staff_app_0004_intake_function.sql`
2. **Task 2: repoint StaffRegistro.astro to the RPC + consent + honest errors + Vercel deploy (the cutover)** — shipped via Vercel deploy `dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s` (somosder-web is NOT a git repo — see Deviations); no staff-app code artifact for this task
3. **Task 3: Source-A backfill (frozen HITO applicants → staff_app), verified** — `8f26de3` (feat) — `supabase/backfills/staff_app_0004_source_a_backfill.sql`

**Plan metadata:** this SUMMARY commit (docs).

## Verification Evidence

**Task 1 (`execute_sql` + `get_advisors`):**
- `pg_proc`: `staff_app_register_applicant` in `public`, `prosecdef=true`, `proconfig=["search_path=staff_app, public, pg_temp"]`.
- `has_function_privilege`: anon EXECUTE=true, authenticated EXECUTE=true. `has_table_privilege('anon','staff_app.staff_profiles','INSERT')=false`.
- `secdef_without_search_path` count: 16 before AND after (my function added zero mutable-search_path findings).
- `get_advisors(security)`: `function_search_path_mutable`=20 (baseline, none reference the new fn); `rls_enabled_no_policy`=4 (baseline); the new fn appears ONLY under `anon_security_definer_function_executable` (85→86) and `authenticated_...` (86→87) — the intended sanctioned door (matches HITO's register_web_lead/capture_lead).

**Task 2 (cutover, live tests against production Supabase with the form's anon key):**
- `grep`: form calls `.../rest/v1/rpc/staff_app_register_applicant`; SUPABASE_URL still `luillpzfqzbpoqkgvjuw` (unchanged); old `rest/v1/staff_profiles` insert gone; consent mentions `25.326` + `rrhh@somosder`; CV upload/`/api/lead`/`botcheck` intact.
- `npm run build`: succeeded (only pre-existing unrelated `Astro.request.headers` warnings). Vercel deploy `readyState: READY`, `target: production`.
- Live RPC POST (anon key, minimal valid body) → **HTTP 200** `{"ok":true,"id":"9f03b438-…"}`; row verified in `staff_app.staff_profiles` with `estado=pendiente`, `source=web_somosder`, `organization_id` correctly stamped; then **deleted** (staff_app count back to 0).
- Honest-error path: POST missing `telefono` → **HTTP 400** `{"code":"23514","message":"telefono es obligatorio"}` (form's `!res.ok` → visible failure, no silent success).
- Direct anon insert into `staff_app.staff_profiles` → blocked (`PGRST106 Invalid schema: staff_app` — schema not exposed) → RPC is the only anon write path.

**Task 3 (backfill, `execute_sql`):**
- Frozen source: `public.staff_profiles` count = **8** (N), all 8 with `cv_url`, 0 dup emails; latest `created_at`=2026-07-14 01:08 (pre-cutover).
- After backfill: `staff_app.staff_profiles` count = **8** (= N); `null_org`=0; `dup_emails`=0; `with_cv`=8; `org_stamped`=8; `id_email_cv_match`=8 (every app row matches a source row by id+email+cv_url); `source_rows_missing_in_app`=0.
- No CV objects moved/copied (same project/bucket); HITO `public.*` read-only.

## Files Created/Modified

- `supabase/migrations/staff_app_0004_intake_function.sql` — the public intake RPC + least-privilege grants + COMMENT (mirrors applied migration `staff_app_0004_intake_function`).
- `supabase/backfills/staff_app_0004_source_a_backfill.sql` — the one-time same-project INSERT...SELECT with the cutover timestamp, N=8, and recorded verification results.
- `somosder-web/src/components/StaffRegistro.astro` *(separate, non-git repo)* — submit handler now calls the RPC; consent notice updated; shipped via Vercel deploy `dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s`.

## Decisions Made

- **Intake RPC in `public`, not `staff_app`** — the D-03-sanctioned single exception, so PostgREST serves it at `/rest/v1/rpc/…` with no exposed-schemas change. It is the ONLY Staff App object in `public`; it reads/writes zero HITO `public.*` tables.
- **Used the live captured N=8**, not the research's stale 7 — the 2026-07-14 01:08 application is included, and cutover-before-backfill kept "8 in = 8 out" exact.
- **`source` dropped from the form's RPC body** — the function forces it; sending an unknown `p_source` would break PostgREST arg matching.

## Deviations from Plan

### Handled Issues

**1. [Rule 3 - Environmental] somosder-web is NOT a git repository**
- **Found during:** Task 2 (the plan/orchestrator assumed a second git repo with its own history).
- **Issue:** `/Users/fridao/Proyectos/SOMOS DER/somosder-web` has no `.git` at or above it — it deploys to Vercel via the CLI (`.vercel/project.json`, project `prj_x4Ovnphc24G0tGEmi4UHcPSsKRcz`), not via git. The form change therefore cannot be "committed" there.
- **Fix:** Made the edit and shipped it via the repo's actual mechanism — a Vercel production deploy (`vercel --prod`, authed as `ridaofranco-8135`). The immutable deployment `dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s` is the audit anchor in lieu of a commit; the full diff is documented in this SUMMARY and the change verified live against production.
- **Verification:** deploy `READY`/`production`; live RPC test passed end-to-end.

**2. [Rule 2 - Missing Critical] Consent contact/rights were unspecified**
- **Found during:** Task 2 (Ley 25.326 consent verification).
- **Issue:** the existing consent only said "DER guarde mis datos" — no controller identity clarity, no data-subject rights, no contact.
- **Fix:** rewrote es/en consent to name SOMOS DER (DER) as data controller, state access/rectify/delete rights, and give the real careers contact `rrhh@somosder.com.ar` (from `somosder-web/src/data/site.ts`).

---

**Total deviations:** 2 handled (1 environmental, 1 missing-critical). **Impact:** no scope creep; the cutover and hardening shipped as intended. The only structural difference is that the form change is version-anchored by a Vercel deployment ID rather than a git commit, because the target repo is not under git.

## Issues Encountered

- `get_advisors(security)` output (~210K chars) exceeds the MCP inline limit and is saved to a file; verified by grepping the saved file for lint-name counts and the new function's categories (same tooling detail as 01-01/01-02, not a plan issue).
- `vercel` was not on PATH; used `npx vercel` (reads the existing global auth as `ridaofranco-8135`).

## User Setup Required

None — no new Supabase project, no new keys, no dashboard config. The form uses the unchanged project URL + anon key; the `staff-cvs` bucket is untouched.

## Next Phase Readiness

- **01-04 (Source B import)** is unblocked: `staff_app.staff_profiles` holds the 8 Source-A rows (dedup key = `email`); the Google-Sheet ~711 import must dedup against these and normalize location. **DATA-02 is only partially complete** (Source A done here; Source B completes in 01-04) — DATA-03 is fully complete.
- Live intake is now flowing into `staff_app` via the hardened RPC; HITO `public.staff_profiles` is frozen and left read-only.
- No blockers introduced.

## Self-Check: PASSED

- Both staff-app files exist on disk (`supabase/migrations/staff_app_0004_intake_function.sql`, `supabase/backfills/staff_app_0004_source_a_backfill.sql`).
- `git log --grep="01-03"` returns 2 feat commits (c7a62c7, 8f26de3) + this docs commit.
- All task `<acceptance_criteria>` re-verified via live `execute_sql`, `curl`, `get_advisors`, and the Vercel deploy (evidence above).
- Plan `<verification>` re-run: RPC live + org-stamped test insert + honest errors; advisor clean vs baseline; staff_app.staff_profiles = N (8), zero NULL org, zero dup emails, cv_url intact; no CV objects moved; HITO public.* read-only.

---
*Phase: 01-own-data-foundation*
*Completed: 2026-07-14*
