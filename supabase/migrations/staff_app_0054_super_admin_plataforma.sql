-- staff_app_0054_super_admin_plataforma
-- FASE 0: `es_plataforma` finalmente hace algo.
--
-- La columna existia desde la 0044 y NINGUNA funcion la leia (medido el 2/8
-- sobre las ~160 funciones de la base). O sea la separacion entre "duena de la
-- plataforma" y "productora cliente" estaba DECLARADA y no IMPLEMENTADA: SOMOS
-- DER era una organizacion mas con una marquita que nadie miraba.
--
-- ── POR QUE AHORA ES OBLIGATORIA Y NO UN LUJO ────────────────────────────────
-- Franco arranco pidiendo APROBAR las busquedas para controlar la legalidad, y
-- despues eligio que nadie apruebe nada (2/8: "que quede abierto, ya esta, sino
-- no tiene sentido"). Es la decision correcta, la friccion mata un marketplace.
-- Pero al no aprobar, LO UNICO QUE LE QUEDA ES VER. Si no ve lo que se publica,
-- no se entera nunca. Por eso esto paso de "estaria bueno" a Fase 0.
--
-- ── EL MOMENTO QUE IMPORTA NO ES LA PUBLICACION ──────────────────────────────
-- Franco: "a lo sumo si quiere un empleado, me enterare cuando lo contacte".
-- Tiene razon y es mas profundo de lo que suena: cuando una productora publica
-- no pasa nada, cuando CONTRATA a alguien del pool aparece la responsabilidad de
-- la plataforma y el derecho a cobrar. Por eso hay una RPC de contrataciones y
-- no solo de publicaciones.

CREATE OR REPLACE FUNCTION staff_app.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM staff_app.members m
      JOIN staff_app.organizations o ON o.id = m.organization_id
     WHERE m.user_id = auth.uid()
       AND m.role IN ('owner','writer')
       AND o.es_plataforma = true
  );
$$;
COMMENT ON FUNCTION staff_app.is_platform_admin() IS
  'True si el caller es owner/writer de la organizacion marcada es_plataforma. Es el UNICO rol que cruza organizaciones. Antes de la 0054 este concepto no existia.';

-- Moderacion: bajar una busqueda YA publicada. Distinto de cerrarla (eso lo hace
-- la productora cuando se lleno). El motivo es obligatorio: una baja sin motivo
-- es una pelea con el cliente dos dias despues.
ALTER TABLE staff_app.gig_openings
  ADD COLUMN IF NOT EXISTS moderada_at     timestamptz,
  ADD COLUMN IF NOT EXISTS moderada_motivo text;

COMMENT ON COLUMN staff_app.gig_openings.moderada_at IS
  'La bajo la plataforma (SOMOS DER), no la productora. Distinto de cerrado_at.';

-- ⚠️ trabajos_abiertos y postularme se redefinen ACA para excluir lo moderado, y
-- despues OTRA VEZ en la 0055 (que ademas les cambia como resuelven la org).
-- La version vigente es la de la 0055.

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_resumen()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'organizaciones', (SELECT count(*) FROM staff_app.organizations WHERE coalesce(es_plataforma,false) = false),
    'personas',       (SELECT count(*) FROM staff_app.staff_profiles),
    'proveedores',    (SELECT count(*) FROM staff_app.marketplace_profiles WHERE tipo = 'proveedor'),
    'busquedas_vivas',(SELECT count(*) FROM staff_app.gig_openings
                        WHERE publicado_at IS NOT NULL AND cerrado_at IS NULL AND moderada_at IS NULL),
    'postulaciones',  (SELECT count(*) FROM staff_app.gig_applications),
    'contrataciones', (SELECT count(*) FROM staff_app.offers WHERE status = 'accepted')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_resumen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_resumen() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_busquedas()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'organizacion', org.name, 'organizacion_id', org.id,
      'role', o.role, 'cupo', o.cupo, 'pago', o.pago, 'notas', o.notas,
      'publicado_at', o.publicado_at, 'cerrado_at', o.cerrado_at,
      'moderada_at', o.moderada_at, 'moderada_motivo', o.moderada_motivo,
      'gig_title', g.title, 'gig_starts_at', g.starts_at,
      'postulados', (SELECT count(*) FROM staff_app.gig_applications a WHERE a.opening_id = o.id)
    ) ORDER BY o.publicado_at DESC NULLS LAST, o.created_at DESC)
    FROM staff_app.gig_openings o
    JOIN staff_app.organizations org ON org.id = o.organization_id
    LEFT JOIN staff_app.gigs g ON g.id = o.gig_id
    WHERE o.publicado_at IS NOT NULL
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_busquedas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_busquedas() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_contrataciones()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id, 'organizacion', org.name,
      'persona', btrim(coalesce(sp.nombre,'') || ' ' || coalesce(sp.apellido,'')),
      'persona_id', sp.id, 'role', o.role, 'amount', o.amount,
      'responded_at', o.responded_at, 'gig_title', g.title,
      'gig_starts_at', g.starts_at, 'pago_listo_at', o.pago_listo_at
    ) ORDER BY o.responded_at DESC NULLS LAST)
    FROM staff_app.offers o
    JOIN staff_app.organizations org ON org.id = o.organization_id
    JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
    LEFT JOIN staff_app.gigs g ON g.id = o.gig_id
    WHERE o.status = 'accepted'
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_contrataciones() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_contrataciones() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_organizaciones()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', org.id, 'name', org.name, 'slug', org.slug, 'activa', org.activa,
      'es_plataforma', org.es_plataforma, 'created_at', org.created_at,
      'miembros',  (SELECT count(*) FROM staff_app.members m WHERE m.organization_id = org.id),
      'eventos',   (SELECT count(*) FROM staff_app.gigs g WHERE g.organization_id = org.id),
      'busquedas', (SELECT count(*) FROM staff_app.gig_openings o WHERE o.organization_id = org.id),
      'contrataciones', (SELECT count(*) FROM staff_app.offers of WHERE of.organization_id = org.id AND of.status = 'accepted')
    ) ORDER BY org.created_at ASC)
    FROM staff_app.organizations org
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_organizaciones() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_organizaciones() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_plataforma_moderar(
  p_opening_id uuid, p_bajar boolean, p_motivo text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  IF p_bajar AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_motivo');
  END IF;
  UPDATE staff_app.gig_openings
     SET moderada_at     = CASE WHEN p_bajar THEN now() ELSE NULL END,
         moderada_motivo = CASE WHEN p_bajar THEN btrim(p_motivo) ELSE NULL END
   WHERE id = p_opening_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  RETURN jsonb_build_object('ok', true, 'bajada', p_bajar);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_moderar(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_moderar(uuid, boolean, text) TO authenticated;
COMMENT ON FUNCTION public.staff_app_plataforma_moderar(uuid, boolean, text) IS
  'SOMOS DER baja una busqueda publicada, con motivo obligatorio. Se puede restituir.';
