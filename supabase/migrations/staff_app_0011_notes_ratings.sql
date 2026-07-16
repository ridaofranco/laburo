-- Migration: staff_app_0011_notes_ratings
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration — LIVE by the orchestrator.
--
-- The producer-only data door for XTRA-01 (favoritos + notas privadas, D-03) and
-- XTRA-04 (rating post-evento 1-5, D-06). Two new org-scoped tables in staff_app,
-- each surfaced to the AUTHENTICATED producer (Franco) through:
--   * a `public` security_invoker VIEW for reads (RLS is_org_member scopes rows), and
--   * a `public` SECURITY DEFINER upsert RPC for writes (is_org_writer gate, org FORCED).
-- All following the 0008 mould verbatim: fixed-org constant, writer gate, pinned
-- search_path, WR-05 explicit per-object REVOKE + scoped GRANT to authenticated only.
--
-- ***** PITFALL 2 — CRITICAL ISOLATION *****
--   These notes/favorites/ratings are PRODUCER-ONLY and must NEVER reach any
--   candidate-facing surface: no anon GRANT on any object here, and NONE of these
--   tables/views/RPCs may ever appear in get_public_offer / accept_offer / the /o
--   token page. The candidate sees ZERO of this. RLS + REVOKE anon is the isolation,
--   not client logic (T-5-07).
--
-- SECURITY (verified against 0007/0008 established patterns):
--   * RLS does NOT apply inside SECURITY DEFINER, so the org is FORCED from the fixed
--     SOMOS DER constant (never caller input); every candidate/gig lookup is explicitly
--     scoped to that org (T-5-09).
--   * is_org_writer(v_org) resolves the REAL caller JWT via auth.uid() even inside
--     SECURITY DEFINER (0003 pattern) — the writer gate is real (T-5-09).
--   * Pinned SET search_path = staff_app, public, pg_temp kills search-path hijack
--     (T-5-11); staff_app.is_org_writer / candidate_notes / staff_ratings resolve via it.
--   * WR-05: ALTER DEFAULT PRIVILEGES is a no-op on this managed project + the public
--     schema auto-grants anon on new functions/views, so every new RPC + view carries
--     EXPLICIT per-object REVOKE FROM PUBLIC, anon + scoped GRANT TO authenticated
--     (T-5-08).
--   * Base-table SELECT to authenticated is required for the security_invoker views
--     (Pitfall 5); RLS is_org_member still scopes rows to the caller's org.
--   * score is validated at the table (CHECK 1..5) AND re-validated in the RPC (T-5-10).
--
-- LEGACY NOTE (research §204): do NOT reuse staff_profiles.rating / notas_internas —
-- a scalar rating can't hold per-gig scores and notas_internas is exposed nowhere.
-- These new org-scoped tables are the correct home. Legacy columns stay untouched.

-- ===========================================================================
-- BLOQUE A — candidate_notes (XTRA-01: favoritos + notas privadas, D-03)
-- ===========================================================================

CREATE TABLE staff_app.candidate_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id)  ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
  is_favorite      boolean NOT NULL DEFAULT false,
  note             text,
  updated_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, staff_profile_id)   -- one note row per candidate per org (upsert anchor)
);

ALTER TABLE staff_app.candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_notes_select ON staff_app.candidate_notes
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY candidate_notes_write ON staff_app.candidate_notes
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

-- Table grants: deny both roles, then hand authenticated the base SELECT the
-- security_invoker view needs (Pitfall 5). RLS still scopes rows; anon gets NOTHING.
REVOKE ALL ON staff_app.candidate_notes FROM anon, authenticated;
GRANT SELECT ON staff_app.candidate_notes TO authenticated;

-- Read surface: security_invoker view. RLS is_org_member on the base table scopes
-- rows to the caller's org. authenticated SELECT only; anon fully revoked (WR-05).
CREATE VIEW public.staff_app_candidate_notes WITH (security_invoker = true) AS
  SELECT id, staff_profile_id, is_favorite, note, updated_at, organization_id
  FROM staff_app.candidate_notes;
GRANT SELECT ON public.staff_app_candidate_notes TO authenticated;
REVOKE ALL ON public.staff_app_candidate_notes FROM anon;

COMMENT ON VIEW public.staff_app_candidate_notes IS
  'PRODUCER-ONLY security_invoker view over staff_app.candidate_notes (XTRA-01 favoritos + notas privadas). RLS is_org_member scopes rows to the caller org. authenticated SELECT only; anon revoked (WR-05). NEVER candidate-facing (Pitfall 2).';

