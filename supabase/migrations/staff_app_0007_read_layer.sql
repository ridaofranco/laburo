-- Migration: staff_app_0007_read_layer
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration on 2026-07-15.
--
-- The DB read layer every LABURO screen queries. PostgREST does NOT expose the
-- `staff_app` schema (Phase 1 verified PGRST106), so the app's own data is surfaced
-- through a small set of `public` security-invoker VIEWS over staff_app.* — zero
-- shared-project config change (no pgrst.db_schemas edit), RLS/membership enforced
-- by Postgres. Also: search indexes, the 2 admin members seed (D-06 gate), and the
-- SECURITY DEFINER self-provisioning RPC (login-time fallback for whichever admin
-- email is not pre-seeded).
--
-- security_invoker = true (PG15+) makes each view obey the BASE TABLE's RLS as the
-- QUERYING user. That requires the invoker (role `authenticated`) to hold table-level
-- SELECT on the underlying staff_app tables; 0002 revoked those, so they are granted
-- back here. This does NOT widen exposure: staff_app is not PostgREST-exposed (anon/
-- authenticated cannot reach these tables directly — PGRST106), and RLS
-- (is_org_member) still returns 0 rows to a non-member. anon is granted NOTHING.

-- ── Base-table SELECT for the security_invoker path (authenticated only) ──────────
-- Required so the public security-invoker views can read the base tables AS the
-- invoking authenticated user; RLS then scopes rows to the caller's org membership.
GRANT SELECT ON staff_app.staff_profiles TO authenticated;
GRANT SELECT ON staff_app.members         TO authenticated;
GRANT SELECT ON staff_app.crew            TO authenticated;
GRANT SELECT ON staff_app.gigs            TO authenticated;

-- ── (1) Profiles read view — the search/profile surface (SRCH-01/02, PERF-01) ─────
CREATE VIEW public.staff_app_profiles WITH (security_invoker = true) AS
  SELECT id, nombre, apellido, oficios, oficios_otro, provincia, ciudad,
         experiencia, anios_experiencia, eventos_trabajados, experiencia_detalle,
         disponibilidad_finde, disponibilidad_viajar, movilidad_propia, disponibilidad_aviso,
         estado, cv_url, portfolio_url, linkedin_url, telefono, email,
         situacion_legal, donde_trabajar, pais_residencia, motivacion, organization_id
  FROM staff_app.staff_profiles;
GRANT SELECT ON public.staff_app_profiles TO authenticated;   -- anon NOT granted

-- ── (2) Membership view — the D-06 gate source ───────────────────────────────────
-- Returns the CALLER'S OWN membership row(s). The `WHERE user_id = auth.uid()` filter
-- is REQUIRED: members_select RLS scopes to the caller's ORGS (every member row of
-- those orgs is visible), so without the filter an admin in a 2-admin org sees BOTH
-- rows — which breaks the gate's `.maybeSingle()` (Pattern 2) and exposes the other
-- admin. With the filter: exactly the caller's own row(s) (1 per org they belong to),
-- 0 for a non-member. security_invoker + RLS stay on as defense-in-depth.
CREATE VIEW public.staff_app_my_membership WITH (security_invoker = true) AS
  SELECT organization_id, role FROM staff_app.members WHERE user_id = auth.uid();
GRANT SELECT ON public.staff_app_my_membership TO authenticated;

-- ── (3) Crew-busy view — SRCH-02 "ocultar ya asignados" exclusion source ──────────
-- Near-empty in Phase 2 (gigs/crew created in Phase 3); matures Phase 3.
CREATE VIEW public.staff_app_crew_busy WITH (security_invoker = true) AS
  SELECT DISTINCT c.staff_profile_id
  FROM staff_app.crew c
  JOIN staff_app.gigs g ON g.id = c.gig_id;
GRANT SELECT ON public.staff_app_crew_busy TO authenticated;

