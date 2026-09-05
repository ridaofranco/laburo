-- Migration: staff_app_0071_roles_manager_y_alcance
-- Escrita el 2026-09-05. SIN APLICAR: la aplica Franco.
--
-- Suma el rol `manager` y la columna `members.scope`, y barre TODAS las
-- enumeraciones de rol de la base para que el rol nuevo no nazca invalido.
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA MIGRACION ES SOBRE TODO UN BARRIDO
-- ---------------------------------------------------------------------------
-- Sumar un valor a un CHECK no es el trabajo. El trabajo es barrer las
-- enumeraciones viejas. Un rol que ninguna funcion enumera NO da error:
-- devuelve vacio, en silencio. Un `manager` que no este en is_org_writer no
-- puede escribir absolutamente nada, y la pantalla no le dice por que.
--
-- ---------------------------------------------------------------------------
-- LA JERARQUIA, ESCRITA ANTES DE TOCAR NADA
-- ---------------------------------------------------------------------------
--   owner    Todo, incluido administrar la organizacion y sus miembros el dia
--            que exista esa pantalla.
--   manager  Todo lo OPERATIVO: eventos, ofertas, pagos, proveedores. NO
--            administra la organizacion. Es el rol para la persona que opera
--            la productora sin ser su duena.
--   writer   Lo que hace hoy. Se mantiene igual para no mover el unico caso
--            vivo.
--   viewer   Solo lee. Y NO ve el contacto del pool (mail, telefono, DNI): eso
--            se decide en lib/permisos.ts, no aca.
--
-- Nota sobre manager e is_platform_admin: SI entra. Un manager de la
-- organizacion plataforma tiene que poder moderar, porque moderar es
-- operativo: bajar un proveedor que publico algo que no va es exactamente el
-- trabajo diario de esa pantalla, no una decision de gobierno. Lo que un
-- manager no puede es administrar la organizacion, y eso hoy no pasa por
-- ninguna de estas funciones.
--
-- ---------------------------------------------------------------------------
-- EL BARRIDO, RELEVADO CONTRA PRODUCCION (no contra los archivos)
-- ---------------------------------------------------------------------------
-- Son CINCO funciones. Se encontraron corriendo esta consulta contra la base,
-- que es la unica forma de estar seguro:
--
--   SELECT n.nspname, p.proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('staff_app','public') AND p.prokind = 'f'
--     AND pg_get_functiondef(p.oid) ~ 'role IN \(';
--
--   1. staff_app.is_org_writer                  el gate de escritura de TODO
--   2. staff_app.is_platform_admin              el gate de /plataforma
--   3. public.staff_app_consultar_proveedor
--   4. public.staff_app_consulta_mail_enviado
--   5. public.staff_app_contactar_proveedor
--
-- ⚠️ DOS CORRECCIONES AL RELEVAMIENTO PREVIO, que salieron de mirar la base:
--
--   - `staff_app_buscar_proveedores` estaba en la lista y NO enumera roles:
--     resuelve la organizacion sin filtrar por rol. Tocarla habria sido cambiar
--     su comportamiento sin razon.
--   - `staff_app_contactar_proveedor` NO estaba en la lista y SI enumera roles.
--     Sin este archivo, un `manager` no habria podido contactar un proveedor, y
--     el sintoma habria sido un 'sin_permiso' sin ninguna explicacion.
--
-- Los cuerpos de las cinco se extrajeron de produccion con pg_get_functiondef
-- ANTES de reescribirlos. Reescribir una funcion desde un archivo viejo pisa
-- produccion con una version anterior: la 0054 ya avisa que dos de sus
-- funciones "se redefinen despues en la 0055".
--
-- ⚠️ LO UNICO QUE CAMBIA EN LAS CINCO ES LA LISTA DE ROLES. Cualquier otra
-- diferencia contra el cuerpo vigente seria un cuerpo reconstruido de memoria.
--
-- ---------------------------------------------------------------------------
-- ⚠️ LO QUE ESTA MIGRACION NO ARREGLA, Y HAY QUE SABER
-- ---------------------------------------------------------------------------
-- Las tres funciones de `public` resuelven su organizacion con
-- `ORDER BY m.created_at ASC LIMIT 1`, o sea LA MEMBRESIA MAS ANTIGUA, y no
-- aceptan un parametro p_org. Con el selector de contexto puesto, eso significa
-- que alguien que eligio actuar como la productora B igual consulta proveedores
-- como la organizacion A.
--
-- NO se arregla aca a proposito: cambiar la firma de las tres para que acepten
-- p_org es otro issue, con su propio riesgo, y esta migracion ya toca los dos
-- gates de escritura del producto entero. Queda anotado.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) EL CHECK. `manager` no se agrega: se suelta el viejo y se crea el nuevo.
-- ---------------------------------------------------------------------------
-- El ADD CONSTRAINT valida las filas existentes y aborta si alguna quedo fuera
-- de la lista. Eso es lo que se quiere: si hay un rol invivo en la tabla,
-- preferimos enterarnos ahora.
ALTER TABLE staff_app.members
  DROP CONSTRAINT IF EXISTS members_role_check;