-- Write surface: SECURITY DEFINER upsert. org FORCED from the fixed constant, writer
-- gated, candidate validated in-org. ON CONFLICT (org, candidate) keeps exactly one row.
CREATE OR REPLACE FUNCTION public.staff_app_set_candidate_note(
  p_staff_profile_id uuid,
  p_is_favorite      boolean,
  p_note             text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- fixed SOMOS DER org (D-05)
BEGIN
  -- 1. Writer gate. auth.uid() is preserved inside SECURITY DEFINER (T-5-09);
  --    anon can never reach here (WR-05 grants below).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- 2. Validate the candidate belongs to the org (RLS does not apply here; T-5-09).
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 3. Upsert the single (org, candidate) note row.
  INSERT INTO candidate_notes (organization_id, staff_profile_id, is_favorite, note, updated_by, updated_at)
  VALUES (v_org, p_staff_profile_id, coalesce(p_is_favorite, false), nullif(btrim(p_note), ''), auth.uid(), now())
  ON CONFLICT (organization_id, staff_profile_id) DO UPDATE
    SET is_favorite = excluded.is_favorite,
        note        = excluded.note,
        updated_by  = excluded.updated_by,
        updated_at  = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- WR-05: explicit per-function REVOKE + scoped GRANT. authenticated only; never anon.
REVOKE ALL ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text) IS
  'PRODUCER-ONLY favorite/note upsert (XTRA-01). SECURITY DEFINER, pinned search_path. Gates on staff_app.is_org_writer for the fixed org aa29aa2f-4d34-4e53-b62c-7397e8a4d123; validates the candidate belongs to the org; upserts the single (org, candidate) row via ON CONFLICT DO UPDATE. authenticated-only EXECUTE; never anon (WR-05). NEVER candidate-facing (Pitfall 2).';

-- ===========================================================================
-- BLOQUE B — staff_ratings (XTRA-04: rating post-evento 1-5, D-06)
-- ===========================================================================

CREATE TABLE staff_app.staff_ratings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id)  ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
  gig_id           uuid NOT NULL REFERENCES staff_app.gigs(id)           ON DELETE CASCADE,
  score            int NOT NULL CHECK (score BETWEEN 1 AND 5),
  note             text,
  rated_by         uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, staff_profile_id, gig_id)   -- one rating per candidate per gig per org
);

ALTER TABLE staff_app.staff_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_ratings_select ON staff_app.staff_ratings
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY staff_ratings_write ON staff_app.staff_ratings
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

REVOKE ALL ON staff_app.staff_ratings FROM anon, authenticated;
GRANT SELECT ON staff_app.staff_ratings TO authenticated;

CREATE VIEW public.staff_app_staff_ratings WITH (security_invoker = true) AS
  SELECT id, staff_profile_id, gig_id, score, note, created_at, organization_id
  FROM staff_app.staff_ratings;
GRANT SELECT ON public.staff_app_staff_ratings TO authenticated;
REVOKE ALL ON public.staff_app_staff_ratings FROM anon;

COMMENT ON VIEW public.staff_app_staff_ratings IS
  'PRODUCER-ONLY security_invoker view over staff_app.staff_ratings (XTRA-04 rating post-evento). RLS is_org_member scopes rows to the caller org. authenticated SELECT only; anon revoked (WR-05). NEVER candidate-facing (Pitfall 2).';

CREATE OR REPLACE FUNCTION public.staff_app_rate_staff(
  p_staff_profile_id uuid,
  p_gig_id           uuid,
  p_score            int,
  p_note             text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- fixed SOMOS DER org (D-05)
BEGIN
  -- 1. Writer gate (T-5-09).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- 2. Validate score in range BEFORE touching the table (defense-in-depth vs the
  --    CHECK constraint; returns a clean reason instead of a raised exception; T-5-10).
  IF p_score IS NULL OR p_score < 1 OR p_score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'score_out_of_range');
  END IF;

  -- 3. Validate the candidate belongs to the org (T-5-09).
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 4. Validate the gig belongs to the org (T-5-09).
  PERFORM 1 FROM gigs WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;

  -- 5. Upsert the single (org, candidate, gig) rating row.
  INSERT INTO staff_ratings (organization_id, staff_profile_id, gig_id, score, note, rated_by, created_at)
  VALUES (v_org, p_staff_profile_id, p_gig_id, p_score, nullif(btrim(p_note), ''), auth.uid(), now())
  ON CONFLICT (organization_id, staff_profile_id, gig_id) DO UPDATE
    SET score    = excluded.score,
        note     = excluded.note,
        rated_by = excluded.rated_by;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- WR-05: authenticated only; never anon.
REVOKE ALL ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text) IS
  'PRODUCER-ONLY post-event rating upsert (XTRA-04). SECURITY DEFINER, pinned search_path. Gates on staff_app.is_org_writer for the fixed org aa29aa2f-4d34-4e53-b62c-7397e8a4d123; re-validates score 1..5; validates the candidate and gig belong to the org; upserts the single (org, candidate, gig) row via ON CONFLICT DO UPDATE. authenticated-only EXECUTE; never anon (WR-05). NEVER candidate-facing (Pitfall 2).';
