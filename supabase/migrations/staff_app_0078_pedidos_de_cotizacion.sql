-- Migration: staff_app_0078_pedidos_de_cotizacion
-- Escrita y APLICADA el 2026-09-05.
--
-- ETAPA 1 de LICITACIONES.md: las tres tablas, su RLS y las seis funciones.
-- Sin una sola pantalla. Se prueba con SQL, y se probo.
--
-- ⚠️ Se aplico en cinco pedazos (0078a a 0078e en el historial de Supabase, por
-- el tamano del bloque). Este archivo es el contenido completo y es la fuente
-- de verdad; el historial de la base tiene las mismas sentencias repartidas.
--
-- ---------------------------------------------------------------------------
-- 🔎 HITO YA TENIA UN ESBOZO DE ESTO, VACIO, Y NO SE REUSO
-- ---------------------------------------------------------------------------
-- En el mismo proyecto de Supabase (compartido con HITO) ya existen
-- public.rfqs (7 columnas), public.rfq_vendors y las funciones get_rfq_request
-- y submit_rfq_quote. Estan en CERO filas y les falta casi todo lo que hace que
-- esto funcione: no tienen fecha de cierre, ni "que incluye / que no incluye",
-- ni deduplicacion de mails, ni adjudicacion, ni desglose por rubro, y el token
-- se guarda EN CLARO (columna `token`, no un hash).
--
-- No se toca ni se migra: son de HITO, viven en public y su modelo es otro.
-- Lo nuestro vive en staff_app y no colisiona. Queda anotado porque el patron
-- de "esto ya estaba a medias en HITO" se repite (paso con proveedores), y
-- porque el dia que HITO y LABURO se junten, el que sobrevive es este.
--
-- ⚠️ Ojo con public.quotes: NO es lo mismo que staff_app.quotes. La de HITO es
-- el presupuesto AL CLIENTE (precio_cliente, margen, piso); la de aca es la
-- cotizacion QUE MANDA UN PROVEEDOR. Mismo nombre, esquemas distintos, cosas
-- opuestas del negocio.
--
-- ---------------------------------------------------------------------------
-- QUE ES ESTO
-- ---------------------------------------------------------------------------
-- Pedirle precio a varias empresas por lo mismo, al mismo tiempo, y comparar
-- las respuestas en una tabla. Cada una cotiza SIN VER lo que cotizaron las
-- otras.
--
-- Hoy el circuito es: la productora busca en /proveedores, manda una consulta,
-- y el proveedor contesta por mail. La conversacion se va afuera de LABURO y
-- nunca se sabe si el negocio se cerro. Dos consecuencias, y la segunda es la
-- cara: el que pide termina con quince hilos y una planilla a mano, y LABURO no
-- se entera de nada, asi que no puede cobrar comision nunca ni saber que
-- proveedor cumple.
--
-- ---------------------------------------------------------------------------
-- LAS TRES REGLAS, Y CADA UNA COSTO SEMANAS
-- ---------------------------------------------------------------------------
-- El caso real que da forma a todo esto: el transporte de un pallet a siete
-- destinos. 370 correos, 45 respuestas, y solo 2 cotizaciones con un precio
-- adentro.
--
-- REGLA 1 - El problema no es que no contesten, es que contestan sin cotizar.
--   De 45 respuestas, 43 eran preguntas o "pasame mas datos". Por eso `monto`
--   es columna de primer nivel y NOT NULL, no una clave adentro del jsonb: una
--   cotizacion sin numero no se puede guardar. En la pantalla sera lo primero y
--   lo mas grande; aca es una restriccion de la base, que es donde no se puede
--   negociar.
--
-- REGLA 2 - Un requisito excluyente devuelve cero.
--   Pedir porton hidraulico espanto a las 37 empresas. Por eso NO hay filtros
--   duros en ningun lado de este modelo: lo que se necesita se pide como dato
--   (`campos`) y el que compara ve quien lo cumple. No hay una sola columna que
--   sirva para excluir a un invitado antes de que cotice.
--
-- REGLA 3 - El seguro costaba mas que el flete.
--   Un precio suelto no se puede comparar: uno incluye seguro, otro no, otro lo
--   cobra por bulto. Por eso `incluye` es NOT NULL y `no_incluye` existe como
--   campo aparte del numero. Sin eso, la tabla comparativa miente.
--
-- ---------------------------------------------------------------------------
-- LO CIEGO, QUE ES EL PUNTO, NO SE RESUELVE ESCONDIENDO COSAS EN LA PANTALLA
-- ---------------------------------------------------------------------------
--   * `quotes` se lee con is_org_member(la organizacion del pedido). El
--     proveedor no es miembro de ninguna organizacion: no puede leer la tabla,
--     punto.
--   * El proveedor llega SOLO por su token, y la funcion que le contesta le
--     devuelve SU PROPIA cotizacion y nada mas. No recibe un listado que
--     despues se filtra en el cliente: recibe una fila.
--   * La cantidad de invitados TAMPOCO viaja. Saber que sos uno de doce ya
--     cambia como cotizas, asi que ninguna funcion publica la cuenta.
--
-- Mismo patron que la oferta de staff, probado en produccion: token opaco de 32
-- bytes, se guarda solo el sha256, funciones SECURITY DEFINER con search_path
-- fijo, y GRANT a anon solo sobre las dos funciones del token.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) EL PEDIDO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.quote_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  -- El evento al que pertenece. Opcional: se piden precios antes de que el
  -- evento exista. ON DELETE SET NULL y no CASCADE: borrar un evento no puede
  -- borrar las cotizaciones que ya recibiste, que son el historial de precios.
  gig_id          uuid REFERENCES staff_app.gigs(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  -- Text libre, igual que provider_services.categoria y por la misma razon: en
  -- HITO los rubros son configurables por productora, y un CHECK obligaria a
  -- una migracion cada vez que aparece uno nuevo.
  categoria       text,
  provincia       text,
  ciudad          text,
  necesario_para  date,
  cierra_at       timestamptz NOT NULL,
  -- El desglose que se le pide a cada uno, ademas del precio. Array de objetos.
  campos          jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado          text NOT NULL DEFAULT 'abierta'
                    CHECK (estado IN ('abierta', 'cerrada', 'adjudicada', 'cancelada')),
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  adjudicada_at   timestamptz,
  CONSTRAINT quote_requests_campos_array CHECK (jsonb_typeof(campos) = 'array')
);

