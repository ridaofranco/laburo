-- Harness de test: la org duena de la plataforma (migracion 0044).
-- Proyecto: luillpzfqzbpoqkgvjuw. Correr con Supabase MCP execute_sql (superuser)
-- DESPUES de aplicar staff_app_0044_org_plataforma.sql.
--
-- POR QUE EXISTE, y no es opcional: typecheck, lint y build NO ejecutan SQL. La
-- migracion 0043 existe porque un bug de tipos de plpgsql
-- (v_faltan := v_faltan || 'texto' sobre un text[]) paso los tres gates y
-- reventaba en produccion cada vez que un proveedor tocaba "publicarme". La
-- tarea que trae esta migracion NO esta terminada hasta que estos cinco asserts
-- den lo esperado contra la base de verdad.
--
-- Las cinco cosas que tienen que ser ciertas:
--
--   1. Hay exactamente UNA org con es_plataforma, y es la misma que is_default.
--   2. Marcar una SEGUNDA org como plataforma lo rechaza la base (indice unico).
--   3. La vista public.staff_app_my_orgs expone la columna, y para el miembro de
--      una productora que NO es la plataforma devuelve false.
--   4. Para el miembro de la org plataforma devuelve true.
--   5. authenticated NO tiene UPDATE sobre staff_app.organizations (o sea que
--      nadie puede auto-ascenderse a plataforma desde el cliente). Esta es la
--      mitigacion de T-s6w-03 verificada, no asumida.
--
-- NOTA DE IDENTIDAD (igual que el harness de la 0042): la vista filtra por
-- auth.uid(), y bajo execute_sql crudo no hay JWT. Se simula el caller con
-- request.jwt.claims a nivel SESION (is_local = false) para que auth.uid()
-- resuelva entre statements. Al final se resetea.
--
-- NOTA DE MVCC (de la 0003): leer el efecto persistido en un statement SEPARADO
-- del que escribe. Un sub-SELECT hermano ve el snapshot previo.
--
-- Identificadores fijos (sembrados y borrados por este mismo archivo):
--   org de prueba, NO plataforma   00000000-0000-0000-0000-0000000044c1
--   miembro de esa org             00000000-0000-0000-0000-0000000044d1
-- El miembro de la org plataforma se toma de la base (el primero que haya).

-- ===========================================================================
-- PASO 0: limpieza previa, para poder re-correrlo cuantas veces haga falta.
-- ===========================================================================
DELETE FROM staff_app.members       WHERE organization_id = '00000000-0000-0000-0000-0000000044c1';
DELETE FROM staff_app.organizations WHERE id              = '00000000-0000-0000-0000-0000000044c1';
DROP TABLE IF EXISTS _h0044_segunda;

-- ===========================================================================
-- PASO 1: semilla. Una productora cliente con su miembro. NO es la plataforma
--         (es_plataforma se queda en el DEFAULT false, a proposito: si el
--         default estuviera mal, este harness lo agarra en el CASO 3).
-- ===========================================================================
INSERT INTO staff_app.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000044c1', 'Productora Harness 0044', 'harness-0044-cliente');

INSERT INTO staff_app.members (organization_id, user_id, role)
VALUES ('00000000-0000-0000-0000-0000000044c1',
        '00000000-0000-0000-0000-0000000044d1', 'owner');

-- ===========================================================================
-- CASO 1: hay exactamente UNA org plataforma, y coincide con la default.
-- ===========================================================================
SELECT count(*) FILTER (WHERE es_plataforma)                    AS plataformas,        -- 1
       count(*) FILTER (WHERE is_default)                       AS defaults,           -- 1
       count(*) FILTER (WHERE es_plataforma AND is_default)     AS coinciden,          -- 1
       (SELECT name FROM staff_app.organizations WHERE es_plataforma) AS quien          -- SOMOS DER
  FROM staff_app.organizations;

-- ===========================================================================
-- CASO 2: marcar una SEGUNDA org como plataforma lo rechaza el indice unico.
--         Se envuelve en un DO para capturar la excepcion y devolver true.
-- ===========================================================================
CREATE TEMP TABLE _h0044_segunda (rechazada boolean, sqlstate_visto text);

