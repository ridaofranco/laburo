-- staff_app_0035_org_base
-- DESHARCODEAR LA ORGANIZACIÓN — parte 1 de 4: los cimientos.
--
-- ── EL PROBLEMA ─────────────────────────────────────────────────────────────
-- Desde la 0001, el UUID de SOMOS DER ('aa29aa2f-…') está escrito a mano adentro
-- de 31 funciones vivas de la base (52 apariciones en 24 archivos de migración).
-- Cada RPC hace `v_org uuid := 'aa29aa2f-…'` y a partir de ahí filtra, valida y
-- escribe contra esa constante. Con UNA sola productora eso funciona. Con dos:
--   · la productora nueva no puede crear eventos (el gate is_org_writer se hace
--     contra DER, así que su propio owner recibe 'forbidden');
--   · su gente no puede entrar al portal (el perfil se busca por email + DER);
--   · y peor: hay funciones que ESCRIBEN con la constante sin mirar de quién es
--     el evento — un fichaje o un pago de la productora B queda estampado como
--     de DER y aparece en el tablero de DER. Eso es una fuga de datos, no un bug
--     de UX.
--
-- ── LO QUE YA ESTABA BIEN (y por eso esto se puede hacer sin romper nada) ────
-- Las TABLAS y las POLÍTICAS RLS ya son multi-tenant de verdad: todas tienen
-- organization_id y todas filtran con staff_app.is_org_member / is_org_writer.
-- Las vistas de public.* son security_invoker, o sea que respetan esa RLS. El
-- problema es 100% de las funciones SECURITY DEFINER, que por definición se
-- saltean la RLS y por eso necesitaban decidir la org por su cuenta.
--
-- ── LA ESTRATEGIA ───────────────────────────────────────────────────────────
-- La org deja de ser un literal y pasa a salir del CONTEXTO del que llama:
--   1. si el caller la manda explícita (p_org), esa — siempre con el gate de
--      membresía/escritura puesto, así mandarla no habilita nada nuevo;
--   2. si no, la org del usuario logueado (su fila en staff_app.members);
--   3. si tampoco (service_role, anon, crons), la ORG POR DEFECTO de la base.
-- Hoy, con una sola org, los tres caminos dan SOMOS DER: el día que se aplica
-- esto, la app se comporta exactamente igual. Ese es todo el truco de que sea
-- retrocompatible y sin downtime.
--
-- ── QUÉ HACE ESTA MIGRACIÓN (sola no cambia NINGÚN comportamiento) ───────────
--   (1) organizations: slug + is_default (+ la marca en la fila de SOMOS DER).
--   (2) staff_app.member_invites: la allowlist de admins deja de estar escrita
--       en el cuerpo de una función y pasa a ser una tabla (así dar de alta a la
--       productora aliada de la Fase 2 es un INSERT, no un deploy).
--   (3) Los resolvedores: default_org_id / current_org_id / resolve_org /
--       org_id_by_slug.
--   (4) Vista public.staff_app_my_orgs (todas las orgs del que mira) + RPC
--       staff_app_org_ids() para que los crons puedan recorrer orgs.
--
-- Aditiva de punta a punta: no borra ni reescribe ninguna función existente.
-- No toca HITO ni ninguna tabla de public.*.

-- ---------------------------------------------------------------------------
-- (1) La organización por defecto deja de ser un literal y pasa a ser un DATO.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.organizations
  ADD COLUMN IF NOT EXISTS slug       text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activa     boolean NOT NULL DEFAULT true;

-- Slug único cuando está cargado (sirve para los formularios públicos por
-- productora: la URL lleva el slug, nunca el UUID).
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key
  ON staff_app.organizations (lower(slug)) WHERE slug IS NOT NULL;

-- UNA sola org puede ser la default. El índice parcial lo garantiza a nivel
-- base: si alguien intenta marcar una segunda, la base lo rechaza.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_default
  ON staff_app.organizations ((is_default)) WHERE is_default;

-- SOMOS DER queda marcada como la default. Este UPDATE es EL punto donde el
-- UUID hardcodeado se convierte en dato: de acá en adelante ninguna función
-- vuelve a escribirlo.
UPDATE staff_app.organizations
   SET slug       = coalesce(slug, 'somos-der'),
       is_default = true
 WHERE id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';

-- Red de seguridad: si por lo que fuera esa fila no existiera (base recreada de
-- cero, entorno de prueba), marcamos como default a la org más vieja. Sin esto,
-- default_org_id() devolvería NULL y todas las RPCs dejarían de resolver.
UPDATE staff_app.organizations o
   SET is_default = true
 WHERE NOT EXISTS (SELECT 1 FROM staff_app.organizations WHERE is_default)
   AND o.id = (SELECT id FROM staff_app.organizations ORDER BY created_at, id LIMIT 1);

