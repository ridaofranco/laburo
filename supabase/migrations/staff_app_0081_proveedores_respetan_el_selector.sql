-- Migration: staff_app_0081_proveedores_respetan_el_selector
-- Escrita y APLICADA el 2026-09-05.
--
-- ---------------------------------------------------------------------------
-- EL ULTIMO RINCON QUE NO ESCUCHABA AL SELECTOR DE CONTEXTO
-- ---------------------------------------------------------------------------
-- Las tres funciones de proveedores resolvian la organizacion asi:
--
--   SELECT m.organization_id FROM staff_app.members m
--    WHERE m.user_id = auth.uid() ... ORDER BY m.created_at ASC LIMIT 1;
--
-- O sea: LA MEMBRESIA MAS ANTIGUA, siempre, sin mirar el selector. Con una sola
-- productora no se nota. Con dos, alguien que eligio operar la productora B
-- busca proveedores como la A, y la consulta que manda queda registrada a
-- nombre de la A. Se detecto el 5/9 mirando la base y quedo anotado sin
-- arreglar; esto lo arregla.
--
-- Es el mismo arreglo que la tanda 1 le hizo a las ocho escrituras: la
-- organizacion la manda quien llama (`p_org`), validada, y no la elige Postgres.
--
-- ⚠️ Y ARREGLA UN SEGUNDO BUG QUE NADIE HABIA VISTO: quien SUPLANTA a una
-- productora (0073) no es `member`, asi que ese SELECT no le devolvia ninguna
-- fila y las tres funciones le contestaban 'sin_permiso'. Suplantando no se
-- podia ni buscar ni contactar proveedores. `is_org_member` / `is_org_writer`
-- SI contemplan la suplantacion, porque ese es justamente su trabajo.
--
-- ⚠️ POR QUE SE PUEDE CAMBIAR LA FIRMA SIN ORDEN DE DEPLOY: `p_org` entra como
-- parametro OPCIONAL al final. El codigo viejo, que llama sin el, sigue
-- funcionando exactamente como antes (`resolve_org(NULL)` = la cookie, y si no,
-- la de siempre). Mismo criterio que la 0069 con el telefono.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) BUSCAR. Lectura: alcanza con ser miembro.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_buscar_proveedores(text, text, text);

CREATE OR REPLACE FUNCTION public.staff_app_buscar_proveedores(
  p_texto     text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_provincia text DEFAULT NULL,
  p_org       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_t   text := nullif(btrim(lower(coalesce(p_texto, ''))), '');
BEGIN
  -- Sin organizacion valida no se devuelve nada. El favorito, la nota interna y
  -- el "ya contactado" son POR organizacion: con la equivocada, la busqueda
  -- miente aunque los proveedores sean los mismos.
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN '[]'::jsonb;
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.staff_app_buscar_proveedores(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_buscar_proveedores(text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_buscar_proveedores(text, text, text, uuid) IS
  'Busca proveedores publicados. La busqueda CRUZA organizaciones a proposito; lo que NO cruza (favorito, nota interna, ya contactado) se resuelve con la organizacion recibida por p_org, no con la membresia mas antigua.';

-- ---------------------------------------------------------------------------
-- (2) CONTACTAR. Escritura: is_org_writer.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_contactar_proveedor(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.staff_app_contactar_proveedor(
  p_profile_id uuid,
  p_mensaje    text DEFAULT NULL,
  p_gig_id     uuid DEFAULT NULL,
  p_org        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_app.marketplace_profiles mp
     WHERE mp.id = p_profile_id AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  IF p_gig_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff_app.gigs g WHERE g.id = p_gig_id AND g.organization_id = v_org
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_ajeno');
  END IF;

  INSERT INTO staff_app.provider_contacts (organization_id, profile_id, gig_id, mensaje)
  VALUES (v_org, p_profile_id, p_gig_id, nullif(btrim(coalesce(p_mensaje, '')), ''));

  INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
  SELECT p_profile_id, v_org, 'contactado'
   WHERE NOT EXISTS (
     SELECT 1 FROM staff_app.profile_org_links l
      WHERE l.profile_id = p_profile_id AND l.organization_id = v_org
   );

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid, uuid) IS
  'Registra el contacto con un proveedor en la organizacion recibida por p_org, validada con is_org_writer (que ademas contempla la suplantacion, cosa que el SELECT sobre members no hacia).';

-- ---------------------------------------------------------------------------
-- (3) CONSULTAR (el formulario que le llega al proveedor por mail).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.staff_app_consultar_proveedor(
  p_profile_id uuid,
  p_respuestas jsonb,
  p_nombre     text DEFAULT NULL,
  p_email      text DEFAULT NULL,
  p_telefono   text DEFAULT NULL,
  p_gig_id     uuid DEFAULT NULL,
  p_org        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org        uuid := staff_app.resolve_org(p_org);
  v_org_nombre text;
  v_prov       record;
  v_id         uuid;
  v_email      text;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
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
$function$;

REVOKE ALL ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid, uuid) IS
  'Guarda la consulta a un proveedor en la organizacion recibida por p_org, validada con is_org_writer. La consulta queda registrada a nombre de la productora ELEGIDA en el selector, no de la membresia mas antigua.';

COMMIT;
