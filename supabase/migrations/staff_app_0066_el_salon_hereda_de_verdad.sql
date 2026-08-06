-- staff_app_0066_el_salon_hereda_de_verdad
--
-- LA 0064 PROMETIO MAS DE LO QUE ABRIO.
--
-- Su comentario dice, textual: "al ser un `tipo` mas de marketplace_profiles, el
-- salon hereda sin escribir nada: el alta abierta, el token, /mi-proveedor por
-- sesion, publicarse solo, el formulario de consulta, ver sus consultas (0063) y
-- la moderacion (0061)".
--
-- Eso es cierto SOLO para las funciones que resuelven identidad llamando a
-- `perfil_proveedor_por_token` / `perfil_proveedor_del_caller`, que son las dos
-- que la 0064 efectivamente abrio. Las que filtran `tipo = 'proveedor'` con su
-- propio WHERE no se enteraron de nada, y son cinco. Medido contra la base el
-- 6/8 cruzando `pg_get_functiondef` de las 38 funciones del modulo.
--
-- ── LO QUE ESTABA ROTO, EN ORDEN DE GRAVEDAD ────────────────────────────────
--
-- 1. `staff_app_vidriera_consultar` filtraba proveedor. O sea: un salon se podia
--    registrar, aparecia en la vidriera, alguien entraba a su ficha... y la
--    consulta rebotaba con 'no_disponible'. Recibir la consulta es LO UNICO que
--    el pool de salones tiene que hacer. Sin esto el cuarto pool era una vidriera
--    de solo lectura.
--
-- 2. `staff_app_vincular_proveedor` filtraba proveedor. La ficha del salon nunca
--    se ataba a la cuenta al entrar por /entrar, asi que el dueño entraba y veia
--    "todavia no tenes perfil". Es EXACTAMENTE el sintoma que ya costo una
--    sesion entera del lado del proveedor y que quedo anotado como "la ficha
--    nace sin cuenta y se ata recien al entrar": el arreglo de aquella vez no
--    cubria a un tipo que todavia no existia.
--
-- 3. `staff_app_email_es_proveedor` filtraba proveedor, asi que /entrar no
--    reconocia al salon y lo mandaba por la puerta equivocada.
--
-- 4. `staff_app_formulario_proveedor` filtraba proveedor: la ficha publica del
--    salon no tenia preguntas que mostrar.
--
-- 5. `staff_app_mi_proveedor_guardar_formulario` filtraba proveedor: el salon no
--    podia definir sus propias preguntas desde su panel.
--
-- ── LA REGLA QUE DEJA ESTO ──────────────────────────────────────────────────
-- Sumar un `tipo` no es solo tocar el CHECK y los resolvedores de identidad. Hay
-- que barrer TODAS las funciones que nombren el tipo viejo, porque cada `WHERE
-- tipo = 'proveedor'` suelto es una puerta que queda cerrada en silencio: no
-- tira error, devuelve vacio. La consulta que lo encuentra esta al pie.

