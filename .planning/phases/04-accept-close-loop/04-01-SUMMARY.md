# 04-01 SUMMARY — Public magic-link wrappers + offers view

**Plan:** 04-01 · **Phase:** 4 (Accept & Close the Loop) · **Requirements:** ACPT-01/02/03 + STAT-01 (data door)
**Status:** COMPLETE · applied + verified live · **Completed:** 2026-07-16

## What shipped
Migration `staff_app_0009_public_magic_link`, applied LIVE to `luillpzfqzbpoqkgvjuw` (subagents lack Supabase MCP; the orchestrator applied it).

- **3 `public` anon-callable wrappers** forwarding to the Phase-1 `staff_app.*` RPCs (which are unreachable by the anon client because `staff_app` is not PostgREST-exposed, PGRST106): `public.staff_app_get_public_offer(text)`, `public.staff_app_accept_offer(text, text)` (two args), `public.staff_app_decline_offer(text)`. LANGUAGE sql, VOLATILE, SECURITY INVOKER, `SET search_path = staff_app, public, pg_temp`. WR-05: explicit `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO anon, authenticated` (these MUST be anon-callable — the candidate has no account). Underlying RPCs NOT rewritten; schema NOT exposed.
- **`public.staff_app_offers`** security_invoker view over `staff_app.offers` (joined to gigs for `gig_title`) for STAT-01, + `GRANT SELECT ON staff_app.offers TO authenticated`, + `REVOKE ALL FROM anon`. "Vencida" is derived in the frontend from `now() > expires_at` (the `expired` enum value is never written; no cron).

## Evidence (verified live via Supabase MCP)
- **Grants:** anon EXECUTE = true on all 3 wrappers; anon SELECT on the view = false; authenticated SELECT on the view = true and on `staff_app.offers` = true. All wrappers carry the pinned search_path.
- **Functional smoke (real token, created via `staff_app_create_offer`):** `staff_app_get_public_offer(token)` returns the offer jsonb; a garbage token returns SQL NULL; after the GET the offer status flipped `sent`→`viewed`. `staff_app_accept_offer(token,'ua')` returned `{ok:true, crew_id}` and created one `staff_app.crew` row; a second accept in the same run returned `{ok:false, reason:'invalid_or_expired'}` (idempotent, double-tap safe).
- **`get_advisors(security)`:** ZERO findings on all 4 new objects — no `security_definer_view` (the view is security_invoker), no `function_search_path_mutable` on the wrappers. INVOKER was sufficient (no DEFINER fallback needed).
- **Cleanup:** all transient smoke rows removed (crew/offers/gigs = 0 for the test candidate).

## Commits
- `3e6cd12` — feat(04-01): staff_app_0009 migration — 3 public anon wrappers + offers view
- `5cb9613` — test(04-01): re-runnable harness for staff_app_0009 public wrappers + offers view

## For downstream (04-02 / 04-03)
- Public route calls the ANON client: `supabase.rpc('staff_app_get_public_offer', { p_token })` (GET-safe render), `supabase.rpc('staff_app_accept_offer', { p_token, p_user_agent })` and `supabase.rpc('staff_app_decline_offer', { p_token })` (POST only). `get_public_offer` returns NULL for a bad token; accept/decline return `{ok:false, reason:'invalid_or_expired'}` on any failure → re-read `get_public_offer` and derive the state; "vencida" = `now() > expires_at`.
- STAT-01: authenticated reads `public.staff_app_offers` (RLS-scoped to org, includes `gig_title`); derive "vencida" client-side.
