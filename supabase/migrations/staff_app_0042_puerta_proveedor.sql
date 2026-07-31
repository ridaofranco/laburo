-- ===========================================================================
-- 0042: LA PUERTA DE ENTRADA DEL PROVEEDOR (MARKETPLACE, MOVIMIENTO 2)
-- ===========================================================================
--
-- QUÉ PIDIÓ FRANCO (31/7): que los proveedores puedan OFRECER sus servicios.
-- La 0041 puso el cimiento (el perfil existe por sí mismo) y dejó escrito que
-- el proveedor todavía no podía entrar a nada. Esta migración es esa puerta.
--
-- === (a) EL PROBLEMA QUE RESUELVE ==========================================
--
-- Hoy el proveedor es PASIVO. Lo carga la productora (hito-live inserta en
-- public.vendors, y la 0041 lo copió a staff_app.marketplace_profiles) y no
-- tiene ninguna forma de entrar: no tiene cuenta, no tiene contraseña y su fila
-- no tiene user_id. O sea que no puede decir qué hace, dónde lo hace ni
-- publicarse. Sin eso, "que los proveedores ofrezcan sus servicios" no se puede
-- hacer, porque el proveedor no es dueño de nada.
--
-- Después de esta migración: la productora genera un link, el proveedor lo abre
-- desde el teléfono, completa su perfil, declara qué servicios presta y en qué
-- provincias trabaja, y se publica solo.
--
-- === (b) LA PUERTA ES EL TOKEN, NO UNA SESIÓN ==============================
--
-- La 0041 dejó las tres tablas con RLS y SOLO políticas de SELECT, con esta
-- nota: "Se abren recién en el movimiento 2, cuando el dueño del perfil pueda
-- entrar". ESA FRASE SE CORRIGE ACÁ, y es importante entender por qué.
--
-- El proveedor entra por un link mágico, no por una cuenta. Para Postgres es
-- `anon`: no tiene auth.uid(), así que una política del tipo
-- `USING (user_id = auth.uid())` NUNCA lo alcanzaría. Escribirla sería teatro.
--
-- Entonces las tablas se quedan SIN políticas de escritura A PROPÓSITO, y esta
-- migración no agrega ni una. La puerta es la función SECURITY DEFINER, que es
-- la disciplina que ya sigue todo staff_app desde la 0003. Es más seguro así:
-- cero escritura directa desde PostgREST, y toda escritura pasa por una función
-- que valida token, vencimiento y propiedad en el mismo lugar.
--
-- === (c) POR QUÉ EL TOKEN VA EN COLUMNAS Y NO EN UNA TABLA APARTE ==========
--
--   1. Es lo que ya hace staff_app.offers (token_hash + expires_at en la fila).
--      El patrón está probado en producción desde la 0003; inventar otro sería
--      una segunda forma de hacer lo mismo, con sus propios errores nuevos.
--   2. UNA SOLA PUERTA VIVA POR VEZ. Regenerar el link pisa el hash anterior, o
--      sea que el link viejo muere solo. Con una tabla aparte habría N tokens
--      vivos a la vez y habría que escribir la revocación a mano. La propiedad
--      de seguridad que queremos sale gratis de la columna.
--   3. Sin JOIN en el camino caliente: cada RPC por token hace un solo SELECT
--      contra un índice único.
--   4. Una tabla aparte solo se paga si hiciera falta auditoría de accesos o
--      varias puertas simultáneas. Ninguna de las dos hace falta hoy, y sumarla
--      ahora sería una tabla vacía con RLS que mantener.
--
-- Se guarda SOLO el sha256 del token. El token en crudo se devuelve una vez, al
-- generarlo, y no se persiste ni se loguea en ningún lado (igual que la 0008).
--
-- === (d) POR QUÉ LAS FUNCIONES VAN EN public Y DE UNA SOLA CAPA ============
--
-- staff_app NO está expuesto por PostgREST (PGRST106, verificado en la Fase 1),
-- así que el cliente anon no puede llamar nada que viva ahí. En el repo hay dos
-- patrones: el viejo (RPC interna en staff_app + wrapper en public, 0003/0009,
-- que existe porque la interna ya estaba escrita) y el nuevo (una sola función
-- public.staff_app_*, SECURITY DEFINER, search_path pineado: 0004/0008/0040).
--
-- Acá se usa el de UNA SOLA CAPA. Todo es nuevo, no hay nada que envolver, y
-- dos capas serían dos superficies que mantener y dos lugares donde
-- equivocarse con los GRANT.
--
-- === WR-05: LOS GRANT SE ESCRIBEN UNO POR UNO ==============================
--
-- En este proyecto manejado, ALTER DEFAULT PRIVILEGES ... REVOKE es un no-op, y
-- Supabase vuelve a grantear anon en cada CREATE OR REPLACE de una función de
-- public (por eso existe la 0019 entera). Cada función de acá lleva su
-- REVOKE ALL ... FROM PUBLIC, anon explícito con la firma completa, y recién
-- después el GRANT que corresponde. Sin excepción.
--
-- === QUÉ NO HACE, A PROPÓSITO ==============================================
--
-- 100% ADITIVA. No borra una columna, no reescribe una función existente, no
-- toca ninguna tabla que la app use hoy. No le da login con cuenta a nadie (no
-- puebla user_id), no abre la puerta a tipo = 'persona' (las seis funciones
-- filtran tipo = 'proveedor'; el día que se quiera abrir es cambiar un guard,
-- no una migración, porque las columnas del token viven en la tabla compartida)
-- y no construye ni la búsqueda ni el directorio, que son el movimiento 4.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- (1) LAS TRES COLUMNAS DEL TOKEN
--
--     ADD COLUMN IF NOT EXISTS: la migración se puede correr dos veces sin
--     romperse, igual que el resto del esquema.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.marketplace_profiles
  ADD COLUMN IF NOT EXISTS access_token_hash         text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS access_token_last_used_at timestamptz;

