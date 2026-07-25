-- Migration: staff_app_0028_crew_reminder
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- APLICAR A MANO en el SQL editor, después de 0027. Aditiva: una columna nullable
-- y una función. No toca datos ni policies.
--
-- PARA QUÉ: el recordatorio del día antes al equipo confirmado, que es el mail que
-- baja el "no vino nadie". PASE ya tiene uno igual para los asistentes y funciona.
-- Alguien que aceptó un trabajo hace tres semanas necesita que le recuerden el
-- lugar y la hora el día antes, no que lo busque en un mail viejo.
--
-- DOS objetos:
--   (1) staff_app.crew.reminder_sent_at — el ancla de exactly-once.
--   (2) public.staff_app_crew_due_reminder(p_within_hours) — devuelve el equipo de
--       los eventos que arrancan dentro de la ventana y estampa la marca en la
--       MISMA sentencia, así una segunda corrida no le escribe dos veces a nadie.
--
-- POR QUÉ 30 HORAS Y NO 24: el cron corre una vez por día (Vercel Hobby no permite
-- más), a las 9 UTC, o sea 6 de la mañana en Argentina. Con 24 horas justas, un
-- evento que arranca mañana a las 8 quedaría a 26 horas y NO entraría, o sea que
-- no se avisaría nunca. Con 30 entra siempre. El efecto secundario es que un evento
-- que arranca HOY también matchea, y eso está bien: el mail se adapta y dice "hoy"
-- en vez de "mañana".
--
-- SEGURIDAD: SECURITY DEFINER con search_path pineado, org forzada por constante,
-- EXECUTE solo para service_role (devuelve emails). anon y authenticated revocados.

ALTER TABLE staff_app.crew
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN staff_app.crew.reminder_sent_at IS
  'Ancla de exactly-once del recordatorio del día antes. NULL hasta que sale, y ahí queda now() estampado por public.staff_app_crew_due_reminder en la misma sentencia que selecciona la fila: una segunda corrida del cron no puede volver a elegirla.';

CREATE OR REPLACE FUNCTION public.staff_app_crew_due_reminder(p_within_hours int DEFAULT 30)
RETURNS TABLE(
  crew_id     uuid,
  email       text,
  first_name  text,
  role        text,
  gig_title   text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  venue_name  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
  v_h   int  := least(greatest(coalesce(p_within_hours, 30), 1), 72);
BEGIN
  RETURN QUERY
  WITH due AS (
    UPDATE staff_app.crew c
       SET reminder_sent_at = now()
     WHERE c.reminder_sent_at IS NULL
       AND c.gig_id IN (
         SELECT g.id
         FROM staff_app.gigs g
         WHERE g.organization_id = v_org
           AND g.starts_at IS NOT NULL
           -- Solo lo que todavía no arrancó y arranca dentro de la ventana.
           AND g.starts_at > now()
           AND g.starts_at <= now() + make_interval(hours => v_h)
       )
    RETURNING c.id, c.gig_id, c.staff_profile_id, c.role
  )
  SELECT d.id, sp.email, split_part(coalesce(sp.nombre, ''), ' ', 1), d.role,
         g.title, g.starts_at, g.ends_at, g.venue_name
  FROM due d
  JOIN staff_app.gigs g            ON g.id  = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id
  -- Al que pidió la baja del pool no se le escribe, ni siquiera esto (0026).
  WHERE sp.baja_at IS NULL
    AND sp.email IS NOT NULL
    AND sp.email <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_crew_due_reminder(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_crew_due_reminder(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_crew_due_reminder(int) IS
  'Fuente del recordatorio del día antes al equipo confirmado. Devuelve las filas de crew de los eventos de la org SOMOS DER que arrancan dentro de p_within_hours (default 30, techo 72) y todavía no fueron avisadas, y les estampa reminder_sent_at=now() en la misma sentencia: exactly-once. Excluye a quien pidió la baja del pool. service_role EXECUTE solo (devuelve emails); anon y authenticated revocados. Ojo: la ventana es de 30 h y no 24 porque el cron corre una vez por día a las 6 AM AR, y con 24 justas un evento de mañana a las 8 quedaría afuera para siempre.';
