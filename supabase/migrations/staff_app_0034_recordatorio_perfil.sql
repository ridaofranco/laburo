-- Migration: staff_app_0034_recordatorio_perfil
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- ⚠️ NO APLICADA TODAVÍA (29/7/2026): va como archivo, la aplica Franco a mano
-- en el SQL editor (o Claude por MCP con su OK). Aditiva: dos columnas nullable
-- y tres funciones nuevas. No toca datos, vistas ni nada de HITO o PASE.
--
-- PARA QUÉ: el RECORDATORIO DE PERFIL INCOMPLETO. La bienvenida invita a entrar
-- a revisar y completar el perfil; una parte va a entrar y otra va a dejar el
-- mail para después, para siempre. Este es el único empujón extra: UNO solo,
-- unos días después de la bienvenida, a los que todavía no entraron a confirmar
-- su ficha. Spec definida así: clon de la tanda de bienvenida (0025) con otra
-- columna de ancla.
--
-- LAS DOS COLUMNAS (0025 ya lo anticipaba en su COMMENT):
--   * perfil_confirmado_at — la persona ENTRÓ y guardó/confirmó su ficha. La
--     estampa staff_app_mark_perfil_confirmado desde los dos lugares donde eso
--     pasa de verdad: guardar el perfil en /editar-perfil-staff, y el registro
--     por /sumate (el que acaba de llenar el formulario entero YA confirmó: sin
--     esto, el recordatorio lo nagearía a los pocos días de registrarse).
--   * recordatorio_perfil_enviado_at — ancla exactly-once del recordatorio:
--     UNO solo por ficha, jamás un goteo.
--
-- QUIÉN RECIBE (el filtro de la batch): bienvenida mandada hace p_dias o más +
-- perfil nunca confirmado + recordatorio nunca mandado + no pidió la baja +
-- email usable. Quien recibió la bienvenida AYER no entra: se le da el tiempo
-- de entrar solo.
--
-- SEGURIDAD (patrón 0025/0031): SECURITY DEFINER con search_path pineado, org
-- fija por constante, EXECUTE solo para service_role, anon y authenticated
-- revocados en todo (la batch muta y devuelve emails; la marca muta estado).

-- ---------------------------------------------------------------------------
-- (1) Las columnas. Nullable, sin default. NO se backfillea perfil_confirmado_at:
--     las fichas viejas arrancan "sin confirmar", que es la verdad (nunca
--     entraron: la app es nueva), y son justo las que el recordatorio persigue.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.staff_profiles
  ADD COLUMN IF NOT EXISTS perfil_confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS recordatorio_perfil_enviado_at timestamptz;

COMMENT ON COLUMN staff_app.staff_profiles.perfil_confirmado_at IS
  'La persona ENTRÓ y confirmó su ficha (guardó el perfil en /editar-perfil-staff o se registró por /sumate llenando el formulario entero). NULL = nunca la revisó. Distinto de bienvenida_enviada_at, que solo dice que la invitación salió (0025). Lo estampa public.staff_app_mark_perfil_confirmado; el recordatorio de perfil incompleto persigue a los NULL.';

COMMENT ON COLUMN staff_app.staff_profiles.recordatorio_perfil_enviado_at IS
  'Ancla de exactly-once del recordatorio de perfil incompleto. NULL hasta que sale, y ahí queda now() estampado por public.staff_app_perfil_reminder_batch en la misma sentencia que selecciona la fila: UN solo recordatorio por ficha, nunca un goteo.';

