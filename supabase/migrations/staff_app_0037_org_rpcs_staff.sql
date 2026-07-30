-- staff_app_0037_org_rpcs_staff
-- DESHARCODEAR LA ORGANIZACIÓN — parte 3 de 4: el lado PERSONAL.
--
-- Las 8 RPCs del portal del staff (ver mi perfil, mis propuestas, editar perfil,
-- subir CV, aceptar/rechazar, fichar entrada y salida). Todas empezaban igual:
--
--     select id into v_pid from staff_app.staff_profiles
--      where lower(email) = v_email and organization_id = 'aa29aa2f-…';
--
-- O sea: "buscá a esta persona SOLO en el pool de DER". Con dos productoras eso
-- rompe de dos formas distintas, y una es grave:
--
--   · ROTO: la persona que está en el pool de la productora B entra al portal y
--     el sistema le contesta "no sos staff". No ve sus propuestas, no puede
--     fichar, no puede editar su perfil.
--
--   · ⚠️ FUGA: staff_app_check_in resolvía la persona contra DER y después
--     ESTAMPABA el fichaje con la constante:
--         insert into attendance (organization_id, …) values (v_org /* DER */, …)
--     sin mirar de quién era el evento. Un fichaje de un evento de la productora
--     B quedaba escrito como de DER y aparecía en el tablero de asistencia de
--     DER (la vista es security_invoker y la política es is_org_member): DER veía
--     quién trabajó para otra productora, a qué hora y a cuántos metros del
--     predio. Y B no veía nada de lo suyo.
--
-- ── EL CAMBIO ───────────────────────────────────────────────────────────────
-- Acá la organización no se "resuelve": se DEDUCE del dato. La ficha de la
-- persona ya sabe de qué org es, y la propuesta ya sabe de qué org es. Así que:
--
--     v_org := la organization_id de la fila encontrada
--
-- Nunca más una constante. Y en check_in/check_out la persona se identifica por
-- la PROPUESTA ACEPTADA de ese evento, que es la única fuente de verdad de "esta
-- persona trabaja en este evento de esta productora".
--
-- Retrocompatible: con una sola organización, buscar "en cualquier org" y buscar
-- "en DER" devuelven exactamente la misma fila. El día que se aplica, el portal
-- se comporta igual.
--
-- ⚠️ Las funciones que reciben p_org lo llevan al final y con DEFAULT NULL: la
-- app sigue llamándolas igual, sin tocar TypeScript.

