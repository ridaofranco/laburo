-- staff_app_0048_aceptar_con_token_del_recordatorio
-- EL MAIL QUE EXISTE PARA RESCATAR RESPUESTAS ERA EL QUE LAS PERDIA.
--
-- ── EL BUG ───────────────────────────────────────────────────────────────────
--
-- La 0030 agrego un SEGUNDO token para el mail "tu propuesta esta por vencer",
-- guardado en offers.token_hash_alt, para que ese recordatorio pudiera llevar
-- boton propio sin tocar el token original. El cron lo manda:
-- app/api/cron/reminders/route.ts arma el link con `o/${offer.token}`.
--
-- La lectura se actualizo: get_public_offer matchea `token_hash = v_hash OR
-- token_hash_alt = v_hash` (0030). O sea la persona abre el recordatorio y VE la
-- oferta bien: el evento, la fecha, el monto.
--
-- Pero accept_offer y decline_offer nunca se enteraron del segundo token: siguen
-- matcheando solo `token_hash = v_hash`. Toca "Aceptar" y le contesta
-- invalid_or_expired, o sea "este link no es valido".
--
-- Verificado contra produccion el 1/8/2026 leyendo el cuerpo vivo de las tres
-- funciones: get_public_offer nombra token_hash_alt, accept_offer y
-- decline_offer no.
--
-- Es la peor forma de fallar: el recordatorio existe justamente para las
-- propuestas que estan por vencer, o sea le llega a la persona que todavia no
-- contesto, la convence, y ahi la choca contra la pared. Esa oferta vence y
-- Franco lo lee como "no contesto".
--
-- ── EL FIX ───────────────────────────────────────────────────────────────────
--
-- accept_offer y decline_offer aceptan CUALQUIERA de los dos tokens de la misma
-- oferta, igual que la lectura. No se agrega ningun token nuevo ni se cambia
-- como se generan: los dos ya existen, ya se guardan hasheados y ya tienen
-- indice unico. Lo unico que cambia es que la escritura reconoce el mismo
-- universo de tokens que la lectura.
--
-- El resto de la funcion queda EXACTAMENTE igual (copiado del cuerpo vivo en
-- produccion, no del archivo): mismas guardas de status y expiracion, mismo
-- INSERT idempotente en crew, mismo retorno. Firma identica, asi que
-- CREATE OR REPLACE alcanza y los wrappers publicos de la 0009
-- (public.staff_app_accept_offer / _decline_offer, granteados a anon) siguen
-- funcionando sin tocarse.

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
     AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  INSERT INTO crew (organization_id, gig_id, staff_profile_id, role)
  VALUES (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  ON CONFLICT (gig_id, staff_profile_id) DO NOTHING
  RETURNING id INTO v_crew;

  IF v_crew IS NULL THEN               -- prior crew row (idempotent path)
    SELECT id INTO v_crew FROM crew
     WHERE gig_id = v_o.gig_id AND staff_profile_id = v_o.staff_profile_id;
  END IF;

  UPDATE offers SET status = 'accepted', responded_at = now() WHERE id = v_o.id;

  RETURN jsonb_build_object('ok', true, 'crew_id', v_crew);
END;
$function$;

CREATE OR REPLACE FUNCTION staff_app.decline_offer(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_o    offers%ROWTYPE;
BEGIN
  SELECT * INTO v_o
    FROM offers
   -- 0048: idem accept_offer. Poder decir que NO desde el recordatorio importa
   -- tanto como poder decir que si: le libera el lugar a otra persona.
   WHERE (token_hash = v_hash OR token_hash_alt = v_hash)
     AND status IN ('sent','viewed')
     AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  END IF;

  UPDATE offers SET status = 'declined', responded_at = now() WHERE id = v_o.id;

  RETURN jsonb_build_object('ok', true, 'status', 'declined');
END;
$function$;

COMMENT ON FUNCTION staff_app.accept_offer(text, text) IS
  'Aceptar una oferta por token. Desde la 0048 acepta el token del mail original O el del recordatorio (token_hash_alt, 0030): antes el boton del recordatorio siempre respondia invalid_or_expired. Guardas de status y expiracion sin cambios.';
COMMENT ON FUNCTION staff_app.decline_offer(text) IS
  'Rechazar una oferta por token. Desde la 0048 acepta el token del mail original O el del recordatorio (token_hash_alt, 0030).';
