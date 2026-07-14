-- Migration: staff_app_0003_magic_link_rpcs
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project - D-03 co-location).
-- Applied via Supabase MCP apply_migration on 2026-07-14.
--
-- The three magic-link RPCs - the ONLY door anon has to offers/crew data.
-- Cloned from HITO's proven 00008_proposal_acceptance.sql shape, hardened to
-- close HITO's two documented gaps:
--   (1) 256-bit tokens hashed at rest (HITO stores a 96-bit RAW token) - the RPC
--       hashes the incoming raw token with sha256 and matches on token_hash; the
--       raw token is never persisted.
--   (2) expires_at enforced INSIDE the state-changing RPCs (HITO omits the check).
--
-- All objects live under staff_app. ZERO writes to HITO public.*.
-- Every function is SECURITY DEFINER with a pinned SET search_path = staff_app,
-- pg_temp (kills function_search_path_mutable + search-path injection); every
-- EXTENSIONS object is schema-qualified (extensions.digest); staff_app tables
-- resolve via the pinned search_path.
--
-- PHASE-4 REST-EXPOSURE NOTE (decision recorded, NOT implemented here): because
-- these RPCs live in staff_app (not public), the anon web client cannot reach
-- them via PostgREST yet. Phase 4 must EITHER add staff_app to the project's
-- exposed-schemas config OR add thin public wrapper functions that call
-- staff_app.get_public_offer/accept_offer/decline_offer. Do NOT build wrappers
-- now. (Contrast 01-03's intake function, deliberately placed in public.)

-- ---------------------------------------------------------------------------
-- 1. get_public_offer - GET-safe read. Returns ONLY safe display fields
--    (offer + gig + org + applicant FIRST name). NEVER cv_url/email/telefono/
--    documento or any other applicant. VOLATILE so it can flip sent->viewed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.get_public_offer(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_rec  record;
BEGIN
  SELECT o.id, o.role, o.amount, o.conditions, o.status, o.expires_at,
         g.title AS gig_title, g.starts_at, g.ends_at, g.venue_name,
         org.name AS org_name,
         split_part(sp.nombre, ' ', 1) AS first_name
    INTO v_rec
    FROM offers o
    JOIN gigs g            ON g.id   = o.gig_id
    JOIN organizations org ON org.id = o.organization_id
    JOIN staff_profiles sp ON sp.id  = o.staff_profile_id
   WHERE o.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN NULL;                       -- non-matching token: no row leak
  END IF;

  IF v_rec.status = 'sent' THEN        -- first view flips sent -> viewed
    UPDATE offers SET status = 'viewed', viewed_at = now() WHERE id = v_rec.id;
    v_rec.status := 'viewed';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'offer', jsonb_build_object(
       'role',       v_rec.role,
       'amount',     v_rec.amount,
       'conditions', v_rec.conditions,
       'status',     v_rec.status,
       'expires_at', v_rec.expires_at),
    'gig', jsonb_build_object(
       'title',     v_rec.gig_title,
       'starts_at', v_rec.starts_at,
       'ends_at',   v_rec.ends_at,
       'venue',     v_rec.venue_name),
    'org',       jsonb_build_object('name', v_rec.org_name),
    'applicant', jsonb_build_object('first_name', v_rec.first_name)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. accept_offer - POST-invoked state change. Single transaction = atomic.
--    Guard: token match AND status IN ('sent','viewed') AND expires_at > now().
--    On success: idempotent crew INSERT (ON CONFLICT DO NOTHING) + offer accepted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.accept_offer(p_token text, p_user_agent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_o    offers%ROWTYPE;
  v_crew uuid;
BEGIN
  SELECT * INTO v_o
    FROM offers
   WHERE token_hash = v_hash
     AND status IN ('sent','viewed')
     AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  INSERT INTO crew (organization_id, gig_id, staff_profile_id, role)
  VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  ON CONFLICT (gig_id, staff_profile_id) DO NOTHING
  RETURNING id INTO v_crew;

  IF v_crew IS NULL THEN               -- prior crew row (idempotent path)
    SELECT id INTO v_crew FROM crew
     WHERE gig_id = v_o.gig_id AND staff_profile_id = v_o.staff_profile_id;
  END IF;

  UPDATE offers SET status = 'accepted', responded_at = now() WHERE id = v_o.id;

  RETURN jsonb_build_object('ok', true, 'crew_id', v_crew);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. decline_offer - POST-invoked state change. Same token+status+expiry guard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.decline_offer(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_o    offers%ROWTYPE;
BEGIN
  SELECT * INTO v_o
    FROM offers
   WHERE token_hash = v_hash
     AND status IN ('sent','viewed')
     AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  UPDATE offers SET status = 'declined', responded_at = now() WHERE id = v_o.id;

  RETURN jsonb_build_object('ok', true, 'status', 'declined');
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: least privilege. Strip default PUBLIC EXECUTE, expose ONLY the three
-- RPCs to anon+authenticated. anon needs schema USAGE (0001 revoked it) for the
-- EXECUTE grant to be reachable.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION staff_app.get_public_offer(text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_app.accept_offer(text, text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_app.decline_offer(text)         FROM PUBLIC;

GRANT USAGE ON SCHEMA staff_app TO anon, authenticated;

GRANT EXECUTE ON FUNCTION staff_app.get_public_offer(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_app.accept_offer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_app.decline_offer(text)      TO anon, authenticated;

-- Keep the org helpers NON-anon-callable now that anon holds schema USAGE:
-- drop their default PUBLIC EXECUTE, grant only to authenticated (RLS needs it).
-- This preserves "no other anon-callable function exists in staff_app".
REVOKE ALL ON FUNCTION staff_app.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_app.is_org_writer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION staff_app.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_app.is_org_writer(uuid) TO authenticated;

-- Contract documentation.
COMMENT ON FUNCTION staff_app.get_public_offer(text) IS
  'GET-safe magic-link read. Returns applicant FIRST name + offer/gig/org only - never cv_url/email/telefono/documento or other applicants. Flips sent->viewed on first hit.';
COMMENT ON FUNCTION staff_app.accept_offer(text, text) IS
  'POST-invoked ONLY: state-changing magic-link RPC. Phase-4 UI must call this from a human POST action, never on a GET/preview fetch (pitfall #7). Enforces token + status IN (sent,viewed) + expires_at > now(); idempotent via crew UNIQUE(gig_id,staff_profile_id) ON CONFLICT DO NOTHING. PHASE-4 REST: staff_app is not PostgREST-exposed; expose the schema OR add public wrappers (no wrappers built now).';
COMMENT ON FUNCTION staff_app.decline_offer(text) IS
  'POST-invoked ONLY: state-changing magic-link RPC (see accept_offer). Never call on GET/preview.';
COMMENT ON SCHEMA staff_app IS
  'Staff App logical schema inside HITO project (D-03). PHASE-4 REST NOTE: the three magic-link RPCs (get_public_offer/accept_offer/decline_offer) live here, not in public. To let the anon web client call them via PostgREST, Phase 4 must EITHER add staff_app to the exposed-schemas config OR add thin public wrapper functions. Do NOT build wrappers before Phase 4.';
