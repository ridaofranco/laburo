-- Test harness: staff_app_0009 public magic-link wrappers + offers view
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location).
-- Plan: 04-01 Task 2. Run via Supabase MCP execute_sql (superuser context) by the
-- ORCHESTRATOR, AFTER apply_migration of staff_app_0009_public_magic_link.sql.
--
-- Proves the FULL offer lifecycle THROUGH the public.* wrappers (not the inner
-- staff_app RPCs) + the offers view visibility, so Phase-4 UI (04-02/04-03) has a
-- verified data door:
--   garbage->NULL / valid read (sent->viewed) / accept (+1 crew, accepted) /
--   idempotent re-accept / decline / expired-by-date (status intact, derived in FE) /
--   view visible to the writer. Seeds transient rows, asserts, then DELETEs
--   everything so staff_app.* is left empty (same discipline as the 0003 harness).
--
-- NOTE on MVCC (from 01-02): a VOLATILE RPC (get_public_offer flipping sent->viewed,
-- accept_offer inserting crew) commits its writes, but a SIBLING sub-SELECT in the
-- SAME statement reads the statement-start snapshot and shows the pre-write value.
-- Always read persisted state in a SEPARATE statement from the wrapper call.
--
-- NOTE on grants: this harness runs as superuser, so RLS is bypassed and the
-- security_invoker view returns rows regardless of role. The anon-REVOKE on
-- public.staff_app_offers and the anon/authenticated EXECUTE grants are confirmed
-- SEPARATELY by the orchestrator via has_table_privilege / has_function_privilege
-- (Task 3, step 4) — not provable from this superuser harness.
--
-- Fixed test identifiers:
--   staff_profile 00000000-0000-0000-0000-000000009a1
--   gig           00000000-0000-0000-0000-000000009b1
--   offer (accept)00000000-0000-0000-0000-000000009c1  raw = 1111...8888
--   offer (decline)00000000-0000-0000-0000-000000009c3 raw = aaaa...dddd
--   offer (expired)00000000-0000-0000-0000-000000009c2 raw = 9999...0000
--   org (seeded)  aa29aa2f-4d34-4e53-b62c-7397e8a4d123

-- ===========================================================================
-- STEP 0+1 — pre-clean + SEED (staff_profile, gig, three offers: accept/decline/expired)
-- ===========================================================================
DELETE FROM staff_app.crew   WHERE gig_id = '00000000-0000-0000-0000-000000009b1';
DELETE FROM staff_app.offers WHERE id IN ('00000000-0000-0000-0000-000000009c1','00000000-0000-0000-0000-000000009c2','00000000-0000-0000-0000-000000009c3');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-000000009b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-000000009a1';

INSERT INTO staff_app.staff_profiles (id, nombre, apellido, email, telefono, documento, cv_url, organization_id, source)
VALUES ('00000000-0000-0000-0000-000000009a1','Ana Wrapper','Gomez','harness9@test.local','+540000000009','DNI-TEST-9','staff-cvs/test9.pdf','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','harness_test');

INSERT INTO staff_app.gigs (id, organization_id, title, venue_name, starts_at, ends_at)
VALUES ('00000000-0000-0000-0000-000000009b1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','Harness9 Gig','Test Venue 9', now()+interval '10 days', now()+interval '11 days');

-- Only the sha256 hash of the raw token is stored; the raw token never persists.
-- (1) live offer to ACCEPT, (3) live offer to DECLINE, (2) EXPIRED offer.
INSERT INTO staff_app.offers (id, organization_id, gig_id, staff_profile_id, role, amount, conditions, token_hash, status, expires_at)
VALUES
 ('00000000-0000-0000-0000-000000009c1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-000000009b1','00000000-0000-0000-0000-000000009a1',
  'Sonidista', 50000, 'Turno noche, viaticos incluidos',
  encode(extensions.digest('1111111122222222333333334444444455555555666666667777777788888888','sha256'),'hex'),
  'sent', now()+interval '7 days'),
 ('00000000-0000-0000-0000-000000009c3','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-000000009b1','00000000-0000-0000-0000-000000009a1',
  'Iluminador', 40000, 'Media jornada',
  encode(extensions.digest('aaaaaaaabbbbbbbbccccccccddddddddaaaaaaaabbbbbbbbccccccccdddddddd','sha256'),'hex'),
  'sent', now()+interval '7 days'),
 ('00000000-0000-0000-0000-000000009c2','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-000000009b1','00000000-0000-0000-0000-000000009a1',
  'Stage manager',
  60000, 'Jornada completa',
  encode(extensions.digest('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000','sha256'),'hex'),
  'sent', now() - interval '1 day');

-- ===========================================================================
-- STEP 2 — CASE: garbage token via wrapper -> SQL NULL (NOT {ok:false}).
-- ===========================================================================
SELECT public.staff_app_get_public_offer('garbage-not-a-real-token')            AS gpo_garbage,   -- NULL
       (public.staff_app_get_public_offer('garbage-not-a-real-token') IS NULL)  AS gpo_is_null;   -- true

