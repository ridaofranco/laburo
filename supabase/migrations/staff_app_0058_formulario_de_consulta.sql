-- staff_app_0058_formulario_de_consulta
--
-- LA CONSULTA AL PROVEEDOR SE LLENA EN UN FORMULARIO Y LE LLEGA A SU MAIL.
--
-- ── QUÉ CAMBIA Y POR QUÉ (Franco, 2/8) ─────────────────────────────────────
-- La Fase 3 (0057) salió contactando al proveedor con un deep link de WhatsApp
-- o un mailto:. Los dos abren una app de afuera con un saludo vacío, así que el
-- proveedor recibía "hola, te escribo por un evento" y tenía que preguntar todo
-- de cero. Franco lo cortó: "PROVEEDORES NO RECIBEN UN WHATSAPP POR AHORA,
-- RECIBEN LA CONSULTA A SU MAIL QUE SE LLENA DESDE UN FORMULARIO AHI, EL
-- FORMULARIO LO PUEDEN ARMAR ELLOS SI QUIEREN O PUEDEN USAR UN TEMPLATE NUESTRO".
--
-- Tres consecuencias de diseño:
--   1. El formulario es DEL PROVEEDOR, no de la plataforma. Nadie sabe mejor
--      que él qué necesita saber para cotizar.
--   2. Si no lo arma, igual funciona: el template vive en lib/formulario-consulta.ts
--      y se usa cuando `campos` está vacío. Cero configuración obligatoria.
--   3. La consulta queda GUARDADA, no solo enviada. Un mail que se pierde no se
--      puede recuperar; una fila sí. Y es lo que le da a /plataforma el dato que
--      Franco pidió: "me enteraré cuando lo contacte".
--
-- ── EL BUG QUE SE ARREGLA DE PASO ──────────────────────────────────────────
-- staff_app_contactar_proveedor (0057) inserta relacion='contactado' en
-- profile_org_links, pero el CHECK de la 0041 solo admite pool/contratado/
-- bloqueado. O sea que CADA contacto reventaba con check_violation, la
-- transacción se caía entera y el registro nunca se guardaba. Verificado el 2/8:
-- provider_contacts tenía 0 filas. La Fase 3 nació rota y no se había notado
-- porque hay un solo proveedor de prueba. Se agrega 'contactado' al CHECK.
--
-- ── PENSADA PARA LA FASE 4 ─────────────────────────────────────────────────
-- El portal del cliente final es "la misma máquina con otra puerta": el cliente
-- llena el formulario del proveedor igual que la productora. Por eso
-- organization_id pasa a ser NULLABLE y aparece `origen`. Es la única concesión
-- al futuro que se hace acá, y cuesta dos líneas hoy contra una migración de
-- datos mañana.

-- ---------------------------------------------------------------------------
-- (0) EL FIX: 'contactado' es una relación válida
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.profile_org_links
  DROP CONSTRAINT IF EXISTS profile_org_links_relacion_check;
ALTER TABLE staff_app.profile_org_links
  ADD CONSTRAINT profile_org_links_relacion_check
  CHECK (relacion IN ('pool', 'contactado', 'contratado', 'bloqueado'));

COMMENT ON COLUMN staff_app.profile_org_links.relacion IS
  'pool = está en su lista. contactado = le mandó una consulta y todavía no lo contrató (0058). contratado = ya trabajó con ella. bloqueado = no quiere volver a convocarlo.';

