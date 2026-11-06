-- 0107 · Portal abierto de verdad (6/11, turno noche C4). ADITIVA.
-- 1) CUIT o DNI de quien publica: tabla aparte, solo servidor (RLS sin políticas).
-- 2) Condiciones separadas en cada búsqueda: horario, vestimenta, comida, traslado, forma y plazo de pago.
-- 3) /trabajos y postularse dejan de estar atados a la organización de la ficha:
--    hasta hoy los 1.297 perfiles estaban vinculados solo a SOMOS DER, así que la
--    búsqueda de cualquier otra empresa registrada no la veía nadie. Ahora se ven
--    todas, ordenadas por cuánto encajan (rubro, zona, disponibilidad).

CREATE TABLE IF NOT EXISTS staff_app.organizacion_identidad (
  organization_id uuid PRIMARY KEY REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  doc_tipo   text NOT NULL CHECK (doc_tipo IN ('CUIT','DNI')),
  doc_numero text NOT NULL CHECK (doc_numero ~ '^[0-9]{7,11}$'),
  cargado_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staff_app.organizacion_identidad IS
  'CUIT o DNI de quien publica (plan fase 2, punto 6). Solo lo ve la plataforma: RLS sin políticas, se escribe y lee con service_role. Nunca público.';
ALTER TABLE staff_app.organizacion_identidad ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_app.organizacion_identidad FROM public, anon, authenticated;
GRANT ALL ON staff_app.organizacion_identidad TO service_role;

CREATE OR REPLACE FUNCTION public.staff_app_org_identidad_guardar(p_org uuid, p_tipo text, p_numero text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, pg_temp AS $$
BEGIN
  INSERT INTO staff_app.organizacion_identidad (organization_id, doc_tipo, doc_numero)
  VALUES (p_org, p_tipo, p_numero)
  ON CONFLICT (organization_id) DO UPDATE SET doc_tipo = excluded.doc_tipo, doc_numero = excluded.doc_numero, cargado_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.staff_app_org_identidad_guardar(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_org_identidad_guardar(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_app_org_identidad_tiene(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM staff_app.organizacion_identidad WHERE organization_id = p_org);
$$;
REVOKE ALL ON FUNCTION public.staff_app_org_identidad_tiene(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_org_identidad_tiene(uuid) TO service_role;

ALTER TABLE staff_app.gig_openings
  ADD COLUMN IF NOT EXISTS horario    text,
  ADD COLUMN IF NOT EXISTS vestimenta text,
  ADD COLUMN IF NOT EXISTS comida     text,
  ADD COLUMN IF NOT EXISTS traslado   text,
  ADD COLUMN IF NOT EXISTS forma_pago text,
  ADD COLUMN IF NOT EXISTS plazo_pago text;

-- Se llama desde la server action DESPUÉS de staff_app_crear_busqueda (que ya
-- validó is_org_writer y devolvió el id). Solo servidor.
CREATE OR REPLACE FUNCTION public.staff_app_busqueda_condiciones(
  p_opening_id uuid, p_horario text, p_vestimenta text, p_comida text,
  p_traslado text, p_forma_pago text, p_plazo_pago text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, pg_temp AS $$
BEGIN
  UPDATE staff_app.gig_openings SET
    horario    = nullif(btrim(coalesce(p_horario, '')), ''),
    vestimenta = nullif(btrim(coalesce(p_vestimenta, '')), ''),
    comida     = nullif(btrim(coalesce(p_comida, '')), ''),
    traslado   = nullif(btrim(coalesce(p_traslado, '')), ''),
    forma_pago = nullif(btrim(coalesce(p_forma_pago, '')), ''),
    plazo_pago = nullif(btrim(coalesce(p_plazo_pago, '')), '')
  WHERE id = p_opening_id;
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.staff_app_busqueda_condiciones(uuid, text, text, text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_busqueda_condiciones(uuid, text, text, text, text, text, text) TO service_role;

-- ¿Encaja esta persona con esta búsqueda? Reglas simples y explicables, sin IA.
CREATE OR REPLACE FUNCTION staff_app.encaje(p_pid uuid, p_opening_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'rubro', EXISTS (
      SELECT 1 FROM unnest(coalesce(sp.oficios, '{}')) of
       WHERE length(split_part(split_part(lower(of), '/', 1), ' ', 1)) >= 4
         AND position(left(split_part(split_part(lower(of), '/', 1), ' ', 1), 5) IN lower(o.role)) > 0),
    'zona', coalesce(sp.disponibilidad_viajar, false)
         OR (g.venue_address IS NOT NULL AND (
              (sp.ciudad IS NOT NULL AND length(sp.ciudad) >= 3 AND position(lower(sp.ciudad) IN lower(g.venue_address)) > 0)
           OR (sp.provincia ILIKE '%CABA%' AND g.venue_address ~* '(caba|capital federal|buenos aires)')
           OR (sp.provincia IS NOT NULL AND sp.provincia NOT ILIKE '%CABA%'
               AND position(lower(btrim(replace(split_part(sp.provincia, '(', 1), 'Provincia', ''))) IN lower(g.venue_address)) > 0))),
    'disponible', g.starts_at IS NULL
         OR extract(isodow FROM g.starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires') < 6
         OR coalesce(sp.disponibilidad_finde, true)
  )
  FROM staff_app.staff_profiles sp, staff_app.gig_openings o JOIN staff_app.gigs g ON g.id = o.gig_id
  WHERE sp.id = p_pid AND o.id = p_opening_id;
$$;
REVOKE ALL ON FUNCTION staff_app.encaje(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_trabajos_abiertos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp' AS $function$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(NULL);
BEGIN
  IF v_pid IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x.j ORDER BY x.puntos DESC, x.starts_at ASC NULLS LAST)
    FROM (
      SELECT jsonb_build_object(
        'opening_id', o.id, 'role', o.role, 'cupo', o.cupo, 'pago', o.pago, 'notas', o.notas,
        'horario', o.horario, 'vestimenta', o.vestimenta, 'comida', o.comida, 'traslado', o.traslado,
        'forma_pago', o.forma_pago, 'plazo_pago', o.plazo_pago,
        'gig_id', g.id, 'gig_title', g.title, 'gig_starts_at', g.starts_at, 'gig_ends_at', g.ends_at,
        'gig_venue', g.venue_name, 'gig_address', g.venue_address, 'productora', org.name,
        'ya_me_postule', (a.id IS NOT NULL), 'mi_estado', a.estado, 'encaje', e.e
      ) AS j,
      ((e.e->>'rubro')::boolean)::int * 4 + ((e.e->>'zona')::boolean)::int * 2 + ((e.e->>'disponible')::boolean)::int AS puntos,
      g.starts_at
      FROM staff_app.gig_openings o
      JOIN staff_app.gigs g ON g.id = o.gig_id
      JOIN staff_app.organizations org ON org.id = o.organization_id
      LEFT JOIN staff_app.gig_applications a ON a.opening_id = o.id AND a.staff_profile_id = v_pid
      CROSS JOIN LATERAL (SELECT staff_app.encaje(v_pid, o.id) AS e) e
      WHERE o.publicado_at IS NOT NULL AND o.cerrado_at IS NULL AND o.moderada_at IS NULL
        AND (g.starts_at IS NULL OR g.starts_at > now())
    ) x
  ), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_app_postularme(p_opening_id uuid, p_mensaje text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp' AS $function$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(NULL);
  v_o   staff_app.gig_openings%ROWTYPE;
BEGIN
  IF v_pid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_staff'); END IF;
  -- Portal abierto (0107): cualquier persona puede postularse a cualquier búsqueda publicada.
  SELECT * INTO v_o FROM staff_app.gig_openings o
   WHERE o.id = p_opening_id AND o.publicado_at IS NOT NULL AND o.cerrado_at IS NULL AND o.moderada_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible'); END IF;
  PERFORM 1 FROM staff_app.gigs g WHERE g.id = v_o.gig_id AND (g.starts_at IS NULL OR g.starts_at > now());
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'ya_paso'); END IF;
  INSERT INTO staff_app.gig_applications (organization_id, opening_id, staff_profile_id, mensaje)
  VALUES (v_o.organization_id, p_opening_id, v_pid, nullif(btrim(coalesce(p_mensaje, '')), ''))
  ON CONFLICT (opening_id, staff_profile_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$function$;
