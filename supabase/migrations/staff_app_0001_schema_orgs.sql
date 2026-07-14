-- Migration: staff_app_0001_schema_orgs
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration on 2026-07-14.
--
-- Creates the app's logically-independent schema `staff_app` INSIDE HITO's
-- project (free-tier 2-active-project limit; D-03). Independence is LOGICAL:
-- own schema, own RLS, own org-scoping. ZERO writes to HITO's public.* tables.
--
-- Contents: schema + organizations/members tables, the staff_app.is_org_member /
-- staff_app.is_org_writer helpers (own names, no collision with HITO's public
-- helpers), and a seeded SOMOS DER org with a FIXED hardcoded UUID.

CREATE SCHEMA IF NOT EXISTS staff_app;

-- Organizations (multi-tenant root)
CREATE TABLE staff_app.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Membership (auth wired in Phase 2 — seeded empty now)
CREATE TABLE staff_app.members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'writer',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Org helpers copied from HITO 00001/00052, hardened: own names in staff_app
-- (no collision with public.is_org_member), SECURITY DEFINER STABLE, pinned
-- empty search_path with every reference schema-qualified (kills
-- function_search_path_mutable + search-path injection).
CREATE FUNCTION staff_app.is_org_member(org_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

CREATE FUNCTION staff_app.is_org_writer(org_id uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.members
    WHERE organization_id = org_id AND user_id = auth.uid() AND role <> 'viewer'
  );
$$;

-- RLS ON both tables, member-scoped SELECT policies.
ALTER TABLE staff_app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.members       ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON staff_app.organizations
  FOR SELECT USING (staff_app.is_org_member(id));

CREATE POLICY members_select ON staff_app.members
  FOR SELECT USING (staff_app.is_org_member(organization_id));

-- Explicit deny: anon (and authenticated) get NO direct table access this phase.
-- staff_app schema is not PostgREST-exposed and no grants are issued; REVOKE is
-- belt-and-suspenders so the "anon denied" truth holds regardless of defaults.
REVOKE ALL ON ALL TABLES    IN SCHEMA staff_app FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA staff_app FROM anon, authenticated;
REVOKE ALL ON SCHEMA staff_app FROM anon, authenticated;

-- Seed exactly one SOMOS DER org with a FIXED hardcoded UUID (recorded in SUMMARY;
-- every later plan/backfill stamps organization_id with this value).
INSERT INTO staff_app.organizations (id, name)
VALUES ('aa29aa2f-4d34-4e53-b62c-7397e8a4d123', 'SOMOS DER');
