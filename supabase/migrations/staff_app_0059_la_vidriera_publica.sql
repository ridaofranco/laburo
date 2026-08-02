-- staff_app_0059_la_vidriera_publica
--
-- FASE 4: EL CLIENTE FINAL BUSCA Y CONSULTA SIN TENER CUENTA.
--
-- ── QUÉ ES Y DÓNDE VIVE (Franco, 2/8) ──────────────────────────────────────
-- Se había propuesto sacar esto a un subdominio propio de SOMOS DER. Franco lo
-- corrigió y tiene razón: **esto es LABURO**. El proveedor es un lado del
-- marketplace que sirve a los tres a la vez: le vende servicios a la productora,
-- le da trabajo al personal, y queda de vidriera para el cliente que arma su
-- propia fiesta. Sacarlo afuera partiría en dos un directorio que es uno solo.
-- Por eso la puerta es una ruta pública de LABURO (/servicios) y no un dominio
-- nuevo.
--
-- ── LO QUE FALTABA, EXACTAMENTE ────────────────────────────────────────────
-- La 0058 dejó casi todo hecho: el proveedor ya tiene formulario propio, la
-- consulta ya se guarda y ya sale por mail, y provider_contacts ya nace con
-- organization_id NULLABLE y origen='cliente' esperando este momento. Lo único
-- que no existía es el lado de AFUERA: las funciones de hoy resuelven la
-- productora del que llama y sin sesión devuelven vacío. Acá van sus gemelas
-- públicas.
--
-- ── LAS DOS DECISIONES DE PRODUCTO QUE SE APLICAN ACÁ ──────────────────────
-- 1. La consulta va a UN proveedor, no a varios de una. El que recibe sabe que
--    lo eligieron a él y no que está compitiendo a ciegas. Mandar la misma
--    consulta a tres es un botón el día que haya volumen, no una reescritura.
-- 2. Aparecen TODOS los publicados, no solo los verificados. Es la misma
--    moderación reactiva que Franco eligió para las búsquedas. `is_verified`
--    igual se devuelve, porque mostrar el sello es lo que le da valor.
--
-- ── EL RIESGO REAL DE ESTA FASE, Y CÓMO SE FRENA ───────────────────────────
-- Un formulario público que dispara mails es un cañón de spam apuntado a la
-- casilla de los proveedores, y el que se quema no somos nosotros: es el
-- proveedor, que se va. El freno va en DOS capas a propósito:
--   · lib/rate-limit.ts frena por IP en el Server Action. Barato y sirve para el
--     caso real (un script desde una IP), pero en serverless el contador es por
--     instancia y no ve un ataque distribuido.
--   · ACÁ ABAJO se frena por mail, por proveedor y en total. Este es el que de
--     verdad protege la casilla, porque cuenta filas en la base y no le importa
--     desde dónde vino el pedido.
-- Los dos son necesarios: el primero corta antes de gastar una conexión, el
-- segundo es el que no se puede esquivar.

