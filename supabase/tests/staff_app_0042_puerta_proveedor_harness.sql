-- Harness de test: la puerta de entrada del proveedor (migracion 0042).
-- Proyecto: luillpzfqzbpoqkgvjuw. Correr con Supabase MCP execute_sql (superuser)
-- DESPUES de aplicar staff_app_0042_puerta_proveedor.sql.
--
-- Prueba en SQL, antes de que ninguna pantalla lo consuma, las ocho cosas que
-- tienen que ser ciertas para que el movimiento 2 sea seguro:
--
--   1. anon NO puede generar un link (fabricar puertas no es publico).
--   2. Un writer de la org SI puede, y recibe un token de 64 hex.
--   3. En la fila queda un sha256 de 64 hex que NO es el token devuelto.
--   4. El token bueno devuelve el perfil propio mas sus servicios.
--   5. Un token inventado devuelve NULL.
--   6. Un token vencido devuelve NULL (mismo resultado que el inventado: sin oraculo).
--   7. Editar el servicio de OTRO perfil con un token valido no modifica nada.
--   8. Publicarse sin servicios devuelve faltan_datos y deja is_public en false.
--
-- Y ademas: que guardar_perfil no pueda mover is_verified, slug, rating, email,
-- tipo ni activo (MKT2-03), y que con un servicio con provincias si publique.
--
-- NOTA DE IDENTIDAD (igual que el harness de la 0008): staff_app.is_org_writer
-- lee auth.uid(), y bajo execute_sql crudo no hay JWT. Se simula el caller con
-- request.jwt.claims a nivel SESION (is_local = false) para que auth.uid()
-- resuelva entre statements. El owner sembrado 73fc15e0-69a6-4fc2-a832-696bd6f0f95c
-- es el writer. Al final se resetea.
--
-- NOTA DE MVCC (de la 0003): leer el efecto persistido en un statement SEPARADO
-- del que llama la RPC. Un sub-SELECT hermano ve el snapshot previo.
--
-- Identificadores fijos:
--   perfil A (el que entra)      00000000-0000-0000-0000-0000000042a1
--   perfil B (el ajeno)          00000000-0000-0000-0000-0000000042a2
--   servicio de B                00000000-0000-0000-0000-0000000042b2
--   org sembrada                 aa29aa2f-4d34-4e53-b62c-7397e8a4d123
--   writer                       73fc15e0-69a6-4fc2-a832-696bd6f0f95c

-- ===========================================================================
-- PASO 0: limpieza previa, para poder re-correrlo cuantas veces haga falta.
-- ===========================================================================
DELETE FROM staff_app.provider_services
 WHERE profile_id IN ('00000000-0000-0000-0000-0000000042a1',
                      '00000000-0000-0000-0000-0000000042a2');
DELETE FROM staff_app.profile_org_links
 WHERE profile_id IN ('00000000-0000-0000-0000-0000000042a1',
                      '00000000-0000-0000-0000-0000000042a2');
DELETE FROM staff_app.marketplace_profiles
 WHERE id IN ('00000000-0000-0000-0000-0000000042a1',
              '00000000-0000-0000-0000-0000000042a2');
DROP TABLE IF EXISTS _h0042_link;
DROP TABLE IF EXISTS _h0042_ajeno;
DROP TABLE IF EXISTS _h0042_publicar;
DROP TABLE IF EXISTS _h0042_publicar_ok;

-- ===========================================================================
-- PASO 1: semilla. Dos proveedores de la misma org, uno con un servicio ya
--         cargado (el ajeno, que nadie de afuera tiene que poder tocar).
-- ===========================================================================
INSERT INTO staff_app.marketplace_profiles (id, tipo, email, display_name, is_verified, slug, activo)
VALUES ('00000000-0000-0000-0000-0000000042a1', 'proveedor', 'harness0042a@test.local', 'Catering Harness A', true, 'harness-0042-a', true),
       ('00000000-0000-0000-0000-0000000042a2', 'proveedor', 'harness0042b@test.local', 'Sonido Harness B',   false, 'harness-0042-b', true);

INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
VALUES ('00000000-0000-0000-0000-0000000042a1', 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123', 'pool'),
       ('00000000-0000-0000-0000-0000000042a2', 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123', 'pool');

INSERT INTO staff_app.provider_services (id, profile_id, categoria, titulo, provincias)
VALUES ('00000000-0000-0000-0000-0000000042b2', '00000000-0000-0000-0000-0000000042a2',
        'Sonido', 'Sonido para eventos', ARRAY['Cordoba']);

-- ===========================================================================
-- CASO 1: la matriz de grants. anon NUNCA puede generar un link; las cinco RPCs
--         por token si son anon (el proveedor no tiene cuenta). Se chequea el
--         privilegio directo, que es exactamente la propiedad que importa.
-- ===========================================================================
SELECT has_function_privilege('anon', 'public.staff_app_generar_link_proveedor(uuid,int)', 'EXECUTE')  AS anon_generar_link,     -- false
       has_function_privilege('authenticated', 'public.staff_app_generar_link_proveedor(uuid,int)', 'EXECUTE') AS auth_generar_link, -- true
       has_function_privilege('anon', 'public.staff_app_proveedor_perfil(text)', 'EXECUTE')            AS anon_perfil,          -- true
       has_function_privilege('anon', 'public.staff_app_proveedor_guardar_perfil(text,text,text,text,text,text,text,text,text)', 'EXECUTE') AS anon_guardar_perfil, -- true
       has_function_privilege('anon', 'public.staff_app_proveedor_guardar_servicio(text,text,text,uuid,text,numeric,text,text,text[])', 'EXECUTE') AS anon_guardar_serv, -- true
       has_function_privilege('anon', 'public.staff_app_proveedor_borrar_servicio(text,uuid)', 'EXECUTE') AS anon_borrar_serv,   -- true
       has_function_privilege('anon', 'public.staff_app_proveedor_publicar(text,boolean)', 'EXECUTE')   AS anon_publicar,        -- true
       has_function_privilege('anon', 'staff_app.perfil_proveedor_por_token(text)', 'EXECUTE')          AS anon_helper;          -- false

-- Y que las seis lleven el search_path pineado (cero function_search_path_mutable).
SELECT p.proname, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname = 'public' AND p.proname LIKE 'staff_app_proveedor%')
    OR (n.nspname = 'public' AND p.proname = 'staff_app_generar_link_proveedor')
    OR (n.nspname = 'staff_app' AND p.proname = 'perfil_proveedor_por_token')
 ORDER BY p.proname;   -- las 7 con search_path=staff_app,public,pg_temp

-- ===========================================================================
-- CASO 2: un writer de la org genera el link y recibe el token en crudo.
-- ===========================================================================
SELECT set_config('request.jwt.claims',
                  '{"sub":"73fc15e0-69a6-4fc2-a832-696bd6f0f95c","role":"authenticated"}',
                  false) AS jwt_set;
SELECT auth.uid() AS caller_uid,
       staff_app.is_org_writer('aa29aa2f-4d34-4e53-b62c-7397e8a4d123') AS is_writer;  -- true

CREATE TEMP TABLE _h0042_link AS
SELECT public.staff_app_generar_link_proveedor('00000000-0000-0000-0000-0000000042a1', 30) AS j;

SELECT (SELECT j->>'ok' FROM _h0042_link)                 AS ok,             -- true
       (SELECT length(j->>'token') FROM _h0042_link)      AS token_len,      -- 64
       (SELECT (j->>'token') ~ '^[0-9a-f]{64}$' FROM _h0042_link) AS token_es_hex, -- true
       (SELECT (j->>'expires_at')::timestamptz > now() FROM _h0042_link) AS vence_futuro; -- true

-- ===========================================================================
-- CASO 3: en la fila hay un sha256 de 64 hex, y NO es el token devuelto.
-- ===========================================================================
SELECT length(p.access_token_hash) AS hash_len,                                          -- 64
       (p.access_token_hash = encode(extensions.digest(r.j->>'token','sha256'),'hex')) AS hash_es_sha256, -- true
       (p.access_token_hash <> (r.j->>'token'))                                  AS hash_distinto_token, -- true
       EXISTS (SELECT 1 FROM staff_app.marketplace_profiles x
                WHERE x.access_token_hash = (r.j->>'token'))                     AS crudo_persistido     -- false
  FROM _h0042_link r
  JOIN staff_app.marketplace_profiles p ON p.id = '00000000-0000-0000-0000-0000000042a1';

-- ===========================================================================
-- CASO 4: el token bueno devuelve el perfil propio mas sus servicios (todavia
--         ninguno) y NO devuelve nada de la relacion con la productora.
-- ===========================================================================
SELECT public.staff_app_proveedor_perfil(r.j->>'token') IS NOT NULL      AS devuelve_algo,      -- true
       public.staff_app_proveedor_perfil(r.j->>'token') -> 'perfil' ->> 'display_name' AS nombre, -- Catering Harness A
       jsonb_array_length(public.staff_app_proveedor_perfil(r.j->>'token') -> 'servicios') AS servicios, -- 0
       (public.staff_app_proveedor_perfil(r.j->>'token') ? 'nota_interna')  AS filtra_nota,     -- false
       (public.staff_app_proveedor_perfil(r.j->>'token') ? 'rating_privado') AS filtra_rating   -- false
  FROM _h0042_link r;

-- El sello de uso quedo estampado (statement separado, por el snapshot de MVCC).
SELECT access_token_last_used_at IS NOT NULL AS uso_estampado                                   -- true
  FROM staff_app.marketplace_profiles WHERE id = '00000000-0000-0000-0000-0000000042a1';

-- ===========================================================================
-- CASO 5: token inventado -> NULL.
-- ===========================================================================
SELECT public.staff_app_proveedor_perfil('token-inventado-que-no-existe') IS NULL AS inventado_null;  -- true

-- ===========================================================================
-- CASO 6: token vencido -> NULL. Mismo resultado que el inventado: no se puede
--         saber si el link existio.
-- ===========================================================================
UPDATE staff_app.marketplace_profiles
   SET access_token_expires_at = now() - interval '1 day'
 WHERE id = '00000000-0000-0000-0000-0000000042a1';

SELECT public.staff_app_proveedor_perfil(r.j->>'token') IS NULL AS vencido_null                  -- true
  FROM _h0042_link r;

-- Y tampoco puede escribir nada con el token vencido.
SELECT public.staff_app_proveedor_guardar_perfil(r.j->>'token', 'Intento con token vencido')->>'reason' AS vencido_reason  -- token_invalido
  FROM _h0042_link r;

-- Se devuelve a la vida para los casos que siguen.
UPDATE staff_app.marketplace_profiles
   SET access_token_expires_at = now() + interval '30 days'
 WHERE id = '00000000-0000-0000-0000-0000000042a1';

-- ===========================================================================
-- CASO 7 (EL IMPORTANTE): con un token VALIDO de A, intentar editar y borrar el
--         servicio de B. No tiene que modificar ni borrar nada.
-- ===========================================================================
CREATE TEMP TABLE _h0042_ajeno AS
SELECT public.staff_app_proveedor_guardar_servicio(
         p_token       => (SELECT j->>'token' FROM _h0042_link),
         p_categoria   => 'Secuestrado',
         p_titulo      => 'Titulo pisado por otro proveedor',
         p_servicio_id => '00000000-0000-0000-0000-0000000042b2'
       ) AS j;

SELECT (SELECT j->>'ok' FROM _h0042_ajeno)     AS ok,       -- false
       (SELECT j->>'reason' FROM _h0042_ajeno) AS reason;   -- servicio_no_encontrado

SELECT categoria, titulo, profile_id                                       -- Sonido / Sonido para eventos / ...42a2
  FROM staff_app.provider_services
 WHERE id = '00000000-0000-0000-0000-0000000042b2';

SELECT public.staff_app_proveedor_borrar_servicio(r.j->>'token', '00000000-0000-0000-0000-0000000042b2')->>'reason' AS borrar_ajeno_reason  -- servicio_no_encontrado
  FROM _h0042_link r;

SELECT count(*) AS servicio_ajeno_sigue_vivo                                                    -- 1
  FROM staff_app.provider_services WHERE id = '00000000-0000-0000-0000-0000000042b2';

-- ===========================================================================
-- CASO 8: publicarse sin servicios -> faltan_datos, y is_public sigue en false.
-- ===========================================================================
CREATE TEMP TABLE _h0042_publicar AS
SELECT public.staff_app_proveedor_publicar((SELECT j->>'token' FROM _h0042_link), true) AS j;

SELECT (SELECT j->>'ok' FROM _h0042_publicar)     AS ok,        -- false
       (SELECT j->>'reason' FROM _h0042_publicar) AS reason,    -- faltan_datos
       (SELECT j->'faltan' FROM _h0042_publicar)  AS faltan;    -- ["servicios"]

SELECT is_public AS sigue_privado                                                               -- false
  FROM staff_app.marketplace_profiles WHERE id = '00000000-0000-0000-0000-0000000042a1';

-- ===========================================================================
-- EXTRA A (MKT2-03): guardar_perfil escribe lo suyo y NO mueve is_verified,
--         slug, rating_avg, review_count, user_id, tipo, email ni activo.
-- ===========================================================================
SELECT public.staff_app_proveedor_guardar_perfil(
         p_token        => (SELECT j->>'token' FROM _h0042_link),
         p_display_name => '  Catering Harness A editado  ',
         p_headline     => 'Catering para eventos corporativos',
         p_provincia    => 'Cordoba'
       ) AS guardado;   -- {"ok": true}

SELECT display_name  AS nombre_nuevo,        -- 'Catering Harness A editado' (recortado)
       headline      AS headline_nuevo,
       provincia     AS provincia_nueva,     -- Cordoba
       is_verified   AS verificado_intacto,  -- true (sigue como lo dejo DER)
       slug          AS slug_intacto,        -- harness-0042-a
       email         AS email_intacto,       -- harness0042a@test.local
       tipo          AS tipo_intacto,        -- proveedor
       activo        AS activo_intacto,      -- true
       rating_avg    AS rating_intacto,      -- NULL
       review_count  AS reviews_intacto,     -- 0
       user_id       AS user_intacto         -- NULL
  FROM staff_app.marketplace_profiles WHERE id = '00000000-0000-0000-0000-0000000042a1';

-- ===========================================================================
-- EXTRA B: con un servicio propio con provincias, ahora si publica. Y el
--         servicio quedo colgado del perfil DEL TOKEN, no de otro.
-- ===========================================================================
SELECT public.staff_app_proveedor_guardar_servicio(
         p_token      => (SELECT j->>'token' FROM _h0042_link),
         p_categoria  => 'Catering y gastronomia',
         p_titulo     => 'Catering para eventos corporativos',
         p_provincias => ARRAY['Cordoba', 'Cordoba', '  ', 'Ciudad Autonoma de Buenos Aires (CABA)']
       ) AS alta_servicio;   -- {"ok": true, "servicio_id": ...}

SELECT profile_id = '00000000-0000-0000-0000-0000000042a1' AS colgado_del_token,   -- true
       array_length(provincias, 1)                          AS provincias_normalizadas  -- 2 (dedupe + vacio limpiado)
  FROM staff_app.provider_services
 WHERE profile_id = '00000000-0000-0000-0000-0000000042a1';

CREATE TEMP TABLE _h0042_publicar_ok AS
SELECT public.staff_app_proveedor_publicar((SELECT j->>'token' FROM _h0042_link), true) AS j;

SELECT (SELECT j->>'ok' FROM _h0042_publicar_ok) AS ok;   -- true

SELECT is_public   AS ahora_publico,        -- true
       is_verified AS verificado_intacto    -- true (publicar no lo toca)
  FROM staff_app.marketplace_profiles WHERE id = '00000000-0000-0000-0000-0000000042a1';

-- Despublicarse nunca valida nada.
SELECT public.staff_app_proveedor_publicar((SELECT j->>'token' FROM _h0042_link), false)->>'ok' AS despublica_ok;  -- true

-- ===========================================================================
-- EXTRA C: regenerar el link mata el anterior (una sola puerta viva por vez).
-- ===========================================================================
SELECT public.staff_app_generar_link_proveedor('00000000-0000-0000-0000-0000000042a1', 30)->>'ok' AS regenerado;  -- true

SELECT public.staff_app_proveedor_perfil(r.j->>'token') IS NULL AS link_viejo_muerto   -- true
  FROM _h0042_link r;

-- ===========================================================================
-- LIMPIEZA: se borran todas las filas transitorias y se resetea el JWT simulado.
-- ===========================================================================
DELETE FROM staff_app.provider_services
 WHERE profile_id IN ('00000000-0000-0000-0000-0000000042a1',
                      '00000000-0000-0000-0000-0000000042a2');
DELETE FROM staff_app.profile_org_links
 WHERE profile_id IN ('00000000-0000-0000-0000-0000000042a1',
                      '00000000-0000-0000-0000-0000000042a2');
DELETE FROM staff_app.marketplace_profiles
 WHERE id IN ('00000000-0000-0000-0000-0000000042a1',
              '00000000-0000-0000-0000-0000000042a2');
DROP TABLE IF EXISTS _h0042_link;
DROP TABLE IF EXISTS _h0042_ajeno;
DROP TABLE IF EXISTS _h0042_publicar;
DROP TABLE IF EXISTS _h0042_publicar_ok;
SELECT set_config('request.jwt.claims', '', false) AS jwt_reset;

SELECT (SELECT count(*) FROM staff_app.marketplace_profiles
         WHERE id IN ('00000000-0000-0000-0000-0000000042a1','00000000-0000-0000-0000-0000000042a2')) AS perfiles_restantes,  -- 0
       (SELECT count(*) FROM staff_app.provider_services
         WHERE id = '00000000-0000-0000-0000-0000000042b2') AS servicios_restantes;                                           -- 0