DO $$
BEGIN
  UPDATE staff_app.organizations
     SET es_plataforma = true
   WHERE id = '00000000-0000-0000-0000-0000000044c1';
  -- Si llego aca, la base la dejo pasar: el indice unico NO esta haciendo su
  -- trabajo. Se deshace para no dejar la base con dos plataformas.
  UPDATE staff_app.organizations
     SET es_plataforma = false
   WHERE id = '00000000-0000-0000-0000-0000000044c1';
  INSERT INTO _h0044_segunda VALUES (false, 'ninguno');
EXCEPTION WHEN unique_violation THEN
  INSERT INTO _h0044_segunda VALUES (true, SQLSTATE);
END $$;

SELECT rechazada, sqlstate_visto FROM _h0044_segunda;   -- true / 23505

-- Y despues del intento sigue habiendo UNA sola (statement separado, por MVCC).
SELECT count(*) FILTER (WHERE es_plataforma) AS sigue_habiendo_una   -- 1
  FROM staff_app.organizations;

-- ===========================================================================
-- CASO 3: la vista expone la columna, y simulando al miembro de la productora
--         cliente devuelve es_plataforma = false.
-- ===========================================================================
SELECT count(*) AS vista_tiene_la_columna       -- 1
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'staff_app_my_orgs'
   AND column_name  = 'es_plataforma';

SELECT set_config('request.jwt.claims',
                  '{"sub":"00000000-0000-0000-0000-0000000044d1","role":"authenticated"}',
                  false) AS jwt_set_cliente;

SELECT auth.uid()        AS caller_uid,          -- ...44d1
       organization_id   AS org,                 -- ...44c1
       org_name          AS nombre,              -- Productora Harness 0044
       es_plataforma     AS es_plataforma        -- false
  FROM public.staff_app_my_orgs;

-- ===========================================================================
-- CASO 4: simulando a un miembro de la org plataforma, la vista devuelve true.
--         El usuario se toma de la base, sin escribir ningun UUID a mano.
-- ===========================================================================
SELECT set_config('request.jwt.claims',
                  json_build_object(
                    'sub',  (SELECT m.user_id::text
                               FROM staff_app.members m
                               JOIN staff_app.organizations o ON o.id = m.organization_id
                              WHERE o.es_plataforma
                              ORDER BY m.created_at, m.user_id
                              LIMIT 1),
                    'role', 'authenticated')::text,
                  false) AS jwt_set_plataforma;

SELECT org_name       AS nombre,          -- SOMOS DER
       es_plataforma  AS es_plataforma    -- true (al menos una fila en true)
  FROM public.staff_app_my_orgs
 ORDER BY es_plataforma DESC;

-- ===========================================================================
-- CASO 5 (EL IMPORTANTE): authenticated no puede escribir la columna. Sin esto,
--         cualquier productora se auto-asciende a plataforma con un PATCH a
--         PostgREST y se lleva puestas las pantallas de plataforma (T-s6w-03).
-- ===========================================================================
SELECT has_table_privilege('authenticated', 'staff_app.organizations', 'UPDATE') AS auth_update,  -- false
       has_table_privilege('authenticated', 'staff_app.organizations', 'INSERT') AS auth_insert,  -- false
       has_table_privilege('authenticated', 'staff_app.organizations', 'SELECT') AS auth_select,  -- true
       has_table_privilege('anon',          'staff_app.organizations', 'SELECT') AS anon_select;  -- false

-- Y que sobre la tabla no haya aparecido ninguna politica de escritura.
SELECT polname, polcmd                                  -- solo organizations_select / r
  FROM pg_policy
 WHERE polrelid = 'staff_app.organizations'::regclass
 ORDER BY polname;

-- ===========================================================================
-- LIMPIEZA: se borra la semilla y se resetea el JWT simulado.
-- ===========================================================================
DELETE FROM staff_app.members       WHERE organization_id = '00000000-0000-0000-0000-0000000044c1';
DELETE FROM staff_app.organizations WHERE id              = '00000000-0000-0000-0000-0000000044c1';
DROP TABLE IF EXISTS _h0044_segunda;
SELECT set_config('request.jwt.claims', '', false) AS jwt_reset;

SELECT (SELECT count(*) FROM staff_app.organizations
         WHERE id = '00000000-0000-0000-0000-0000000044c1')            AS orgs_restantes,      -- 0
       (SELECT count(*) FROM staff_app.organizations
         WHERE es_plataforma)                                          AS plataformas_al_final; -- 1
