-- Test harness: staff_app_create_offer (offer WRITE path) + staff_app_gigs view.
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location).
-- Plan: 03-01 Task 2. Run via Supabase MCP execute_sql (superuser context).
--
-- Proves the create path in SQL BEFORE any UI (Phase 3 server action, 03-03):
--   writer + quick-create gig -> one gig (hito_event_id NULL) + one offer
--   (status='sent', future expires_at), token_hash = sha256(raw), len 64 /
--   bad-org gig_id -> gig_not_found / non-writer identity -> forbidden.
-- Seeds transient rows in staff_app.*, asserts, then DELETEs everything so the
-- schema is left empty (same discipline as the 0003 harness).
--
-- IDENTITY NOTE: staff_app.is_org_writer reads auth.uid(). Under raw execute_sql
-- there is no JWT, so we SIMULATE the caller by setting request.jwt.claims at the
-- SESSION level (is_local=false) so auth.uid() resolves across statements in this
-- connection. The seeded owner 73fc15e0-69a6-4fc2-a832-696bd6f0f95c (org member,
-- role 'owner' -> is_org_writer true, from 0007) is our writer. A random UUID is
-- the non-writer. Claims are reset to '' at cleanup.
--
-- MVCC NOTE (from 0003): read persisted side effects in a statement SEPARATE from
-- the RPC call — a sibling sub-SELECT in the same statement reads the pre-write
-- snapshot. The create RPC result is captured into a TEMP TABLE for later asserts.
--
-- Fixed test identifiers:
--   staff_profile (in-org)      00000000-0000-0000-0000-0000000008a1
--   staff_profile (other-org)   n/a — org forced from constant, not tested here
--   writer user_id              73fc15e0-69a6-4fc2-a832-696bd6f0f95c (seeded owner)
--   non-writer user_id          00000000-0000-0000-0000-00000000dead
--   org (seeded)                aa29aa2f-4d34-4e53-b62c-7397e8a4d123
--   quick-gig title marker      'HARNESS 0008 QuickGig'

-- ===========================================================================
-- STEP 0 — pre-clean any leftover seed rows (idempotent re-run).
-- ===========================================================================
DELETE FROM staff_app.offers WHERE staff_profile_id = '00000000-0000-0000-0000-0000000008a1';
DELETE FROM staff_app.gigs   WHERE organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
                               AND title = 'HARNESS 0008 QuickGig';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000008a1';
DROP TABLE IF EXISTS _h0008_create;
DROP TABLE IF EXISTS _h0008_badgig;
DROP TABLE IF EXISTS _h0008_forbidden;

-- ===========================================================================
-- STEP 1 — become the seeded org writer; seed one in-org candidate.
-- ===========================================================================
SELECT set_config('request.jwt.claims',
                  '{"sub":"73fc15e0-69a6-4fc2-a832-696bd6f0f95c","role":"authenticated"}',
                  false) AS jwt_set;
-- sanity: auth.uid() now resolves to the writer, is_org_writer must be TRUE.
SELECT auth.uid() AS caller_uid,
       staff_app.is_org_writer('aa29aa2f-4d34-4e53-b62c-7397e8a4d123') AS is_writer;  -- true

INSERT INTO staff_app.staff_profiles (id, nombre, apellido, email, telefono, documento, organization_id, source)
VALUES ('00000000-0000-0000-0000-0000000008a1','Ana Test','Gomez','harness0008@test.local',
        '+540000000008','DNI-0008','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','harness_test');

-- ===========================================================================
-- STEP 2 — CASE: writer + quick-create gig. Capture the returned raw token.
-- ===========================================================================
CREATE TEMP TABLE _h0008_create AS
SELECT public.staff_app_create_offer(
  p_staff_profile_id => '00000000-0000-0000-0000-0000000008a1',
  p_role             => '  Sonidista  ',                      -- trims to 'Sonidista'
  p_gig_id           => NULL,                                 -- quick-create branch
  p_gig_title        => 'HARNESS 0008 QuickGig',
  p_gig_starts_at    => now() + interval '10 days',
  p_gig_ends_at      => now() + interval '11 days',
  p_gig_venue        => 'Test Venue 0008',
  p_amount           => 75000,
  p_conditions       => 'Turno noche, viaticos incluidos',
  p_expires_in_days  => 7
) AS j;

-- The RPC result shape: ok=true, offer_id, gig_id, token (64-hex raw).
SELECT (SELECT j->>'ok'       FROM _h0008_create) AS ok,               -- true
       (SELECT length(j->>'token') FROM _h0008_create) AS raw_token_len, -- 64
       (SELECT (j ? 'token')  FROM _h0008_create) AS returns_token;     -- true

