-- 0101 · No se puede mandar una oferta para un evento que ya terminó.
--
-- Desde la 0099 una oferta de un evento terminado no se puede aceptar. Sin este
-- freno, la productora podía mandarla igual: a la persona le llegaba un mail con
-- un botón que no anda. Ahora staff_app_create_offer responde 'gig_terminado'
-- (fin, o inicio + 12 h, ya pasado), con evento existente o creado en el momento,
-- antes de crear nada. Solo reemplaza la función; permisos iguales.

CREATE OR REPLACE FUNCTION public.staff_app_create_offer(p_staff_profile_id uuid, p_role text, p_gig_id uuid DEFAULT NULL::uuid, p_gig_title text DEFAULT NULL::text, p_gig_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_gig_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_gig_venue text DEFAULT NULL::text, p_amount numeric DEFAULT NULL::numeric, p_conditions text DEFAULT NULL::text, p_expires_in_days integer DEFAULT 7, p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_org      uuid := staff_app.resolve_org(p_org);
  v_gig      uuid := p_gig_id;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  v_offer_id uuid;
  v_expires  timestamptz := now() + make_interval(days => greatest(1, p_expires_in_days));
  v_starts   timestamptz;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(btrim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_required');
  END IF;

  IF v_gig IS NULL THEN
    IF coalesce(btrim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    IF p_gig_starts_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_starts_at_required');
    END IF;
    -- 0101: un evento que ya terminó no se puede aceptar (0099): no se manda.
    IF coalesce(p_gig_ends_at, p_gig_starts_at + interval '12 hours') < now() THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_terminado');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, btrim(p_gig_title), p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    SELECT starts_at INTO v_starts FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
    IF v_starts IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_starts_at_required');
    END IF;
    -- 0101: ídem con un evento ya cargado.
    IF EXISTS (SELECT 1 FROM gigs WHERE id = v_gig
                AND coalesce(ends_at, starts_at + interval '12 hours') < now()) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_terminado');
    END IF;
  END IF;

  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  INSERT INTO offers (organization_id, gig_id, staff_profile_id, role, amount, conditions,
                      token_hash, expires_at)
  VALUES (v_org, v_gig, p_staff_profile_id, btrim(p_role), p_amount, p_conditions,
          v_hash, v_expires)
  RETURNING id INTO v_offer_id;

  RETURN jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'gig_id', v_gig,
                            'token', v_raw, 'expires_at', v_expires,
                            'organization_id', v_org);
END;
$function$;
