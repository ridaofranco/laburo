---
phase: 01-own-data-foundation
reviewed: 2026-07-14T19:05:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - supabase/migrations/staff_app_0001_schema_orgs.sql
  - supabase/migrations/staff_app_0002_core_tables.sql
  - supabase/migrations/staff_app_0003_magic_link_rpcs.sql
  - supabase/migrations/staff_app_0004_intake_function.sql
  - supabase/migrations/staff_app_0005_staging_sheet.sql
  - supabase/tests/staff_app_0003_magic_link_rpcs_harness.sql
  - supabase/backfills/staff_app_0004_source_a_backfill.sql
  - supabase/backfills/staff_app_0005_source_b_gen.py
  - supabase/backfills/staff_app_0005_source_b_import.sql
  - supabase/backfills/staff_app_0005_source_b_load.sql
  - /Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro
findings:
  critical: 1
  warning: 8
  info: 9
  total: 18
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-14T19:05:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 1 Supabase data foundation: schema/org migrations, the three magic-link SECURITY DEFINER RPCs, the public intake RPC, the Source-A/Source-B backfills, and the repointed `StaffRegistro.astro` form.

The core security design is sound where it matters most: tokens are 256-bit and stored only as sha256 hashes; `expires_at` is enforced inside the state-changing RPCs; `get_public_offer` returns no PII beyond first name (verified against the harness leak assertions); all `staff_app` functions pin `search_path`; anon has no direct table access; the form's `.rpc()` call is a parameterized JSON POST (no injection surface); the intake function forces `organization_id`/`estado`/`source` server-side so the anon caller cannot set privileged columns. The Source-B transport payload was independently re-parsed during this review: 18 chunks, exactly 711 rows × 20 fields, 0 empty emails, 27 duplicate-email groups — consistent with the recorded 679-row import.

The one Critical finding is a self-contradiction in the threat handling: the plan drops the staging tables to satisfy threat T-01-16 ("no un-RLS'd copy of applicant PII persists"), yet a complete plaintext PII dump of all 711 applicants (names, DNI numbers, emails, phones, birthdates, motivations) persists on disk in `staff_app_0005_source_b_load.sql` (358 KB) and in `.planning/.../source-b-applicants.csv`. Warnings cover real correctness/abuse defects: `accept_offer` losing `amount` and returning stale crew state, a dead `p_user_agent` audit parameter, an anon intake RPC with zero size/format caps, fail-open writer-role logic, an anon-callable-by-default footgun for future `staff_app` functions, an unverified delimiter-safety claim in the generator, an invalid-birthdate path that fails whole submissions, and unauthenticated Storage upload retained in the form.

## Critical Issues

### CR-01: Plaintext PII dump of 711 applicants persists in the repo, contradicting the T-01-16 mitigation

**File:** `supabase/backfills/staff_app_0005_source_b_load.sql` (entire file); also `supabase/backfills/staff_app_0005_source_b_gen.py:38-42, 196-200` and `.planning/phases/01-own-data-foundation/source-b-applicants.csv`
**Issue:** `staff_app_0005_source_b_import.sql:62-64` drops `staging_sheet`/`staging_line` explicitly "so no un-RLS'd copy of applicant PII persists (threat T-01-16)" — but the load SQL file itself IS a persistent, unprotected copy of the exact same PII: full names, DNI numbers, emails, phone numbers, birthdates, and free-text motivations for 711 real people, in plaintext, in the source tree (first row visible at line 5: `Soler$Sabrina$1999-05-18$41948568$sabrinaluanasoler@gmail.com$3794122113...`). The source CSV in `.planning/` is a second copy. Additionally, `staff_app_0005_source_b_gen.py:38-42` hardcodes 8 real personal email addresses (`SOURCE_A_EMAILS`) into a script file, and lines 198-199 print applicant emails and raw birthdates to stdout (terminal/scrollback/log exposure). The web form's own consent text promises processing under Ley 25.326 — a full dump sitting in a directory that will eventually be `git init`-ed and pushed (or synced to Drive) is a data-protection incident waiting to happen, and directly contradicts the project's own recorded threat model.
**Fix:** The import is done and its results are verified — the transport file has served its purpose. Delete `staff_app_0005_source_b_load.sql` and `.planning/phases/01-own-data-foundation/source-b-applicants.csv` (the generator + the live Sheet remain the reproducible source of truth), or move both outside the repo tree. Before any `git init`, add a `.gitignore` entry:
```gitignore
supabase/backfills/*_load.sql
.planning/**/source-b-applicants.csv
```
Also replace the hardcoded `SOURCE_A_EMAILS` literal in `gen.py` with a read from the DB/an env-provided file, and stop printing raw emails/birthdates (print counts and row_ids instead).

