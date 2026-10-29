-- 0092 · La salida se ficha hasta 12 horas después del fin del evento (turno noche B, 29/10/2026).
--
-- Misma familia que la 0091. Si alguien se olvidaba de fichar la salida, la
-- podía marcar días después y la asistencia quedaba con una jornada de 72 horas
-- (el panel del staff y la productora suman horas con check_in/check_out).
-- Tope: fin del evento + 12 horas (sin fin cargado: inicio + 12 h + 12 h). Sin
-- inicio cargado, no se limita. Motivo nuevo 'too_late_out', que la pantalla
-- traduce a «avisale a la productora a qué hora terminaste».
--
-- Solo reemplaza la función (mismos argumentos, mismos permisos).

CREATE OR REPLACE FUNCTION public.staff_app_check_out(p_gig_id uuid, p_lat double precision, p_lng double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_email text := lower(coalesce(auth.email(), ''));
  v_sin_gps boolean := (p_lat IS NULL OR p_lng IS NULL);
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  IF v_email = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT v_sin_gps AND (p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  IF staff_app.my_staff_profile_id(NULL) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT starts_at, ends_at INTO v_start, v_end FROM staff_app.gigs WHERE id = p_gig_id;
  IF v_start IS NOT NULL
     AND now() > coalesce(v_end, v_start + interval '12 hours') + interval '12 hours' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late_out');
  END IF;

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

REVOKE ALL ON FUNCTION public.staff_app_check_out(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_check_out(uuid, double precision, double precision) TO authenticated;