-- ── (1) EL QUE IMPORTA: que un salon pueda recibir una consulta ─────────────
-- Identico a la version de la 0059 salvo el IN. Se copia entera y no se parchea
-- porque el freno de abuso de tres capas vive adentro y partirlo seria dejar la
-- puerta abierta a que una de las capas se pierda en el proximo cambio.
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_consultar(
  p_profile_id uuid,
  p_respuestas jsonb,
  p_nombre     text,
  p_email      text,
  p_telefono   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_prov   record;
  v_email  text;
  v_nombre text;
  v_id     uuid;
  v_token  uuid := gen_random_uuid();
BEGIN
  -- El unico cambio de esta migracion en esta funcion: 'salon' entra.
  SELECT mp.id, mp.display_name, mp.email
    INTO v_prov
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo IN ('proveedor', 'salon') AND mp.activo AND mp.is_public;
  IF v_prov.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  IF p_respuestas IS NULL OR jsonb_typeof(p_respuestas) <> 'array'
     OR jsonb_array_length(p_respuestas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'consulta_vacia');
  END IF;
  IF jsonb_array_length(p_respuestas) > 12 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demasiados_campos');
  END IF;

  v_email := nullif(btrim(lower(coalesce(p_email, ''))), '');
  IF v_email IS NULL
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalido');
  END IF;

  v_nombre := nullif(btrim(coalesce(left(p_nombre, 160), '')), '');
  IF v_nombre IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  END IF;

  -- El freno de abuso, sin tocar: tres topes para tres ataques distintos.
  IF (SELECT count(*) FROM staff_app.provider_contacts
       WHERE origen = 'cliente' AND email_contacto = v_email
         AND created_at > now() - interval '1 hour') >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demasiadas_consultas');
  END IF;

  IF (SELECT count(*) FROM staff_app.provider_contacts
       WHERE origen = 'cliente' AND profile_id = p_profile_id
         AND created_at > now() - interval '1 hour') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'proveedor_saturado');
  END IF;

  IF (SELECT count(*) FROM staff_app.provider_contacts
       WHERE origen = 'cliente'
         AND created_at > now() - interval '1 hour') >= 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sistema_saturado');
  END IF;

  INSERT INTO staff_app.provider_contacts (
    organization_id, profile_id, gig_id, respuestas,
    nombre_contacto, email_contacto, telefono_contacto, origen, envio_token
  ) VALUES (
    NULL, p_profile_id, NULL, p_respuestas,
    v_nombre, v_email,
    nullif(btrim(coalesce(left(p_telefono, 40), '')), ''),
    'cliente', v_token
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'contacto_id', v_id,
    'envio_token', v_token,
    'proveedor', jsonb_build_object(
      'display_name', v_prov.display_name,
      'email',        v_prov.email
    )
  );
END;
$$;

-- ── (2) Que la ficha del salon tenga preguntas que mostrar ──────────────────
CREATE OR REPLACE FUNCTION public.staff_app_formulario_proveedor(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_nombre text;
  v_form   staff_app.provider_forms%ROWTYPE;
BEGIN
  SELECT mp.display_name INTO v_nombre
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo IN ('proveedor', 'salon') AND mp.activo AND mp.is_public;
  IF v_nombre IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  SELECT * INTO v_form FROM staff_app.provider_forms WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'display_name', v_nombre,
    'campos', coalesce(v_form.campos, '[]'::jsonb),
    'intro',  v_form.intro
  );
END;
$$;

-- ── (3) Que el salon pueda escribir sus propias preguntas ───────────────────
CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_guardar_formulario(
  p_campos jsonb, p_intro text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_perfil_id uuid;
  v_error     text;
BEGIN
  SELECT mp.id INTO v_perfil_id
    FROM staff_app.marketplace_profiles mp
   WHERE mp.user_id = auth.uid() AND mp.tipo IN ('proveedor', 'salon') AND mp.activo
   LIMIT 1;
  IF v_perfil_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  v_error := staff_app.validar_campos_formulario(p_campos);
  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_error);
  END IF;

  INSERT INTO staff_app.provider_forms (profile_id, campos, intro, updated_at)
  VALUES (
    v_perfil_id,
    coalesce(p_campos, '[]'::jsonb),
    nullif(btrim(coalesce(left(p_intro, 400), '')), ''),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET campos = EXCLUDED.campos,
        intro  = EXCLUDED.intro,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── (4) Que la ficha del salon se ate a su cuenta al entrar ─────────────────
-- Sin esto el dueño de un salon entra por /entrar, elige "soy proveedor" y le
-- sale "todavia no tenes perfil" con la ficha existiendo. Es el mismo sintoma
-- que ya se diagnostico mal una vez del lado del proveedor.
--
-- El antirrobo se mantiene intacto: si el perfil ya tiene dueño y es OTRO, no se
-- toca. Eso importa mas ahora, no menos: con dos tipos conviviendo, un mail
-- podria llegar a tener ficha de proveedor Y de salon.
CREATE OR REPLACE FUNCTION public.staff_app_vincular_proveedor()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := auth.email();
  v_id    uuid;
  v_dueno uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_sesion');
  END IF;

  SELECT id INTO v_id
    FROM marketplace_profiles
   WHERE user_id = v_uid AND tipo IN ('proveedor', 'salon') AND activo
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'ya_estaba', true);
  END IF;

  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  -- El ORDER BY no es decorativo. Si el mismo mail tiene ficha de proveedor y de
  -- salon, sin orden explicito la fila que sale depende del plan del planner, o
  -- sea que la misma persona podria atarse a una u otra segun el dia. Se ata a
  -- la mas vieja, que es la que viene usando.
  SELECT id, user_id INTO v_id, v_dueno
    FROM marketplace_profiles
   WHERE lower(email) = lower(btrim(v_email))
     AND tipo IN ('proveedor', 'salon') AND activo
   ORDER BY created_at
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  IF v_dueno IS NOT NULL AND v_dueno <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'perfil_de_otra_cuenta');
  END IF;

  UPDATE marketplace_profiles
     SET user_id = v_uid, updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'ya_estaba', false);
