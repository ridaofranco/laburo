-- Migration: staff_app_0009_public_magic_link
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- To be applied via Supabase MCP apply_migration by the ORCHESTRATOR session
-- (subagents have no Supabase MCP tools). Same live-apply pattern as 03-01 / 0008.
--
-- The Phase-4 magic-link DATA DOOR. Two things, mirroring 0008's shape exactly:
--   (A) THREE `public` anon-callable wrappers that forward to the Phase-1 RPCs
--       staff_app.get_public_offer / accept_offer / decline_offer (0003).
--   (B) public.staff_app_offers — a security_invoker view over staff_app.offers
--       for STAT-01 (Franco reads offer state), + the base-table SELECT grant it
--       needs.
--
-- WHY public (not staff_app): staff_app is NOT PostgREST-exposed (PGRST106,
-- verified Phase 1 and documented in 0003/0007/0008 headers + app/auth/callback).
-- The `GRANT EXECUTE ... TO anon` that 0003 put on the three staff_app RPCs is
-- REAL but UNREACHABLE: `supabase.rpc('accept_offer', ...)` from the anon client
-- fails with PGRST106 because the schema is not in the project's exposed-schemas
-- config. The ONLY correct anon door is a thin `public` wrapper per RPC — exactly
-- the reason Phase 3 placed public.staff_app_create_offer in public. 0003's own
-- header literally orders this ("Phase 4 must EITHER expose the schema OR add thin
-- public wrapper functions"). We take the wrapper path.
--
-- We do NOT touch `pgrst.db_schemas` / expose the staff_app schema: this project is
-- SHARED with HITO; exposing the schema would surface ALL of staff_app over REST and
-- affect HITO. This migration exposes EXACTLY 3 functions + 1 view in `public`.
--
-- We do NOT rewrite the underlying staff_app RPCs (D-01) and we add NO new
-- reason-codes: accepted/expired messaging is handled in the frontend by re-reading
-- get_public_offer after a failed accept/decline (research Pitfall 1). No HITO call:
-- gigs stay hito_event_id NULL this phase (D-04; the bridge is Phase 6).
--
-- SECURITY (mirrors 0007/0008 established patterns):
--   * The 3 wrappers are LANGUAGE sql VOLATILE SECURITY INVOKER with a pinned
--     SET search_path = staff_app, public, pg_temp. INVOKER is correct + least
--     privilege: the INNER RPCs are already SECURITY DEFINER and do ALL the token /
--     expiry / single-use / atomic-crew security; anon already holds EXECUTE on the
--     inner RPCs + USAGE on schema staff_app (both granted in 0003), so the wrapper
--     does NOT escalate privilege — it only makes the function REACHABLE. The pinned
--     search_path kills function_search_path_mutable + search-path hijack (T-4-02).
--     ORCHESTRATOR CONFIRMS with get_advisors(security): if a wrapper trips
--     function_search_path_mutable, recreate it as SECURITY DEFINER with the SAME
--     SET search_path and re-verify. Do NOT switch to DEFINER preventively (A2).
--   * VOLATILE (not STABLE) on all three: the inner get_public_offer flips
--     sent->viewed, and accept/decline mutate — never mark them STABLE.
--   * WR-05: Supabase's public-schema DEFAULT PRIVILEGES auto-grant anon on any new
--     public function/view, so each object carries an EXPLICIT per-object REVOKE +
--     scoped GRANT. UNLIKE create_offer (authenticated-only), these 3 wrappers MUST
--     be anon-callable (the candidate has no account) → GRANT EXECUTE TO anon,
--     authenticated (T-4-01). The offers VIEW is authenticated-only → REVOKE FROM
--     anon (T-4-04).
--   * The view is security_invoker → RLS offers_select (is_org_member) on the base
--     table scopes rows to the caller's org (T-4-03). GRANT SELECT ON staff_app.offers
--     TO authenticated is required by the invoker path; rows stay RLS-scoped, no
--     bypass (T-4-05).

-- ---------------------------------------------------------------------------
-- PART A — three public anon-callable wrappers forwarding to staff_app.*
-- ---------------------------------------------------------------------------

-- (A1) Read wrapper (GET-safe). Returns the inner jsonb verbatim, or SQL NULL for a
--      bad token. VOLATILE: the inner flips sent->viewed on first hit.
CREATE OR REPLACE FUNCTION public.staff_app_get_public_offer(p_token text)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.get_public_offer(p_token); $$;

-- (A2) Accept wrapper. TWO args — mirrors the inner accept_offer(p_token, p_user_agent)
--      signature exactly (research Pitfall 3). The client passes the request UA (or '').
CREATE OR REPLACE FUNCTION public.staff_app_accept_offer(p_token text, p_user_agent text)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.accept_offer(p_token, p_user_agent); $$;

-- (A3) Decline wrapper.
CREATE OR REPLACE FUNCTION public.staff_app_decline_offer(p_token text)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.decline_offer(p_token); $$;

-- WR-05 for the wrappers: strip the auto-granted PUBLIC/anon default, then grant
-- EXECUTE scoped to anon + authenticated (these SHOULD be anon-callable, unlike
-- create_offer). Exact arg signatures per object (accept carries (text, text)).
REVOKE ALL ON FUNCTION public.staff_app_get_public_offer(text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_accept_offer(text, text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_decline_offer(text)         FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.staff_app_get_public_offer(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_accept_offer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_decline_offer(text)      TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_get_public_offer(text) IS
  'Phase-4 magic-link READ door (ACPT-01). Thin SECURITY INVOKER wrapper, pinned search_path, forwarding to staff_app.get_public_offer (SECURITY DEFINER, 0003) because staff_app is not PostgREST-exposed (PGRST106). Returns the inner jsonb verbatim (offer/gig/org/applicant first_name, PII-safe) or SQL NULL for a bad token; VOLATILE because the inner flips sent->viewed. anon + authenticated EXECUTE (WR-05); the candidate has no account.';
COMMENT ON FUNCTION public.staff_app_accept_offer(text, text) IS
  'Phase-4 magic-link ACCEPT door (ACPT-02/03). Thin SECURITY INVOKER wrapper (two args, mirrors the inner signature) forwarding to staff_app.accept_offer(p_token, p_user_agent) (SECURITY DEFINER, 0003). Must be called from a POST action only, never a GET/preview (anti-bot, D-02). The inner enforces token + status IN (sent,viewed) + expires_at > now(), inserts crew idempotently (ON CONFLICT DO NOTHING), and returns {ok:true, crew_id} or {ok:false, reason:invalid_or_expired}. anon + authenticated EXECUTE (WR-05).';
COMMENT ON FUNCTION public.staff_app_decline_offer(text) IS
  'Phase-4 magic-link DECLINE door (ACPT-02). Thin SECURITY INVOKER wrapper forwarding to staff_app.decline_offer (SECURITY DEFINER, 0003). POST-only. Returns {ok:true, status:declined} or {ok:false, reason:invalid_or_expired}. anon + authenticated EXECUTE (WR-05).';

-- ---------------------------------------------------------------------------
-- PART B — public.staff_app_offers view for STAT-01 (D-06)
-- ---------------------------------------------------------------------------

-- Base-table SELECT for the security_invoker path. 0007 granted SELECT on
-- staff_profiles/members/crew/gigs but NOT offers → grant it here so the view can
-- read the base table AS the invoking authenticated user; RLS offers_select
-- (is_org_member) then scopes rows to the caller's org (T-4-05).
GRANT SELECT ON staff_app.offers TO authenticated;

-- security_invoker view: obeys the base table's RLS as the querying user. Joins gigs
-- for the human-readable gig title (context in Franco's per-candidate offer list).
-- 'expired' is NOT a column here — the enum value is never written (no cron); the
-- frontend derives "vencida" from now() > expires_at.
CREATE VIEW public.staff_app_offers WITH (security_invoker = true) AS
  SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
         o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
         g.title AS gig_title, o.organization_id
  FROM staff_app.offers o
  JOIN staff_app.gigs g ON g.id = o.gig_id;

-- WR-05 for the view: authenticated SELECT, anon fully revoked (public-schema
-- default privileges auto-grant anon → explicit REVOKE is REQUIRED; T-4-04).
GRANT SELECT ON public.staff_app_offers TO authenticated;
REVOKE ALL ON public.staff_app_offers FROM anon;

COMMENT ON VIEW public.staff_app_offers IS
  'STAT-01 (D-06): security_invoker view over staff_app.offers (joined to gigs for gig_title) so Franco reads per-offer state (enviada/vista/aceptada/rechazada) where he already looks (/staff/[id]). RLS offers_select (is_org_member) on the base table scopes rows to the caller org. "Vencida" is DERIVED in the frontend from now() > expires_at (the expired enum value is never written; no cron). authenticated SELECT only; anon revoked (WR-05).';