-- Lock anon OUT of all three views (T-02-01). Supabase's public-schema DEFAULT
-- PRIVILEGES auto-grant anon/authenticated/service_role full privileges on any new
-- public table/view created by postgres, so an explicit REVOKE from anon is REQUIRED
-- (a bare "GRANT ... TO authenticated" is not enough to keep anon out here). Base-
-- table SELECT is granted to authenticated ONLY, so even this revoke aside anon cannot
-- read data through the security_invoker views (permission denied on staff_app.*);
-- this makes the intent explicit and defense-in-depth.
REVOKE ALL ON public.staff_app_profiles      FROM anon;
REVOKE ALL ON public.staff_app_my_membership FROM anon;
REVOKE ALL ON public.staff_app_crew_busy     FROM anon;

-- ── (4) Search indexes on the base table ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS staff_profiles_oficios_gin
  ON staff_app.staff_profiles USING gin (oficios);               -- array overlap (SRCH-01)
CREATE INDEX IF NOT EXISTS staff_profiles_provincia
  ON staff_app.staff_profiles (provincia);                       -- provincia filter (D-04)

-- pg_trgm is available on this project (A4 verified) → cheap ILIKE insurance for
-- free-text name search. Installed into the `extensions` schema (Supabase convention).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS staff_profiles_nombre_trgm
  ON staff_app.staff_profiles USING gin (nombre extensions.gin_trgm_ops);

-- ── (5) Seed the 2 admin members rows (D-06 gate; A2: both emails exist) ──────────
-- ridaofrancorg@gmail.com = 73fc15e0-69a6-4fc2-a832-696bd6f0f95c
-- franco@somosder.ar     = 37987a10-d822-437a-b158-af8cc27cf54e
-- 'owner' satisfies members_role_check (staff_app_0006).
INSERT INTO staff_app.members (organization_id, user_id, role) VALUES
  ('aa29aa2f-4d34-4e53-b62c-7397e8a4d123', '73fc15e0-69a6-4fc2-a832-696bd6f0f95c', 'owner'),
  ('aa29aa2f-4d34-4e53-b62c-7397e8a4d123', '37987a10-d822-437a-b158-af8cc27cf54e', 'owner')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ── (6) Self-provisioning RPC — login-time fallback (D-06 allowlist in-DB) ────────
-- Mirrors the proven public.staff_app_register_applicant (0004) SECURITY DEFINER
-- pattern. NO arguments: reads auth.uid()/auth.email() server-side so the caller
-- cannot pass an email. If the caller's email is allowlisted it idempotently upserts
-- an 'owner' members row and returns {organization_id, role}; otherwise returns NULL
-- WITHOUT raising. Called by 02-02's /auth/callback via
-- supabase.rpc('staff_app_provision_member') for whichever admin email is not
-- pre-seeded (a service-role PostgREST write to staff_app is impossible — PGRST106,
-- schema not exposed; proven in 01-03).
CREATE OR REPLACE FUNCTION public.staff_app_provision_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_role  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;                                 -- not authenticated
  END IF;
  IF v_email NOT IN ('ridaofrancorg@gmail.com', 'franco@somosder.ar') THEN
    RETURN NULL;                                 -- not allowlisted: no row, no error (D-06)
  END IF;

  INSERT INTO staff_app.members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'owner')                 -- 'owner' satisfies members_role_check
  ON CONFLICT (organization_id, user_id) DO NOTHING;   -- idempotent

  SELECT role INTO v_role
  FROM staff_app.members
  WHERE organization_id = v_org AND user_id = v_uid;

  RETURN jsonb_build_object('organization_id', v_org, 'role', v_role);
END;
$$;

-- Least-privilege exposure: authenticated ONLY, never anon/PUBLIC (per-function
-- REVOKE is the enforced control — see staff_app_0006 § WR-05).
REVOKE ALL ON FUNCTION public.staff_app_provision_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_provision_member() FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_app_provision_member() TO authenticated;

COMMENT ON FUNCTION public.staff_app_provision_member() IS
  'D-06 login-time self-provisioning. SECURITY DEFINER, pinned search_path. Reads auth.uid()/auth.email() server-side; if the email is allowlisted (ridaofrancorg@gmail.com / franco@somosder.ar) idempotently upserts an owner members row for org aa29aa2f-4d34-4e53-b62c-7397e8a4d123 and returns {organization_id, role}; otherwise returns NULL. authenticated-only EXECUTE; never anon.';
