-- Test harness: staff_app_0010 board view (staff_nombre/apellido) + due-reminder RPC.
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location).
-- Plan: 05-01 Task 2. Run via Supabase MCP execute_sql (superuser context) by the
-- ORCHESTRATOR, AFTER apply_migration of staff_app_0010_board_reminder.sql.
--
-- Re-runnable (STEP 0 pre-cleans by fixed ids). Proves, with RAISE EXCEPTION on any
-- failed assert:
--   (a) public.staff_app_offers exposes staff_nombre / staff_apellido (new tail
--       columns) non-null for the seeded offer.
--   (b) first public.staff_app_offers_due_reminder(2) returns EXACTLY the due offer
--       (offer_id/email/first_name/gig_title/role/expires_at) and stamps its
--       reminded_at.
--   (c) a second public.staff_app_offers_due_reminder(2) returns 0 rows for that
--       offer (exactly-once is real — the UPDATE + WHERE reminded_at IS NULL).
--   (d) an offer expiring in 30 days (out of window) and an 'accepted' offer NEVER
--       appear in either call.
-- Seeds transient rows in staff_app.*, asserts, then DELETEs everything so the
-- schema is left empty (same discipline as the 0008/0009 harnesses).
--
-- NOTE on grants: this harness runs as superuser, so RLS is bypassed and the
-- security_invoker view returns rows regardless of role. The anon-REVOKE on the
-- view and the service_role-only EXECUTE on the RPC are confirmed SEPARATELY by
-- the orchestrator via has_table_privilege / has_function_privilege — not provable
-- from this superuser harness.
--
-- NOTE on exactly-once across statements: each RPC call is a SEPARATE statement, so
-- (read-committed) the second call sees reminded_at stamped by the first and cannot
-- re-select the due offer. RPC results are captured into temp tables for asserts.
--
-- Fixed test identifiers:
--   staff_profile      00000000-0000-0000-0000-0000000010a1
--   gig                00000000-0000-0000-0000-0000000010b1
--   offer DUE (1 day)  00000000-0000-0000-0000-0000000010c1
--   offer FAR (30 day) 00000000-0000-0000-0000-0000000010c2
--   offer ACCEPTED     00000000-0000-0000-0000-0000000010c3
--   org (seeded)       aa29aa2f-4d34-4e53-b62c-7397e8a4d123

-- ===========================================================================
-- STEP 0 — pre-clean any leftover seed rows / temp tables (idempotent re-run).
-- ===========================================================================
DELETE FROM staff_app.offers WHERE id IN (
  '00000000-0000-0000-0000-0000000010c1',
  '00000000-0000-0000-0000-0000000010c2',
  '00000000-0000-0000-0000-0000000010c3');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-0000000010b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000010a1';
DROP TABLE IF EXISTS _h0010_call1;
DROP TABLE IF EXISTS _h0010_call2;

-- ===========================================================================
-- STEP 1 — SEED: one candidate + one gig + three offers in the fixed org.
--   c1 DUE     : status 'sent',     expires in 1 day  -> in window, must fire once
--   c2 FAR     : status 'sent',     expires in 30 days -> out of window, never fires
--   c3 ACCEPTED: status 'accepted', expires in 1 day  -> wrong status, never fires
-- Only sha256 hashes are stored for token_hash (NOT NULL UNIQUE); raw never persists.
-- ===========================================================================
INSERT INTO staff_app.staff_profiles (id, nombre, apellido, email, telefono, documento, organization_id, source)
VALUES ('00000000-0000-0000-0000-0000000010a1','Ana Board','Reminder','harness10@test.local',
        '+540000000010','DNI-TEST-10','aa29aa2f-4d34-4e53-b62c-7397e8a4d123','harness_test');

INSERT INTO staff_app.gigs (id, organization_id, title, venue_name, starts_at, ends_at)
VALUES ('00000000-0000-0000-0000-0000000010b1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
        'Harness10 Gig','Test Venue 10', now()+interval '5 days', now()+interval '6 days');

