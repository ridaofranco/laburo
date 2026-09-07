-- Migration: staff_app_0083_el_perfil_de_la_productora
-- Escrita el 2026-09-07.
--
-- EL PERFIL DE LA AGENCIA NO SOLO NO SE EDITABA: MENTIA.
--
-- La pantalla de Ajustes mostraba, para TODA productora, este texto escrito a
-- mano en el codigo:
--
--   "Produccion de eventos. LABURO es la herramienta para buscar, contratar y
--    coordinar staff eventual sobre el pool real de postulantes."
--
-- O sea que FIEBRE DISCO entraba a SU perfil y leia una descripcion de LABURO
-- como si fuera la suya. Y "Ubicacion: Argentina" tambien era fijo. Viene de
-- cuando LABURO era interno de SOMOS DER y esos datos eran los del unico dueno:
-- el comentario de la pantalla todavia lo dice ("Perfil de la agencia = SOMOS
-- DER, el dueno real del v1 interno"). Con mas de una organizacion adentro,
-- ese atajo pasa a ser un dato falso.
--
-- Franco, 7/9/2026: *"El perfil de la agencia tambien deberia ser posible
-- editarlo porque ademas podrian ofrecerse como una productora mas que brinda
-- servicios de produccion o que produce eventos"*.
--
-- Esta migracion agrega los campos que la pantalla ya mostraba (y no tenia
-- donde guardar) mas los que hacen falta para esa segunda parte: que una
-- productora pueda mostrarse, no solo operar.
--
-- ⚠️ NINGUNA COLUMNA ES OBLIGATORIA. Las tres organizaciones que ya existen
-- siguen andando sin tocar una fila: donde no hay dato, la pantalla no inventa.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. LOS CAMPOS DEL PERFIL
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE staff_app.organizations
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS ciudad      text,
  ADD COLUMN IF NOT EXISTS provincia   text,
  ADD COLUMN IF NOT EXISTS pais        text,
  ADD COLUMN IF NOT EXISTS web         text,
  ADD COLUMN IF NOT EXISTS instagram   text,
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN staff_app.organizations.descripcion IS
  'Que hace esta productora, escrito por ella. Antes del 0083 este texto estaba cableado en la pantalla de Ajustes y era el mismo para todas: hablaba de LABURO, no de la organizacion.';
COMMENT ON COLUMN staff_app.organizations.logo_url IS
  'Logo propio. Mientras este en NULL la pantalla sigue mostrando el monograma de siempre (las iniciales), que es un fallback correcto y no un hueco.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. GUARDAR EL PERFIL
--
-- ⚠️ El nombre NO se toca desde aca, a proposito. `organizations.name` es lo
-- que ve el staff en cada oferta y lo que sale en los mails ya enviados:
-- renombrarse en caliente le cambia el remitente a conversaciones que ya
-- pasaron. Se edita todo lo demas; el nombre queda para una decision aparte.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_guardar_perfil_org(
  p_descripcion text    DEFAULT NULL,
  p_ciudad      text    DEFAULT NULL,
  p_provincia   text    DEFAULT NULL,
  p_pais        text    DEFAULT NULL,
  p_web         text    DEFAULT NULL,
  p_instagram   text    DEFAULT NULL,
  p_telefono    text    DEFAULT NULL,
  p_org         uuid    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_row record;
  -- Limpia un campo de texto: recorta, y convierte el vacio en NULL para que
  -- "borrar el campo" y "nunca lo llene" sean el mismo estado y la pantalla no
  -- tenga que distinguir dos vacios.
  v_desc  text := nullif(btrim(coalesce(p_descripcion, '')), '');
  v_ciu   text := nullif(btrim(coalesce(p_ciudad, '')), '');
  v_prov  text := nullif(btrim(coalesce(p_provincia, '')), '');
  v_pais  text := nullif(btrim(coalesce(p_pais, '')), '');
  v_web   text := nullif(btrim(coalesce(p_web, '')), '');
  v_ig    text := nullif(btrim(coalesce(p_instagram, '')), '');
  v_tel   text := nullif(btrim(coalesce(p_telefono, '')), '');
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  -- Mismo criterio que el resto del modulo: escribe quien puede escribir en la
  -- organizacion ELEGIDA en el selector, no en la membresia mas antigua.
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Topes de largo: es texto de un formulario publico del portal y termina
  -- pintado en una pantalla. 600 alcanza para describir a que se dedica una
  -- productora sin que la tarjeta se vuelva una pagina.
  IF length(coalesce(v_desc, '')) > 600 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'descripcion_larga');
  END IF;

  -- El instagram se guarda SIN arroba y sin la URL entera, venga como venga:
  -- si no, la pantalla tiene que adivinar el formato en cada lectura.
  IF v_ig IS NOT NULL THEN
    v_ig := regexp_replace(v_ig, '^(https?://)?(www\.)?instagram\.com/', '', 'i');
    v_ig := ltrim(v_ig, '@');
    v_ig := split_part(v_ig, '/', 1);
    v_ig := nullif(btrim(v_ig), '');
  END IF;

  -- La web sale siempre con esquema: un href sin http lo interpreta el
  -- navegador como ruta relativa y el link del perfil lleva a ningun lado.
  IF v_web IS NOT NULL AND v_web !~* '^https?://' THEN
    v_web := 'https://' || v_web;
  END IF;

  UPDATE staff_app.organizations
     SET descripcion = v_desc,
         ciudad      = v_ciu,
         provincia   = v_prov,
         pais        = v_pais,
         web         = v_web,
         instagram   = v_ig,
         telefono    = coalesce(v_tel, telefono),
         updated_at  = now()
   WHERE id = v_org
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'org_no_encontrada');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organizacion', jsonb_build_object(
      'id',          v_row.id,
      'name',        v_row.name,
      'descripcion', v_row.descripcion,
      'ciudad',      v_row.ciudad,
      'provincia',   v_row.provincia,
      'pais',        v_row.pais,
      'web',         v_row.web,
      'instagram',   v_row.instagram,
      'telefono',    v_row.telefono
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_guardar_perfil_org(text, text, text, text, text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_guardar_perfil_org(text, text, text, text, text, text, text, uuid) IS
  'Guarda el perfil de la organizacion ELEGIDA en el selector, validada con is_org_writer. No toca el nombre: eso sale en ofertas y mails ya enviados. Normaliza instagram (sin @ ni URL) y web (siempre con esquema).';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. LEER EL PERFIL
--
-- Existe para que la pantalla no tenga que saber que columnas mirar ni pelearse
-- con la RLS de `organizations` para una sola fila.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_perfil_org(
  p_org uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_row record;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM staff_app.organizations WHERE id = v_org;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id',          v_row.id,
    'name',        v_row.name,
    'descripcion', v_row.descripcion,
    'ciudad',      v_row.ciudad,
    'provincia',   v_row.provincia,
    'pais',        v_row.pais,
    'web',         v_row.web,
    'instagram',   v_row.instagram,
    'telefono',    v_row.telefono,
    'categoria',   v_row.categoria,
    'puede_editar', staff_app.is_org_writer(v_org)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_perfil_org(uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_perfil_org(uuid) IS
  'Devuelve el perfil de la organizacion elegida y si el que mira puede editarlo. NULL si no es miembro.';

COMMIT;