-- ---------------------------------------------------------------------------
-- (2) La marca de "entró y confirmó". Idempotente: solo estampa si estaba NULL
--     (la primera vez cuenta, las siguientes no pisan). service_role only: la
--     llaman los server actions de /editar-perfil-staff y /sumate con el admin
--     client, DESPUÉS de validar la identidad por su propio camino.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_mark_perfil_confirmado(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  UPDATE staff_app.staff_profiles
     SET perfil_confirmado_at = now()
   WHERE id = p_profile_id
     AND perfil_confirmado_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mark_perfil_confirmado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mark_perfil_confirmado(uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_mark_perfil_confirmado(uuid) IS
  'Estampa perfil_confirmado_at=now() si estaba NULL (la persona guardó su perfil o se registró por /sumate). Devuelve si estampó. service_role EXECUTE solo; los server actions la llaman tras validar identidad (sesión propia en /editar-perfil-staff, registro recién creado en /sumate). Saca a la ficha del alcance del recordatorio de perfil incompleto.';

-- ---------------------------------------------------------------------------
-- (3) La tanda del recordatorio. Clon de staff_app_welcome_batch (0025) con el
--     filtro y el ancla propios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_perfil_reminder_batch(
  p_limit int DEFAULT 50,
  p_dias  int DEFAULT 5
)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';       -- org fija SOMOS DER, nunca de input
  v_limit int  := least(greatest(coalesce(p_limit, 0), 0), 200); -- techo duro 200 por corrida
  v_dias  int  := least(greatest(coalesce(p_dias, 5), 1), 60);   -- entre 1 y 60 días de espera
BEGIN
  IF v_limit = 0 THEN
    RETURN;   -- tanda apagada: no selecciona ni estampa nada
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT sp.id
    FROM staff_app.staff_profiles sp
    WHERE sp.organization_id = v_org
      AND sp.baja_at IS NULL                                   -- al que se fue no se le escribe
      AND sp.bienvenida_enviada_at IS NOT NULL                 -- ya fue invitado...
      AND sp.bienvenida_enviada_at <= now() - make_interval(days => v_dias)  -- ...hace p_dias o más
      AND sp.perfil_confirmado_at IS NULL                      -- y nunca entró a confirmar
      AND sp.recordatorio_perfil_enviado_at IS NULL            -- un solo recordatorio, jamás goteo
      AND sp.email IS NOT NULL
      AND sp.email <> ''
      AND position('@' in sp.email) > 1
    ORDER BY sp.bienvenida_enviada_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.staff_profiles sp
       SET recordatorio_perfil_enviado_at = now()
     WHERE sp.id IN (SELECT c.id FROM candidatas c)
    RETURNING sp.id, sp.email, sp.nombre
  )
  SELECT m.id, m.email, split_part(coalesce(m.nombre, ''), ' ', 1) FROM marcadas m;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_perfil_reminder_batch(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_perfil_reminder_batch(int, int) TO service_role;

COMMENT ON FUNCTION public.staff_app_perfil_reminder_batch(int, int) IS
  'Fuente del recordatorio de perfil incompleto. Devuelve hasta p_limit fichas (techo 200) de la org SOMOS DER con bienvenida mandada hace p_dias o más (1-60, default 5), perfil_confirmado_at NULL, sin recordatorio previo, sin baja y con email usable, las de bienvenida más vieja primero, y les estampa recordatorio_perfil_enviado_at=now() en la misma sentencia: exactly-once. p_limit 0 o NULL = apagada. service_role EXECUTE solo (muta y devuelve emails); la consume /api/cron/recordatorio-perfil.';

-- ---------------------------------------------------------------------------
-- (4) Cuántas quedan por recordar. Un número, sin PII (paridad con 0025).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_perfil_reminder_pending(p_dias int DEFAULT 5)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.staff_profiles sp
  WHERE sp.organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
    AND sp.baja_at IS NULL
    AND sp.bienvenida_enviada_at IS NOT NULL
    AND sp.bienvenida_enviada_at <= now() - make_interval(days => least(greatest(coalesce(p_dias, 5), 1), 60))
    AND sp.perfil_confirmado_at IS NULL
    AND sp.recordatorio_perfil_enviado_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> ''
    AND position('@' in sp.email) > 1;
$$;

REVOKE ALL ON FUNCTION public.staff_app_perfil_reminder_pending(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_perfil_reminder_pending(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_perfil_reminder_pending(int) IS
  'Cuántas fichas de la org SOMOS DER siguen en el alcance del recordatorio de perfil incompleto (mismo filtro que la batch). Devuelve un entero, sin PII, para que el cron reporte el avance. service_role EXECUTE solo.';