ALTER TABLE staff_app.members
  ADD CONSTRAINT members_role_check
  CHECK (role IN ('owner','manager','writer','viewer'));

-- ---------------------------------------------------------------------------
-- (2) LA COLUMNA scope, Y SU CONTRATO
-- ---------------------------------------------------------------------------
-- Con DEFAULT '{}' las filas que existen quedan validas sin tocarlas.
ALTER TABLE staff_app.members
  ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN staff_app.members.scope IS
  'Alcance adicional del miembro, por encima de su rol. CONTRATO: (1) scope ACOTA, nunca amplia: un viewer con cualquier scope sigue siendo viewer, y ninguna clave puede darle a alguien algo que su rol no le da. Ese invariante es lo que hace segura una columna vacia. (2) {} significa sin restricciones adicionales: manda el rol, que es el estado de TODAS las filas hoy. (3) Hoy no se acepta ninguna clave y NINGUNA funcion lee esta columna, a proposito: una columna vacia y documentada es honesta, una leida a medias por dos funciones de cinco es un agujero. (4) Una clave que nadie lee no restringe nada: quien sume la primera clave tiene que sumarla al mismo tiempo en TODAS las funciones que gatean, o el alcance va a existir solo en algunas pantallas.';

-- ---------------------------------------------------------------------------
-- (3) LAS CINCO FUNCIONES. Cuerpo vigente + manager. Nada mas.
-- ---------------------------------------------------------------------------

-- (3.1) El gate de escritura de todo el producto.
CREATE OR REPLACE FUNCTION staff_app.is_org_writer(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.members
    WHERE organization_id = org_id AND user_id = auth.uid()
      AND role IN ('owner','manager','writer')
  );
$function$;

REVOKE ALL ON FUNCTION staff_app.is_org_writer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION staff_app.is_org_writer(uuid) TO authenticated;

COMMENT ON FUNCTION staff_app.is_org_writer(uuid) IS
  'True si el caller puede ESCRIBIR en esa organizacion. Es el gate de escritura de todo el producto: lo usan las policies de RLS y las funciones SECURITY DEFINER. owner, manager y writer escriben; viewer no.';

-- (3.2) El gate de /plataforma.
CREATE OR REPLACE FUNCTION staff_app.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM staff_app.members m
      JOIN staff_app.organizations o ON o.id = m.organization_id
     WHERE m.user_id = auth.uid()
       AND m.role IN ('owner','manager','writer')
       AND o.es_plataforma = true
  );
$function$;

COMMENT ON FUNCTION staff_app.is_platform_admin() IS
  'True si el caller es owner/manager/writer de la organizacion marcada es_plataforma. Es el UNICO rol que cruza organizaciones. Antes de la 0054 este concepto no existia: es_plataforma estaba en la tabla y no la leia nadie. manager entra (0071) porque moderar es trabajo operativo, no de gobierno.';

