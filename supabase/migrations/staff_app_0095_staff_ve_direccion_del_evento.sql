-- 0095 · El staff ve la dirección y la ubicación del evento (turno noche B, 29/10/2026).
--
-- «Cómo llegar» buscaba en Google Maps solo el NOMBRE del lugar («Prueba»,
-- «Oficina»): con un nombre genérico, el mapa llevaba a cualquier lado. La
-- productora ya carga la dirección y el mapa la ubica (venue_address,
-- venue_lat, venue_lng), pero esta función no los devolvía.
--
-- Aditiva: misma firma, mismas columnas de antes y tres más. Solo devuelve
-- ofertas de la propia persona (igual que antes). CREATE OR REPLACE conserva
-- los permisos (authenticated sí, anon no).

CREATE OR REPLACE FUNCTION public.staff_app_my_staff_offers(p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
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
      -- 0095: para que «Cómo llegar» lleve a la dirección y no al nombre.
      'gig_address', g.venue_address,
      'gig_lat', g.venue_lat, 'gig_lng', g.venue_lng,
      'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at,
      -- 0051: el dato del pago ya existia (0032) pero solo lo veia la
      -- productora. Sin esto, la unica forma que tiene la persona de saber si
      -- le pagaron es preguntar por WhatsApp.
      'pago_listo_at', o.pago_listo_at
    ) ORDER BY g.starts_at ASC NULLS LAST)
    FROM staff_app.offers o
    LEFT JOIN staff_app.gigs g ON g.id = o.gig_id
    LEFT JOIN staff_app.attendance a
           ON a.gig_id = o.gig_id AND a.staff_profile_id = v_pid
    WHERE o.staff_profile_id = v_pid
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_my_staff_offers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_my_staff_offers(uuid) TO authenticated, service_role;
