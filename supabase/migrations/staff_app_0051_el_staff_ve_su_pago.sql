-- staff_app_0051_el_staff_ve_su_pago
-- EL DATO DEL PAGO EXISTIA HACE RATO Y LA PERSONA NO LO PODIA VER.
--
-- ── EL HUECO ─────────────────────────────────────────────────────────────────
--
-- La 0032 agrego offers.pago_listo_at para el mail "Tu pago esta listo", y la
-- productora lo ve en /pagos. Pero el panel del staff no lo recibe: sus tres
-- pantallas son Mis eventos, Fichaje y Mi perfil (components/staff-nav.tsx), y
-- el historial le muestra cuanto GANO, nunca si le PAGARON.
--
-- Con la politica de pago a 10 dias habiles, eso significa que la unica forma
-- que tiene una persona de saber si su plata esta coordinada es escribir por
-- WhatsApp. Multiplicado por la cantidad de gente de un evento, ese silencio es
-- trabajo manual para Franco todas las semanas, y para ella es desconfianza.
--
-- ── EL CAMBIO ────────────────────────────────────────────────────────────────
--
-- staff_app_my_staff_offers devuelve tambien pago_listo_at. Nada mas: no se
-- inventa un estado de pago nuevo ni una tabla nueva, se expone el que ya se
-- venia estampando. NULL = todavia no se aviso; con fecha = el pago quedo
-- coordinado y ese dia se le aviso.
--
-- El resto de la funcion queda EXACTAMENTE igual (copiada del cuerpo vivo en
-- produccion): mismas claves, mismo orden, mismo gate por my_staff_profile_id,
-- o sea la persona sigue viendo solo lo suyo. Firma identica → CREATE OR
-- REPLACE, sin tocar grants.

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

COMMENT ON FUNCTION public.staff_app_my_staff_offers(uuid) IS
  'Ofertas propias del staff (con gig y asistencia). Desde la 0051 devuelve tambien pago_listo_at, para que la persona vea el estado de su pago en su panel en vez de tener que preguntarlo por WhatsApp. Solo lo suyo: resuelve por my_staff_profile_id.';
