-- ===========================================================================
-- 0041 — MARKETPLACE DE 3 LADOS, MOVIMIENTO 1: LA OFERTA EXISTE POR SÍ MISMA
-- ===========================================================================
--
-- QUÉ PIDIÓ FRANCO (31/7): que los proveedores puedan OFRECER sus servicios, que
-- las empresas los puedan CONTRATAR, que además se pueda contratar personal desde
-- cualquier lado, y que todo gire alrededor de los eventos.
--
-- ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
--
-- Hoy la oferta no existe por sí misma: PERTENECE a una productora.
--
--   staff_app.staff_profiles → tiene organization_id, NO tiene user_id
--   public.vendors           → tiene organization_id, NO tiene user_id
--
-- O sea que una persona y un proveedor son filas del pool de DER, no entidades
-- del mercado. Eso alcanza para una agenda de contactos privada y NO alcanza para
-- un marketplace, por tres motivos concretos:
--
--   1. **El proveedor no puede ofrecerse.** Lo carga la productora
--      (hito-live: app/[orgSlug]/proveedores/nuevo inserta en vendors) y no tiene
--      forma de entrar a nada. Es exactamente lo que Franco quiere que pueda hacer.
--   2. **La misma persona en dos productoras serían DOS filas distintas**, con dos
--      historiales, dos calificaciones y ningún modo de saber que son la misma.
--   3. **La calificación no se puede compartir ni proteger.** Hoy la nota vive
--      pegada a la ficha de una org; en un mercado tiene que poder ser del perfil
--      (reputación) o de la relación (privada), y son cosas distintas.
--
-- ── LA ESTRATEGIA: separar el PERFIL de la RELACIÓN ─────────────────────────
--
-- Es el mismo movimiento en los dos lados de la oferta:
--
--   PERFIL   = quién es. Único en todo el mercado. Lo maneja su dueño.
--   RELACIÓN = qué vínculo tiene ESA productora con ese perfil: si lo tiene en su
--              pool, cómo lo califica, qué notas le puso, si es favorito.
--
-- ── POR QUÉ ESTA MIGRACIÓN NO ROMPE NADA ────────────────────────────────────
--
-- Es 100% ADITIVA. No borra ni una columna, no cambia ni una función, no toca
-- ninguna de las tablas que la app usa hoy para trabajar. Suma:
--   (1) `marketplace_profiles`  — el perfil único, para persona Y para empresa
--   (2) `profile_org_links`     — la relación perfil ↔ productora
--   (3) `provider_services`     — qué servicios presta cada proveedor
--   (4) el vínculo hacia atrás desde staff_profiles y vendors, sin tocarlas
--
-- Las 1009 fichas de personal y los vendors de HITO quedan enlazados solos, así
-- que el día uno el marketplace arranca con el inventario que ya existe en vez de
-- arrancar vacío.
--
-- ⚠️ Lo que esta migración NO hace, a propósito: no le da login a nadie, no
-- publica nada y no cambia ni una pantalla. Eso son los movimientos 2, 3 y 4.
-- Acá solo se pone el cimiento.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- (1) EL PERFIL ÚNICO DEL MERCADO
--
--     Una sola tabla para los dos lados de la oferta, con un campo `tipo` que
--     dice cuál es. Va junto y no separado porque todo lo que viene después
--     (postularse, ser buscado, ser calificado, cobrar) es idéntico para los dos:
--     tenerlos separados obligaría a escribir dos veces cada pieza.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.marketplace_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'persona'  = alguien que trabaja en el evento (hoy staff_profiles)
  -- 'proveedor'= una empresa que le presta un servicio al evento (hoy vendors)
  tipo         text NOT NULL CHECK (tipo IN ('persona', 'proveedor')),

  -- Identidad. `user_id` es lo que hoy NO existe en ninguno de los dos lados y es
  -- lo que permite que el dueño entre y maneje lo suyo. Queda NULL hasta que la
  -- persona o el proveedor entra por primera vez con el link mágico.
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email        text NOT NULL,
  telefono     text,

  -- Nombre para mostrar. En persona es nombre y apellido; en proveedor, la razón
  -- social o el nombre de fantasía.
  display_name text NOT NULL,

  -- Perfil público. Los nombres son los mismos que ya usa `public.vendors` en
  -- HITO, para que el porte sea una copia y no una traducción.
  slug         text,
  headline     text,
  bio          text,
  website      text,
  instagram    text,
  ciudad       text,
  provincia    text,

  -- Estado en el mercado.
  is_public    boolean NOT NULL DEFAULT false,  -- ¿aparece en la búsqueda?
  is_verified  boolean NOT NULL DEFAULT false,  -- ¿DER lo verificó?
  activo       boolean NOT NULL DEFAULT true,

  -- Reputación agregada. Se calcula, no se escribe a mano.
  rating_avg   numeric(3,2),
  review_count integer NOT NULL DEFAULT 0,

  -- De dónde salió, para no perder la trazabilidad con lo que ya existía.
  origen                text,
  legacy_staff_profile_id uuid,   -- staff_app.staff_profiles.id
  legacy_vendor_id        uuid,   -- public.vendors.id

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Un mail, un perfil, POR TIPO. La misma persona puede ser trabajador y además
-- dueño de una empresa proveedora, y son dos perfiles distintos con el mismo mail.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_email_tipo_key
  ON staff_app.marketplace_profiles (lower(email), tipo);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_slug_key
  ON staff_app.marketplace_profiles (lower(slug)) WHERE slug IS NOT NULL;

