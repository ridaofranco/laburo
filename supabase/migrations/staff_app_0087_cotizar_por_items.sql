-- Migration: staff_app_0087_cotizar_por_items
-- Escrita y APLICADA el 2026-09-08.
--
-- ETAPA 6 de LICITACIONES.md: el pedido se puede partir en renglones, y cada
-- uno cotiza renglon por renglon. Sin una sola pantalla: se prueba con SQL,
-- igual que la etapa 1.
--
-- ---------------------------------------------------------------------------
-- EL PROBLEMA, EN LAS PALABRAS DE FRANCO
-- ---------------------------------------------------------------------------
-- "tampoco es que se puede poner precios, es decir, si quieren desglosarlo o
--  pueden solo ofertar por alguna de todas las cosas"
--
-- Hoy una cotizacion es UN MONTO Y NADA MAS, y eso choca de frente con el
-- producto: en el pedido de catering que Franco escribio a mano, la primera
-- pregunta es "precio por persona de cada servicio, por separado, no un paquete
-- cerrado". Preguntamos por el desglose y no teniamos donde recibirlo: el
-- proveedor lo contestaba en un campo de texto y el que compara volvia a leer
-- parrafos en vez de mirar una tabla. Es exactamente el problema que este
-- modulo vino a matar.
--
-- Y faltaba la otra mitad: OFERTAR POR UNA PARTE. Si pedis sonido + luces +
-- tarima y alguien solo hace sonido, hasta hoy tenia que inventar un total o no
-- cotizar. En el caso del pallet, partir la carga en dos fue lo que destrabo a
-- una empresa que ya habia dicho que no.
--
-- ---------------------------------------------------------------------------
-- LO QUE NO SE ROMPE, Y ES LA DECISION QUE ORDENA TODO
-- ---------------------------------------------------------------------------
-- `quotes.monto` NO se toca ni se vacia: PASA A SER EL TOTAL. Si la cotizacion
-- trae lineas, lo calcula la base sumandolas; si no trae, es lo que el
-- proveedor cargo a mano, como siempre. Asi:
--   * las cotizaciones que ya existen siguen siendo validas,
--   * la comparacion sigue teniendo UN camino y no dos,
--   * un pedido de una sola cosa no obliga a cargar ningun item,
--   * y la app vieja (la que todavia no manda lineas) sigue funcionando
--     mientras se despliega la nueva. Esto ultimo no es teorico: entre que se
--     aplica una migracion y que sale el deploy pasan minutos en los que el
--     codigo viejo le habla a la base nueva.
--
-- ---------------------------------------------------------------------------
-- ⚠️ "NO LO HAGO" ES UN DATO, NO UN VACIO
-- ---------------------------------------------------------------------------
-- Son tres estados distintos y hay que poder distinguirlos:
--   * hay linea con monto      -> lo cotizo
--   * hay linea con no_cotiza  -> "esto no lo hago"
--   * NO hay linea             -> no lo cargo todavia
-- Si los dos ultimos se confunden, el que compara cree que tiene una oferta
-- parcial cuando en realidad tiene una incompleta, y elige mal. Por eso el
-- CHECK de abajo obliga a que una linea sea una cosa o la otra, nunca las dos
-- ni ninguna.
--
-- ---------------------------------------------------------------------------
-- ⚠️ `obligatorio` NO BLOQUEA NADA. ES LA REGLA 2.
-- ---------------------------------------------------------------------------
-- Un requisito excluyente devuelve cero: pedir porton hidraulico espanto a las
-- 37 empresas de transporte. Por eso el default es false, y por eso marcar un
-- item como obligatorio NO impide cotizar sin el: se guarda igual y el que
-- compara ve el hueco. Rechazar una cotizacion parcial en el momento de
-- guardarla seria convertir una oferta incompleta en NINGUNA oferta, que es
-- justo lo contrario de lo que destrabo el caso del pallet.
--
-- ---------------------------------------------------------------------------
-- ⚠️ SE ADJUDICA LA COTIZACION ENTERA, NO POR ITEM (por ahora)
-- ---------------------------------------------------------------------------
-- El modelo lo aguantaria (la ganadora seria por linea y no por cotizacion),
-- pero cambia los mails: hoy hay UN ganador y varios que no. Partir un trabajo
-- entre dos proveedores es una decision de produccion, no de planilla, y
-- conviene ver si se usa de verdad antes de construirla. `staff_app_adjudicar`
-- queda intacta.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LO QUE SE PIDE, RENGLON POR RENGLON
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.quote_request_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES staff_app.quote_requests(id) ON DELETE CASCADE,
  -- Para mostrarlos como los escribio el que pide. Un pedido de catering tiene
  -- un orden (recepcion, cena, coffee) y alfabetizarlo lo vuelve ilegible.
  orden       int  NOT NULL DEFAULT 0,
  titulo      text NOT NULL,
  detalle     text,
  -- Opcionales las dos: hay items que no se cuentan ("armado del escenario").
  cantidad    numeric CHECK (cantidad IS NULL OR cantidad > 0),
  unidad      text,
  obligatorio boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_request_items_titulo_no_vacio CHECK (btrim(titulo) <> '')
);

