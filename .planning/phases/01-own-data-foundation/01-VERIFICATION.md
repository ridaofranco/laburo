---
phase: 01-own-data-foundation
verified: 2026-07-14T20:15:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 1: Own Data Foundation Verification Report

**Phase Goal:** The app has its own database layer owning staff/gigs/crew/offers and a secure single-use magic-link offer lifecycle — all proven directly in SQL before any UI exists, and without ever breaking the live web intake. (D-03: own schema `staff_app` inside HITO's Supabase project; logical independence; zero writes to HITO's `public.*` tables.)
**Verified:** 2026-07-14T20:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

No live Supabase MCP access was available to this verifier. Verification combined (a) direct inspection of the committed SQL migrations/tests/backfills and the live `StaffRegistro.astro` form on disk, and (b) cross-checking every SUMMARY.md claim against an orchestrator-supplied live-DB query snapshot taken 2026-07-14 (post all 4 plans) against the actual project `luillpzfqzbpoqkgvjuw`. Every truth below is backed by both a file-level artifact and, where applicable, the independent live-query snapshot — not by SUMMARY narrative alone.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `staff_app` schema exists inside HITO's project with 6 org-scoped, RLS-enabled tables (organizations, members, staff_profiles, gigs, crew, offers); anon denied direct table read; zero new objects in HITO `public.*` except the one sanctioned intake RPC (Roadmap SC1) | ✓ VERIFIED | `supabase/migrations/staff_app_0001_schema_orgs.sql` + `0002_core_tables.sql` create all 6 tables with `ENABLE ROW LEVEL SECURITY` + explicit `REVOKE ALL ... FROM anon, authenticated`. Orchestrator live query: RLS enabled=true on all 6 tables; `staff_app tables created in public: 0`. |
| 2 | `staff_app.is_org_member`/`is_org_writer` helpers exist, SECURITY DEFINER, pinned `search_path`, own schema (no collision with HITO's `public` helpers) | ✓ VERIFIED | `0001_schema_orgs.sql`: both functions `LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''`, schema-qualified refs. Orchestrator live query confirms both functions exist under `staff_app`. |
| 3 | `staff_app.gigs.hito_event_id` nullable, no FK, no bridge logic built (D-01) | ✓ VERIFIED | `0002_core_tables.sql`: `hito_event_id uuid` with no REFERENCES clause; no bridge/push code exists anywhere in the repo (grep for HITO push logic returns nothing). |
| 4 | `get_advisors(security)` clean vs a captured pre-migration baseline across all 4 plans — zero NEW `function_search_path_mutable`/RLS findings for `staff_app` objects | ✓ VERIFIED | Baseline captured in 01-01 SUMMARY (20 pre-existing `function_search_path_mutable`, 0 `staff_app` mentions); 01-02/01-03/01-04 SUMMARYs each report byte-identical/zero-new-finding results. Orchestrator confirms: "no NEW findings vs baseline across all 4 plans." |
| 5 | `staff_app.get_public_offer`/`accept_offer`/`decline_offer` exist as SECURITY DEFINER RPCs with pinned `search_path`, 256-bit sha256-hashed tokens (raw never persisted), in-RPC `expires_at` enforcement, PII-safe read (no cv_url/email/telefono/documento), atomic idempotent crew creation via `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING` (Roadmap SC3, DATA-04) | ✓ VERIFIED | `supabase/migrations/staff_app_0003_magic_link_rpcs.sql` inspected directly: all 3 functions present, `SET search_path = staff_app, pg_temp`, `encode(extensions.digest(p_token,'sha256'),'hex')`, guard `status IN ('sent','viewed') AND expires_at > now()`, `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING`. `supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql` exists on disk; 01-02 SUMMARY records all 7 cases PASS. Orchestrator live query confirms the 3 functions exist plus the helpers (exactly 5 `staff_app` functions total — no extra anon-callable surface). |
| 6 | anon exposure is least-privilege: exactly the 3 magic-link RPCs + `public.staff_app_register_applicant` are anon-callable; `is_org_member`/`is_org_writer` locked to `authenticated` only | ✓ VERIFIED | `0003_magic_link_rpcs.sql`: `REVOKE ALL ... FROM PUBLIC` then explicit `GRANT EXECUTE ... TO anon, authenticated` on exactly 3 functions; helpers `REVOKE ALL FROM PUBLIC` + `GRANT ... TO authenticated` only. Orchestrator's function enumeration (5 functions total: accept_offer, decline_offer, get_public_offer, is_org_member, is_org_writer) matches exactly. |
| 7 | Live somosder-web form writes into `staff_app.staff_profiles` via `public.staff_app_register_applicant` RPC, same project URL/anon key, CV bucket unchanged, zero downtime (Roadmap SC2, DATA-03) | ✓ VERIFIED | `StaffRegistro.astro` grep: `SUPABASE_URL = 'https://luillpzfqzbpoqkgvjuw.supabase.co'` unchanged; `fetch(`${base}/rest/v1/rpc/staff_app_register_applicant`...)` present; no `from('staff_profiles')` direct-insert call remains anywhere in the file. Orchestrator's independently-run live cutover test: anon RPC POST → 200 `{ok:true}`, row landed org-stamped then deleted; missing-field POST → 400; direct anon insert → blocked `PGRST106`; deployed prod bundle (`dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s`, aliased to `www.somosder.ar`) contains the RPC call and not the old insert. |
| 8 | anon cannot INSERT `staff_app.staff_profiles` directly — only via the validated `public.staff_app_register_applicant` RPC, which forces `organization_id`/`estado`/`source` server-side and validates `nombre`/`email`/`telefono` | ✓ VERIFIED | `supabase/migrations/staff_app_0004_intake_function.sql` inspected directly: `RAISE EXCEPTION` guards on the 3 required fields; INSERT hardcodes `organization_id`, `estado='pendiente'`, `source='web_somosder'` — none of these are function parameters, so the caller cannot set them. `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO anon, authenticated` on the function only (not the table). |
| 9 | Source A (HITO/web applicants at cutover) copied into `staff_app.staff_profiles` — N captured live (8, not hardcoded 7), cv_url + id intact, zero NULL org, zero dup emails | ✓ VERIFIED | 01-03 SUMMARY: N=8 captured at cutover (2026-07-14T16:50:15Z), backfill script `supabase/backfills/staff_app_0004_source_a_backfill.sql` exists on disk; verification evidence recorded (`id_email_cv_match=8`, `source_rows_missing_in_app=0`). |
| 10 | Source B (Google Sheet 711 rows) staged, normalized, deduped (27 in-Sheet dup groups → 1 each, 0 overlap with Source A), location-normalized to the 24 official AR jurisdictions, imported as `source='google_sheet'`, staging tables dropped after import (DATA-02) | ✓ VERIFIED | `supabase/migrations/staff_app_0005_staging_sheet.sql`, `supabase/backfills/staff_app_0005_source_b_gen.py`, `_import.sql` exist on disk. Orchestrator live query: `staff_app.staging_sheet dropped: true`. 01-04 SUMMARY records 679 post-dedup rows, deterministic location classifier output, and 1 flagged unmapped variant ("Argentina"). |
| 11 | Final pool: 687 total rows (8 web_somosder + 679 google_sheet), zero NULL `organization_id`, zero duplicate emails, cv_url populated for all 687 | ✓ VERIFIED | Orchestrator live query, independent of any SUMMARY: `total staff_app.staff_profiles rows: 687 (by_source: web_somosder=8, google_sheet=679)`, `NULL organization_id: 0`, `duplicate emails: 0`, `rows with cv_url: 687`. Matches 01-04 SUMMARY exactly. |
| 12 | `staff_app.offers.token_hash` is `NOT NULL UNIQUE`; `staff_app.crew` has `UNIQUE (gig_id, staff_profile_id)` idempotency anchor | ✓ VERIFIED | `0002_core_tables.sql`: `token_hash text NOT NULL UNIQUE` on offers; `UNIQUE (gig_id, staff_profile_id)` on crew. Orchestrator live query: `offers.token_hash unique index: present`. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/staff_app_0001_schema_orgs.sql` | schema + org/members + helpers | ✓ VERIFIED | Present, inspected directly; matches SUMMARY claims exactly |
| `supabase/migrations/staff_app_0002_core_tables.sql` | staff_profiles/gigs/crew/offers + RLS | ✓ VERIFIED | Present, inspected directly; all 4 tables + RLS policies + REVOKE present |
| `supabase/migrations/staff_app_0003_magic_link_rpcs.sql` | 3 magic-link RPCs | ✓ VERIFIED | Present, inspected directly; matches hardened design (256-bit hash, in-RPC expiry) |
| `supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql` | 7-case SQL test harness | ✓ VERIFIED | Present on disk, version-controlled and re-runnable |
| `supabase/migrations/staff_app_0004_intake_function.sql` | public intake RPC | ✓ VERIFIED | Present, inspected directly; validation + privileged-column forcing confirmed in source |
| `supabase/backfills/staff_app_0004_source_a_backfill.sql` | Source-A backfill | ✓ VERIFIED | Present on disk |
| `supabase/migrations/staff_app_0005_staging_sheet.sql` + `supabase/backfills/staff_app_0005_source_b_*` | Source-B staging/import | ✓ VERIFIED | Present on disk (gen.py, import.sql); `_load.sql` and the source CSV were deliberately removed post-import (see Anti-Patterns) |
| `StaffRegistro.astro` (somosder-web, non-git) | form repointed to RPC | ✓ VERIFIED | Grep-confirmed: RPC call present, direct insert absent, URL unchanged; live production deploy confirmed by orchestrator |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `staff_app.offers` RLS policies | `staff_app.is_org_member/is_org_writer` | `USING (staff_app.is_org_member(organization_id))` | ✓ WIRED | Present verbatim in `0002_core_tables.sql` on staff_profiles/gigs/crew/offers |
| `staff_app.accept_offer` | `staff_app.crew` | `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING` | ✓ WIRED | Present verbatim in `0003_magic_link_rpcs.sql`; idempotency verified by harness case 5 |
| `StaffRegistro.astro` submit handler | `public.staff_app_register_applicant` | `fetch(.../rest/v1/rpc/staff_app_register_applicant, ...)` | ✓ WIRED | Confirmed via grep + orchestrator's live curl test (200 ok, row landed org-stamped) |
| `public.staff_app_register_applicant` | `staff_app.staff_profiles.organization_id` | hardcoded UUID in INSERT, not a parameter | ✓ WIRED | Confirmed directly in `0004_intake_function.sql` source |
| RPC token lookup | `staff_app.offers.token_hash` | `WHERE token_hash = encode(extensions.digest(p_token,'sha256'),'hex')` | ✓ WIRED | Present in all 3 RPCs in `0003_magic_link_rpcs.sql` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 01-01 | App owns its schema, org-scoped RLS from day 1 | ✓ SATISFIED | Truths 1–3, 12 |
| DATA-02 | 01-03 (Source A) + 01-04 (Source B) | Existing applicants backfilled, verified no loss | ✓ SATISFIED | Truths 9–11 |
| DATA-03 | 01-03 | Form + CV upload repointed, zero downtime | ✓ SATISFIED | Truths 7–8 |
| DATA-04 | 01-02 | Magic-link RPC lifecycle, SQL-tested, advisor-clean | ✓ SATISFIED | Truths 5–6 |

No orphaned requirements — all 4 IDs in `.planning/REQUIREMENTS.md` under Phase 1 (DATA-01..04) are claimed by a plan and satisfied above. `.planning/REQUIREMENTS.md` itself is already marked `[x]` and `Complete` for all four.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (fixed) `supabase/backfills/staff_app_0005_source_b_load.sql`, `.planning/.../source-b-applicants.csv` | — | CR-01: plaintext PII dump of 711 applicants in-repo | 🛑 Blocker (remediated) | Fixed in commit `7c5f4ff` (files deleted, `.gitignore` entries added: `source-b-applicants.csv`, `*_source_b_load.sql`). Verified on disk: files no longer exist; `.gitignore` confirmed present. |
| `supabase/backfills/staff_app_0005_source_b_gen.py:38-42` | 38-42 | 8 real applicant email addresses (`SOURCE_A_EMAILS`) hardcoded in a script that remains in the repo; lines 196-200 print raw emails/birthdates to stdout | ⚠️ Warning | Residual, smaller-scope PII exposure not covered by the CR-01 fix commit. Does not block any Phase 1 must-have (the data itself lives correctly in the DB with RLS); recommend a follow-up chore to replace the hardcoded set with a DB read and stop printing raw PII to stdout. |
| `supabase/migrations/staff_app_0001_schema_orgs.sql:46-54` | 46-54 | `is_org_writer` fail-open: any role `<> 'viewer'` (typo/unexpected value) grants write (WR-04) | ⚠️ Warning | `members` table is seeded empty in Phase 1 (auth wired in Phase 2) — currently inert, but must be fixed (CHECK constraint + enumerate allowed roles) before Phase 2 wires real auth/members. |
| `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:160-172` | 160-172 | `GRANT USAGE ON SCHEMA staff_app TO anon` + Postgres default function ACL = future `staff_app` functions are anon-callable by default unless explicitly revoked (WR-05) | ⚠️ Warning | No functions violate this today (verified: exactly 5 functions exist, correctly scoped), but the safe-by-default `ALTER DEFAULT PRIVILEGES` guard is missing — a real risk for Phase 2+ when new `staff_app` functions are added. |
| `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:106-118` | 106-118 | `accept_offer` doesn't propagate `offer.amount` into the new `crew` row; second-offer-same-gig conflict silently returns stale crew id (WR-01) | ⚠️ Warning | Data-integrity gap that will matter once Phase 3 (create/send offers) and Phase 4 (accept loop) are live; does not affect any Phase 1 must-have (crew creation and idempotency were verified exactly as specified — `amount` propagation was never a Phase 1 acceptance criterion). |
| `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro:94-99,374-375` | 94-99 | Invalid birthdates (e.g. Feb 31) crash the RPC cast, form shows a generic error, CV already uploaded is orphaned (WR-07) | ⚠️ Warning | Real live UX bug, but does not violate the must-have "form surfaces honest success/failure" (an error IS surfaced, just an unhelpful generic one) — not a silent-success case. |
| Various (WR-02, WR-03, WR-06, WR-08, IN-01..09) | — | Dead `p_user_agent` param, no size caps on anon intake, unenforced delimiter-safety assertion in generator, unauthenticated Storage upload retained (pre-existing, out of scope), plus 9 info-level notes | ℹ️ Info / ⚠️ Warning | All confirmed present in `01-REVIEW.md`; none contradict a Phase 1 must-have. Correctly scoped as hardening work for later phases (Phase 3 offer-amount propagation, Phase 4 accept-loop UA audit, abuse-hardening on the anon intake RPC). |

No unreferenced `TBD`/`FIXME`/`XXX` debt markers found in any file under `supabase/` (grep scan clean).

### Human Verification Required

None. This phase is pure SQL/data-layer work with one live cutover of an existing production form; the cutover itself was already tested end-to-end programmatically (curl POST → 200/400 responses, row verified in DB then deleted, direct-insert blocked) both by the executing plan (01-03 SUMMARY) and independently re-confirmed by the orchestrator's live query against the production database. No new UI was built in this phase (Phase 2 is first UI). Nothing here requires a human to visually or interactively confirm.

### Gaps Summary

No gaps. All 3 ROADMAP success criteria and all 12 derived truths (covering DATA-01 through DATA-04) verified directly against the committed SQL/code artifacts and cross-checked against an independent live-database query snapshot. The one Critical finding from code review (CR-01, plaintext PII dump) was already remediated in commit `7c5f4ff` prior to this verification, confirmed by direct file-absence check and `.gitignore` inspection. The 8 review warnings are legitimate, correctly-scoped hardening items for later phases (offer-amount propagation, default-privilege footgun, fail-open role check, abuse caps on the intake RPC, birthdate UX) — none of them contradict or unwind a Phase 1 must-have; they are recommended as fast-follow chores, not phase blockers.

One minor discrepancy noted for the record, not a gap: the orchestrator's live snapshot shows `provincia: 14 distinct official values in use, 2 NULL`, versus the 01-04 SUMMARY's recorded "1 NULL" (the flagged "Argentina" Sheet row). The extra NULL is consistent with one of the 8 Source-A/web-intake rows having no `provincia` selected — `provincia` was never a required field on the web form or the intake RPC, and the Phase 1 location-normalization must-have applied specifically to the Google Sheet import (Source B), which is fully accounted for (679/679, 1 flagged). This does not violate any stated must-have.

---

_Verified: 2026-07-14T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
