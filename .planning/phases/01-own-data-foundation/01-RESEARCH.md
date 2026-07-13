# Phase 1: Own Data Foundation - Research

**Researched:** 2026-07-13
**Domain:** New standalone Supabase Postgres schema (org-scoped RLS + magic-link SECURITY DEFINER RPCs) + zero-downtime cutover of a live public web form + two-source backfill. Pure SQL/Supabase — no app code this phase.
**Confidence:** HIGH (all HITO patterns read directly from migrations; live form read line-by-line; live-DB facts supplied verified by orchestrator). MEDIUM only on the Google Sheet source (unseen — needs Franco).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The app is a **standalone jobs app**. ALL HITO-integration work (bridge function, HITO event reads, crew push, destination org/event choice) is OUT of Phase 1, deferred to **Phase 6 (last)**. The only concession this phase: `gigs.hito_event_id` nullable column (zero cost today). The link mechanism (RPC/API/MCP/other) is decided only at Phase 6 — it does NOT constrain Phase 1 design. **Do not research or plan the bridge.**
- **D-02:** Franco's account/org consolidation is NO LONGER a prerequisite for Phase 1. It only gates the Phase 6 HITO push. The backfill reads HITO `staff_profiles` read-only and needs no org decision.

### Claude's Discretion (research options, recommend)
- **Web-form cutover:** no-downtime strategy (direct switch vs double-write) and what happens to HITO `staff_profiles` after the cut. **Hard rule: the live intake never breaks and never loses an applicant.**
- **Own staff data model:** copy HITO schema as-is vs minimal cleanup; the ~64 oficios as catalog vs tags; dedup handling in backfill. Verify real columns with a live query before migrating (already done — see Ground Truth).
- **Token/offer policy:** default expiry, single-use semantics, renewal. Follow HITO's proven `proposal_acceptance` pattern and the documented pitfalls (256-bit hashed, POST-only accept, expiry checked inside the RPC).

### Deferred Ideas (OUT OF SCOPE)
- Full HITO bridge (BRDG-01/02/03: SECURITY DEFINER receiver in HITO, event reads, crew push with refs + retry) → **Phase 6**. Account/org consolidation resolves there.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Own Supabase project (org `wsvqlrjmizvivgrgnfpw`, $0) + org-scoped RLS schema: `staff_profiles`, `gigs` (nullable `hito_event_id`), `crew`, `offers` | §Target Schema DDL, §RLS Helper Pattern, §Architecture Patterns |
| DATA-02 | Backfill existing applicants, verified no loss | §Backfill: Two Sources, §CV Object Migration, §Verification Queries — **BLOCKER: Sheet export needed from Franco** |
| DATA-03 | Repoint somosder-web form + CV bucket to APP database, zero downtime | §Live Form Insert Path, §Zero-Downtime Cutover, §Anon Intake Hardening |
| DATA-04 | Magic-link RPCs `get_public_offer`/`accept_offer`/`decline_offer`, SECURITY DEFINER, fixed search_path, 256-bit hashed single-use expiring tokens, SQL-tested, clean `get_advisors` | §Magic-Link RPC Pattern, §Token Security, §get_advisors Expectations |
</phase_requirements>

## Summary

Phase 1 is **all SQL against a brand-new Supabase project** — no npm packages, no app framework, no UI. The work is: (1) create the new project in org `wsvqlrjmizvivgrgnfpw`; (2) build an org-scoped, RLS-enabled schema whose `staff_profiles` is a **superset of HITO's live 29-column table** (so the web form inserts unchanged) plus `organization_id`; (3) create `gigs`/`crew`/`offers` and the `organizations`/`members` + `is_org_member`/`is_org_writer` helpers copied from HITO; (4) build the three magic-link RPCs as SECURITY DEFINER functions and prove them in SQL; (5) repoint the live form (two hardcoded constants + a `staff-cvs` bucket) with zero downtime; (6) backfill from **two** sources.

Every load-bearing pattern already exists and was read directly from `/Users/fridao/Proyectos/HITO-by-DER-main`: the accept-RPC (`00008_proposal_acceptance.sql`), the org helpers (`00001`, `00052`), the crew tables (`00035`), the token-in-URL flow (`app/.../propuesta/actions.ts`). **This phase should COPY those patterns but strengthen the two places HITO is weak:** HITO's share_token is only 96-bit (`randomBytes(12).base64url`) and stored raw, and HITO's `accept_proposal` does **not** check `expires_at` inside the RPC. Phase 1's tokens must be 256-bit, **hashed at rest**, with **expiry enforced inside** the RPC.