CREATE INDEX IF NOT EXISTS quote_request_items_request_idx
  ON staff_app.quote_request_items (request_id, orden, created_at);

-- ---------------------------------------------------------------------------
-- (2) LO QUE CONTESTA CADA UNO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.quote_lines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id   uuid NOT NULL REFERENCES staff_app.quotes(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES staff_app.quote_request_items(id) ON DELETE CASCADE,
  monto      numeric CHECK (monto IS NULL OR monto > 0),
  no_cotiza  boolean NOT NULL DEFAULT false,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- ⚠️ Una linea por item y por cotizacion, igual que hay una cotizacion por
  -- invitacion. Sin esto, corregir un precio agrega una segunda linea y el
  -- total pasa a sumar dos veces lo mismo.
  CONSTRAINT quote_lines_una_por_item UNIQUE (quote_id, item_id),
  -- ⚠️ O tiene precio, o dice "esto no lo hago". Las dos cosas a la vez o
  -- ninguna dejarian la fila sin significado, y "sin significado" es
  -- indistinguible de "no lo cargo", que es justo lo que hay que separar.
  CONSTRAINT quote_lines_precio_o_no_cotiza CHECK (
    (no_cotiza AND monto IS NULL) OR (NOT no_cotiza AND monto IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS quote_lines_quote_idx ON staff_app.quote_lines (quote_id);
CREATE INDEX IF NOT EXISTS quote_lines_item_idx  ON staff_app.quote_lines (item_id);

-- ---------------------------------------------------------------------------
-- (3) LA RLS. Mismo criterio que 0078: lo ciego vive aca.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.quote_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.quote_lines         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_request_items_select ON staff_app.quote_request_items;
CREATE POLICY quote_request_items_select ON staff_app.quote_request_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_request_items.request_id
       AND staff_app.is_org_member(r.organization_id)));

DROP POLICY IF EXISTS quote_request_items_write ON staff_app.quote_request_items;
CREATE POLICY quote_request_items_write ON staff_app.quote_request_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_request_items.request_id
       AND staff_app.is_org_writer(r.organization_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_request_items.request_id
       AND staff_app.is_org_writer(r.organization_id)));

-- ⚠️ quote_lines tiene politica de LECTURA y NINGUNA de escritura, exactamente
-- igual que quotes y por la misma razon: las escribe el proveedor, que no tiene
-- sesion, y entran SOLO por la RPC del token. Sin policy de escritura, ni un
-- miembro de la organizacion puede editar a mano el precio que puso otro.
DROP POLICY IF EXISTS quote_lines_select ON staff_app.quote_lines;
CREATE POLICY quote_lines_select ON staff_app.quote_lines
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM staff_app.quotes q
      JOIN staff_app.quote_invites i  ON i.id = q.invite_id
      JOIN staff_app.quote_requests r ON r.id = i.request_id
     WHERE q.id = quote_lines.quote_id
       AND staff_app.is_org_member(r.organization_id)));