COMMENT ON COLUMN staff_app.organizations.is_default IS
  'La organización a la que resuelve todo lo que NO tiene contexto de usuario (crons, webhooks, el formulario público de registro). Exactamente una fila puede tenerlo en true (índice parcial organizations_one_default). Hoy: SOMOS DER.';
COMMENT ON COLUMN staff_app.organizations.slug IS
  'Identificador legible de la productora, para URLs públicas (un formulario de registro por productora) sin exponer el UUID en el cliente.';
COMMENT ON COLUMN staff_app.organizations.activa IS
  'Baja lógica de una productora. Reservado para la Fase 2 del marketplace; hoy todas en true.';

-- ---------------------------------------------------------------------------
-- (2) La allowlist de admins sale del código y pasa a ser tabla.
--
--     Hoy public.staff_app_provision_member tiene los dos mails de Franco
--     escritos adentro del cuerpo (`IF v_email NOT IN ('ridaofrancorg@…')`).
--     Eso es el candado CR-01 y está bien que exista, pero atado a una función
--     significa que sumar al owner de una productora aliada es una migración.
--     Con esta tabla es un INSERT, y además queda claro A QUÉ ORG entra y con
--     qué rol — que es justo lo que pide el alta manual de la Fase 2.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.member_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'writer',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS member_invites_email_key
  ON staff_app.member_invites (lower(email));

ALTER TABLE staff_app.member_invites ENABLE ROW LEVEL SECURITY;

-- Sin política de escritura a propósito: las invitaciones las carga Franco por
-- SQL (alta manual, Fase 2). Los miembros de la org pueden verlas.
DROP POLICY IF EXISTS member_invites_select ON staff_app.member_invites;
CREATE POLICY member_invites_select ON staff_app.member_invites
  FOR SELECT USING (staff_app.is_org_member(organization_id));

REVOKE ALL ON staff_app.member_invites FROM anon, authenticated;

-- Semilla: los dos mails que hoy están escritos adentro de provision_member,
-- apuntando a la org default. Idempotente.
INSERT INTO staff_app.member_invites (organization_id, email, role)
SELECT o.id, e.email, 'owner'
FROM staff_app.organizations o
CROSS JOIN (VALUES ('ridaofrancorg@gmail.com'), ('franco@somosder.ar')) AS e(email)
WHERE o.is_default
ON CONFLICT (organization_id, email) DO NOTHING;

COMMENT ON TABLE staff_app.member_invites IS
  'Allowlist de altas de miembros por organización (candado CR-01 del PRD). Reemplaza la lista de mails que estaba escrita adentro de public.staff_app_provision_member. Dar de alta al owner de una productora aliada = un INSERT acá, sin deploy. Sin política de INSERT/UPDATE a propósito: el alta es manual y la hace DER.';

-- ---------------------------------------------------------------------------
-- (3) LOS RESOLVEDORES. Estas cuatro funciones son las que reemplazan al
--     literal en todas las RPCs de las migraciones 0036/0037/0038.
--
--     Todas SECURITY DEFINER + STABLE + search_path pineado en vacío con cada
--     referencia calificada, igual que is_org_member/is_org_writer de la 0001.
-- ---------------------------------------------------------------------------

-- La org por defecto. Es el ancla de la retrocompatibilidad: todo lo que hoy
-- decía 'aa29aa2f-…' pasa a decir staff_app.default_org_id(), y mientras SOMOS
-- DER siga siendo la default el resultado es idéntico, fila por fila.
CREATE OR REPLACE FUNCTION staff_app.default_org_id() RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT id FROM staff_app.organizations
   WHERE is_default
   ORDER BY created_at, id
   LIMIT 1;
$$;

COMMENT ON FUNCTION staff_app.default_org_id() IS
  'La organización marcada is_default. Reemplaza al UUID hardcodeado de SOMOS DER en todas las RPCs: es a lo que resuelve cualquier llamada sin contexto de usuario (cron, webhook, formulario público).';

-- La org del usuario logueado, sacada de SU pertenencia. Si pertenece a varias
-- (Franco acompañando a una productora aliada), se elige de forma determinista
-- la más vieja; para operar sobre otra, la RPC recibe p_org explícito.
CREATE OR REPLACE FUNCTION staff_app.current_org_id() RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT m.organization_id
    FROM staff_app.members m
   WHERE m.user_id = auth.uid()
   ORDER BY m.created_at, m.organization_id
   LIMIT 1;
$$;

COMMENT ON FUNCTION staff_app.current_org_id() IS
  'La organización del usuario autenticado, leída de staff_app.members (NO de un literal). NULL si no hay sesión o el usuario no es miembro de ninguna. Si es miembro de varias devuelve la más antigua, de forma determinista; para trabajar sobre otra, las RPCs aceptan p_org explícito.';

