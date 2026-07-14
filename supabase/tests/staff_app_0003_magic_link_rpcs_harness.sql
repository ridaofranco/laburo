-- Test harness: staff_app magic-link RPCs (get_public_offer/accept_offer/decline_offer)
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project - D-03 co-location).
-- Plan: 01-02 Task 2. Run via Supabase MCP execute_sql (superuser context).
--
-- Proves the full offer lifecycle in SQL BEFORE any UI (Phase 4) consumes it:
--   valid read (no PII, sent->viewed) / accept / idempotent re-accept /
--   expired reject / garbage reject. Uses fixed test UUIDs + two fixed
--   256-bit-length raw tokens for determinism. Seeds transient rows in
--   staff_app.*, asserts, then DELETEs everything so the schema is left empty
--   for the real backfill.
--
-- NOTE on MVCC: a VOLATILE RPC (e.g. get_public_offer flipping sent->viewed, or
-- accept_offer inserting crew) commits its writes, but a SIBLING sub-SELECT in
-- the SAME statement reads the statement-start snapshot and will show the
-- pre-write value. Always read persisted state in a SEPARATE statement from the
-- RPC call. This is a snapshot artifact of the test, not an RPC defect.
--
-- Fixed test identifiers:
--   staff_profile 00000000-0000-0000-0000-0000000000a1
--   gig           00000000-0000-0000-0000-0000000000b1
--   offer  (live) 00000000-0000-0000-0000-0000000000c1  raw = 1111...8888
--   offer  (exp.) 00000000-0000-0000-0000-0000000000c2  raw = 9999...0000
--   org (seeded)  aa29aa2f-4d34-4e53-b62c-7397e8a4d123

-- ===========================================================================
-- STEP 0+1+2 — pre-clean + SEED (staff_profile, gig, live offer)
-- ===========================================================================
DELETE FROM staff_app.crew   WHERE gig_id = '00000000-0000-0000-0000-0000000000b1';
DELETE FROM staff_app.offers WHERE id IN ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-0000000000b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000000a1';

INSERT INTO staff_app.staff_profiles (id, nombre, apellido, email, telefono, documento, cv_url, organization_id, source)
VALUES ('00000000-0000-0000-0000-0000000000a1','Juan Test','Perez','harness@test.local','+540000000000','DNI-TEST','staff-cvs/test.pdf','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','harness_test');

INSERT INTO staff_app.gigs (id, organization_id, title, venue_name, starts_at, ends_at)
VALUES ('00000000-0000-0000-0000-0000000000b1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','Harness Gig','Test Venue', now()+interval '10 days', now()+interval '11 days');

-- Only the sha256 hash of the raw token is stored; the raw token never persists.
INSERT INTO staff_app.offers (id, organization_id, gig_id, staff_profile_id, role, amount, conditions, token_hash, status, expires_at)
VALUES ('00000000-0000-0000-0000-0000000000c1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
        '00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1',
        'Sonidista', 50000, 'Turno noche, viaticos incluidos',
        encode(extensions.digest('1111111122222222333333334444444455555555666666667777777788888888','sha256'),'hex'),
        'sent', now()+interval '7 days');

-- Proof: gen_random_bytes(32) -> 64 hex chars (256-bit); token_hash is 64-hex sha256.
SELECT length(encode(extensions.gen_random_bytes(32),'hex')) AS gen_token_hex_len,   -- 64
       (SELECT length(token_hash) FROM staff_app.offers WHERE id='00000000-0000-0000-0000-0000000000c1') AS token_hash_hex_len; -- 64

-- ===========================================================================
-- STEP 3 — CASE: get_public_offer(valid). Safe fields only, no PII, sent->viewed.
-- ===========================================================================
WITH r AS MATERIALIZED (
  SELECT staff_app.get_public_offer('1111111122222222333333334444444455555555666666667777777788888888') AS j
)
SELECT (SELECT j FROM r)                              AS result_json,
       (SELECT j->>'ok' FROM r)                       AS ok,               -- true
       (SELECT (j::text) ILIKE '%cv_url%'    FROM r)  AS leaks_cv_url,     -- false
       (SELECT (j::text) ILIKE '%email%'     FROM r)  AS leaks_email,      -- false
       (SELECT (j::text) ILIKE '%telefono%'  FROM r)  AS leaks_telefono,   -- false
       (SELECT (j::text) ILIKE '%documento%' FROM r)  AS leaks_documento;  -- false