INSERT INTO staff_app.offers (id, organization_id, gig_id, staff_profile_id, role, amount, conditions, token_hash, status, expires_at)
VALUES
 ('00000000-0000-0000-0000-0000000010c1','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-0000000010b1','00000000-0000-0000-0000-0000000010a1',
  'Sonidista', 50000, 'Turno noche',
  encode(extensions.digest('h0010-due-token-1111111111111111111111111111','sha256'),'hex'),
  'sent', now()+interval '1 day'),
 ('00000000-0000-0000-0000-0000000010c2','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-0000000010b1','00000000-0000-0000-0000-0000000010a1',
  'Iluminador', 40000, 'Media jornada',
  encode(extensions.digest('h0010-far-token-2222222222222222222222222222','sha256'),'hex'),
  'sent', now()+interval '30 days'),
 ('00000000-0000-0000-0000-0000000010c3','aa29aa2f-4d34-4e53-b62c-7397e8a4d123',
  '00000000-0000-0000-0000-0000000010b1','00000000-0000-0000-0000-0000000010a1',
  'Stage manager', 60000, 'Jornada completa',
  encode(extensions.digest('h0010-acc-token-3333333333333333333333333333','sha256'),'hex'),
  'accepted', now()+interval '1 day');

-- ===========================================================================
-- STEP 2 — ASSERT (a): the view exposes staff_nombre/staff_apellido (new tail
-- columns), non-null, for the DUE offer, without dropping the existing columns.
-- ===========================================================================
DO $$
DECLARE r record;
BEGIN
  SELECT id, gig_title, staff_nombre, staff_apellido, status, expires_at
    INTO r
  FROM public.staff_app_offers
  WHERE id = '00000000-0000-0000-0000-0000000010c1';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSERT (a) FAIL: due offer not visible in public.staff_app_offers';
  END IF;
  IF r.staff_nombre IS DISTINCT FROM 'Ana Board' OR r.staff_apellido IS DISTINCT FROM 'Reminder' THEN
    RAISE EXCEPTION 'ASSERT (a) FAIL: staff_nombre/staff_apellido wrong or null (got %/%)', r.staff_nombre, r.staff_apellido;
  END IF;
  IF r.gig_title IS DISTINCT FROM 'Harness10 Gig' THEN
    RAISE EXCEPTION 'ASSERT (a) FAIL: existing gig_title column broke (got %)', r.gig_title;
  END IF;
  RAISE NOTICE 'ASSERT (a) OK: view exposes staff_nombre/apellido + keeps gig_title';
END $$;

-- ===========================================================================
-- STEP 3 — first due-reminder call (stamps reminded_at on the DUE offer). Capture
-- rows into a temp table for asserts (separate statement dodges MVCC artifacts).
-- ===========================================================================
CREATE TEMP TABLE _h0010_call1 AS
SELECT * FROM public.staff_app_offers_due_reminder(2);

-- ===========================================================================
-- STEP 4 — ASSERT (b): first call returned EXACTLY the DUE offer with the right
-- payload, and its reminded_at was stamped; FAR + ACCEPTED were NOT touched.
-- ===========================================================================
DO $$
DECLARE
  v_cnt      int;
  v_due_cnt  int;
  v_other    int;
  r          record;
  v_due_rem  timestamptz;
  v_far_rem  timestamptz;
  v_acc_rem  timestamptz;
BEGIN
  SELECT count(*) INTO v_cnt FROM _h0010_call1;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: first call returned % rows, expected 1', v_cnt;
  END IF;

  SELECT count(*) INTO v_due_cnt FROM _h0010_call1 WHERE offer_id = '00000000-0000-0000-0000-0000000010c1';
  IF v_due_cnt <> 1 THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: DUE offer not in first-call result';
  END IF;

  SELECT count(*) INTO v_other FROM _h0010_call1
   WHERE offer_id IN ('00000000-0000-0000-0000-0000000010c2','00000000-0000-0000-0000-0000000010c3');
  IF v_other <> 0 THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: FAR/ACCEPTED offer leaked into result (% rows)', v_other;
  END IF;

  SELECT * INTO r FROM _h0010_call1 WHERE offer_id = '00000000-0000-0000-0000-0000000010c1';
  IF r.email IS DISTINCT FROM 'harness10@test.local'
     OR r.first_name IS DISTINCT FROM 'Ana Board'
     OR r.gig_title IS DISTINCT FROM 'Harness10 Gig'
     OR r.role IS DISTINCT FROM 'Sonidista' THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: payload wrong (email=%, first_name=%, gig_title=%, role=%)',
      r.email, r.first_name, r.gig_title, r.role;
  END IF;

  -- Persisted exactly-once anchor: DUE stamped, FAR/ACCEPTED still NULL.
  SELECT reminded_at INTO v_due_rem FROM staff_app.offers WHERE id = '00000000-0000-0000-0000-0000000010c1';
  SELECT reminded_at INTO v_far_rem FROM staff_app.offers WHERE id = '00000000-0000-0000-0000-0000000010c2';
  SELECT reminded_at INTO v_acc_rem FROM staff_app.offers WHERE id = '00000000-0000-0000-0000-0000000010c3';
  IF v_due_rem IS NULL THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: DUE offer reminded_at was not stamped';
  END IF;
  IF v_far_rem IS NOT NULL OR v_acc_rem IS NOT NULL THEN
    RAISE EXCEPTION 'ASSERT (b) FAIL: FAR/ACCEPTED reminded_at should stay NULL (far=%, acc=%)', v_far_rem, v_acc_rem;
  END IF;

  RAISE NOTICE 'ASSERT (b) OK: first call fired only the DUE offer + stamped reminded_at';
