-- Migration: staff_app_0033_fichaje_resumen
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- ⚠️ NO APLICADA TODAVÍA (29/7/2026): va como archivo, la aplica Franco a mano
-- en el SQL editor (o Claude por MCP con su OK). Aditiva: una columna nullable
-- y una función nueva. No toca datos, vistas ni nada de HITO o PASE.
--
-- PARA QUÉ: el mail "QUIÉN FICHÓ", el resumen a la productora/admin de quiénes
-- ficharon en un evento. El fichaje con geofencing ya existe y funciona
-- (staff_app.attendance, RPC staff_app_check_in de 0021: guarda entrada, salida
-- y distancia al predio), pero hoy nadie lo MIRA: para saber quién vino hay que
-- entrar a la app y revisar evento por evento. Este resumen lo manda solo,
-- cuando el evento terminó, con las dos listas que importan: quién fichó (con
-- horarios y distancia) y quién estaba confirmado y NO fichó.
--
-- CUÁNDO SE CONSIDERA TERMINADO: coalesce(ends_at, starts_at + 12 horas) en el
-- pasado. Si el gig tiene hora de fin cargada, se usa; si no, 12 horas después
-- del inicio cubre hasta la jornada más larga sin mandar el resumen a mitad
-- del evento. El cron corre 1 vez por día, así que el resumen llega a la
-- mañana siguiente, que es cuando el productor lo lee con el mate.
--
-- DOS objetos:
--   (1) gigs.fichaje_resumen_enviado_at — ancla exactly-once del resumen.
--   (2) public.staff_app_fichaje_resumen_batch() — estampa los gigs terminados
--       sin resumen en la MISMA sentencia que los selecciona (patrón 0025/0028)
--       y devuelve una fila POR PERSONA del equipo, con su fichaje si existe.
--       Los gigs SIN equipo también se estampan (no hay nada que resumir y no
--       tiene sentido que el cron los re-mire todos los días), pero no
--       devuelven filas: el route no manda mail para esos.
--
-- SEGURIDAD (patrón 0025/0028): SECURITY DEFINER con search_path pineado, org
-- forzada por constante, EXECUTE solo para service_role (devuelve nombres del
-- pool = PII org-scoped). anon y authenticated revocados.

-- ---------------------------------------------------------------------------
-- (1) El ancla. Nullable, sin default: NULL = el resumen no salió.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.gigs
  ADD COLUMN IF NOT EXISTS fichaje_resumen_enviado_at timestamptz;

COMMENT ON COLUMN staff_app.gigs.fichaje_resumen_enviado_at IS
  'Ancla de exactly-once del mail "quién fichó" (resumen de asistencia post-evento al admin). NULL hasta que sale, y ahí queda now() estampado por public.staff_app_fichaje_resumen_batch en la misma sentencia que selecciona el gig: una segunda corrida del cron no puede volver a elegirlo. Los gigs sin equipo también se estampan (sin mail): no hay nada que resumir.';

-- ---------------------------------------------------------------------------
-- (2) La RPC del resumen. Una fila por persona del equipo del gig terminado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_fichaje_resumen_batch(p_limit int DEFAULT 20)
RETURNS TABLE(
  gig_id              uuid,
  gig_title           text,
  starts_at           timestamptz,
  ends_at             timestamptz,
  venue_name          text,
  staff_nombre        text,
  staff_apellido      text,
  role                text,
  check_in_at         timestamptz,
  check_out_at        timestamptz,
  check_in_distance_m double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';  -- org fija SOMOS DER, nunca de input
  v_limit int  := least(greatest(coalesce(p_limit, 20), 1), 50);  -- gigs por corrida
BEGIN
  RETURN QUERY
  WITH due AS (
    -- Gigs terminados y sin resumen. FOR UPDATE SKIP LOCKED: dos corridas
    -- simultáneas no se pisan. Se estampan TODOS (con o sin equipo).
    SELECT g.id
    FROM staff_app.gigs g
    WHERE g.organization_id = v_org
      AND g.fichaje_resumen_enviado_at IS NULL
      AND g.starts_at IS NOT NULL
      AND coalesce(g.ends_at, g.starts_at + interval '12 hours') < now()
    ORDER BY g.starts_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcados AS (
    UPDATE staff_app.gigs g
       SET fichaje_resumen_enviado_at = now()
     WHERE g.id IN (SELECT d.id FROM due d)
    RETURNING g.id, g.title, g.starts_at, g.ends_at, g.venue_name
  )
  -- Una fila por persona del EQUIPO (crew = los que aceptaron), con su fichaje
  -- si existe. LEFT JOIN a propósito: el que no fichó también va en el resumen,
  -- es justo la fila que más le importa al productor.
  SELECT m.id, m.title, m.starts_at, m.ends_at, m.venue_name,
         sp.nombre, sp.apellido, c.role,
         a.check_in_at, a.check_out_at, a.check_in_distance_m
  FROM marcados m
  JOIN staff_app.crew c            ON c.gig_id = m.id
  JOIN staff_app.staff_profiles sp ON sp.id = c.staff_profile_id
  LEFT JOIN staff_app.attendance a ON a.gig_id = m.id
                                  AND a.staff_profile_id = c.staff_profile_id
  ORDER BY m.starts_at, sp.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_fichaje_resumen_batch(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_fichaje_resumen_batch(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_fichaje_resumen_batch(int) IS
  'Fuente del mail "quién fichó". Elige hasta p_limit gigs (techo 50) de la org SOMOS DER ya terminados (coalesce(ends_at, starts_at+12h) < now()) y sin resumen, les estampa fichaje_resumen_enviado_at=now() en la misma sentencia (exactly-once) y devuelve una fila por persona del equipo con su fichaje (o sin él: LEFT JOIN, el ausente es el dato que más importa). Gigs sin equipo se estampan sin devolver filas. service_role EXECUTE solo (PII); la consume /api/cron/quien-ficho.';
