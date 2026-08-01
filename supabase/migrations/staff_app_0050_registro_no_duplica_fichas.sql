-- staff_app_0050_registro_no_duplica_fichas
-- REGISTRARSE DOS VECES PARTIA A LA PERSONA EN DOS, Y LAS OFERTAS CAIAN EN LA FICHA EQUIVOCADA.
--
-- ── EL BUG ───────────────────────────────────────────────────────────────────
--
-- staff_app_register_applicant inserta siempre, sin mirar si ese email ya tiene
-- ficha, y la columna no tenia unicidad. O sea que alguien que se anota en
-- somosder.ar y despues en /sumate (que es EXACTAMENTE lo que hizo la
-- trabajadora del 1/8, porque el mail de bienvenida la mandaba a una pantalla
-- que le pedia una contraseña que no tenia) queda como dos personas distintas.
--
-- Y ahi empieza lo caro. La resolucion de identidad del staff hace
-- `order by created_at asc limit 1` (0012), o sea SU PANEL LEE LA FICHA VIEJA.
-- Pero la productora en /buscar puede elegir cualquiera de las dos, y si elige
-- la nueva, la oferta se guarda contra una ficha que su panel no mira. El link
-- magico del mail funciona, ella acepta, y su panel sigue vacio. Y el fichaje
-- (que resuelve por la oferta aceptada) tampoco la encuentra.
--
-- Medido el 1/8/2026: 1015 fichas, CERO duplicados todavia. Esto se cierra antes
-- de que muerda, no despues.
--
-- ── EL FIX, EN DOS CAPAS ─────────────────────────────────────────────────────
--
-- 1) El RPC busca por email ANTES de insertar. Si ya hay ficha, la COMPLETA en
--    vez de crear otra, y devuelve el id de la que ya existia.
-- 2) Un indice unico sobre (organization_id, lower(email)) para que ningun
--    camino futuro pueda volver a partir a una persona en dos. La capa 1 es la
--    que da la buena experiencia; la 2 es la que hace que sea imposible.
--
-- ── LA REGLA AL COMPLETAR: SUMAR, NUNCA PISAR ────────────────────────────────
--
-- Se rellenan SOLO los campos que estan vacios. Nunca se pisa un dato que la
-- persona ya habia cargado, y el CV existente NO se reemplaza. Importa por dos
-- motivos: el obvio es que su formulario largo de ayer no lo puede borrar un
-- registro corto de hoy; el otro es que el email no esta verificado en el alta,
-- asi que si alguien se registra con el mail de otro, lo peor que puede hacer es
-- rellenar huecos, no reescribirle el perfil.
--
-- Los booleanos de disponibilidad solo se pueden PRENDER (OR), nunca apagar: un
-- formulario corto que no los pregunta no puede dejar a alguien como "no viaja".
--
-- El retorno suma `ya_existia` para que la app sepa que no es un alta nueva.
-- Misma firma (25 parametros) → CREATE OR REPLACE, sin tocar grants.

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
  v_id    uuid;
  v_org   uuid;
  v_mail  text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
    RAISE EXCEPTION 'nombre es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  IF v_mail = '' THEN
    RAISE EXCEPTION 'email es obligatorio' USING ERRCODE = 'check_violation';
  END IF;
  -- Telefono: OPCIONAL desde la 0046/0047.

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

  -- ¿Ya tiene ficha? Se busca la MAS VIEJA, que es la misma que resuelve
  -- staff_app_my_staff_profile (0012, `order by created_at asc limit 1`). Si
  -- eligiéramos otra, el panel de la persona seguiría mirando a otro lado.
  SELECT id INTO v_id
    FROM staff_app.staff_profiles
   WHERE organization_id = v_org AND lower(email) = v_mail
   ORDER BY created_at ASC, id ASC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- COMPLETAR, no pisar. Cada campo se toca solo si está vacío.
    UPDATE staff_app.staff_profiles sp SET
      apellido            = coalesce(sp.apellido,            nullif(btrim(coalesce(p_apellido, '')), '')),
      telefono            = coalesce(sp.telefono,            nullif(btrim(coalesce(p_telefono, '')), '')),
      documento           = coalesce(sp.documento,           nullif(btrim(coalesce(p_documento, '')), '')),
      fecha_nacimiento    = coalesce(sp.fecha_nacimiento,    p_fecha_nacimiento),
      pais_residencia     = coalesce(sp.pais_residencia,     nullif(btrim(coalesce(p_pais_residencia, '')), '')),
      provincia           = coalesce(sp.provincia,           nullif(btrim(coalesce(p_provincia, '')), '')),
      ciudad              = coalesce(sp.ciudad,              nullif(btrim(coalesce(p_ciudad, '')), '')),
      situacion_legal     = coalesce(sp.situacion_legal,     nullif(btrim(coalesce(p_situacion_legal, '')), '')),
      oficios_otro        = coalesce(sp.oficios_otro,        nullif(btrim(coalesce(p_oficios_otro, '')), '')),
      experiencia         = coalesce(sp.experiencia,         p_experiencia),
      anios_experiencia   = coalesce(sp.anios_experiencia,   nullif(btrim(coalesce(p_anios_experiencia, '')), '')),
      experiencia_detalle = coalesce(sp.experiencia_detalle, nullif(btrim(coalesce(p_experiencia_detalle, '')), '')),
      disponibilidad_aviso= coalesce(sp.disponibilidad_aviso,nullif(btrim(coalesce(p_disponibilidad_aviso, '')), '')),
      -- El CV que ya tiene NO se reemplaza nunca.
      cv_url              = coalesce(sp.cv_url,              nullif(btrim(coalesce(p_cv_url, '')), '')),
      portfolio_url       = coalesce(sp.portfolio_url,       nullif(btrim(coalesce(p_portfolio_url, '')), '')),
      linkedin_url        = coalesce(sp.linkedin_url,        nullif(btrim(coalesce(p_linkedin_url, '')), '')),
      motivacion          = coalesce(sp.motivacion,          nullif(btrim(coalesce(p_motivacion, '')), '')),
      -- Arrays: se llenan solo si estaban vacíos (no se mezclan ni se recortan).
      donde_trabajar      = CASE WHEN coalesce(array_length(sp.donde_trabajar, 1), 0) = 0
                                 THEN coalesce(p_donde_trabajar, '{}') ELSE sp.donde_trabajar END,
      oficios             = CASE WHEN coalesce(array_length(sp.oficios, 1), 0) = 0
                                 THEN coalesce(p_oficios, '{}') ELSE sp.oficios END,
      -- Disponibilidad: solo se PRENDE. Un formulario que no pregunta no puede
      -- dejar a alguien marcado como que no viaja.
      disponibilidad_finde  = sp.disponibilidad_finde  OR coalesce(p_disponibilidad_finde, false),
      disponibilidad_viajar = sp.disponibilidad_viajar OR coalesce(p_disponibilidad_viajar, false),
      movilidad_propia      = sp.movilidad_propia      OR coalesce(p_movilidad_propia, false)
    WHERE sp.id = v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'organization_id', v_org, 'ya_existia', true);
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

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'organization_id', v_org, 'ya_existia', false);
END;
$$;

-- La garantía dura: una persona, un email, una ficha por organización. Se puede
-- crear sin más porque al 1/8/2026 no hay ni un duplicado (medido). Si algún día
-- falla al aplicarse en otra base, ESO es la señal de que hay fichas partidas
-- que hay que unificar antes, no de que el índice esté mal.
CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_org_email_uniq
  ON staff_app.staff_profiles (organization_id, lower(email));

COMMENT ON FUNCTION public.staff_app_register_applicant IS
  'Alta publica de candidatos (/sumate y el formulario de somosder.ar). Obligatorios: nombre y email (telefono opcional desde la 0046/0047). Desde la 0050 NO duplica: si el email ya tiene ficha en esa organizacion, completa los campos vacios de la mas vieja (la misma que resuelve el panel del staff) y devuelve su id con ya_existia=true. Nunca pisa un dato cargado ni reemplaza un CV. anon + authenticated.';
