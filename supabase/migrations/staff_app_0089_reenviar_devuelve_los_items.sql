-- Migration: staff_app_0089_reenviar_devuelve_los_items
-- Escrita y APLICADA el 2026-09-08.
--
-- El mail de invitacion ahora lista los renglones que se cotizan por separado y
-- dice que se puede cotizar una parte (0087). Pero el REENVIO arma el mismo mail
-- con lo que le devuelve `staff_app_reenviar_invitacion`, que no los traia: el
-- segundo mail salia sin la lista y sin la frase que le abre la puerta al
-- proveedor que hace una sola de las tres cosas.
--
-- ⚠️ Es exactamente el patron que este repo ya pago tres veces: una pantalla (o
-- un mail) queda atras de la otra y nadie se entera hasta que un proveedor no
-- cotiza. La pagina publica de la licitacion mostrando renglones vacios el 7/9
-- fue el mismo error con otra ropa.
--
-- Lo unico que cambia es la clave `items` en el objeto `pedido`.

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_app_reenviar_invitacion(
  p_invite_id uuid,
  p_org       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_inv record;
  v_raw text;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT i.*, r.estado, r.cierra_at, r.titulo, r.descripcion, r.categoria,
         r.provincia, r.ciudad, r.necesario_para
    INTO v_inv
    FROM staff_app.quote_invites i
    JOIN staff_app.quote_requests r ON r.id = i.request_id
   WHERE i.id = p_invite_id AND r.organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_encontrada');
  END IF;
  IF v_inv.estado <> 'abierta' OR v_inv.cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cerrado');
  END IF;
  IF EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = p_invite_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_cotizo');
  END IF;

  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE staff_app.quote_invites
     SET token_hash_alt = encode(extensions.digest(v_raw, 'sha256'), 'hex'),
         enviado_at     = NULL
   WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invite_id', p_invite_id,
    'email',  v_inv.email,
    'nombre', v_inv.nombre,
    'token',  v_raw,
    'pedido', jsonb_build_object(
      'titulo', v_inv.titulo, 'descripcion', v_inv.descripcion,
      'categoria', v_inv.categoria, 'provincia', v_inv.provincia,
      'ciudad', v_inv.ciudad, 'necesario_para', v_inv.necesario_para,
      'cierra_at', v_inv.cierra_at,
      'items', staff_app.items_del_pedido(v_inv.request_id)));
END;
$$;

COMMIT;
