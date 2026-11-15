-- RED: PRECIOS SOLO CON PERMISO + PAÍS EN LA VIDRIERA (15/11).
--
-- 1. Seguro de precios. precios_publicos (0108) se guardaba pero ninguna
--    función pública lo miraba: si a un perfil armado por DER (armado_por no
--    nulo) se le cargaban precios antes del «sí» del proveedor, salían
--    publicados en /servicios, en la ficha y en el schema. Ahora el precio sale
--    solo si el perfil es de alta propia (lo cargó el mismo proveedor) o si el
--    proveedor aceptó publicar precios.
-- 2. País. La red es de varios países: las funciones devuelven `pais` y la
--    búsqueda de servicios y salones acepta `p_pais` (opcional, con default,
--    así la versión anterior de la app sigue andando mientras se publica).
--    staff_app_vidriera_paises devuelve los países con perfiles públicos, para
--    que el filtro aparezca solo cuando hay más de uno.

DROP FUNCTION IF EXISTS public.staff_app_vidriera_buscar(text, text, text);
DROP FUNCTION IF EXISTS public.staff_app_vidriera_salones(text, text, integer);

CREATE OR REPLACE FUNCTION public.staff_app_vidriera_buscar(p_texto text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_provincia text DEFAULT NULL::text, p_pais text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
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
        'pais',         mp.pais,
        'website',      mp.website,
        'instagram',    mp.instagram,
        'is_verified',  mp.is_verified,
        'orden',        CASE WHEN mp.is_verified THEN '0' ELSE '1' END,
        'servicios', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'categoria',    s.categoria,
            'titulo',       s.titulo,
            'descripcion',  s.descripcion,
            'precio_desde', CASE WHEN mp.armado_por IS NULL OR mp.precios_publicos THEN s.precio_desde END,
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
        AND (p_pais IS NULL OR mp.pais = p_pais)
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

CREATE OR REPLACE FUNCTION public.staff_app_vidriera_proveedor(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
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
    'pais',         v_mp.pais,
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
        'precio_desde', CASE WHEN v_mp.armado_por IS NULL OR v_mp.precios_publicos THEN s.precio_desde END,
        'moneda',       s.moneda,
        'unidad',       s.unidad,
        'provincias',   s.provincias
      ) ORDER BY s.categoria, s.titulo), '[]'::jsonb)
      FROM staff_app.provider_services s
      WHERE s.profile_id = v_mp.id AND s.activo
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_vidriera_salones(p_texto text DEFAULT NULL::text, p_provincia text DEFAULT NULL::text, p_personas integer DEFAULT NULL::integer, p_pais text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_t text := nullif(btrim(lower(coalesce(p_texto, ''))), '');
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'display_name')
    FROM (
      SELECT jsonb_build_object(
        'slug', p.slug, 'display_name', p.display_name, 'headline', p.headline,
        'bio', p.bio, 'ciudad', p.ciudad, 'provincia', p.provincia, 'pais', p.pais,
        'is_verified', p.is_verified,
        'capacidad_min', v.capacidad_min, 'capacidad_max', v.capacidad_max,
        'superficie_m2', v.superficie_m2,
        'amenities', to_jsonb(v.amenities), 'tipos_evento', to_jsonb(v.tipos_evento),
        'catering_propio', v.catering_propio, 'estacionamiento', v.estacionamiento,
        'portada', v.fotos[1],
        'cuantas_fotos', coalesce(array_length(v.fotos, 1), 0)
      ) AS x
      FROM staff_app.marketplace_profiles p
      JOIN staff_app.venue_details v ON v.profile_id = p.id
      WHERE p.tipo = 'salon' AND p.activo AND p.is_public AND p.slug IS NOT NULL
        AND (p_provincia IS NULL OR p.provincia = p_provincia)
        AND (p_pais IS NULL OR p.pais = p_pais)
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
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_vidriera_salon(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile_id', p.id, 'slug', p.slug, 'display_name', p.display_name,
    'headline', p.headline, 'bio', p.bio, 'ciudad', p.ciudad,
    'provincia', p.provincia, 'pais', p.pais, 'direccion', v2.direccion,
    'website', p.website, 'instagram', p.instagram, 'is_verified', p.is_verified,
    'capacidad_min', v2.capacidad_min, 'capacidad_max', v2.capacidad_max,
    'superficie_m2', v2.superficie_m2,
    'amenities', to_jsonb(v2.amenities), 'tipos_evento', to_jsonb(v2.tipos_evento),
    'catering_propio', v2.catering_propio, 'estacionamiento', v2.estacionamiento,
    'fotos', to_jsonb(v2.fotos)
  ) INTO v
  FROM staff_app.marketplace_profiles p
  JOIN staff_app.venue_details v2 ON v2.profile_id = p.id
  WHERE p.slug = p_slug AND p.tipo = 'salon' AND p.activo AND p.is_public;

  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible'); END IF;
  RETURN v || jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_vidriera_paises(p_tipo text)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(DISTINCT pais ORDER BY pais), '{}')
    FROM staff_app.marketplace_profiles
   WHERE tipo = p_tipo AND activo AND is_public AND slug IS NOT NULL
     AND pais IS NOT NULL AND btrim(pais) <> '';
$function$;

REVOKE EXECUTE ON FUNCTION public.staff_app_vidriera_buscar(text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.staff_app_vidriera_salones(text, text, integer, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.staff_app_vidriera_paises(text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_buscar(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_salones(text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_paises(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
