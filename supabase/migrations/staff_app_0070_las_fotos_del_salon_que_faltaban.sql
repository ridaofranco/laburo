-- staff_app_0070_las_fotos_del_salon_que_faltaban
--
-- ESTA MIGRACION NO CAMBIA NADA. DOCUMENTA LO QUE YA ESTA CORRIENDO.
--
-- Detectado el 2/9/2026 auditando LABURO: las fotos de los salones funcionan en
-- produccion desde el 6/8 (hasta 8 por salon, la primera es la portada), pero
-- `grep -rn "fotos" supabase/migrations/` daba CERO y las migraciones cortaban
-- en la 0067. Alguien aplico el cambio a mano y nunca quedo el archivo.
--
-- Por que importa aunque hoy funcione: el contrato de esta carpeta es que un
-- entorno nuevo se levanta corriendo las migraciones en orden. Sin este archivo,
-- ese entorno nace sin la columna, sin la funcion de guardado y sin el bucket, y
-- `guardarFotosSalon` (app/acceso-proveedor/[token]/actions.ts) falla con un
-- PGRST202 que la UI traduce a un "Algo fallo" generico.
--
-- ── TODO LO DE ABAJO SE EXTRAJO DE PRODUCCION, NO SE REESCRIBIO ─────────────
-- Los cuerpos salen de `pg_get_functiondef`, los permisos de `proacl` y las
-- politicas de `pg_policies`, consultados el 5/9/2026 contra el proyecto
-- `luillpzfqzbpoqkgvjuw`. No se dedujo nada.
--
-- ⚠️ LA TRAMPA QUE ESTA MIGRACION EVITA, y que casi se comete: las tres
-- funciones de abajo las llama el visitante ANONIMO, no el service_role. La
-- 0064, que es la migracion hermana, gratea a `service_role` y copiar ese patron
-- de memoria APAGA las fotos y las dos vidrieras el dia que esto se aplique. Los
-- grants reales, verificados en `proacl`, incluyen `anon` en las tres. No los
-- cambies sin volver a mirar produccion.
--
-- Es idempotente y segura de correr sobre la base que YA la tiene aplicada.

-- ── 1. LA COLUMNA ──────────────────────────────────────────────────────────
ALTER TABLE staff_app.venue_details
  ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN staff_app.venue_details.fotos IS
  'Paths de las fotos del salon dentro del bucket venue-photos, en ORDEN: la primera es la portada. Tope de 8, aplicado en staff_app_salon_guardar_fotos. Nunca URLs completas: la funcion rechaza cualquier cosa que empiece con http.';

-- ── 2. EL BUCKET ───────────────────────────────────────────────────────────
-- Publico a proposito: las fotos se muestran en la vidriera, que es abierta.
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-photos', 'venue-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "venue-photos public insert" ON storage.objects;
CREATE POLICY "venue-photos public insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'venue-photos'::text);

DROP POLICY IF EXISTS "venue-photos public read" ON storage.objects;
CREATE POLICY "venue-photos public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'venue-photos'::text);

-- ── 3. GUARDAR LAS FOTOS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_salon_guardar_fotos(
  p_fotos text[],
  p_token text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_id    uuid;
  v_fotos text[];
BEGIN
  v_id := staff_app.perfil_proveedor_del_caller();
  IF v_id IS NULL AND coalesce(btrim(p_token), '') <> '' THEN
    v_id := staff_app.perfil_proveedor_por_token(p_token);
  END IF;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_perfil');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM marketplace_profiles
                  WHERE id = v_id AND tipo = 'salon') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_es_salon');
  END IF;

  -- Se guarda el ORDEN tal cual viene (la primera es la portada), asi que NO se
  -- usa array_agg(DISTINCT ...) como en amenities: eso ordena alfabeticamente y
  -- le cambiaria la portada al salon sin que toque nada.
  SELECT coalesce(array_agg(f ORDER BY orden), '{}')
    INTO v_fotos
    FROM (
      SELECT DISTINCT ON (f) f, orden
        FROM unnest(coalesce(p_fotos, '{}'::text[])) WITH ORDINALITY AS t(f, orden)
       WHERE btrim(coalesce(f, '')) <> ''
         -- Solo paths de ESTE bucket. Sin esto se podria guardar una URL de
         -- cualquier lado y la ficha del salon terminaria mostrando una imagen
         -- alojada en un servidor de un tercero.
         AND f NOT LIKE 'http%'
         AND f NOT LIKE '%..%'
       ORDER BY f, orden
    ) u;

  IF coalesce(array_length(v_fotos, 1), 0) > 8 THEN
    v_fotos := v_fotos[1:8];
  END IF;

  UPDATE venue_details
     SET fotos = v_fotos, updated_at = now()
   WHERE profile_id = v_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_detalles');
  END IF;

  RETURN jsonb_build_object('ok', true, 'fotos', to_jsonb(v_fotos));
END;
$function$;

-- ⚠️ anon incluido: el proveedor entra por link magico, SIN cuenta. El gate es
-- el token, que valida perfil_proveedor_por_token adentro.
GRANT EXECUTE ON FUNCTION public.staff_app_salon_guardar_fotos(text[], text)
  TO anon, authenticated, service_role;

-- ── 4. LA VIDRIERA, QUE TAMBIEN DEVUELVE FOTOS ─────────────────────────────
-- La 0064 las creo sin fotos; estas son las versiones que corren hoy, con
-- 'portada' y 'cuantas_fotos' en el listado y el array completo en la ficha.
CREATE OR REPLACE FUNCTION public.staff_app_vidriera_salones(
  p_texto     text    DEFAULT NULL::text,
  p_provincia text    DEFAULT NULL::text,
  p_personas  integer DEFAULT NULL::integer
)
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
        'bio', p.bio, 'ciudad', p.ciudad, 'provincia', p.provincia,
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
    'provincia', p.provincia, 'direccion', v2.direccion,
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

-- ⚠️ Las dos vidrieras las lee la web publica sin sesion: anon es obligatorio.
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_salones(text, text, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_app_vidriera_salon(text)
  TO anon, authenticated, service_role;
