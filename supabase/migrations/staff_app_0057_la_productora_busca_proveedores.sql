-- staff_app_0057_la_productora_busca_proveedores
-- FASE 3: la productora encuentra proveedores. Cierra el triangulo.
--
-- Los movimientos 1 y 2 le dieron al proveedor identidad propia
-- (marketplace_profiles con user_id) y una forma de publicar lo que ofrece
-- (provider_services). Faltaba el otro lado: que una productora los BUSQUE y los
-- CONTACTE. Sin eso, el proveedor publica en el vacio.
--
-- ── LA BUSQUEDA CRUZA ORGANIZACIONES, A PROPOSITO ───────────────────────────
-- Un proveedor publicado lo ve cualquier productora. Es la misma Regla 1 que
-- Franco eligio para el pool de personas (2/8): la oferta es de la PLATAFORMA.
-- Un proveedor que solo viera a una productora no seria un marketplace, seria
-- su agenda privada, que es exactamente lo que ya se diagnostico del modulo de
-- HITO. Lo que NO cruza: la nota interna y el favorito (profile_org_links).
--
-- ── POR QUE SE GUARDA EL CONTACTO ───────────────────────────────────────────
-- Franco (2/8): "a lo sumo si quiere un empleado, me enterare cuando lo
-- contacte". Vale igual para proveedores: el momento que importa no es la
-- publicacion, es el contacto. Por eso queda registrado y aparece en
-- /plataforma.
--
-- El SQL completo aplicado el 2/8 esta en la base. Para leerlo:
--   select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n
--     on n.oid=p.pronamespace where n.nspname='public' and p.proname in
--     ('staff_app_buscar_proveedores','staff_app_categorias_proveedores',
--      'staff_app_contactar_proveedor','staff_app_plataforma_contactos_proveedor');

CREATE TABLE IF NOT EXISTS staff_app.provider_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  profile_id      uuid NOT NULL REFERENCES staff_app.marketplace_profiles(id) ON DELETE CASCADE,
  gig_id          uuid REFERENCES staff_app.gigs(id) ON DELETE SET NULL,
  mensaje         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_contacts_org_idx ON staff_app.provider_contacts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_contacts_profile_idx ON staff_app.provider_contacts (profile_id);

COMMENT ON TABLE staff_app.provider_contacts IS
  'Cuando una productora contacta a un proveedor del marketplace. Es el equivalente de la contratacion del lado del personal: el momento que le importa a la plataforma. NO es una contratacion cerrada, es "le escribi".';

ALTER TABLE staff_app.provider_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_contacts_select ON staff_app.provider_contacts
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY provider_contacts_write ON staff_app.provider_contacts
  FOR ALL USING (staff_app.is_org_writer(organization_id))
  WITH CHECK (staff_app.is_org_writer(organization_id));

-- Las 4 funciones (buscar_proveedores, categorias_proveedores,
-- contactar_proveedor, plataforma_contactos_proveedor) se aplicaron con esta
-- misma migracion. Ver la nota de arriba para leer el cuerpo vigente.
