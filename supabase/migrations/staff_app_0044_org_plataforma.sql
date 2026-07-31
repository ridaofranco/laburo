-- staff_app_0044_org_plataforma
-- LA ORG DUEÑA DEL PRODUCTO SE SEPARA DE LA PRODUCTORA CLIENTE.
--
-- ── EL PROBLEMA ─────────────────────────────────────────────────────────────
-- En la base solo existe el rol DENTRO de una org: 'owner' y 'writer'
-- (staff_app.members). No hay forma de decir "SOMOS DER es la dueña del
-- producto y esta otra es una productora cliente". Por eso /leads, que son las
-- consultas comerciales que entran por la landing pública de LABURO, aparece en
-- el panel de cualquier productora: es una pantalla de la plataforma metida
-- adentro del producto que se le vende a la productora.
--
-- Franco entró al portal como productora y no reconoció su producto. Esta es la
-- parte de fondo de ese reclamo: el panel era el de SOMOS DER operando.
--
-- ── POR QUÉ NO SE HARDCODEA EL UUID ─────────────────────────────────────────
-- El 31/7 se desharcodeó la organización de todo el proyecto (migración 0035:
-- el UUID 'aa29aa2f-…' que vivía en 31 funciones pasó a ser el DATO is_default).
-- Volver a escribirlo acá revertiría ese trabajo. Se agrega un marcador en la
-- tabla, exactamente con el mismo patrón que is_default, y el backfill se hace
-- POR is_default, no por UUID.
--
-- ── QUÉ HACE ────────────────────────────────────────────────────────────────
--   (1) organizations.es_plataforma + índice único parcial (una sola dueña).
--   (2) Backfill sin UUID: la que ya es is_default.
--   (3) La vista public.staff_app_my_orgs expone la columna.
--
-- ── QUÉ NO HACE, Y ES A PROPÓSITO ───────────────────────────────────────────
-- No crea ninguna RPC ni política de UPDATE sobre organizations. Sobre la tabla
-- hoy existe solo la política organizations_select (0001) y a authenticated se
-- le dio nada más que SELECT (0035), así que el cliente NO puede escribir esta
-- columna. Esa es la mitigación, y el harness la verifica en vez de asumirla.
--
-- Tampoco construye el cobro de plataforma (SOMOS DER le cobra a la productora).
-- Franco lo posterga hasta definir el precio. Esta columna deja el lugar listo.
--
-- Aditiva de punta a punta. No borra ni reescribe ninguna función. No toca HITO.

-- ---------------------------------------------------------------------------
-- (1) La marca de "esta org es la dueña del producto".
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.organizations
  ADD COLUMN IF NOT EXISTS es_plataforma boolean NOT NULL DEFAULT false;

-- UNA sola org puede ser la plataforma. Mismo patrón que organizations_one_default
-- de la 0035: lo garantiza la base con un índice único parcial, no el código.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_plataforma
  ON staff_app.organizations ((es_plataforma)) WHERE es_plataforma;

-- ---------------------------------------------------------------------------
-- (2) Backfill SIN UUID. is_default ya resuelve a SOMOS DER como dato desde la
--     0035, que es justamente el punto: acá no se vuelve a escribir el literal.
-- ---------------------------------------------------------------------------
UPDATE staff_app.organizations
   SET es_plataforma = true
 WHERE is_default
   AND NOT es_plataforma;

COMMENT ON COLUMN staff_app.organizations.es_plataforma IS
  'Marca a la organización DUEÑA del producto, la que ve las pantallas de plataforma (hoy /leads, las consultas comerciales que entran por la landing pública de LABURO). Es distinto de is_default, que resuelve el contexto de las RPCs sin usuario: esto es una decisión de PRODUCTO sobre qué pantallas forman parte del panel de una productora cliente y cuáles no. Exactamente una fila puede tenerlo en true (índice parcial organizations_one_plataforma). Hoy: SOMOS DER. Nadie la puede escribir desde el cliente: sobre staff_app.organizations solo hay política de SELECT y a authenticated solo se le dio SELECT. El cobro de plataforma (SOMOS DER a la productora) NO está construido: queda para cuando Franco defina el precio, y esta columna es donde se va a colgar.';

-- ---------------------------------------------------------------------------
-- (3) La vista de lectura expone la columna.
--
--     CREATE OR REPLACE VIEW solo deja AGREGAR columnas al final, así que
--     es_plataforma va última. El orden actual (0035) es:
--     organization_id, role, org_name, org_slug, is_default, created_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.staff_app_my_orgs WITH (security_invoker = true) AS
  SELECT m.organization_id, m.role, o.name AS org_name, o.slug AS org_slug,
         o.is_default, m.created_at, o.es_plataforma
  FROM staff_app.members m
  JOIN staff_app.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid();

-- Se reemiten los mismos grants que la 0035, por las dudas de que el REPLACE
-- los haya movido. Idempotente.
REVOKE ALL ON public.staff_app_my_orgs FROM anon;
GRANT SELECT ON public.staff_app_my_orgs TO authenticated;

COMMENT ON VIEW public.staff_app_my_orgs IS
  'Todas las organizaciones del usuario autenticado, con su rol, ordenables por created_at. Reemplaza a staff_app_my_membership cuando alguien pertenece a más de una (la vista vieja sigue existiendo y funcionando: no se toca). Desde la 0044 trae es_plataforma, que es lo que decide si el que mira ve las pantallas de plataforma.';

NOTIFY pgrst, 'reload schema';
