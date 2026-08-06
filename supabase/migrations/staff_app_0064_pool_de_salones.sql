-- staff_app_0064_pool_de_salones
-- EL CUARTO POOL: los salones y espacios para eventos.
--
-- Franco (6/8): "podriamos sumar salones de eventos de manera gratuita, deberia
-- ser un nuevo pool, VENUES/SALONES".
--
-- ── POR QUE NO SE PORTAN LAS 4 TABLAS DE HITO ───────────────────────────────
-- HITO tiene el modulo entero construido y sin usar (venues, venue_availability,
-- venue_bookings, venue_inquiries + 19 pantallas). Se miro antes de escribir una
-- linea, y el diseño de ahi es el que se copia. Pero las TABLAS no se traen, por
-- una razon concreta: un salon, para el marketplace, es casi identico a un
-- proveedor. Nombre, mail, telefono, direccion, ciudad, provincia, web,
-- instagram, bio, publicarse, despublicarse, panel por link magico, panel por
-- sesion, formulario de consulta, consultas recibidas y moderacion: TODO eso ya
-- existe y esta probado en marketplace_profiles.
--
-- Traer un arbol de tablas paralelo seria duplicar seis meses de maquinaria para
-- ganar tres campos. Lo unico verdaderamente propio de un salon es CUANTA GENTE
-- ENTRA, y eso va en una tabla chica al lado.
--
-- ── LO QUE HABILITA ESTO, GRATIS ────────────────────────────────────────────
-- Al ser un `tipo` mas de marketplace_profiles, el salon hereda sin escribir
-- nada: el alta abierta, el token, `/mi-proveedor` por sesion, publicarse solo,
-- el formulario de consulta, ver sus consultas (0063) y la moderacion (0061).
--
-- La 0042 ya lo habia anticipado. Su comentario, textual: "abrirlo a 'persona'
-- el dia de mañana es tocar este IF, no escribir otra migracion". Es exactamente
-- lo que se hace acá.

-- ── (1) El tipo nuevo ───────────────────────────────────────────────────────
ALTER TABLE staff_app.marketplace_profiles
  DROP CONSTRAINT IF EXISTS marketplace_profiles_tipo_check;

ALTER TABLE staff_app.marketplace_profiles
  ADD CONSTRAINT marketplace_profiles_tipo_check
  CHECK (tipo = ANY (ARRAY['persona'::text, 'proveedor'::text, 'salon'::text]));

-- El slug (que es la URL publica) lo pone un trigger que solo miraba a los
-- proveedores. Sin esto un salon nace sin slug y la vidriera no lo muestra:
-- staff_app_vidriera_buscar exige `slug IS NOT NULL`.
DROP TRIGGER IF EXISTS marketplace_profiles_slug ON staff_app.marketplace_profiles;
CREATE TRIGGER marketplace_profiles_slug
  BEFORE INSERT OR UPDATE OF display_name, slug ON staff_app.marketplace_profiles
  FOR EACH ROW WHEN (new.tipo IN ('proveedor', 'salon'))
  EXECUTE FUNCTION staff_app.asignar_slug_perfil();

-- ── (2) Lo unico propio de un salon ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_app.venue_details (
  profile_id     uuid PRIMARY KEY
                 REFERENCES staff_app.marketplace_profiles(id) ON DELETE CASCADE,
  -- La busqueda de un salon es por CUANTA GENTE ENTRA. Es su equivalente de la
  -- "categoria" del proveedor: sin esto no se lo puede encontrar para nada.
  capacidad_min  int,
  capacidad_max  int,
  superficie_m2  int,
  direccion      text,
  -- Texto libre a proposito, igual que las categorias de proveedor: los rubros
  -- de un salon cambian mas rapido que las migraciones.
  amenities      text[] NOT NULL DEFAULT '{}',
  tipos_evento   text[] NOT NULL DEFAULT '{}',
  -- La pregunta que hace TODA persona que busca salon, y la que mas discusiones
  -- evita despues: si puede traer su propio catering o esta obligada al de la casa.
  catering_propio boolean,
  estacionamiento boolean,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_capacidad_coherente
    CHECK (capacidad_min IS NULL OR capacidad_max IS NULL OR capacidad_min <= capacidad_max)
);