END $$;

-- ===========================================================================
-- STEP 5 — second due-reminder call (must NOT re-select the already-stamped offer).
-- ===========================================================================
CREATE TEMP TABLE _h0010_call2 AS
SELECT * FROM public.staff_app_offers_due_reminder(2);

-- ===========================================================================
-- STEP 6 — ASSERT (c): exactly-once. Second call returns 0 rows for the DUE offer
-- (and 0 overall, since FAR is out of window and ACCEPTED is wrong status).
-- ===========================================================================
DO $$
DECLARE v_due int; v_all int;
BEGIN
  SELECT count(*) INTO v_due FROM _h0010_call2 WHERE offer_id = '00000000-0000-0000-0000-0000000010c1';
  IF v_due <> 0 THEN
    RAISE EXCEPTION 'ASSERT (c) FAIL: exactly-once broke — DUE offer re-selected on second call';
  END IF;
  SELECT count(*) INTO v_all FROM _h0010_call2;
  IF v_all <> 0 THEN
    RAISE EXCEPTION 'ASSERT (c) FAIL: second call returned % rows, expected 0', v_all;
  END IF;
  RAISE NOTICE 'ASSERT (c) OK: second call returned 0 rows (exactly-once holds)';
END $$;

-- ===========================================================================
-- STEP 7 — ASSERT (d): window/status boundaries. FAR (30 days) and ACCEPTED never
-- appeared in EITHER call.
-- ===========================================================================
DO $$
DECLARE v_far int; v_acc int;
BEGIN
  SELECT (SELECT count(*) FROM _h0010_call1 WHERE offer_id='00000000-0000-0000-0000-0000000010c2')
       + (SELECT count(*) FROM _h0010_call2 WHERE offer_id='00000000-0000-0000-0000-0000000010c2')
    INTO v_far;
  SELECT (SELECT count(*) FROM _h0010_call1 WHERE offer_id='00000000-0000-0000-0000-0000000010c3')
       + (SELECT count(*) FROM _h0010_call2 WHERE offer_id='00000000-0000-0000-0000-0000000010c3')
    INTO v_acc;
  IF v_far <> 0 THEN
    RAISE EXCEPTION 'ASSERT (d) FAIL: out-of-window (30-day) offer was reminded (% rows)', v_far;
  END IF;
  IF v_acc <> 0 THEN
    RAISE EXCEPTION 'ASSERT (d) FAIL: accepted offer was reminded (% rows)', v_acc;
  END IF;
  RAISE NOTICE 'ASSERT (d) OK: out-of-window + accepted offers never fired';
END $$;

-- ===========================================================================
-- CLEANUP — remove all transient seed rows + temp tables; staff_app.* left empty.
-- ===========================================================================
DROP TABLE IF EXISTS _h0010_call1;
DROP TABLE IF EXISTS _h0010_call2;
DELETE FROM staff_app.offers WHERE id IN (
  '00000000-0000-0000-0000-0000000010c1',
  '00000000-0000-0000-0000-0000000010c2',
  '00000000-0000-0000-0000-0000000010c3');
DELETE FROM staff_app.gigs   WHERE id = '00000000-0000-0000-0000-0000000010b1';
DELETE FROM staff_app.staff_profiles WHERE id = '00000000-0000-0000-0000-0000000010a1';

SELECT (SELECT count(*) FROM staff_app.offers WHERE staff_profile_id='00000000-0000-0000-0000-0000000010a1') AS offers_left, -- 0
       (SELECT count(*) FROM staff_app.gigs   WHERE id='00000000-0000-0000-0000-0000000010b1')               AS gigs_left,   -- 0
       (SELECT count(*) FROM staff_app.staff_profiles WHERE id='00000000-0000-0000-0000-0000000010a1')       AS profiles_left; -- 0
