-- staff_app_0004_intake_function
-- Public SECURITY DEFINER intake RPC for the somosder-web "Trabajá con nosotros" form.
--
-- D-03 sanctioned exception: this is the ONLY object the Staff App creates in the
-- `public` schema. It lives in `public` (not `staff_app`) DELIBERATELY so PostgREST
-- exposes it at /rest/v1/rpc/staff_app_register_applicant WITHOUT changing the
-- project's exposed-schemas config. It validates the anon payload, forces the
-- privileged columns (organization_id / estado / source), and writes ONLY into
-- staff_app.staff_profiles. It never reads or writes HITO's public.* tables.
--
-- Anon can create an applicant row ONLY through this function: anon has NO direct
-- INSERT on staff_app.staff_profiles. The staff-cvs bucket is UNCHANGED (same project).
--
-- Mirrors the applied migration `staff_app_0004_intake_function`.

CREATE OR REPLACE FUNCTION public.staff_app_register_applicant(
  p_nombre                text    DEFAULT NULL,
  p_apellido              text    DEFAULT NULL,
  p_email                 text    DEFAULT NULL,
  p_telefono              text    DEFAULT NULL,
  p_documento             text    DEFAULT NULL,
  p_fecha_nacimiento      date    DEFAULT NULL,
  p_pais_residencia       text    DEFAULT NULL,
  p_provincia             text    DEFAULT NULL,
  p_ciudad                text    DEFAULT NULL,
  p_donde_trabajar        text[]  DEFAULT '{}',
  p_situacion_legal       text    DEFAULT NULL,
  p_oficios               text[]  DEFAULT '{}',
  p_oficios_otro          text    DEFAULT NULL,
  p_experiencia           boolean DEFAULT NULL,
  p_anios_experiencia     text    DEFAULT NULL,
  p_experiencia_detalle   text    DEFAULT NULL,
  p_disponibilidad_finde  boolean DEFAULT false,
  p_disponibilidad_viajar boolean DEFAULT false,
  p_movilidad_propia      boolean DEFAULT false,
  p_disponibilidad_aviso  text    DEFAULT NULL,
  p_cv_url                text    DEFAULT NULL,
  p_portfolio_url         text    DEFAULT NULL,
  p_linkedin_url          text    DEFAULT NULL,
  p_motivacion            text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Required-field validation (anon intake hardening; caller gets an honest error).
  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'nombre es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'email es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  IF p_telefono IS NULL OR btrim(p_telefono) = '' THEN
    RAISE EXCEPTION 'telefono es obligatorio' USING ERRCODE = 'check_violation';
  END IF;

  -- Insert into the APP schema. organization_id / estado / source are FORCED here;
  -- the caller cannot set them (they are not parameters). id/created_at/rating/
  -- eventos_trabajados/notas_internas are DB-defaulted and never caller-supplied.
  INSERT INTO staff_app.staff_profiles (
    nombre, apellido, email, telefono, documento, fecha_nacimiento,
    pais_residencia, provincia, ciudad, donde_trabajar, situacion_legal,
    oficios, oficios_otro, experiencia, anios_experiencia, experiencia_detalle,
    disponibilidad_finde, disponibilidad_viajar, movilidad_propia,
    disponibilidad_aviso, cv_url, portfolio_url, linkedin_url, motivacion,
    organization_id, estado, source
  ) VALUES (
    btrim(p_nombre), p_apellido, btrim(p_email), p_telefono, p_documento, p_fecha_nacimiento,
    p_pais_residencia, p_provincia, p_ciudad, coalesce(p_donde_trabajar, '{}'), p_situacion_legal,
    coalesce(p_oficios, '{}'), p_oficios_otro, p_experiencia, p_anios_experiencia, p_experiencia_detalle,
    coalesce(p_disponibilidad_finde, false), coalesce(p_disponibilidad_viajar, false), coalesce(p_movilidad_propia, false),
    p_disponibilidad_aviso, p_cv_url, p_portfolio_url, p_linkedin_url, p_motivacion,
    'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'::uuid, 'pendiente', 'web_somosder'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- Least-privilege exposure: strip default PUBLIC EXECUTE, grant only anon + authenticated.
REVOKE ALL ON FUNCTION public.staff_app_register_applicant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_register_applicant TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_register_applicant IS
  'D-03 sanctioned public intake RPC. Validates the anon web-form payload, forces organization_id=aa29aa2f-4d34-4e53-b62c-7397e8a4d123 / estado=pendiente / source=web_somosder, and inserts into staff_app.staff_profiles. The only Staff App object in public; anon has no direct INSERT on staff_app.staff_profiles. Reads/writes zero HITO public.* tables.';
