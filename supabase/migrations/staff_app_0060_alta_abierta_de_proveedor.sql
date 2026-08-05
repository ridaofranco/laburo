-- staff_app_0060_alta_abierta_de_proveedor
-- El proveedor se anota SOLO. Antes de esto no habia forma de que empezara.
--
-- Decision de Franco (3/8): "No voy a cargar proveedores, tiene que estar listo
-- para que proveedores se carguen solos".
--
-- ── QUE FALTABA, EXACTAMENTE ─────────────────────────────────────────────────
-- Casi todo el camino del proveedor YA estaba construido en la 0042: con un
-- token, y SIN cuenta, el proveedor puede leer y guardar su perfil, cargar y
-- borrar servicios, armar su formulario de consulta y publicarse o
-- despublicarse solo. Faltaba UNA sola cosa: la puerta de entrada. El unico
-- generador de tokens era staff_app_generar_link_proveedor, que es
-- `authenticated` y exige ser writer de una productora, y ademas NINGUN archivo
-- del repo la llamaba. O sea que el token no lo podia obtener nadie, ni el
-- proveedor ni Franco.
--
-- Esta funcion es esa puerta: crea el perfil completo y devuelve el token crudo
-- UNA vez, para que el server action lo mande por mail.
--
-- ── LAS 3 DECISIONES DE FRANCO (3/8) QUE ESTAN IMPLEMENTADAS ACA ─────────────
-- 1. Aparece en la vidriera AL TOQUE, sin esperar aprobacion (is_public = true).
--    El control es despues: el server action le avisa a Franco con el link al
--    perfil para despublicar en un clic. No es opcional, es EL control.
-- 2. Se entra por dos puertas (la vidriera /servicios y la landing). Eso es
--    ruteo, vive en el front.
-- 3. El formulario es COMPLETO, no la version corta. Textual: "completo, todo lo
--    que hace, donde esta, que servicios, todo junto, como corresponde". Por eso
--    esta funcion recibe los servicios en el mismo alta y no despues: el perfil
--    nace listo para publicarse, sin un segundo paso donde se pierde la gente.
--
-- ── SEGURIDAD ────────────────────────────────────────────────────────────────
-- Granteada SOLO a service_role, mismo criterio que staff_app_crear_productora.
-- Si fuera anon-callable cualquiera crearia perfiles publicos en loop y el
-- directorio se llena de basura. El freno de abuso vive en el server action
-- (lib/rate-limit), igual que en /sumate y /registrar-productora.
--
-- ⚠️ REVOKE FROM public NO alcanza: toda funcion nueva de `public` nace con
-- EXECUTE para anon. Por eso el REVOKE nombra anon y authenticated explicito.