GRANT SELECT ON staff_app.quote_request_items, staff_app.quote_lines TO authenticated;

-- ---------------------------------------------------------------------------
-- (4) CREAR PEDIDO: ahora acepta los items
-- ---------------------------------------------------------------------------
-- ⚠️ SE DROPEA Y SE RECREA en vez de un CREATE OR REPLACE pelado. Sumar un
-- parametro no reemplaza la funcion: crea una SEGUNDA con otra firma, y ahi
-- PostgREST no puede elegir entre las dos (PGRST203) porque el parametro nuevo
-- tiene default y las dos matchean la misma llamada. Con el drop queda una
-- sola, y como `p_items` tiene default, el codigo viejo que todavia no lo manda
-- sigue andando igual durante el deploy.
DROP FUNCTION IF EXISTS public.staff_app_crear_pedido(
  text, text, text, text, text, date, timestamptz, jsonb, uuid, uuid);

CREATE OR REPLACE FUNCTION public.staff_app_crear_pedido(
  p_titulo         text,
  p_descripcion    text DEFAULT NULL,
  p_categoria      text DEFAULT NULL,
  p_provincia      text DEFAULT NULL,
  p_ciudad         text DEFAULT NULL,
  p_necesario_para date DEFAULT NULL,
  p_cierra_at      timestamptz DEFAULT NULL,
  p_campos         jsonb DEFAULT '[]'::jsonb,
  p_gig_id         uuid DEFAULT NULL,
  p_org            uuid DEFAULT NULL,
  -- [{"titulo":"Cena de recepcion","detalle":"...","cantidad":100,
  --   "unidad":"personas","obligatorio":false}]
  p_items          jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org   uuid := staff_app.resolve_org(p_org);
  v_id    uuid;
  v_items int := 0;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF coalesce(btrim(p_titulo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'titulo_required');
  END IF;
  IF p_cierra_at IS NULL OR p_cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cierra_at_required');
  END IF;
  IF jsonb_typeof(coalesce(p_campos, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campos_invalidos');
  END IF;
  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'items_invalidos');
  END IF;

  IF p_gig_id IS NOT NULL THEN
    PERFORM 1 FROM staff_app.gigs WHERE id = p_gig_id AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
  END IF;

  INSERT INTO staff_app.quote_requests (
    organization_id, gig_id, titulo, descripcion, categoria, provincia, ciudad,
    necesario_para, cierra_at, campos, created_by)
  VALUES (
    v_org, p_gig_id, btrim(p_titulo), p_descripcion, p_categoria, p_provincia, p_ciudad,
    p_necesario_para, p_cierra_at, coalesce(p_campos, '[]'::jsonb), auth.uid())
  RETURNING id INTO v_id;

  -- Un item sin titulo no es un item: se descarta en silencio, igual que una
  -- pregunta vacia del desglose. Y `cantidad` se castea con guarda: si viene
  -- basura queda NULL en vez de voltear la creacion entera del pedido.
  INSERT INTO staff_app.quote_request_items (
    request_id, orden, titulo, detalle, cantidad, unidad, obligatorio)
  SELECT v_id,
         (e.ord - 1)::int,
         btrim(e.value->>'titulo'),
         nullif(btrim(coalesce(e.value->>'detalle', '')), ''),
         CASE WHEN coalesce(e.value->>'cantidad', '') ~ '^[0-9]+(\.[0-9]+)?$'
                   AND (e.value->>'cantidad')::numeric > 0
              THEN (e.value->>'cantidad')::numeric END,
         nullif(btrim(coalesce(e.value->>'unidad', '')), ''),
         lower(coalesce(e.value->>'obligatorio', '')) IN ('true', 't', '1')
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) WITH ORDINALITY AS e(value, ord)
   WHERE jsonb_typeof(e.value) = 'object'
     AND coalesce(btrim(e.value->>'titulo'), '') <> '';
  GET DIAGNOSTICS v_items = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'request_id', v_id,
                            'organization_id', v_org, 'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_crear_pedido(
  text, text, text, text, text, date, timestamptz, jsonb, uuid, uuid, jsonb) TO authenticated;

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- (5) COTIZAR: ahora acepta lineas, y el monto pasa a ser el total
-- ---------------------------------------------------------------------------
-- Mismo drop-y-recreo que crear_pedido, y por el mismo motivo (PGRST203).
--
-- ⚠️ EL TOTAL LO CALCULA LA BASE, NUNCA LA PANTALLA. Si el total viajara desde
-- el navegador, la tabla comparativa podria ordenar por un numero que no es la
-- suma de lo que se ve abajo. Aca hay UNA sola fuente: si hay lineas, el monto
-- es su suma; si no hay, es lo que se cargo a mano.
--
-- ⚠️ Y SI LA COTIZACION YA TENIA LINEAS Y ESTA LLAMADA NO MANDA NINGUNA, el
-- total se recalcula igual sobre las lineas que ya estaban, y NO se borran. Ese
-- es el caso del navegador con la version vieja de la pagina abierta durante un
-- deploy: si le creyeramos el `p_monto`, una pantalla vieja dejaria el total
-- peleado con su propio desglose y nadie se enteraria.
DROP FUNCTION IF EXISTS public.staff_app_cotizar(text, numeric, text, text, text, int, jsonb);

CREATE OR REPLACE FUNCTION public.staff_app_cotizar(
  p_token        text,
  p_monto        numeric DEFAULT NULL,
  p_incluye      text    DEFAULT NULL,
  p_no_incluye   text    DEFAULT NULL,
  p_moneda       text    DEFAULT 'ARS',
  p_validez_dias int     DEFAULT NULL,
  p_respuestas   jsonb   DEFAULT '{}'::jsonb,
  -- [{"item_id":"uuid","monto":1200,"no_cotiza":false,"comentario":"..."}]
  p_lineas       jsonb   DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_hash    text;
  v_inv     record;
  v_req     record;
  v_id      uuid;
  v_previa  uuid;
  v_lineas  jsonb := '[]'::jsonb;
  v_malas   int   := 0;
  v_total   numeric;
BEGIN
  IF coalesce(btrim(p_token), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv FROM staff_app.quote_invites
   WHERE token_hash = v_hash OR token_hash_alt = v_hash;
  IF NOT FOUND OR v_inv.token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests WHERE id = v_inv.request_id;
  IF v_req.estado <> 'abierta' OR v_req.cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cerrado');
  END IF;

  IF coalesce(btrim(p_incluye), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'incluye_required');
  END IF;
  IF jsonb_typeof(coalesce(p_respuestas, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'respuestas_invalidas');
  END IF;
  IF jsonb_typeof(coalesce(p_lineas, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lineas_invalidas');
  END IF;

  SELECT id INTO v_previa FROM staff_app.quotes WHERE invite_id = v_inv.id;

  -- ── Las lineas que llegaron ───────────────────────────────────────────────
  IF jsonb_array_length(coalesce(p_lineas, '[]'::jsonb)) > 0 THEN
    -- El uuid se valida ANTES de castearlo: un `::uuid` sobre basura levanta
    -- una excepcion y el proveedor veria "no se pudo guardar" sin saber por que.
    SELECT count(*) INTO v_malas
      FROM jsonb_array_elements(p_lineas) AS e(value)
     WHERE jsonb_typeof(e.value) <> 'object'
        OR coalesce(e.value->>'item_id', '') !~*
           '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    IF v_malas > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'lineas_invalidas');
    END IF;

    -- Se normaliza UNA vez y se deduplica por item: mandar dos veces el mismo
    -- renglon no puede sumar dos veces al total ni reventar el ON CONFLICT.
    WITH crudas AS (
      SELECT (e.value->>'item_id')::uuid AS item_id,
             lower(coalesce(e.value->>'no_cotiza', '')) IN ('true', 't', '1') AS no_cotiza,
             CASE WHEN coalesce(e.value->>'monto', '') ~ '^[0-9]+(\.[0-9]+)?$'
                       AND (e.value->>'monto')::numeric > 0
                  THEN (e.value->>'monto')::numeric END AS monto,
             nullif(btrim(coalesce(e.value->>'comentario', '')), '') AS comentario,
             e.ord
        FROM jsonb_array_elements(p_lineas) WITH ORDINALITY AS e(value, ord)
    ), unicas AS (
      SELECT DISTINCT ON (item_id) * FROM crudas ORDER BY item_id, ord
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'item_id', item_id, 'no_cotiza', no_cotiza,
             'monto', monto, 'comentario', comentario)), '[]'::jsonb)
      INTO v_lineas FROM unicas;

    -- Cada linea tiene que apuntar a un item DE ESTE pedido. Es el mismo
    -- criterio que el token: el que cotiza no puede tocar nada de otro pedido.
    SELECT count(*) INTO v_malas
      FROM jsonb_to_recordset(v_lineas) AS l(item_id uuid)
     WHERE NOT EXISTS (SELECT 1 FROM staff_app.quote_request_items it
                        WHERE it.id = l.item_id AND it.request_id = v_req.id);
    IF v_malas > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'linea_desconocida');
    END IF;

    -- Una linea que no dice "no lo hago" TIENE que traer un numero. El vacio no
    -- se manda: no mandar la linea es lo que significa "no lo cargue todavia".
    SELECT count(*) INTO v_malas
      FROM jsonb_to_recordset(v_lineas) AS l(no_cotiza boolean, monto numeric)
     WHERE NOT l.no_cotiza AND l.monto IS NULL;
    IF v_malas > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'linea_sin_monto');
    END IF;

    SELECT sum(l.monto) INTO v_total
      FROM jsonb_to_recordset(v_lineas) AS l(no_cotiza boolean, monto numeric)
     WHERE NOT l.no_cotiza;

    -- Todo marcado como "esto no lo hago" no es una cotizacion: es un "no".
    IF v_total IS NULL OR v_total <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'nada_cotizado');
    END IF;

  ELSIF v_previa IS NOT NULL
        AND EXISTS (SELECT 1 FROM staff_app.quote_lines WHERE quote_id = v_previa) THEN
    -- Ver el ⚠️ del encabezado: pantalla vieja sobre una cotizacion que ya
    -- tenia desglose. Se respeta el desglose y se recalcula el total.
    SELECT sum(monto) INTO v_total
      FROM staff_app.quote_lines WHERE quote_id = v_previa AND NOT no_cotiza;
    IF v_total IS NULL OR v_total <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'nada_cotizado');
    END IF;

  ELSE
    -- El camino de siempre: un pedido sin items, o con items pero cotizado como
    -- paquete cerrado. REGLA 1: sin numero no hay cotizacion.
    v_total := p_monto;
    IF v_total IS NULL OR v_total <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'monto_required');
    END IF;
  END IF;

  INSERT INTO staff_app.quotes (invite_id, monto, moneda, incluye, no_incluye,
                                validez_dias, respuestas)
  VALUES (v_inv.id, v_total, coalesce(nullif(btrim(p_moneda), ''), 'ARS'),
          btrim(p_incluye), nullif(btrim(coalesce(p_no_incluye, '')), ''),
          p_validez_dias, coalesce(p_respuestas, '{}'::jsonb))
  ON CONFLICT (invite_id) DO UPDATE
    SET monto        = EXCLUDED.monto,
        moneda       = EXCLUDED.moneda,
        incluye      = EXCLUDED.incluye,
        no_incluye   = EXCLUDED.no_incluye,
        validez_dias = EXCLUDED.validez_dias,
        respuestas   = EXCLUDED.respuestas,
        updated_at   = now()
  RETURNING id INTO v_id;

  IF jsonb_array_length(v_lineas) > 0 THEN
    -- Corregir es reemplazar el desglose entero: lo que ya no viene, se va. Si
    -- no, un renglon borrado en la pantalla seguiria sumando al total.
    DELETE FROM staff_app.quote_lines ql
     WHERE ql.quote_id = v_id
       AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_lineas) AS l(item_id uuid)
                        WHERE l.item_id = ql.item_id);

    INSERT INTO staff_app.quote_lines (quote_id, item_id, monto, no_cotiza, comentario)
    SELECT v_id, l.item_id, l.monto, l.no_cotiza, l.comentario
      FROM jsonb_to_recordset(v_lineas)
             AS l(item_id uuid, no_cotiza boolean, monto numeric, comentario text)
    ON CONFLICT (quote_id, item_id) DO UPDATE
      SET monto      = EXCLUDED.monto,
          no_cotiza  = EXCLUDED.no_cotiza,
          comentario = EXCLUDED.comentario,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('ok', true, 'quote_id', v_id, 'monto', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_cotizar(
  text, numeric, text, text, text, int, jsonb, jsonb) TO anon, authenticated;

COMMIT;

BEGIN;

-- ---------------------------------------------------------------------------
-- (6) LAS CUATRO LECTURAS. Misma firma: aca alcanza un CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
-- ⚠️ Las cuatro se tocan EN LA MISMA MIGRACION a proposito. Una pantalla que
-- muestra los items y otra que no es como quedo la pagina publica el 7/9,
-- dibujando los renglones del desglose vacios: el que entra por ahi es
-- justamente el que NO recibio el mail con el detalle, y lo que ve es todo lo
-- que tiene para decidir si cotiza.

-- Los dos armadores de json viven una sola vez, en staff_app, porque los usan
-- cuatro funciones distintas. Copiar el jsonb_build_object en cada una es como
-- se llega a que una devuelva `cantidad` y otra no.
--
-- ⚠️ No son SECURITY DEFINER. Adentro de las funciones de abajo corren con los
-- permisos de ellas, que es lo que hace falta; llamadas sueltas por un cliente
-- corren como el cliente y la RLS de las dos tablas contesta lo que tiene que
-- contestar, que para un proveedor es nada.
CREATE OR REPLACE FUNCTION staff_app.items_del_pedido(p_request_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id',          it.id,
           'orden',       it.orden,
           'titulo',      it.titulo,
           'detalle',     it.detalle,
           'cantidad',    it.cantidad,
           'unidad',      it.unidad,
           'obligatorio', it.obligatorio)
         ORDER BY it.orden, it.created_at), '[]'::jsonb)
    FROM staff_app.quote_request_items it
   WHERE it.request_id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION staff_app.lineas_de_cotizacion(p_quote_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id',    l.item_id,
           'monto',      l.monto,
           'no_cotiza',  l.no_cotiza,
           'comentario', l.comentario)
         ORDER BY it.orden, it.created_at), '[]'::jsonb)
    FROM staff_app.quote_lines l
    JOIN staff_app.quote_request_items it ON it.id = l.item_id
   WHERE l.quote_id = p_quote_id;