-- ---------------------------------------------------------------------------
-- (1) EL SLUG: la vidriera necesita direcciones que se puedan compartir
--
--     Hoy los perfiles tienen la columna `slug` en NULL, o sea que la única
--     forma de linkear a un proveedor sería con su uuid. Un uuid en la URL no se
--     puede pasar por WhatsApp ni lo indexa nadie, y esta pantalla existe
--     justamente para que la encuentren de afuera.
--
--     Se asigna con un TRIGGER y no tocando las RPC de guardar perfil: son
--     cuatro funciones distintas (por token y por cuenta) y el día que aparezca
--     una quinta se olvidaría el slug. El trigger no se puede olvidar.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION staff_app.slug_desde_nombre(p_nombre text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- translate() y no unaccent(): la extensión no está instalada y pedirla por
  -- esto sería traer una dependencia para resolver catorce letras.
  SELECT nullif(
    btrim(
      regexp_replace(
        lower(translate(
          coalesce(p_nombre, ''),
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
        )),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-'
    ),
    ''
  );
$$;

COMMENT ON FUNCTION staff_app.slug_desde_nombre(text) IS
  'Nombre visible a slug de URL. Sin acentos, sin símbolos, sin guiones sueltos en las puntas.';

CREATE OR REPLACE FUNCTION staff_app.asignar_slug_perfil()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_base    text;
  v_intento text;
  v_n       int := 2;
BEGIN
  -- Solo si no tiene. Un slug ya publicado NO se recalcula aunque cambie el
  -- nombre: hay links de WhatsApp dando vueltas y romperlos es peor que tener
  -- una dirección con el nombre viejo.
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;

  v_base := coalesce(
    left(staff_app.slug_desde_nombre(NEW.display_name), 60),
    'proveedor'
  );
  v_intento := v_base;

  WHILE EXISTS (
    SELECT 1 FROM staff_app.marketplace_profiles
     WHERE slug = v_intento AND id <> NEW.id
  ) LOOP
    v_intento := v_base || '-' || v_n;
    v_n := v_n + 1;
  END LOOP;

  NEW.slug := v_intento;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_profiles_slug ON staff_app.marketplace_profiles;
CREATE TRIGGER marketplace_profiles_slug
  BEFORE INSERT OR UPDATE OF display_name, slug ON staff_app.marketplace_profiles
  FOR EACH ROW
  WHEN (NEW.tipo = 'proveedor')
  EXECUTE FUNCTION staff_app.asignar_slug_perfil();

-- Dos proveedores con el mismo slug harían que la ficha devolviera cualquiera de
-- los dos. El trigger ya lo evita, pero el índice es lo que lo vuelve imposible.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_slug_uidx
  ON staff_app.marketplace_profiles (slug) WHERE slug IS NOT NULL;

-- Backfill de los que ya existen. El UPDATE dispara el trigger de arriba.
UPDATE staff_app.marketplace_profiles
   SET slug = NULL
 WHERE tipo = 'proveedor' AND slug IS NULL;

-- ---------------------------------------------------------------------------
-- (2) EL TOKEN DE ENVÍO
--
--     staff_app_consulta_mail_enviado (0058) confirma con la sesión de la
--     productora. Acá no hay sesión, así que hace falta otra prueba de que el
--     que marca el mail como enviado es el mismo que hizo la consulta. Sin esto,
--     cualquiera con un uuid podría marcar consultas ajenas como entregadas y
--     nos dejaría sin saber cuáles se perdieron de verdad.
--
--     El token lo genera la base, se devuelve UNA vez al Server Action que hizo
--     la consulta, y no viaja nunca al navegador.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.provider_contacts
  ADD COLUMN IF NOT EXISTS envio_token uuid;

COMMENT ON COLUMN staff_app.provider_contacts.envio_token IS
  'Prueba de autoría para confirmar el envío del mail cuando la consulta vino de un cliente final, que no tiene sesión (0059). Se genera en la RPC y solo lo conoce el Server Action que la llamó.';

-- ---------------------------------------------------------------------------
-- (3) LAS CATEGORÍAS, SIN SESIÓN
--
--     Gemela de staff_app_categorias_proveedores, que arranca chequeando que el
--     que llama sea miembro de una productora y sin eso devuelve '[]'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_categorias()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
  SELECT coalesce((
    SELECT jsonb_agg(DISTINCT s.categoria)
      FROM staff_app.provider_services s
      JOIN staff_app.marketplace_profiles mp ON mp.id = s.profile_id
     WHERE s.activo AND mp.activo AND mp.is_public AND mp.tipo = 'proveedor'
  ), '[]'::jsonb);
$$;

-- ---------------------------------------------------------------------------
-- (4) LA BÚSQUEDA PÚBLICA
--
--     Misma consulta que staff_app_buscar_proveedores menos TRES cosas, y las
--     tres faltan a propósito:
--       · es_favorito y nota_interna: son de cada productora, no existen acá.
--       · ya_contactado: idem.
--       · email y teléfono: la 0058 los sacó de la búsqueda de la productora
--         porque entregarlos deja abierta la puerta de atrás y nos deja sin el
--         registro. En una pantalla pública eso sería, además, publicar la
--         casilla del proveedor para cualquier scraper.
--
--     Devuelve el `slug` porque es lo que la ficha necesita para linkear.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_buscar(
  p_texto     text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_provincia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_t text := nullif(btrim(lower(coalesce(p_texto, ''))), '');
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'orden', x->>'display_name')
    FROM (
      SELECT jsonb_build_object(
        'profile_id',   mp.id,
        'slug',         mp.slug,
        'display_name', mp.display_name,
        'headline',     mp.headline,
        'bio',          mp.bio,
        'ciudad',       mp.ciudad,
        'provincia',    mp.provincia,
        'website',      mp.website,
        'instagram',    mp.instagram,
        'is_verified',  mp.is_verified,
        -- Los verificados primero. No filtra (decisión de Franco: aparecen
        -- todos), pero el que se tomó el trabajo de que lo verifiquemos tiene
        -- que ver algo a cambio.
        'orden',        CASE WHEN mp.is_verified THEN '0' ELSE '1' END,
        'servicios', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'categoria',    s.categoria,
            'titulo',       s.titulo,
            'descripcion',  s.descripcion,
            'precio_desde', s.precio_desde,
            'moneda',       s.moneda,
            'unidad',       s.unidad,
            'provincias',   s.provincias
          )), '[]'::jsonb)
          FROM staff_app.provider_services s
          WHERE s.profile_id = mp.id AND s.activo
        )
      ) AS x
      FROM staff_app.marketplace_profiles mp
      WHERE mp.tipo = 'proveedor'
        AND mp.activo
        AND mp.is_public
        AND mp.slug IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM staff_app.provider_services s
           WHERE s.profile_id = mp.id AND s.activo
             AND (p_categoria IS NULL OR s.categoria = p_categoria)
             AND (p_provincia IS NULL OR p_provincia = ANY (s.provincias))
        )
        AND (v_t IS NULL OR (
          lower(coalesce(mp.display_name,'')) LIKE '%' || v_t || '%'
          OR lower(coalesce(mp.headline,'')) LIKE '%' || v_t || '%'
          OR lower(coalesce(mp.bio,'')) LIKE '%' || v_t || '%'
          OR EXISTS (
            SELECT 1 FROM staff_app.provider_services s2
             WHERE s2.profile_id = mp.id AND s2.activo
               AND (lower(s2.titulo) LIKE '%' || v_t || '%'
                 OR lower(coalesce(s2.descripcion,'')) LIKE '%' || v_t || '%'
                 OR lower(s2.categoria) LIKE '%' || v_t || '%')
          )
        ))
      LIMIT 100
    ) sub
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- (5) LA FICHA DE UN PROVEEDOR, POR SLUG
--
--     Trae el perfil, los servicios y el formulario en UNA llamada. Podría
--     hacerse con dos (buscar + staff_app_formulario_proveedor), pero esta
--     pantalla es la que decide si la persona consulta o cierra: cada viaje de
--     más es tiempo de carga en un teléfono con señal de evento.
--
--     Sigue sin devolver mail ni teléfono, por lo mismo que (4).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_proveedor(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_mp   staff_app.marketplace_profiles%ROWTYPE;
  v_form staff_app.provider_forms%ROWTYPE;
BEGIN
  SELECT * INTO v_mp
    FROM staff_app.marketplace_profiles
   WHERE slug = nullif(btrim(lower(coalesce(p_slug, ''))), '')
     AND tipo = 'proveedor' AND activo AND is_public;

  IF v_mp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  SELECT * INTO v_form FROM staff_app.provider_forms WHERE profile_id = v_mp.id;

  RETURN jsonb_build_object(
    'ok', true,
    'profile_id',   v_mp.id,
    'slug',         v_mp.slug,
    'display_name', v_mp.display_name,
    'headline',     v_mp.headline,
    'bio',          v_mp.bio,
    'ciudad',       v_mp.ciudad,
    'provincia',    v_mp.provincia,
    'website',      v_mp.website,
    'instagram',    v_mp.instagram,
    'is_verified',  v_mp.is_verified,
    'campos',       coalesce(v_form.campos, '[]'::jsonb),
    'intro',        v_form.intro,
    'servicios', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'categoria',    s.categoria,
        'titulo',       s.titulo,
        'descripcion',  s.descripcion,
        'precio_desde', s.precio_desde,
        'moneda',       s.moneda,
        'unidad',       s.unidad,
        'provincias',   s.provincias
      ) ORDER BY s.categoria, s.titulo), '[]'::jsonb)
      FROM staff_app.provider_services s
      WHERE s.profile_id = v_mp.id AND s.activo
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- (6) LA CONSULTA DEL CLIENTE FINAL
--
--     Gemela de staff_app_consultar_proveedor sin la parte de la productora:
--     organization_id queda NULL, origen='cliente', y no se toca
--     profile_org_links (no hay organización que vincular).
--
--     EL MAIL ES OBLIGATORIO Y NO HAY DE DÓNDE SACARLO. En la versión de la
--     productora, si no escribía uno se usaba el de su cuenta. Acá no hay cuenta:
--     sin mail la consulta no sirve para nada porque el proveedor no tendría a
--     dónde contestar, así que se rechaza antes de guardar.
-- ---------------------------------------------------------------------------
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
  -- ── El proveedor tiene que estar publicado ──
  SELECT mp.id, mp.display_name, mp.email
    INTO v_prov
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public;
  IF v_prov.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  -- ── El contenido ──
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

  -- ── EL FRENO DE ABUSO, que es el que no se puede esquivar ──
  --
  -- Tres topes distintos porque son tres ataques distintos: uno que insiste con
  -- el mismo mail, uno que le tira a un proveedor puntual, y uno que rocía a
  -- todo el directorio. Los números son deliberadamente holgados para una
  -- persona real: nadie que esté organizando su fiesta manda cuatro consultas al
  -- mismo proveedor en una hora.
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
    v_nombre,
    v_email,
    nullif(btrim(coalesce(left(p_telefono, 40), '')), ''),
    'cliente',
    v_token
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