-- ===========================================================================
-- STEP 3 — CASE: get_public_offer(valid) via wrapper. {ok:true}, no PII, sent->viewed.
-- ===========================================================================
WITH r AS MATERIALIZED (
  SELECT public.staff_app_get_public_offer('1111111122222222333333334444444455555555666666667777777788888888') AS j
)
SELECT (SELECT j FROM r)                              AS result_json,
       (SELECT j->>'ok' FROM r)                       AS ok,               -- true
       (SELECT (j::text) ILIKE '%cv_url%'    FROM r)  AS leaks_cv_url,     -- false
       (SELECT (j::text) ILIKE '%email%'     FROM r)  AS leaks_email,      -- false
       (SELECT (j::text) ILIKE '%telefono%'  FROM r)  AS leaks_telefono,   -- false
       (SELECT (j::text) ILIKE '%documento%' FROM r)  AS leaks_documento;  -- false
-- Persisted flip (separate statement to dodge the MVCC artifact): status='viewed', viewed_at set.
SELECT status, (viewed_at IS NOT NULL) AS viewed_at_set
FROM staff_app.offers WHERE id='00000000-0000-0000-0000-000000009c1';        -- viewed / true

-- ===========================================================================
-- STEP 4 — CASE: first accept via wrapper -> {ok:true, crew_id}, exactly 1 crew, accepted.
-- ===========================================================================
SELECT public.staff_app_accept_offer('1111111122222222333333334444444455555555666666667777777788888888','test-ua') AS accept_result; -- ok:true, crew_id
SELECT (SELECT count(*) FROM staff_app.crew
          WHERE gig_id='00000000-0000-0000-0000-000000009b1'
            AND staff_profile_id='00000000-0000-0000-0000-000000009a1') AS crew_count,      -- 1
       (SELECT status FROM staff_app.offers WHERE id='00000000-0000-0000-0000-000000009c1') AS offer_status; -- accepted

-- ===========================================================================
-- STEP 5 — CASE: second accept via wrapper (same token) -> idempotent no-op.
-- ===========================================================================
SELECT public.staff_app_accept_offer('1111111122222222333333334444444455555555666666667777777788888888','test-ua') AS second_accept_result; -- ok:false, invalid_or_expired
SELECT count(*) AS crew_count_after_second_accept
FROM staff_app.crew
WHERE gig_id='00000000-0000-0000-0000-000000009b1'
  AND staff_profile_id='00000000-0000-0000-0000-000000009a1';                 -- still 1 (no second insert)

-- ===========================================================================
-- STEP 6 — CASE: decline via wrapper on a separate 'sent' offer -> {ok:true, declined}.
-- ===========================================================================
SELECT public.staff_app_decline_offer('aaaaaaaabbbbbbbbccccccccddddddddaaaaaaaabbbbbbbbccccccccdddddddd') AS decline_result; -- ok:true, status:declined
SELECT status FROM staff_app.offers WHERE id='00000000-0000-0000-0000-000000009c3';                          -- declined

-- ===========================================================================
-- STEP 7 — CASE: expired-by-date offer. get_public_offer does NOT check expiry and
-- does NOT auto-flip to 'expired' (no cron) — it returns the payload with status
-- 'sent' intact. "Vencida" is DERIVED in the frontend from now() > expires_at
-- (research Pitfall 2). accept via wrapper on it -> {ok:false, invalid_or_expired}.
-- ===========================================================================
SELECT (public.staff_app_get_public_offer('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000')->'offer'->>'status') AS expired_get_status; -- sent (NOT expired)
SELECT public.staff_app_accept_offer('99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000','test-ua') AS expired_accept_result; -- ok:false, invalid_or_expired
SELECT (SELECT count(*) FROM staff_app.crew WHERE gig_id='00000000-0000-0000-0000-000000009b1') AS crew_count_total, -- 1 (0 added)
       (SELECT status FROM staff_app.offers WHERE id='00000000-0000-0000-0000-000000009c2') AS expired_offer_status; -- sent (untouched)

-- ===========================================================================
-- STEP 8 — CASE: offers VIEW visible to the writer. As superuser (RLS bypassed) the
-- security_invoker view returns the seeded rows (>0). anon-REVOKE + is_org_member
-- scoping are confirmed by the orchestrator via has_table_privilege (Task 3).
-- ===========================================================================
SELECT count(*) AS offers_view_rows,                                          -- 3 (>0)
       bool_and(gig_title = 'Harness9 Gig') AS gig_title_joined               -- true
FROM public.staff_app_offers
WHERE staff_profile_id = '00000000-0000-0000-0000-000000009a1';

-- ===========================================================================
-- CLEANUP — remove all transient seed rows; staff_app.* left empty.
-- ===========================================================================
DELETE FROM staff_app.crew   WHERE gig_id = '00000000-0000-0000-0000-000000009b1';
DELETE FROM staff_app.offers WHERE id IN ('00000000-0000-0000-0000-000000009c1','00000000-0000-0000-0000-000000009c2','00000000-0000-0000-0000-000000009c3');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-000000009b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-000000009a1';

SELECT (SELECT count(*) FROM staff_app.crew   WHERE gig_id='00000000-0000-0000-0000-000000009b1')           AS crew_total,   -- 0
       (SELECT count(*) FROM staff_app.offers WHERE staff_profile_id='00000000-0000-0000-0000-000000009a1') AS offers_total, -- 0
       (SELECT count(*) FROM staff_app.gigs   WHERE id='00000000-0000-0000-0000-000000009b1')               AS gigs_total,   -- 0
       (SELECT count(*) FROM staff_app.staff_profiles WHERE id='00000000-0000-0000-0000-000000009a1')       AS profiles_total; -- 0
