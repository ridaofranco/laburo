-- 0109 · Seguro de accidentes personales con MeCubro (Franco 06/11). ADITIVA.
-- La productora asegura a la gente que aceptó su oferta. Paga directo a MeCubro
-- (link de MercadoPago de MeCubro): LABURO no cobra ni toca la plata.

-- Lo que pide la aseguradora y la ficha no tenía.
ALTER TABLE staff_app.staff_profiles
  ADD COLUMN IF NOT EXISTS documento_tipo text CHECK (documento_tipo IN ('DNI','PASAPORTE','OTRO')),
  ADD COLUMN IF NOT EXISTS genero text CHECK (genero IN ('f','m'));

CREATE TABLE IF NOT EXISTS staff_app.seguros (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  gig_id               uuid NOT NULL REFERENCES staff_app.gigs(id) ON DELETE CASCADE,
  ambiente             text NOT NULL CHECK (ambiente IN ('sandbox','produccion')),
  mecubro_insurance_id bigint NOT NULL,
  mecubro_uuid         text NOT NULL,
  codigo               text,
  estado               text NOT NULL DEFAULT 'open',
  total                numeric,
  link_pago            text,
  coverage_id          bigint,
  cobertura            text,
  vigencia_desde       date NOT NULL,
  vigencia_hasta       date NOT NULL,
  personas             uuid[] NOT NULL,
  beneficiario_nombre  text,
  beneficiario_cuit    text,
  creado_por           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  actualizado_at       timestamptz NOT NULL DEFAULT now(),
  pagado_at            timestamptz
);
COMMENT ON TABLE staff_app.seguros IS
  'Seguros de AP sacados en MeCubro desde LABURO, uno por tanda de personas de un evento. Paga la productora directo a MeCubro. RLS sin políticas: solo service_role (el servidor chequea antes que la persona sea de la organización del evento).';
CREATE INDEX IF NOT EXISTS seguros_gig_idx ON staff_app.seguros (gig_id);
ALTER TABLE staff_app.seguros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_app.seguros FROM public, anon, authenticated;
GRANT ALL ON staff_app.seguros TO service_role;

-- Funciones solo servidor (service_role). El servidor ya chequeó que quien
-- llama ve el evento (vista staff_app_gigs con RLS) antes de usarlas.
CREATE OR REPLACE FUNCTION public.staff_app_seguro_personas(p_gig uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'staff_profile_id', sp.id, 'nombre', sp.nombre, 'apellido', sp.apellido,
    'documento', sp.documento, 'documento_tipo', sp.documento_tipo,
    'fecha_nacimiento', sp.fecha_nacimiento, 'genero', sp.genero, 'rol', o.role
  ) ORDER BY sp.apellido, sp.nombre), '[]'::jsonb)
  FROM (SELECT DISTINCT ON (staff_profile_id) staff_profile_id, role FROM staff_app.offers
         WHERE gig_id = p_gig AND status = 'accepted' ORDER BY staff_profile_id, responded_at DESC NULLS LAST) o
  JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.staff_app_seguros_del_gig(p_gig uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb)
  FROM staff_app.seguros s WHERE s.gig_id = p_gig;
$$;

CREATE OR REPLACE FUNCTION public.staff_app_seguro_guardar(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO staff_app.seguros (organization_id, gig_id, ambiente, mecubro_insurance_id, mecubro_uuid, codigo, estado,
    total, link_pago, coverage_id, cobertura, vigencia_desde, vigencia_hasta, personas, beneficiario_nombre, beneficiario_cuit, creado_por)
  VALUES ((p->>'organization_id')::uuid, (p->>'gig_id')::uuid, p->>'ambiente', (p->>'mecubro_insurance_id')::bigint, p->>'mecubro_uuid',
    p->>'codigo', coalesce(p->>'estado','open'), (p->>'total')::numeric, p->>'link_pago', (p->>'coverage_id')::bigint, p->>'cobertura',
    (p->>'vigencia_desde')::date, (p->>'vigencia_hasta')::date,
    ARRAY(SELECT jsonb_array_elements_text(p->'personas'))::uuid[], p->>'beneficiario_nombre', p->>'beneficiario_cuit', (p->>'creado_por')::uuid)
  RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.staff_app_seguro_actualizar(p_id uuid, p_estado text, p_total numeric, p_pagado boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE staff_app.seguros SET estado = p_estado, total = coalesce(p_total, total), actualizado_at = now(),
    pagado_at = CASE WHEN p_pagado AND pagado_at IS NULL THEN now() ELSE pagado_at END
  WHERE id = p_id;
$$;

-- ¿Cuántas personas aceptadas de un evento todavía no están en ningún seguro? (aviso en el tablero)
CREATE OR REPLACE FUNCTION public.staff_app_seguro_pendientes(p_gigs uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(x.gig_id, x.n), '{}'::jsonb) FROM (
    SELECT o.gig_id, count(DISTINCT o.staff_profile_id) n
      FROM staff_app.offers o
     WHERE o.gig_id = ANY(p_gigs) AND o.status = 'accepted'
       AND NOT EXISTS (SELECT 1 FROM staff_app.seguros s WHERE s.gig_id = o.gig_id AND s.estado <> 'cancel' AND o.staff_profile_id = ANY(s.personas))
     GROUP BY o.gig_id) x;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['staff_app_seguro_personas(uuid)','staff_app_seguros_del_gig(uuid)','staff_app_seguro_guardar(jsonb)',
    'staff_app_seguro_actualizar(uuid,text,numeric,boolean)','staff_app_seguro_pendientes(uuid[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