-- Único y parcial. Hace dos cosas de una: resuelve el token en un solo hit de
-- índice (es el camino caliente de las cinco RPCs por token) y garantiza que
-- dos perfiles no puedan compartir hash, que sería el peor bug posible acá.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_access_token_key
  ON staff_app.marketplace_profiles (access_token_hash)
  WHERE access_token_hash IS NOT NULL;

COMMENT ON COLUMN staff_app.marketplace_profiles.access_token_hash IS
  'sha256 (hex) del token de acceso del proveedor. NUNCA se guarda el token en crudo: se devuelve una sola vez cuando la productora genera el link y no queda escrito en ninguna columna ni en ningún log. Mismo algoritmo que staff_app.offers.token_hash (0003/0008), asi que la disciplina es una sola en todo el proyecto. Regenerar el link pisa este valor, o sea que el link anterior queda muerto: hay una sola puerta viva por perfil.';
COMMENT ON COLUMN staff_app.marketplace_profiles.access_token_expires_at IS
  'Hasta cuándo vale el link del proveedor. Se chequea ADENTRO de las funciones SECURITY DEFINER, nunca en el cliente, asi que no se puede saltear. Un token vencido devuelve exactamente lo mismo que un token inventado (SQL NULL), para no confirmarle a nadie que el link existió.';
COMMENT ON COLUMN staff_app.marketplace_profiles.access_token_last_used_at IS
  'Cuándo se usó por última vez el link. Alcanza para saber si el proveedor entró o si hay que volver a mandárselo. No es una auditoría de accesos (eso sería una tabla aparte y hoy no se justifica): guarda el último uso, no el historial.';