-- ---------------------------------------------------------------------------
-- (0) El helper que reemplaza al "select … where email = … and org = literal"
--     repetido en 8 funciones.
--
--     p_org NULL = en cualquier organización (hoy hay una sola, así que es
--     idéntico a lo de antes; mañana es lo correcto para el marketplace: la
--     persona es una sola aunque esté en el pool de dos productoras).
--     Desempate determinista: la ficha más vieja.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.my_staff_profile_id(p_org uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT sp.id
    FROM staff_app.staff_profiles sp
   WHERE coalesce(auth.email(), '') <> ''
     AND lower(sp.email) = lower(auth.email())
     AND (p_org IS NULL OR sp.organization_id = p_org)
   ORDER BY sp.created_at, sp.id
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION staff_app.my_staff_profile_id(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.my_staff_profile_id(uuid) IS
  'La ficha del staff autenticado, buscada por su propio auth.email(). p_org NULL = en cualquier organización (con una sola org es idéntico al filtro hardcodeado que había antes); con p_org, solo en esa. Desempate determinista por la ficha más antigua. Reemplaza el "where email = … and organization_id = ''aa29aa2f-…''" que estaba repetido en 8 RPCs.';

-- ---------------------------------------------------------------------------
-- (1) my_staff_profile — mi ficha.
--     Suma organization_id al jsonb devuelto (aditivo: quien no lo lea, igual).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_my_staff_profile();

CREATE OR REPLACE FUNCTION public.staff_app_my_staff_profile(p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(p_org);
  r     staff_app.staff_profiles%rowtype;
BEGIN
  IF v_pid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM staff_app.staff_profiles WHERE id = v_pid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id, 'nombre', r.nombre, 'apellido', r.apellido,
    'email', r.email, 'telefono', r.telefono, 'documento', r.documento,
    'fecha_nacimiento', r.fecha_nacimiento,
    'oficios', r.oficios, 'oficios_otro', r.oficios_otro,
    'provincia', r.provincia, 'ciudad', r.ciudad, 'pais_residencia', r.pais_residencia,
    'donde_trabajar', r.donde_trabajar, 'situacion_legal', r.situacion_legal,
    'disponibilidad_aviso', r.disponibilidad_aviso,
    'disponibilidad_finde', r.disponibilidad_finde,
    'disponibilidad_viajar', r.disponibilidad_viajar,
    'movilidad_propia', r.movilidad_propia,
    'experiencia', r.experiencia, 'anios_experiencia', r.anios_experiencia,
    'experiencia_detalle', r.experiencia_detalle, 'eventos_trabajados', r.eventos_trabajados,
    'linkedin_url', r.linkedin_url, 'portfolio_url', r.portfolio_url,
    'cv_url', r.cv_url, 'motivacion', r.motivacion,
    'organization_id', r.organization_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_my_staff_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_my_staff_profile(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (2) my_staff_offers — mis propuestas.
--
--     DECISIÓN CONSCIENTE: sigue devolviendo las propuestas de UNA ficha (la que
--     resuelve my_staff_profile_id), no las de todas las fichas de esa persona.
--     Mostrarle a alguien las propuestas de las dos productoras en una sola
--     pantalla es una decisión de PRODUCTO de la Fase 1 del marketplace, no algo
--     que deba colarse en una migración de deuda técnica. Hoy el resultado es
--     idéntico al de antes.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_my_staff_offers();

CREATE OR REPLACE FUNCTION public.staff_app_my_staff_offers(p_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(p_org);
BEGIN
  IF v_pid IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'role', o.role, 'status', o.status, 'amount', o.amount,
      'conditions', o.conditions, 'expires_at', o.expires_at,
      'sent_at', o.sent_at, 'responded_at', o.responded_at,
      'gig_id', o.gig_id, 'gig_title', g.title,
      'gig_starts_at', g.starts_at, 'gig_ends_at', g.ends_at,
      'gig_venue', g.venue_name,
      'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at
    ) ORDER BY g.starts_at ASC NULLS LAST)
    FROM staff_app.offers o
    LEFT JOIN staff_app.gigs g ON g.id = o.gig_id
    LEFT JOIN staff_app.attendance a
           ON a.gig_id = o.gig_id AND a.staff_profile_id = v_pid
    WHERE o.staff_profile_id = v_pid
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_my_staff_offers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_my_staff_offers(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (3) update_my_staff_profile — editar mi perfil.
--     NUNCA toca email / documento de identidad como llave / organization_id /
--     rating / notas internas: eso no cambia.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.staff_app_update_my_staff_profile(
  p_nombre text, p_apellido text, p_telefono text, p_documento text,
  p_fecha_nacimiento date, p_pais_residencia text, p_provincia text, p_ciudad text,
  p_donde_trabajar text[], p_situacion_legal text,
  p_oficios text[], p_oficios_otro text,
  p_experiencia boolean, p_anios_experiencia text, p_experiencia_detalle text,
  p_disponibilidad_finde boolean, p_disponibilidad_viajar boolean, p_movilidad_propia boolean,
  p_disponibilidad_aviso text,
  p_linkedin_url text, p_portfolio_url text, p_motivacion text,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid;
BEGIN
  IF coalesce(auth.email(), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  v_pid := staff_app.my_staff_profile_id(p_org);
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_staff'); END IF;

  UPDATE staff_app.staff_profiles SET
    nombre               = coalesce(nullif(btrim(p_nombre), ''), nombre),
    apellido             = nullif(btrim(p_apellido), ''),
    telefono             = nullif(btrim(p_telefono), ''),
    documento            = nullif(btrim(p_documento), ''),
    fecha_nacimiento     = p_fecha_nacimiento,
    pais_residencia      = nullif(btrim(p_pais_residencia), ''),
    provincia            = nullif(btrim(p_provincia), ''),
    ciudad               = nullif(btrim(p_ciudad), ''),
    donde_trabajar       = CASE WHEN p_donde_trabajar IS NULL THEN donde_trabajar ELSE p_donde_trabajar END,
    situacion_legal      = nullif(btrim(p_situacion_legal), ''),
    oficios              = CASE WHEN p_oficios IS NULL THEN oficios ELSE p_oficios END,
    oficios_otro         = nullif(btrim(p_oficios_otro), ''),
    experiencia          = coalesce(p_experiencia, experiencia),
    anios_experiencia    = nullif(btrim(p_anios_experiencia), ''),
    experiencia_detalle  = nullif(btrim(p_experiencia_detalle), ''),
    disponibilidad_finde  = coalesce(p_disponibilidad_finde, disponibilidad_finde),
    disponibilidad_viajar = coalesce(p_disponibilidad_viajar, disponibilidad_viajar),
    movilidad_propia      = coalesce(p_movilidad_propia, movilidad_propia),
    disponibilidad_aviso = nullif(btrim(p_disponibilidad_aviso), ''),
    linkedin_url         = nullif(btrim(p_linkedin_url), ''),
    portfolio_url        = nullif(btrim(p_portfolio_url), ''),
    motivacion           = nullif(btrim(p_motivacion), '')
  WHERE id = v_pid;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_pid);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text, uuid
) TO authenticated;

-- ---------------------------------------------------------------------------
-- (4) update_my_cv — guardar el CV propio.
--     El prefijo del path sigue atado al id de la ficha: nadie puede apuntar al
--     CV de otro.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_update_my_cv(text);

CREATE OR REPLACE FUNCTION public.staff_app_update_my_cv(
  p_cv_url text,
  p_org    uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid    uuid;
  v_prefix text;
BEGIN
  IF coalesce(auth.email(), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  v_pid := staff_app.my_staff_profile_id(p_org);
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_staff'); END IF;

  v_prefix := 'staff-cvs/' || v_pid::text || '_';
  IF p_cv_url IS NULL OR left(p_cv_url, length(v_prefix)) <> v_prefix THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_path');
  END IF;

  UPDATE staff_app.staff_profiles SET cv_url = nullif(btrim(p_cv_url), '') WHERE id = v_pid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_update_my_cv(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_update_my_cv(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (5) accept_my_offer — aceptar desde la cuenta.
--
--     La firma NO cambia (alcanza REPLACE). Lo que cambia es de dónde sale la
--     org: ya no de una constante, sino de la PROPUESTA. La persona se valida
--     por su mail contra la ficha dueña de esa propuesta, que es lo mismo que
--     hacía antes pero sin presuponer la productora.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_accept_my_offer(p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  v_o     staff_app.offers%rowtype;
  v_crew  uuid;
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  -- La propuesta tiene que ser de una ficha con MI mail, esté en la org que esté.
  -- for update: si un decline concurrente toca esta misma oferta, se serializa.
  SELECT o.* INTO v_o
    FROM staff_app.offers o
    JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
   WHERE o.id = p_offer_id
     AND lower(sp.email) = v_email
     AND o.status IN ('sent','viewed')
     AND o.expires_at > now()
     FOR UPDATE OF o;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); END IF;

  -- El crew se estampa con la org DE LA PROPUESTA (esto ya estaba bien).
  INSERT INTO staff_app.crew (organization_id, gig_id, staff_profile_id, role)
  VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  ON CONFLICT (gig_id, staff_profile_id) DO NOTHING
  RETURNING id INTO v_crew;
  IF v_crew IS NULL THEN
    SELECT id INTO v_crew FROM staff_app.crew
     WHERE gig_id = v_o.gig_id AND staff_profile_id = v_o.staff_profile_id;
  END IF;

  UPDATE staff_app.offers SET status = 'accepted', responded_at = now() WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'crew_id', v_crew);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_accept_my_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_accept_my_offer(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (6) decline_my_offer — igual, sin presuponer productora.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_decline_my_offer(p_offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  UPDATE staff_app.offers o
     SET status = 'declined', responded_at = now()
   WHERE o.id = p_offer_id
     AND o.status IN ('sent','viewed')
     AND EXISTS (
       SELECT 1 FROM staff_app.staff_profiles sp
        WHERE sp.id = o.staff_profile_id AND lower(sp.email) = v_email
     );
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_decline_my_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_decline_my_offer(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (7) check_in — ⚠️ ACÁ ESTABA LA FUGA.
--
--     Antes: identificaba a la persona contra el pool de DER y escribía el
--     fichaje con organization_id = DER, mirara de quién fuera el evento.
--     Ahora: la persona y la organización salen de la PROPUESTA ACEPTADA de ese
--     evento. El fichaje queda en la org dueña del evento, siempre.
--
--     La firma no cambia: /fichaje sigue llamándola igual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_check_in(
  p_gig_id uuid, p_lat double precision, p_lng double precision
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid;
  v_pid   uuid;
  v_glat  double precision;
  v_glng  double precision;
  v_dist  double precision;
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_coords');
  END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  -- Quién soy EN ESTE EVENTO y de qué organización es: la propuesta aceptada es
  -- la única fuente de verdad de las dos cosas.
  SELECT o.staff_profile_id, o.organization_id INTO v_pid, v_org
    FROM staff_app.offers o
    JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
   WHERE o.gig_id = p_gig_id
     AND lower(sp.email) = v_email
     AND o.status = 'accepted'
   ORDER BY o.responded_at DESC NULLS LAST, o.sent_at DESC
   LIMIT 1;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_confirmed'); END IF;

  -- Distancia al predio (metros), solo si el evento tiene ubicación cargada.
  SELECT venue_lat, venue_lng INTO v_glat, v_glng
    FROM staff_app.gigs WHERE id = p_gig_id AND organization_id = v_org;
  IF v_glat IS NOT NULL AND v_glng IS NOT NULL THEN
    v_dist := 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(v_glat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(v_glat)) *
      power(sin(radians(v_glng - p_lng) / 2), 2)
    )));
  ELSE
    v_dist := NULL;
  END IF;

  INSERT INTO staff_app.attendance
    (organization_id, staff_profile_id, gig_id, check_in_at, check_in_lat, check_in_lng, check_in_distance_m)
  VALUES (v_org, v_pid, p_gig_id, now(), p_lat, p_lng, v_dist)
  ON CONFLICT (staff_profile_id, gig_id) DO UPDATE SET
    check_in_at         = coalesce(staff_app.attendance.check_in_at, excluded.check_in_at),
    check_in_lat        = coalesce(staff_app.attendance.check_in_lat, excluded.check_in_lat),
    check_in_lng        = coalesce(staff_app.attendance.check_in_lng, excluded.check_in_lng),
    check_in_distance_m = coalesce(staff_app.attendance.check_in_distance_m, excluded.check_in_distance_m);

  RETURN jsonb_build_object('ok', true, 'check_in_at', now(), 'distance_m', v_dist);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) TO authenticated;

COMMENT ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) IS
  'Fichaje de entrada con geofencing. La persona Y la organización salen de la PROPUESTA ACEPTADA de ese evento, ya no de un literal: el fichaje se estampa siempre en la organización dueña del evento. Antes se estampaba con la constante de SOMOS DER sin mirar de quién era el evento, lo que con dos productoras mandaba fichajes ajenos al tablero de DER. Devuelve la distancia al predio en metros (NULL si el evento no tiene ubicación). authenticated only.';

-- ---------------------------------------------------------------------------
-- (8) check_out — misma corrección: cierra el fichaje propio sin presuponer org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_check_out(
  p_gig_id uuid, p_lat double precision, p_lng double precision
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_coords');
  END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  -- Solo cierra un fichaje MÍO (la ficha lleva mi mail), abierto y sin salida.
  UPDATE staff_app.attendance a SET
    check_out_at  = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng
  WHERE a.gig_id = p_gig_id
    AND a.check_in_at IS NOT NULL
    AND a.check_out_at IS NULL
    AND EXISTS (
      SELECT 1 FROM staff_app.staff_profiles sp
       WHERE sp.id = a.staff_profile_id AND lower(sp.email) = v_email
    );

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_check_in_or_already_out'); END IF;
  RETURN jsonb_build_object('ok', true, 'check_out_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_check_out(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_check_out(uuid, double precision, double precision) TO authenticated;
