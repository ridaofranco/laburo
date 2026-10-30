-- 0098 · El aviso de cierre del pedido de precio (LICITACIONES.md, pregunta 3).
--
-- POR QUE: un pedido que llega a su fecha de cierre sigue 'abierta' hasta que
-- alguien elige o lo cierra a mano. Desde el 28/10 la pantalla dice «Venció sin
-- presupuestos» o «Falta elegir», pero solo si la productora ENTRA a mirar. El
-- de equipo del 11/9 vencio vacio y nadie se entero; el de catering junto 3
-- presupuestos reales y nadie eligio. Con este aviso, a quien hizo el pedido le
-- llega UN mail al cerrar: cuantos presupuestos llegaron y el boton para elegir,
-- o, si no llego ninguno, para darle mas tiempo o invitar a mas.
--
-- ADITIVA: una columna nueva (nullable) y una funcion nueva. No toca datos.
--
-- EXACTLY-ONCE: igual que las otras tandas, `cierre_avisado_at` se estampa en la
-- MISMA sentencia que selecciona (WITH ... FOR UPDATE SKIP LOCKED ... UPDATE ...
-- RETURNING). Una segunda corrida selecciona vacio.
--
-- VENTANA: solo pedidos que cerraron en los ultimos p_dias (7 por defecto). Sin
-- eso, el primer dia le llegaria a la productora un aviso de un pedido de
-- septiembre que ya no le sirve de nada.

BEGIN;

ALTER TABLE staff_app.quote_requests
  ADD COLUMN IF NOT EXISTS cierre_avisado_at timestamptz;

COMMENT ON COLUMN staff_app.quote_requests.cierre_avisado_at IS
  'Cuando le salio a quien hizo el pedido el aviso de «tu pedido cerro» (0098). Ancla de exactly-once: se estampa al seleccionar.';

CREATE OR REPLACE FUNCTION public.staff_app_avisos_de_cierre(
  p_dias  int DEFAULT 7,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  request_id   uuid,
  email        text,
  titulo       text,
  categoria    text,
  cierra_at    timestamptz,
  organizacion text,
  invitados    int,
  cotizaron    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_dias  int := least(greatest(coalesce(p_dias, 7), 1), 30);
  v_limit int := least(greatest(coalesce(p_limit, 0), 0), 200);
BEGIN
  IF v_limit = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT r.id
      FROM staff_app.quote_requests r
     WHERE r.estado = 'abierta'                               -- nadie eligio ni cerro a mano
       AND r.cierra_at <= now()                               -- ya cerro
       AND r.cierra_at >  now() - make_interval(days => v_dias) -- hace poco
       AND r.cierre_avisado_at IS NULL                        -- uno solo por pedido
     ORDER BY r.cierra_at
     LIMIT v_limit
     FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.quote_requests r
       SET cierre_avisado_at = now()
      FROM candidatas c
     WHERE r.id = c.id
    RETURNING r.id, r.titulo, r.categoria, r.cierra_at, r.organization_id, r.created_by
  )
  SELECT m.id,
         -- A quien hizo el pedido; si esa cuenta ya no existe, al dueño de la productora.
         coalesce(
           (SELECT u.email::text FROM auth.users u WHERE u.id = m.created_by),
           (SELECT u.email::text
              FROM staff_app.members mb
              JOIN auth.users u ON u.id = mb.user_id
             WHERE mb.organization_id = m.organization_id AND mb.role = 'owner'
             ORDER BY mb.created_at
             LIMIT 1)),
         m.titulo, m.categoria, m.cierra_at, o.name,
         (SELECT count(*)::int FROM staff_app.quote_invites i
           WHERE i.request_id = m.id AND i.enviado_at IS NOT NULL),
         (SELECT count(*)::int FROM staff_app.quotes q
            JOIN staff_app.quote_invites i ON i.id = q.invite_id
           WHERE i.request_id = m.id)
    FROM marcadas m
    JOIN staff_app.organizations o ON o.id = m.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_avisos_de_cierre(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_avisos_de_cierre(int, int) TO service_role;

COMMENT ON FUNCTION public.staff_app_avisos_de_cierre(int, int) IS
  'Tanda del aviso «tu pedido de precio cerro» a quien lo hizo: pedidos abiertos que llegaron a su cierre en los ultimos p_dias, uno solo por pedido (estampa cierre_avisado_at al seleccionar). Devuelve cuantos invitados recibieron el pedido y cuantos cotizaron. Solo service_role.';

COMMIT;
