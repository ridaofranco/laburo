-- Migration: staff_app_0002_core_tables
-- Project: luillpzfqzbpoqkgvjuw (HITO's Supabase project — D-03 co-location)
-- Applied via Supabase MCP apply_migration on 2026-07-14.
--
-- Core app tables, all RLS-enabled from creation, all under staff_app (zero
-- writes to HITO public.*):
--   staff_profiles — superset of HITO's live 31-column staff_profiles (identical
--     name/type/default, ordinal order) so the repointed web form inserts
--     unchanged, PLUS a NULLABLE organization_id (pitfall #3; anon INSERT
--     policy/trigger arrive in plan 01-03).
--   gigs  — the app's own events; hito_event_id nullable, NO FK (D-01 future-link).
--   crew  — own contracted crew; UNIQUE(gig_id, staff_profile_id) idempotency anchor.
--   offers— token-gated; token_hash = sha256 hex of a 256-bit token (raw never stored).

CREATE TABLE staff_app.staff_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  estado                 text NOT NULL DEFAULT 'pendiente',
  nombre                 text NOT NULL,
  fecha_nacimiento       date,
  documento              text,
  email                  text NOT NULL,
  telefono               text NOT NULL,
  pais_residencia        text,
  provincia              text,
  ciudad                 text,
  donde_trabajar         text[] NOT NULL DEFAULT '{}',
  situacion_legal        text,
  oficios                text[] NOT NULL DEFAULT '{}',
  oficios_otro           text,
  experiencia            boolean,
  anios_experiencia      text,
  experiencia_detalle    text,
  disponibilidad_finde   boolean NOT NULL DEFAULT false,
  disponibilidad_viajar  boolean NOT NULL DEFAULT false,
  movilidad_propia       boolean NOT NULL DEFAULT false,
  cv_url                 text,
  portfolio_url          text,
  linkedin_url           text,
  motivacion             text,
  source                 text NOT NULL DEFAULT 'web_somosder',
  rating                 numeric,
  eventos_trabajados     integer NOT NULL DEFAULT 0,
  notas_internas         text,
  disponibilidad_aviso   text,
  apellido               text,
  organization_id        uuid REFERENCES staff_app.organizations(id)
);

CREATE TABLE staff_app.gigs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  starts_at       timestamptz,
  ends_at         timestamptz,
  timezone        text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  venue_name      text,
  hito_event_id   uuid,
  status          text NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_app.crew (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  gig_id           uuid NOT NULL REFERENCES staff_app.gigs(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
  role             text,
  days             integer NOT NULL DEFAULT 1,
  amount           numeric(18,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, staff_profile_id)
);

CREATE TABLE staff_app.offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  gig_id           uuid NOT NULL REFERENCES staff_app.gigs(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
  role             text NOT NULL,
  amount           numeric(18,2),
  conditions       text,
  token_hash       text NOT NULL UNIQUE,
  status           text NOT NULL DEFAULT 'sent'
                     CHECK (status IN ('sent','viewed','accepted','declined','expired')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  sent_at          timestamptz NOT NULL DEFAULT now(),
  viewed_at        timestamptz,
  responded_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS ON all four from creation.
ALTER TABLE staff_app.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.gigs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.crew           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.offers         ENABLE ROW LEVEL SECURITY;

-- staff_profiles: member SELECT only. NO anon policy here (anon INSERT arrives in 01-03).
CREATE POLICY staff_profiles_select ON staff_app.staff_profiles
  FOR SELECT USING (staff_app.is_org_member(organization_id));

-- gigs / crew / offers: member SELECT + writer ALL.
CREATE POLICY gigs_select ON staff_app.gigs
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY gigs_write ON staff_app.gigs
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

CREATE POLICY crew_select ON staff_app.crew
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY crew_write ON staff_app.crew
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

CREATE POLICY offers_select ON staff_app.offers
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY offers_write ON staff_app.offers
  FOR ALL USING (staff_app.is_org_writer(organization_id))
          WITH CHECK (staff_app.is_org_writer(organization_id));

-- anon/authenticated never touch these directly this phase (offers only via the
-- SECURITY DEFINER RPCs in 01-02; staff_profiles anon INSERT in 01-03).
REVOKE ALL ON staff_app.staff_profiles FROM anon, authenticated;
REVOKE ALL ON staff_app.gigs           FROM anon, authenticated;
REVOKE ALL ON staff_app.crew           FROM anon, authenticated;
REVOKE ALL ON staff_app.offers         FROM anon, authenticated;
