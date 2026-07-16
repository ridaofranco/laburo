-- Migration: staff_app_0010_board_reminder
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- To be applied via Supabase MCP apply_migration by the ORCHESTRATOR session
-- (subagents have no Supabase MCP tools). Same live-apply pattern as 0008 / 0009.
--
-- The Wave-1 DATA DOOR for Phase 5. THREE objects, in order:
--   (1) ALTER staff_app.offers ADD reminded_at — the exactly-once anchor (XTRA-02).
--   (2) CREATE OR REPLACE VIEW public.staff_app_offers — adds staff_nombre /
--       staff_apellido AT THE END so the board (STAT-02) can show WHO each role was
--       offered to, without breaking the 0009 column list/order (Pitfall 7).
--   (3) public.staff_app_offers_due_reminder(p_within_days) — the SECURITY DEFINER
--       RPC the Vercel cron (05-05) calls with service-role to get offers nearing
--       expiry and stamp them reminded, exactly once, in the SAME statement.
--
-- DECISION A1 (D-05) — LOCKED, and it OVERRIDES the older RESEARCH Pitfall-1
-- rotation recommendation: the reminder RPC does NOT rotate the token, does NOT
-- touch token_hash, does NOT call extensions.gen_random_bytes / digest, and does
-- NOT return any token. The ORIGINAL magic link stays valid; the reminder only
-- nudges the candidate to re-open the email they already have. This keeps the RPC
-- free of any secret-generation surface and avoids invalidating live links.
--
-- We do NOT rewrite the magic-link RPCs (0003) and we do NOT expose the staff_app
-- schema (it is SHARED with HITO; PGRST106 by design). This migration only mutates
-- one public view + adds one public function + one nullable column.
--
-- SECURITY (mirrors 0007/0008/0009 established patterns):
--   * The view stays security_invoker → RLS offers_select (is_org_member) on the
--     base table scopes rows to the caller's org; the staff_profiles JOIN reads
--     as the invoking authenticated user (base SELECT granted in 0007). The new
--     PII (nombre/apellido) is therefore org-scoped + authenticated-only, NEVER
--     anon (T-5-01, T-5-05). get_public_offer (candidate-facing, first_name only)
--     is NOT touched.
--   * The RPC is SECURITY DEFINER with a pinned SET search_path = staff_app,
--     public, pg_temp (kills search-path hijack, T-5-04). The org is FORCED from
--     the fixed SOMOS DER constant, never from input (T-5-06).
--   * Exactly-once (T-5-03): the UPDATE sets reminded_at=now() and the WHERE
--     filters reminded_at IS NULL in the SAME statement/transaction, so a second
--     run cannot re-select the same rows (Pitfall 3).
--   * WR-05: the public schema auto-grants anon on new functions/views, so each
--     object carries an EXPLICIT REVOKE + scoped GRANT. The RPC returns emails/PII
--     and MUTATES reminded_at → EXECUTE for service_role ONLY; anon AND
--     authenticated revoked (T-5-02). The view stays authenticated-only; anon
--     revoked (re-applied after REPLACE).

-- ---------------------------------------------------------------------------
-- (1) offers.reminded_at — exactly-once anchor (XTRA-02). Nullable, no default.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.offers ADD COLUMN reminded_at timestamptz;

COMMENT ON COLUMN staff_app.offers.reminded_at IS
  'XTRA-02 exactly-once anchor: NULL until the pre-expiry reminder is sent, then set to now() by public.staff_app_offers_due_reminder in the same statement that selects the offer. A second cron run never re-selects a stamped row.';

-- ---------------------------------------------------------------------------
-- (2) public.staff_app_offers — REPLACE the 0009 view, appending staff_nombre /
--     staff_apellido AT THE END (Pitfall 7: only additions at the tail; existing
--     columns keep their name/type/order verbatim). Joins staff_profiles for the
--     candidate name so Franco's board shows WHO each role was offered to.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.staff_app_offers WITH (security_invoker = true) AS
  SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
         o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
         g.title AS gig_title, o.organization_id,
         sp.nombre   AS staff_nombre,
         sp.apellido AS staff_apellido
  FROM staff_app.offers o
  JOIN staff_app.gigs g ON g.id = o.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id;

