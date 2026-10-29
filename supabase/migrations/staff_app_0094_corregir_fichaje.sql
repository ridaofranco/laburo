-- 0094 · La productora corrige a mano una entrada o una salida (turno noche B, 29/10/2026).
--
-- Desde la 0091/0092 la entrada se ficha desde 3 h antes del inicio y la salida
-- hasta 12 h después del fin. Quien se olvida queda «sin registrar» y la
-- productora no tenía cómo cargarlo. Esta función se lo deja hacer, dejando
-- constancia de que fue una corrección (quién, cuándo y por qué).
--
-- Aditiva: tres columnas nuevas en attendance y una función nueva. Solo para
-- is_org_writer de la organización DEL EVENTO; exige que la persona tenga la
-- oferta aceptada en ese evento. Crea la fila si la persona nunca fichó.

ALTER TABLE staff_app.attendance
  ADD COLUMN IF NOT EXISTS corregido_por    uuid,
  ADD COLUMN IF NOT EXISTS corregido_at     timestamptz,
  ADD COLUMN IF NOT EXISTS corregido_motivo text;

CREATE OR REPLACE FUNCTION public.staff_app_corregir_fichaje(
  p_gig_id uuid,
  p_staff_profile_id uuid,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_motivo text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org uuid;
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;

  SELECT organization_id INTO v_org FROM staff_app.gigs WHERE id = p_gig_id;
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_app.offers o
     WHERE o.gig_id = p_gig_id AND o.staff_profile_id = p_staff_profile_id
       AND o.organization_id = v_org AND o.status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_confirmed');
  END IF;

  IF p_check_in_at IS NULL AND p_check_out_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nada_que_corregir');
  END IF;
  IF p_check_in_at IS NOT NULL AND p_check_out_at IS NOT NULL AND p_check_out_at <= p_check_in_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'salida_antes_de_entrada');
  END IF;
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_motivo');
  END IF;

  INSERT INTO staff_app.attendance
    (organization_id, staff_profile_id, gig_id, check_in_at, check_out_at,
     corregido_por, corregido_at, corregido_motivo)
  VALUES (v_org, p_staff_profile_id, p_gig_id, p_check_in_at, p_check_out_at,
          auth.uid(), now(), v_motivo)
  ON CONFLICT (staff_profile_id, gig_id) DO UPDATE SET
    check_in_at      = coalesce(excluded.check_in_at, staff_app.attendance.check_in_at),
    check_out_at     = coalesce(excluded.check_out_at, staff_app.attendance.check_out_at),
    corregido_por    = excluded.corregido_por,
    corregido_at     = excluded.corregido_at,
    corregido_motivo = excluded.corregido_motivo;

  -- La salida corregida tiene que seguir siendo posterior a la entrada que quedó.
  IF EXISTS (
    SELECT 1 FROM staff_app.attendance a
     WHERE a.gig_id = p_gig_id AND a.staff_profile_id = p_staff_profile_id
       AND a.check_in_at IS NOT NULL AND a.check_out_at IS NOT NULL
       AND a.check_out_at <= a.check_in_at
  ) THEN
    RAISE EXCEPTION 'salida_antes_de_entrada';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_corregir_fichaje(uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_corregir_fichaje(uuid, uuid, timestamptz, timestamptz, text) TO authenticated;

-- La vista del tablero suma, al final, cuándo se corrigió (para mostrar «corregido»).
CREATE OR REPLACE VIEW public.staff_app_attendance WITH (security_invoker = true) AS
 SELECT a.id,
    a.organization_id,
    a.gig_id,
    a.staff_profile_id,
    a.check_in_at,
    a.check_in_lat,
    a.check_in_lng,
    a.check_out_at,
    a.check_out_lat,
    a.check_out_lng,
    p.nombre AS staff_nombre,
    p.apellido AS staff_apellido,
    a.check_in_distance_m,
    a.corregido_at
   FROM staff_app.attendance a
     LEFT JOIN staff_app.staff_profiles p ON p.id = a.staff_profile_id;