-- Cada ficha vieja se enlaza a lo sumo una vez: sin esto, correr el backfill dos
-- veces duplicaría el mercado entero.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_legacy_staff_key
  ON staff_app.marketplace_profiles (legacy_staff_profile_id) WHERE legacy_staff_profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_profiles_legacy_vendor_key
  ON staff_app.marketplace_profiles (legacy_vendor_id) WHERE legacy_vendor_id IS NOT NULL;

-- Para la búsqueda del movimiento 4.
CREATE INDEX IF NOT EXISTS marketplace_profiles_busqueda
  ON staff_app.marketplace_profiles (tipo, provincia, is_public) WHERE activo;

COMMENT ON TABLE staff_app.marketplace_profiles IS
  'El perfil ÚNICO del marketplace, para los dos lados de la oferta: personas que trabajan en eventos y empresas que le prestan servicios. Es lo que hoy NO existe: staff_profiles y vendors le pertenecen a una productora (tienen organization_id y no tienen user_id), o sea que son agendas privadas y no entidades de mercado. Acá el perfil existe por sí mismo y su dueño lo maneja; el vínculo con cada productora vive aparte, en profile_org_links.';
COMMENT ON COLUMN staff_app.marketplace_profiles.user_id IS
  'La cuenta del dueño del perfil. NULL hasta que entra por primera vez. Es la pieza que permite que un proveedor OFREZCA sus servicios en vez de esperar a que una productora lo cargue.';

-- ---------------------------------------------------------------------------
-- (2) LA RELACIÓN PERFIL ↔ PRODUCTORA
--
--     Acá va todo lo que hoy vive pegado a la ficha y que en realidad es de la
--     productora, no del perfil: si lo tiene en su pool, la nota interna, el
--     favorito, la calificación privada. Dos productoras pueden tener opiniones
--     distintas de la misma persona y las dos son válidas.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.profile_org_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES staff_app.marketplace_profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,

  -- 'pool'        = está en su lista (hoy: las 1009 fichas de DER)
  -- 'contratado'  = ya trabajó con ella al menos una vez
  -- 'bloqueado'   = no quiere volver a convocarlo
  relacion        text NOT NULL DEFAULT 'pool'
                  CHECK (relacion IN ('pool', 'contratado', 'bloqueado')),

  es_favorito     boolean NOT NULL DEFAULT false,
  nota_interna    text,
  rating_privado  smallint CHECK (rating_privado IS NULL OR rating_privado BETWEEN 1 AND 5),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, organization_id)
);

CREATE INDEX IF NOT EXISTS profile_org_links_org_idx
  ON staff_app.profile_org_links (organization_id, relacion);

COMMENT ON TABLE staff_app.profile_org_links IS
  'El vínculo entre un perfil del mercado y una productora. Separa lo que es del PERFIL (quién es, su reputación pública) de lo que es de la RELACIÓN (si está en mi pool, mi nota privada, mi calificación). Sin esta separación, la misma persona en dos productoras serían dos filas distintas con dos historiales y ninguna forma de saber que son la misma.';