-- Persisted flip (separate statement to dodge the MVCC artifact): status='viewed', viewed_at set.
SELECT status, (viewed_at IS NOT NULL) AS viewed_at_set
FROM staff_app.offers WHERE id='00000000-0000-0000-0000-0000000000c1';        -- viewed / true

-- ===========================================================================
-- STEP 4 — CASE: first accept_offer(valid) -> ok:true, exactly 1 crew, accepted.
-- ===========================================================================
SELECT staff_app.accept_offer('1111111122222222333333334444444455555555666666667777777788888888','test-agent') AS accept_result; -- ok:true, crew_id
SELECT (SELECT count(*) FROM staff_app.crew
          WHERE gig_id='00000000-0000-0000-0000-0000000000b1'
            AND staff_profile_id='00000000-0000-0000-0000-0000000000a1') AS crew_count,      -- 1
       (SELECT status FROM staff_app.offers WHERE id='00000000-0000-0000-0000-0000000000c1') AS offer_status; -- accepted

-- ===========================================================================
-- STEP 5 — CASE: second accept_offer(same token) -> idempotent no-op.
-- ===========================================================================
SELECT staff_app.accept_offer('1111111122222222333333334444444455555555666666667777777788888888','test-agent') AS second_accept_result; -- ok:false, invalid_or_expired
SELECT count(*) AS crew_count_after_second_accept
FROM staff_app.crew
WHERE gig_id='00000000-0000-0000-0000-0000000000b1'
  AND staff_profile_id='00000000-0000-0000-0000-0000000000a1';                 -- still 1 (no second insert)

-- ===========================================================================
-- STEP 6 — CASE: expired token -> accept & decline both reject; 0 crew added.
-- ===========================================================================
INSERT INTO staff_app.offers (id, organization_id, gig_id, staff_profile_id, role, token_hash, status, expires_at)
VALUES ('00000000-0000-0000-0000-0000000000c2','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
        '00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1',
        'Iluminador',
        encode(extensions.digest('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000','sha256'),'hex'),
        'sent', now() - interval '1 day');

SELECT staff_app.accept_offer('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000','test-agent') AS expired_accept_result; -- ok:false
SELECT staff_app.decline_offer('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000')            AS expired_decline_result, -- ok:false
       (SELECT count(*) FROM staff_app.crew WHERE gig_id='00000000-0000-0000-0000-0000000000b1') AS crew_count_total, -- 1 (0 added)
       (SELECT status FROM staff_app.offers WHERE id='00000000-0000-0000-0000-0000000000c2') AS expired_offer_status; -- sent (untouched)

-- ===========================================================================
-- STEP 7 — CASE: garbage token -> get_public_offer NULL, accept/decline ok:false.
-- ===========================================================================
SELECT staff_app.get_public_offer('garbage-not-a-real-token')            AS gpo_result,     -- NULL
       (staff_app.get_public_offer('garbage-not-a-real-token') IS NULL)  AS gpo_is_null,    -- true
       staff_app.accept_offer('garbage-not-a-real-token','x')            AS accept_result,  -- ok:false
       staff_app.decline_offer('garbage-not-a-real-token')              AS decline_result, -- ok:false
       (SELECT count(*) FROM staff_app.crew WHERE gig_id='00000000-0000-0000-0000-0000000000b1') AS crew_count_total; -- 1

-- ===========================================================================
-- CLEANUP — remove all transient seed rows; staff_app.* left empty for backfill.
-- ===========================================================================
DELETE FROM staff_app.crew   WHERE gig_id = '00000000-0000-0000-0000-0000000000b1';
DELETE FROM staff_app.offers WHERE id IN ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-0000000000b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000000a1';

SELECT (SELECT count(*) FROM staff_app.crew)           AS crew_total,      -- 0
       (SELECT count(*) FROM staff_app.offers)         AS offers_total,    -- 0
       (SELECT count(*) FROM staff_app.gigs)           AS gigs_total,      -- 0
       (SELECT count(*) FROM staff_app.staff_profiles) AS profiles_total;  -- 0