$$;

-- (6.1) La invitacion, por token. Suma los items del pedido y MIS lineas.
CREATE OR REPLACE FUNCTION public.staff_app_ver_invitacion(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_hash text;
  v_inv  record;
  v_req  record;
  v_org  record;
  v_q    record;
BEGIN
  IF coalesce(btrim(p_token), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv FROM staff_app.quote_invites
   WHERE token_hash = v_hash OR token_hash_alt = v_hash;
  IF NOT FOUND OR v_inv.token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests WHERE id = v_inv.request_id;
  SELECT id, name INTO v_org FROM staff_app.organizations WHERE id = v_req.organization_id;

  IF v_inv.visto_at IS NULL THEN
    UPDATE staff_app.quote_invites SET visto_at = now() WHERE id = v_inv.id;
  END IF;

  SELECT * INTO v_q FROM staff_app.quotes WHERE invite_id = v_inv.id;

  RETURN jsonb_build_object(
    'ok', true,
    'invitado', jsonb_build_object('nombre', v_inv.nombre, 'email', v_inv.email),
    'pide',     jsonb_build_object('organizacion', v_org.name),
    'pedido',   jsonb_build_object(
                  'titulo',         v_req.titulo,
                  'descripcion',    v_req.descripcion,
                  'categoria',      v_req.categoria,
                  'provincia',      v_req.provincia,
                  'ciudad',         v_req.ciudad,
                  'necesario_para', v_req.necesario_para,
                  'cierra_at',      v_req.cierra_at,
                  'campos',         v_req.campos,
                  'items',          staff_app.items_del_pedido(v_req.id),
                  'estado',         v_req.estado),
    'puede_cotizar', (v_req.estado = 'abierta' AND v_req.cierra_at > now()),
    'mi_cotizacion', CASE WHEN v_q.id IS NULL THEN NULL ELSE jsonb_build_object(
                       'monto',        v_q.monto,
                       'moneda',       v_q.moneda,
                       'incluye',      v_q.incluye,
                       'no_incluye',   v_q.no_incluye,
                       'validez_dias', v_q.validez_dias,
                       'respuestas',   v_q.respuestas,
                       'lineas',       staff_app.lineas_de_cotizacion(v_q.id),
                       'estado',       v_q.estado,
                       'updated_at',   v_q.updated_at) END);
END;
$$;

-- (6.2) El pedido solo, en el portal.
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
    'campos', v_r.campos, 'items', staff_app.items_del_pedido(v_r.id),
    'estado', v_r.estado, 'gig_id', v_r.gig_id,
    'adjudicada_at', v_r.adjudicada_at,
    'cerrado', (v_r.estado <> 'abierta' OR v_r.cierra_at <= now())));
