-- staff_app_0046_registro_sin_telefono
-- EL REGISTRO NO PUEDE EXIGIR LO QUE EL FORMULARIO NO PIDE.
--
-- ── EL BUG (reportado por una trabajadora real, 1/8/2026) ────────────────────
--
-- La 0004 nació calcada del formulario de somosder.ar, donde el teléfono era
-- obligatorio, y metió `telefono es obligatorio` adentro del RPC. La 0038 la
-- arrastró tal cual. Pero el 31/7 el producto cambió: /sumate abre en el
-- registro CORTO, donde alcanza con el CV y los únicos obligatorios de verdad
-- son nombre, email y consentimiento (así lo validan la UI y el server action).
-- Nadie sacó el check del RPC.
--
-- Resultado: si el parser no saca un teléfono del CV (una foto, un screenshot,
-- un PDF sin teléfono), la persona llena todo, toca "Listo, sumame" y recibe
-- "No se pudo enviar el registro. Probá de nuevo." — para siempre, sin pista de
-- qué falta. El formulario LARGO tampoco marca el teléfono como obligatorio, así
-- que también moría por el mismo camino.
--
-- ── EL FIX ───────────────────────────────────────────────────────────────────
--
-- Se saca el check del teléfono. Obligatorios del RPC = obligatorios de la UI:
-- nombre y email. El teléfono se sigue guardando cuando viene, y la ficha sin
-- teléfono queda sin perfil_confirmado_at (vía corta), o sea el recordatorio de
-- la 0034 la invita a completarlo a los 5 días. Ese es el camino para conseguir
-- el dato, no reventar el alta.
--
-- Misma firma que la 0038 (25 parámetros) → CREATE OR REPLACE alcanza: no hay
-- DROP, los grants (anon, authenticated) quedan como están.

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
  p_motivacion            text    DEFAULT NULL,
  p_org_slug              text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id  uuid;
  v_org uuid;
BEGIN
  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'nombre es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'email es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  -- Teléfono: OPCIONAL. La UI no lo exige, el RPC tampoco (ver cabecera).

  -- Sin slug: la organización default (hoy y siempre que /sumate sea el
  -- formulario de DER). Con slug: esa productora, y si no existe, se corta.
  IF p_org_slug IS NULL OR btrim(p_org_slug) = '' THEN
    v_org := staff_app.default_org_id();
  ELSE
    v_org := staff_app.org_id_by_slug(p_org_slug);
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'organizacion desconocida' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no hay organizacion por defecto' USING ERRCODE = 'check_violation';
  END IF;

  -- organization_id / estado / source se FUERZAN acá; el que llama no los elige.
  INSERT INTO staff_app.staff_profiles (
    nombre, apellido, email, telefono, documento, fecha_nacimiento,
    pais_residencia, provincia, ciudad, donde_trabajar, situacion_legal,
    oficios, oficios_otro, experiencia, anios_experiencia, experiencia_detalle,
    disponibilidad_finde, disponibilidad_viajar, movilidad_propia,
    disponibilidad_aviso, cv_url, portfolio_url, linkedin_url, motivacion,
    organization_id, estado, source
  ) VALUES (
    btrim(p_nombre), p_apellido, btrim(p_email), nullif(btrim(coalesce(p_telefono, '')), ''), p_documento, p_fecha_nacimiento,
    p_pais_residencia, p_provincia, p_ciudad, coalesce(p_donde_trabajar, '{}'), p_situacion_legal,
    coalesce(p_oficios, '{}'), p_oficios_otro, p_experiencia, p_anios_experiencia, p_experiencia_detalle,
    coalesce(p_disponibilidad_finde, false), coalesce(p_disponibilidad_viajar, false), coalesce(p_movilidad_propia, false),
    p_disponibilidad_aviso, p_cv_url, p_portfolio_url, p_linkedin_url, p_motivacion,
    v_org, 'pendiente', 'web_somosder'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'organization_id', v_org);
END;
$$;

COMMENT ON FUNCTION public.staff_app_register_applicant IS
  'Alta pública de candidatos (el formulario de /sumate). Obligatorios: nombre y email, IGUAL que la UI — el teléfono es opcional desde la 0046 (el registro corto con CV no lo puede garantizar y el check volteaba altas reales). La organización sale del slug (p_org_slug) o de la default. estado y source se siguen forzando. anon + authenticated.';