-- ===========================================================================
-- STEP 3 — assert exactly one new gig (hito_event_id NULL, status draft) and one
--          new offer (status='sent', future expires_at, role trimmed).
-- ===========================================================================
SELECT count(*) AS gigs_created,                                         -- 1
       bool_and(hito_event_id IS NULL) AS all_hito_null,                 -- true
       bool_and(status = 'draft') AS all_draft
FROM staff_app.gigs
WHERE organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
  AND title = 'HARNESS 0008 QuickGig';

SELECT o.status                       AS offer_status,                   -- sent
       (o.expires_at > now())         AS expires_future,                 -- true
       o.role                         AS offer_role,                     -- 'Sonidista' (trimmed)
       o.amount                       AS offer_amount,                   -- 75000
       (o.gig_id = (r.j->>'gig_id')::uuid) AS gig_matches_return          -- true
FROM _h0008_create r
JOIN staff_app.offers o ON o.id = (r.j->>'offer_id')::uuid;

-- ===========================================================================
-- STEP 4 — assert token_hash-at-rest = sha256(raw returned) and length 64.
-- ===========================================================================
SELECT (o.token_hash = encode(extensions.digest(r.j->>'token','sha256'),'hex')) AS hash_matches,  -- true
       (length(o.token_hash) = 64)                                              AS hash_len_64,   -- true
       (EXISTS (SELECT 1 FROM staff_app.offers x WHERE x.token_hash = (r.j->>'token'))) AS raw_persisted -- false (raw never stored)
FROM _h0008_create r
JOIN staff_app.offers o ON o.id = (r.j->>'offer_id')::uuid;

-- ===========================================================================
-- STEP 5 — CASE: writer passes a gig_id that is NOT in the org -> gig_not_found.
-- ===========================================================================
CREATE TEMP TABLE _h0008_badgig AS
SELECT public.staff_app_create_offer(
  p_staff_profile_id => '00000000-0000-0000-0000-0000000008a1',
  p_role             => 'Iluminador',
  p_gig_id           => '00000000-0000-0000-0000-0000badf0001'   -- nonexistent / not in org
) AS j;
SELECT (SELECT j->>'ok'     FROM _h0008_badgig) AS ok,        -- false
       (SELECT j->>'reason' FROM _h0008_badgig) AS reason;    -- gig_not_found

-- ===========================================================================
-- STEP 6 — CASE: non-writer identity -> forbidden (gate holds inside DEFINER).
-- ===========================================================================
SELECT set_config('request.jwt.claims',
                  '{"sub":"00000000-0000-0000-0000-00000000dead","role":"authenticated"}',
                  false) AS jwt_nonwriter;
SELECT staff_app.is_org_writer('aa29aa2f-4d34-4e53-b62c-7397e8a4d123') AS is_writer_nonwriter;  -- false

CREATE TEMP TABLE _h0008_forbidden AS
SELECT public.staff_app_create_offer(
  p_staff_profile_id => '00000000-0000-0000-0000-0000000008a1',
  p_role             => 'Stage Manager',
  p_gig_id           => NULL,
  p_gig_title        => 'HARNESS 0008 QuickGig'
) AS j;
SELECT (SELECT j->>'ok'     FROM _h0008_forbidden) AS ok,        -- false
       (SELECT j->>'reason' FROM _h0008_forbidden) AS reason;    -- forbidden

-- Confirm the forbidden call created NOTHING extra (still exactly 1 quick-gig).
SELECT count(*) AS gigs_after_forbidden
FROM staff_app.gigs
WHERE organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
  AND title = 'HARNESS 0008 QuickGig';                          -- 1

-- ===========================================================================
-- CLEANUP — remove all transient rows + temp tables; reset the simulated JWT.
-- staff_app.* left empty; DELETE runs as superuser so RLS/identity is irrelevant.
-- ===========================================================================
DELETE FROM staff_app.offers WHERE staff_profile_id = '00000000-0000-0000-0000-0000000008a1';
DELETE FROM staff_app.gigs   WHERE organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
                               AND title = 'HARNESS 0008 QuickGig';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000008a1';
DROP TABLE IF EXISTS _h0008_create;
DROP TABLE IF EXISTS _h0008_badgig;
DROP TABLE IF EXISTS _h0008_forbidden;
SELECT set_config('request.jwt.claims', '', false) AS jwt_reset;

SELECT (SELECT count(*) FROM staff_app.offers WHERE staff_profile_id = '00000000-0000-0000-0000-0000000008a1') AS offers_left, -- 0
       (SELECT count(*) FROM staff_app.gigs   WHERE title = 'HARNESS 0008 QuickGig') AS gigs_left,                            -- 0
       (SELECT count(*) FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000008a1') AS profiles_left;   -- 0