END;
$$;

-- (6.3) La comparacion. Devuelve los items del pedido y las lineas de cada uno:
-- la matriz item x proveedor la arma la pantalla, que es donde se decide como
-- se ve. Aca solo viajan los datos, y ninguno de mas.
CREATE OR REPLACE FUNCTION public.staff_app_listar_cotizaciones(
  p_request_id uuid,
  p_org        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_req record;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_member(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pedido', jsonb_build_object(
      'id', v_req.id, 'titulo', v_req.titulo, 'estado', v_req.estado,
      'cierra_at', v_req.cierra_at, 'campos', v_req.campos,
      'items', staff_app.items_del_pedido(v_req.id),
      'cerrado', (v_req.estado <> 'abierta' OR v_req.cierra_at <= now())),
    'cotizaciones', coalesce((
      SELECT jsonb_agg(fila ORDER BY (fila->>'monto')::numeric)
      FROM (
        SELECT jsonb_build_object(
                 'quote_id',     q.id,
                 'invite_id',    i.id,
                 'proveedor',    coalesce(i.nombre, i.email),
                 'email',        i.email,
                 'profile_id',   i.profile_id,
                 'monto',        q.monto,
                 'moneda',       q.moneda,
                 'incluye',      q.incluye,
                 'no_incluye',   q.no_incluye,
                 'validez_dias', q.validez_dias,
                 'respuestas',   q.respuestas,
                 'lineas',       staff_app.lineas_de_cotizacion(q.id),
                 'estado',       q.estado,
                 'updated_at',   q.updated_at) AS fila
        FROM staff_app.quotes q
        JOIN staff_app.quote_invites i ON i.id = q.invite_id
       WHERE i.request_id = p_request_id) s), '[]'::jsonb),
    'sin_cotizar', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'invite_id', i.id,
               'proveedor', coalesce(i.nombre, i.email),
               'email',     i.email,
               'enviado_at', i.enviado_at,
               'visto_at',   i.visto_at)
             ORDER BY i.created_at)
      FROM staff_app.quote_invites i
     WHERE i.request_id = p_request_id
       AND NOT EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = i.id)), '[]'::jsonb));
