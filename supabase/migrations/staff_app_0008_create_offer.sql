-- Migration: staff_app_0008_create_offer
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration.
--
-- The offer WRITE path (Phase 3, OFER-01 data side). Two objects:
--   (1) public.staff_app_create_offer(...) — a SECURITY DEFINER RPC, callable by
--       `authenticated` only, that gates on staff_app.is_org_writer(v_org),
--       atomically quick-creates a gig when no gig_id is supplied, generates a
--       256-bit token, stores ONLY its sha256 hash (byte-for-byte matching the
--       Phase-1 get_public_offer/accept_offer contract in 0003), and returns the
--       raw token exactly once. Mirrors public.staff_app_register_applicant (0004)
--       and public.staff_app_provision_member (0007).
--   (2) public.staff_app_gigs — a security_invoker view listing org-scoped gigs for
--       the "pick an existing gig" step. Same pattern as the 0007 read-layer views.
--
-- WHY public (not staff_app): staff_app is NOT PostgREST-exposed (PGRST106,
-- verified Phase 1); the authenticated client cannot INSERT into staff_app.offers
-- (0002 did REVOKE ALL FROM authenticated). The only correct write door is a
-- `public` SECURITY DEFINER RPC. The service-role is NOT used anywhere here.
--
-- SECURITY (verified against the repo's established patterns):
--   * RLS does NOT apply inside SECURITY DEFINER, so the org is FORCED from the
--     fixed SOMOS DER constant (never from caller input) and every gig/candidate
--     lookup is explicitly scoped to that org (T-3-02).
--   * is_org_writer(v_org) resolves the REAL caller JWT via auth.uid() even inside
--     SECURITY DEFINER (verified 0003 pattern) — the writer gate is real (T-3-05).
--   * The raw token appears ONLY in the returned jsonb; only token_hash (sha256)
--     ever persists — never a column, never a log (T-3-03).
--   * extensions.gen_random_bytes / extensions.digest are schema-qualified,
--     identical algorithm/entropy to 0003, so the created hash matches what
--     get_public_offer/accept_offer verify (Phase-4 magic link).
--   * Pinned SET search_path = staff_app, public, pg_temp kills search-path hijack
--     (T-3-SC); staff_app.is_org_writer / offers / gigs resolve via it.
--   * WR-05: ALTER DEFAULT PRIVILEGES is a no-op on this managed project, so the
--     new RPC + view carry EXPLICIT per-object REVOKE FROM PUBLIC, anon + scoped
--     GRANT TO authenticated (T-3-01, T-3-04).
--   * gigs.hito_event_id stays NULL this phase (D-04; the HITO link is Phase 6).

-- ---------------------------------------------------------------------------
-- (1) staff_app_create_offer — the SECURITY DEFINER offer creator.
--     Quick-creates a gig when p_gig_id IS NULL; otherwise validates the passed
--     gig belongs to the org. Validates the candidate belongs to the org. Inserts
--     the offer with status defaulting to 'sent' and a future expires_at. Returns
--     { ok, offer_id, gig_id, token } — token = the raw 256-bit hex, once.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_create_offer(
  p_staff_profile_id uuid,
  p_role             text,
  p_gig_id           uuid        DEFAULT NULL,   -- pick: existing gig
  -- quick-create fields (used ONLY when p_gig_id IS NULL):
  p_gig_title        text        DEFAULT NULL,
  p_gig_starts_at    timestamptz DEFAULT NULL,
  p_gig_ends_at      timestamptz DEFAULT NULL,
  p_gig_venue        text        DEFAULT NULL,
  p_amount           numeric     DEFAULT NULL,
  p_conditions       text        DEFAULT NULL,
  p_expires_in_days  int         DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org      uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';       -- fixed SOMOS DER org (D-05)
  v_gig      uuid := p_gig_id;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');       -- 256-bit, 64 hex
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');    -- sha256 hex, matches 0003
  v_offer_id uuid;
BEGIN
  -- 1. Writer gate. auth.uid() is preserved inside SECURITY DEFINER, so this is
  --    the REAL caller (T-3-05). anon can never reach here (WR-05 grants below).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(btrim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  -- 2. Quick-create the gig atomically if no existing gig was picked. Same
  --    transaction as the offer insert → no orphan gig, no race (Pitfall 5).
  IF v_gig IS NULL THEN
    IF coalesce(btrim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, btrim(p_gig_title), p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    -- Validate the picked gig belongs to the org (RLS does not apply here; T-3-02).
    PERFORM 1 FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
  END IF;

  -- 3. Validate the candidate belongs to the org (T-3-02).
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 4. Insert the offer. status relies on the table DEFAULT 'sent'; expires_at is
  --    forced to a future timestamp (>= 1 day). Only token_hash persists (T-3-03).
  INSERT INTO offers (organization_id, gig_id, staff_profile_id, role, amount, conditions,
                      token_hash, expires_at)
  VALUES (v_org, v_gig, p_staff_profile_id, btrim(p_role), p_amount, p_conditions,
          v_hash, now() + make_interval(days => greatest(1, p_expires_in_days)))
  RETURNING id INTO v_offer_id;

  -- 5. Return the raw token ONCE (never persisted, never logged).
  RETURN jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'gig_id', v_gig, 'token', v_raw);
END;
$$;

-- WR-05: explicit per-function REVOKE + scoped GRANT (ALTER DEFAULT PRIVILEGES is a
-- verified no-op on this managed Supabase; the public schema auto-grants anon on new
-- functions). anon NEVER; authenticated only (T-3-01).
REVOKE ALL ON FUNCTION public.staff_app_create_offer(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_create_offer(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,text,int) TO authenticated;

COMMENT ON FUNCTION public.staff_app_create_offer(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,text,int) IS
  'Offer WRITE path (OFER-01). SECURITY DEFINER, pinned search_path. Gates on staff_app.is_org_writer for the fixed org aa29aa2f-4d34-4e53-b62c-7397e8a4d123; quick-creates a gig (hito_event_id NULL, status draft) when p_gig_id is NULL, else validates the gig belongs to the org; validates the candidate belongs to the org; generates a 256-bit token, stores only its sha256 hash (matching 0003 get_public_offer/accept_offer), and returns the raw token ONCE under key token. authenticated-only EXECUTE; never anon (WR-05).';

-- ---------------------------------------------------------------------------
-- (2) staff_app_gigs — security_invoker view to list existing gigs for the pick
--     step. RLS (is_org_member) on the base table scopes rows to the caller's org.
--     Same pattern as the 0007 read-layer views. authenticated holds base SELECT
--     on staff_app.gigs (granted in 0007).
-- ---------------------------------------------------------------------------
CREATE VIEW public.staff_app_gigs WITH (security_invoker = true) AS
  SELECT id, title, starts_at, ends_at, venue_name, status, hito_event_id, organization_id
  FROM staff_app.gigs;

-- WR-05 for the view: authenticated SELECT, anon fully revoked (public-schema
-- default privileges auto-grant anon → explicit REVOKE required; T-3-04).
GRANT SELECT ON public.staff_app_gigs TO authenticated;
REVOKE ALL ON public.staff_app_gigs FROM anon;

COMMENT ON VIEW public.staff_app_gigs IS
  'security_invoker view over staff_app.gigs for the offer "pick an existing gig" step. RLS is_org_member on the base table scopes rows to the caller org. authenticated SELECT only; anon revoked (WR-05).';