/** Deja constancia de que el mail salió, probando autoría con el token. */
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_mail_enviado(
  p_contacto_id uuid,
  p_token       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  UPDATE staff_app.provider_contacts
     SET email_enviado_at = now()
   WHERE id = p_contacto_id
     AND envio_token = p_token
     AND origen = 'cliente';
  RETURN jsonb_build_object('ok', FOUND);
END;
$$;

-- ---------------------------------------------------------------------------
-- (7) PERMISOS
--
--     ⚠️ Acá `anon` SÍ va, y es la primera vez en todo el módulo. La 0059 es la
--     fase que abre la puerta: el cliente final por definición no tiene sesión.
--     Lo que hace que abrirlas sea seguro es que ninguna de las cuatro acepta
--     nada que amplíe lo que devuelve: la búsqueda y la ficha solo miran
--     proveedores PUBLICADOS, la consulta valida y frena adentro, y la de marcar
--     el envío exige un token que solo conoce el servidor.
--
--     Y recordar lo que se aprendió en la 0058: REVOKE ... FROM public NO le
--     saca el permiso a `anon`, porque `anon` es un rol con grant directo. Acá
--     no molesta porque lo queremos, pero por eso el GRANT se escribe igual y
--     explícito, para que se lea la intención y no parezca un descuido heredado.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_categorias() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_buscar(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_proveedor(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_consultar(uuid, jsonb, text, text, text) TO anon, authenticated;

-- La de marcar el envío NO va a anon: la llama el Server Action, que sí tiene el
-- token. Dejarla abierta sería regalar intentos de adivinar un uuid.
REVOKE EXECUTE ON FUNCTION public.staff_app_vidriera_mail_enviado(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_mail_enviado(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_vidriera_buscar(text, text, text) IS
  'Fase 4: la búsqueda de proveedores para quien NO tiene cuenta. No devuelve mail ni teléfono a propósito.';
COMMENT ON FUNCTION public.staff_app_vidriera_consultar(uuid, jsonb, text, text, text) IS
  'Fase 4: la consulta del cliente final. origen=cliente, sin organización. El freno de abuso vive adentro y es el único que no se puede esquivar.';