END;
$$;

-- (6.4) La pagina publica de la licitacion. Los items SI, los precios NO: esta
-- pagina la abre cualquiera de internet y no muestra nada de lo que cotizaron
-- los demas, ni cuantos son.
CREATE OR REPLACE FUNCTION public.staff_app_licitacion(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE v_r record; v_o record;
BEGIN
  SELECT * INTO v_r FROM staff_app.quote_requests
   WHERE slug = btrim(coalesce(p_slug, '')) AND visibilidad = 'publica';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;
  SELECT * INTO v_o FROM staff_app.organizations WHERE id = v_r.organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'slug', v_r.slug,
    'titulo', v_r.titulo,
    'descripcion', v_r.descripcion,
    'categoria', v_r.categoria,
    'ciudad', v_r.ciudad,
    'provincia', v_r.provincia,
    'necesario_para', v_r.necesario_para,
    'cierra_at', v_r.cierra_at,
    'campos', v_r.campos,
    'items', staff_app.items_del_pedido(v_r.id),
    'abierta', (v_r.estado = 'abierta' AND v_r.cierra_at > now()),
    'quien', CASE WHEN v_r.mostrar_productora THEN v_o.name ELSE 'Una productora' END,
    'con_nombre', v_r.mostrar_productora
  );
END;
$$;

