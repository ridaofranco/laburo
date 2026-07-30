-- Migration: staff_app_0039_producer_leads
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- ⚠️ NO APLICADA TODAVÍA (30/7/2026): va como ARCHIVO, la aplica Franco a mano en
-- el SQL editor (o Claude por MCP con su OK). Aditiva: una tabla nueva, una vista
-- nueva y tres funciones nuevas. No toca ninguna tabla existente, ni datos, ni
-- nada de HITO o PASE.
--
-- NUMERACIÓN: 0035-0038 existen como archivo en la rama `desharcodear-org` y
-- 0032-0034 en `main`; ninguna está aplicada. Esta sigue por número de archivo
-- (0039) para que nunca haya dos migraciones con el mismo número.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL AGUJERO QUE TAPA: la landing pública ("/") tiene el único formulario
-- comercial del producto — el productor que quiere staff deja nombre, mail y qué
-- necesita. Hasta hoy ese lead NO SE GUARDABA EN NINGÚN LADO: el server action
-- armaba un mail y lo mandaba a MAIL_ADMIN_TO. Si Resend y el SMTP fallaban los
-- dos, el lead se evaporaba y Franco no se enteraba nunca. Un productor
-- interesado es exactamente el cliente que hay que no perder, así que a partir
-- de acá el lead se PERSISTE PRIMERO y el mail queda como aviso, no como
-- almacenamiento.
--
-- SEGURIDAD (molde 0011 verbatim):
--   * Tabla en staff_app (PostgREST no expone ese schema) + RLS is_org_member /
--     is_org_writer. anon no tiene NADA sobre la tabla ni sobre la vista.
--   * Lectura por vista public security_invoker → el productor logueado la lee
--     con su JWT y la RLS le scopea las filas a su org.
--   * La ESCRITURA del lead viene de un visitante SIN sesión. En vez de abrirle
--     una RPC a anon (que sería un endpoint público de escritura en la base, y
--     0016/0019 vienen justamente de cerrar esos), la RPC de alta es
--     service_role-only y la llama el server action con el admin client, después
--     de sus propias defensas (honeypot + rate limit por IP).
--   * search_path pineado, org FORZADA por constante (nunca de input).
-- ─────────────────────────────────────────────────────────────────────────────

-- ===========================================================================
-- (1) La tabla
-- ===========================================================================
CREATE TABLE IF NOT EXISTS staff_app.producer_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  empresa         text,
  email           text NOT NULL,
  telefono        text,
  mensaje         text NOT NULL,
  -- De dónde entró la consulta. Hoy siempre 'landing'; el día que haya otra
  -- puerta (blog, campaña, marca blanca) se distingue sin migrar de nuevo.
  origen          text NOT NULL DEFAULT 'landing',
  -- Estado simple, de una sola dimensión: o está sin tocar, o alguien ya le
  -- escribió, o se descartó. Nada de un CRM adentro de la landing.
  estado          text NOT NULL DEFAULT 'nuevo'
                    CHECK (estado IN ('nuevo', 'contactado', 'descartado')),
  contactado_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staff_app.producer_leads IS
  'Consultas de productores desde la landing pública (formulario sin login). Se escribe ANTES de intentar el mail a MAIL_ADMIN_TO: el mail es el aviso, esta tabla es la memoria. Alta por public.staff_app_registrar_lead_productor (service_role, la llama el server action); lectura por la vista public.staff_app_producer_leads; el productor la mira en /leads.';

COMMENT ON COLUMN staff_app.producer_leads.estado IS
  'nuevo = nadie lo tocó todavía · contactado = ya le escribimos (estampa contactado_at) · descartado = no aplica. Lo mueve public.staff_app_marcar_lead_estado desde /leads.';

-- Orden natural de la pantalla: lo más nuevo arriba, y los 'nuevo' primero.
CREATE INDEX IF NOT EXISTS producer_leads_org_created
  ON staff_app.producer_leads (organization_id, created_at DESC);

ALTER TABLE staff_app.producer_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producer_leads_select ON staff_app.producer_leads;
CREATE POLICY producer_leads_select ON staff_app.producer_leads
  FOR SELECT USING (staff_app.is_org_member(organization_id));

DROP POLICY IF EXISTS producer_leads_write ON staff_app.producer_leads;
CREATE POLICY producer_leads_write ON staff_app.producer_leads
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

-- Grants de tabla: se le niega todo a los dos roles y se le devuelve a
-- authenticated el SELECT que la vista security_invoker necesita (Pitfall 5 de
-- 0011). La RLS igual scopea las filas; anon no recibe NADA.
REVOKE ALL ON staff_app.producer_leads FROM anon, authenticated;
GRANT SELECT ON staff_app.producer_leads TO authenticated;

