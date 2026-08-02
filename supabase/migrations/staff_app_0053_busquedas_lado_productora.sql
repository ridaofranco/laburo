-- staff_app_0053_busquedas_lado_productora
-- EL OTRO LADO DEL MARKETPLACE: SIN ESTO, LA PANTALLA DEL STAFF ESTA VACIA PARA SIEMPRE.
--
-- La 0052 le dio al staff dónde ver y postularse. Esta le da a la productora
-- cómo publicar: crear la búsqueda ("necesito 5 mozos, se paga tanto"),
-- publicarla, cerrarla, y mover el estado de cada postulado.
--
-- ── POR QUE SON RPC Y NO ESCRITURA DIRECTA ───────────────────────────────────
-- El schema staff_app NO es alcanzable por PostgREST (PGRST106): la app nunca
-- escribe esas tablas directo. Es el mismo molde que ya usan las RPC de
-- productora de la 0036/0038.
--
-- ── LA SEGURIDAD ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER con `search_path` fijado y el chequeo de `is_org_writer`
-- ADENTRO de cada función, contra la organización DEL GIG (no contra una que
-- mande el browser). Ninguna está granteada a anon: solo authenticated.
--
-- ⚠️ NINGUNA DE ESTAS CONTRATA A NADIE. Marcar una postulación como "ofertada"
-- es una nota del proceso, no una contratación: contratar sigue siendo mandar
-- la oferta con monto y fecha desde /staff/[id]/oferta, que la persona acepta
-- por su link. La máquina que ya funciona no se toca; esto solo le da otra
-- fuente de candidatos.

CREATE OR REPLACE FUNCTION public.staff_app_crear_busqueda(
  p_gig_id uuid,
  p_role   text,
  p_cupo   integer DEFAULT 1,
  p_pago   numeric DEFAULT NULL,
  p_notas  text    DEFAULT NULL,
  p_publicar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid;
  v_id  uuid;
BEGIN
  SELECT g.organization_id INTO v_org FROM staff_app.gigs g WHERE g.id = p_gig_id;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_inexistente');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  IF p_role IS NULL OR btrim(p_role) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_rol');
  END IF;
  IF coalesce(p_cupo, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cupo_invalido');
  END IF;

  INSERT INTO staff_app.gig_openings (organization_id, gig_id, role, cupo, pago, notas, publicado_at)
  VALUES (v_org, p_gig_id, btrim(p_role), p_cupo, p_pago,
          nullif(btrim(coalesce(p_notas, '')), ''),
          CASE WHEN p_publicar THEN now() ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_crear_busqueda(uuid, text, integer, numeric, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_crear_busqueda(uuid, text, integer, numeric, text, boolean) TO authenticated;
COMMENT ON FUNCTION public.staff_app_crear_busqueda(uuid, text, integer, numeric, text, boolean) IS
  'La productora define cuanta gente busca y de que rol para un evento. p_publicar=false la deja en borrador (nadie la ve). Solo is_org_writer de la org DEL GIG.';

CREATE OR REPLACE FUNCTION public.staff_app_publicar_busqueda(p_opening_id uuid, p_publicar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT o.organization_id INTO v_org FROM staff_app.gig_openings o WHERE o.id = p_opening_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  UPDATE staff_app.gig_openings
     SET publicado_at = CASE WHEN p_publicar THEN coalesce(publicado_at, now()) ELSE NULL END,
         cerrado_at   = CASE WHEN p_publicar THEN NULL ELSE cerrado_at END
   WHERE id = p_opening_id;

  RETURN jsonb_build_object('ok', true, 'publicada', p_publicar);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_publicar_busqueda(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_publicar_busqueda(uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.staff_app_publicar_busqueda(uuid, boolean) IS
  'Publica o despublica una busqueda. Publicar respeta el publicado_at original (coalesce) para no perder cuando se publico por primera vez.';

CREATE OR REPLACE FUNCTION public.staff_app_cerrar_busqueda(p_opening_id uuid, p_cerrar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT o.organization_id INTO v_org FROM staff_app.gig_openings o WHERE o.id = p_opening_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  UPDATE staff_app.gig_openings
     SET cerrado_at = CASE WHEN p_cerrar THEN now() ELSE NULL END
   WHERE id = p_opening_id;

  RETURN jsonb_build_object('ok', true, 'cerrada', p_cerrar);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_cerrar_busqueda(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_cerrar_busqueda(uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.staff_app_cerrar_busqueda(uuid, boolean) IS
  'Cierra (o reabre) una busqueda. Cerrada deja de aparecerle al staff pero las postulaciones que ya entraron se conservan: son el registro de quien dijo que si.';

CREATE OR REPLACE FUNCTION public.staff_app_marcar_postulacion(p_application_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE v_org uuid;
BEGIN
  IF p_estado NOT IN ('postulada','vista','ofertada','descartada') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  END IF;
  SELECT a.organization_id INTO v_org FROM staff_app.gig_applications a WHERE a.id = p_application_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  UPDATE staff_app.gig_applications
     SET estado = p_estado, updated_at = now()
   WHERE id = p_application_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_marcar_postulacion(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_postulacion(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.staff_app_marcar_postulacion(uuid, text) IS
  'Mueve el estado de una postulacion (vista / ofertada / descartada). NO contrata: contratar sigue siendo mandar la oferta desde /staff/[id]/oferta.';

CREATE OR REPLACE VIEW public.staff_app_busquedas
WITH (security_invoker = true) AS
  SELECT o.id,
         o.organization_id,
         o.gig_id,
         o.role,
         o.cupo,
         o.pago,
         o.notas,
         o.publicado_at,
         o.cerrado_at,
         o.created_at,
         (SELECT count(*) FROM staff_app.gig_applications a WHERE a.opening_id = o.id) AS postulados,
         (SELECT count(*) FROM staff_app.gig_applications a
           WHERE a.opening_id = o.id AND a.estado = 'postulada') AS sin_mirar
    FROM staff_app.gig_openings o;

REVOKE ALL ON public.staff_app_busquedas FROM anon;
GRANT SELECT ON public.staff_app_busquedas TO authenticated;
COMMENT ON VIEW public.staff_app_busquedas IS
  'Las busquedas de cada evento con cuanta gente se postulo y cuanta falta mirar, para el panel de la productora. security_invoker: la RLS de gig_openings decide que filas ve cada uno.';
