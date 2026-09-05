-- Migration: staff_app_0077_la_tanda_de_la_pregunta
-- Escrita y APLICADA el 2026-09-05.
--
-- ---------------------------------------------------------------------------
-- LA 0076 GUARDA LA RESPUESTA. ESTA MANDA LA PREGUNTA.
-- ---------------------------------------------------------------------------
-- La 0076 dejo la columna, la RPC que escribe y la pantalla /mi-visibilidad,
-- pero nadie le pregunta a nadie: `visibilidad_preguntada_at` la creo y despues
-- no la escribia ni una linea del producto. Con eso, el consentimiento existia
-- en la base y no existia en la realidad.
--
-- Esto es la tanda, con el mismo molde que la bienvenida (0025 + 0026), que ya
-- corrio en produccion: la RPC elige y ESTAMPA en la misma sentencia, y el cron
-- solo consume la lista que quedo marcada.
--
-- ---------------------------------------------------------------------------
-- A QUIEN SE LE PREGUNTA, Y A QUIEN NO
-- ---------------------------------------------------------------------------
--   * Solo el pool de la ORGANIZACION PLATAFORMA. Es el unico pool que es de la
--     plataforma y el unico que se estaria abriendo. El dia que una productora
--     cliente cargue fichas propias, esas son SUS contactos: LABURO no les
--     escribe, y por eso el filtro es `es_plataforma` y no el UUID pegado a
--     mano de la bienvenida. Si el filtro fuera "todas las fichas", la primera
--     productora que cargue su gente recibe un mail nuestro a sus contactos.
--   * Nunca a quien pidio la baja (`baja_at`), igual que la 0026.
--   * Nunca a quien YA contesto: ni al que dijo que si, ni al que dijo que no.
--     Volver a preguntarle al que dijo que no es no haberle creido.
--   * Una sola vez por ficha: `visibilidad_preguntada_at IS NULL` es el ancla.
--
-- ⚠️ EL SEGUNDO PEDIDO NO ENTRA ACA. La 0076 dejo la puerta abierta a
-- reenviarle UNA vez a quien no contesto, y esa es otra funcion el dia que se
-- escriba: tiene que mirar `visibilidad_preguntada_at < now() - X` y estampar
-- en otro lado, porque si reusa esta columna se pierde la unica prueba de
-- cuando se pregunto la primera vez. Mientras no exista, esta tanda no le
-- vuelve a escribir a nadie.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LA TANDA. Elige y marca en la misma sentencia: dos corridas del cron a la
--     vez no pueden mandarle dos mails a la misma persona.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_visibilidad_batch(p_limit int DEFAULT 50)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_limit int := least(greatest(coalesce(p_limit, 0), 0), 200);
BEGIN
  IF v_limit = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    JOIN staff_app.organizations o ON o.id = sp.organization_id
    WHERE o.es_plataforma
      AND sp.visibilidad_preguntada_at IS NULL   -- una sola vez por ficha
      AND sp.visible_para_red IS NULL            -- el que ya contesto queda afuera
      AND sp.baja_at IS NULL
      AND sp.email IS NOT NULL
      AND sp.email <> ''
      AND position('@' in sp.email) > 1
    ORDER BY sp.created_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.staff_profiles sp
       SET visibilidad_preguntada_at = now()
     WHERE sp.id IN (SELECT c.id FROM candidatas c)
    RETURNING sp.id, sp.email, sp.nombre
  )
  SELECT m.id, m.email, m.nombre FROM marcadas m;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_visibilidad_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_visibilidad_batch(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_visibilidad_batch(int) IS
  'La tanda del mail que pregunta si la persona acepta que otras productoras vean su ficha. Elige hasta p_limit fichas del pool de la organizacion plataforma sin preguntar, sin responder y sin baja, y estampa visibilidad_preguntada_at en la MISMA sentencia (exactly-once). Solo service_role: la llama el cron, que corre sin sesion.';

-- ---------------------------------------------------------------------------
-- (2) EL TABLERO. No es solo "cuantas faltan": es el numero con el que Franco
--     decide si abrir el pool tiene sentido. Un 4% de sies no alcanza para
--     venderle un catalogo a nadie, y eso hay que poder verlo antes de tocar
--     una sola linea de RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_visibilidad_pending()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'pool',           count(*)::int,
    'sin_preguntar',  count(*) FILTER (WHERE sp.visibilidad_preguntada_at IS NULL
                                         AND sp.visible_para_red IS NULL)::int,
    'preguntadas',    count(*) FILTER (WHERE sp.visibilidad_preguntada_at IS NOT NULL)::int,
    'si',             count(*) FILTER (WHERE sp.visible_para_red IS TRUE)::int,
    'no',             count(*) FILTER (WHERE sp.visible_para_red IS FALSE)::int,
    'sin_contestar',  count(*) FILTER (WHERE sp.visibilidad_preguntada_at IS NOT NULL
                                         AND sp.visible_para_red IS NULL)::int
  )
  FROM staff_app.staff_profiles sp
  JOIN staff_app.organizations o ON o.id = sp.organization_id
  WHERE o.es_plataforma
    AND sp.baja_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_visibilidad_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_visibilidad_pending() TO service_role;

COMMENT ON FUNCTION public.staff_app_visibilidad_pending() IS
  'El tablero de la pregunta de visibilidad: pool, sin_preguntar, preguntadas, si, no, sin_contestar. Es el numero con el que se decide si abrir el catalogo compartido vale la pena. Solo service_role.';

COMMIT;

-- ---------------------------------------------------------------------------
-- LO QUE ESTA MIGRACION SIGUE SIN HACER
-- ---------------------------------------------------------------------------
-- No abre el pool, igual que la 0076: no toca la RLS ni ninguna vista. Manda la
-- pregunta y guarda quien contesto que si. Abrir el catalogo es una decision
-- que se toma MIRANDO ese numero, y despues de tomarla, otra migracion.