-- WR-05, re-applied after REPLACE for safety: authenticated SELECT, anon fully
-- revoked. Base-table SELECTs on staff_app.offers (0009) + staff_app.staff_profiles
-- (0007) to authenticated already exist; do NOT re-create them here.
GRANT SELECT ON public.staff_app_offers TO authenticated;
REVOKE ALL ON public.staff_app_offers FROM anon;

COMMENT ON VIEW public.staff_app_offers IS
  'STAT-01/STAT-02 (D-06): security_invoker view over staff_app.offers (joined to gigs for gig_title and to staff_profiles for staff_nombre/staff_apellido) so Franco reads per-offer state AND who each role was offered to, on the board. RLS offers_select (is_org_member) on the base table scopes rows to the caller org. staff_nombre/apellido is org-scoped PII, authenticated SELECT only; anon revoked (WR-05) — NEVER exposed to candidates (get_public_offer stays first_name only). "Vencida" is DERIVED in the frontend from now() > expires_at (no expired enum write, no cron for status).';

-- ---------------------------------------------------------------------------
-- (3) public.staff_app_offers_due_reminder — the cron's due-reminder RPC.
--     Finds offers nearing expiry that are still sent/viewed and not yet
--     reminded, stamps reminded_at=now() in the SAME statement (exactly-once),
--     and returns just enough to send the nudge email. A1/D-05: NO token
--     rotation, NO token_hash write, NO gen_random_bytes, NO token returned.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_offers_due_reminder(p_within_days int DEFAULT 2)
RETURNS TABLE(offer_id uuid, email text, first_name text, gig_title text, role text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- fixed SOMOS DER org (D-05), never from input
BEGIN
  -- Single statement: the CTE UPDATE stamps reminded_at and RETURNS the rows it
  -- touched; the outer SELECT enriches with email / name / gig title. Because the
  -- UPDATE both SETs reminded_at=now() and filters reminded_at IS NULL, a second
  -- run in a later transaction cannot re-select these rows (exactly-once, T-5-03).
  -- NO token is generated, hashed, or returned (A1): the original magic link lives.
  RETURN QUERY
  WITH due AS (
    UPDATE staff_app.offers o
       SET reminded_at = now()
     WHERE o.organization_id = v_org
       AND o.status IN ('sent','viewed')
       AND o.reminded_at IS NULL
       AND o.expires_at > now()
       AND o.expires_at <= now() + make_interval(days => greatest(1, p_within_days))
    RETURNING o.id, o.gig_id, o.staff_profile_id, o.role, o.expires_at
  )
  SELECT d.id, sp.email, sp.nombre, g.title, d.role, d.expires_at
  FROM due d
  JOIN staff_app.gigs g ON g.id = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id;
END;
$$;

-- WR-05: this RPC MUTATES reminded_at and returns emails/PII → EXECUTE for
-- service_role ONLY (the cron uses the service-role client). anon AND
-- authenticated are explicitly revoked (T-5-02).
REVOKE ALL ON FUNCTION public.staff_app_offers_due_reminder(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_offers_due_reminder(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_offers_due_reminder(int) IS
  'XTRA-02 pre-expiry reminder source (D-05/A1). SECURITY DEFINER, pinned search_path. Returns offers in the fixed SOMOS DER org that are status IN (sent,viewed), reminded_at IS NULL, and expiring within p_within_days (default 2), AND stamps reminded_at=now() on them in the SAME statement → exactly-once (a second run returns none). A1: does NOT rotate the token, does NOT re-hash the stored token, does NOT generate any random secret, and returns NO token — the original magic link stays valid; this only feeds the nudge email (offer_id/email/first_name/gig_title/role/expires_at). service_role EXECUTE only (the cron); anon + authenticated revoked (WR-05) because it mutates state and returns PII.';
