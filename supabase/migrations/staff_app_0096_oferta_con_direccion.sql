-- 0096 · La oferta por link muestra la dirección del evento (turno noche B, 29/10/2026).
--
-- /o/<token> decía «Lugar: Oficina» y nada más. Para decidir si acepta, la
-- persona necesita saber dónde queda (la distancia es lo primero que mira).
-- Aditiva: misma firma y mismo comportamiento, una clave más en `gig`.
-- CREATE OR REPLACE conserva los permisos (anon sí: es la puerta del link).

CREATE OR REPLACE FUNCTION staff_app.get_public_offer(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_rec  record;
BEGIN
  SELECT o.id, o.role, o.amount, o.conditions, o.status, o.expires_at,
         g.title AS gig_title, g.starts_at, g.ends_at, g.venue_name, g.venue_address,
         org.name AS org_name,
         split_part(sp.nombre, ' ', 1) AS first_name
    INTO v_rec
    FROM offers o
    JOIN gigs g            ON g.id   = o.gig_id
    JOIN organizations org ON org.id = o.organization_id
    JOIN staff_profiles sp ON sp.id  = o.staff_profile_id
   WHERE o.token_hash = v_hash
      OR o.token_hash_alt = v_hash;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_rec.status = 'sent' THEN
    UPDATE offers SET status = 'viewed', viewed_at = now() WHERE id = v_rec.id;
    v_rec.status := 'viewed';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'offer', jsonb_build_object(
       'role',       v_rec.role,
       'amount',     v_rec.amount,
       'conditions', v_rec.conditions,
       'status',     v_rec.status,
       'expires_at', v_rec.expires_at),
    'gig', jsonb_build_object(
       'title',     v_rec.gig_title,
       'starts_at', v_rec.starts_at,
       'ends_at',   v_rec.ends_at,
       'venue',     v_rec.venue_name,
       -- 0096: para decidir si acepta, la persona necesita saber DÓNDE es.
       'address',   v_rec.venue_address),
    'org',       jsonb_build_object('name', v_rec.org_name),
    'applicant', jsonb_build_object('first_name', v_rec.first_name)
  );
END;
$function$;
