-- Migration: staff_app_0079_las_pantallas_del_pedido
-- Escrita y APLICADA el 2026-09-05.
--
-- Lo que le falta a la ETAPA 1 para que existan las pantallas (etapas 2 a 4).
-- Nada de esto cambia el modelo: son las cuatro puertas que la interfaz
-- necesita y que la etapa 1 no tenia porque se probaba con SQL.
--
--   1. staff_app_mis_pedidos      la lista de pedidos, con sus conteos
--   2. staff_app_marcar_enviadas  estampa enviado_at DESPUES de que el mail sale
--   3. staff_app_cerrar_pedido    cerrar o cancelar antes de tiempo
--   4. staff_app_pedido_detalle   el pedido solo, para la pantalla de invitar
--
-- ⚠️ POR QUE `enviado_at` NO LO ESCRIBE staff_app_invitar_a_cotizar: porque en
-- ese momento el mail TODAVIA NO SALIO. La invitacion se crea, el server manda,
-- y recien despues se marca lo que efectivamente salio. Estamparlo al crear
-- diria "enviado" de mails que fallaron, y esa columna es justamente la que
-- despues decide a quien recordarle. Es la diferencia con las tandas de correo,
-- donde el ancla se estampa al seleccionar a proposito (ahi el riesgo que se
-- prefiere es perder un mail, no mandarlo dos veces; aca el mail es uno solo y
-- lo importante es saber si llego a salir).

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LA LISTA
-- ---------------------------------------------------------------------------
-- Trae los conteos que hacen que la lista sirva de un vistazo: cuantos
-- invitados, cuantos cotizaron, y si ya cerro. "3 de 12 cotizaron" es la unica
-- linea que dice si el pedido esta yendo bien o hay que salir a recordar.
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
             'mejor',          (SELECT min(q.monto) FROM staff_app.quotes q
                                  JOIN staff_app.quote_invites i ON i.id = q.invite_id
                                 WHERE i.request_id = r.id))
           ORDER BY r.created_at DESC)
    FROM staff_app.quote_requests r
   WHERE r.organization_id = v_org), '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- (2) EL PEDIDO SOLO
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_pedido_detalle(p_request_id uuid, p_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_r   record;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_member(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_r FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true, 'pedido', jsonb_build_object(
    'id', v_r.id, 'titulo', v_r.titulo, 'descripcion', v_r.descripcion,
    'categoria', v_r.categoria, 'provincia', v_r.provincia, 'ciudad', v_r.ciudad,
    'necesario_para', v_r.necesario_para, 'cierra_at', v_r.cierra_at,
    'campos', v_r.campos, 'estado', v_r.estado, 'gig_id', v_r.gig_id,
    'adjudicada_at', v_r.adjudicada_at,
    'cerrado', (v_r.estado <> 'abierta' OR v_r.cierra_at <= now())));
END;
$$;

-- ---------------------------------------------------------------------------
-- (3) MARCAR QUE EL MAIL SALIO
-- ---------------------------------------------------------------------------
-- Recibe los ids de las invitaciones cuyo mail efectivamente salio. No marca
-- las que fallaron: quedan con enviado_at NULL y la pantalla las muestra como
-- "no salio el mail", que es la verdad y ademas es accionable (se reintenta).
CREATE OR REPLACE FUNCTION public.staff_app_marcar_enviadas(p_invite_ids uuid[], p_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_n   int;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE staff_app.quote_invites i
     SET enviado_at = now()
    FROM staff_app.quote_requests r
   WHERE r.id = i.request_id
     AND r.organization_id = v_org          -- nunca invitaciones de otra organizacion
     AND i.id = ANY(p_invite_ids)
     AND i.enviado_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'marcadas', v_n);
END;
$$;

-- ---------------------------------------------------------------------------
-- (4) CERRAR O CANCELAR
-- ---------------------------------------------------------------------------
-- Cerrar = "ya no recibo mas cotizaciones, todavia no elegi".
-- Cancelar = "esto no va mas". Se separan porque el que cotizo tiene que poder
-- distinguir "perdi" de "no se hizo": no son lo mismo y la segunda no es una
-- derrota. Un pedido adjudicado no vuelve para atras.
CREATE OR REPLACE FUNCTION public.staff_app_cerrar_pedido(
  p_request_id uuid,
  p_cancelar   boolean DEFAULT false,
  p_org        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_r   record;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_r FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;
  IF v_r.estado = 'adjudicada' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_adjudicada');
  END IF;

  UPDATE staff_app.quote_requests
     SET estado = CASE WHEN p_cancelar THEN 'cancelada' ELSE 'cerrada' END
   WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true,
    'estado', CASE WHEN p_cancelar THEN 'cancelada' ELSE 'cerrada' END);
END;
$$;

-- ---------------------------------------------------------------------------
-- PERMISOS (WR-05: el default de Supabase grantea anon sobre todo lo nuevo)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.staff_app_mis_pedidos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_pedido_detalle(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_marcar_enviadas(uuid[], uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_cerrar_pedido(uuid, boolean, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.staff_app_mis_pedidos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_pedido_detalle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_enviadas(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_cerrar_pedido(uuid, boolean, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_mis_pedidos(uuid) IS
  'La lista de pedidos de cotizacion de la organizacion, con invitados, cuantos cotizaron y el mejor precio. Los conteos son lo que hace que la lista sirva de un vistazo.';
COMMENT ON FUNCTION public.staff_app_pedido_detalle(uuid, uuid) IS
  'Un pedido solo, para la pantalla de invitar. Lectura: alcanza con ser miembro.';
COMMENT ON FUNCTION public.staff_app_marcar_enviadas(uuid[], uuid) IS
  'Estampa enviado_at en las invitaciones cuyo mail SALIO de verdad. Se llama despues del envio, nunca antes: las que fallaron quedan en NULL y la pantalla lo dice.';
COMMENT ON FUNCTION public.staff_app_cerrar_pedido(uuid, boolean, uuid) IS
  'Cierra (no recibo mas) o cancela (esto no va mas) un pedido. Son distintos a proposito: el que cotizo tiene que poder distinguir "perdi" de "no se hizo". Un pedido adjudicado no vuelve para atras.';

COMMIT;