**Primary recommendation:** Order the work as **schema → RPCs (SQL-tested) → form cutover → backfill**. Doing the cutover *before* the backfill freezes HITO's 7 rows (no new writes land there after the cut), which eliminates any delta-sync window and makes "no applicant lost" trivially provable. Use Supabase **MCP tools** (`create_project` w/ `confirm_cost`, `apply_migration`, `execute_sql`, `get_advisors`) for everything — do **not** assume a local `supabase` CLI stack.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Own applicant/gig/crew/offer storage | Database (new Supabase project) | — | The whole phase is the data tier; app tiers arrive Phase 2+ |
| Org isolation / access control | Database (RLS + `is_org_member`/`is_org_writer`) | — | Multi-tenant security is enforced by Postgres, not app code |
| Public magic-link read/write | Database (SECURITY DEFINER RPC, token-gated) | — | Token is the only credential; no auth exists in Phase 1 |
| Token generation & hashing | Database (`extensions.gen_random_bytes` + `digest`) this phase; app server action in Phase 3 | — | SQL-testable now; app generates raw token at offer-create later |
| Public web intake (form → DB) | Frontend Server (somosder-web / Astro) writing to new DB | Database (anon INSERT policy + trigger) | The Astro form is the existing intake; only its target moves |
| CV file storage | Database/Storage (`staff-cvs` private bucket) | — | Objects live in Supabase Storage; reads via signed URL (later phase) |
| Backfill (HITO + Sheet → app) | Database (staging table + INSERT…SELECT) | one-time script for CV objects | Read-only pull from HITO; CSV import for the Sheet |

## Standard Stack

**No application packages are installed in Phase 1.** This phase produces SQL migrations and runs them through Supabase MCP. There is no `package.json`, no `npm install`, no framework. The CLAUDE.md/STACK.md stack table (Next.js 15.5, supabase-js, etc.) applies to **Phase 2 onward**, not here.