-- ---------------------------------------------------------------------------
-- (2) EL RESOLVEDOR DEL TOKEN, EN UN SOLO LUGAR
--
--     Las cinco RPCs por token necesitan exactamente el mismo guard: hash que
--     coincide, no vencido, tipo proveedor y activo. Escribirlo cinco veces es
--     pedir que una de las cinco quede distinta el día que alguien toque una
--     sola. Vive en staff_app (que no está expuesto por PostgREST) y se revoca
--     de todo el mundo: solo se llama desde adentro de las funciones DEFINER,
--     que corren como el dueño. Misma disciplina que los resolvedores de org de
--     la 0035.
--
--     Devuelve el id del perfil o NULL. NUNCA distingue entre "token inventado"
--     y "token vencido": las dos cosas son NULL, asi que no hay oráculo.
-- ---------------------------------------------------------------------------
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
     AND p.tipo = 'proveedor'
     AND p.activo
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION staff_app.perfil_proveedor_por_token(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.perfil_proveedor_por_token(text) IS
  'Resuelve el perfil de proveedor al que corresponde un token de acceso: hash coincide AND no vencido AND tipo proveedor AND activo. Devuelve el id o NULL, sin distinguir token inventado de token vencido. Es el guard compartido de las cinco RPCs por token, escrito una sola vez para que ninguna quede distinta. Revocado de PUBLIC, anon y authenticated: solo se llama desde adentro de las funciones SECURITY DEFINER de public.';


-- ---------------------------------------------------------------------------
-- (3) LA PRODUCTORA GENERA EL LINK (MKT2-04)
--
--     Esta es la única función de la migración que NO es por token: la llama
--     una productora autenticada. anon nunca, en ningún caso: no es una puerta
--     pública, es la que fabrica las puertas.
--
--     ORDEN OBLIGATORIO DEL GATE, que es la lección de la 0040: PRIMERO se
--     averigua de qué organización es el perfil, y RECIÉN DESPUÉS se pregunta
--     si el caller puede escribir en ESA organización. Al revés, el gate se
--     evaluaría contra una org fija y un writer de la productora B no podría
--     generar el link de su propio proveedor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_generar_link_proveedor(
  p_profile_id uuid,
  p_dias       int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_perfil  marketplace_profiles%ROWTYPE;
  v_org     uuid;
  v_links   int;
  v_raw     text := encode(extensions.gen_random_bytes(32), 'hex');    -- 256 bits, 64 hex
  v_hash    text := encode(extensions.digest(v_raw, 'sha256'), 'hex'); -- lo único que persiste
  v_expira  timestamptz := now() + make_interval(days => greatest(1, coalesce(p_dias, 30)));
BEGIN
  SELECT * INTO v_perfil FROM marketplace_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'perfil_no_encontrado');
  END IF;

  -- El movimiento 2 es solo para proveedores. Las columnas del token viven en
  -- la tabla compartida a propósito, asi que abrirlo a 'persona' el día de
  -- mañana es tocar este IF, no escribir otra migración.
  IF v_perfil.tipo <> 'proveedor' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_es_proveedor');
  END IF;

  IF NOT v_perfil.activo THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'perfil_inactivo');
  END IF;

  -- Paso 1: ¿de quién es este perfil? La org sale de los vínculos reales, no de
  -- una constante ni de algo que mande el caller.
  SELECT count(*) INTO v_links FROM profile_org_links WHERE profile_id = v_perfil.id;

  IF v_links > 0 THEN
    -- Paso 2: de las productoras vinculadas, ¿en alguna el caller es writer? Si
    -- en ninguna, es un authenticated que intenta abrirle la puerta al proveedor
    -- de otra productora: forbidden.
    SELECT l.organization_id INTO v_org
      FROM profile_org_links l
     WHERE l.profile_id = v_perfil.id
       AND staff_app.is_org_writer(l.organization_id)
     ORDER BY l.created_at, l.organization_id
     LIMIT 1;

    IF v_org IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
  ELSE
    -- El perfil todavía no tiene vínculo con nadie (un proveedor cargado a mano
    -- que quedó suelto). Se resuelve la org del caller, se gatea contra ESA, y
    -- se crea el vínculo en la MISMA transacción: si el gate falla no queda un
    -- link a medio hacer, y si pasa el proveedor ya queda en el pool de quien
    -- le abrió la puerta.
    v_org := staff_app.resolve_org(NULL);

    IF v_org IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'sin_organizacion');
    END IF;

    IF NOT staff_app.is_org_writer(v_org) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;

    INSERT INTO profile_org_links (profile_id, organization_id, relacion)
    VALUES (v_perfil.id, v_org, 'pool')
    ON CONFLICT (profile_id, organization_id) DO NOTHING;
  END IF;

  -- Regenerar pisa el hash anterior: el link viejo queda muerto sin que nadie
  -- tenga que revocarlo. last_used_at vuelve a NULL porque es otra puerta.
  UPDATE marketplace_profiles
     SET access_token_hash         = v_hash,
         access_token_expires_at   = v_expira,
         access_token_last_used_at = NULL,
         updated_at                = now()
   WHERE id = v_perfil.id;

  -- El token en crudo sale de acá UNA sola vez y no queda escrito en ningún
  -- lado. Si se pierde, se genera otro (y el anterior muere solo).
  RETURN jsonb_build_object(
    'ok',         true,
    'profile_id', v_perfil.id,
    'token',      v_raw,
    'expires_at', v_expira
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_generar_link_proveedor(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_generar_link_proveedor(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.staff_app_generar_link_proveedor(uuid, int) IS
  'Genera el link de acceso de un proveedor (MKT2-04) y devuelve el token en CRUDO una sola vez: {ok,profile_id,token,expires_at}. Solo persiste el sha256 (256 bits de extensions.gen_random_bytes, igual que 0003/0008). Resuelve la organización DEL PERFIL leyendo profile_org_links y recién después gatea con staff_app.is_org_writer sobre esa org (lección de la 0040); si el perfil no tiene vínculo, usa staff_app.resolve_org(NULL), gatea y crea el vínculo pool en la misma transacción. Regenerar pisa el hash anterior, o sea que el link viejo muere solo. Reasons: perfil_no_encontrado, no_es_proveedor, perfil_inactivo, forbidden, sin_organizacion. authenticated EXECUTE; anon NUNCA (esto fabrica puertas, no es una puerta).';


-- ---------------------------------------------------------------------------
-- (4) EL PROVEEDOR LEE LO SUYO (MKT2-02)
--
--     VOLATILE a propósito: estampa access_token_last_used_at. Por eso la
--     página que la llama va con force-dynamic, si no se serviría cacheada y el
--     sello no correría nunca.
--
--     Devuelve SOLO el perfil propio y sus servicios. Nunca otro perfil, nunca
--     los profile_org_links (la nota interna y el rating privado son de cada
--     productora, y la 0041 se los revoca hasta a authenticated).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_proveedor_perfil(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id        uuid := staff_app.perfil_proveedor_por_token(p_token);
  v_p         marketplace_profiles%ROWTYPE;
  v_servicios jsonb;
BEGIN
  -- SQL NULL, sin filtrar si el token existió y venció o si nunca existió.
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sello de uso. NO toca updated_at: updated_at es "cuándo cambió el
  -- contenido del perfil", y abrir el link no lo cambia.
  UPDATE marketplace_profiles
     SET access_token_last_used_at = now()
   WHERE id = v_id;

  SELECT * INTO v_p FROM marketplace_profiles WHERE id = v_id;

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
   WHERE s.profile_id = v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'perfil', jsonb_build_object(
      'id',           v_p.id,
      'display_name', v_p.display_name,
      'headline',     v_p.headline,
      'bio',          v_p.bio,
      'telefono',     v_p.telefono,
      -- email va de solo lectura: junto con el tipo es la clave única del
      -- perfil, asi que cambiarlo podría chocar contra otro perfil o dejar al
      -- proveedor sin forma de que lo contacten. Se cambia avisándole a DER.
      'email',        v_p.email,
      'website',      v_p.website,
      'instagram',    v_p.instagram,
      'ciudad',       v_p.ciudad,
      'provincia',    v_p.provincia,
      'is_public',    v_p.is_public,
      -- Solo lectura, siempre. Lo activa DER, no el que se verifica a sí mismo.
      'is_verified',  v_p.is_verified,
      'slug',         v_p.slug
    ),
    'servicios', v_servicios
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_perfil(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_perfil(text) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_perfil(text) IS
  'Lectura por token del proveedor (MKT2-02): devuelve su propio perfil (datos editables + email/slug/is_verified de solo lectura) y el array de sus provider_services. Valida adentro hash + expires_at > now() + tipo proveedor + activo; si algo no da, devuelve SQL NULL sin distinguir token inventado de token vencido. NUNCA devuelve otro perfil ni los profile_org_links (nota interna y rating privado son de cada productora). VOLATILE porque estampa access_token_last_used_at, por eso la página va con force-dynamic. anon + authenticated EXECUTE (el proveedor no tiene cuenta).';


-- ---------------------------------------------------------------------------
-- (5) EL PROVEEDOR GUARDA SUS DATOS (MKT2-02, MKT2-03)
--
--     ⚠️ EL SET LISTA LAS COLUMNAS ESCRIBIBLES UNA POR UNA, Y ESO ES EL
--     CONTROL DE SEGURIDAD, NO UN DETALLE DE ESTILO.
--
--     NO aparecen, y no pueden aparecer nunca:
--       is_verified  lo decide DER. Dejar que lo escriba el que se verifica a
--                    sí mismo vacía de sentido la verificación entera.
--       slug         es la identidad pública. Escribirlo habilita suplantar a
--                    otro en el directorio del movimiento 4.
--       rating_avg   se calcula a partir de las reseñas, no se declara.
--       review_count idem.
--       user_id      es la cuenta dueña del perfil. Escribirla desde un token
--                    sería regalarle el perfil a cualquier auth.users.
--       tipo         cambiar de proveedor a persona movería la fila a otra
--                    mitad del mercado, con otras reglas.
--       email        junto con el tipo es la clave única del perfil.
--       activo       la baja del perfil la maneja la productora, no el link.
-- ---------------------------------------------------------------------------
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

  IF coalesce(btrim(p_display_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nombre_requerido');
  END IF;

  -- Se recorta con left(btrim(...)) en vez de rechazar, igual que la 0040: el
  -- proveedor está escribiendo desde el teléfono y perder lo cargado por un
  -- caracter de más sería una pésima experiencia. Los nullif dejan NULL en vez
  -- de string vacío, asi que la UI puede omitir la fila.
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
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_guardar_perfil(text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_perfil(text, text, text, text, text, text, text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_guardar_perfil(text, text, text, text, text, text, text, text, text) IS
  'El proveedor guarda sus propios datos por token (MKT2-02). Resuelve el perfil DEL TOKEN y actualiza solo esa fila. El SET lista una por una las ocho columnas escribibles: is_verified, slug, rating_avg, review_count, user_id, tipo, email y activo NO están y no pueden estar (MKT2-03), porque la verificación la decide DER, el slug es la identidad pública del directorio, el rating se calcula y el email es la clave única del perfil. Recorta con left(btrim()) en vez de rechazar. Reasons: token_invalido, nombre_requerido. anon + authenticated EXECUTE.';


-- ---------------------------------------------------------------------------
-- (6) ALTA Y EDICIÓN DE UN SERVICIO
--
--     ⚠️ EL FILTRO POR profile_id DEL TOKEN ES LO MÁS IMPORTANTE DE TODA LA
--     MIGRACIÓN. El UPDATE filtra por `id = p_servicio_id AND profile_id =
--     v_id`, donde v_id sale del TOKEN y jamás de algo que mande el cliente.
--     Sin ese AND, un proveedor con un token perfectamente válido podría editar
--     el servicio de cualquier otro con solo mandar un uuid ajeno. Es el
--     agujero más probable de todo el movimiento 2.
--
--     Ojo con el orden de los parámetros: en Postgres los que tienen DEFAULT
--     van después de los que no, por eso p_servicio_id va cuarto y no segundo.
-- ---------------------------------------------------------------------------
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
  v_id          uuid := staff_app.perfil_proveedor_por_token(p_token);
  v_servicio_id uuid;
  v_provincias  text[];
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;

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
  -- de confiar: se limpian los vacíos, se recorta cada una y se sacan repetidas.
  -- El tope evita que alguien mande un array gigante por PostgREST y llene la
  -- fila (son 24 jurisdicciones, 40 ya es imposible de buena fe).
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
      v_id,
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
     -- El AND profile_id = v_id es el candado: v_id sale del token, p_servicio_id
     -- del cliente. Un id ajeno no matchea y no modifica nada.
     WHERE id = p_servicio_id
       AND profile_id = v_id
     RETURNING id INTO v_servicio_id;

    IF v_servicio_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'servicio_no_encontrado');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'servicio_id', v_servicio_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_guardar_servicio(text, text, text, uuid, text, numeric, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_servicio(text, text, text, uuid, text, numeric, text, text, text[]) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_guardar_servicio(text, text, text, uuid, text, numeric, text, text, text[]) IS
  'Alta (p_servicio_id NULL) o edición de un servicio del proveedor, por token. TODO UPDATE filtra por el profile_id resuelto DEL TOKEN y nunca por un id que mande el cliente: sin ese AND, un proveedor con token válido podría editar el servicio de otro (es el agujero más probable del movimiento 2). Valida categoría y título no vacíos, precio_desde >= 0, y normaliza el array de provincias (limpia vacíos, recorta, dedupe, tope 40). Devuelve {ok,servicio_id}. Reasons: token_invalido, categoria_requerida, titulo_requerido, precio_invalido, demasiadas_provincias, servicio_no_encontrado. anon + authenticated EXECUTE.';


-- ---------------------------------------------------------------------------
-- (7) BAJA DE UN SERVICIO
--
--     DELETE físico: un servicio que el proveedor sacó no tiene ningún valor
--     histórico (todavía no hay cotizaciones ni contrataciones colgando de él,
--     eso es el movimiento 3). Mismo candado por profile_id del token.
-- ---------------------------------------------------------------------------
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

  DELETE FROM provider_services
   WHERE id = p_servicio_id
     AND profile_id = v_id;   -- el candado, igual que en el UPDATE de arriba

  IF NOT FOUND THEN
    -- El servicio no existe o es de otro perfil. Se responde lo mismo en los dos
    -- casos, para no confirmarle a nadie que un uuid ajeno existe.
    RETURN jsonb_build_object('ok', false, 'reason', 'servicio_no_encontrado');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_borrar_servicio(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_borrar_servicio(text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_borrar_servicio(text, uuid) IS
  'Borra un servicio del proveedor por token. DELETE físico filtrado por el profile_id resuelto DEL TOKEN: un uuid de otro perfil no borra nada y devuelve el mismo servicio_no_encontrado que un uuid inexistente, asi que no hay oráculo. Reasons: token_invalido, servicio_no_encontrado. anon + authenticated EXECUTE.';


-- ---------------------------------------------------------------------------
-- (8) PUBLICARSE Y DESPUBLICARSE
--
--     Toca is_public y NADA MÁS. is_verified no se escribe acá ni en ningún
--     lado del flujo por token: publicarse es "quiero que me encuentren",
--     verificarse es "DER dice que soy confiable", y son dos cosas distintas.
--
--     Para pasar a público exige una completitud mínima. El motivo no es
--     burocrático: sin categoría y sin provincia, la búsqueda del movimiento 4
--     no lo puede encontrar, o sea que publicarlo sería publicar algo invisible
--     y el proveedor se quedaría esperando un pedido que nunca llega.
--     Despublicarse nunca valida nada: salir siempre tiene que ser libre.
-- ---------------------------------------------------------------------------
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
  v_id     uuid := staff_app.perfil_proveedor_por_token(p_token);
  v_p      marketplace_profiles%ROWTYPE;
  v_faltan text[] := '{}';
  v_con_servicio    boolean;
  v_con_provincia   boolean;
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;

  IF NOT coalesce(p_publicar, false) THEN
    UPDATE marketplace_profiles
       SET is_public  = false,
           updated_at = now()
     WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  SELECT * INTO v_p FROM marketplace_profiles WHERE id = v_id;

  SELECT EXISTS (SELECT 1 FROM provider_services s WHERE s.profile_id = v_id AND s.activo)
    INTO v_con_servicio;

  SELECT EXISTS (
           SELECT 1 FROM provider_services s
            WHERE s.profile_id = v_id
              AND s.activo
              AND array_length(s.provincias, 1) > 0
         )
    INTO v_con_provincia;

  IF coalesce(btrim(v_p.display_name), '') = '' THEN
    v_faltan := v_faltan || 'nombre';
  END IF;

  IF NOT v_con_servicio THEN
    v_faltan := v_faltan || 'servicios';
  END IF;

  IF v_con_servicio AND NOT v_con_provincia THEN
    v_faltan := v_faltan || 'provincias';
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    -- Se devuelve QUÉ falta, en códigos estables, para que la pantalla lo diga
    -- en castellano y accionable en vez de mostrar un error crudo.
    RETURN jsonb_build_object('ok', false, 'reason', 'faltan_datos', 'faltan', to_jsonb(v_faltan));
  END IF;

  UPDATE marketplace_profiles
     SET is_public  = true,
         updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) IS
  'El proveedor se publica o se despublica solo, por token. Toca is_public y nada más: is_verified lo activa DER y no se escribe en ningún punto del flujo por token. Para pasar a público exige completitud mínima (nombre visible, al menos un servicio activo, y al menos un servicio con provincias) porque sin categoría ni provincia la búsqueda del movimiento 4 no lo encuentra, o sea que sería publicar algo invisible; devuelve {ok:false, reason:faltan_datos, faltan:[nombre|servicios|provincias]} para que la pantalla diga qué falta. Despublicar nunca valida nada. Reasons: token_invalido, faltan_datos. anon + authenticated EXECUTE.';


-- ===========================================================================
-- Recargar el esquema de PostgREST. Sin esto las seis firmas nuevas no se ven
-- desde la API y el front come PGRST202.
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
