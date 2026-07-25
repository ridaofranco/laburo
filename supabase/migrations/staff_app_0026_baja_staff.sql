-- Migration: staff_app_0026_baja_staff
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- APLICAR A MANO en el SQL editor de Supabase, JUNTO CON 0025 (esta va después).
--
-- PARA QUÉ: pedido de Franco. La persona tiene que poder decir "no quiero formar
-- parte". Hasta ahora la única salida era pedirle a Franco que la borre a mano, y
-- eso, con 699 fichas y una tanda de mails saliendo, no escala. Además ningún
-- envío masivo debería salir sin una vía de baja: es lo que separa un mail de un
-- spam, y Gmail lo mide para decidir si el dominio va a la carpeta correcta.
--
-- LA DECISIÓN DE FONDO: "no quiero formar parte" NO es "no me mandes mails". Es
-- "no me contemples". Así que la baja saca a la persona de las DOS partes:
--   1. de todos los envíos (la tanda de bienvenida ya no la elige), y
--   2. del POOL, o sea de la búsqueda y de las ofertas. Se logra filtrándola en
--      public.staff_app_profiles, que es la vista por la que pasan /buscar,
--      /favoritos, /staff/[id] y la pantalla de armar oferta.
-- NO se borra la ficha: se marca. Borrarla perdería el historial de eventos
-- trabajados y de pagos, y además haría que un re-registro futuro entre como
-- persona nueva. La baja es reversible (p_baja=false) para el que se arrepiente.
--
-- CUATRO objetos:
--   (1) columnas baja_at / baja_motivo en staff_app.staff_profiles.
--   (2) REPLACE de public.staff_app_profiles con WHERE baja_at IS NULL.
--   (3) public.staff_app_set_baja(p_id, p_motivo, p_baja) — la marca (o la
--       levanta), service_role-only, la llama la route pública /api/baja.
--   (4) REPLACE de public.staff_app_welcome_batch para excluir a los de baja.
--   (+) public.staff_app_bajas_count() para que Franco pueda ver cuántas hubo,
--       ya que las fichas dejan de aparecer en la vista.

-- ---------------------------------------------------------------------------
-- (1) Las columnas. Nullable, sin default: NULL = sigue formando parte.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.staff_profiles
  ADD COLUMN IF NOT EXISTS baja_at     timestamptz,
  ADD COLUMN IF NOT EXISTS baja_motivo text;

COMMENT ON COLUMN staff_app.staff_profiles.baja_at IS
  'La persona pidió no formar parte del pool de LABURO (link de baja al pie de los mails). NULL = sigue formando parte. Con valor, queda fuera de public.staff_app_profiles (búsqueda, favoritos, ofertas) y fuera de todos los envíos. La ficha NO se borra: se conserva el historial y un re-registro no entra como persona nueva. Reversible con public.staff_app_set_baja(..., p_baja => false).';

COMMENT ON COLUMN staff_app.staff_profiles.baja_motivo IS
  'Motivo que dejó la persona al darse de baja, opcional y en sus palabras. Es el feedback más barato y más honesto que vamos a tener sobre por qué alguien no quiere estar: leerlo cada tanto.';

-- ---------------------------------------------------------------------------
-- (2) La vista del pool, con el filtro de baja. Columnas IDÉNTICAS a 0007 (mismo
--     nombre, tipo y orden: CREATE OR REPLACE lo exige y el frontend depende de
--     ellas). Lo único que cambia es el WHERE.
-- ---------------------------------------------------------------------------
-- ⚠️ LA LISTA DE COLUMNAS TIENE QUE SER LA DE LA 0015, NO LA DE LA 0007.
-- La 0015 le agregó `documento` y `fecha_nacimiento` al final (los necesita la
-- pantalla del perfil). Postgres NO permite quitar columnas con CREATE OR REPLACE
-- VIEW: si acá va la lista vieja, esta migración FALLA con un error y la baja
-- queda a medio aplicar. Al agregar una columna nueva en el futuro, va SIEMPRE al
-- final y sin reordenar las que ya están.
CREATE OR REPLACE VIEW public.staff_app_profiles WITH (security_invoker = true) AS
  SELECT id, nombre, apellido, oficios, oficios_otro, provincia, ciudad,
         experiencia, anios_experiencia, eventos_trabajados, experiencia_detalle,
         disponibilidad_finde, disponibilidad_viajar, movilidad_propia, disponibilidad_aviso,
         estado, cv_url, portfolio_url, linkedin_url, telefono, email,
         situacion_legal, donde_trabajar, pais_residencia, motivacion, organization_id,
         documento, fecha_nacimiento
  FROM staff_app.staff_profiles
  WHERE baja_at IS NULL;