-- ---------------------------------------------------------------------------
-- (3) QUÉ SERVICIOS PRESTA CADA PROVEEDOR
--
--     Sin esto, "que los proveedores ofrezcan sus servicios" no se puede buscar:
--     hoy vendors solo tiene `category` y `role`, que son un texto suelto.
--     Un proveedor de catering que además hace mozos son dos servicios, no uno.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.provider_services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES staff_app.marketplace_profiles(id) ON DELETE CASCADE,

  categoria     text NOT NULL,          -- catering, sonido, seguridad, vallas, limpieza…
  titulo        text NOT NULL,          -- "Catering para eventos corporativos"
  descripcion   text,

  -- Orientativo y opcional a propósito: el modelo es cotización por evento, NO
  -- catálogo de precios públicos. Sirve para filtrar por rango, no para vender.
  precio_desde  numeric,
  moneda        text NOT NULL DEFAULT 'ARS',
  unidad        text,                   -- 'por persona', 'por jornada', 'por evento'

  -- Dónde trabaja. Un proveedor de Buenos Aires que viaja a Córdoba lo declara acá.
  provincias    text[] NOT NULL DEFAULT '{}',

  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_services_busqueda
  ON staff_app.provider_services (categoria) WHERE activo;
CREATE INDEX IF NOT EXISTS provider_services_perfil_idx
  ON staff_app.provider_services (profile_id);

COMMENT ON TABLE staff_app.provider_services IS
  'Los servicios que ofrece cada proveedor. Es la pieza que convierte al proveedor de pasivo (espera que le pidan una cotización) en activo (publica lo que hace y lo encuentran). `precio_desde` es orientativo y opcional a propósito: el modelo sigue siendo cotización por evento, no catálogo público.';

-- ---------------------------------------------------------------------------
-- (4) EL PUENTE HACIA ATRÁS, SIN TOCAR LAS TABLAS VIEJAS
--
--     staff_profiles y vendors NO se modifican. El vínculo se guarda del lado
--     nuevo (legacy_staff_profile_id / legacy_vendor_id), así que si esto se
--     revierte, las tablas que la app usa hoy quedan exactamente igual.
-- ---------------------------------------------------------------------------

-- Backfill de PERSONAS: las fichas que ya existen entran al mercado.
-- Solo las que tienen mail válido y no están dadas de baja.
INSERT INTO staff_app.marketplace_profiles
  (tipo, email, telefono, display_name, ciudad, provincia,
   is_public, origen, legacy_staff_profile_id, created_at)
SELECT
  'persona',
  lower(btrim(sp.email)),
  sp.telefono,
  btrim(coalesce(sp.nombre, '') || ' ' || coalesce(sp.apellido, '')),
  sp.ciudad,
  sp.provincia,
  false,                    -- nadie se hace público sin decidirlo (movimiento 2)
  'backfill_staff_profiles',
  sp.id,
  sp.created_at
FROM staff_app.staff_profiles sp
WHERE sp.email IS NOT NULL
  AND btrim(sp.email) <> ''
  AND position('@' in sp.email) > 1
  AND sp.baja_at IS NULL
  AND btrim(coalesce(sp.nombre, '') || ' ' || coalesce(sp.apellido, '')) <> ''
ON CONFLICT DO NOTHING;

-- Backfill de PROVEEDORES: los de HITO entran al mercado.
-- Hoy la tabla está vacía, así que esto es a futuro, pero queda escrito para que
-- el día que se carguen no haya que acordarse de correrlo.
INSERT INTO staff_app.marketplace_profiles
  (tipo, email, telefono, display_name, slug, headline, bio, website, instagram,
   ciudad, is_public, is_verified, rating_avg, review_count,
   origen, legacy_vendor_id, created_at)
SELECT
  'proveedor',
  lower(btrim(v.email)),
  v.phone,
  coalesce(nullif(btrim(v.business_name), ''),
           btrim(coalesce(v.first_name, '') || ' ' || coalesce(v.last_name, ''))),
  v.slug,
  v.headline,
  v.bio,
  v.website,
  v.instagram,
  v.city,
  coalesce(v.is_public, false),
  coalesce(v.is_verified, false),
  v.rating_avg,
  coalesce(v.review_count, 0),
  'backfill_vendors_hito',
  v.id,
  v.created_at