-- (3.3) La consulta a un proveedor.
CREATE OR REPLACE FUNCTION public.staff_app_consultar_proveedor(p_profile_id uuid, p_respuestas jsonb, p_nombre text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_gig_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org        uuid;
  v_org_nombre text;
  v_prov       record;
  v_id         uuid;
  v_email      text;
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid() AND m.role IN ('owner','manager','writer')
   ORDER BY m.created_at ASC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  SELECT mp.id, mp.display_name, mp.email
    INTO v_prov
    FROM staff_app.marketplace_profiles mp
   WHERE mp.id = p_profile_id
     AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public;
  IF v_prov.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  IF p_respuestas IS NULL OR jsonb_typeof(p_respuestas) <> 'array'
     OR jsonb_array_length(p_respuestas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'consulta_vacia');
  END IF;
  IF jsonb_array_length(p_respuestas) > 12 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demasiados_campos');
  END IF;

  IF p_gig_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff_app.gigs g WHERE g.id = p_gig_id AND g.organization_id = v_org
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_ajeno');
  END IF;

  SELECT o.name INTO v_org_nombre FROM staff_app.organizations o WHERE o.id = v_org;

  v_email := nullif(btrim(lower(coalesce(p_email, ''))), '');
  IF v_email IS NULL THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalido');
  END IF;

  INSERT INTO staff_app.provider_contacts (
    organization_id, profile_id, gig_id, respuestas,
    nombre_contacto, email_contacto, telefono_contacto, origen
  ) VALUES (
    v_org, p_profile_id, p_gig_id, p_respuestas,
    nullif(btrim(coalesce(left(p_nombre, 160), '')), ''),
    v_email,
    nullif(btrim(coalesce(left(p_telefono, 40), '')), ''),
    'productora'
  )
  RETURNING id INTO v_id;

  -- La relacion SUBE de 'pool' a 'contactado', pero nunca pisa una mas fuerte:
  -- haberle escrito no deshace un 'contratado' ni levanta un 'bloqueado'.
  INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
  VALUES (p_profile_id, v_org, 'contactado')
  ON CONFLICT (profile_id, organization_id) DO UPDATE
    SET relacion = 'contactado', updated_at = now()
    WHERE staff_app.profile_org_links.relacion = 'pool';

  RETURN jsonb_build_object(
    'ok', true,
    'contacto_id', v_id,
    'proveedor', jsonb_build_object(
      'display_name', v_prov.display_name,
      'email',        v_prov.email
    ),
    'productora', v_org_nombre
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_consultar_proveedor(uuid, jsonb, text, text, text, uuid) TO authenticated, service_role;

-- (3.4) Marcar que el mail de la consulta salio.
CREATE OR REPLACE FUNCTION public.staff_app_consulta_mail_enviado(p_contacto_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid() AND m.role IN ('owner','manager','writer')
   ORDER BY m.created_at ASC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  UPDATE staff_app.provider_contacts
     SET email_enviado_at = now()
   WHERE id = p_contacto_id AND organization_id = v_org;

  RETURN jsonb_build_object('ok', FOUND);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_consulta_mail_enviado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_consulta_mail_enviado(uuid) TO authenticated, service_role;

-- (3.5) Registrar que una productora contacto a un proveedor.
-- ⚠️ Esta es la que NO estaba en el relevamiento previo. Sin ella, un manager
--    habria recibido un 'sin_permiso' mudo justo en esta accion.
CREATE OR REPLACE FUNCTION public.staff_app_contactar_proveedor(p_profile_id uuid, p_mensaje text DEFAULT NULL::text, p_gig_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT m.organization_id INTO v_org
    FROM staff_app.members m
   WHERE m.user_id = auth.uid() AND m.role IN ('owner','manager','writer')
   ORDER BY m.created_at ASC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_app.marketplace_profiles mp
     WHERE mp.id = p_profile_id AND mp.tipo = 'proveedor' AND mp.activo AND mp.is_public
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  -- El gig, si viene, tiene que ser de SU organizacion.
  IF p_gig_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff_app.gigs g WHERE g.id = p_gig_id AND g.organization_id = v_org
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_ajeno');
  END IF;

  INSERT INTO staff_app.provider_contacts (organization_id, profile_id, gig_id, mensaje)
  VALUES (v_org, p_profile_id, p_gig_id, nullif(btrim(coalesce(p_mensaje, '')), ''));

  -- Y queda vinculado a esa productora, para que despues pueda dejarle nota y
  -- marcarlo favorito. relacion 'contactado' lo distingue del pool de personal.
  INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
  SELECT p_profile_id, v_org, 'contactado'
   WHERE NOT EXISTS (
     SELECT 1 FROM staff_app.profile_org_links l
      WHERE l.profile_id = p_profile_id AND l.organization_id = v_org
   );

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.staff_app_contactar_proveedor(uuid, text, uuid) IS
  'Registra que una productora contacto a un proveedor. Es el equivalente de la contratacion del lado del personal: el momento que le importa a la plataforma. owner, manager y writer.';

COMMIT;

-- ---------------------------------------------------------------------------
-- DESPUES DE APLICAR (para Franco)
-- ---------------------------------------------------------------------------
-- 1. Confirmar que el CHECK acepta el rol nuevo y sigue rechazando basura:
--
--      BEGIN;
--      UPDATE staff_app.members SET role = 'manager'
--       WHERE organization_id = '<la de prueba>';   -- NUNCA la unica que hay
--      SELECT role FROM staff_app.members;
--      ROLLBACK;
--
-- 2. Sembrar un manager sobre una membresia DE PRUEBA y confirmar que escribe
--    lo operativo y ve el contacto del pool.
-- 3. Sembrar un viewer y confirmar lo contrario: ve la ficha SIN mail, telefono
--    ni DNI.
--
-- ⚠️ Ninguna de las dos pruebas va sobre la unica membresia real que existe.