-- Re-aplicados después del REPLACE, igual que hace 0010 con la vista de ofertas:
-- authenticated lee, anon queda afuera (la vista tiene PII).
GRANT SELECT ON public.staff_app_profiles TO authenticated;
REVOKE ALL ON public.staff_app_profiles FROM anon;

COMMENT ON VIEW public.staff_app_profiles IS
  'Superficie de búsqueda y perfil del pool (security_invoker: RLS de la tabla base scopea por org). Desde 0026 EXCLUYE a quien pidió la baja (baja_at IS NOT NULL): el que dijo "no quiero formar parte" no aparece en /buscar, ni en favoritos, ni se le puede armar una oferta. Para contar las bajas, public.staff_app_bajas_count().';

-- ---------------------------------------------------------------------------
-- (3) Marcar la baja. La llama la route pública /api/baja con service-role,
--     DESPUÉS de validar el token del link (HMAC del id, no adivinable).
--     Devuelve true si tocó una fila: así la route no puede reportar éxito
--     sobre un id que no existe.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_set_baja(
  p_id     uuid,
  p_motivo text    DEFAULT NULL,
  p_baja   boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
  v_hit int;
BEGIN
  IF p_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE staff_app.staff_profiles sp
     SET baja_at     = CASE WHEN p_baja THEN coalesce(sp.baja_at, now()) ELSE NULL END,
         -- Al levantar la baja se limpia el motivo; al darla, se guarda el texto
         -- solo si vino algo (no pisamos un motivo previo con NULL).
         baja_motivo = CASE
                         WHEN NOT p_baja THEN NULL
                         WHEN p_motivo IS NOT NULL AND btrim(p_motivo) <> '' THEN left(btrim(p_motivo), 2000)
                         ELSE sp.baja_motivo
                       END
   WHERE sp.id = p_id
     AND sp.organization_id = v_org;

  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_baja(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_set_baja(uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.staff_app_set_baja(uuid, text, boolean) IS
  'Marca (p_baja=true) o levanta (p_baja=false) la baja de una ficha del pool de LABURO, con el motivo opcional que dejó la persona. Idempotente: darla dos veces no mueve el baja_at original. SECURITY DEFINER con search_path pineado y org forzada por constante. service_role EXECUTE solo: la consume la route pública /api/baja, que ANTES valida un token HMAC derivado del id (el link del pie de los mails), así anon nunca llega directo a esta función ni puede dar de baja a otra persona por fuerza bruta de UUIDs.';

-- ---------------------------------------------------------------------------
-- (+) Cuántas bajas hubo. Las fichas ya no están en la vista, así que sin esto
--     Franco no tendría de dónde mirarlo salvo el SQL editor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_bajas_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
    AND sp.baja_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.staff_app_bajas_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_bajas_count() TO service_role;

COMMENT ON FUNCTION public.staff_app_bajas_count() IS
  'Cuántas fichas pidieron la baja del pool. Devuelve un entero, sin PII. service_role EXECUTE solo.';

-- ---------------------------------------------------------------------------
-- (4) La tanda de bienvenida, ahora respetando la baja. Misma firma y mismo
--     comportamiento que 0025, con un filtro más: al que pidió no formar parte
--     no se le escribe nunca más, ni siquiera la bienvenida.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_welcome_batch(p_limit int DEFAULT 50)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_limit int := least(greatest(coalesce(p_limit, 0), 0), 200);
BEGIN
  IF v_limit = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    WHERE sp.organization_id = v_org
      AND sp.bienvenida_enviada_at IS NULL
      AND sp.baja_at IS NULL                 -- 0026: la baja manda
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

-- REPLACE no toca los grants, pero los re-afirmamos por las dudas (WR-05).
REVOKE ALL ON FUNCTION public.staff_app_welcome_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_batch(int) TO service_role;

-- Y el conteo de pendientes, también respetando la baja.
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
    AND sp.baja_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_welcome_pending() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_welcome_pending() TO service_role;