END;
$$;

-- ── (5) Que /entrar lo reconozca ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_email_es_proveedor(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.marketplace_profiles p
     WHERE p.tipo IN ('proveedor', 'salon')
       AND p.activo
       AND lower(p.email) = lower(btrim(coalesce(p_email, '')))
       AND btrim(coalesce(p_email, '')) <> ''
  );
$$;

-- ── (6) Que el panel sepa que esta mirando un salon ─────────────────────────
-- `proveedor_leer` es la lectura que usan LOS DOS paneles (el de token y el de
-- sesion), asi que se toca aca una vez y no en cada uno. Sin `tipo`, el panel no
-- tiene como saber si tiene que mostrar "servicios" o "capacidad", y un salon
-- veria la pantalla de un proveedor con una lista de servicios vacia.
--
-- `salon` va en NULL para un proveedor, no en objeto vacio: asi el cliente
-- pregunta `if (data.perfil.salon)` y no tiene que adivinar.
CREATE OR REPLACE FUNCTION staff_app.proveedor_leer(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $$
DECLARE
  v_p         marketplace_profiles%ROWTYPE;
  v_servicios jsonb;
  v_salon     jsonb;
BEGIN
  SELECT * INTO v_p FROM marketplace_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id',           s.id,
               'categoria',    s.categoria,
               'titulo',       s.titulo,
               'descripcion',  s.descripcion,
               'precio_desde', s.precio_desde,
               'moneda',       s.moneda,
               'unidad',       s.unidad,
               'provincias',   to_jsonb(s.provincias),
               'activo',       s.activo
             )
             ORDER BY s.created_at, s.id
           ),
           '[]'::jsonb
         )
    INTO v_servicios
    FROM provider_services s
   WHERE s.profile_id = p_profile_id;

  SELECT jsonb_build_object(
           'capacidad_min',   v.capacidad_min,
           'capacidad_max',   v.capacidad_max,
           'superficie_m2',   v.superficie_m2,
           'direccion',       v.direccion,
           'amenities',       to_jsonb(v.amenities),
           'tipos_evento',    to_jsonb(v.tipos_evento),
           'catering_propio', v.catering_propio,
           'estacionamiento', v.estacionamiento
         )
    INTO v_salon
    FROM venue_details v
   WHERE v.profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'perfil', jsonb_build_object(
      'id',           v_p.id,
      'tipo',         v_p.tipo,
      'display_name', v_p.display_name,
      'headline',     v_p.headline,
      'bio',          v_p.bio,
      'telefono',     v_p.telefono,
      'email',        v_p.email,
      'website',      v_p.website,
      'instagram',    v_p.instagram,
      'ciudad',       v_p.ciudad,
      'provincia',    v_p.provincia,
      'is_public',    v_p.is_public,
      'is_verified',  v_p.is_verified,
      'slug',         v_p.slug,
      'tiene_cuenta', (v_p.user_id IS NOT NULL),
      'salon',        v_salon
    ),
    'servicios', v_servicios
  );
END;
$$;

