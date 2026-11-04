-- 0105 · DENUNCIAS (Franco aprobó la tabla el 4/11; plan del cambio de LABURO, fase 1 punto 5)
--
-- Hasta acá cada denuncia salía solo por Telegram y por el mail de admin (lib/denuncias.ts).
-- Ahora además queda guardada acá, para que Franco vea las pendientes en /plataforma/denuncias
-- y pueda dar de baja la oferta desde ahí.
--
-- Reglas:
--  · ADITIVA: crea una tabla y tres funciones. No toca ni borra datos existentes.
--  · RLS activada y SIN políticas: ni anon ni authenticated leen ni escriben la tabla directo.
--  · Inserción: solo el servidor de LABURO (llave de servicio, lib/denuncias.ts), después de
--    validar la oferta. No hay función de inserción expuesta.
--  · Lectura y revisión: solo por las dos RPC de plataforma, que chequean is_platform_admin().

CREATE TABLE IF NOT EXISTS staff_app.denuncias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Qué se denuncia: una búsqueda abierta, una oferta por link o un perfil.
  tipo             text NOT NULL CHECK (tipo IN ('busqueda','oferta','perfil')),
  opening_id       uuid REFERENCES staff_app.gig_openings(id) ON DELETE SET NULL,
  offer_id         uuid REFERENCES staff_app.offers(id) ON DELETE SET NULL,
  staff_profile_id uuid REFERENCES staff_app.staff_profiles(id) ON DELETE SET NULL,
  organization_id  uuid REFERENCES staff_app.organizations(id) ON DELETE SET NULL,
  motivo           text NOT NULL CHECK (motivo IN ('pide_plata','discrimina','falsa','ilegal','otro')),
  detalle          text CHECK (detalle IS NULL OR length(detalle) <= 500),
  urgente          boolean NOT NULL DEFAULT false,
  -- Foto de lo que vio el denunciante (por si la oferta cambia o se borra después).
  donde            text,
  rol              text,
  evento           text,
  quien_publica    text,
  denunciante      text,
  denunciante_user uuid,
  -- Revisión de Franco.
  estado           text NOT NULL DEFAULT 'revision' CHECK (estado IN ('revision','baja','descartada')),
  revisada_at      timestamptz,
  revisada_por     uuid,
  nota_revision    text
);

CREATE INDEX IF NOT EXISTS denuncias_estado_idx ON staff_app.denuncias (estado, created_at DESC);

ALTER TABLE staff_app.denuncias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_app.denuncias FROM public, anon, authenticated;
GRANT ALL ON staff_app.denuncias TO service_role;

COMMENT ON TABLE staff_app.denuncias IS
  'Denuncias de ofertas/búsquedas/perfiles. Inserta solo el servidor (service_role). Lee y revisa solo la plataforma por RPC. 0105.';

-- ── Lista para la plataforma ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_denuncias(p_solo_pendientes boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  RETURN jsonb_build_object('ok', true, 'denuncias', coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.urgente DESC, x.created_at DESC)
      FROM (
        SELECT d.id, d.created_at, d.tipo, d.opening_id, d.offer_id, d.staff_profile_id,
               d.motivo, d.detalle, d.urgente, d.donde, d.rol, d.evento, d.quien_publica,
               d.denunciante, d.estado, d.revisada_at, d.nota_revision,
               o.name AS organizacion,
               go.moderada_at AS busqueda_moderada_at,
               off.status AS oferta_estado
          FROM staff_app.denuncias d
          LEFT JOIN staff_app.organizations o ON o.id = d.organization_id
          LEFT JOIN staff_app.gig_openings go ON go.id = d.opening_id
          LEFT JOIN staff_app.offers off ON off.id = d.offer_id
         WHERE NOT p_solo_pendientes OR d.estado = 'revision'
         ORDER BY d.created_at DESC
         LIMIT 200
      ) x
  ), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_denuncias(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_denuncias(boolean) TO authenticated;

-- ── Resolver: dar de baja (y bajar la oferta) o descartar ──────────────────
-- 'baja' sobre una búsqueda la modera igual que staff_app_plataforma_moderar (se puede
-- restituir desde /plataforma). Sobre una oferta por link la pasa a 'expired' si seguía viva.
-- No se borra nada.
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_resolver_denuncia(
  p_id uuid, p_estado text, p_nota text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE d staff_app.denuncias%ROWTYPE;
BEGIN
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;
  IF p_estado NOT IN ('baja','descartada') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  END IF;
  SELECT * INTO d FROM staff_app.denuncias WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;

  IF p_estado = 'baja' THEN
    IF d.opening_id IS NOT NULL THEN
      UPDATE staff_app.gig_openings
         SET moderada_at = now(),
             moderada_motivo = 'Denuncia: ' || coalesce(nullif(btrim(p_nota), ''), d.motivo)
       WHERE id = d.opening_id AND moderada_at IS NULL;
    END IF;
    IF d.offer_id IS NOT NULL THEN
      UPDATE staff_app.offers SET status = 'expired'
       WHERE id = d.offer_id AND status IN ('sent','viewed');
    END IF;
  END IF;

  UPDATE staff_app.denuncias
     SET estado = p_estado, revisada_at = now(), revisada_por = auth.uid(),
         nota_revision = nullif(btrim(coalesce(p_nota, '')), '')
   WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'estado', p_estado);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_plataforma_resolver_denuncia(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_resolver_denuncia(uuid, text, text) TO authenticated;