## Warnings

### WR-01: `accept_offer` drops `offer.amount` and silently reports success with stale crew data on cross-offer conflict

**File:** `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:106-118`
**Issue:** Two related data-integrity defects in the accept path:
1. `crew` has an `amount numeric(18,2)` column (0002:70) clearly meant to record the agreed pay, but the INSERT copies only `role` — `offers.amount` is never propagated. The contracted crew row has `amount = NULL` and `days = 1` regardless of what the offer said.
2. If the same person already has a crew row for the gig (e.g., a second offer with a *different* role/amount on the same gig), `ON CONFLICT DO NOTHING` silently no-ops, the function still marks the second offer `accepted` and returns `ok:true` with the OLD crew row's id — the newly accepted role/amount is silently discarded with no signal to anyone.
**Fix:**
```sql
INSERT INTO crew (organization_id, gig_id, staff_profile_id, role, amount)
VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role, v_o.amount)
ON CONFLICT (gig_id, staff_profile_id)
DO UPDATE SET role = EXCLUDED.role, amount = EXCLUDED.amount
RETURNING id INTO v_crew;
```
(or, if a second acceptance for the same gig should not overwrite, detect the conflict and return `ok:false, reason:'already_crewed'` instead of a fake success).

### WR-02: `accept_offer(p_token, p_user_agent)` — `p_user_agent` is a dead parameter; the audit trail it implies is silently lost

**File:** `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:85-119`
**Issue:** `p_user_agent` is declared, granted, documented in the harness call (`'test-agent'`), and never referenced in the function body. The signature promises acceptance-audit capture (who/what accepted — the HITO pattern this was cloned from stores it); nothing is stored. Anyone reading the contract will assume the UA is recorded.
**Fix:** Either store it (add `accepted_user_agent text` to `offers` and set it in the `UPDATE ... SET status='accepted'`), or remove the parameter so the signature stops lying. Note `decline_offer` takes no UA — pick one convention.

### WR-03: Anon intake RPC has no length caps, no array-size caps, and no email format check — unauthenticated DB-bloat/abuse vector

