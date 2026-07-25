-- Migration: staff_app_0027_offer_notice
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- APLICAR A MANO en el SQL editor, después de 0025 y 0026. Aditiva: una función
-- nueva y nada más. No toca tablas, ni policies, ni datos.
--
-- PARA QUÉ: hoy una persona acepta una propuesta de trabajo y **no recibe nada por
-- escrito**. Ni ella ni Franco. Es el momento en que alguien pasa de "me
-- ofrecieron algo" a "tengo que estar el viernes a las 8 en tal lugar", y todo lo
-- que no está por escrito termina en un WhatsApp a las 11 de la noche. Del otro
-- lado, Franco solo se entera si entra a mirar el tablero.
--
-- LO QUE FALTABA TÉCNICAMENTE: el mail necesita el EMAIL de la persona y los datos
-- del evento, y por diseño nada de eso está disponible en la pantalla pública de
-- la oferta. `get_public_offer` es PII-safe a propósito: devuelve solo el primer
-- nombre, sin mail, sin teléfono y sin ids. Esta RPC es la que da, con
-- service_role y solo por token, exactamente lo que hace falta para mandar los dos
-- mails, ni un campo más.
--
-- SEGURIDAD: SECURITY DEFINER con search_path pineado (como el resto desde el
-- barrido del 25/7), org forzada por constante, y EXECUTE solo para service_role.
-- anon y authenticated revocados: devuelve el mail de la persona, que es PII y que
-- en el modelo broker de LABURO NO se muestra en la app.

CREATE OR REPLACE FUNCTION public.staff_app_offer_notice(p_token text)
RETURNS TABLE(
  offer_id      uuid,
  gig_id        uuid,
  staff_email   text,
  first_name    text,
  role          text,
  amount        numeric,
  conditions    text,
  gig_title     text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  venue_name    text,
  staff_nombre  text,
  staff_apellido text,
  status        text,
  slots_total   int,
  crew_total    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.gig_id,
    sp.email,
    -- Primer nombre para saludar sin sonar a sistema.
    split_part(coalesce(sp.nombre, ''), ' ', 1),
    o.role,
    o.amount,
    o.conditions,
    g.title,
    g.starts_at,
    g.ends_at,
    g.venue_name,
    sp.nombre,
    sp.apellido,
    o.status,
    -- Cuántos roles pide el evento en total y cuántos ya están cubiertos. Es lo
    -- que hace útil el aviso a Franco: no "alguien aceptó", sino "faltan 2".
    coalesce((SELECT sum(s.quantity)::int FROM staff_app.gig_slots s WHERE s.gig_id = o.gig_id), 0),
    coalesce((SELECT count(*)::int      FROM staff_app.crew c      WHERE c.gig_id = o.gig_id), 0)
  FROM staff_app.offers o
  JOIN staff_app.gigs g            ON g.id = o.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
  WHERE o.organization_id = v_org
    AND o.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_offer_notice(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_offer_notice(text) TO service_role;

COMMENT ON FUNCTION public.staff_app_offer_notice(text) IS
  'Datos mínimos para los dos mails que salen cuando alguien responde una propuesta: la confirmación a la persona ("quedaste en el equipo", con lugar, horario y cuándo se paga) y el aviso a Franco (con cuántos roles del evento quedan por cubrir). Busca la oferta por el HASH del token, igual que get_public_offer, así el token crudo nunca se guarda. SECURITY DEFINER, search_path pineado, org forzada por constante. service_role EXECUTE solo: devuelve el email de la persona, que es PII y que en el modelo broker NO se muestra en la app.';
