-- Migration: staff_app_0090_el_mas_barato_en_su_moneda
-- Escrita y APLICADA el 2026-10-27 (turno noche B).
--
-- La lista de pedidos de precio decia "Mas barato: $22.200" en el pedido de
-- catering de 3 jornadas, que tiene tres presupuestos REALES: USD 22.200,
-- $21.000.000 y $50.993.000. `mejor` era un `min(q.monto)` sin mirar la moneda:
-- comparaba dolares contra pesos como si fueran lo mismo, elegia los dolares y
-- la pantalla los mostraba con signo de pesos.
--
-- Ahora:
--   - `mejor` es el mas barato DENTRO de una sola moneda: pesos si hay algun
--     presupuesto en pesos (el caso normal en Argentina), si no la otra.
--   - `mejor_moneda` dice en que moneda esta ese numero.
--   - `otras_monedas` avisa que hay presupuestos en otra moneda que no entraron
--     en la comparacion, para que la pantalla lo diga en vez de esconderlo.
--
-- Es solo lectura: no toca ninguna fila. Misma firma, asi que el codigo viejo
-- sigue andando (lee `mejor` y nada mas) y los permisos no cambian
-- (CREATE OR REPLACE conserva el ACL; igual se repite el REVOKE de la 0079).

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_app_mis_pedidos(p_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_member(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  RETURN jsonb_build_object('ok', true, 'pedidos', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id',             r.id,
             'titulo',         r.titulo,
             'categoria',      r.categoria,
             'estado',         r.estado,
             'cierra_at',      r.cierra_at,
             'necesario_para', r.necesario_para,
             'created_at',     r.created_at,
             'cerrado',        (r.estado <> 'abierta' OR r.cierra_at <= now()),
             'invitados',      (SELECT count(*) FROM staff_app.quote_invites i
                                 WHERE i.request_id = r.id),
             'cotizaron',      (SELECT count(*) FROM staff_app.quotes q
                                  JOIN staff_app.quote_invites i ON i.id = q.invite_id
                                 WHERE i.request_id = r.id),
             'mejor',          m.monto,
             'mejor_moneda',   m.moneda,
             'otras_monedas',  EXISTS (SELECT 1 FROM staff_app.quotes q
                                         JOIN staff_app.quote_invites i ON i.id = q.invite_id
                                        WHERE i.request_id = r.id
                                          AND coalesce(q.moneda, 'ARS') <> m.moneda))
           ORDER BY r.created_at DESC)
    FROM staff_app.quote_requests r
    LEFT JOIN LATERAL (
      -- El mas barato de la moneda que manda: pesos primero.
      SELECT q.monto, coalesce(q.moneda, 'ARS') AS moneda
        FROM staff_app.quotes q
        JOIN staff_app.quote_invites i ON i.id = q.invite_id
       WHERE i.request_id = r.id
         AND q.monto IS NOT NULL
       ORDER BY (coalesce(q.moneda, 'ARS') <> 'ARS'), q.monto
       LIMIT 1
    ) m ON true
   WHERE r.organization_id = v_org), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mis_pedidos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mis_pedidos(uuid) TO authenticated;

COMMIT;