**File:** `supabase/migrations/staff_app_0004_intake_function.sql:50-79`
**Issue:** `public.staff_app_register_applicant` is callable by `anon` with zero rate limiting and validates only that three fields are non-empty. Every text parameter (`p_motivacion`, `p_experiencia_detalle`, `p_notas`…) accepts unbounded input — a single call can insert megabytes; `p_oficios`/`p_donde_trabajar` accept arrays of any length; `p_email` accepts any garbage string even though email is later used as the dedup identity key by the backfills. On a zero-budget free tier (500 MB DB), a trivial script can fill the database or bury the 687 real applicants under junk rows.
**Fix:** Add cheap guards inside the function:
```sql
IF length(p_email) > 320 OR position('@' IN p_email) = 0 THEN
  RAISE EXCEPTION 'email inválido' USING ERRCODE = 'check_violation';
END IF;
IF length(coalesce(p_motivacion,'')) > 2000 OR length(coalesce(p_experiencia_detalle,'')) > 4000
   OR length(p_nombre) > 200 OR cardinality(p_oficios) > 40 OR cardinality(p_donde_trabajar) > 20 THEN
  RAISE EXCEPTION 'payload demasiado grande' USING ERRCODE = 'check_violation';
END IF;
```
(Adjust limits to the form's real maxima. Rate limiting proper can wait for Phase 4, but size caps cost nothing now.)

### WR-04: `is_org_writer` is fail-open — any unexpected role value grants write

**File:** `supabase/migrations/staff_app_0001_schema_orgs.sql:46-54` (and `members.role` at line 27)
**Issue:** `members.role` is free text with no CHECK constraint, and `is_org_writer` grants write for `role <> 'viewer'`. A typo'd or future role (`'Viewer'`, `'guest'`, `'pending'`, `''`) silently gets full writer privileges on gigs/crew/offers. Authorization checks should enumerate what is allowed, not what is denied.
**Fix:**
```sql
ALTER TABLE staff_app.members
  ADD CONSTRAINT members_role_check CHECK (role IN ('owner','writer','viewer'));
-- and in is_org_writer:
... AND role IN ('owner','writer')
```

### WR-05: `GRANT USAGE ON SCHEMA staff_app TO anon` + Postgres default function ACL = every future `staff_app` function is anon-callable by default

**File:** `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:160-172`
**Issue:** 0003 correctly strips PUBLIC EXECUTE from the five existing functions, but Postgres grants EXECUTE to PUBLIC on *newly created* functions by default. Now that `anon` holds schema USAGE, any function added to `staff_app` in Phase 2+ (e.g., internal helpers, the HITO bridge) is immediately callable by the anonymous web key unless its author remembers the per-function REVOKE. The migration's own claim — "no other anon-callable function exists in staff_app" — only holds until the next `CREATE FUNCTION`.
**Fix:** Make the safe state the default state:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA staff_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```
(run once per role that creates functions there, e.g., `postgres`).

### WR-06: Generator's "delimiters verified absent from every value" claim is not enforced by any code — silent corruption on regeneration

**File:** `supabase/backfills/staff_app_0005_source_b_gen.py:23-27, 155-193`
**Issue:** The docstring and the emitted SQL header both assert `$`, `^`, `~` are "verified absent from every value", and the script is explicitly advertised as re-runnable/deterministic — but `main()` contains no such check. If the script is ever re-run against a refreshed CSV where an applicant typed `$` in `motivacion` or `~` in an address, fields shift or rows split and the import either dies on a cast or silently writes misaligned data. Worse, a field value equal to `SBLOAD` between two `$` delimiters would produce the literal sequence `$SBLOAD$` and break the dollar-quoting itself. The verification for this one-time run happened out-of-band (I re-parsed the emitted payload during review: 711×20 clean) — the guarantee must live in the code.
**Fix:** Assert before emitting:
```python
for f in fields:
    assert not any(d in f for d in ('$', '^', '~')), f'delimiter in value (row {idx}): {f!r}'
assert '$SBLOAD$' not in RD.join(lines)
```

### WR-07: Form builds invalid birthdates (e.g., Feb 31) → server-side date cast fails → entire submission lost after the CV was already uploaded

**File:** `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro:94-99, 161-163, 374-375, 414-424`
**Issue:** The day selector always offers 01–31 for every month (`dias` at line 94), and `fecha_nacimiento` is assembled as `` `${y}-${m}-${d}` `` with no validity check (line 375). A user picking 31/February/1990 produces `"1990-02-31"`, PostgREST's cast to `date` for `p_fecha_nacimiento` raises, the RPC returns non-2xx, and the catch block shows only the generic "Hubo un error. Probá de nuevo." — the applicant has no idea the birthdate is the problem and their CV file was already uploaded to Storage (line 423), leaving an orphaned object per retry. Since birthdate is optional, a wholesale submission failure over it is disproportionate.
**Fix:** Validate before sending:
```ts
const fecha_nacimiento = d && m && y
  ? (() => { const dt = new Date(`${y}-${m}-${d}T00:00:00Z`);
             return dt.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : null; })()
  : null;
```
(or filter the `dias` options per selected month). Consider surfacing the RPC error body in the feedback message instead of a fixed string.

### WR-08: Unauthenticated direct Storage upload to `staff-cvs` with no size/type enforcement (retained behavior)

**File:** `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro:414-424`
**Issue:** The form uploads the raw file to `/storage/v1/object/staff-cvs/...` with only the anon key. There is no client-side size cap, the `accept` attribute is advisory only, and `Content-Type` is taken from the file. If the bucket's anon INSERT policy has no size/MIME restrictions (the migrations state the bucket is "UNCHANGED", so nothing in this phase constrains it), any anonymous actor can script uploads until the free-tier 1 GB storage is exhausted, or park arbitrary content (malware, illegal files) in the DER bucket. This is pre-existing behavior, but this phase re-shipped the form and hardened everything around it except this door.
**Fix:** At minimum add a client-side cap (`if (file.size > 10 * 1024 * 1024) …`) and, on the Supabase side, a bucket file-size limit + allowed-MIME list (`update bucket staff-cvs set file_size_limit = '10MB', allowed_mime_types = array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']` via dashboard/SQL). Free, one-time change.

## Info

### IN-01: `get_public_offer` serves full offer details for expired/responded offers and flips `sent→viewed` even when expired

**File:** `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:41-59`
**Issue:** Unlike accept/decline, the read RPC has no `expires_at` or status guard: a token remains a permanent read credential for the offer (role, amount, conditions, gig, venue, first name), and an expired offer still gets `viewed_at` stamped. The client can derive expiry from the returned `expires_at`, so this is a documented-behavior gap rather than a leak — but Phase 4's UI must remember to compute `expired` itself, and long-lived read tokens widen the window for leaked links.
**Fix:** Either add `AND expires_at > now() + interval '30 days'` as an outer bound, or return a derived `'expired'` status in the JSON so the client cannot render an actionable offer: `CASE WHEN v_rec.expires_at <= now() AND v_rec.status IN ('sent','viewed') THEN 'expired' ELSE v_rec.status END`.

### IN-02: `accept_offer`/`decline_offer` read-then-write without `FOR UPDATE`

**File:** `supabase/migrations/staff_app_0003_magic_link_rpcs.sql:96-116, 135-145`
**Issue:** Concurrent accept+decline on the same token both pass the status guard and race; last UPDATE wins (an offer can end `accepted` after a decline, or vice versa). Outcome is benign for a single-recipient token, but the fix is one keyword.
**Fix:** `SELECT * INTO v_o FROM offers WHERE ... FOR UPDATE;`

### IN-03: Intake function's `search_path` includes `public` unnecessarily

**File:** `supabase/migrations/staff_app_0004_intake_function.sql:45`
**Issue:** `SET search_path = staff_app, public, pg_temp` — every reference in the body is either schema-qualified (`staff_app.staff_profiles`) or `pg_catalog` (`btrim`, `coalesce`, `jsonb_build_object`), so `public` in a SECURITY DEFINER path buys nothing and deviates from the 0003 hardening standard.
**Fix:** `SET search_path = staff_app, pg_temp`.

### IN-04: No unique index on `staff_profiles.email` despite email being the backfill identity key; latent dedup edge cases

**File:** `supabase/migrations/staff_app_0002_core_tables.sql:22`; `supabase/backfills/staff_app_0004_source_a_backfill.sql:36-38`; `supabase/backfills/staff_app_0005_source_b_import.sql:46-53`
**Issue:** Both backfills dedupe on email, but the table has no unique constraint, and the intake RPC happily inserts duplicate emails (may be intended: re-applications). Latent edges: (a) Source-A's `NOT EXISTS` only checks the target, so duplicate emails *within* the source would both insert (actual source had 0 — verified); (b) the Source-B `DISTINCT ON (lower(email))` would collapse all blank-email rows into one, silently dropping applicants (actual payload had 0 blank emails — re-verified during this review). Fine for the one-time run; document the "email is not unique" decision or add a partial unique index if it should be.
**Fix:** Decide and record: either `CREATE UNIQUE INDEX ON staff_app.staff_profiles (lower(email))` (breaks re-application) or a code comment stating duplicates are allowed and dashboards must group by email.

### IN-05: `staff_profiles.organization_id` is nullable — a NULL-org row is invisible to every role under RLS

**File:** `supabase/migrations/staff_app_0002_core_tables.sql:47, 100-101`
**Issue:** `staff_profiles_select` uses `is_org_member(organization_id)`; with `organization_id NULL` that is never true, so such a row is unreachable by any member (only superuser/owner sees it). All current writers force the org UUID, so this is latent — but one future INSERT path that forgets the stamp creates silently orphaned applicants.
**Fix:** Once Phase-1 data is settled: `ALTER TABLE staff_app.staff_profiles ALTER COLUMN organization_id SET NOT NULL;` (the "nullable for form parity" reason expired when the form was repointed to the RPC, which always stamps it).

### IN-06: Stale/misleading comments in `StaffRegistro.astro`

**File:** `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro:5-6, 11-12`
**Issue:** The header still says "Hoy envía vía Web3Forms" and line 11-12 claims "la tabla está protegida con RLS (insert-only para anon)" — neither is true anymore (submission goes to the `staff_app_register_applicant` RPC; anon has no table INSERT at all). Future maintainers will reason from wrong security assumptions.
**Fix:** Update both comments to describe the RPC path.

### IN-07: `staging_line` exists only as a comment instruction; `staging_sheet` migration leaves a dangling table on fresh replays

**File:** `supabase/migrations/staff_app_0005_staging_sheet.sql:8-33`; `supabase/backfills/staff_app_0005_source_b_import.sql:9-10, 62-64`
**Issue:** The `staging_line` CREATE lives only inside a run-order comment (executed ad hoc), so the versioned record is incomplete; conversely, `staging_sheet` is created by a *migration* but dropped by an ad-hoc backfill script — replaying migrations on a fresh environment recreates an empty `staging_sheet` that nothing ever drops. Harmless (RLS deny-all, no grants), but the migration history no longer describes the real schema.
**Fix:** Add a follow-up migration `staff_app_0006_drop_staging` recording the drop, or convert 0005 into a backfill-only script.

### IN-08: `gen.py` opens files without explicit encoding — determinism claim depends on locale

**File:** `supabase/backfills/staff_app_0005_source_b_gen.py:156, 193`
**Issue:** `open(CSV)` / `open(OUT,'w')` use the locale-preferred encoding. On a machine without UTF-8 locale, accented applicant data (`Producción`, `Río Negro`) mojibakes or raises, breaking "same CSV in → identical SQL out". Also `csv.reader` without `newline=''` can mis-handle embedded newlines in quoted cells.
**Fix:** `open(CSV, newline='', encoding='utf-8')` and `open(OUT, 'w', encoding='utf-8')`.

### IN-09: Consent acceptance is not persisted anywhere

**File:** `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro:256-258`
**Issue:** The Ley 25.326 consent checkbox is `required` but has no `name` — no consent flag or timestamp reaches the payload or the DB. If a data-subject dispute ever arises, there is no record that consent was given for the 687 stored profiles.
**Fix:** Add a `consent_at timestamptz` (set to `now()` inside the intake RPC, since the form can't submit without checking the box) — one column, zero UX change.

---

_Reviewed: 2026-07-14T19:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
