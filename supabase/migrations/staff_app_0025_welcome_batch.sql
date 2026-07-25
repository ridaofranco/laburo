-- Migration: staff_app_0025_welcome_batch
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- APLICAR A MANO en el SQL editor de Supabase (o por MCP en una sesión con el
-- MCP autenticado). Aditiva: una columna nullable + dos funciones nuevas. No
-- toca ninguna tabla de HITO ni de PASE, no cambia policies existentes.
--
-- PARA QUÉ: la Pieza 2 del plan de LABURO (que la persona entre a completar su
-- propio perfil) ya tiene todas las partes menos una. El mail de bienvenida sale
-- cuando alguien se registra HOY por el formulario de somosder.ar, pero las 699
-- fichas que ya están en la base nunca lo recibieron: se cargaron por el import
-- del Sheet y por el formulario viejo. Sin esto, no hay forma de invitarlas a
-- entrar salvo mandar 699 mails a mano.
--
-- DOS objetos, en orden:
--   (1) ALTER staff_app.staff_profiles ADD bienvenida_enviada_at — el ancla de
--       exactly-once. Mientras es NULL, la ficha no recibió la bienvenida.
--   (2) public.staff_app_welcome_batch(p_limit) — la RPC que consume el cron con
--       service-role: devuelve hasta p_limit fichas sin bienvenida y las estampa
--       en la MISMA sentencia, así una segunda corrida no puede repetirlas.
--   (3) public.staff_app_welcome_pending() — cuántas quedan (para ver el avance
--       sin exponer PII: devuelve un número, no filas).
--
-- POR QUÉ EN TANDAS (p_limit): dos límites reales, los dos gratis.
--   * El SMTP de Ferozo de LABURO no es para envíos masivos (470/día en el peor
--     caso, entregabilidad de hosting compartido). 699 de una golpea el límite y
--     además quema reputación.
--   * El código de acceso lo manda Supabase Auth, y el tope de mails del tier
--     free es DEL PROYECTO ENTERO (se comprobó en vivo: tres pedidos con mails
--     distintos dieron over_email_send_rate_limit). Si los 699 entran a pedir su
--     código el mismo día, la mitad no puede entrar. En tandas, la demanda de
--     códigos se reparte en días.
--
-- SEGURIDAD (mismo patrón que 0010, que es el que ya corre en producción):
--   * SECURITY DEFINER con search_path fijo (el barrido del 25/7 dejó las 16
--     funciones del proyecto con search_path pineado; esta nace igual).
--   * La org sale de la constante fija de SOMOS DER, NUNCA de un parámetro.
--   * public auto-grantea anon en cada función nueva, así que van REVOKE
--     explícitos: welcome_batch MUTA estado y devuelve emails (PII), o sea
--     EXECUTE solo para service_role; anon y authenticated revocados. La de
--     conteo no devuelve PII, pero igual queda service_role-only por prudencia
--     (la usa el mismo cron).
--   * NO se expone el schema staff_app por PostgREST (PGRST106 a propósito, es
--     compartido con HITO): todo por RPC en public, como el resto del repo.

-- ---------------------------------------------------------------------------
-- (1) El ancla de exactly-once. Nullable, sin default: NULL = todavía no se le
--     mandó. No se backfillea nada, o sea que las 699 arrancan en NULL y son
--     justamente las que hay que invitar.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.staff_profiles
  ADD COLUMN IF NOT EXISTS bienvenida_enviada_at timestamptz;

COMMENT ON COLUMN staff_app.staff_profiles.bienvenida_enviada_at IS
  'Ancla de exactly-once del mail de bienvenida a LABURO. NULL hasta que la tanda se lo manda, y ahí queda now() estampado por public.staff_app_welcome_batch en la misma sentencia que selecciona la fila. Una segunda corrida del cron no puede volver a elegir una fila estampada. Distinto de perfil_confirmado_at, que marca que la persona ENTRÓ y revisó su ficha: esta columna solo dice que la invitación salió.';

-- ---------------------------------------------------------------------------
-- (2) La RPC de la tanda. Devuelve las fichas a invitar y las marca de una.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_welcome_batch(p_limit int DEFAULT 50)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
  v_limit int := least(greatest(coalesce(p_limit, 0), 0), 200);  -- techo duro de 200 por corrida
BEGIN
  IF v_limit = 0 THEN
    RETURN;   -- tanda apagada: no selecciona ni estampa nada
  END IF;

  -- Una sola sentencia: el CTE elige las candidatas (FOR UPDATE SKIP LOCKED para
  -- que dos corridas simultáneas no se pisen), el UPDATE estampa y devuelve. Como
  -- el filtro es bienvenida_enviada_at IS NULL y en el mismo statement se setea
  -- now(), una corrida posterior ya no las ve: exactly-once.
  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    WHERE sp.organization_id = v_org
      AND sp.bienvenida_enviada_at IS NULL
      AND sp.email IS NOT NULL
      AND sp.email <> ''
      AND position('@' in sp.email) > 1
    ORDER BY sp.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.staff_profiles sp
       SET bienvenida_enviada_at = now()
     WHERE sp.id IN (SELECT c.id FROM candidatas c)
    RETURNING sp.id, sp.email, sp.nombre
  )
  SELECT m.id, m.email, m.nombre FROM marcadas m;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_welcome_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_batch(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_welcome_batch(int) IS
  'Fuente de la tanda de bienvenida a LABURO. SECURITY DEFINER, search_path pineado. Devuelve hasta p_limit fichas (techo duro 200) de la org fija SOMOS DER con bienvenida_enviada_at IS NULL y email usable, las MÁS VIEJAS primero, y les estampa bienvenida_enviada_at=now() en la misma sentencia: exactly-once, una segunda corrida no las repite. p_limit 0 o NULL no devuelve ni estampa nada (tanda apagada). service_role EXECUTE solo (la consume el cron /api/cron/bienvenida); anon y authenticated revocados porque muta estado y devuelve emails.';

-- ---------------------------------------------------------------------------
-- (3) Cuántas quedan por invitar. Devuelve un número, no PII.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_welcome_pending()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
    AND sp.bienvenida_enviada_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_welcome_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_pending() TO service_role;

COMMENT ON FUNCTION public.staff_app_welcome_pending() IS
  'Cuántas fichas de la org SOMOS DER siguen sin recibir el mail de bienvenida a LABURO (bienvenida_enviada_at IS NULL y email usable). Devuelve un entero, sin PII, para que el cron pueda reportar el avance de la tanda. service_role EXECUTE solo; anon y authenticated revocados.';
