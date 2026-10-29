-- 0091 · Fichar la entrada solo cerca del evento (turno noche B, 29/10/2026).
--
-- Hasta acá staff_app_check_in aceptaba la entrada en cualquier momento: una
-- persona confirmada podía tocar «Fichar entrada» cinco días antes del evento (o
-- un mes después) y, como la entrada que vale es la PRIMERA (coalesce en el
-- ON CONFLICT), ese toque sin querer quedaba fijo para siempre en la asistencia.
--
-- Ventana: desde 3 horas antes del inicio hasta 6 horas después del fin. Si el
-- evento no tiene fin cargado, se toma inicio + 12 horas. Si no tiene inicio,
-- no se limita (no hay contra qué comparar). Motivos nuevos: 'too_early' y
-- 'too_late', que la pantalla traduce. La salida no cambia: ya exige una
-- entrada abierta.
--
-- Solo reemplaza la función (mismos argumentos, mismos permisos).

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
  v_start timestamptz;
  v_end   timestamptz;
  v_sin_gps boolean := (p_lat IS NULL OR p_lng IS NULL);
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT v_sin_gps AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT o.staff_profile_id, o.organization_id INTO v_pid, v_org
    FROM staff_app.offers o
    JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
   WHERE o.gig_id = p_gig_id
     AND lower(sp.email) = v_email
     AND o.status = 'accepted'
   ORDER BY o.responded_at DESC NULLS LAST, o.sent_at DESC
   LIMIT 1;
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_confirmed'); END IF;

  SELECT venue_lat, venue_lng, starts_at, ends_at INTO v_glat, v_glng, v_start, v_end
    FROM staff_app.gigs WHERE id = p_gig_id AND organization_id = v_org;

  IF v_start IS NOT NULL THEN
    IF now() < v_start - interval '3 hours' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_early', 'opens_at', v_start - interval '3 hours');
    END IF;
    IF now() > coalesce(v_end, v_start + interval '12 hours') + interval '6 hours' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_late');
    END IF;
  END IF;

  IF NOT v_sin_gps AND v_glat IS NOT NULL AND v_glng IS NOT NULL THEN
    v_dist := 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(v_glat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(v_glat)) *
      power(sin(radians(v_glng - p_lng) / 2), 2)
    )));
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

REVOKE ALL ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_check_in(uuid, double precision, double precision) TO authenticated;