CREATE INDEX IF NOT EXISTS quote_requests_org_idx
  ON staff_app.quote_requests (organization_id, estado, cierra_at DESC);

-- ---------------------------------------------------------------------------
-- (2) A QUIEN SE LE PIDIO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.quote_invites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES staff_app.quote_requests(id) ON DELETE CASCADE,
  -- Si es un proveedor del directorio. NULLABLE a proposito: se puede invitar a
  -- cualquiera por mail, y es lo unico que sirve para el caso real (las 37
  -- empresas de transporte no estaban registradas). Ademas cada empresa que
  -- cotiza queda con un pie adentro: es la mejor maquina de sumar proveedores
  -- que tiene el producto.
  profile_id       uuid REFERENCES staff_app.marketplace_profiles(id) ON DELETE SET NULL,
  email            text NOT NULL,
  nombre           text,
  token_hash       text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  enviado_at       timestamptz,
  visto_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ Al mismo pedido, un mail se invita UNA sola vez. Sin esto, pegar una lista
-- con un repetido manda dos links al mismo lugar y llegan dos cotizaciones de la
-- misma empresa, que despues aparecen como dos competidores en la comparacion.
CREATE UNIQUE INDEX IF NOT EXISTS quote_invites_request_email_idx
  ON staff_app.quote_invites (request_id, lower(email));

-- El token es la unica llave del que cotiza: la busqueda por hash tiene que ser
-- unica y directa.
CREATE UNIQUE INDEX IF NOT EXISTS quote_invites_token_idx
  ON staff_app.quote_invites (token_hash);

