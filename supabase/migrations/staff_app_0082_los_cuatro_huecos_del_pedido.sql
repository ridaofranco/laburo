-- Migration: staff_app_0082_los_cuatro_huecos_del_pedido
-- Escrita y APLICADA el 2026-09-05.
--
-- Cuatro cosas que faltaban y que se ven recien cuando uno lee LICITACIONES.md
-- al lado de lo construido:
--
--   1. INVITAR DESDE EL DIRECTORIO. El documento dice "elegis proveedores del
--      directorio Y/O pegas una lista de mails", y solo estaba la segunda
--      mitad. Encima `quote_invites.profile_id` existia y quedaba SIEMPRE en
--      NULL, o sea que el modulo no se tocaba con el resto del producto: un
--      proveedor que ya esta en LABURO habia que invitarlo escribiendo su mail
--      a mano, y despues nadie sabia que era el mismo.
--
--      ⚠️ Y la productora NO ve el mail del proveedor, ni ahora ni nunca. Esa
--      fue una decision explicita de Franco (2/8, migracion 0058): el contacto
--      no se entrega, la consulta va por adentro. Asi que la pantalla manda el
--      `profile_id` y el mail lo resuelve ESTA funcion, del lado de la base.
--
--   2. REENVIAR LA INVITACION QUE NO SALIO. La pantalla ya decia "el mail no
--      salio" y no dejaba hacer nada al respecto: informacion sin salida. Y no
--      alcanzaba con "mandar de nuevo", porque el token original no se puede
--      reconstruir (solo queda su sha256). Se emite uno nuevo, igual que el
--      recordatorio.
--
--   3. EXTENDER EL CIERRE. Caso real y frecuente: cierra manana, cotizaron dos
--      de doce, y lo unico razonable es correrlo tres dias. Sin esto habia que
--      cancelar y rehacer el pedido entero, perdiendo las invitaciones y las
--      cotizaciones que ya habian entrado.
--
--      ⚠️ Extender tambien corre el vencimiento de los tokens. Sin eso, los
--      links seguirian venciendo con la fecha vieja + 30 dias y el pedido
--      quedaria abierto con invitaciones muertas.
--
--   4. ENTERARSE DE QUE LLEGO UNA COTIZACION. Hasta ahora habia que acordarse
--      de volver a mirar la pantalla. Un pedido que junta respuestas y no avisa
--      es un pedido que se olvida, que es exactamente lo que este modulo vino a
--      arreglar.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) INVITAR: acepta profile_id sin mail, y lo resuelve la base
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_invitar_a_cotizar(
  p_request_id uuid,
  p_invitados  jsonb,
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
  v_nombre   text;
  v_profile  uuid;
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

  v_expires := v_req.cierra_at + interval '30 days';

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_invitados, '[]'::jsonb))
  LOOP
    v_email   := btrim(coalesce(v_item->>'email', ''));
    v_nombre  := nullif(btrim(coalesce(v_item->>'nombre', '')), '');
    v_profile := nullif(v_item->>'profile_id', '')::uuid;

    -- Del directorio: la pantalla manda el id y NO el mail, porque la
    -- productora no ve el contacto del proveedor (decision del 2/8). Se
    -- resuelve aca, y solo si el proveedor sigue publicado.
    IF v_email = '' AND v_profile IS NOT NULL THEN
      SELECT mp.email, coalesce(v_nombre, mp.display_name)
        INTO v_email, v_nombre
        FROM staff_app.marketplace_profiles mp
       WHERE mp.id = v_profile
         AND mp.tipo IN ('proveedor', 'salon')
         AND mp.activo AND mp.is_public;
      v_email := btrim(coalesce(v_email, ''));
    END IF;

    IF v_email = '' OR position('@' in v_email) < 2 THEN
      v_invalidos := v_invalidos + 1;
      CONTINUE;
    END IF;

    v_raw  := encode(extensions.gen_random_bytes(32), 'hex');
    v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

    INSERT INTO staff_app.quote_invites (request_id, profile_id, email, nombre,
                                         token_hash, token_expires_at)
    VALUES (p_request_id, v_profile, v_email, v_nombre, v_hash, v_expires)
    ON CONFLICT (request_id, lower(email)) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      v_repetidos := v_repetidos + 1;
      CONTINUE;
    END IF;

    v_out := v_out || jsonb_build_object(
      'invite_id', v_id, 'email', v_email, 'nombre', v_nombre, 'token', v_raw);
    v_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'invitados', v_out,
                            'nuevos', jsonb_array_length(v_out),
                            'repetidos', v_repetidos,
                            'invalidos', v_invalidos);
END;
$$;

COMMENT ON FUNCTION public.staff_app_invitar_a_cotizar(uuid, jsonb, uuid) IS
  'Invita a cotizar por mail (lista pegada) o por profile_id del directorio, en cuyo caso el mail lo resuelve la base: la productora NO ve el contacto del proveedor. Devuelve los tokens en crudo una sola vez. Un mail repetido se ignora en silencio; uno invalido se cuenta y se reporta.';