FROM public.vendors v
WHERE v.email IS NOT NULL
  AND btrim(v.email) <> ''
  AND position('@' in v.email) > 1
  AND coalesce(v.is_demo, false) = false
  AND coalesce(nullif(btrim(v.business_name), ''),
               btrim(coalesce(v.first_name, '') || ' ' || coalesce(v.last_name, ''))) <> ''
ON CONFLICT DO NOTHING;

-- La relación con la productora dueña del pool. Para las 1009 fichas de DER esto
-- reproduce exactamente lo que hay hoy: siguen siendo su pool, ahora dicho de una
-- forma que admite una segunda productora sin duplicar a nadie.
INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion, created_at)
SELECT mp.id, sp.organization_id, 'pool', mp.created_at
FROM staff_app.marketplace_profiles mp
JOIN staff_app.staff_profiles sp ON sp.id = mp.legacy_staff_profile_id
WHERE mp.legacy_staff_profile_id IS NOT NULL
ON CONFLICT (profile_id, organization_id) DO NOTHING;

INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion, nota_interna, created_at)
SELECT mp.id, v.organization_id, 'pool', v.notes, mp.created_at
FROM staff_app.marketplace_profiles mp
JOIN public.vendors v ON v.id = mp.legacy_vendor_id
WHERE mp.legacy_vendor_id IS NOT NULL
  AND v.organization_id IS NOT NULL
ON CONFLICT (profile_id, organization_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- (5) SEGURIDAD: RLS desde el minuto cero, igual que el resto del esquema.
--
--     Sin políticas de escritura a propósito: por ahora todo se escribe por RPCs
--     SECURITY DEFINER, que es la disciplina que ya sigue staff_app. Se abren
--     recién en el movimiento 2, cuando el dueño del perfil pueda entrar.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.marketplace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.profile_org_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_app.provider_services   ENABLE ROW LEVEL SECURITY;

-- La productora ve los perfiles con los que tiene vínculo, y además los públicos
-- (que es lo que hace posible descubrir gente nueva: el marketplace).
DROP POLICY IF EXISTS marketplace_profiles_select ON staff_app.marketplace_profiles;
CREATE POLICY marketplace_profiles_select ON staff_app.marketplace_profiles
  FOR SELECT USING (
    (is_public AND activo)
    OR EXISTS (
      SELECT 1 FROM staff_app.profile_org_links l
       WHERE l.profile_id = marketplace_profiles.id
         AND staff_app.is_org_member(l.organization_id)
    )
  );

-- La relación es PRIVADA de cada productora. La nota que DER le puso a alguien no
-- la ve otra productora, nunca.
DROP POLICY IF EXISTS profile_org_links_select ON staff_app.profile_org_links;
CREATE POLICY profile_org_links_select ON staff_app.profile_org_links
  FOR SELECT USING (staff_app.is_org_member(organization_id));

-- Los servicios de un proveedor público los ve cualquiera que pueda ver el perfil.
DROP POLICY IF EXISTS provider_services_select ON staff_app.provider_services;
CREATE POLICY provider_services_select ON staff_app.provider_services
  FOR SELECT USING (
    activo AND EXISTS (
      SELECT 1 FROM staff_app.marketplace_profiles p
       WHERE p.id = provider_services.profile_id
         AND (
           (p.is_public AND p.activo)
           OR EXISTS (SELECT 1 FROM staff_app.profile_org_links l
                       WHERE l.profile_id = p.id AND staff_app.is_org_member(l.organization_id))
         )
    )
  );

REVOKE ALL ON staff_app.marketplace_profiles FROM anon;
REVOKE ALL ON staff_app.profile_org_links    FROM anon, authenticated;
REVOKE ALL ON staff_app.provider_services    FROM anon;
GRANT SELECT ON staff_app.marketplace_profiles TO authenticated;
GRANT SELECT ON staff_app.provider_services    TO authenticated;

NOTIFY pgrst, 'reload schema';
