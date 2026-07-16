-- Test harness: staff_app_0011 — candidate_notes + staff_ratings (producer-only).
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location).
-- Plan: 05-02 Task 2. Run via Supabase MCP execute_sql (superuser context) by the
-- orchestrator, AFTER apply_migration of staff_app_0011.
--
-- Proves in SQL BEFORE any UI (plan 05-04 consumes these tables/RPCs):
--   (a) set_candidate_note upsert is idempotent — 2 calls for (org, candidate) leave
--       exactly ONE row and the second call UPDATEs is_favorite/note.
--   (b) the public.staff_app_candidate_notes view returns that row (updated values).
--   (c) rate_staff upsert is idempotent — 2 calls for (org, candidate, gig) leave ONE
--       row (score UPDATEd); a score=6 returns ok:false reason score_out_of_range and
--       inserts NOTHING.
--   (d) ISOLATION (Pitfall 2): anon has NO EXECUTE on either RPC and NO SELECT on
--       either view (has_function_privilege / has_table_privilege).
-- Each assert RAISEs EXCEPTION on failure. Full cleanup at the end leaves staff_app.*
-- as it was (same discipline as the 0008 harness).
--
-- IDENTITY NOTE: is_org_writer reads auth.uid(). Under raw execute_sql there is no JWT,
-- so we SIMULATE the caller by setting request.jwt.claims at SESSION level
-- (is_local=false) so auth.uid() resolves across statements. The seeded owner
-- 73fc15e0-69a6-4fc2-a832-696bd6f0f95c (org member, role 'owner' -> is_org_writer true,
-- from 0007) is our writer. Claims are reset to '' at cleanup.
--
-- Fixed test identifiers:
--   staff_profile (in-org)   00000000-0000-0000-0000-0000000011a1
--   gig (in-org)             00000000-0000-0000-0000-0000000011b1
--   writer user_id           73fc15e0-69a6-4fc2-a832-696bd6f0f95c (seeded owner)
--   org (seeded)             aa29aa2f-4d34-4e53-b62c-7397e8a4d123
--   gig title marker         'HARNESS 0011 Gig'

DO $harness$
DECLARE
  v_org  uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_cand uuid := '00000000-0000-0000-0000-0000000011a1';
  v_gig  uuid := '00000000-0000-0000-0000-0000000011b1';
  r      jsonb;
  n      int;
  b      boolean;
  t      text;
