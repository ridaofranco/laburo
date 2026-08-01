-- ===========================================================================
-- 0045: EL PROVEEDOR TIENE CUENTA Y PERFIL PROPIOS, NO UN LINK QUE VENCE
-- ===========================================================================
--
-- QUÉ PASÓ (31/7): Franco abrió la pantalla del proveedor y dijo, textual:
-- "tiene que tener un perfil la persona, no puede no tener un perfil el
-- proveedor, es un desastre lo que me estás diciendo y lo peor es que lo ves
-- bien". Tenía razón.
--
-- === (a) EL PROBLEMA QUE RESUELVE ==========================================
--
-- La 0042 le dio al proveedor un token que vence a los 30 días. Si lo pierde o
-- se le vence, NO puede volver a entrar solo: depende de que la productora le
-- genere otro. Eso no es un perfil, es una invitación de un solo uso.
--
-- La pieza que faltaba estaba prevista desde el día uno y nunca se conectó. La
-- 0041 creó `marketplace_profiles.user_id` con este comentario:
--
--   "La cuenta del dueño del perfil. NULL hasta que entra por primera vez. Es
--    la pieza que permite que un proveedor OFREZCA sus servicios en vez de
--    esperar a que una productora lo cargue."
--
-- Esta migración la conecta. Después de acá: el link sigue siendo la primera
-- puerta (la invitación), y al entrar el proveedor se hace dueño de su perfil y
-- vuelve cuando quiere con su mail, para siempre.
--
-- === (b) POR QUÉ EL MAIL ALCANZA COMO PRUEBA DE PROPIEDAD ==================
--
-- `auth.email()` es un mail VERIFICADO por Supabase Auth: para que exista, la
-- persona tuvo que abrir un link que le llegó a esa casilla o entrar con
-- Google. O sea que controlar la casilla ES la prueba. Mismo razonamiento que
-- ya usa el staff desde la 0012, no se inventa un mecanismo nuevo.
--
-- === (c) LA ESTRUCTURA: DOS PUERTAS, UN SOLO JUEGO DE ESCRITORES ===========
--
-- Ahora hay dos formas de llegar al mismo perfil:
--   por TOKEN   (el proveedor todavía sin cuenta, o la invitación recién
--                abierta): resuelve con staff_app.perfil_proveedor_por_token
--   por SESIÓN  (el proveedor que ya es dueño): resuelve con
--                staff_app.perfil_proveedor_del_caller
--
-- Lo que NO se duplica es lo que pasa después. Las dos puertas terminan en los
-- MISMOS cinco escritores internos, que reciben un profile_id ya resuelto.
--
-- El motivo no es estético. La lista de las ocho columnas que el proveedor NO
-- puede tocar (is_verified, slug, rating_avg, review_count, user_id, tipo,
-- email, activo) es un CONTROL DE SEGURIDAD. Con dos copias, el día que alguien
-- agregue una columna a una y se olvide de la otra, la puerta que quedó vieja
-- se convierte en el agujero. Una sola lista, en un solo lugar.
--
-- === (d) POR QUÉ LAS FUNCIONES PÚBLICAS VAN EN public Y DE UNA CAPA ========
--
-- `staff_app` no está expuesto por PostgREST (PGRST106, verificado en la Fase
-- 1), así que el cliente no puede llamar nada que viva ahí. Se sigue el patrón
-- de la 0042: una sola función `public.staff_app_*`, SECURITY DEFINER, con el
-- search_path fijado. Los escritores internos viven en `staff_app` y están
-- revocados de todo el mundo justamente porque NO validan identidad: esa es la
-- responsabilidad del envoltorio que los llama.
--
-- === WR-05: LOS GRANT SE ESCRIBEN UNO POR UNO ==============================
--
-- En este proyecto manejado, Supabase vuelve a grantear `anon` en cada
-- CREATE OR REPLACE de una función de `public` (por eso existe la 0019 entera).
-- Cada función lleva su REVOKE con la firma completa y recién después el GRANT.
-- Sin excepción, y también en los reemplazos de las cinco que ya existían: si
-- se olvida uno, la puerta que Franco usa hoy se rompe o se abre de más.
--
-- === (e) QUÉ NO HACE, A PROPÓSITO ==========================================
--
-- **Se corrige una nota de la 0042.** Aquella dijo que no agregaba políticas
-- RLS de escritura porque el proveedor entraba como `anon` y sin `auth.uid()`
-- una política `user_id = auth.uid()` no lo alcanzaría nunca. **Ese motivo deja
-- de ser cierto acá**, porque ahora sí hay sesión. Igual no se agregan, y el
-- motivo nuevo es otro: no tendrían ningún consumidor (toda lectura y toda
-- escritura pasan por estas RPCs), y una política sin consumidor es superficie
-- que hay que mantener y que se desactualiza sola.
--
-- No toca `staff_profiles`, ni `vendors`, ni nada del cobro. No abre
-- `tipo = 'persona'`: las funciones siguen filtrando por 'proveedor'. No borra
-- ni una columna. No crea tablas.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- (A) EL RESOLVEDOR POR SESIÓN
--
--     Espejo exacto de staff_app.perfil_proveedor_por_token de la 0042, y con
--     la misma disciplina: vive en staff_app (no expuesto por PostgREST) y se
--     revoca de todos, porque solo se llama desde adentro de las funciones
--     DEFINER de public.
--
--     ⚠️ NO matchea por email a propósito. El enlace mail a cuenta ocurre UNA
--     sola vez, en staff_app_vincular_proveedor. Si el camino caliente también
--     resolviera por mail, habría dos formas distintas de contestar "de quién
--     es este perfil", y el día que difieran gana la que se ejecutó primero.
-- ---------------------------------------------------------------------------
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
     AND p.tipo = 'proveedor'
     AND p.activo
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION staff_app.perfil_proveedor_del_caller() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.perfil_proveedor_del_caller() IS
  'Resuelve el perfil de proveedor del usuario autenticado: user_id = auth.uid() AND tipo proveedor AND activo. Devuelve el id o NULL. Es el espejo por sesion de staff_app.perfil_proveedor_por_token, y el guard compartido de las cinco RPCs por sesion, escrito una sola vez para que ninguna quede distinta. NO matchea por email a proposito: el enlace mail a cuenta pasa una sola vez, en staff_app_vincular_proveedor, y tener dos formas de resolver el mismo perfil en el camino caliente es como se desincronizan. Revocado de PUBLIC, anon y authenticated: solo se llama desde adentro de las funciones SECURITY DEFINER de public.';


