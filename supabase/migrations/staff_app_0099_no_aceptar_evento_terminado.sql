-- 0099 · Una oferta de un evento que YA TERMINÓ no se puede aceptar.
--
-- La oferta vence a los 7 días de mandada (expires_at), pero el evento puede ser
-- antes: el 30/10 la oferta de prueba de Franco (evento 29/10 20:25 a 00:25)
-- seguía «para responder» en su panel y se podía aceptar con el evento terminado.
-- Ahora las dos puertas de aceptar (por link y desde el panel) frenan si el evento
-- terminó (fin cargado, o inicio + 12 h si no hay fin). Responden lo mismo que
-- una oferta vencida ('invalid_or_expired'), así las pantallas no cambian.
-- Solo reemplaza las dos funciones; los permisos (GRANT/REVOKE) se conservan.

CREATE OR REPLACE FUNCTION staff_app.accept_offer(p_token text, p_user_agent text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_o    offers%ROWTYPE;
  v_crew uuid;
BEGIN
  SELECT * INTO v_o
    FROM offers
   -- 0048: el token del mail original O el del recordatorio (0030). Mismo
   -- universo que get_public_offer, que ya los aceptaba a los dos.
   WHERE (token_hash = v_hash OR token_hash_alt = v_hash)
     AND status IN ('sent','viewed')
     AND expires_at > now()
     -- 0099: un evento que ya terminó no se puede aceptar (la oferta vence a los
     -- 7 días y el evento puede pasar antes). Sin fecha cargada, no se frena.
     AND NOT EXISTS (SELECT 1 FROM gigs g WHERE g.id = offers.gig_id
                      AND coalesce(g.ends_at, g.starts_at + interval '12 hours') < now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  INSERT INTO crew (organization_id, gig_id, staff_profile_id, role)
  VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  ON CONFLICT (gig_id, staff_profile_id) DO NOTHING
  RETURNING id INTO v_crew;

  IF v_crew IS NULL THEN
    SELECT id INTO v_crew FROM crew
     WHERE gig_id = v_o.gig_id AND staff_profile_id = v_o.staff_profile_id;
  END IF;

  UPDATE offers SET status = 'accepted', responded_at = now() WHERE id = v_o.id;

  RETURN jsonb_build_object('ok', true, 'crew_id', v_crew);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_accept_my_offer(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
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
     -- 0099: un evento que ya terminó no se puede aceptar.
     AND NOT EXISTS (SELECT 1 FROM staff_app.gigs g WHERE g.id = o.gig_id
                      AND coalesce(g.ends_at, g.starts_at + interval '12 hours') < now())
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
$function$;