BEGIN
  -- =========================================================================
  -- STEP 0 — pre-clean any leftover seed rows (idempotent re-run).
  -- =========================================================================
  DELETE FROM staff_app.staff_ratings   WHERE staff_profile_id = v_cand;
  DELETE FROM staff_app.candidate_notes WHERE staff_profile_id = v_cand;
  DELETE FROM staff_app.gigs            WHERE id = v_gig;
  DELETE FROM staff_app.staff_profiles  WHERE id = v_cand;

  -- =========================================================================
  -- STEP 1 — become the seeded org writer; seed one in-org candidate + gig.
  -- =========================================================================
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"73fc15e0-69a6-4fc2-a832-696bd6f0f95c","role":"authenticated"}',
                     false);
  IF NOT staff_app.is_org_writer(v_org) THEN
    RAISE EXCEPTION 'SETUP FAIL: seeded caller is not is_org_writer';
  END IF;

  INSERT INTO staff_app.staff_profiles (id, nombre, apellido, email, telefono, documento, organization_id, source)
  VALUES (v_cand, 'Noe Test', 'Rojas', 'harness0011@test.local', '+540000000011', 'DNI-0011', v_org, 'harness_test');

  INSERT INTO staff_app.gigs (id, organization_id, title, status)
  VALUES (v_gig, v_org, 'HARNESS 0011 Gig', 'draft');

  -- =========================================================================
  -- STEP 2 — (a) set_candidate_note: create then upsert (idempotent, UPDATE).
  -- =========================================================================
  r := public.staff_app_set_candidate_note(v_cand, true, '  nota privada  ');
  IF (r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'A1 FAIL: first set_candidate_note not ok: %', r;
  END IF;

  SELECT count(*) INTO n FROM staff_app.candidate_notes WHERE organization_id = v_org AND staff_profile_id = v_cand;
  IF n <> 1 THEN RAISE EXCEPTION 'A2 FAIL: expected 1 note row after first call, got %', n; END IF;

  -- second call: different favorite/note. Must UPDATE, NOT insert a new row.
  r := public.staff_app_set_candidate_note(v_cand, false, 'otra nota');
  IF (r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'A3 FAIL: second set_candidate_note not ok: %', r;
  END IF;
  SELECT count(*) INTO n FROM staff_app.candidate_notes WHERE organization_id = v_org AND staff_profile_id = v_cand;
  IF n <> 1 THEN RAISE EXCEPTION 'A4 FAIL: upsert created a new row, count=%', n; END IF;

  SELECT is_favorite, note INTO b, t FROM staff_app.candidate_notes
    WHERE organization_id = v_org AND staff_profile_id = v_cand;
  IF b IS NOT FALSE OR t <> 'otra nota' THEN
    RAISE EXCEPTION 'A5 FAIL: upsert did not update values (is_favorite=%, note=%)', b, t;
  END IF;

  -- =========================================================================
  -- STEP 3 — (b) the public view returns the updated row.
  -- =========================================================================
  SELECT is_favorite, note INTO b, t FROM public.staff_app_candidate_notes
    WHERE staff_profile_id = v_cand;
  IF b IS NOT FALSE OR t <> 'otra nota' THEN
    RAISE EXCEPTION 'B1 FAIL: view row mismatch (is_favorite=%, note=%)', b, t;
  END IF;

  -- =========================================================================
  -- STEP 4 — (c) rate_staff: create, upsert (UPDATE score), reject out-of-range.
  -- =========================================================================
  r := public.staff_app_rate_staff(v_cand, v_gig, 4, 'cumplidor');
  IF (r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'C1 FAIL: first rate_staff not ok: %', r;
  END IF;
  SELECT count(*) INTO n FROM staff_app.staff_ratings
    WHERE organization_id = v_org AND staff_profile_id = v_cand AND gig_id = v_gig;
  IF n <> 1 THEN RAISE EXCEPTION 'C2 FAIL: expected 1 rating row, got %', n; END IF;

  -- re-rate with score 5: UPDATE, still 1 row.
  r := public.staff_app_rate_staff(v_cand, v_gig, 5, 'excelente');
  IF (r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'C3 FAIL: second rate_staff not ok: %', r;
  END IF;
  SELECT count(*) INTO n FROM staff_app.staff_ratings
    WHERE organization_id = v_org AND staff_profile_id = v_cand AND gig_id = v_gig;
  IF n <> 1 THEN RAISE EXCEPTION 'C4 FAIL: rating upsert created a new row, count=%', n; END IF;
  SELECT score INTO n FROM staff_app.staff_ratings
    WHERE organization_id = v_org AND staff_profile_id = v_cand AND gig_id = v_gig;
  IF n <> 5 THEN RAISE EXCEPTION 'C5 FAIL: rating score not updated to 5, got %', n; END IF;

  -- score=6: rejected, ok:false, reason score_out_of_range, NO change to the row.
  r := public.staff_app_rate_staff(v_cand, v_gig, 6, 'fuera de rango');
  IF (r->>'ok')::boolean IS NOT FALSE OR (r->>'reason') <> 'score_out_of_range' THEN
    RAISE EXCEPTION 'C6 FAIL: score=6 not rejected as score_out_of_range: %', r;
  END IF;
  SELECT count(*) INTO n FROM staff_app.staff_ratings
    WHERE organization_id = v_org AND staff_profile_id = v_cand AND gig_id = v_gig;
  IF n <> 1 THEN RAISE EXCEPTION 'C7 FAIL: out-of-range call altered row count, count=%', n; END IF;
  SELECT score INTO n FROM staff_app.staff_ratings
    WHERE organization_id = v_org AND staff_profile_id = v_cand AND gig_id = v_gig;
  IF n <> 5 THEN RAISE EXCEPTION 'C8 FAIL: out-of-range call changed the stored score, got %', n; END IF;

  -- =========================================================================
  -- STEP 5 — (d) ISOLATION: anon has NO access to any new object (Pitfall 2).
  -- =========================================================================
  IF has_function_privilege('anon', 'public.staff_app_set_candidate_note(uuid,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'D1 FAIL: anon has EXECUTE on staff_app_set_candidate_note';
  END IF;
  IF has_function_privilege('anon', 'public.staff_app_rate_staff(uuid,uuid,int,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'D2 FAIL: anon has EXECUTE on staff_app_rate_staff';
  END IF;
  IF has_table_privilege('anon', 'public.staff_app_candidate_notes', 'SELECT') THEN
    RAISE EXCEPTION 'D3 FAIL: anon has SELECT on staff_app_candidate_notes view';
  END IF;
  IF has_table_privilege('anon', 'public.staff_app_staff_ratings', 'SELECT') THEN
    RAISE EXCEPTION 'D4 FAIL: anon has SELECT on staff_app_staff_ratings view';
  END IF;
  -- positive: authenticated CAN SELECT the views (read surface exists for the producer).
  IF NOT has_table_privilege('authenticated', 'public.staff_app_candidate_notes', 'SELECT') THEN
    RAISE EXCEPTION 'D5 FAIL: authenticated lacks SELECT on staff_app_candidate_notes view';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.staff_app_staff_ratings', 'SELECT') THEN
    RAISE EXCEPTION 'D6 FAIL: authenticated lacks SELECT on staff_app_staff_ratings view';
  END IF;

  -- =========================================================================
  -- CLEANUP — remove all transient rows; reset the simulated JWT.
  -- =========================================================================
  DELETE FROM staff_app.staff_ratings   WHERE staff_profile_id = v_cand;
  DELETE FROM staff_app.candidate_notes WHERE staff_profile_id = v_cand;
  DELETE FROM staff_app.gigs            WHERE id = v_gig;
  DELETE FROM staff_app.staff_profiles  WHERE id = v_cand;
  PERFORM set_config('request.jwt.claims', '', false);

  RAISE NOTICE 'HARNESS 0011 PASSED: notes + ratings upsert idempotent, score CHECK, anon isolation OK.';
END;
$harness$;
