-- 0100 · El recordatorio de una oferta no sale si el evento ya terminó.
--
-- staff_app_offers_due_reminder elige las ofertas cuyo LINK vence en los
-- próximos 2 días. El link dura 7 días y el evento puede ser antes: a alguien le
-- llegaba «tu propuesta vence el …» de un evento que ya había pasado, con un
-- botón para aceptar que (desde la 0099) ya no lo deja. Misma regla de «terminó»
-- que la 0099 (fin, o inicio + 12 h). Solo reemplaza la función; permisos iguales.

CREATE OR REPLACE FUNCTION public.staff_app_offers_due_reminder(p_within_days integer DEFAULT 2, p_org uuid DEFAULT NULL::uuid)
 RETURNS TABLE(offer_id uuid, email text, first_name text, gig_title text, role text, expires_at timestamp with time zone, token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := coalesce(p_org, staff_app.default_org_id());
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;

  RETURN QUERY
  -- Un token POR FILA: se genera dentro del SELECT (gen_random_bytes es
  -- VOLATILE, así que se evalúa fila por fila). Generarlo en un FROM no
  -- correlacionado le pondría el MISMO token a toda la tanda.
  WITH cand AS (
    SELECT o.id, encode(extensions.gen_random_bytes(32), 'hex') AS raw
      FROM staff_app.offers o
      JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
     WHERE o.organization_id = v_org
       AND o.status IN ('sent','viewed')
       AND o.reminded_at IS NULL
       AND o.expires_at > now()
       AND o.expires_at <= now() + make_interval(days => greatest(1, p_within_days))
       AND sp.baja_at IS NULL
       -- 0100: con el evento ya terminado no se recuerda (la base ya no deja
       -- aceptarla, 0099). Sin fecha cargada, se recuerda como antes.
       AND NOT EXISTS (SELECT 1 FROM staff_app.gigs g WHERE g.id = o.gig_id
                        AND coalesce(g.ends_at, g.starts_at + interval '12 hours') < now())
  ),
  due AS (
    UPDATE staff_app.offers o
       SET reminded_at    = now(),
           token_hash_alt = encode(extensions.digest(c.raw, 'sha256'), 'hex')
      FROM cand c
     WHERE o.id = c.id
       AND o.reminded_at IS NULL
    RETURNING o.id, o.gig_id, o.staff_profile_id, o.role, o.expires_at, c.raw
  )
  SELECT d.id, sp.email, sp.nombre, g.title, d.role, d.expires_at, d.raw
  FROM due d
  JOIN staff_app.gigs g ON g.id = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id;
END;
$function$;