-- ---------------------------------------------------------------------------
-- (1) EL FORMULARIO DE CADA PROVEEDOR
--
--     Una fila por proveedor. `campos` vacío significa "usa el template
--     nuestro", que es el estado por defecto y el de todos los que ya existen:
--     no hace falta backfill, la ausencia de fila ya quiere decir eso.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.provider_forms (
  profile_id  uuid PRIMARY KEY
              REFERENCES staff_app.marketplace_profiles(id) ON DELETE CASCADE,

  -- Array de {id, label, tipo, requerido, opciones[]}. Es jsonb y no una tabla
  -- de campos porque un formulario se lee, se guarda y se muestra SIEMPRE
  -- entero: no hay una sola consulta que quiera "el campo 3". Una tabla acá
  -- sumaría joins y orden explícito sin comprar nada.
  campos      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Un párrafo del proveedor arriba del formulario ("respondo dentro de las
  -- 24hs", "no cubro zona sur"). Opcional.
  intro       text,

  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT provider_forms_campos_es_array CHECK (jsonb_typeof(campos) = 'array')
);

COMMENT ON TABLE staff_app.provider_forms IS
  'El formulario con el que cada proveedor recibe consultas. Sin fila (o con campos vacío) se usa el template de SOMOS DER que vive en lib/formulario-consulta.ts. Decisión de Franco (2/8): el proveedor lo puede armar, pero nunca está obligado.';

ALTER TABLE staff_app.provider_forms ENABLE ROW LEVEL SECURITY;

-- Sin política permisiva para el usuario común: TODO pasa por las RPCs
-- SECURITY DEFINER de abajo, que validan token o sesión. La plataforma puede
-- mirar, porque modera.
DROP POLICY IF EXISTS provider_forms_plataforma ON staff_app.provider_forms;
CREATE POLICY provider_forms_plataforma ON staff_app.provider_forms
  FOR SELECT USING (staff_app.is_platform_admin());

-- ---------------------------------------------------------------------------
-- (2) LA CONSULTA: lo que hoy es un "le escribí" pasa a tener contenido
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.provider_contacts
  ADD COLUMN IF NOT EXISTS respuestas        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nombre_contacto   text,
  ADD COLUMN IF NOT EXISTS email_contacto    text,
  ADD COLUMN IF NOT EXISTS telefono_contacto text,
  ADD COLUMN IF NOT EXISTS origen            text NOT NULL DEFAULT 'productora',
  ADD COLUMN IF NOT EXISTS email_enviado_at  timestamptz;

-- La Fase 4 (cliente final) no tiene organización. Se prepara ahora porque
-- después implicaría reescribir las políticas con datos adentro.
ALTER TABLE staff_app.provider_contacts ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE staff_app.provider_contacts
  DROP CONSTRAINT IF EXISTS provider_contacts_origen_check;
ALTER TABLE staff_app.provider_contacts
  ADD CONSTRAINT provider_contacts_origen_check
  CHECK (origen IN ('productora', 'cliente'));

-- Una consulta de productora SIEMPRE tiene organización. Sin esto, un bug
-- futuro podría dejar filas huérfanas que no ve nadie más que la plataforma.
ALTER TABLE staff_app.provider_contacts
  DROP CONSTRAINT IF EXISTS provider_contacts_org_segun_origen;
ALTER TABLE staff_app.provider_contacts
  ADD CONSTRAINT provider_contacts_org_segun_origen
  CHECK (origen <> 'productora' OR organization_id IS NOT NULL);

COMMENT ON COLUMN staff_app.provider_contacts.respuestas IS
  'Array de {label, valor}. Se guarda la ETIQUETA y no solo el id del campo a propósito: si el proveedor cambia su formulario mañana, la consulta vieja tiene que seguir leyéndose tal como se hizo.';
COMMENT ON COLUMN staff_app.provider_contacts.email_enviado_at IS
  'Cuándo salió el mail de verdad. NULL = se guardó la consulta pero el mail falló. Sin esta columna, un mail perdido es indistinguible de uno entregado.';
COMMENT ON COLUMN staff_app.provider_contacts.origen IS
  'productora = la mandó una productora desde /proveedores. cliente = la mandó un cliente final (Fase 4, todavía sin construir).';

-- RLS: la política vieja rompe con organization_id NULL (USING nulo = no pasa,
-- que es seguro, pero deja las consultas de cliente final invisibles hasta para
-- la plataforma). Se reescriben las dos.
DROP POLICY IF EXISTS provider_contacts_select ON staff_app.provider_contacts;
CREATE POLICY provider_contacts_select ON staff_app.provider_contacts
  FOR SELECT USING (
    (organization_id IS NOT NULL AND staff_app.is_org_member(organization_id))
    OR staff_app.is_platform_admin()
  );

DROP POLICY IF EXISTS provider_contacts_write ON staff_app.provider_contacts;
CREATE POLICY provider_contacts_write ON staff_app.provider_contacts
  FOR ALL USING (organization_id IS NOT NULL AND staff_app.is_org_writer(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND staff_app.is_org_writer(organization_id));

CREATE INDEX IF NOT EXISTS provider_contacts_perfil_fecha_idx
  ON staff_app.provider_contacts (profile_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- (3) LA VALIDACIÓN DEL FORMULARIO, EN UN SOLO LUGAR
--
--     Los mismos topes que lib/formulario-consulta.ts. El cliente valida para
--     avisar rápido; ESTA es la que manda, porque un cliente se puede saltear.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.validar_campos_formulario(p_campos jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_campo   jsonb;
  v_label   text;
  v_tipo    text;
  v_labels  text[] := '{}';
  v_ops     jsonb;
BEGIN
  IF p_campos IS NULL OR jsonb_typeof(p_campos) <> 'array' THEN
    RETURN 'campos_invalidos';
  END IF;
  IF jsonb_array_length(p_campos) > 12 THEN
    RETURN 'demasiados_campos';
  END IF;

  FOR v_campo IN SELECT * FROM jsonb_array_elements(p_campos) LOOP
    IF jsonb_typeof(v_campo) <> 'object' THEN RETURN 'campos_invalidos'; END IF;

    v_label := btrim(coalesce(v_campo->>'label', ''));
    v_tipo  := coalesce(v_campo->>'tipo', '');

    IF v_label = '' THEN RETURN 'campo_sin_texto'; END IF;
    IF length(v_label) > 120 THEN RETURN 'campo_muy_largo'; END IF;
    IF v_tipo NOT IN ('texto','parrafo','numero','fecha','opciones') THEN
      RETURN 'tipo_invalido';
    END IF;
    IF btrim(coalesce(v_campo->>'id', '')) = '' THEN RETURN 'campo_sin_id'; END IF;

    IF lower(v_label) = ANY (v_labels) THEN RETURN 'campo_repetido'; END IF;
    v_labels := v_labels || lower(v_label);

    IF v_tipo = 'opciones' THEN
      v_ops := v_campo->'opciones';
      IF v_ops IS NULL OR jsonb_typeof(v_ops) <> 'array' THEN RETURN 'opciones_invalidas'; END IF;
      IF jsonb_array_length(v_ops) < 2  THEN RETURN 'pocas_opciones'; END IF;
      IF jsonb_array_length(v_ops) > 12 THEN RETURN 'demasiadas_opciones'; END IF;
    END IF;
  END LOOP;

  RETURN NULL;  -- todo bien
END;
$$;

-- ---------------------------------------------------------------------------
-- (4) EL PROVEEDOR LEE Y GUARDA SU FORMULARIO
--
--     Dos puertas, porque el proveedor tiene dos: el link mágico (0042, que es
--     por donde entra hoy) y la cuenta propia (0045). Las dos resuelven el
--     profile_id por su cuenta y NUNCA lo aceptan como argumento.
-- ---------------------------------------------------------------------------

/** Por token. Devuelve NULL si el token no sirve, igual que el resto de la 0042. */
CREATE OR REPLACE FUNCTION public.staff_app_proveedor_formulario(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_perfil_id uuid;
  v_form      staff_app.provider_forms%ROWTYPE;
BEGIN
  v_perfil_id := staff_app.perfil_proveedor_por_token(p_token);
  IF v_perfil_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_form FROM staff_app.provider_forms WHERE profile_id = v_perfil_id;

  RETURN jsonb_build_object(
    'ok', true,
    'campos', coalesce(v_form.campos, '[]'::jsonb),
    'intro',  v_form.intro
  );
END;
$$;

/** Por token: guardar. `campos` vacío = volver al template nuestro. */
CREATE OR REPLACE FUNCTION public.staff_app_proveedor_guardar_formulario(
  p_token  text,
  p_campos jsonb,
  p_intro  text DEFAULT NULL
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
  v_perfil_id := staff_app.perfil_proveedor_por_token(p_token);
  IF v_perfil_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
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

/** Por cuenta propia (0045). Mismo contrato, sin token. */
CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_guardar_formulario(
  p_campos jsonb,
  p_intro  text DEFAULT NULL
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
   WHERE mp.user_id = auth.uid() AND mp.tipo = 'proveedor' AND mp.activo
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

-- ---------------------------------------------------------------------------
-- (5) QUIEN CONSULTA LEE EL FORMULARIO DEL PROVEEDOR
--
--     Devuelve SOLO el formulario y el nombre. NO devuelve el mail ni el
--     teléfono del proveedor: el punto de todo esto es que la consulta pase por
--     acá y quede registrada, no que se copie la dirección y se salga por
--     afuera.
-- ---------------------------------------------------------------------------
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
  -- Solo un proveedor PUBLICADO. Si no, este endpoint sería una forma de
  -- averiguar si un perfil existe.
  SELECT mp.display_name INTO v_nombre
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public;
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

-- ---------------------------------------------------------------------------
-- (6) MANDAR LA CONSULTA
--
--     Guarda primero y devuelve a dónde hay que mandar el mail. El envío lo
--     hace el Server Action (Node), no la base: mandar mail desde Postgres
--     ataría la transacción a un servicio de afuera. Si el mail falla, la
--     consulta ya está guardada y se ve en /plataforma, que es exactamente el
--     comportamiento que se quiere.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_consultar_proveedor(
  p_profile_id uuid,
  p_respuestas jsonb,
  p_nombre     text DEFAULT NULL,
  p_email      text DEFAULT NULL,
  p_telefono   text DEFAULT NULL,
  p_gig_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org        uuid;
  v_org_nombre text;
  v_prov       record;
  v_id         uuid;
  v_email      text;
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid() AND m.role IN ('owner','writer')
   ORDER BY m.created_at ASC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  SELECT mp.id, mp.display_name, mp.email
    INTO v_prov
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public;
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

  IF p_gig_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff_app.gigs g WHERE g.id = p_gig_id AND g.organization_id = v_org
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_ajeno');
  END IF;

  SELECT o.name INTO v_org_nombre FROM staff_app.organizations o WHERE o.id = v_org;

  -- El mail de respuesta: el que se escribió, y si no el de la cuenta. Sin uno
  -- de los dos el proveedor recibe una consulta a la que no puede contestar.
  v_email := nullif(btrim(lower(coalesce(p_email, ''))), '');
  IF v_email IS NULL THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalido');
  END IF;

  INSERT INTO staff_app.provider_contacts (
    organization_id, profile_id, gig_id, respuestas,
    nombre_contacto, email_contacto, telefono_contacto, origen
  ) VALUES (
    v_org, p_profile_id, p_gig_id, p_respuestas,
    nullif(btrim(coalesce(left(p_nombre, 160), '')), ''),
    v_email,
    nullif(btrim(coalesce(left(p_telefono, 40), '')), ''),
    'productora'
  )
  RETURNING id INTO v_id;

  -- Queda vinculado a esa productora para que después pueda dejarle nota y
  -- marcarlo favorito. La relación SUBE de 'pool' a 'contactado', pero nunca
  -- pisa una que diga algo más fuerte: haberle escrito no deshace un
  -- 'contratado' ni levanta un 'bloqueado'.
  INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
  VALUES (p_profile_id, v_org, 'contactado')
  ON CONFLICT (profile_id, organization_id) DO UPDATE
    SET relacion = 'contactado', updated_at = now()
    WHERE staff_app.profile_org_links.relacion = 'pool';

  RETURN jsonb_build_object(
    'ok', true,
    'contacto_id', v_id,
    'proveedor', jsonb_build_object(
      'display_name', v_prov.display_name,
      'email',        v_prov.email
    ),
    'productora', v_org_nombre
  );
END;
$$;

/** Deja constancia de que el mail salió. Lo llama el Server Action después de
 *  enviar. Sin esto no se puede distinguir un mail perdido de uno entregado. */
CREATE OR REPLACE FUNCTION public.staff_app_consulta_mail_enviado(p_contacto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid() AND m.role IN ('owner','writer')
   ORDER BY m.created_at ASC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  UPDATE staff_app.provider_contacts
     SET email_enviado_at = now()
   WHERE id = p_contacto_id AND organization_id = v_org;

  RETURN jsonb_build_object('ok', FOUND);
END;
$$;

-- ---------------------------------------------------------------------------
-- (7) LA BÚSQUEDA DEJA DE ENTREGAR EL MAIL Y EL TELÉFONO DEL PROVEEDOR
--
--     Consecuencia directa de la decisión de Franco. Si la consulta va por el
--     formulario, mandarle igual la dirección al navegador es dejar abierta la
--     puerta de atrás y quedarse sin el registro. Se reemplazan por un
--     `usa_template`, que es lo único que la pantalla necesita saber.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_buscar_proveedores(
  p_texto text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_provincia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
  v_t   text := nullif(btrim(lower(coalesce(p_texto, ''))), '');
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid()
   ORDER BY m.created_at ASC
   LIMIT 1;
  IF v_org IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'display_name')
    FROM (
      SELECT jsonb_build_object(
        'profile_id', mp.id,
        'display_name', mp.display_name,
        'headline', mp.headline,
        'bio', mp.bio,
        'ciudad', mp.ciudad,
        'provincia', mp.provincia,
        'website', mp.website,
        'instagram', mp.instagram,
        'is_verified', mp.is_verified,
        'servicios', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'categoria', s.categoria, 'titulo', s.titulo,
            'descripcion', s.descripcion, 'precio_desde', s.precio_desde,
            'moneda', s.moneda, 'unidad', s.unidad, 'provincias', s.provincias
          )), '[]'::jsonb)
          FROM staff_app.provider_services s
          WHERE s.profile_id = mp.id AND s.activo
        ),
        'es_favorito', coalesce(l.es_favorito, false),
        'nota_interna', l.nota_interna,
        'ya_contactado', EXISTS (
          SELECT 1 FROM staff_app.provider_contacts c
           WHERE c.profile_id = mp.id AND c.organization_id = v_org
        )
      ) AS x
      FROM staff_app.marketplace_profiles mp
      LEFT JOIN staff_app.profile_org_links l
             ON l.profile_id = mp.id AND l.organization_id = v_org
      WHERE mp.tipo = 'proveedor'
        AND mp.activo
        AND mp.is_public
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
-- (8) PERMISOS
--
--     `anon` en las de token porque ahí no hay sesión (es el patrón de la 0042).
--     El resto pide sesión. Cuando llegue la Fase 4, staff_app_formulario_proveedor
--     y una variante de consultar tendrán que abrirse a anon con rate limit.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_formulario(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_formulario(text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_guardar_formulario(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_formulario_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_consulta_mail_enviado(uuid) TO authenticated;

-- ⚠️ REVOKE ... FROM public NO ALCANZA, Y ESTO SE VERIFICÓ EJECUTANDO.
-- Supabase tiene ALTER DEFAULT PRIVILEGES que le da EXECUTE a `anon` sobre toda
-- función nueva del schema public. `anon` es un ROL con grant directo, no PUBLIC,
-- así que revocarle a PUBLIC lo deja intacto: recién creadas, las seis quedaron
-- con anon=X. La única que importaba de verdad era staff_app_formulario_proveedor,
-- que no mira quién llama: cualquier anónimo podía leer el formulario de un
-- proveedor publicado. Las otras dos morían igual en 'sin_permiso' porque
-- auth.uid() es NULL, pero se cierran lo mismo.
--
-- Las de TOKEN se quedan con anon a propósito: ahí no hay sesión y la identidad
-- es el token, que la RPC valida adentro (patrón de la 0042).
REVOKE EXECUTE ON FUNCTION public.staff_app_formulario_proveedor(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.staff_app_consulta_mail_enviado(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.staff_app_mi_proveedor_guardar_formulario(jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.staff_app_proveedor_formulario(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.staff_app_proveedor_guardar_formulario(text, jsonb, text) FROM public;
