-- Migration: staff_app_0080_el_recordatorio_antes_del_cierre
-- Escrita y APLICADA el 2026-09-05.
--
-- ETAPA 5 de LICITACIONES.md, y la que probablemente valga mas que todas las
-- anteriores juntas: sobre 370 correos, recordarle a los que no cotizaron es lo
-- unico que separa 2 respuestas de 6.
--
-- ---------------------------------------------------------------------------
-- LAS CUATRO CONDICIONES PARA QUE SALGA UN RECORDATORIO
-- ---------------------------------------------------------------------------
--   1. El pedido esta ABIERTO y todavia no cerro.
--   2. Cierra dentro de las proximas p_horas (48 por defecto).
--   3. Al invitado el mail de invitacion LE SALIO (`enviado_at IS NOT NULL`).
--      Si nunca salio, el problema no es que se haya olvidado: es que nunca se
--      entero. Mandarle un "te recuerdo" a alguien que no recibio nada es peor
--      que no escribirle.
--   4. Todavia NO cotizo. Al que ya cargo su numero no se lo apura.
--
-- UNO SOLO POR INVITACION, y por eso hay columna nueva: `recordado_at`. Sin
-- ella, la unica forma de no repetir seria mirar la fecha de cierre, y un cron
-- que corre todos los dias le escribiria todos los dias a la misma empresa
-- durante la semana previa. Un recordatorio es un favor; dos son spam.
--
-- ⚠️ `recordado_at` es columna propia y no reusa `enviado_at`: son dos mails
-- distintos y hay que poder distinguir "no le llego la invitacion" de "no le
-- llego el recordatorio".
--
-- ---------------------------------------------------------------------------
-- EL LINK DEL RECORDATORIO ES OTRO TOKEN, Y NO ES UN CAPRICHO
-- ---------------------------------------------------------------------------
-- Del token original solo queda su sha256, asi que el link NO se puede
-- reconstruir. Un recordatorio sin boton, que diga "buscá el mail anterior",
-- pierde a la mitad justo en el momento en que mas importa.
--
-- Se emite un token NUEVO, se guarda su hash en `token_hash_alt` y los DOS
-- valen a la vez, asi que el mail viejo tampoco se rompe. Es exactamente el
-- patron de la 0030 para el recordatorio de las ofertas de staff, que ya corre
-- en produccion. La alternativa (guardar el token en claro para poder
-- re-linkear) seria cambiar la seguridad del producto por la comodidad de un
-- mail.

BEGIN;

ALTER TABLE staff_app.quote_invites
  ADD COLUMN IF NOT EXISTS recordado_at   timestamptz,
  ADD COLUMN IF NOT EXISTS token_hash_alt text;

COMMENT ON COLUMN staff_app.quote_invites.recordado_at IS
  'Cuando le salio el recordatorio de "esto cierra pronto". Ancla de exactly-once: se estampa al seleccionar, asi que el cron no puede escribirle dos veces a la misma empresa. Distinta de enviado_at, que es la invitacion.';

COMMENT ON COLUMN staff_app.quote_invites.token_hash_alt IS
  'sha256 del SEGUNDO token, el que va en el recordatorio. El original no se puede reconstruir (solo se guarda su hash), asi que el recordatorio emite uno nuevo. Los dos valen a la vez: el mail viejo sigue funcionando. Mismo patron que offers.token_hash_alt (0030).';

CREATE UNIQUE INDEX IF NOT EXISTS quote_invites_token_alt_idx
  ON staff_app.quote_invites (token_hash_alt)
  WHERE token_hash_alt IS NOT NULL;

CREATE INDEX IF NOT EXISTS quote_invites_recordatorio_idx
  ON staff_app.quote_invites (request_id, recordado_at)
  WHERE recordado_at IS NULL;