-- ---------------------------------------------------------------------------
-- (B) LOS CINCO ESCRITORES INTERNOS, COMPARTIDOS POR LAS DOS PUERTAS
--
--     Reciben un p_profile_id YA RESUELTO y NO validan identidad. Eso es a
--     propósito y es la razón por la que están revocados de todos: quien los
--     llama es el responsable de haber probado quién es. Un GRANT acá sería
--     entregarle a cualquiera la escritura de cualquier perfil.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION staff_app.proveedor_leer(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_p         marketplace_profiles%ROWTYPE;
  v_servicios jsonb;
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

  RETURN jsonb_build_object(
    'ok', true,
    'perfil', jsonb_build_object(
      'id',           v_p.id,
      'display_name', v_p.display_name,
      'headline',     v_p.headline,
      'bio',          v_p.bio,
      'telefono',     v_p.telefono,
      -- email de solo lectura: junto con el tipo es la clave unica del perfil,
      -- asi que cambiarlo podria chocar contra otro perfil o dejar al proveedor
      -- sin forma de que lo contacten. Se cambia avisandole a DER.
      'email',        v_p.email,
      'website',      v_p.website,
      'instagram',    v_p.instagram,
      'ciudad',       v_p.ciudad,
      'provincia',    v_p.provincia,
      'is_public',    v_p.is_public,
      -- Solo lectura, siempre. Lo activa DER, no el que se verifica a si mismo.
      'is_verified',  v_p.is_verified,
      'slug',         v_p.slug,
      -- Lo que le permite a la pantalla del TOKEN saber si ofrecer "crea tu
      -- cuenta" o "entra con tu mail". Se devuelve el booleano y NO el user_id:
      -- ninguna pantalla necesita el uuid de la cuenta, y no darlo es gratis.
      'tiene_cuenta', (v_p.user_id IS NOT NULL)
    ),
    'servicios', v_servicios
  );
END;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_leer(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_leer(uuid) IS
  'Lector interno del perfil de un proveedor y sus servicios. Recibe el profile_id YA RESUELTO y no valida identidad: eso es responsabilidad del envoltorio de public que lo llama (por token o por sesion). Devuelve {ok, perfil, servicios}; el perfil incluye tiene_cuenta (user_id IS NOT NULL) para que la pantalla del token sepa si ofrecer crear la cuenta, y NUNCA el user_id en si. No devuelve nada de profile_org_links: la nota interna y el rating privado son de cada productora. Revocado de todos.';


CREATE OR REPLACE FUNCTION staff_app.proveedor_set_perfil(
  p_profile_id   uuid,
  p_display_name text,
  p_headline     text DEFAULT NULL,
  p_bio          text DEFAULT NULL,
  p_telefono     text DEFAULT NULL,
  p_website      text DEFAULT NULL,
  p_instagram    text DEFAULT NULL,
  p_ciudad       text DEFAULT NULL,
  p_provincia    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  IF coalesce(btrim(p_display_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nombre_requerido');
  END IF;

  -- ⚠️ EL SET LISTA LAS COLUMNAS ESCRIBIBLES UNA POR UNA, Y ESO ES EL CONTROL
  -- DE SEGURIDAD, NO UN DETALLE DE ESTILO. Esta es ahora la UNICA copia de la
  -- lista en todo el proyecto: las dos puertas (token y sesion) terminan aca.
  --
  -- NO aparecen, y no pueden aparecer nunca:
  --   is_verified  lo decide DER. Dejar que lo escriba el que se verifica a si
  --                mismo vacia de sentido la verificacion entera.
  --   slug         es la identidad publica. Escribirlo habilita suplantar a
  --                otro en el directorio.
  --   rating_avg   se calcula a partir de las resenas, no se declara.
  --   review_count idem.
  --   user_id      es la cuenta duena del perfil. La escribe UNA sola funcion
  --                en todo el proyecto (staff_app_vincular_proveedor) y con su
  --                guard antirrobo. Aca seria regalarle el perfil a cualquiera.
  --   tipo         cambiar de proveedor a persona moveria la fila a otra mitad
  --                del mercado, con otras reglas.
  --   email        junto con el tipo es la clave unica del perfil.
  --   activo       la baja del perfil la maneja la productora, no el dueno.
  --
  -- Se recorta con left(btrim(...)) en vez de rechazar, igual que la 0040: el
  -- proveedor escribe desde el telefono y perder lo cargado por un caracter de
  -- mas seria una pesima experiencia. Los nullif dejan NULL en vez de string
  -- vacio, asi que la UI puede omitir la fila.
  UPDATE marketplace_profiles
     SET display_name = left(btrim(p_display_name), 160),
         headline     = nullif(left(btrim(coalesce(p_headline, '')), 200), ''),
         bio          = nullif(left(btrim(coalesce(p_bio, '')), 2000), ''),
         telefono     = nullif(left(btrim(coalesce(p_telefono, '')), 60), ''),
         website      = nullif(left(btrim(coalesce(p_website, '')), 300), ''),
         instagram    = nullif(left(btrim(coalesce(p_instagram, '')), 300), ''),
         ciudad       = nullif(left(btrim(coalesce(p_ciudad, '')), 120), ''),
         provincia    = nullif(left(btrim(coalesce(p_provincia, '')), 120), ''),
         updated_at   = now()
   WHERE id = p_profile_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_set_perfil(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_set_perfil(uuid, text, text, text, text, text, text, text, text) IS
  'Escritor interno de los datos del perfil. Recibe el profile_id YA RESUELTO y no valida identidad. Su SET es la UNICA copia en el proyecto de la lista de las ocho columnas escribibles: is_verified, slug, rating_avg, review_count, user_id, tipo, email y activo NO estan y no pueden estar. Con dos copias de esa lista, el dia que alguien agregue una columna a una y se olvide de la otra, la puerta olvidada es el agujero. Reason: nombre_requerido. Revocado de todos.';


CREATE OR REPLACE FUNCTION staff_app.proveedor_set_servicio(
  p_profile_id   uuid,
  p_categoria    text,
  p_titulo       text,
  p_servicio_id  uuid    DEFAULT NULL,
  p_descripcion  text    DEFAULT NULL,
  p_precio_desde numeric DEFAULT NULL,
  p_moneda       text    DEFAULT 'ARS',
  p_unidad       text    DEFAULT NULL,
  p_provincias   text[]  DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_servicio_id uuid;
  v_provincias  text[];
BEGIN
  IF coalesce(btrim(p_categoria), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'categoria_requerida');
  END IF;

  IF coalesce(btrim(p_titulo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'titulo_requerido');
  END IF;

  IF p_precio_desde IS NOT NULL AND p_precio_desde < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'precio_invalido');
  END IF;

  -- Las provincias llegan como array del cliente, asi que se normalizan en vez
  -- de confiar: se limpian los vacios, se recorta cada una y se sacan las
  -- repetidas. El tope evita que alguien mande un array gigante por PostgREST
  -- y llene la fila (son 24 jurisdicciones, 40 ya es imposible de buena fe).
  SELECT coalesce(array_agg(DISTINCT left(btrim(x), 120)), '{}')
    INTO v_provincias
    FROM unnest(coalesce(p_provincias, '{}'::text[])) AS x
   WHERE btrim(coalesce(x, '')) <> '';

  IF array_length(v_provincias, 1) > 40 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demasiadas_provincias');
  END IF;

  IF p_servicio_id IS NULL THEN
    INSERT INTO provider_services (
      profile_id, categoria, titulo, descripcion, precio_desde, moneda, unidad, provincias
    ) VALUES (
      p_profile_id,
      left(btrim(p_categoria), 120),
      left(btrim(p_titulo), 200),
      nullif(left(btrim(coalesce(p_descripcion, '')), 2000), ''),
      p_precio_desde,
      coalesce(nullif(btrim(coalesce(p_moneda, '')), ''), 'ARS'),
      nullif(left(btrim(coalesce(p_unidad, '')), 60), ''),
      v_provincias
    )
    RETURNING id INTO v_servicio_id;
  ELSE
    UPDATE provider_services
       SET categoria    = left(btrim(p_categoria), 120),
           titulo       = left(btrim(p_titulo), 200),
           descripcion  = nullif(left(btrim(coalesce(p_descripcion, '')), 2000), ''),
           precio_desde = p_precio_desde,
           moneda       = coalesce(nullif(btrim(coalesce(p_moneda, '')), ''), 'ARS'),
           unidad       = nullif(left(btrim(coalesce(p_unidad, '')), 60), ''),
           provincias   = v_provincias,
           updated_at   = now()
     -- ⚠️ EL AND profile_id ES EL CANDADO Y NO SE SACA NUNCA. p_profile_id lo
     -- resolvio el envoltorio (del token o de la sesion); p_servicio_id lo
     -- manda el cliente. Sin este AND, cualquiera con una puerta valida podria
     -- editar el servicio de otro mandando un uuid ajeno. La 0042 ya lo llamo
     -- "el agujero mas probable del movimiento 2", y ahora hay DOS puertas que
     -- llegan aca, asi que importa el doble.
     WHERE id = p_servicio_id
       AND profile_id = p_profile_id
     RETURNING id INTO v_servicio_id;

    IF v_servicio_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'servicio_no_encontrado');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'servicio_id', v_servicio_id);
END;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_set_servicio(uuid, text, text, uuid, text, numeric, text, text, text[]) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_set_servicio(uuid, text, text, uuid, text, numeric, text, text, text[]) IS
  'Escritor interno de alta (p_servicio_id NULL) o edicion de un servicio. Recibe el profile_id YA RESUELTO y no valida identidad. El UPDATE filtra por ese profile_id y nunca por un id que mande el cliente: es el candado que impide editar el servicio de otro, y ahora lo comparten las dos puertas. Normaliza el array de provincias (limpia vacios, recorta, dedupe, tope 40). Reasons: categoria_requerida, titulo_requerido, precio_invalido, demasiadas_provincias, servicio_no_encontrado. Revocado de todos.';


CREATE OR REPLACE FUNCTION staff_app.proveedor_del_servicio(
  p_profile_id  uuid,
  p_servicio_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  -- DELETE fisico: un servicio que el proveedor saco no tiene valor historico
  -- (todavia no hay cotizaciones ni contrataciones colgando, eso es el
  -- movimiento 3). Mismo candado por profile_id que el UPDATE de arriba.
  DELETE FROM provider_services
   WHERE id = p_servicio_id
     AND profile_id = p_profile_id;

  IF NOT FOUND THEN
    -- No existe, o es de otro perfil. Se responde lo mismo en los dos casos,
    -- para no confirmarle a nadie que un uuid ajeno existe.
    RETURN jsonb_build_object('ok', false, 'reason', 'servicio_no_encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_del_servicio(uuid, uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_del_servicio(uuid, uuid) IS
  'Escritor interno de la baja de un servicio. DELETE fisico filtrado por el profile_id YA RESUELTO: un uuid de otro perfil no borra nada y devuelve el mismo servicio_no_encontrado que un uuid inexistente, asi que no hay oraculo. Revocado de todos.';


CREATE OR REPLACE FUNCTION staff_app.proveedor_set_publicado(
  p_profile_id uuid,
  p_publicar   boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_p             marketplace_profiles%ROWTYPE;
  v_faltan        text[] := '{}';
  v_con_servicio  boolean;
  v_con_provincia boolean;
BEGIN
  IF NOT coalesce(p_publicar, false) THEN
    -- Despublicarse nunca valida nada: salir siempre tiene que ser libre.
    UPDATE marketplace_profiles
       SET is_public = false, updated_at = now()
     WHERE id = p_profile_id;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  SELECT * INTO v_p FROM marketplace_profiles WHERE id = p_profile_id;

  SELECT EXISTS (SELECT 1 FROM provider_services s WHERE s.profile_id = p_profile_id AND s.activo)
    INTO v_con_servicio;

  SELECT EXISTS (
           SELECT 1 FROM provider_services s
            WHERE s.profile_id = p_profile_id
              AND s.activo
              AND array_length(s.provincias, 1) > 0
         )
    INTO v_con_provincia;

  -- ⚠️ array_append y NUNCA el operador ||. Con `v_faltan || 'servicios'`,
  -- Postgres resuelve "array || array", intenta castear el literal a text[] y
  -- revienta con 22P02. Ese bug vivio en la 0042, paso typecheck, lint y build,
  -- y reventaba justo en el caso mas comun del primer uso: publicarse sin tener
  -- servicios cargados. Lo arreglo la 0043 y el cuerpo correcto es este.
  IF coalesce(btrim(v_p.display_name), '') = '' THEN
    v_faltan := array_append(v_faltan, 'nombre');
  END IF;

  IF NOT v_con_servicio THEN
    v_faltan := array_append(v_faltan, 'servicios');
  END IF;

  IF v_con_servicio AND NOT v_con_provincia THEN
    v_faltan := array_append(v_faltan, 'provincias');
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    -- Se devuelve QUE falta, en codigos estables, para que la pantalla lo diga
    -- en castellano y accionable en vez de mostrar un error crudo.
    RETURN jsonb_build_object('ok', false, 'reason', 'faltan_datos', 'faltan', to_jsonb(v_faltan));
  END IF;

  UPDATE marketplace_profiles
     SET is_public = true, updated_at = now()
   WHERE id = p_profile_id;

  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_set_publicado(uuid, boolean) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_set_publicado(uuid, boolean) IS
  'Escritor interno de publicarse y despublicarse. Toca is_public y nada mas: is_verified lo activa DER. Para pasar a publico exige completitud minima (nombre, al menos un servicio activo, y al menos un servicio con provincias) porque sin eso la busqueda no lo encuentra y seria publicar algo invisible. La lista de faltantes se arma con array_append: el operador || con un literal sin tipo intenta castearlo a text[] y revienta (bug de la 0042, corregido en la 0043). Reason: faltan_datos, con el array faltan. Revocado de todos.';


-- ---------------------------------------------------------------------------
-- (C) LAS CINCO POR TOKEN, AHORA ENVOLTORIOS FINOS
--
--     ⚠️ LAS FIRMAS NO CAMBIAN NI UNA COMA. El front las llama por nombre de
--     parametro y cualquier cambio le devuelve PGRST202. Lo unico que cambia es
--     el cuerpo: resuelven el perfil y delegan.
--
--     Y despues de CADA CREATE OR REPLACE va su REVOKE con la firma completa y
--     su GRANT, porque Supabase re-grantea anon en el reemplazo (0019). Si se
--     olvida uno, la puerta que Franco usa hoy queda distinta de como estaba.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_app_proveedor_perfil(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  -- SQL NULL, sin distinguir token inventado de token vencido: no hay oraculo.
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sello de uso. NO toca updated_at: updated_at es "cuando cambio el contenido
  -- del perfil", y abrir el link no lo cambia. Es lo que hace a esta funcion
  -- VOLATILE, y por eso la pagina que la llama va con force-dynamic: si se
  -- sirviera cacheada, el sello no correria nunca.
  UPDATE marketplace_profiles
     SET access_token_last_used_at = now()
   WHERE id = v_id;

  RETURN staff_app.proveedor_leer(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_perfil(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_perfil(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.staff_app_proveedor_guardar_perfil(
  p_token        text,
  p_display_name text,
  p_headline     text DEFAULT NULL,
  p_bio          text DEFAULT NULL,
  p_telefono     text DEFAULT NULL,
  p_website      text DEFAULT NULL,
  p_instagram    text DEFAULT NULL,
  p_ciudad       text DEFAULT NULL,
  p_provincia    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;
  RETURN staff_app.proveedor_set_perfil(v_id, p_display_name, p_headline, p_bio,
                                        p_telefono, p_website, p_instagram,
                                        p_ciudad, p_provincia);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_guardar_perfil(text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_perfil(text, text, text, text, text, text, text, text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.staff_app_proveedor_guardar_servicio(
  p_token        text,
  p_categoria    text,
  p_titulo       text,
  p_servicio_id  uuid    DEFAULT NULL,
  p_descripcion  text    DEFAULT NULL,
  p_precio_desde numeric DEFAULT NULL,
  p_moneda       text    DEFAULT 'ARS',
  p_unidad       text    DEFAULT NULL,
  p_provincias   text[]  DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;
  RETURN staff_app.proveedor_set_servicio(v_id, p_categoria, p_titulo, p_servicio_id,
                                          p_descripcion, p_precio_desde, p_moneda,
                                          p_unidad, p_provincias);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_guardar_servicio(text, text, text, uuid, text, numeric, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_servicio(text, text, text, uuid, text, numeric, text, text, text[]) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.staff_app_proveedor_borrar_servicio(
  p_token       text,
  p_servicio_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;
  RETURN staff_app.proveedor_del_servicio(v_id, p_servicio_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_borrar_servicio(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_borrar_servicio(text, uuid) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.staff_app_proveedor_publicar(
  p_token    text,
  p_publicar boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;
  RETURN staff_app.proveedor_set_publicado(v_id, p_publicar);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- (D) LAS FUNCIONES NUEVAS, POR SESIÓN
--
--     Todas granteadas SOLO a authenticated: son la puerta del que ya es dueño
--     de su perfil. anon nunca.
-- ---------------------------------------------------------------------------

-- ⚠️ ESTA ES LA UNICA FUNCION DE TODO EL PROYECTO QUE ESCRIBE user_id.
--
-- El mail que usa (auth.email()) es un mail VERIFICADO por Supabase Auth: para
-- que exista, la persona abrio un link que le llego a esa casilla o entro con
-- Google. Controlar la casilla ES la prueba de propiedad. Mismo razonamiento
-- que ya usa el staff desde la 0012.
--
-- Es idempotente a proposito, asi es segura de llamar en cada login.
CREATE OR REPLACE FUNCTION public.staff_app_vincular_proveedor()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
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

  -- Ya es dueno de un perfil: se devuelve tal cual, sin escribir nada.
  SELECT id INTO v_id
    FROM marketplace_profiles
   WHERE user_id = v_uid AND tipo = 'proveedor' AND activo
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'ya_estaba', true);
  END IF;

  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  SELECT id, user_id INTO v_id, v_dueno
    FROM marketplace_profiles
   WHERE lower(email) = lower(btrim(v_email)) AND tipo = 'proveedor' AND activo
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  -- ANTIRROBO: si el perfil ya tiene dueno y es OTRO, no se toca. Nunca se le
  -- saca un perfil a una cuenta que ya lo reclamo, ni siquiera si el mail
  -- coincide (puede haber cambiado de manos y el dueno actual es el que entro
  -- primero y lo esta usando).
  IF v_dueno IS NOT NULL AND v_dueno <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'perfil_de_otra_cuenta');
  END IF;

  UPDATE marketplace_profiles
     SET user_id = v_uid, updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_id, 'ya_estaba', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_vincular_proveedor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_vincular_proveedor() TO authenticated;

COMMENT ON FUNCTION public.staff_app_vincular_proveedor() IS
  'Hace duena de su perfil a la cuenta que acaba de entrar: la UNICA funcion del proyecto que escribe marketplace_profiles.user_id. Matchea por auth.email(), que es un mail VERIFICADO por Supabase Auth (link o Google), asi que controlar la casilla es la prueba de propiedad (mismo razonamiento que la 0012). Idempotente: si ya es duena devuelve el mismo profile_id sin escribir, o sea que es segura de llamar en cada login. ANTIRROBO: si el perfil ya tiene otro user_id devuelve perfil_de_otra_cuenta y NO escribe, nunca se le saca el perfil a la cuenta que lo reclamo primero. Reasons: sin_sesion, sin_perfil, perfil_de_otra_cuenta. authenticated EXECUTE; anon NUNCA.';


CREATE OR REPLACE FUNCTION public.staff_app_mi_perfil_proveedor()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  -- NO estampa access_token_last_used_at: ese sello es del link, no de una
  -- sesion. Mezclarlos haria que el "hace cuanto que no entra por el link"
  -- dejara de significar lo que dice.
  RETURN staff_app.proveedor_leer(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_perfil_proveedor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_perfil_proveedor() TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_perfil_proveedor() IS
  'El proveedor lee su propio perfil y sus servicios, por SESION. Resuelve con staff_app.perfil_proveedor_del_caller y delega en el mismo lector interno que usa la puerta por token. Devuelve SQL NULL si el caller no tiene perfil de proveedor. NO estampa access_token_last_used_at: ese sello es del link, no de una sesion. authenticated EXECUTE; anon NUNCA.';


CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_guardar_perfil(
  p_display_name text,
  p_headline     text DEFAULT NULL,
  p_bio          text DEFAULT NULL,
  p_telefono     text DEFAULT NULL,
  p_website      text DEFAULT NULL,
  p_instagram    text DEFAULT NULL,
  p_ciudad       text DEFAULT NULL,
  p_provincia    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;
  RETURN staff_app.proveedor_set_perfil(v_id, p_display_name, p_headline, p_bio,
                                        p_telefono, p_website, p_instagram,
                                        p_ciudad, p_provincia);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_guardar_perfil(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_guardar_perfil(text, text, text, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_guardar_perfil(text, text, text, text, text, text, text, text) IS
  'El proveedor guarda sus datos por SESION. Delega en el mismo escritor interno que la puerta por token, asi que la lista de las ocho columnas prohibidas (is_verified, slug, rating_avg, review_count, user_id, tipo, email, activo) es una sola y vale para las dos puertas. Reasons: sin_perfil, nombre_requerido. authenticated EXECUTE; anon NUNCA.';


CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_guardar_servicio(
  p_categoria    text,
  p_titulo       text,
  p_servicio_id  uuid    DEFAULT NULL,
  p_descripcion  text    DEFAULT NULL,
  p_precio_desde numeric DEFAULT NULL,
  p_moneda       text    DEFAULT 'ARS',
  p_unidad       text    DEFAULT NULL,
  p_provincias   text[]  DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;
  RETURN staff_app.proveedor_set_servicio(v_id, p_categoria, p_titulo, p_servicio_id,
                                          p_descripcion, p_precio_desde, p_moneda,
                                          p_unidad, p_provincias);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_guardar_servicio(text, text, uuid, text, numeric, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_guardar_servicio(text, text, uuid, text, numeric, text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_guardar_servicio(text, text, uuid, text, numeric, text, text, text[]) IS
  'Alta o edicion de un servicio del proveedor, por SESION. Delega en el escritor interno, que filtra todo UPDATE por el profile_id resuelto de la sesion y nunca por el id que manda el cliente. Reasons: sin_perfil, categoria_requerida, titulo_requerido, precio_invalido, demasiadas_provincias, servicio_no_encontrado. authenticated EXECUTE; anon NUNCA.';


CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_borrar_servicio(p_servicio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;
  RETURN staff_app.proveedor_del_servicio(v_id, p_servicio_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_borrar_servicio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_borrar_servicio(uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_borrar_servicio(uuid) IS
  'Baja de un servicio del proveedor, por SESION. Mismo candado por profile_id que la puerta por token: un uuid ajeno no borra nada y responde igual que uno inexistente. Reasons: sin_perfil, servicio_no_encontrado. authenticated EXECUTE; anon NUNCA.';


CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_publicar(p_publicar boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;
  RETURN staff_app.proveedor_set_publicado(v_id, p_publicar);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_publicar(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_publicar(boolean) TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_publicar(boolean) IS
  'El proveedor se publica o se despublica solo, por SESION. Delega en el escritor interno, que exige completitud minima para pasar a publico y arma la lista de faltantes con array_append (el operador || con un literal sin tipo revienta: bug de la 0042, corregido en la 0043). Reasons: sin_perfil, faltan_datos. authenticated EXECUTE; anon NUNCA.';


-- ⚠️ SOLO service_role, y el motivo es el mismo que el de staff_app_email_in_pool
-- en la 0018: la llama una server action ANTES de mandar un mail. Si fuera
-- alcanzable desde el browser, seria un oraculo de "este mail es proveedor" y
-- cualquiera podria enumerar el directorio con una lista de mails.
CREATE OR REPLACE FUNCTION public.staff_app_email_es_proveedor(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.marketplace_profiles p
     WHERE p.tipo = 'proveedor'
       AND p.activo
       AND lower(p.email) = lower(btrim(coalesce(p_email, '')))
       AND btrim(coalesce(p_email, '')) <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.staff_app_email_es_proveedor(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_email_es_proveedor(text) TO service_role;

COMMENT ON FUNCTION public.staff_app_email_es_proveedor(text) IS
  'Dice si un mail corresponde a un proveedor activo. Espejo de staff_app_email_in_pool (0018) y por el mismo motivo: la llama una server action con service-role ANTES de mandar un mail, para no mandarle acceso a cualquiera. Granteada SOLO a service_role; si fuera alcanzable desde el browser seria un oraculo de "este mail es proveedor" y se podria enumerar el directorio con una lista de mails.';


-- ===========================================================================
-- Recargar el esquema de PostgREST. Sin esto las firmas nuevas no se ven desde
-- la API y el front come PGRST202.
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