-- ── (7) Que el salon pueda corregir su capacidad ────────────────────────────
-- Es el unico dato con el que se lo busca. Si se equivoca al anotarse y no lo
-- puede editar, el salon queda invisible o mal listado para siempre, y la unica
-- salida seria borrarlo de la base a mano.
--
-- Resuelve identidad por sesion Y por token, igual que el resto del panel, para
-- que sirva tambien al que entra por el link magico y no tiene cuenta.
CREATE OR REPLACE FUNCTION public.staff_app_salon_guardar_detalles(
  p_capacidad_max   int,
  p_capacidad_min   int     DEFAULT NULL,
  p_superficie_m2   int     DEFAULT NULL,
  p_direccion       text    DEFAULT NULL,
  p_amenities       text[]  DEFAULT NULL,
  p_tipos_evento    text[]  DEFAULT NULL,
  p_catering_propio boolean DEFAULT NULL,
  p_estacionamiento boolean DEFAULT NULL,
  p_token           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $$
DECLARE
  v_id    uuid;
  v_amen  text[];
  v_tipos text[];
BEGIN
  -- La sesion primero: si hay cuenta, es la identidad mas fuerte. El token es el
  -- camino del que nunca creo cuenta, que sigue siendo valido a proposito.
  v_id := staff_app.perfil_proveedor_del_caller();
  IF v_id IS NULL AND coalesce(btrim(p_token), '') <> '' THEN
    v_id := staff_app.perfil_proveedor_por_token(p_token);
  END IF;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  -- Que sea un salon y no un proveedor: sin este chequeo, un proveedor con
  -- sesion valida podria crearse una fila en venue_details y aparecer en la
  -- vidriera de salones sin haberse anotado nunca ahi.
  IF NOT EXISTS (SELECT 1 FROM marketplace_profiles
                  WHERE id = v_id AND tipo = 'salon') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_es_salon');
  END IF;

  -- Mismas validaciones que el alta (0064). Si aca fueran otras, el mismo dato
  -- entraria distinto segun se cargue al anotarse o al editar.
  IF p_capacidad_max IS NULL OR p_capacidad_max <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_capacidad');
  END IF;
  IF p_capacidad_min IS NOT NULL AND p_capacidad_min > p_capacidad_max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacidad_invertida');
  END IF;

  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 80)), '{}') INTO v_amen
    FROM unnest(coalesce(p_amenities, '{}'::text[])) AS x WHERE btrim(coalesce(x, '')) <> '';
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 80)), '{}') INTO v_tipos
    FROM unnest(coalesce(p_tipos_evento, '{}'::text[])) AS x WHERE btrim(coalesce(x, '')) <> '';
  IF coalesce(array_length(v_amen, 1), 0)  > 40 THEN v_amen  := v_amen[1:40];  END IF;
  IF coalesce(array_length(v_tipos, 1), 0) > 40 THEN v_tipos := v_tipos[1:40]; END IF;

  INSERT INTO venue_details (
    profile_id, capacidad_min, capacidad_max, superficie_m2, direccion,
    amenities, tipos_evento, catering_propio, estacionamiento, updated_at
  ) VALUES (
    v_id, p_capacidad_min, p_capacidad_max, p_superficie_m2,
    nullif(left(btrim(coalesce(p_direccion, '')), 300), ''),
    v_amen, v_tipos, p_catering_propio, p_estacionamiento, now()
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET capacidad_min   = EXCLUDED.capacidad_min,
        capacidad_max   = EXCLUDED.capacidad_max,
        superficie_m2   = EXCLUDED.superficie_m2,
        direccion       = EXCLUDED.direccion,
        amenities       = EXCLUDED.amenities,
        tipos_evento    = EXCLUDED.tipos_evento,
        catering_propio = EXCLUDED.catering_propio,
        estacionamiento = EXCLUDED.estacionamiento,
        updated_at      = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Toda funcion nueva nace con EXECUTE para anon: el REVOKE FROM public no se lo
-- saca. Ya filtro datos una vez por no hacer esto explicito.
REVOKE ALL ON FUNCTION public.staff_app_salon_guardar_detalles(
  int, int, int, text, text[], text[], boolean, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_salon_guardar_detalles(
  int, int, int, text, text[], text[], boolean, boolean, text) TO authenticated, anon;
-- `anon` SI, a proposito y solo aca: el que entra por link magico no tiene
-- sesion, y sin esto el panel por token seria de solo lectura para un salon. El
-- gate real es el token, que se verifica adentro con hash y vencimiento.

-- ── LA CONSULTA QUE ENCUENTRA ESTE TIPO DE AGUJERO ──────────────────────────
-- Para la proxima vez que se sume un tipo, un rol o un estado. Lista toda
-- funcion del modulo que todavia nombre un solo tipo:
--
--   SELECT p.proname
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname IN ('public','staff_app')
--      AND p.proname LIKE 'staff_app%'
--      AND pg_get_functiondef(p.oid) LIKE '%tipo = ''proveedor''%';
--
-- Al 6/8, despues de esta migracion, las que quedan son a proposito: las de la
-- vidriera de proveedores y las de busqueda por rubro, que son de proveedores y
-- solo de proveedores. Los salones tienen las suyas (0064).

NOTIFY pgrst, 'reload schema';