-- ---------------------------------------------------------------------------
-- (3) LA COTIZACION
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: una cotizacion por invitado. Corregir es actualizar esta fila, no
  -- agregar otra; si no, la tabla comparativa muestra tres precios de la misma
  -- empresa y el que compara no sabe cual vale.
  invite_id     uuid NOT NULL UNIQUE REFERENCES staff_app.quote_invites(id) ON DELETE CASCADE,
  monto         numeric NOT NULL CHECK (monto > 0),          -- REGLA 1
  moneda        text NOT NULL DEFAULT 'ARS',
  incluye       text NOT NULL,                                -- REGLA 3
  no_incluye    text,
  validez_dias  int CHECK (validez_dias IS NULL OR validez_dias > 0),
  respuestas    jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado        text NOT NULL DEFAULT 'enviada'
                  CHECK (estado IN ('enviada', 'ganadora', 'no_elegida')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_invite_idx ON staff_app.quotes (invite_id);

-- ---------------------------------------------------------------------------
-- (4) LA RLS. Es donde vive lo ciego.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.quote_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.quotes         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_requests_select ON staff_app.quote_requests;
CREATE POLICY quote_requests_select ON staff_app.quote_requests
  FOR SELECT USING (staff_app.is_org_member(organization_id));

DROP POLICY IF EXISTS quote_requests_write ON staff_app.quote_requests;
CREATE POLICY quote_requests_write ON staff_app.quote_requests
  FOR ALL USING (staff_app.is_org_writer(organization_id))
         WITH CHECK (staff_app.is_org_writer(organization_id));

DROP POLICY IF EXISTS quote_invites_select ON staff_app.quote_invites;
CREATE POLICY quote_invites_select ON staff_app.quote_invites
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_invites.request_id
       AND staff_app.is_org_member(r.organization_id)));

DROP POLICY IF EXISTS quote_invites_write ON staff_app.quote_invites;
CREATE POLICY quote_invites_write ON staff_app.quote_invites
  FOR ALL USING (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_invites.request_id
       AND staff_app.is_org_writer(r.organization_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM staff_app.quote_requests r
     WHERE r.id = quote_invites.request_id
       AND staff_app.is_org_writer(r.organization_id)));

-- ⚠️ quotes tiene politica de LECTURA y NINGUNA de escritura, a proposito. Las
-- cotizaciones las escribe el proveedor, que no tiene sesion: entran por la RPC
-- del token y por ningun otro lado. Sin policy de escritura, ni un miembro de la
-- organizacion puede editar a mano lo que cotizo otro.
DROP POLICY IF EXISTS quotes_select ON staff_app.quotes;
CREATE POLICY quotes_select ON staff_app.quotes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM staff_app.quote_invites i
      JOIN staff_app.quote_requests r ON r.id = i.request_id
     WHERE i.id = quotes.invite_id
       AND staff_app.is_org_member(r.organization_id)));

GRANT SELECT ON staff_app.quote_requests, staff_app.quote_invites, staff_app.quotes TO authenticated;

