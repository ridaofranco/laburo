-- staff_app_0038_org_rpcs_servicio
-- DESHARCODEAR LA ORGANIZACIÓN — parte 4 de 4: crons, webhooks y formulario público.
--
-- Las 17 funciones que corren SIN un usuario logueado adelante: el registro
-- público de /sumate, el acceso del staff por link mágico, las tandas de mails,
-- el webhook de Mercado Pago, la baja del pool y el batch de CVs. Ninguna tiene
-- de dónde sacar "la org del usuario", así que todas tenían el literal adentro.
--
-- ── LAS DOS FUGAS QUE HAY ACÁ ───────────────────────────────────────────────
--
--   ⚠️ 1. staff_app_log_payment_event (0023). El webhook de Mercado Pago avisa
--      "se pagó el evento X". La función insertaba el movimiento con
--      organization_id = <constante DER>, SIN mirar de quién era el evento. Con
--      dos productoras, TODOS los cobros de clientes de la productora B (id de
--      pago, estado, MONTO) quedaban escritos como de DER y se veían en el panel
--      de cobros de DER — y B no veía ninguno de los propios. Plata ajena a la
--      vista. Ahora la organización se DEDUCE DEL EVENTO que se está pagando.
--
--   ⚠️ 2. staff_app_marcar_pago_listo (0032). Filtraba la propuesta por la
--      constante. El server action que la llama gatea "¿sos miembro de alguna
--      org?" y después usa service_role: con dos productoras, un admin de B pasa
--      ese gate y termina marcando como pagada una propuesta DE DER. Ahora la
--      función recibe p_org y el server action le pasa la org del que hace clic
--      (ver el cambio en app/(portal)/pagos/pago-actions.ts).
--
-- ── EL RESTO: rotas, no filtradas ───────────────────────────────────────────
-- Las tandas (bienvenida, recordatorio de perfil, recordatorio de turno,
-- propuestas por vencer, resumen de fichaje) filtran POR la constante, así que
-- no muestran de más: simplemente ignoran a la productora nueva. Su gente no
-- recibiría un solo mail. Pasan a resolver la org y, cuando llegue la Fase 2,
-- el cron las llama una vez por organización con public.staff_app_org_ids()
-- (0035). Hoy, sin p_org, siguen trabajando sobre la org default: mismo
-- resultado, fila por fila.
--
-- ── CONVENCIÓN DE ESTA MIGRACIÓN ────────────────────────────────────────────
--   · p_org NULL en una TANDA        → la organización default.
--   · p_org NULL en algo con LLAVE PROPIA (token de propuesta, id de ficha,
--     mail del staff) → cualquier organización. La llave ya identifica la fila;
--     filtrar además por org solo servía para romper. Con una sola org el
--     resultado es idéntico, por eso es seguro aplicarlo hoy.
--
-- ⚠️ Igual que en 0036/0037: sumar parámetro = cambiar firma = DROP + CREATE
-- (dos overloads que aceptan los mismos argumentos dan "function is not unique",
-- 42725). Todo corre en una transacción y cada bloque vuelve a emitir sus grants,
-- porque DROP se los lleva.

-- ---------------------------------------------------------------------------
-- (1) register_applicant — el formulario público /sumate.
--
--     Recibe SLUG y no UUID: el formulario de una productora vive en una URL con
--     su slug, y el identificador interno nunca viaja al navegador. Si el slug
--     no existe, ERROR explícito: es preferible que un formulario mal configurado
--     falle a que meta candidatos en el pool equivocado.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_register_applicant(
  text, text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text, text
);

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
  IF p_telefono IS NULL OR btrim(p_telefono) = '' THEN
    RAISE EXCEPTION 'telefono es obligatorio' USING ERRCODE = 'check_violation';
  END IF;

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
    btrim(p_nombre), p_apellido, btrim(p_email), p_telefono, p_documento, p_fecha_nacimiento,
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