COMMIT;

-- ---------------------------------------------------------------------------
-- LO QUE SE PROBO CORRIENDOLO, EL 8/9, ANTES DE TOCAR UNA PANTALLA
-- ---------------------------------------------------------------------------
-- Se armo un pedido de juguete con tres items (cena, coffee, barra), una
-- invitacion con token conocido, y se borro todo al terminar (0 filas quedan).
--
--   * `ver_invitacion` devuelve los tres items con su orden, cantidad, unidad y
--     `obligatorio`, y `mi_cotizacion` en null antes de cotizar.        OK
--   * Cotizar 600000 + 250000 + "no lo hago"  ->  ok, monto 850000.     OK
--   * item_id que no es un uuid               ->  lineas_invalidas.     OK
--   * item_id de OTRO pedido                  ->  linea_desconocida.    OK
--   * linea sin monto y sin no_cotiza         ->  linea_sin_monto.      OK
--   * todas las lineas en "no lo hago"        ->  nada_cotizado.        OK
--   * el mismo item dos veces (10 y 99)       ->  ok, total 10, una sola
--     linea: gana el primero y NO suma dos veces.                       OK
--   * volver a mandar el desglose completo    ->  3 lineas, total 850000,
--     y las lineas que no vuelven a venir se borran.                    OK
--   * PANTALLA VIEJA: `p_monto = 999` sobre una cotizacion que ya tenia
--     desglose  ->  se ignora el 999, el total sigue en 850000 y las tres
--     lineas quedan intactas.                                           OK
--   * Pedido SIN items, monto a mano 123456   ->  ok (camino de siempre), y
--     sin monto  ->  monto_required (REGLA 1).                          OK
--   * `staff_app_listar_cotizaciones` sin sesion -> forbidden: el gate de
--     organizacion sigue donde estaba.                                  OK
