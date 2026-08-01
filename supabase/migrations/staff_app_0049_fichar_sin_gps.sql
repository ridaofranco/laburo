-- staff_app_0049_fichar_sin_gps
-- SIN SEÑAL NO SE PODIA FICHAR, Y EL ERROR DECIA "no_coords".
--
-- ── EL BUG ───────────────────────────────────────────────────────────────────
--
-- check_in y check_out cortan con `no_coords` si p_lat o p_lng vienen en NULL
-- (0021, arrastrado por la 0037). Y el cliente manda NULL en dos casos que en un
-- evento son lo normal, no la excepcion (app/fichaje/fichaje-client.tsx:35 y
-- :40): cuando el navegador no tiene geolocalizacion disponible, y cuando la
-- persona no dio el permiso o el GPS no engancha.
--
-- O sea: en un galpon, en un subsuelo, en un predio sin señal, o con alguien que
-- toco "no permitir" una vez hace meses, no se puede fichar. Y lo que ve es el
-- codigo crudo, "no_coords", que no le dice ni que revise el permiso.
--
-- Verificado contra produccion el 1/8/2026 leyendo el cuerpo vivo de las dos
-- funciones.
--
-- ── LA DECISION ──────────────────────────────────────────────────────────────
--
-- El GPS estaba puesto como PRUEBA DE PRESENCIA, y esa intencion es correcta.
-- Pero el precio que se estaba pagando es que la asistencia no quede registrada,
-- que es peor: sin fichaje no hay horas, y sin horas la discusion del pago pasa
-- a ser de memoria y por WhatsApp.
--
-- Entonces el fichaje sin ubicacion se PERMITE y se MARCA, no se bloquea. La
-- ficha queda con check_in_lat/lng en NULL y check_in_distance_m en NULL, que es
-- exactamente "fichó, no sabemos donde". La productora lo ve distinto de un
-- fichaje con ubicacion confirmada, y la persona no se queda afuera.
--
-- Lo que NO se afloja: hay que estar autenticado, hay que ser staff, y hay que
-- tener una propuesta ACEPTADA para ese evento. Esas tres guardas quedan
-- intactas. Y si las coordenadas VIENEN pero son imposibles, se sigue
-- rechazando con bad_coords: eso es un cliente mintiendo, no una persona sin
-- señal.
--
-- El ON CONFLICT ya usa coalesce, asi que si despues ficha de nuevo con GPS
-- (porque engancho señal), la ubicacion se completa sin pisar la hora original.

CREATE OR REPLACE FUNCTION public.staff_app_check_in(p_gig_id uuid, p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid;
  v_pid   uuid;
  v_glat  double precision;
  v_glng  double precision;
  v_dist  double precision;
  v_sin_gps boolean := (p_lat IS NULL OR p_lng IS NULL);
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  -- 0049: sin coordenadas YA NO se rechaza. Se ficha igual y se marca.
  -- Coordenadas imposibles si se siguen rechazando: eso no es falta de señal.
  IF NOT v_sin_gps AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
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

  -- Distancia al predio (metros), solo si hay ubicación de la persona Y del evento.
  IF NOT v_sin_gps THEN
    SELECT venue_lat, venue_lng INTO v_glat, v_glng
      FROM staff_app.gigs WHERE id = p_gig_id AND organization_id = v_org;
    IF v_glat IS NOT NULL AND v_glng IS NOT NULL THEN
      v_dist := 2 * 6371000 * asin(least(1, sqrt(
        power(sin(radians(v_glat - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(v_glat)) *
        power(sin(radians(v_glng - p_lng) / 2), 2)
      )));
    END IF;
  END IF;

  INSERT INTO staff_app.attendance
    (organization_id, staff_profile_id, gig_id, check_in_at, check_in_lat, check_in_lng, check_in_distance_m)
  VALUES (v_org, v_pid, p_gig_id, now(), p_lat, p_lng, v_dist)
  ON CONFLICT (staff_profile_id, gig_id) DO UPDATE SET
    check_in_at         = coalesce(staff_app.attendance.check_in_at, excluded.check_in_at),
    check_in_lat        = coalesce(staff_app.attendance.check_in_lat, excluded.check_in_lat),
    check_in_lng        = coalesce(staff_app.attendance.check_in_lng, excluded.check_in_lng),
    check_in_distance_m = coalesce(staff_app.attendance.check_in_distance_m, excluded.check_in_distance_m);

  RETURN jsonb_build_object('ok', true, 'check_in_at', now(), 'distance_m', v_dist, 'sin_gps', v_sin_gps);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_check_out(p_gig_id uuid, p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  v_sin_gps boolean := (p_lat IS NULL OR p_lng IS NULL);
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  -- 0049: idem check_in. Cerrar la jornada importa MAS que ubicarla: si la
  -- salida no se puede fichar, las horas trabajadas quedan sin registro.
  IF NOT v_sin_gps AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
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
  RETURN jsonb_build_object('ok', true, 'check_out_at', now(), 'sin_gps', v_sin_gps);
END;
$function$;

COMMENT ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) IS
  'Fichar entrada. Desde la 0049 se puede fichar SIN ubicacion (galpon sin señal, permiso denegado): la ficha queda con lat/lng y distancia en NULL y la respuesta trae sin_gps=true. Se siguen exigiendo sesion, ser staff y tener la propuesta ACEPTADA para ese evento; y coordenadas imposibles se siguen rechazando con bad_coords.';
COMMENT ON FUNCTION public.staff_app_check_out(uuid, double precision, double precision) IS
  'Fichar salida. Desde la 0049 se puede fichar SIN ubicacion, igual que la entrada: sin salida fichada no hay horas trabajadas.';