### Tooling actually used this phase
| Tool | Purpose | Provenance |
|------|---------|-----------|
| Supabase MCP (`create_project`, `apply_migration`, `execute_sql`, `list_tables`, `get_advisors`, `get_logs`, `get_project_url`, `get_publishable_api_key`) | Create project, run migrations, test RPCs in SQL, lint security | [VERIFIED: parent session MCP — server instructions confirm these tools] |
| Postgres `pgcrypto` (in `extensions` schema on Supabase) | `gen_random_bytes(32)` for tokens, `digest(...,'sha256')` for hashing | [CITED: Supabase installs extensions in the `extensions` schema] |
| Postgres core | `gen_random_uuid()` (core in PG13+), `tstzrange`, `EXCLUDE USING gist` (optional, availability) | [ASSUMED: standard Postgres — confirm extension `btree_gist` if using EXCLUDE] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase MCP `apply_migration` | Local `supabase` CLI + `supabase db push` | CLI needs Docker + linked project + local stack; MCP is already available in-session and writes straight to the remote project. Use MCP. |
| Direct anon table INSERT from the form | SECURITY DEFINER `register_*` intake RPC | RPC is a cleaner validation choke point (pitfall #7) BUT requires rewriting the form's submit JS, not just repointing. See §Zero-Downtime Cutover for the recommendation. |
| Token hashed with `sha256` | `pgcrypto` HMAC / bcrypt | sha256 of a 256-bit random token is standard and fast; the token already has full entropy so a salt/KDF is unnecessary. |

## Package Legitimacy Audit

**Not applicable this phase — no external packages are installed.** Phase 1 is pure SQL executed via Supabase MCP against a new Postgres database. The only "dependencies" are Postgres built-in/first-party extensions (`pgcrypto`, optionally `btree_gist`) that ship with Supabase. When Phase 2 introduces the Next.js app, run the full Package Legitimacy Gate then.

## Ground Truth: Verified Live-DB Facts

> Supplied by orchestrator (queried 2026-07-13 via Supabase MCP). The researcher has no DB access — **treat as authoritative, do not re-verify.**

- **HITO project:** `luillpzfqzbpoqkgvjuw` (read-only backfill source only). **App's new project:** create in org `wsvqlrjmizvivgrgnfpw`, cost verified **$0**.
- **HITO `public.staff_profiles` actual columns** (ordinal order): `id uuid PK default gen_random_uuid()`, `created_at timestamptz NOT NULL default now()`, `estado text NOT NULL default 'pendiente'`, `nombre text NOT NULL`, `fecha_nacimiento date`, `documento text`, `email text NOT NULL`, `telefono text NOT NULL`, `pais_residencia text`, `provincia text`, `ciudad text`, `donde_trabajar text[] NOT NULL default '{}'`, `situacion_legal text`, `oficios text[] NOT NULL default '{}'`, `oficios_otro text`, `experiencia boolean`, `anios_experiencia text`, `experiencia_detalle text`, `disponibilidad_finde boolean NOT NULL default false`, `disponibilidad_viajar boolean NOT NULL default false`, `movilidad_propia boolean NOT NULL default false`, `cv_url text`, `portfolio_url text`, `linkedin_url text`, `motivacion text`, `source text NOT NULL default 'web_somosder'`, `rating numeric`, `eventos_trabajados integer NOT NULL default 0`, `notas_internas text`, `disponibilidad_aviso text`, `apellido text`. **No `organization_id` — the live table is NOT org-scoped.**
- **CRITICAL DISCREPANCY:** HITO `staff_profiles` holds only **7 rows** (all with `cv_url`, 0 dup emails, 23 distinct oficios). The **"146 applicants"** in REQUIREMENTS **do not exist in HITO's DB** — no other table holds them. They almost certainly live in the **original Google Sheet** (Google Form era). ⇒ DATA-02 has **two sources**.

## Live Form Insert Path (DATA-03 anchor)

Read directly from `somosder-web/src/components/StaffRegistro.astro`:

- **Target is HARDCODED**, not env-driven — two `const` lines at the top of the component:
  ```
  const SUPABASE_URL  = 'https://luillpzfqzbpoqkgvjuw.supabase.co';   // line 13
  const SUPABASE_ANON = 'sb_publishable_0_OMSt6kAP4hCxkRZL5Wsg_NM8vwiKI'; // line 14
  ```
  (Note: other somosder-web files read `process.env.HITO_URL`, but **this component does not** — the repoint is a literal two-constant edit, or a small refactor to `import.meta.env`.)
- **Insert is a raw REST call, NOT an RPC:** `POST {URL}/rest/v1/staff_profiles` with headers `apikey`, `Authorization: Bearer <anon>`, `Prefer: return=minimal`, body = a JS object. So HITO's `staff_profiles` currently has an **anon INSERT RLS policy** (there is **no `register_web_lead` function** in HITO — earlier project docs assumed one; grep confirms it does not exist).
- **Exact payload keys the form sends** (must all be insertable columns in the app table): `nombre, apellido, email, telefono, documento, fecha_nacimiento (YYYY-MM-DD string), pais_residencia, provincia, ciudad, donde_trabajar (string[]), situacion_legal, oficios (string[]), oficios_otro, experiencia (bool|null), anios_experiencia, experiencia_detalle, disponibilidad_finde (bool), disponibilidad_viajar (bool), movilidad_propia (bool), disponibilidad_aviso, cv_url, portfolio_url, linkedin_url, motivacion, source ('web_somosder')`. It does **NOT** send: `organization_id, estado, rating, eventos_trabajados, notas_internas, id, created_at` (all DB-defaulted).
- **CV upload flow:** if a file is attached, the form first does `POST {URL}/storage/v1/object/staff-cvs/<timestamp_rand_filename>` with the anon key, then sets `row.cv_url = 'staff-cvs/<path>'` (a **relative** bucket path, not a full URL). So the app project needs a **`staff-cvs` bucket** and an anon **upload** policy. Because `cv_url` is stored relative, backfilled HITO CVs resolve correctly in the app project **as long as the same object path exists in the app's `staff-cvs` bucket** (see §CV Object Migration).
- **Side effect:** after insert, the form fires `/api/lead` (somosder-web SMTP notify) best-effort — unrelated to the DB target, leave untouched.

**What a zero-downtime repoint requires:**
1. App project has `staff_profiles` with **exactly the form's column names/types** + defaults for everything the form omits.
2. App project has a **`staff-cvs` private bucket** + an anon INSERT (upload) storage policy.
3. App `staff_profiles` has an **anon INSERT RLS policy** + **column-level `GRANT INSERT` on only the form's columns** (never `organization_id/estado/rating/notas_internas`) + a **BEFORE INSERT trigger** stamping `organization_id` (and leaving `estado='pendiente'`).
4. Edit `StaffRegistro.astro` lines 13–14 to the new project URL + new publishable key; redeploy somosder-web.

## Target Schema DDL Shape (DATA-01)

New project = empty. You create **everything**, including the org/membership tables the RLS helpers depend on. Recommended migration split mirrors the provisional plan split (01-01 schema, 01-03 RPCs).

### Org + membership + helpers (copy from HITO `00001` + `00052`)
```sql
-- organizations, members (minimal), plus the two helpers VERBATIM from HITO:
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM members WHERE organization_id = org_id AND user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_writer(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM members WHERE organization_id = org_id AND user_id = auth.uid() AND role <> 'viewer');
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
- Seed **one** `organizations` row for SOMOS DER with a **fixed UUID** (hardcode it — pitfall #4: multi-tenant = data shape only, not org-management UI). `members` stays empty until Franco's auth is wired (Phase 2); that's fine — Phase 1 has no dashboard reads. `[CITED: HITO 00001_rls_policies.sql, 00052_roles_permissions.sql]`

### `staff_profiles` (superset of the live 29 columns + org)
- Reproduce **every** live column with identical name/type/default (see Ground Truth list) so the repointed form inserts with zero code change beyond URL/key.
- Add `organization_id uuid REFERENCES organizations(id)` **NULLABLE** (pitfall #8 — never NOT NULL on a live-insert table). Stamp it via BEFORE INSERT trigger + backfill; only consider NOT NULL after cutover is proven.
- RLS: `ENABLE ROW LEVEL SECURITY`; anon **INSERT** policy (`WITH CHECK` constraining required fields / forcing `organization_id IS NULL`); member **SELECT** policy `USING (is_org_member(organization_id))`. Column-grant INSERT to `anon` on only the form's columns.
- Oficios: keep as `text[]` tags (as today) for Phase 1 — a normalized catalog is Claude's discretion but NOT needed to ship; tags match the form and SRCH-01's multi-select. `[ASSUMED]`

### `gigs` (own events — NOT HITO's `events`)
```sql
CREATE TABLE gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz,           -- interval, not single date (pitfall #9)
  ends_at   timestamptz,
  timezone  text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  venue_name text,
  hito_event_id uuid,              -- NULLABLE future-link ref (D-01); unused in Phase 1
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
```
- `starts_at/ends_at` as `timestamptz` + `timezone` mirrors HITO's `events.start_date` + `00061_event_timezone.sql` and pre-empts the double-booking/overnight pitfall. `[CITED: HITO 00061_event_timezone.sql]`
- `hito_event_id` is the **only** concession to HITO in this phase (D-01). No FK (cross-project). Cost zero.

### `crew` (own contracted crew — NOT HITO's `crew_members`)
```sql
CREATE TABLE crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  role text,
  days integer NOT NULL DEFAULT 1,
  amount numeric(18,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, staff_profile_id)   -- idempotency for accept_offer (HITO uses UNIQUE(crew_member_id,event_id))
);
```
- Optional zero-cost future-proofing (Claude's discretion): nullable `hito_crew_member_id uuid`, `hito_event_id uuid` for Phase 6 refs. Keep unused now. `[CITED: HITO 00035 crew_assignments UNIQUE(crew_member_id,event_id)]`

### `offers` (own, token-gated)
```sql
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  amount numeric(18,2),            -- informational only
  conditions text,
  token_hash text NOT NULL UNIQUE, -- sha256 hex of a 256-bit random token; RAW token never stored
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','viewed','accepted','declined','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  sent_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_select ON offers FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY offers_write  ON offers FOR ALL USING (is_org_writer(organization_id))
                                          WITH CHECK (is_org_writer(organization_id));
-- anon NEVER touches offers directly — only via the SECURITY DEFINER RPCs below.
```
- **Status enum:** `sent → viewed → accepted|declined`, plus `expired` (set by a later cron or derived on read). Matches STAT-01's "enviada/vista/aceptada/rechazada/vencida". `[CITED: CLAUDE.md status table + HITO proposals status set]`
- **`token_hash` not `token`** — this is the deliberate improvement over HITO (which stores `share_token` raw). Pitfall #1 mandates hashed-at-rest.

## Magic-Link RPC Pattern (DATA-04)

Template = HITO `00008_proposal_acceptance.sql` (read in full). Clone the **shape**, fix the **two gaps**.

### The three functions
- **`get_public_offer(p_token text) RETURNS jsonb`** — `LANGUAGE sql SECURITY DEFINER STABLE`. Hash the incoming raw token, look up by `token_hash`, return **only** the safe display fields (offer + gig title/date + org name/logo + greet-by-first-name). **No CV, no other PII, no other applicants** (pitfall §CV exposure). Grant `EXECUTE ... TO anon, authenticated`.
- **`accept_offer(p_token text, p_user_agent text) RETURNS jsonb`** — `LANGUAGE plpgsql SECURITY DEFINER`. Single transaction = atomic. Validate: `token_hash` match **AND** `status IN ('sent','viewed')` **AND** `expires_at > now()`. If invalid/expired/terminal → return `{ok:false, reason:'invalid_or_expired'}` (idempotent: a second click on an accepted link returns a benign "already accepted", never re-inserts). On success: upsert into `crew` (`ON CONFLICT (gig_id, staff_profile_id) DO NOTHING`), set `offers.status='accepted', responded_at=now()`. Grant `EXECUTE ... TO anon, authenticated`.
- **`decline_offer(p_token text) RETURNS jsonb`** — same guard, flips to `declined`. Grant to anon.
- **Viewing:** flip `sent→viewed` + `viewed_at` on first `get_public_offer` hit (HITO does this via a trigger/`mark_proposal_viewed` in `00002`). A `STABLE` sql function can't write — so either make `get_public_offer` a `plpgsql`/`VOLATILE` function that also updates, or a separate `mark_offer_viewed(p_token)` RPC. Recommend a small `VOLATILE` `plpgsql` `get_public_offer` that updates-then-returns. `[CITED: HITO 00002_proposals_rls.sql mark_proposal_viewed pattern]`

### Token security (the load-bearing piece — exceed HITO)
| Piece | Phase-1 rule | Why / provenance |
|-------|--------------|------------------|
| Entropy | 256-bit: `encode(extensions.gen_random_bytes(32),'hex')` | HITO uses only 96-bit `randomBytes(12).base64url` — too weak for a login-less security boundary. `[CITED: HITO propuesta/actions.ts genShareToken]` + pitfall #1 |
| At-rest | Store `token_hash = encode(extensions.digest(raw,'sha256'),'hex')`; **raw token only in the emailed URL** | DB leak must not hand out live links. HITO stores raw — do NOT copy that. Pitfall #1 |
| Lookup | RPC hashes the incoming raw token, matches on `token_hash` | Constant-ish single-row lookup; raw token never in a `WHERE token=` that could land in logs |
| Expiry | **Checked inside `accept_offer`/`decline_offer`** (`expires_at > now()`) | HITO's `accept_proposal` does NOT check expiry — a real gap. Enforce in-RPC so it can't be bypassed. `[CITED: HITO 00008 — no expiry check present]` |
| Single-use | `status IN ('sent','viewed')` guard + idempotent re-click | Second accept is a no-op, never double-inserts crew |
| search_path | `SET search_path = ''` (schema-qualify `public.*`, `extensions.digest`) — or minimally `SET search_path = public, pg_temp` (HITO style) | Kills search-path injection; **required** for a clean advisor. Pitfall #6 |
| GRANT | `EXECUTE` to `anon` on **only** these 3–4 functions; nothing else anon-callable | Least privilege. Pitfall #6 |

### SQL test harness (prove before any UI — DATA-04 requires this)
```sql
-- 1. seed org, staff_profile, gig
-- 2. create an offer with a known raw token:
--    raw := encode(extensions.gen_random_bytes(32),'hex');
--    insert offers(..., token_hash) values (..., encode(extensions.digest(raw,'sha256'),'hex'));
-- 3. select get_public_offer(raw)      -> expect status flips sent->viewed, no PII leak
-- 4. select accept_offer(raw,'test')   -> expect ok:true, 1 crew row, offer accepted
-- 5. select accept_offer(raw,'test')   -> expect idempotent no-op (already accepted)
-- 6. set expires_at in the past; select accept_offer(<fresh token>) -> invalid_or_expired
-- 7. select get_public_offer('garbage')-> empty/null (no row leak)
```
Run each via MCP `execute_sql`, assert row counts. This is the phase's highest-value test.

## Zero-Downtime Cutover (DATA-03)

**Recommended order (eliminates any delta window):**
1. **Build & test** the app schema + RPCs (above) — HITO still receiving form writes, untouched.
2. **Create `staff-cvs` bucket** in app project (private) + anon upload policy.
3. **Cut the form:** edit `StaffRegistro.astro` lines 13–14 → new URL + new publishable key; redeploy somosder-web. From this instant, all new applicants land in the **app** DB. HITO `staff_profiles` is now **frozen** (no new writes).
4. **Backfill** HITO's 7 (now-static) rows + copy their 7 CV objects. Because HITO is frozen, "7 in / 7 out" is exact — no race, no double-count.
5. **Import the Sheet** (~146) once obtained from Franco.

**Why this beats double-write:** double-write means editing the form's submit JS to POST to two projects (more code, more failure modes, and a partial-write reconciliation problem). A single atomic constant-swap + redeploy is the smallest change that satisfies "never breaks / never loses." The only rows "at risk" are ones submitted in the seconds during the somosder-web deploy — Vercel does atomic deploys, so there is effectively no gap; a submit either hits old (HITO) or new (app), and step-4 backfill sweeps any last HITO arrivals.

**Anon intake hardening (pitfall #7)** — do this in the same migration that adds the anon INSERT policy:
- `WITH CHECK` requiring `nombre/email/telefono` present, enum/length limits where cheap, and `organization_id IS NULL` (trigger stamps it).
- Column-level `GRANT INSERT (<only the form's columns>) ON staff_profiles TO anon;` — anon can never set `organization_id/estado/rating/notas_internas`.
- `staff-cvs` bucket stays **private**; anon gets INSERT (upload) only; reads are signed-URL only (dashboard, Phase 2).
- Basecase anti-abuse (honeypot already exists in the form as `botcheck`; a Turnstile/hCaptcha free tier or edge rate-limit is a nice-to-have, not a Phase-1 blocker).
- **Recommendation on RPC-vs-direct-insert:** keep the **direct insert** for Phase 1 (zero form-code rewrite = lowest cutover risk) with the tight `WITH CHECK` + column grants above. A SECURITY DEFINER `register_staff_application` RPC is the more secure long-term shape but requires editing the form's submit handler — defer that hardening to a later slice unless the planner wants it now.

## Backfill: Two Sources (DATA-02)

### Source A — HITO `staff_profiles` (7 rows, trivial)
- Cross-project: MCP is per-project; there is **no single `INSERT…SELECT` across two Supabase projects**. For 7 rows: `execute_sql` a `SELECT` on the HITO project, take the JSON, generate 7 `INSERT`s into the app project (map columns 1:1, set `organization_id = <SOMOS_DER_org_uuid>`, keep `id` or regenerate — recommend **keep `id`** so `cv_url` paths and any references stay stable). Dedup key = `email`.
- `dblink`/`postgres_fdw` is overkill for 7 rows; skip it.

### Source B — Google Sheet (~146 rows) — ⚠️ **needs Franco**
- **BLOCKER for DATA-02 completion (not for schema/RPC work):** the Sheet export (CSV) or Drive access must be obtained from Franco. The researcher/planner cannot see it.
- Practical path: Franco exports CSV → load into a **staging table** in the app project (`execute_sql` a `CREATE TABLE staging_sheet (...)` + insert, or MCP CSV load) → `INSERT INTO staff_profiles SELECT <mapped/normalized columns>` → set `organization_id`, `source='google_sheet'` (distinguish origin), normalize oficios/país strings to match the form's vocab, coerce dates/booleans. Dedup by `email` **against Source A** (7 HITO rows) to avoid re-importing anyone who re-applied via the form.
- **CVs for the 146:** the Google-Form era CVs are **not** in any Supabase bucket. They are likely Google Drive links (a column in the Sheet) or absent. Store whatever link exists in `cv_url`/`portfolio_url`; do **not** assume Storage objects exist for them. Flag to Franco: confirm whether Sheet has CV links.

### Verification queries (prove "no loss")
```sql
-- counts
SELECT count(*) FROM staff_profiles;                          -- expect 7 + N_sheet (post-dedup)
SELECT count(*) FILTER (WHERE organization_id IS NULL);        -- expect 0 after backfill
SELECT source, count(*) FROM staff_profiles GROUP BY source;   -- web_somosder / google_sheet split
SELECT email, count(*) FROM staff_profiles GROUP BY email HAVING count(*) > 1;  -- expect 0 dups
-- spot-check the 7 HITO rows survived with cv_url intact
SELECT id, email, cv_url FROM staff_profiles WHERE source = 'web_somosder' AND cv_url IS NOT NULL;
```
Snapshot/record the pre-backfill count from HITO (7) so the before/after is auditable.

## CV Object Migration (the 7 HITO CVs)

- `cv_url` is stored **relative** (`staff-cvs/<path>`), so once the same object exists in the app's `staff-cvs` bucket, the stored `cv_url` resolves with **no rewrite**. Keep `cv_url` unchanged; move the bytes.
- MCP has **no storage-copy tool.** For 7 objects: a one-time script (Node/curl) that, for each path, downloads from HITO (`{HITO_URL}/storage/v1/object/staff-cvs/<path>` with a HITO key or signed URL) and uploads to `{APP_URL}/storage/v1/object/staff-cvs/<path>` with the app's service key. 7 files — trivial, scriptable or even manual via the Storage UI.
- Flag: this needs the **HITO service/anon key with read on `staff-cvs`** and the **app service key** — obtain both. (The publishable anon key in the form can upload; reading private objects needs a signed URL or service key.)

## Runtime State Inventory

> Included because this is a cutover/migration phase, not pure greenfield.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (source) | HITO `staff_profiles`: **7 rows** (org-less). The **~146** are NOT here — they're in a **Google Sheet**. | Backfill both sources; **obtain Sheet export from Franco** |
| Live service config | `StaffRegistro.astro` **hardcodes** `SUPABASE_URL` + `SUPABASE_ANON` (lines 13–14) — NOT env vars. somosder-web is deployed on Vercel. | Edit the two constants → new project URL + new publishable key; redeploy |
| OS-registered / external state | None — no Task Scheduler/cron tied to this. somosder-web has `/api/lead` SMTP notify (unrelated, leave). | None |
| Secrets / keys | New app project needs a **publishable (anon) key** (goes in the Astro form) and a **service key** (server-only, for CV copy + backfill). HITO service/anon key needed to read the 7 CVs. | Provision new keys; never put service key in the form |
| Build artifacts / buckets | HITO `staff-cvs` bucket holds 7 CV objects; app project has **no bucket yet**. | Create app `staff-cvs` private bucket; copy 7 objects |

## Common Pitfalls

### Pitfall 1: Copying HITO's token verbatim (too weak)
**What goes wrong:** HITO's `share_token` is 96-bit and stored raw. Cloning it makes the app's only security boundary guessable and DB-leak-fatal.
**How to avoid:** 256-bit `gen_random_bytes(32)`, store `sha256` hash, raw token only in the URL. **Warning sign:** a `token` (not `token_hash`) column; `randomBytes(12)`.

### Pitfall 2: Expiry not enforced inside the RPC
**What goes wrong:** HITO's `accept_proposal` checks only `status`, not `expires_at`. An expired link still accepts.
**How to avoid:** every state-changing RPC checks `expires_at > now()` in its guard. **Warning sign:** no `expires_at` comparison in `accept_offer`.

### Pitfall 3: NOT NULL `organization_id` on the live-insert table
**What goes wrong:** the anon form insert (no org) fails instantly; every applicant lost. **How to avoid:** nullable column + BEFORE INSERT trigger default + backfill; consider NOT NULL only after cutover proven. (Pitfall #8 in project research.)

### Pitfall 4: `pgcrypto` not schema-qualified under a pinned search_path
**What goes wrong:** with `SET search_path = ''`, `gen_random_bytes()`/`digest()` aren't found — Supabase puts `pgcrypto` in the `extensions` schema, not `public`. **How to avoid:** call `extensions.gen_random_bytes(...)`, `extensions.digest(...)`. **Warning sign:** "function does not exist" in the RPC test.

### Pitfall 5: Backfilling before cutover (delta race)
**What goes wrong:** backfill HITO's 7, then more applicants arrive in HITO before the form is cut → those are lost/duplicated. **How to avoid:** cut the form FIRST (freezes HITO), backfill second.

### Pitfall 6: Anon INSERT with `WITH CHECK (true)` / no column grants
**What goes wrong:** the public anon key (published in the form) lets anyone write arbitrary rows, set `organization_id`, or poison the pool. **How to avoid:** tight `WITH CHECK` + column-level `GRANT INSERT` on only the form's columns. (Pitfall #7.)

### Pitfall 7: State-change on GET / CV exposure on the public offer
**What goes wrong:** preview bots auto-accept a GET link; `get_public_offer` returns CV/other PII. **How to avoid:** accept/decline are POST-invoked RPCs from a human tap; `get_public_offer` returns first-name + offer/gig/org only. (Pitfalls #2, CV exposure.) *(Phase 1 proves this in SQL; the POST-not-GET boundary is enforced when the UI lands in Phase 4 — note it in the RPC's contract now.)*

## get_advisors Expectations (DATA-04 "clean advisor")

Run `get_advisors` (security) after every migration. **Expect and resolve:**
| Finding | Cause | Resolution |
|---------|-------|-----------|
| `function_search_path_mutable` | RPC without `SET search_path` | Pin `search_path` on every function (helpers too). **Blocker — must be zero.** |
| `rls_disabled_in_public` / `rls_enabled_no_policy` | table without RLS or without a policy | Enable RLS + add policies on `staff_profiles/gigs/crew/offers/organizations/members` |
| `security_definer_view` | a view marked SECURITY DEFINER | Don't use SECURITY DEFINER views; use SECURITY DEFINER **functions** only |
| `extension_in_public` (pgcrypto) | extension installed in public | Keep `pgcrypto` in `extensions` schema (Supabase default) — informational; acceptable |
| `anon`-executable functions | the 3–4 magic-link RPCs granted to anon | **Intended** — these are the controlled doors; not a defect |
- Auth-level advisories (leaked-password protection, MFA) are **not applicable** — Phase 1 has no auth. Don't chase them.

## Code Examples

Verified patterns read from HITO migrations (adapt names to the app schema):

### Accept RPC skeleton (from `00008_proposal_acceptance.sql`, hardened)
```sql
-- Source: HITO 00008_proposal_acceptance.sql (shape) + project PITFALLS.md (hardening)
CREATE OR REPLACE FUNCTION accept_offer(p_token text, p_user_agent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''   -- schema-qualify everything below
AS $$
DECLARE v_o public.offers%ROWTYPE; v_crew uuid;
BEGIN
  SELECT * INTO v_o FROM public.offers
   WHERE token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
     AND status IN ('sent','viewed')
     AND expires_at > now();                      -- expiry enforced IN-RPC (HITO omits this)
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','invalid_or_expired'); END IF;

  INSERT INTO public.crew (organization_id, gig_id, staff_profile_id, role)
  VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  ON CONFLICT (gig_id, staff_profile_id) DO NOTHING
  RETURNING id INTO v_crew;

  UPDATE public.offers SET status='accepted', responded_at=now() WHERE id = v_o.id;
  RETURN jsonb_build_object('ok',true,'crew_id',v_crew);
END; $$;
GRANT EXECUTE ON FUNCTION accept_offer(text,text) TO anon, authenticated;
```

### Org helpers (verbatim from HITO `00001`/`00052`)
```sql
-- Source: HITO 00001_rls_policies.sql & 00052_roles_permissions.sql
CREATE FUNCTION is_org_member(org_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM members WHERE organization_id=org_id AND user_id=auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

## State of the Art

| Old Approach (HITO / prior project docs) | Phase-1 Approach | Why changed |
|------------------------------------------|------------------|-------------|
| Shared HITO Supabase, migrate `staff_profiles` in place | **Own new Supabase project**, backfill copy | Owner decision (ARCHITECTURE addendum 2026-07-13): standalone product, own data |
| 96-bit raw `share_token` | 256-bit **hashed** `token_hash` | Login-less security boundary must be strong + leak-safe (pitfall #1) |
| `accept_proposal` checks status only | `accept_offer` checks status **and** expiry | Close HITO's expiry gap |
| Local `supabase` CLI for migrations | Supabase **MCP** (`apply_migration`) | MCP is in-session; no Docker/local stack needed |
| "146 applicants in HITO" | **7 in HITO + ~146 in Google Sheet** | Live query corrected the assumption; two-source backfill |
| "copy HITO `register_web_lead` RPC" | **No such function exists**; form does direct REST insert | grep confirms HITO has no `register_web_lead` |

**Deprecated/outdated:** the CLAUDE.md "What NOT to Use" line "*A second/duplicate database → Migrate `staff_profiles` in-place in HITO*" and "*New crew tables → write to HITO's `crew_members`*" are **superseded** by the own-DB decision — Phase 1 DOES create its own DB and its own `crew` table. `.planning/` docs win on this conflict (per orchestrator note).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ~146 applicants live in a Google Sheet (not another HITO table) | Backfill Source B | If they're elsewhere, the import source differs — but schema/RPC work is unaffected. Confirm with Franco. |
| A2 | Sheet CVs are Drive links or absent (not Supabase objects) | CV Object Migration | If CVs are elsewhere, extra migration step. Confirm with Franco. |
| A3 | `pgcrypto` is in the `extensions` schema on the new project | Token Security, Pitfall 4 | If in `public`, schema-qualify differently. Verify with a one-line `SELECT extensions.gen_random_bytes(1)` at build time. |
| A4 | Oficios stay as `text[]` tags for Phase 1 (no normalized catalog) | staff_profiles | Low — SRCH-01 works on tags; a catalog can come later. Claude's discretion. |
| A5 | Keeping direct anon INSERT (not an intake RPC) is acceptable for the cutover | Zero-Downtime Cutover | If planner wants the RPC now, add form-JS rewrite scope. Recommendation is direct-insert + tight WITH CHECK. |
| A6 | Vercel atomic deploy ⇒ no gap during form cutover | Zero-Downtime Cutover | Negligible; step-4 backfill sweeps any last HITO row anyway. |

## Open Questions

1. **Google Sheet export (BLOCKS DATA-02 completion, not schema/RPC).**
   - Known: ~146 applicants exist somewhere outside HITO's DB.
   - Unclear: exact location, columns, whether CV links exist.
   - Recommendation: plan schema + RPCs + cutover + Source-A backfill without it; gate the Source-B import task on Franco delivering the CSV. Add a `checkpoint:human` for the export.
2. **Consent/PII notice on the form (Ley 25.326).** The live form already has a consent checkbox ("Acepto que DER guarde mis datos…"). STATE.md flags a compliance gap; the form-repoint slice is the natural place to confirm the notice names the correct controller and rights. Low effort; note for the planner. `[CITED: StaffRegistro.astro consent line 256-258; STATE.md blocker]`
3. **`NOT NULL organization_id` timing.** Recommend leaving nullable through Phase 1; revisit adding NOT NULL + FK after cutover + backfill are proven (expand-migrate-contract step 4).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase MCP (create_project/apply_migration/execute_sql/get_advisors) | All of Phase 1 | ✓ (parent session) | — | Local supabase CLI (needs Docker) — avoid |
| `pgcrypto` extension | Token gen/hash | ✓ (Supabase built-in, `extensions` schema) | — | app-side `crypto.randomBytes` (Phase 3, not needed for SQL tests) |
| Google Sheet CSV export | DATA-02 Source B | ✗ | — | **Franco must provide** — no fallback |
| HITO service/anon key w/ `staff-cvs` read | 7 CV object copy | ? (obtain) | — | Storage UI manual download of 7 files |
| App project service key | Backfill + CV upload | ✗ (created with project) | — | — |

**Missing with no fallback:** Google Sheet export (blocks Source-B import only).
**Missing with fallback:** CV copy keys (manual Storage-UI copy of 7 files works).

## Security Domain

> `security_enforcement: true`, ASVS level 1, block_on: high.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-------------------------------|
| V1 Architecture | yes | Token is the sole credential for the public flow; documented threat model (this file) |
| V2 Authentication | partial | No user auth in Phase 1; the magic-link token IS the auth for the public RPCs — 256-bit + hashed |
| V3 Session Management | no | No sessions this phase |
| V4 Access Control | yes | RLS on every table (`is_org_member`/`is_org_writer`); anon reaches data only via granted SECURITY DEFINER RPCs; column-level GRANT on anon INSERT |
| V5 Input Validation | yes | RPC params validated (token hash lookup, status/expiry guards); anon INSERT `WITH CHECK`; enum CHECK on `offers.status` |
| V6 Cryptography | yes | `pgcrypto` `gen_random_bytes(32)` (CSPRNG) + `sha256` at rest — never hand-rolled |
| V7 Error Handling/Logging | partial | RPCs return structured `{ok,reason}`, never leak row contents; keep raw tokens out of logged `WHERE` clauses |
| V12 Files/Resources | yes | `staff-cvs` private bucket; anon upload-only; reads via signed URL (later) — no public CV URLs |

### Known Threat Patterns for Supabase Postgres + token flow
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guessable/replayable magic-link token | Spoofing/Elevation | 256-bit `gen_random_bytes`, hashed at rest, expiry + single-use in-RPC |
| SECURITY DEFINER search_path injection | Tampering/Elevation | `SET search_path=''` + schema-qualify; `get_advisors` must show zero `function_search_path_mutable` |
| RLS bypass via over-broad definer function | Info Disclosure | Per-row scope by token; return only safe fields; grant EXECUTE to anon on the 3–4 RPCs only |
| Anon INSERT abuse on `staff_profiles` | Tampering/DoS | Tight `WITH CHECK` + column grants + honeypot; keep bucket private |
| CV leak via public URL | Info Disclosure | Private bucket, signed short-TTL URLs, never on the public offer page |
| Preview-bot GET auto-accept | Tampering | State change only via POST-invoked RPC (enforced in UI phase; RPC contract documents it) |

**block_on: high** — the two hard gates for this phase: (1) `get_advisors` security = zero high findings after each migration; (2) tokens are 256-bit + hashed with in-RPC expiry. Ship neither weaker.

## Sources

### Primary (HIGH confidence)
- `/Users/fridao/Proyectos/HITO-by-DER-main/supabase/migrations/00008_proposal_acceptance.sql` — accept RPC shape (read in full)
- `.../migrations/00001_rls_policies.sql` — `is_org_member`, RLS policy convention
- `.../migrations/00052_roles_permissions.sql` — `is_org_writer`, restrictive write gate
- `.../migrations/00035_baseline_existing.sql` — `crew_members`/`crew_assignments` (UNIQUE(crew_member_id,event_id))
- `.../migrations/00061_event_timezone.sql` — events `start_date` timestamptz + `timezone`
- `.../migrations/00002_proposals_rls.sql` — sent→viewed on first read
- `.../app/[orgSlug]/eventos/[id]/propuesta/actions.ts` — `genShareToken = randomBytes(12).base64url` (the weak token to improve on)
- `somosder-web/src/components/StaffRegistro.astro` — exact insert path, payload keys, CV upload flow, hardcoded URL/key (lines 13–14)
- Orchestrator-supplied verified live-DB facts (2026-07-13 Supabase MCP)
- `.planning/research/{ARCHITECTURE,STACK,PITFALLS}.md` — project research (built upon, not repeated)

### Secondary (MEDIUM confidence)
- Supabase docs — Database Advisors / `function_search_path_mutable`, RLS (via PITFALLS.md citations)
- Supabase MCP server instructions (this session) — available tools

## Metadata

**Confidence breakdown:**
- Target schema & RLS: HIGH — copied from live HITO migrations + verified column list
- Magic-link RPC & token security: HIGH — HITO template read in full; hardening from project PITFALLS
- Form cutover path: HIGH — form read line-by-line; hardcoded target confirmed
- Backfill Source A (7 rows) + CV copy: HIGH mechanics, needs keys
- Backfill Source B (Sheet): MEDIUM — source unseen, needs Franco

**Research date:** 2026-07-13
**Valid until:** ~2026-08-13 (stable; HITO patterns and the live schema won't move). Re-verify if the new project's `pgcrypto` schema differs or the Sheet turns out to live elsewhere.
