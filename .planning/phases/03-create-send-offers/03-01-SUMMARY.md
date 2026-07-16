# 03-01 SUMMARY — Offer WRITE path (RPC + gigs view)

**Plan:** 03-01 · **Phase:** 3 (Create & Send Offers) · **Requirement:** OFER-01 (data side)
**Status:** COMPLETE · **Completed:** 2026-07-16

## What shipped

Migration `staff_app_0008_create_offer` — the offer WRITE path, applied to the LIVE project `luillpzfqzbpoqkgvjuw` (D-03 co-location with HITO).

Two objects, both in `public` (staff_app is not PostgREST-exposed; `offers` has `REVOKE ALL FROM authenticated`, so the only correct write door is a `public` SECURITY DEFINER RPC):

1. **`public.staff_app_create_offer(p_staff_profile_id, p_role, p_gig_id, p_gig_title, p_gig_starts_at, p_gig_ends_at, p_gig_venue, p_amount, p_conditions, p_expires_in_days)`** — SECURITY DEFINER, `SET search_path = staff_app, public, pg_temp`. Gates on `staff_app.is_org_writer` for the fixed org `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`; quick-creates a gig atomically when `p_gig_id` is NULL (`hito_event_id` NULL, status `draft`), else validates the gig belongs to the org; validates the candidate belongs to the org; generates a 256-bit token via `extensions.gen_random_bytes(32)`, stores ONLY its sha256 hash (byte-for-byte matching the Phase-1 `get_public_offer`/`accept_offer` contract in 0003), and **returns the raw token exactly once**. Return shape: `{ ok: true, offer_id, gig_id, token }` on success, `{ ok: false, reason }` otherwise (reasons: `forbidden`, `role_required`, `gig_required`, `gig_not_found`, `candidate_not_found`).
2. **`public.staff_app_gigs`** — `security_invoker` view over `staff_app.gigs` for the "pick an existing gig" step. RLS `is_org_member` on the base table scopes rows to the caller org.

WR-05 honored: explicit per-object `REVOKE ... FROM PUBLIC, anon` + scoped `GRANT ... TO authenticated`.

## Evidence (verified live via Supabase MCP by the orchestrator session)

The subagent executor could not apply the migration (MCP tools are stripped from restricted-tool subagents); the orchestrator session applied it and captured proof.

- **Migration applied:** `apply_migration` returned success.
- **Harness (writer path):** create as the seeded org writer → `ok=true`, raw token length `64` hex (256-bit), gig quick-created (`gig_id` returned).
- **Persisted offer:** `status=sent`, `token_hash` length `64`, `role='Sonidista'` (trimmed from `'  Sonidista  '`), `expires_at` in the future; the quick-gig has `hito_event_id` NULL and `status='draft'`.
- **Bad gig id (writer):** `{ ok:false, reason:'gig_not_found' }`.
- **Non-writer identity:** `{ ok:false, reason:'forbidden' }`, and NO extra rows created (gig count stayed 1).
- **Grants / hardening:** `has_function_privilege('anon', …create_offer…,'EXECUTE')=false`, `authenticated=true`; `has_table_privilege('anon','public.staff_app_gigs','SELECT')=false`, `authenticated=true`; `prosecdef=true`; `proconfig=search_path=staff_app, public, pg_temp`.
- **`get_advisors(security)`:** no new finding class vs the Phase-1 baseline. `staff_app_create_offer` appears once under the sanctioned `authenticated_security_definer_function_executable` class (same as `staff_app_provision_member`); `staff_app_gigs` has ZERO findings (no `security_definer_view` — it is security_invoker).
- **Cleanup:** all transient harness rows deleted (offers/gigs/staff_profiles left at 0 for the test candidate).

## Commit
- `b5ba5a1` — feat(03-01): add staff_app_0008 create_offer RPC + gigs view + harness (migration file + SQL harness; the file was authored by the executor, applied+verified live by the orchestrator).

## For downstream (03-03)
- Call `supabase.rpc('staff_app_create_offer', { p_staff_profile_id, p_role, p_gig_id?, p_gig_title?, p_gig_starts_at?, p_gig_ends_at?, p_gig_venue?, p_amount?, p_conditions?, p_expires_in_days? })` with the AUTHENTICATED client (never service-role). It returns `{ ok, offer_id, gig_id, token }`. Build the link `${SITE_URL}/o/${token}` from the returned `token` (it is only available in this response — never re-fetchable).
- List gigs for the pick step from `public.staff_app_gigs` (authenticated client; RLS scopes to org).
- `/o/[token]` is Phase 4 — the emitted link is valid but 404s until then.