-- ---------------------------------------------------------------------------
-- (5) CREAR PEDIDO
-- ---------------------------------------------------------------------------
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
  p_org            uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_id  uuid;
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
  -- Sin fecha de cierre no hay pedido: es lo que le pone urgencia al que cotiza
  -- y lo unico que despues permite mandarle un recordatorio.
  IF p_cierra_at IS NULL OR p_cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cierra_at_required');
  END IF;
  IF jsonb_typeof(coalesce(p_campos, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'campos_invalidos');
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

  RETURN jsonb_build_object('ok', true, 'request_id', v_id, 'organization_id', v_org);
END;
$$;

-- ---------------------------------------------------------------------------
-- (6) INVITAR
-- ---------------------------------------------------------------------------
-- Devuelve los tokens EN CRUDO una sola vez, igual que create_offer: de la base
-- solo queda el sha256, asi que el link no se puede reconstruir despues. El
-- server los usa para armar los mails y no los guarda en ningun lado.
--
-- Un mail repetido en la lista NO es un error: se ignora en silencio (el indice
-- unico lo corta) y no vuelve en la respuesta, asi que tampoco se le manda un
-- segundo mail.
CREATE OR REPLACE FUNCTION public.staff_app_invitar_a_cotizar(
  p_request_id uuid,
  p_invitados  jsonb,   -- [{"email":"...","nombre":"...","profile_id":"..."}]
  p_org        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org      uuid := staff_app.resolve_org(p_org);
  v_req      record;
  v_item     jsonb;
  v_email    text;
  v_raw      text;
  v_hash     text;
  v_id       uuid;
  v_expires  timestamptz;
  v_out      jsonb := '[]'::jsonb;
  v_repetidos int := 0;
  v_invalidos int := 0;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;
  IF v_req.estado <> 'abierta' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_cerrado');
  END IF;
  IF jsonb_typeof(coalesce(p_invitados, 'null'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invitados_invalidos');
  END IF;

  -- El link vive mas que el cierre a proposito: despues de cerrado, el que
  -- cotizo tiene que poder volver a abrirlo para ver si gano. Quien decide si
  -- todavia se puede cotizar es el ESTADO del pedido, nunca el vencimiento del
  -- token.
  v_expires := v_req.cierra_at + interval '30 days';

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_invitados, '[]'::jsonb))
  LOOP
    v_email := btrim(coalesce(v_item->>'email', ''));
    -- Un mail mal escrito no se descarta en silencio: si pegaste una lista de
    -- 40 y 3 estaban rotos, tenes que enterarte ahora y no cuando falten tres
    -- cotizaciones.
    IF v_email = '' OR position('@' in v_email) < 2 THEN
      v_invalidos := v_invalidos + 1;
      CONTINUE;
    END IF;

    v_raw  := encode(extensions.gen_random_bytes(32), 'hex');
    v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

    INSERT INTO staff_app.quote_invites (request_id, profile_id, email, nombre,
                                         token_hash, token_expires_at)
    VALUES (p_request_id,
            nullif(v_item->>'profile_id', '')::uuid,
            v_email,
            nullif(btrim(coalesce(v_item->>'nombre', '')), ''),
            v_hash, v_expires)
    ON CONFLICT (request_id, lower(email)) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      v_repetidos := v_repetidos + 1;
      CONTINUE;
    END IF;

    v_out := v_out || jsonb_build_object(
      'invite_id', v_id,
      'email',     v_email,
      'nombre',    nullif(btrim(coalesce(v_item->>'nombre', '')), ''),
      'token',     v_raw);
    v_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'invitados', v_out,
                            'nuevos', jsonb_array_length(v_out),
                            'repetidos', v_repetidos,
                            'invalidos', v_invalidos);
END;
$$;

-- ---------------------------------------------------------------------------
-- (7) VER MI INVITACION, POR TOKEN
-- ---------------------------------------------------------------------------
-- Lo que ve el que cotiza. Devuelve UNA fila armada a mano, no un listado que
-- despues se filtra: quien pide, que necesita, para cuando, hasta cuando hay
-- tiempo, el desglose, y SU PROPIA cotizacion si ya la mando.
--
-- ⚠️ NUNCA devuelve cuantos mas fueron invitados, ni quienes son, ni que
-- cotizaron. Saber que sos uno de doce ya cambia como cotizas.
--
-- El que cotiza SI ve quien le pide, y eso es a proposito: un proveedor serio
-- cotiza distinto y mas rapido cuando sabe con quien habla. Lo ciego es entre
-- proveedores, no hacia el que pide.
CREATE OR REPLACE FUNCTION public.staff_app_ver_invitacion(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE                      -- marca visto_at en el primer golpe
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

  SELECT * INTO v_inv FROM staff_app.quote_invites WHERE token_hash = v_hash;
  -- Un solo motivo para "no existe" y para "vencido": quien prueba tokens no
  -- aprende nada de la respuesta.
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
                  'estado',         v_req.estado),
    -- Se puede cotizar mientras el pedido este abierto Y no haya cerrado. Es lo
    -- que decide la pantalla, y lo mismo que revalida staff_app_cotizar.
    'puede_cotizar', (v_req.estado = 'abierta' AND v_req.cierra_at > now()),
    'mi_cotizacion', CASE WHEN v_q.id IS NULL THEN NULL ELSE jsonb_build_object(
                       'monto',        v_q.monto,
                       'moneda',       v_q.moneda,
                       'incluye',      v_q.incluye,
                       'no_incluye',   v_q.no_incluye,
                       'validez_dias', v_q.validez_dias,
                       'respuestas',   v_q.respuestas,
                       'estado',       v_q.estado,
                       'updated_at',   v_q.updated_at) END);
