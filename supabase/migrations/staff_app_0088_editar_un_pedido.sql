-- Migration: staff_app_0088_editar_un_pedido
-- Escrita y APLICADA el 2026-09-08.
--
-- Lo primero de "lo chico que quedó anotado" en LO-QUE-SIGUE.md.
--
-- ---------------------------------------------------------------------------
-- EL PROBLEMA
-- ---------------------------------------------------------------------------
-- De un pedido solo se podia correr la fecha, cerrarlo o cancelarlo. Si te
-- equivocabas en el titulo o en una pregunta, habia que REHACERLO ENTERO, y eso
-- pierde las invitaciones, que son lo caro: cada una es un mail que ya salio y
-- un token que alguien puede tener abierto en el celular.
--
-- Con los items (0087) empeoro: olvidarse un renglon obligaba a tirar el pedido
-- y volver a mandar todo.
--
-- ---------------------------------------------------------------------------
-- LAS TRES REGLAS DE ESTA FUNCION
-- ---------------------------------------------------------------------------
-- 1. ⚠️ EL CIERRE NO SE TOCA ACA. Ya lo hace `staff_app_extender_cierre`, que
--    ademas corre los `token_expires_at` de las invitaciones para no dejar
--    links vencidos. Duplicarlo es como se llega a que uno corra los tokens y
--    el otro no.
--
-- 2. ⚠️ LOS ITEMS SOLO SI NADIE COTIZO, y la regla es explicita en la firma:
--    `p_items` NULL significa "no los toques"; un array significa
--    "reemplazalos". Con cotizaciones adentro, borrar un item borraria EN
--    CASCADA las lineas de cada proveedor y `quotes.monto` quedaria siendo la
--    suma de algo que ya no existe. Devuelve `ya_cotizaron` y no cambia nada.
--
-- 3. Las PREGUNTAS (`campos`) se pueden cambiar siempre. Una respuesta a una
--    pregunta borrada queda dando vueltas en el jsonb y la pantalla la ignora:
--    es molesto, pero no rompe ningun numero. Los items si.
--
-- 4. ⚠️ OMITIR UN PARAMETRO ES NO TOCARLO, para los dos (correccion 0088b).
--    La primera version dejaba `p_campos` cayendo a '[]', asi que una llamada
--    que solo queria corregir el titulo BORRABA las preguntas. Se encontro
--    corriendolo: dos llamadas seguidas, la segunda sin p_campos, y las
--    preguntas de la primera desaparecieron. La pantalla siempre manda las dos
--    cosas y no cambia nada de lo que se ve, pero una funcion donde omitir un
--    parametro borra datos en un caso y no en el otro es una trampa esperando
--    a la proxima persona que la llame.
--
-- ---------------------------------------------------------------------------
-- LO QUE SE PROBO
-- ---------------------------------------------------------------------------
--   * Sin sesion -> forbidden, antes de tocar nada.                       OK
--   * Con sesion, desde la pantalla: cambiar titulo, detalle y preguntas
--     conserva las invitaciones.                                          OK
--   * Corregir titulo, detalle y preguntas: la invitacion queda intacta.  OK
--   * Reemplazar los items sin cotizaciones: quedan los nuevos, en orden.  OK
--   * Titulo vacio -> titulo_required.                                     OK
--   * Editar SIN mandar p_campos: las preguntas NO se borran (0088b).      OK
--   * Con una cotizacion adentro, tocar los items -> `ya_cotizaron`, y
--     corregir el titulo sigue andando.                                    OK
--   * La pantalla con cotizaciones adentro no ofrece editar los items: los
--     muestra en lectura, sin boton de sumar, y manda p_items en null.     OK

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_app_editar_pedido(
  p_request_id     uuid,
  p_titulo         text,
  p_descripcion    text DEFAULT NULL,
  p_categoria      text DEFAULT NULL,
  p_provincia      text DEFAULT NULL,
  p_ciudad         text DEFAULT NULL,
  p_necesario_para date DEFAULT NULL,
  p_campos         jsonb DEFAULT NULL,
  p_items          jsonb DEFAULT NULL,
  p_org            uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := staff_app.resolve_org(p_org);
  v_req   record;
  v_items int := 0;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;
  IF v_req.estado <> 'abierta' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_esta_abierto');
  END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'titulo_required');
  END IF;
  IF p_campos IS NOT NULL AND jsonb_typeof(p_campos) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campos_invalidos');
  END IF;
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'items_invalidos');
  END IF;

  IF p_items IS NOT NULL
     AND EXISTS (SELECT 1 FROM staff_app.quotes q
                   JOIN staff_app.quote_invites i ON i.id = q.invite_id
                  WHERE i.request_id = p_request_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_cotizaron');
  END IF;

  UPDATE staff_app.quote_requests
     SET titulo         = btrim(p_titulo),
         descripcion    = nullif(btrim(coalesce(p_descripcion, '')), ''),
         categoria      = nullif(btrim(coalesce(p_categoria, '')), ''),
         provincia      = nullif(btrim(coalesce(p_provincia, '')), ''),
         ciudad         = nullif(btrim(coalesce(p_ciudad, '')), ''),
         necesario_para = p_necesario_para,
         campos         = coalesce(p_campos, campos)
   WHERE id = p_request_id;

  IF p_items IS NOT NULL THEN
    -- Sin cotizaciones no hay ni una linea apuntando a estos items (el chequeo
    -- de arriba lo garantiza), asi que borrar y reescribir es seguro y deja el
    -- orden tal como quedo en la pantalla.
    DELETE FROM staff_app.quote_request_items WHERE request_id = p_request_id;

    INSERT INTO staff_app.quote_request_items (
      request_id, orden, titulo, detalle, cantidad, unidad, obligatorio)
    SELECT p_request_id,
           (e.ord - 1)::int,
           btrim(e.value->>'titulo'),
           nullif(btrim(coalesce(e.value->>'detalle', '')), ''),
           CASE WHEN coalesce(e.value->>'cantidad', '') ~ '^[0-9]+(\.[0-9]+)?$'
                     AND (e.value->>'cantidad')::numeric > 0
                THEN (e.value->>'cantidad')::numeric END,
           nullif(btrim(coalesce(e.value->>'unidad', '')), ''),
           lower(coalesce(e.value->>'obligatorio', '')) IN ('true', 't', '1')
      FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(value, ord)
     WHERE jsonb_typeof(e.value) = 'object'
       AND coalesce(btrim(e.value->>'titulo'), '') <> '';
    GET DIAGNOSTICS v_items = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_items FROM staff_app.quote_request_items
     WHERE request_id = p_request_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'request_id', p_request_id, 'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_editar_pedido(
  uuid, text, text, text, text, text, date, jsonb, jsonb, uuid) TO authenticated;

COMMIT;