REVOKE ALL ON FUNCTION public.staff_app_register_applicant(
  text, text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_register_applicant(
  text, text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text, text
) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_register_applicant IS
  'Alta pública de candidatos (el formulario de /sumate). La organización sale del slug (p_org_slug) o, si no viene, de la organización default: ya no de un UUID escrito adentro. Slug inexistente = error explícito, para que un formulario mal configurado falle en vez de meter fichas en el pool equivocado. estado y source se siguen forzando. anon + authenticated.';

-- ---------------------------------------------------------------------------
-- (2) email_in_pool — ¿le mando el link mágico de acceso al staff?
--     p_org NULL = en cualquier pool. Con una sola org es idéntico; con dos, es
--     lo correcto: la persona de la productora B también tiene que poder entrar.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_email_in_pool(text);

CREATE OR REPLACE FUNCTION public.staff_app_email_in_pool(
  p_email text,
  p_org   uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.staff_profiles sp
     WHERE lower(sp.email) = lower(btrim(p_email))
       AND (p_org IS NULL OR sp.organization_id = p_org)
  );
$$;

REVOKE ALL ON FUNCTION public.staff_app_email_in_pool(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_email_in_pool(text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (3) set_baja — la baja del pool desde el link del pie de los mails.
--     La llave es el id de la ficha, protegido por un HMAC en /api/baja. Filtrar
--     además por org solo servía para que la baja de la productora B no
--     funcionara nunca.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_set_baja(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.staff_app_set_baja(
  p_id     uuid,
  p_motivo text    DEFAULT NULL,
  p_baja   boolean DEFAULT true,
  p_org    uuid    DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_hit int;
BEGIN
  IF p_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE staff_app.staff_profiles sp
     SET baja_at     = CASE WHEN p_baja THEN coalesce(sp.baja_at, now()) ELSE NULL END,
         baja_motivo = CASE
                         WHEN NOT p_baja THEN NULL
                         WHEN p_motivo IS NOT NULL AND btrim(p_motivo) <> '' THEN left(btrim(p_motivo), 2000)
                         ELSE sp.baja_motivo
                       END
   WHERE sp.id = p_id
     AND (p_org IS NULL OR sp.organization_id = p_org);

  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_baja(uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_set_baja(uuid, text, boolean, uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_set_baja(uuid, text, boolean, uuid) IS
  'Marca o levanta la baja del pool de una ficha. Idempotente. La llave es el id de la ficha, que llega firmado con HMAC desde /api/baja: por eso p_org NULL trabaja sobre cualquier organización en vez de sobre una constante (si no, la baja de una productora que no fuera DER nunca funcionaría). service_role EXECUTE solo.';

-- ---------------------------------------------------------------------------
-- (4) bajas_count — cuántas bajas hubo. Tanda: p_org NULL = org default.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_bajas_count();

CREATE OR REPLACE FUNCTION public.staff_app_bajas_count(p_org uuid DEFAULT NULL)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = coalesce(p_org, staff_app.default_org_id())
    AND sp.baja_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.staff_app_bajas_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_bajas_count(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (5) welcome_batch / welcome_pending — la tanda de bienvenida a las fichas.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_welcome_batch(int);

CREATE OR REPLACE FUNCTION public.staff_app_welcome_batch(
  p_limit int  DEFAULT 50,
  p_org   uuid DEFAULT NULL
)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := coalesce(p_org, staff_app.default_org_id());
  v_limit int  := least(greatest(coalesce(p_limit, 0), 0), 200);
BEGIN
  IF v_limit = 0 OR v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    WHERE sp.organization_id = v_org
      AND sp.bienvenida_enviada_at IS NULL
      AND sp.baja_at IS NULL
      AND sp.email IS NOT NULL
      AND sp.email <> ''
      AND position('@' in sp.email) > 1
    ORDER BY sp.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.staff_profiles sp
       SET bienvenida_enviada_at = now()
     WHERE sp.id IN (SELECT c.id FROM candidatas c)
    RETURNING sp.id, sp.email, sp.nombre
  )
  SELECT m.id, m.email, m.nombre FROM marcadas m;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_welcome_batch(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_batch(int, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.staff_app_welcome_pending();

CREATE OR REPLACE FUNCTION public.staff_app_welcome_pending(p_org uuid DEFAULT NULL)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = coalesce(p_org, staff_app.default_org_id())
    AND sp.bienvenida_enviada_at IS NULL
    AND sp.baja_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_welcome_pending(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_pending(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (6) perfil_reminder_batch / _pending — el recordatorio de perfil incompleto.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_perfil_reminder_batch(int, int);

CREATE OR REPLACE FUNCTION public.staff_app_perfil_reminder_batch(
  p_limit int  DEFAULT 50,
  p_dias  int  DEFAULT 5,
  p_org   uuid DEFAULT NULL
)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := coalesce(p_org, staff_app.default_org_id());
  v_limit int  := least(greatest(coalesce(p_limit, 0), 0), 200);
  v_dias  int  := least(greatest(coalesce(p_dias, 5), 1), 60);
BEGIN
  IF v_limit = 0 OR v_org IS NULL THEN
    RETURN;   -- tanda apagada: no selecciona ni estampa nada
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    WHERE sp.organization_id = v_org
      AND sp.baja_at IS NULL
      AND sp.bienvenida_enviada_at IS NOT NULL
      AND sp.bienvenida_enviada_at <= now() - make_interval(days => v_dias)
      AND sp.perfil_confirmado_at IS NULL
      AND sp.recordatorio_perfil_enviado_at IS NULL
      AND sp.email IS NOT NULL
      AND sp.email <> ''
      AND position('@' in sp.email) > 1
    ORDER BY sp.bienvenida_enviada_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.staff_profiles sp
       SET recordatorio_perfil_enviado_at = now()
     WHERE sp.id IN (SELECT c.id FROM candidatas c)
    RETURNING sp.id, sp.email, sp.nombre
  )
  SELECT m.id, m.email, split_part(coalesce(m.nombre, ''), ' ', 1) FROM marcadas m;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_perfil_reminder_batch(int, int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_perfil_reminder_batch(int, int, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.staff_app_perfil_reminder_pending(int);

CREATE OR REPLACE FUNCTION public.staff_app_perfil_reminder_pending(
  p_dias int  DEFAULT 5,
  p_org  uuid DEFAULT NULL
)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = coalesce(p_org, staff_app.default_org_id())
    AND sp.baja_at IS NULL
    AND sp.bienvenida_enviada_at IS NOT NULL
    AND sp.bienvenida_enviada_at <= now() - make_interval(days => least(greatest(coalesce(p_dias, 5), 1), 60))
    AND sp.perfil_confirmado_at IS NULL
    AND sp.recordatorio_perfil_enviado_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_perfil_reminder_pending(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_perfil_reminder_pending(int, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (7) crew_due_reminder — el recordatorio del día antes al equipo confirmado.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_crew_due_reminder(int);

CREATE OR REPLACE FUNCTION public.staff_app_crew_due_reminder(
  p_within_hours int  DEFAULT 30,
  p_org          uuid DEFAULT NULL
)
RETURNS TABLE(
  crew_id     uuid,
  email       text,
  first_name  text,
  role        text,
  gig_title   text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  venue_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := coalesce(p_org, staff_app.default_org_id());
  v_h   int  := least(greatest(coalesce(p_within_hours, 30), 1), 72);
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    UPDATE staff_app.crew c
       SET reminder_sent_at = now()
     WHERE c.reminder_sent_at IS NULL
       AND c.gig_id IN (
         SELECT g.id
         FROM staff_app.gigs g
         WHERE g.organization_id = v_org
           AND g.starts_at IS NOT NULL
           AND g.starts_at > now()
           AND g.starts_at <= now() + make_interval(hours => v_h)
       )
    RETURNING c.id, c.gig_id, c.staff_profile_id, c.role
  )
  SELECT d.id, sp.email, split_part(coalesce(sp.nombre, ''), ' ', 1), d.role,
         g.title, g.starts_at, g.ends_at, g.venue_name
  FROM due d
  JOIN staff_app.gigs g            ON g.id  = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id
  WHERE sp.baja_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_crew_due_reminder(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_crew_due_reminder(int, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (8) offers_due_reminder — las propuestas por vencer (con su token propio).
--     El exactly-once y la generación de un token POR FILA quedan intactos.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_offers_due_reminder(int);

CREATE OR REPLACE FUNCTION public.staff_app_offers_due_reminder(
  p_within_days int  DEFAULT 2,
  p_org         uuid DEFAULT NULL
)
RETURNS TABLE(offer_id uuid, email text, first_name text, gig_title text, role text, expires_at timestamptz, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := coalesce(p_org, staff_app.default_org_id());
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  -- Un token POR FILA: se genera dentro del SELECT (gen_random_bytes es
  -- VOLATILE, así que se evalúa fila por fila). Generarlo en un FROM no
  -- correlacionado le pondría el MISMO token a toda la tanda.
  WITH cand AS (
    SELECT o.id, encode(extensions.gen_random_bytes(32), 'hex') AS raw
      FROM staff_app.offers o
      JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
     WHERE o.organization_id = v_org
       AND o.status IN ('sent','viewed')
       AND o.reminded_at IS NULL
       AND o.expires_at > now()
       AND o.expires_at <= now() + make_interval(days => greatest(1, p_within_days))
       AND sp.baja_at IS NULL
  ),
  due AS (
    UPDATE staff_app.offers o
       SET reminded_at    = now(),
           token_hash_alt = encode(extensions.digest(c.raw, 'sha256'), 'hex')
      FROM cand c
     -- reminded_at IS NULL TAMBIÉN acá: es lo que sostiene el exactly-once si
     -- dos corridas se pisan.
     WHERE o.id = c.id
       AND o.reminded_at IS NULL
    RETURNING o.id, o.gig_id, o.staff_profile_id, o.role, o.expires_at, c.raw
  )
  SELECT d.id, sp.email, sp.nombre, g.title, d.role, d.expires_at, d.raw
  FROM due d
  JOIN staff_app.gigs g ON g.id = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_offers_due_reminder(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_offers_due_reminder(int, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (9) fichaje_resumen_batch — el mail "quién fichó" al terminar un evento.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_fichaje_resumen_batch(int);

CREATE OR REPLACE FUNCTION public.staff_app_fichaje_resumen_batch(
  p_limit int  DEFAULT 20,
  p_org   uuid DEFAULT NULL
)
RETURNS TABLE(
  gig_id              uuid,
  gig_title           text,
  starts_at           timestamptz,
  ends_at             timestamptz,
  venue_name          text,
  staff_nombre        text,
  staff_apellido      text,
  role                text,
  check_in_at         timestamptz,
  check_out_at        timestamptz,
  check_in_distance_m double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := coalesce(p_org, staff_app.default_org_id());
  v_limit int  := least(greatest(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH due AS (
    SELECT g.id
    FROM staff_app.gigs g
    WHERE g.organization_id = v_org
      AND g.fichaje_resumen_enviado_at IS NULL
      AND g.starts_at IS NOT NULL
      AND coalesce(g.ends_at, g.starts_at + interval '12 hours') < now()
    ORDER BY g.starts_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcados AS (
    UPDATE staff_app.gigs g
       SET fichaje_resumen_enviado_at = now()
     WHERE g.id IN (SELECT d.id FROM due d)
    RETURNING g.id, g.title, g.starts_at, g.ends_at, g.venue_name
  )
  SELECT m.id, m.title, m.starts_at, m.ends_at, m.venue_name,
         sp.nombre, sp.apellido, c.role,
         a.check_in_at, a.check_out_at, a.check_in_distance_m
  FROM marcados m
  JOIN staff_app.crew c            ON c.gig_id = m.id
  JOIN staff_app.staff_profiles sp ON sp.id = c.staff_profile_id
  LEFT JOIN staff_app.attendance a ON a.gig_id = m.id
                                  AND a.staff_profile_id = c.staff_profile_id
  ORDER BY m.starts_at, sp.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_fichaje_resumen_batch(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_fichaje_resumen_batch(int, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (10) ⚠️ marcar_pago_listo — FUGA #2 de esta migración.
--
--      El server action gatea "¿es miembro?" y después llama con service_role.
--      Con dos productoras eso alcanzaba para que un admin de B marcara pagada
--      una propuesta de DER, porque la función filtraba por la constante y no
--      por la org DEL QUE HACE CLIC. Ahora recibe p_org, y el server action se
--      lo pasa (ver app/(portal)/pagos/pago-actions.ts en este mismo commit).
--      Sin p_org sigue trabajando sobre la org default: mismo comportamiento.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_marcar_pago_listo(uuid);

CREATE OR REPLACE FUNCTION public.staff_app_marcar_pago_listo(
  p_offer_id uuid,
  p_org      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := coalesce(p_org, staff_app.default_org_id());
  v_row record;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  -- Estampa solo si accepted y sin avisar: exactly-once en la misma sentencia.
  UPDATE staff_app.offers o
     SET pago_listo_at = now()
   WHERE o.id = p_offer_id
     AND o.organization_id = v_org
     AND o.status = 'accepted'
     AND o.pago_listo_at IS NULL
  RETURNING o.id, o.role, o.amount, o.gig_id, o.staff_profile_id
    INTO v_row;

  IF v_row.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM staff_app.offers o
                WHERE o.id = p_offer_id AND o.organization_id = v_org
                  AND o.status = 'accepted' AND o.pago_listo_at IS NOT NULL) THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    ELSIF EXISTS (SELECT 1 FROM staff_app.offers o
                   WHERE o.id = p_offer_id AND o.organization_id = v_org) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_accepted');
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
  END IF;

  -- OJO: NO se filtra por baja_at a propósito. Este mail es TRANSACCIONAL (su
  -- plata por su trabajo), no marketing.
  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'email', sp.email,
      'first_name', split_part(coalesce(sp.nombre, ''), ' ', 1),
      'staff_nombre', sp.nombre,
      'staff_apellido', sp.apellido,
      'gig_title', g.title,
      'role', v_row.role,
      'amount', v_row.amount
    )
    FROM staff_app.staff_profiles sp
    LEFT JOIN staff_app.gigs g ON g.id = v_row.gig_id
    WHERE sp.id = v_row.staff_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_marcar_pago_listo(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_pago_listo(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_marcar_pago_listo(uuid, uuid) IS
  'Estampa offers.pago_listo_at (solo si accepted y NULL: exactly-once) y devuelve los datos del mail "Tu pago está listo". La organización deja de ser una constante: llega en p_org desde el server action, que la saca de la membresía del que hace clic. Sin p_org resuelve a la organización default (retrocompatible). service_role EXECUTE solo.';

-- ---------------------------------------------------------------------------
-- (11) offer_notice — los datos de los dos mails que salen al responder.
--      La llave es el hash del token, que es único en toda la base: filtrar
--      además por una constante solo servía para que la productora nueva no
--      recibiera ningún aviso.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_offer_notice(text);

CREATE OR REPLACE FUNCTION public.staff_app_offer_notice(
  p_token text,
  p_org   uuid DEFAULT NULL
)
RETURNS TABLE(
  offer_id      uuid,
  gig_id        uuid,
  staff_email   text,
  first_name    text,
  role          text,
  amount        numeric,
  conditions    text,
  gig_title     text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  venue_name    text,
  staff_nombre  text,
  staff_apellido text,
  status        text,
  slots_total   int,
  crew_total    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.gig_id,
    sp.email,
    split_part(coalesce(sp.nombre, ''), ' ', 1),
    o.role,
    o.amount,
    o.conditions,
    g.title,
    g.starts_at,
    g.ends_at,
    g.venue_name,
    sp.nombre,
    sp.apellido,
    o.status,
    coalesce((SELECT sum(s.quantity)::int FROM staff_app.gig_slots s WHERE s.gig_id = o.gig_id), 0),
    coalesce((SELECT count(*)::int      FROM staff_app.crew c      WHERE c.gig_id = o.gig_id), 0)
  FROM staff_app.offers o
  JOIN staff_app.gigs g            ON g.id = o.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
  WHERE (p_org IS NULL OR o.organization_id = p_org)
    AND o.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_offer_notice(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_offer_notice(text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (12) ⚠️ log_payment_event — FUGA #1 de esta migración.
--
--      Antes: insert … values (<constante DER>, p_gig_id, …). El movimiento de
--      cobro de CUALQUIER evento quedaba escrito como de DER. La vista
--      public.staff_app_client_payment_events es security_invoker y la política
--      es is_org_member: DER veía los cobros de la otra productora (monto, id de
--      pago, estado) y la otra productora no veía los suyos.
--
--      Ahora: la organización se deduce DEL EVENTO que se está pagando. Si el
--      pago llega sin evento (external_reference vacío), recién ahí cae en
--      p_org / la org default, para no perder el movimiento.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_log_payment_event(uuid, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.staff_app_log_payment_event(
  p_gig_id uuid, p_payment_id text, p_status text, p_status_detail text, p_amount numeric,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org      uuid;
  v_del_gig  boolean := false;   -- ¿la org salió del evento o de un fallback?
BEGIN
  IF coalesce(btrim(p_payment_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_payment');
  END IF;

  -- La organización del EVENTO que se está pagando. Es el dato correcto: el
  -- cobro es de quien es el evento, no de quien tenga la constante.
  SELECT g.organization_id INTO v_org
    FROM staff_app.gigs g WHERE g.id = p_gig_id;
  v_del_gig := v_org IS NOT NULL;

  -- Pago sin evento asociado: no se pierde, va a la org indicada o a la default.
  IF v_org IS NULL THEN
    v_org := coalesce(p_org, staff_app.default_org_id());
  END IF;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  INSERT INTO staff_app.client_payment_events
    (organization_id, gig_id, mp_payment_id, status, status_detail, amount)
  VALUES (v_org, p_gig_id, p_payment_id, p_status, p_status_detail, p_amount)
  ON CONFLICT (mp_payment_id) DO UPDATE SET
    status          = excluded.status,
    status_detail   = excluded.status_detail,
    amount          = coalesce(excluded.amount, staff_app.client_payment_events.amount),
    gig_id          = coalesce(excluded.gig_id, staff_app.client_payment_events.gig_id),
    -- Si el primer aviso llegó sin evento y el segundo sí lo trae, el movimiento
    -- se muda a la organización correcta. Si el segundo TAMPOCO trae evento, no
    -- se toca: un fallback nunca puede mover un movimiento ya bien clasificado.
    organization_id = CASE WHEN v_del_gig THEN excluded.organization_id
                           ELSE staff_app.client_payment_events.organization_id END,
    updated_at      = now();
  RETURN jsonb_build_object('ok', true, 'organization_id', v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_log_payment_event(uuid, text, text, text, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_log_payment_event(uuid, text, text, text, numeric, uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_log_payment_event(uuid, text, text, text, numeric, uuid) IS
  'Registra el movimiento de cobro que avisa el webhook de Mercado Pago. La organización se DEDUCE DEL EVENTO que se paga (antes se escribía con la constante de SOMOS DER sin mirar de quién era el evento: con dos productoras, los cobros ajenos aparecían en el panel de DER). Si el pago llega sin evento, cae en p_org o en la organización default. Idempotente por mp_payment_id. service_role EXECUTE solo.';

-- ---------------------------------------------------------------------------
-- (13) mark_gig_paid — el webhook marca el evento cobrado. La llave es el id
--      del evento (external_reference de MP). p_org queda como guarda opcional.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_mark_gig_paid(uuid, text);

CREATE OR REPLACE FUNCTION public.staff_app_mark_gig_paid(
  p_gig_id uuid, p_payment_id text,
  p_org    uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  UPDATE staff_app.gigs SET
    client_payment_status = 'paid',
    client_payment_id = p_payment_id,
    client_paid_at = coalesce(client_paid_at, now())
  WHERE id = p_gig_id
    AND client_payment_status <> 'paid'
    AND (p_org IS NULL OR organization_id = p_org);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mark_gig_paid(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mark_gig_paid(uuid, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (14) mark_bienvenida / mark_perfil_confirmado — las dos marcas de la métrica
--      de "fichas vivas". Llave propia (id de ficha); p_org como guarda.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_mark_bienvenida(uuid);

CREATE OR REPLACE FUNCTION public.staff_app_mark_bienvenida(
  p_profile_id uuid,
  p_org        uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  UPDATE staff_app.staff_profiles
     SET bienvenida_enviada_at = now()
   WHERE id = p_profile_id
     AND bienvenida_enviada_at IS NULL
     AND (p_org IS NULL OR organization_id = p_org);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mark_bienvenida(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mark_bienvenida(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.staff_app_mark_perfil_confirmado(uuid);

CREATE OR REPLACE FUNCTION public.staff_app_mark_perfil_confirmado(
  p_profile_id uuid,
  p_org        uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  UPDATE staff_app.staff_profiles
     SET perfil_confirmado_at = now()
   WHERE id = p_profile_id
     AND perfil_confirmado_at IS NULL
     AND (p_org IS NULL OR organization_id = p_org);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mark_perfil_confirmado(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mark_perfil_confirmado(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- (15) cvs_pending / set_cv_data — el batch de extracción de CVs con IA.
--
--      No tenían NINGÚN filtro de organización (ni siquiera el literal): con dos
--      productoras, el script de DER se llevaba la lista de fichas y los links a
--      los CV de la otra. Pasan a la organización default por defecto.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_cvs_pending(int);

CREATE OR REPLACE FUNCTION public.staff_app_cvs_pending(
  p_limit int  DEFAULT 1000,
  p_org   uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, cv_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, staff_app
AS $$
  SELECT sp.id, sp.cv_url
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = coalesce(p_org, staff_app.default_org_id())
    AND sp.cv_url IS NOT NULL AND sp.cv_url <> ''
    AND sp.cv_url LIKE '%drive.google%'
    AND sp.cv_data IS NULL
  ORDER BY sp.created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.staff_app_cvs_pending(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_cvs_pending(int, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.staff_app_set_cv_data(uuid, jsonb, text, text, text[]);

CREATE OR REPLACE FUNCTION public.staff_app_set_cv_data(
  p_id                  uuid,
  p_cv_data             jsonb,
  p_experiencia_detalle text,
  p_anios               text,
  p_oficios             text[],
  p_org                 uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staff_app
AS $$
BEGIN
  UPDATE staff_app.staff_profiles sp SET
    cv_data = p_cv_data,
    experiencia_detalle = coalesce(nullif(sp.experiencia_detalle, ''), nullif(p_experiencia_detalle, '')),
    anios_experiencia = CASE
      WHEN sp.anios_experiencia IS NULL OR sp.anios_experiencia = '' THEN p_anios
      ELSE sp.anios_experiencia END,
    oficios = CASE
      WHEN sp.oficios IS NULL OR array_length(sp.oficios, 1) IS NULL THEN p_oficios
      ELSE sp.oficios END
  WHERE sp.id = p_id
    AND (p_org IS NULL OR sp.organization_id = p_org);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_cv_data(uuid, jsonb, text, text, text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_set_cv_data(uuid, jsonb, text, text, text[], uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- CIERRE: con esta migración, la constante 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
-- no queda escrita en NINGUNA función viva de la base. Vive en UNA fila:
-- staff_app.organizations.is_default = true. Verificación en el plan
-- (PLAN-DESHARCODEAR-ORG.md, § "Cómo se verifica").
-- ---------------------------------------------------------------------------