END;
$$;

-- ---------------------------------------------------------------------------
-- (8) COTIZAR
-- ---------------------------------------------------------------------------
-- Upsert por invitacion: se cotiza una vez y se corrige hasta el cierre. No hay
-- contrapropuestas ni regateo, que es otro producto.
CREATE OR REPLACE FUNCTION public.staff_app_cotizar(
  p_token        text,
  p_monto        numeric,
  p_incluye      text,
  p_no_incluye   text DEFAULT NULL,
  p_moneda       text DEFAULT 'ARS',
  p_validez_dias int  DEFAULT NULL,
  p_respuestas   jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_hash text;
  v_inv  record;
  v_req  record;
  v_id   uuid;
BEGIN
  IF coalesce(btrim(p_token), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;
  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv FROM staff_app.quote_invites WHERE token_hash = v_hash;
  IF NOT FOUND OR v_inv.token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests WHERE id = v_inv.request_id;
  IF v_req.estado <> 'abierta' OR v_req.cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cerrado');
  END IF;

  -- REGLA 1: sin numero no hay cotizacion. De 45 respuestas, 43 no traian
  -- precio; esta es la linea que las convierte en cero en vez de en ruido.
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monto_required');
  END IF;
  -- REGLA 3: un precio suelto no se puede comparar.
  IF coalesce(btrim(p_incluye), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'incluye_required');
  END IF;
  IF jsonb_typeof(coalesce(p_respuestas, '{}'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'respuestas_invalidas');
  END IF;

  INSERT INTO staff_app.quotes (invite_id, monto, moneda, incluye, no_incluye,
                                validez_dias, respuestas)
  VALUES (v_inv.id, p_monto, coalesce(nullif(btrim(p_moneda), ''), 'ARS'),
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

  RETURN jsonb_build_object('ok', true, 'quote_id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- (9) LISTAR LAS COTIZACIONES (el que pide)
-- ---------------------------------------------------------------------------
-- Ordenadas por precio, que es como se compara. Trae tambien a los invitados que
-- NO cotizaron: un pedido con 12 invitados y 2 respuestas se tiene que ver asi,
-- porque esa es la unica forma de saber a quien mandarle el recordatorio.
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

-- ---------------------------------------------------------------------------
-- (10) ADJUDICAR
-- ---------------------------------------------------------------------------
-- Elegir lo hace una persona, nunca el precio mas bajo automaticamente: gana el
-- que incluye lo que hay que incluir.
--
-- Devuelve a QUIEN HAY QUE AVISARLE, separado en tres, porque avisar es lo que
-- sostiene la red: el que cotizo y nunca supo nada no te vuelve a cotizar. Y
-- ademas queda registrado quien gano y por cuanto, que es el unico dato que
-- despues permite cobrar una comision sin discutir.
CREATE OR REPLACE FUNCTION public.staff_app_adjudicar(
  p_request_id uuid,
  p_quote_id   uuid,
  p_org        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_req record;
  v_win record;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;
  -- Adjudicar dos veces cambiaria el ganador despues de haberle avisado.
  IF v_req.estado = 'adjudicada' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_adjudicada');
  END IF;
  IF v_req.estado = 'cancelada' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelada');
  END IF;

  SELECT q.id, q.monto, q.moneda, i.id AS invite_id, i.email, i.nombre
    INTO v_win
    FROM staff_app.quotes q
    JOIN staff_app.quote_invites i ON i.id = q.invite_id
   WHERE q.id = p_quote_id AND i.request_id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cotizacion_no_encontrada');
  END IF;

  UPDATE staff_app.quotes q
     SET estado = CASE WHEN q.id = p_quote_id THEN 'ganadora' ELSE 'no_elegida' END
    FROM staff_app.quote_invites i
   WHERE i.id = q.invite_id AND i.request_id = p_request_id;

  UPDATE staff_app.quote_requests
     SET estado = 'adjudicada', adjudicada_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ganador', jsonb_build_object('quote_id', v_win.id, 'email', v_win.email,
                                  'nombre', v_win.nombre, 'monto', v_win.monto,
                                  'moneda', v_win.moneda),
    'no_elegidos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('email', i.email, 'nombre', i.nombre))
        FROM staff_app.quotes q
        JOIN staff_app.quote_invites i ON i.id = q.invite_id
       WHERE i.request_id = p_request_id AND q.id <> p_quote_id), '[]'::jsonb),
    'sin_cotizar', coalesce((
      SELECT jsonb_agg(jsonb_build_object('email', i.email, 'nombre', i.nombre))
        FROM staff_app.quote_invites i
       WHERE i.request_id = p_request_id
         AND NOT EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = i.id)), '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- (11) LOS PERMISOS. WR-05: el default de Supabase grantea anon sobre todo lo
--      nuevo de public, asi que cada objeto lleva su REVOKE explicito.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.staff_app_crear_pedido(text, text, text, text, text, date, timestamptz, jsonb, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_invitar_a_cotizar(uuid, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_listar_cotizaciones(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_adjudicar(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_ver_invitacion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_cotizar(text, numeric, text, text, text, int, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.staff_app_crear_pedido(text, text, text, text, text, date, timestamptz, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_invitar_a_cotizar(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_listar_cotizaciones(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_adjudicar(uuid, uuid, uuid) TO authenticated;

-- Las DOS del token, y solo estas dos, son alcanzables sin cuenta: el que cotiza
-- no tiene ninguna, y esa es toda la gracia (las 37 empresas de transporte no
-- estaban registradas en ningun lado).
GRANT EXECUTE ON FUNCTION public.staff_app_ver_invitacion(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_cotizar(text, numeric, text, text, text, int, jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_crear_pedido(text, text, text, text, text, date, timestamptz, jsonb, uuid, uuid) IS
  'Crea un pedido de cotizacion en la organizacion recibida por p_org (nunca la que elija Postgres). Exige titulo y fecha de cierre futura. Solo escritores de la organizacion.';
COMMENT ON FUNCTION public.staff_app_invitar_a_cotizar(uuid, jsonb, uuid) IS
  'Invita a cotizar por mail, registrado o no. Devuelve los tokens EN CRUDO una sola vez (de la base solo queda el sha256). Un mail repetido en la lista se ignora en silencio y no vuelve en la respuesta, asi que no recibe un segundo link.';
COMMENT ON FUNCTION public.staff_app_ver_invitacion(text) IS
  'Lo que ve el que cotiza, por token y sin cuenta. Devuelve el pedido, quien lo pide y SU PROPIA cotizacion. Nunca cuantos mas fueron invitados, quienes son ni que cotizaron. Marca visto_at en el primer golpe.';
COMMENT ON FUNCTION public.staff_app_cotizar(text, numeric, text, text, text, int, jsonb) IS
  'Carga o corrige la cotizacion del invitado, por token y sin cuenta. Rechaza sin monto (regla 1) y sin "que incluye" (regla 3), y despues del cierre. Una cotizacion por invitado: corregir actualiza la fila.';
COMMENT ON FUNCTION public.staff_app_listar_cotizaciones(uuid, uuid) IS
  'La tabla comparativa del que pide: cotizaciones ordenadas por monto mas los invitados que todavia no cotizaron (que es a quien hay que recordarle).';
COMMENT ON FUNCTION public.staff_app_adjudicar(uuid, uuid, uuid) IS
  'Marca la cotizacion ganadora, el resto como no elegidas y el pedido como adjudicado. Devuelve a quien avisarle, separado en ganador, no elegidos y sin cotizar. No se puede adjudicar dos veces.';

COMMIT;

-- ---------------------------------------------------------------------------
-- LO QUE ESTA ETAPA NO TIENE, Y ES A PROPOSITO
-- ---------------------------------------------------------------------------
--   * Ninguna pantalla. Etapa 2 (crear e invitar), 3 (/cotizar/[token]) y 4 (la
--     comparacion y los tres mails).
--   * Ningun mail. Las funciones devuelven a quien escribirle; mandarlo es del
--     server, en la etapa siguiente.
--   * Recordatorios (etapa 5). Sobre 370 correos probablemente valgan mas que
--     todo lo demas, pero necesitan el mail andando primero.
--   * Contrapropuestas, pliegos, adjudicacion automatica por precio y pago
--     adentro: fuera de alcance, escrito en LICITACIONES.md.