COMMENT ON TABLE staff_app.venue_details IS
  'Lo UNICO propio de un salon. Todo lo demas (nombre, contacto, ubicacion, publicarse, token, panel, consultas, moderacion) vive en marketplace_profiles con tipo=salon y se hereda de la maquinaria del proveedor, ya probada.';

ALTER TABLE staff_app.venue_details ENABLE ROW LEVEL SECURITY;
-- Sin politicas a proposito: igual que provider_services, todo el acceso pasa
-- por las RPC SECURITY DEFINER, que resuelven identidad por token o por sesion.

CREATE INDEX IF NOT EXISTS venue_details_capacidad
  ON staff_app.venue_details (capacidad_max, capacidad_min);

-- ── (3) Abrir las dos puertas ya construidas al tipo nuevo ──────────────────
-- Un solo IF cada una, como habia anticipado la 0042.
CREATE OR REPLACE FUNCTION staff_app.perfil_proveedor_por_token(p_token text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT p.id
    FROM staff_app.marketplace_profiles p
   WHERE p.access_token_hash IS NOT NULL
     AND p.access_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     AND p.access_token_expires_at IS NOT NULL
     AND p.access_token_expires_at > now()
     AND p.tipo IN ('proveedor', 'salon')
     AND p.activo
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION staff_app.perfil_proveedor_del_caller()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT p.id
    FROM staff_app.marketplace_profiles p
   WHERE p.user_id IS NOT NULL
     AND p.user_id = auth.uid()
     AND p.tipo IN ('proveedor', 'salon')
     AND p.activo
   LIMIT 1;
$$;

-- ── (4) El alta abierta del salon ───────────────────────────────────────────
-- Mismo contrato y mismas decisiones que staff_app_registrar_proveedor (0060):
-- perfil COMPLETO en un paso, publicado al toque, token crudo devuelto UNA vez,
-- solo service_role, y reinscribirse regenera el token sin pisar los datos.
CREATE OR REPLACE FUNCTION public.staff_app_registrar_salon(
  p_nombre         text,
  p_email          text,
  p_provincia      text,
  p_capacidad_max  int,
  p_telefono       text DEFAULT NULL,
  p_headline       text DEFAULT NULL,
  p_bio            text DEFAULT NULL,
  p_ciudad         text DEFAULT NULL,
  p_direccion      text DEFAULT NULL,
  p_website        text DEFAULT NULL,
  p_instagram      text DEFAULT NULL,
  p_capacidad_min  int  DEFAULT NULL,
  p_superficie_m2  int  DEFAULT NULL,
  p_amenities      text[] DEFAULT '{}',
  p_tipos_evento   text[] DEFAULT '{}',
  p_catering_propio boolean DEFAULT NULL,
  p_estacionamiento boolean DEFAULT NULL,
  p_dias           int  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_nombre text := left(btrim(coalesce(p_nombre, '')), 200);
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_prov   text := nullif(left(btrim(coalesce(p_provincia, '')), 120), '');
  v_id     uuid;
  v_slug   text;
  v_raw    text := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash   text := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  v_expira timestamptz := now() + make_interval(days => greatest(1, coalesce(p_dias, 30)));
  v_amen   text[];
  v_tipos  text[];
BEGIN
  IF v_nombre = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_email');
  END IF;
  -- Sin provincia no aparece en ninguna busqueda: publicarlo seria publicarlo
  -- invisible, que es peor que rechazar el alta. Mismo criterio que las
  -- provincias del proveedor en la 0060.
  IF v_prov IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_provincia');
  END IF;
  -- Y sin capacidad tampoco: es LA dimension con la que se busca un salon.
  IF p_capacidad_max IS NULL OR p_capacidad_max <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_capacidad');
  END IF;
  IF p_capacidad_min IS NOT NULL AND p_capacidad_min > p_capacidad_max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacidad_invertida');
  END IF;

  -- Normalizacion igual que las provincias del proveedor: recorta, saca vacios,
  -- dedupe y tope. Si acá hubiera otra regla, el mismo dato entraria distinto
  -- segun por donde se cargue.
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 80)), '{}') INTO v_amen
    FROM unnest(coalesce(p_amenities, '{}'::text[])) AS x WHERE btrim(coalesce(x, '')) <> '';
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 80)), '{}') INTO v_tipos
    FROM unnest(coalesce(p_tipos_evento, '{}'::text[])) AS x WHERE btrim(coalesce(x, '')) <> '';
  IF coalesce(array_length(v_amen, 1), 0) > 40 THEN v_amen := v_amen[1:40]; END IF;
  IF coalesce(array_length(v_tipos, 1), 0) > 40 THEN v_tipos := v_tipos[1:40]; END IF;

  SELECT id, slug INTO v_id, v_slug
    FROM marketplace_profiles
   WHERE lower(email) = v_email AND tipo = 'salon';

  IF FOUND THEN
    UPDATE marketplace_profiles
       SET access_token_hash = v_hash, access_token_expires_at = v_expira,
           access_token_last_used_at = NULL, activo = true, updated_at = now()
     WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'slug', v_slug,
                              'token', v_raw, 'expires_at', v_expira, 'ya_existia', true);
  END IF;

  INSERT INTO marketplace_profiles (
    tipo, email, display_name, telefono, headline, bio,
    ciudad, provincia, website, instagram,
    is_public, activo, origen, access_token_hash, access_token_expires_at
  ) VALUES (
    'salon', v_email, v_nombre,
    nullif(left(btrim(coalesce(p_telefono, '')), 60), ''),
    nullif(left(btrim(coalesce(p_headline, '')), 200), ''),
    nullif(left(btrim(coalesce(p_bio, '')), 2000), ''),
    nullif(left(btrim(coalesce(p_ciudad, '')), 120), ''),
    v_prov,
    nullif(left(btrim(coalesce(p_website, '')), 300), ''),
    nullif(left(btrim(coalesce(p_instagram, '')), 120), ''),
    true, true, 'alta_abierta', v_hash, v_expira
  )
  RETURNING id, slug INTO v_id, v_slug;

  INSERT INTO venue_details (
    profile_id, capacidad_min, capacidad_max, superficie_m2, direccion,
    amenities, tipos_evento, catering_propio, estacionamiento
  ) VALUES (
    v_id, p_capacidad_min, p_capacidad_max, p_superficie_m2,
    nullif(left(btrim(coalesce(p_direccion, '')), 300), ''),
    v_amen, v_tipos, p_catering_propio, p_estacionamiento
  );

  RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'slug', v_slug,
                            'token', v_raw, 'expires_at', v_expira, 'ya_existia', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_registrar_salon(
  text, text, text, int, text, text, text, text, text, text, text, int, int,
  text[], text[], boolean, boolean, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_registrar_salon(
  text, text, text, int, text, text, text, text, text, text, text, int, int,
  text[], text[], boolean, boolean, int) TO service_role;

-- ── (5) La vidriera de salones ──────────────────────────────────────────────
-- Aparte de la de proveedores a proposito: se busca distinto. Un proveedor se
-- busca por rubro; un salon, por cuanta gente entra y donde queda.
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_salones(
  p_texto     text DEFAULT NULL,
  p_provincia text DEFAULT NULL,
  p_personas  int  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_t text := nullif(btrim(lower(coalesce(p_texto, ''))), '');
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'display_name')
    FROM (
      SELECT jsonb_build_object(
        'slug', p.slug, 'display_name', p.display_name, 'headline', p.headline,
        'bio', p.bio, 'ciudad', p.ciudad, 'provincia', p.provincia,
        'is_verified', p.is_verified,
        'capacidad_min', v.capacidad_min, 'capacidad_max', v.capacidad_max,
        'superficie_m2', v.superficie_m2,
        'amenities', to_jsonb(v.amenities), 'tipos_evento', to_jsonb(v.tipos_evento),
        'catering_propio', v.catering_propio, 'estacionamiento', v.estacionamiento
      ) AS x
      FROM staff_app.marketplace_profiles p
      JOIN staff_app.venue_details v ON v.profile_id = p.id
      WHERE p.tipo = 'salon' AND p.activo AND p.is_public AND p.slug IS NOT NULL
        AND (p_provincia IS NULL OR p.provincia = p_provincia)
        -- "Entramos 180 personas": el salon sirve si su techo alcanza y su piso
        -- no lo supera. Sin esto la busqueda por capacidad no significa nada.
        AND (p_personas IS NULL OR (
              coalesce(v.capacidad_max, 2147483647) >= p_personas
          AND coalesce(v.capacidad_min, 0) <= p_personas))
        AND (v_t IS NULL OR (
             lower(coalesce(p.display_name,'')) LIKE '%' || v_t || '%'
          OR lower(coalesce(p.headline,''))     LIKE '%' || v_t || '%'
          OR lower(coalesce(p.bio,''))          LIKE '%' || v_t || '%'
          OR lower(coalesce(p.ciudad,''))       LIKE '%' || v_t || '%'
          OR EXISTS (SELECT 1 FROM unnest(v.tipos_evento) t WHERE lower(t) LIKE '%' || v_t || '%')
          OR EXISTS (SELECT 1 FROM unnest(v.amenities) a WHERE lower(a) LIKE '%' || v_t || '%')))
      LIMIT 100
    ) sub
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_vidriera_salones(text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_salones(text, text, int) TO anon, authenticated;

-- ── (6) La ficha publica de un salon ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_salon(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v jsonb;
BEGIN
  -- NO se devuelve el mail ni el telefono del salon, igual que en la ficha del
  -- proveedor: el punto es que la consulta pase por el formulario y quede
  -- registrada, no que se copien los datos y se salga por afuera.
  SELECT jsonb_build_object(
    'profile_id', p.id, 'slug', p.slug, 'display_name', p.display_name,
    'headline', p.headline, 'bio', p.bio, 'ciudad', p.ciudad,
    'provincia', p.provincia, 'direccion', v2.direccion,
    'website', p.website, 'instagram', p.instagram, 'is_verified', p.is_verified,
    'capacidad_min', v2.capacidad_min, 'capacidad_max', v2.capacidad_max,
    'superficie_m2', v2.superficie_m2,
    'amenities', to_jsonb(v2.amenities), 'tipos_evento', to_jsonb(v2.tipos_evento),
    'catering_propio', v2.catering_propio, 'estacionamiento', v2.estacionamiento
  ) INTO v
  FROM staff_app.marketplace_profiles p
  JOIN staff_app.venue_details v2 ON v2.profile_id = p.id
  WHERE p.slug = p_slug AND p.tipo = 'salon' AND p.activo AND p.is_public;

  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible'); END IF;
  RETURN v || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_vidriera_salon(text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_salon(text) TO anon, authenticated;

-- ── (7) Que Franco pueda moderarlos igual que a los proveedores ─────────────
-- Un IF, no una pantalla nueva: con alta abierta, un salon publicado sin forma
-- de bajarlo es el mismo riesgo que ya se tapo en la 0061.
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_moderar_proveedor(
  p_profile_id uuid, p_bajar boolean, p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  IF p_bajar AND coalesce(btrim(p_motivo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_motivo');
  END IF;

  UPDATE staff_app.marketplace_profiles
     SET is_public = NOT p_bajar,
         moderado_at = CASE WHEN p_bajar THEN now() ELSE NULL END,
         moderado_motivo = CASE WHEN p_bajar THEN btrim(p_motivo) ELSE NULL END,
         updated_at = now()
   WHERE id = p_profile_id
     AND tipo IN ('proveedor', 'salon');

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  RETURN jsonb_build_object('ok', true, 'bajado', p_bajar);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_proveedores()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'id', p.id, 'nombre', p.display_name, 'slug', p.slug, 'email', p.email,
             'tipo', p.tipo,
             'headline', p.headline, 'bio', p.bio, 'ciudad', p.ciudad,
             'provincia', p.provincia, 'is_public', p.is_public, 'activo', p.activo,
             'origen', p.origen, 'created_at', p.created_at,
             'moderado_at', p.moderado_at, 'moderado_motivo', p.moderado_motivo,
             'servicios', (SELECT count(*) FROM staff_app.provider_services s
                            WHERE s.profile_id = p.id AND s.activo),
             'consultas', (SELECT count(*) FROM staff_app.provider_contacts c
                            WHERE c.profile_id = p.id)
           ) AS x
      FROM staff_app.marketplace_profiles p
     WHERE p.tipo IN ('proveedor', 'salon')
       AND staff_app.is_platform_admin()
  ) t;
$$;

REVOKE ALL ON FUNCTION public.staff_app_plataforma_proveedores() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_proveedores() TO authenticated;

NOTIFY pgrst, 'reload schema';