CREATE OR REPLACE FUNCTION public.staff_app_registrar_proveedor(
  p_nombre     text,
  p_email      text,
  p_servicios  jsonb,
  p_telefono   text DEFAULT NULL,
  p_headline   text DEFAULT NULL,
  p_bio        text DEFAULT NULL,
  p_ciudad     text DEFAULT NULL,
  p_provincia  text DEFAULT NULL,
  p_website    text DEFAULT NULL,
  p_instagram  text DEFAULT NULL,
  p_dias       int  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_nombre   text := left(btrim(coalesce(p_nombre, '')), 200);
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_id       uuid;
  v_slug     text;
  v_existia  boolean := false;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  v_expira   timestamptz := now() + make_interval(days => greatest(1, coalesce(p_dias, 30)));
  v_srv      jsonb;
  v_prov     text[];
  v_con_prov int := 0;
  v_validos  int := 0;
BEGIN
  IF v_nombre = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_email');
  END IF;

  -- ── Los servicios se validan ANTES de escribir nada ──────────────────────
  -- Sin al menos un servicio con provincias el perfil se publicaria INVISIBLE:
  -- staff_app_vidriera_buscar filtra por provincia, asi que un proveedor sin
  -- zona no aparece en ninguna busqueda. Publicar algo que nadie puede
  -- encontrar es peor que rechazar el alta, porque el proveedor cree que esta.
  IF p_servicios IS NULL OR jsonb_typeof(p_servicios) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_servicios');
  END IF;

  FOR v_srv IN SELECT * FROM jsonb_array_elements(p_servicios) LOOP
    IF coalesce(btrim(v_srv->>'categoria'), '') <> ''
       AND coalesce(btrim(v_srv->>'titulo'), '') <> '' THEN
      v_validos := v_validos + 1;

      SELECT coalesce(array_agg(DISTINCT left(btrim(x), 120)), '{}')
        INTO v_prov
        FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(v_srv->'provincias') = 'array'
                    THEN v_srv->'provincias' ELSE '[]'::jsonb END) AS x
       WHERE btrim(coalesce(x, '')) <> '';

      IF coalesce(array_length(v_prov, 1), 0) > 0 THEN
        v_con_prov := v_con_prov + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_validos = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_servicios');
  END IF;
  IF v_con_prov = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_provincias');
  END IF;

  -- ── ¿Ya existe? ──────────────────────────────────────────────────────────
  -- El caso normal de volver a registrarse es "no me llego el mail". Se
  -- regenera el token y se devuelve, pero NO se le pisan los datos: si ya
  -- cargo sus servicios y vuelve a entrar por la landing, perderlos seria
  -- destruir su trabajo por un click. El unico efecto es que el link viejo
  -- muere, que es lo correcto.
  SELECT id, slug INTO v_id, v_slug
    FROM marketplace_profiles
   WHERE lower(email) = v_email AND tipo = 'proveedor';

  IF FOUND THEN
    v_existia := true;
    UPDATE marketplace_profiles
       SET access_token_hash         = v_hash,
           access_token_expires_at   = v_expira,
           access_token_last_used_at = NULL,
           activo                    = true,
           updated_at                = now()
     WHERE id = v_id;

    RETURN jsonb_build_object(
      'ok', true, 'profile_id', v_id, 'slug', v_slug,
      'token', v_raw, 'expires_at', v_expira, 'ya_existia', true);
  END IF;

  -- ── Alta nueva ───────────────────────────────────────────────────────────
  -- is_public = true de entrada (decision 1 de Franco). Con el formulario
  -- completo la completitud esta garantizada, asi que no hay riesgo de
  -- publicar un perfil vacio: eso ya lo validamos arriba.
  -- El slug lo pone solo el trigger marketplace_profiles_slug.
  -- NO se crea profile_org_links a proposito: el que se anota solo no cuelga de
  -- ninguna productora. Verificado que staff_app_vidriera_buscar no exige
  -- vinculo con organizacion, asi que aparece igual.
  INSERT INTO marketplace_profiles (
    tipo, email, display_name, telefono, headline, bio,
    ciudad, provincia, website, instagram,
    is_public, activo, origen,
    access_token_hash, access_token_expires_at
  ) VALUES (
    'proveedor', v_email, v_nombre,
    nullif(left(btrim(coalesce(p_telefono, '')), 60), ''),
    nullif(left(btrim(coalesce(p_headline, '')), 200), ''),
    nullif(left(btrim(coalesce(p_bio, '')), 2000), ''),
    nullif(left(btrim(coalesce(p_ciudad, '')), 120), ''),
    nullif(left(btrim(coalesce(p_provincia, '')), 120), ''),
    nullif(left(btrim(coalesce(p_website, '')), 300), ''),
    nullif(left(btrim(coalesce(p_instagram, '')), 120), ''),
    true, true, 'alta_abierta',
    v_hash, v_expira
  )
  RETURNING id, slug INTO v_id, v_slug;

  -- Los servicios, con la MISMA normalizacion de provincias que
  -- staff_app_proveedor_guardar_servicio: recorta, saca vacios, dedupe y tope.
  -- Si aca hubiera otra regla, el mismo dato entraria distinto segun por donde
  -- se cargue y la busqueda por provincia empezaria a fallar de a poco.
  FOR v_srv IN SELECT * FROM jsonb_array_elements(p_servicios) LOOP
    CONTINUE WHEN coalesce(btrim(v_srv->>'categoria'), '') = ''
                OR coalesce(btrim(v_srv->>'titulo'), '') = '';

    SELECT coalesce(array_agg(DISTINCT left(btrim(x), 120)), '{}')
      INTO v_prov
      FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(v_srv->'provincias') = 'array'
                  THEN v_srv->'provincias' ELSE '[]'::jsonb END) AS x
     WHERE btrim(coalesce(x, '')) <> '';

    IF coalesce(array_length(v_prov, 1), 0) > 40 THEN
      v_prov := v_prov[1:40];
    END IF;

    INSERT INTO provider_services (
      profile_id, categoria, titulo, descripcion,
      precio_desde, moneda, unidad, provincias, activo
    ) VALUES (
      v_id,
      left(btrim(v_srv->>'categoria'), 120),
      left(btrim(v_srv->>'titulo'), 200),
      nullif(left(btrim(coalesce(v_srv->>'descripcion', '')), 2000), ''),
      CASE WHEN coalesce(btrim(v_srv->>'precio_desde'), '') ~ '^[0-9]+(\.[0-9]+)?$'
           THEN (v_srv->>'precio_desde')::numeric ELSE NULL END,
      coalesce(nullif(btrim(coalesce(v_srv->>'moneda', '')), ''), 'ARS'),
      nullif(left(btrim(coalesce(v_srv->>'unidad', '')), 60), ''),
      v_prov,
      true
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'profile_id', v_id, 'slug', v_slug,
    'token', v_raw, 'expires_at', v_expira, 'ya_existia', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_registrar_proveedor(
  text, text, jsonb, text, text, text, text, text, text, text, int
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.staff_app_registrar_proveedor(
  text, text, jsonb, text, text, text, text, text, text, text, int
) TO service_role;

COMMENT ON FUNCTION public.staff_app_registrar_proveedor(
  text, text, jsonb, text, text, text, text, text, text, text, int
) IS
  'Alta abierta de proveedor (decision de Franco 3/8: se cargan solos). Crea el perfil COMPLETO con sus servicios, lo publica al toque y devuelve el token crudo UNA vez para el link magico. SOLO service_role: si fuera anon-callable cualquiera llenaria la vidriera. El control posterior es el aviso a Franco que manda el server action.';