-- ===========================================================================
-- (2) La vista de lectura (lo que consume /leads)
-- ===========================================================================
CREATE OR REPLACE VIEW public.staff_app_producer_leads WITH (security_invoker = true) AS
  SELECT id, nombre, empresa, email, telefono, mensaje, origen, estado,
         contactado_at, created_at, organization_id
  FROM staff_app.producer_leads;

GRANT SELECT ON public.staff_app_producer_leads TO authenticated;
REVOKE ALL ON public.staff_app_producer_leads FROM anon;

COMMENT ON VIEW public.staff_app_producer_leads IS
  'Vista security_invoker sobre staff_app.producer_leads: la RLS is_org_member scopea las filas a la org del que consulta. authenticated SELECT solamente; anon revocado (WR-05). La lee /leads en el portal del productor.';

-- ===========================================================================
-- (3) Alta del lead — service_role only (la llama el server action)
-- ===========================================================================
-- Devuelve jsonb {ok, id} para que el action pueda loguear el id y seguir con el
-- mail. NUNCA tira: si el input está vacío devuelve ok=false con motivo, así el
-- formulario no se cae por una validación de base.
CREATE OR REPLACE FUNCTION public.staff_app_registrar_lead_productor(
  p_nombre   text,
  p_email    text,
  p_mensaje  text,
  p_telefono text DEFAULT NULL,
  p_empresa  text DEFAULT NULL,
  p_origen   text DEFAULT 'landing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  -- ⚠️ DEUDA CONOCIDA (anotada 30/7): la org va escrita a mano, que es justo el
  -- patrón que las migraciones 0035-0038 (rama desharcodear-org) sacaron de 36
  -- funciones. Se deja así porque HOY es correcto: estos leads entran por la
  -- landing pública de LABURO, que es la de SOMOS DER. Pero al aplicar las
  -- 0035-0038, ESTA FUNCIÓN Y staff_app_marcar_lead_estado TIENEN QUE PASAR A
  -- staff_app.resolve_org(), o el marketplace multi-productora nace con la fuga.
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
  v_id  uuid;
BEGIN
  IF coalesce(btrim(p_nombre), '') = ''
     OR coalesce(btrim(p_email), '') = ''
     OR coalesce(btrim(p_mensaje), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'datos_incompletos');
  END IF;

  INSERT INTO producer_leads (
    organization_id, nombre, empresa, email, telefono, mensaje, origen
  ) VALUES (
    v_org,
    left(btrim(p_nombre), 120),
    nullif(left(btrim(coalesce(p_empresa, '')), 160), ''),
    -- lowercase por la misma razón que el registro de staff: si el mismo
    -- productor vuelve a consultar, las dos filas se agrupan a ojo por mail.
    lower(left(btrim(p_email), 200)),
    nullif(left(btrim(coalesce(p_telefono, '')), 60), ''),
    left(btrim(p_mensaje), 2000),
    coalesce(nullif(btrim(p_origen), ''), 'landing')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text) IS
  'Guarda una consulta de productor de la landing en staff_app.producer_leads (org SOMOS DER forzada por constante) y devuelve {ok,id}. service_role EXECUTE solo: la llama app/landing/actions.ts con el admin client, ANTES de intentar el mail, y después del honeypot y del rate limit por IP. A anon no se le abre ninguna escritura pública (0016/0019).';

-- ===========================================================================
-- (4) Mover el estado del lead — authenticated con gate de writer
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.staff_app_marcar_lead_estado(
  p_lead_id uuid,
  p_estado  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  -- ⚠️ Misma deuda que arriba: pasar a staff_app.resolve_org() al aplicar 0035-0038.
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
BEGIN
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF p_estado IS NULL OR p_estado NOT IN ('nuevo', 'contactado', 'descartado') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  END IF;

  UPDATE producer_leads
     SET estado = p_estado,
         -- La primera vez que pasa a 'contactado' queda la fecha; volver a
         -- 'nuevo' la borra (fue un click equivocado, no un contacto real).
         contactado_at = CASE
                           WHEN p_estado = 'contactado' THEN coalesce(contactado_at, now())
                           WHEN p_estado = 'nuevo' THEN NULL
                           ELSE contactado_at
                         END
   WHERE id = p_lead_id AND organization_id = v_org;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'estado', p_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) IS
  'Mueve el estado de un lead de productor (nuevo/contactado/descartado) y estampa contactado_at la primera vez que pasa a contactado. Gate is_org_writer con el JWT real del caller (auth.uid() sobrevive dentro de SECURITY DEFINER), org forzada por constante. authenticated EXECUTE; anon revocado. La llama el botón de /leads.';
