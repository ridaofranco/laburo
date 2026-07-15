-- Migration: staff_app_0006_hardening
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration on 2026-07-15.
--
-- Phase-2 REVIEW fixes that GATE all new staff_app work (WR-04 + WR-05). These
-- land BEFORE any new object is added to staff_app (plan 02-01, Task 1).
--
--   WR-04 — members.role was free text and is_org_writer granted write for
--           `role <> 'viewer'` (fail-open: any typo'd/unknown role — 'Viewer',
--           'guest', '' — silently gained full writer privileges). Add a CHECK
--           enumerating the 3 valid roles and redefine is_org_writer to
--           enumerate-ALLOWED (`role IN ('owner','writer')`).
--   WR-05 — new staff_app functions are EXECUTE-to-PUBLIC by default and anon
--           holds schema USAGE, so any function added in Phase 2+ is anon-callable
--           unless its author remembers the per-function REVOKE. Make
--           not-anon-callable the DEFAULT state.
--
-- Zero writes to HITO public.*; no pgrst.db_schemas / exposed-schema change.

-- WR-04: enumerate valid roles. members currently has 0 rows and the column
-- default is 'writer' (a valid value), so the constraint applies cleanly.
ALTER TABLE staff_app.members
  ADD CONSTRAINT members_role_check CHECK (role IN ('owner','writer','viewer'));

-- WR-04: redefine is_org_writer enumerate-allowed (was: `role <> 'viewer'`).
-- Identical hardening to 0001: SECURITY DEFINER STABLE, pinned empty search_path,
-- every reference schema-qualified (kills function_search_path_mutable +
-- search-path injection).
CREATE OR REPLACE FUNCTION staff_app.is_org_writer(org_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.members
    WHERE organization_id = org_id AND user_id = auth.uid()
      AND role IN ('owner','writer')
  );
$$;

-- WR-05: make the safe state the DEFAULT state — every future staff_app function
-- should be NOT PUBLIC/anon-callable unless explicitly granted. Runs as the
-- function-creating role (postgres, the role executing this migration).
--
-- ENVIRONMENT NOTE (verified live on luillpzfqzbpoqkgvjuw, 2026-07-15): on this
-- Supabase-managed project a bare `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON
-- FUNCTIONS FROM PUBLIC` records NO pg_default_acl entry (a probe function created
-- afterward still carries the built-in `=X` PUBLIC grant and stays anon-executable),
-- whereas a `GRANT` form DOES persist. The built-in PUBLIC=EXECUTE default is
-- therefore not subtractable via default privileges here. On vanilla/self-hosted
-- Postgres this same statement DOES create the subtractive entry, so it is retained
-- for replay correctness + documented intent. The ENFORCED, operative control for
-- "not anon-callable" in this project is the mandatory PER-FUNCTION
-- `REVOKE EXECUTE ... FROM PUBLIC` at creation time — the Phase-1 convention applied
-- to every staff_app function (0003 helpers/RPCs, 0004 intake) and to
-- public.staff_app_provision_member in staff_app_0007. See 02-01-SUMMARY.md § WR-05.
ALTER DEFAULT PRIVILEGES IN SCHEMA staff_app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
