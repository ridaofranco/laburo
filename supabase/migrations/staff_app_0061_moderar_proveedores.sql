-- staff_app_0061_moderar_proveedores
-- Franco puede bajar a un proveedor del directorio.
--
-- ── POR QUE ESTO NO ES UN EXTRA ──────────────────────────────────────────────
-- La 0060 abrio el alta de proveedores: cualquiera se anota y aparece en la
-- vidriera AL TOQUE, sin que nadie apruebe nada (decision de Franco, 3/8). Esa
-- decision es correcta, la friccion mata un marketplace, pero deja el control
-- para DESPUES. Y "despues" no existia: staff_app_plataforma_moderar (0054)
-- solo modera gig_openings, o sea busquedas de staff. Sobre un proveedor
-- publicado no habia NINGUNA forma de intervenir desde la app.
--
-- El riesgo no es teorico y ya paso: el unico proveedor cargado a mano tenia una
-- obscenidad en la bio y era el 100% del directorio, visible para cualquier
-- productora que entrara. Con alta abierta eso deja de necesitar un accidente.
--
-- Sin esto, el aviso que manda el server action al registrarse un proveedor
-- seria un aviso sin boton: Franco se entera y no puede hacer nada.
--
-- ── POR QUE SE GUARDA EL MOTIVO ──────────────────────────────────────────────
-- Mismo criterio que gig_openings: bajar algo sin dejar escrito por que es una
-- decision que en dos meses nadie puede explicar, ni al proveedor que pregunta.

ALTER TABLE staff_app.marketplace_profiles
  ADD COLUMN IF NOT EXISTS moderado_at     timestamptz,
  ADD COLUMN IF NOT EXISTS moderado_motivo text;

COMMENT ON COLUMN staff_app.marketplace_profiles.moderado_at IS
  'Cuando SOMOS DER lo bajo del directorio. NULL = nunca se modero. Es distinto de is_public=false, que tambien puede ser el propio proveedor despublicandose.';

-- ── La lista, para la pantalla de plataforma ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_proveedores()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'id', p.id,
             'nombre', p.display_name,
             'slug', p.slug,
             'email', p.email,
             'headline', p.headline,
             'bio', p.bio,
             'ciudad', p.ciudad,
             'provincia', p.provincia,
             'is_public', p.is_public,
             'activo', p.activo,
             'origen', p.origen,
             'created_at', p.created_at,
             'moderado_at', p.moderado_at,
             'moderado_motivo', p.moderado_motivo,
             'servicios', (SELECT count(*) FROM staff_app.provider_services s
                            WHERE s.profile_id = p.id AND s.activo),
             'consultas', (SELECT count(*) FROM staff_app.provider_contacts c
                            WHERE c.profile_id = p.id)
           ) AS x
      FROM staff_app.marketplace_profiles p
     WHERE p.tipo = 'proveedor'
       AND staff_app.is_platform_admin()
  ) t;
$$;

REVOKE ALL ON FUNCTION public.staff_app_plataforma_proveedores() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_proveedores() TO authenticated;

-- ── Bajarlo o volver a subirlo ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_moderar_proveedor(
  p_profile_id uuid,
  p_bajar      boolean,
  p_motivo     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  -- Bajar sin motivo no se puede: en dos meses nadie se acuerda por que.
  IF p_bajar AND coalesce(btrim(p_motivo), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_motivo');
  END IF;

  UPDATE staff_app.marketplace_profiles
     SET is_public       = NOT p_bajar,
         moderado_at     = CASE WHEN p_bajar THEN now() ELSE NULL END,
         moderado_motivo = CASE WHEN p_bajar THEN btrim(p_motivo) ELSE NULL END,
         updated_at      = now()
   WHERE id = p_profile_id
     AND tipo = 'proveedor';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inexistente');
  END IF;

  RETURN jsonb_build_object('ok', true, 'bajado', p_bajar);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_plataforma_moderar_proveedor(uuid, boolean, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_moderar_proveedor(uuid, boolean, text)
  TO authenticated;

COMMENT ON FUNCTION public.staff_app_plataforma_moderar_proveedor(uuid, boolean, text) IS
  'SOMOS DER baja (o vuelve a subir) a un proveedor del directorio. Es el control que hace segura el alta abierta de la 0060: se publica sin aprobacion, pero se puede sacar en un clic. Gate is_platform_admin() adentro.';