-- ---------------------------------------------------------------------------
-- (2) LOS PROVEEDORES QUE SE PUEDEN INVITAR
-- ---------------------------------------------------------------------------
-- Devuelve los publicados que TIENEN mail cargado (sin mail no hay a donde
-- mandar la invitacion, y ofrecerlos seria ofrecer algo que no funciona), y
-- marca los que YA estan invitados a este pedido para no mandarles dos veces.
--
-- ⚠️ NO devuelve el mail. Solo si lo tiene o no.
CREATE OR REPLACE FUNCTION public.staff_app_proveedores_para_invitar(
  p_request_id uuid,
  p_categoria  text DEFAULT NULL,
  p_org        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  PERFORM 1 FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true, 'proveedores', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'profile_id',   mp.id,
             'display_name', mp.display_name,
             'headline',     mp.headline,
             'provincia',    mp.provincia,
             'ciudad',       mp.ciudad,
             'is_verified',  mp.is_verified,
             'categorias',   (SELECT coalesce(jsonb_agg(DISTINCT s.categoria), '[]'::jsonb)
                                FROM staff_app.provider_services s
                               WHERE s.profile_id = mp.id AND s.activo),
             'ya_invitado',  EXISTS (SELECT 1 FROM staff_app.quote_invites i
                                      WHERE i.request_id = p_request_id
                                        AND i.profile_id = mp.id))
           ORDER BY mp.display_name)
    FROM staff_app.marketplace_profiles mp
   WHERE mp.tipo IN ('proveedor', 'salon')
     AND mp.activo AND mp.is_public
     AND coalesce(btrim(mp.email), '') <> ''
     AND (p_categoria IS NULL OR EXISTS (
       SELECT 1 FROM staff_app.provider_services s
        WHERE s.profile_id = mp.id AND s.activo AND s.categoria = p_categoria))
  ), '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- (3) REENVIAR una invitacion
-- ---------------------------------------------------------------------------
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
  v_req record;
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
  -- Reenviarle a alguien que ya cotizo es ruido y encima confunde.
  IF EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = p_invite_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_cotizo');
  END IF;

  -- Token nuevo: el original no se puede reconstruir. Los dos valen.
  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE staff_app.quote_invites
     SET token_hash_alt = encode(extensions.digest(v_raw, 'sha256'), 'hex'),
         enviado_at     = NULL   -- se vuelve a estampar cuando el mail salga
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
      'cierra_at', v_inv.cierra_at));
END;
$$;

-- ---------------------------------------------------------------------------
-- (4) EXTENDER el cierre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_extender_cierre(
  p_request_id uuid,
  p_cierra_at  timestamptz,
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
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;
  -- Un pedido adjudicado o cancelado no se reabre: los que cotizaron ya
  -- recibieron un mail diciendo como termino.
  IF v_req.estado <> 'abierta' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_esta_abierto');
  END IF;
  IF p_cierra_at IS NULL OR p_cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'fecha_invalida');
  END IF;

  UPDATE staff_app.quote_requests SET cierra_at = p_cierra_at WHERE id = p_request_id;

  -- ⚠️ Los tokens tambien se corren. Sin esto, extender el pedido dejaria
  -- invitaciones vivas con links vencidos.
  UPDATE staff_app.quote_invites
     SET token_expires_at = greatest(token_expires_at, p_cierra_at + interval '30 days')
   WHERE request_id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'cierra_at', p_cierra_at);
END;
$$;

-- ---------------------------------------------------------------------------
-- (5) LAS COTIZACIONES QUE ENTRARON, para el feed de actividad
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_cotizaciones_recientes(
  p_org   uuid DEFAULT NULL,
  p_limit int  DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'updated_at' DESC)
    FROM (
      SELECT jsonb_build_object(
               'quote_id',   q.id,
               'request_id', r.id,
               'titulo',     r.titulo,
               'proveedor',  coalesce(i.nombre, i.email),
               'monto',      q.monto,
               'moneda',     q.moneda,
               'estado',     q.estado,
               'updated_at', q.updated_at) AS x
      FROM staff_app.quotes q
      JOIN staff_app.quote_invites  i ON i.id = q.invite_id
      JOIN staff_app.quote_requests r ON r.id = i.request_id
     WHERE r.organization_id = v_org
     ORDER BY q.updated_at DESC
     LIMIT least(greatest(coalesce(p_limit, 20), 1), 100)
    ) sub
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- PERMISOS
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.staff_app_proveedores_para_invitar(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_reenviar_invitacion(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_extender_cierre(uuid, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_app_cotizaciones_recientes(uuid, int) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.staff_app_proveedores_para_invitar(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_reenviar_invitacion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_extender_cierre(uuid, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_cotizaciones_recientes(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.staff_app_proveedores_para_invitar(uuid, text, uuid) IS
  'Los proveedores del directorio que se pueden invitar a un pedido: publicados y CON mail cargado (sin mail no hay a donde mandar), marcando los que ya estan invitados. NO devuelve el mail: la productora no ve el contacto.';
COMMENT ON FUNCTION public.staff_app_reenviar_invitacion(uuid, uuid) IS
  'Reemite la invitacion de un invitado que todavia no cotizo: emite un token NUEVO (el original no se puede reconstruir), limpia enviado_at para que se vuelva a estampar cuando el mail salga, y devuelve lo que hace falta para armar el mail.';
COMMENT ON FUNCTION public.staff_app_extender_cierre(uuid, timestamptz, uuid) IS
  'Corre la fecha de cierre de un pedido abierto y, con ella, el vencimiento de los tokens de sus invitaciones. Sin lo segundo, extender dejaria links muertos en un pedido vivo.';
COMMENT ON FUNCTION public.staff_app_cotizaciones_recientes(uuid, int) IS
  'Las ultimas cotizaciones recibidas por la organizacion, para el feed de actividad. Un pedido que junta respuestas y no avisa es un pedido que se olvida.';

COMMIT;