-- EL resolvedor. Las tres reglas, en orden, en un solo lugar.
--
-- OJO con la seguridad: que p_org gane NO afloja nada, porque toda RPC que
-- escribe sigue pasando por is_org_writer(v_org) / is_org_member(v_org) DESPUÉS
-- de resolver. Mandar la org de otro solo consigue un 'forbidden' más rápido.
CREATE OR REPLACE FUNCTION staff_app.resolve_org(p_org uuid DEFAULT NULL) RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT coalesce(p_org, staff_app.current_org_id(), staff_app.default_org_id());
$$;

COMMENT ON FUNCTION staff_app.resolve_org(uuid) IS
  'Resuelve contra qué organización trabaja una RPC: (1) la que mandó el caller, (2) la del usuario autenticado, (3) la default. Hoy, con una sola org, las tres dan SOMOS DER — por eso la migración no cambia ningún comportamiento el día que se aplica. Resolver NO autoriza: cada RPC gatea después con is_org_writer/is_org_member.';

-- Slug → id, para los formularios públicos por productora (el UUID no viaja al
-- navegador). Solo devuelve organizaciones activas.
CREATE OR REPLACE FUNCTION staff_app.org_id_by_slug(p_slug text) RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = ''
AS $$
  SELECT id FROM staff_app.organizations
   WHERE slug IS NOT NULL
     AND lower(slug) = lower(btrim(coalesce(p_slug, '')))
     AND activa
   LIMIT 1;
$$;

COMMENT ON FUNCTION staff_app.org_id_by_slug(text) IS
  'Traduce el slug público de una productora a su UUID. Para el formulario de registro por productora: el slug viaja en la URL, el UUID nunca sale al cliente. Solo organizaciones activas.';

-- Los resolvedores viven en staff_app, que NO está expuesto por PostgREST, pero
-- Postgres da EXECUTE a PUBLIC por default en cada función nueva. Se revoca
-- explícito (misma disciplina que la 0006 § WR-05): solo se llaman desde adentro
-- de las funciones SECURITY DEFINER, que corren como el dueño.
REVOKE ALL ON FUNCTION staff_app.default_org_id()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION staff_app.current_org_id()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION staff_app.resolve_org(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION staff_app.org_id_by_slug(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (4) Superficie de lectura: qué orgs veo yo, y qué orgs tiene que recorrer un
--     cron. Las dos son necesarias para la Fase 2 y ninguna cambia nada hoy.
-- ---------------------------------------------------------------------------

-- TODAS las orgs del que mira, con nombre y rol. La app hoy lee
-- staff_app_my_membership con .maybeSingle(), que EXPLOTA si un usuario
-- pertenece a dos orgs (PGRST116). Esta vista es la que la reemplaza.
CREATE OR REPLACE VIEW public.staff_app_my_orgs WITH (security_invoker = true) AS
  SELECT m.organization_id, m.role, o.name AS org_name, o.slug AS org_slug,
         o.is_default, m.created_at
  FROM staff_app.members m
  JOIN staff_app.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid();

-- security_invoker: hace falta SELECT sobre organizations como el usuario que
-- consulta (members ya estaba granteada en la 0007). La RLS de organizations
-- (is_org_member) sigue filtrando: solo ve las suyas.
GRANT SELECT ON staff_app.organizations TO authenticated;
REVOKE ALL ON public.staff_app_my_orgs FROM anon;
GRANT SELECT ON public.staff_app_my_orgs TO authenticated;

COMMENT ON VIEW public.staff_app_my_orgs IS
  'Todas las organizaciones del usuario autenticado, con su rol, ordenables por created_at. Reemplaza a staff_app_my_membership cuando alguien pertenece a más de una (la vista vieja sigue existiendo y funcionando: no se toca).';

-- La lista de orgs para los crons. service_role only: la consumen las rutas de
-- /api/cron cuando llegue el momento de recorrer productora por productora (hoy
-- ninguna la llama; los crons siguen trabajando sobre la org default).
CREATE OR REPLACE FUNCTION public.staff_app_org_ids()
RETURNS TABLE(organization_id uuid, name text, slug text, is_default boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT id, name, slug, is_default
  FROM staff_app.organizations
  WHERE activa
  ORDER BY is_default DESC, created_at, id;
$$;

REVOKE ALL ON FUNCTION public.staff_app_org_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_org_ids() TO service_role;

COMMENT ON FUNCTION public.staff_app_org_ids() IS
  'Las organizaciones activas, la default primero. Para que los crons (bienvenida, recordatorios, resumen de fichaje) puedan recorrer productora por productora en la Fase 2 en vez de trabajar contra una sola. service_role EXECUTE solo. Hoy no la llama nadie: es la pieza que habilita el loop cuando Franco lo prenda.';