-- ---------------------------------------------------------------------------
-- (1) LAS DOS PUERTAS DEL TOKEN ACEPTAN LOS DOS HASHES
-- ---------------------------------------------------------------------------
-- Sin esto, el link del recordatorio daria "este link no es valido", que es la
-- peor forma posible de recordarle algo a alguien.
CREATE OR REPLACE FUNCTION public.staff_app_ver_invitacion(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
                  'estado',         v_req.estado),
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

  SELECT * INTO v_inv FROM staff_app.quote_invites
   WHERE token_hash = v_hash OR token_hash_alt = v_hash;
  IF NOT FOUND OR v_inv.token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalido');
  END IF;

  SELECT * INTO v_req FROM staff_app.quote_requests WHERE id = v_inv.request_id;
  IF v_req.estado <> 'abierta' OR v_req.cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cerrado');
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'monto_required');
  END IF;
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
-- (2) LA TANDA. Mismo molde que welcome_batch: elige y ESTAMPA en la misma
--     sentencia, con FOR UPDATE SKIP LOCKED.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_recordatorios_cotizacion(
  p_horas int DEFAULT 48,
  p_limit int DEFAULT 100
)
RETURNS TABLE(
  invite_id      uuid,
  email          text,
  nombre         text,
  token          text,
  titulo         text,
  descripcion    text,
  categoria      text,
  provincia      text,
  ciudad         text,
  necesario_para date,
  cierra_at      timestamptz,
  organizacion   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_horas int := least(greatest(coalesce(p_horas, 48), 1), 168);
  v_limit int := least(greatest(coalesce(p_limit, 0), 0), 200);
BEGIN
  IF v_limit = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidatas AS (
    SELECT i.id, encode(extensions.gen_random_bytes(32), 'hex') AS raw
    FROM staff_app.quote_invites i
    JOIN staff_app.quote_requests r ON r.id = i.request_id
    WHERE r.estado = 'abierta'
      AND r.cierra_at > now()                                    -- todavia se puede cotizar
      AND r.cierra_at <= now() + make_interval(hours => v_horas) -- y cierra pronto
      AND i.enviado_at IS NOT NULL                               -- la invitacion SI le llego
      AND i.recordado_at IS NULL                                 -- uno solo por invitacion
      AND NOT EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = i.id)
    ORDER BY r.cierra_at
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), marcadas AS (
    UPDATE staff_app.quote_invites i
       SET recordado_at   = now(),
           token_hash_alt = encode(extensions.digest(c.raw, 'sha256'), 'hex')
      FROM candidatas c
     WHERE i.id = c.id
    RETURNING i.id, i.email, i.nombre, i.request_id, c.raw
  )
  SELECT m.id, m.email, m.nombre, m.raw,
         r.titulo, r.descripcion, r.categoria, r.provincia, r.ciudad,
         r.necesario_para, r.cierra_at, o.name
    FROM marcadas m
    JOIN staff_app.quote_requests r ON r.id = m.request_id
    JOIN staff_app.organizations  o ON o.id = r.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_recordatorios_cotizacion(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_recordatorios_cotizacion(int, int) TO service_role;

COMMENT ON FUNCTION public.staff_app_recordatorios_cotizacion(int, int) IS
  'La tanda del recordatorio "esto cierra pronto", para invitados que NO cotizaron de pedidos abiertos que cierran dentro de p_horas y a los que SI les salio la invitacion. Uno solo por invitacion (estampa recordado_at al seleccionar). Emite un SEGUNDO token y devuelve el crudo una unica vez: el original no se puede reconstruir. Solo service_role.';

-- Cuantos hay pendientes, para que el cron reporte sin mandar nada.
CREATE OR REPLACE FUNCTION public.staff_app_recordatorios_pendientes(p_horas int DEFAULT 48)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT count(*)::int
  FROM staff_app.quote_invites i
  JOIN staff_app.quote_requests r ON r.id = i.request_id
  WHERE r.estado = 'abierta'
    AND r.cierra_at > now()
    AND r.cierra_at <= now() + make_interval(hours => least(greatest(coalesce(p_horas, 48), 1), 168))
    AND i.enviado_at IS NOT NULL
    AND i.recordado_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM staff_app.quotes q WHERE q.invite_id = i.id);
$$;

REVOKE ALL ON FUNCTION public.staff_app_recordatorios_pendientes(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_recordatorios_pendientes(int) TO service_role;

COMMENT ON FUNCTION public.staff_app_recordatorios_pendientes(int) IS
  'Cuantos recordatorios de cotizacion saldrian ahora. Para que el cron reporte sin mandar nada.';

COMMIT;
