-- Migration: staff_app_0073_actuar_como_productora
-- Escrita el 2026-09-05. SIN APLICAR: la aplica Franco.
--
-- ⚠️⚠️ ESTA ES LA MIGRACION MAS RIESGOSA DEL LOTE. Toca is_org_member e
-- is_org_writer, que son las dos funciones sobre las que se apoya la RLS de
-- TODAS las tablas del producto. Un error aca no rompe una pantalla: deja a
-- alguien escribiendo en la organizacion de otro.
--
-- ⚠️ ORDEN OBLIGATORIO: la 0071 PRIMERO, esta despues. El cuerpo de
-- is_org_writer que se escribe aca ya incluye 'manager', o sea el cuerpo que
-- deja la 0071. Aplicar esta sin aquella funciona, pero aplicar la 0071 DESPUES
-- de esta tambien funciona y pisa el OR de suplantacion. Si por lo que sea se
-- aplican al reves, hay que volver a correr esta.
--
-- ---------------------------------------------------------------------------
-- LOS CUATRO INVARIANTES, QUE NO SE NEGOCIAN
-- ---------------------------------------------------------------------------
-- 1. SOLO LA PLATAFORMA. El gate es is_platform_admin() ADENTRO de la base, no
--    en TypeScript. Un server action es un endpoint POST invocable: esconder el
--    boton no es un gate.
-- 2. FAIL-CLOSED. Cualquier duda (sesion rara, organizacion inexistente, RPC
--    que falla, cookie que no valida) = no se suplanta.
-- 3. TEMPORAL. No sobrevive al cierre del navegador (cookie de sesion) y ADEMAS
--    vence en SQL. Aunque la cookie se manipule, la base corta sola.
-- 4. VISIBLE. Mientras dure hay banner permanente en todas las pantallas del
--    portal, con el nombre de la organizacion y salida en un click.
--
-- ---------------------------------------------------------------------------
-- LA DECISION QUE HACE QUE ESTO SEA SEGURO Y NO UN AGUJERO
-- ---------------------------------------------------------------------------
-- El problema: el admin de plataforma NO es miembro de la organizacion que va a
-- operar, asi que is_org_writer(esa) da false y la RLS lo frena. La
-- suplantacion no funciona sola. Habia tres salidas:
--
--   (a) Insertar una fila en members.       DESCARTADA. Convierte algo temporal
--       en una membresia real, sobrevive a la caida de la sesion y ensucia los
--       conteos de todas las pantallas.
--   (b) Usar service_role cuando hay suplantacion.  DESCARTADA. service_role se
--       saltea la RLS ENTERA: un bug de scope deja al admin escribiendo en
--       cualquier organizacion, no solo en la elegida.
--   (c) Que is_org_member/is_org_writer acepten ademas una suplantacion VIVA
--       registrada en la tabla de auditoria.  ELEGIDA.
--
-- Por que (c): el permiso sale de LA MISMA FILA que deja el rastro. No se puede
-- operar sin que quede escrito, porque lo que autoriza ES el registro. No hay
-- forma de tener el permiso y no tener la evidencia.
--
-- LA VENTANA ES DE UNA HORA, y esa es la parte que hace real al invariante 3.
-- Una hora porque es lo que dura entrar a resolver algo concreto en la cuenta de
-- otro; mas que eso ya no es "entro a ver un problema", es trabajar con la
-- cuenta ajena. Y como el corte esta en el WHERE de la funcion, no depende de
-- que nadie cierre nada: una sesion olvidada se apaga sola.
--
-- ---------------------------------------------------------------------------
-- LOS TRES LIMITES CONOCIDOS, ESCRITOS PARA QUE NO SORPRENDAN
-- ---------------------------------------------------------------------------
-- 1. is_platform_admin() NO cambia. Un admin suplantando SIGUE siendo admin de
--    plataforma, porque su membresia en la organizacion plataforma no se toca.
--    Es deliberado: si dejara de serlo, quedaria encerrado adentro de la
--    organizacion ajena sin poder volver ni cortar la suplantacion, que es
--    peor. La consecuencia a saber: mientras suplanta, /plataforma le sigue
--    respondiendo.
-- 2. current_org_id() NO cambia. Sigue leyendo members, y la organizacion
--    suplantada no esta ahi. No hace falta: desde la tarea 1 todas las
--    escrituras pasan p_org explicito, y p_org gana en resolve_org().
-- 3. ⚠️ staff_app_generar_link_proveedor NO acepta p_org y resuelve por
--    profile_org_links. LA SUPLANTACION NO LLEGA AHI. Hoy no la llama ningun
--    archivo del repo, asi que no molesta, pero el dia que se use hay que
--    revisarlo.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LA TABLA DE AUDITORIA. Es la primera del schema: hoy no hay ninguna.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_app.impersonation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
  motivo          text NOT NULL,
  iniciada_at     timestamptz NOT NULL DEFAULT now(),
  terminada_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ ESTE INDICE NO ES OPCIONAL. Lo consultan is_org_member e is_org_writer, o
-- sea CADA lectura y CADA escritura de todo el producto. Sin el, ese EXISTS es
-- un scan de la tabla entera en el camino caliente de la RLS. Ya hay un
-- antecedente en este proyecto de un panel que decia "no hay nadie" con 7.374
-- filas adentro porque faltaba un indice y la consulta vencia.
CREATE INDEX IF NOT EXISTS impersonation_log_actor_idx
  ON staff_app.impersonation_log (actor_user_id, iniciada_at DESC);

-- El indice que sirve al EXISTS de los gates: por actor Y organizacion, y solo
-- sobre las filas abiertas, que son siempre poquisimas.
CREATE INDEX IF NOT EXISTS impersonation_log_vivas_idx
  ON staff_app.impersonation_log (actor_user_id, organization_id, iniciada_at DESC)
  WHERE terminada_at IS NULL;

ALTER TABLE staff_app.impersonation_log ENABLE ROW LEVEL SECURITY;

-- ⚠️ SIN POLITICA DE INSERT, UPDATE NI DELETE, A PROPOSITO. Un registro de
-- auditoria que el auditado puede editar no es auditoria. Escriben solo las dos
-- RPC SECURITY DEFINER de mas abajo, que son las que controlan que se escribe.
REVOKE ALL ON staff_app.impersonation_log FROM anon, authenticated;

-- La politica de lectura para la plataforma. ⚠️ HOY ES INALCANZABLE Y ESO ESTA
-- BIEN: el REVOKE de arriba quita el privilegio de TABLA, que se evalua ANTES
-- que la RLS, asi que ni siquiera un admin de plataforma puede leer esta tabla
-- desde la app. Verificado: la consulta devuelve
-- "42501: permission denied for table impersonation_log".
--
-- Se deja escrita igual, y no es adorno: el dia que se haga la pantalla de
-- auditoria, alcanza con un GRANT SELECT ... TO authenticated y la politica ya
-- limita a quien la ve. Mientras tanto el registro se lee por SQL directo, que
-- es lo que dice el pie de este archivo. Mismo patron que member_invites en la
-- 0035.
DROP POLICY IF EXISTS impersonation_log_select ON staff_app.impersonation_log;
CREATE POLICY impersonation_log_select ON staff_app.impersonation_log
  FOR SELECT USING (staff_app.is_platform_admin());

COMMENT ON TABLE staff_app.impersonation_log IS
  'Registro de cuando la plataforma opero una organizacion ajena. NO es solo un log: es lo que AUTORIZA. is_org_member e is_org_writer leen esta tabla, asi que el permiso sale de la misma fila que deja el rastro y no se puede operar sin que quede escrito. Sin politicas de INSERT/UPDATE/DELETE a proposito: escriben las RPC staff_app_actuar_como y staff_app_dejar_de_actuar. Una fila autoriza solo mientras terminada_at IS NULL y no pasaron 60 minutos de iniciada_at.';

-- ---------------------------------------------------------------------------
-- (2) LOS DOS GATES DE LA RLS. Cuerpo vigente + el OR de suplantacion.
-- ---------------------------------------------------------------------------
-- Cuerpos extraidos de produccion con pg_get_functiondef antes de tocarlos.
-- ⚠️ is_org_writer se escribe con la lista de roles que deja la 0071
-- ('owner','manager','writer'), NO con la de hoy, para no revertirla.

CREATE OR REPLACE FUNCTION staff_app.is_org_member(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.members
    WHERE organization_id = org_id AND user_id = auth.uid()
  ) OR EXISTS (
    -- Suplantacion VIVA: abierta y dentro de la ventana. El vencimiento vive
    -- aca y no en la cookie: aunque el navegador mienta, la base corta sola.
    SELECT 1 FROM staff_app.impersonation_log l
     WHERE l.actor_user_id = auth.uid()
       AND l.organization_id = org_id
       AND l.terminada_at IS NULL
       AND l.iniciada_at > now() - interval '60 minutes'
  );
$function$;

REVOKE ALL ON FUNCTION staff_app.is_org_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION staff_app.is_org_member(uuid) TO authenticated;

COMMENT ON FUNCTION staff_app.is_org_member(uuid) IS
  'True si el caller puede VER esa organizacion: es miembro, o la esta suplantando con una sesion viva registrada en impersonation_log (0073). Es el gate de lectura de toda la RLS del producto.';

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
  ) OR EXISTS (
    SELECT 1 FROM staff_app.impersonation_log l
     WHERE l.actor_user_id = auth.uid()
       AND l.organization_id = org_id
       AND l.terminada_at IS NULL
       AND l.iniciada_at > now() - interval '60 minutes'
  );
$function$;

REVOKE ALL ON FUNCTION staff_app.is_org_writer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION staff_app.is_org_writer(uuid) TO authenticated;

COMMENT ON FUNCTION staff_app.is_org_writer(uuid) IS
  'True si el caller puede ESCRIBIR en esa organizacion: es owner/manager/writer, o la esta suplantando con una sesion viva registrada en impersonation_log (0073). Es el gate de escritura de todo el producto. Quien suplanta escribe como si fuera writer: la suplantacion es para resolver problemas operativos, no para administrar la organizacion de otro.';

-- ---------------------------------------------------------------------------
-- (3) LAS DOS RPC. Molde exacto de la 0054.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_app_actuar_como(p_org uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_motivo text;
  v_id     uuid;
  v_org    record;
BEGIN
  -- INVARIANTE 1: el gate vive aca, no en la pantalla.
  IF NOT staff_app.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_permiso');
  END IF;

  -- INVARIANTE 2: cualquier duda, no se suplanta.
  v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_motivo');
  END IF;

  SELECT o.id, o.name, o.es_plataforma INTO v_org
    FROM staff_app.organizations o WHERE o.id = p_org;
  IF v_org.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;

  -- Suplantarse a uno mismo no tiene sentido y ensucia el registro.
  IF v_org.es_plataforma THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'es_la_plataforma');
  END IF;

  INSERT INTO staff_app.impersonation_log (actor_user_id, organization_id, motivo)
  VALUES (auth.uid(), p_org, left(v_motivo, 500))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sesion_id', v_id,
    'organizacion', jsonb_build_object('id', v_org.id, 'name', v_org.name)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_actuar_como(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_actuar_como(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_actuar_como(uuid, text) IS
  'Abre una sesion de suplantacion: la plataforma pasa a operar una organizacion ajena. Devuelve sesion_id, que es lo que despues cierra EXACTAMENTE esta fila (y no "la ultima abierta", que se rompe con dos pestanas). El motivo es obligatorio, mismo criterio que la moderacion de la 0054: entrar a operar la cuenta de otro sin decir por que es peor que bajar una publicacion. Solo la plataforma, y nunca sobre si misma.';

CREATE OR REPLACE FUNCTION public.staff_app_dejar_de_actuar(p_sesion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  -- Cierra SOLO una fila propia y abierta. Idempotente: llamarla dos veces
  -- devuelve ok igual, porque el estado deseado (no estar suplantando) se
  -- cumple. Salir nunca puede fallar: si fallara, alguien quedaria adentro.
  UPDATE staff_app.impersonation_log
     SET terminada_at = now()
   WHERE id = p_sesion_id
     AND actor_user_id = auth.uid()
     AND terminada_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_dejar_de_actuar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_dejar_de_actuar(uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_dejar_de_actuar(uuid) IS
  'Cierra una sesion de suplantacion estampando terminada_at. Solo cierra filas propias y abiertas. Es idempotente a proposito: salir nunca puede fallar, porque un error al salir deja a alguien operando la organizacion de otro sin quererlo.';

-- ---------------------------------------------------------------------------
-- (4) LA CONSULTA VIVA, para que TypeScript valide sin duplicar la regla.
-- ---------------------------------------------------------------------------
-- El servidor tiene que poder preguntar "esta sesion sigue viva?" sin
-- reimplementar la ventana de 60 minutos por su cuenta. Si la reimplementara,
-- el dia que cambie la ventana habria dos verdades.
CREATE OR REPLACE FUNCTION public.staff_app_suplantacion_activa(p_sesion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v record;
BEGIN
  SELECT l.id, l.organization_id, o.name, o.slug, o.es_plataforma, l.iniciada_at
    INTO v
    FROM staff_app.impersonation_log l
    JOIN staff_app.organizations o ON o.id = l.organization_id
   WHERE l.id = p_sesion_id
     AND l.actor_user_id = auth.uid()
     AND l.terminada_at IS NULL
     AND l.iniciada_at > now() - interval '60 minutes';

  IF v.id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sesion_id', v.id,
    'organization_id', v.organization_id,
    'name', v.name,
    'slug', v.slug,
    'es_plataforma', v.es_plataforma,
    'iniciada_at', v.iniciada_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_suplantacion_activa(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_suplantacion_activa(uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_suplantacion_activa(uuid) IS
  'Dice si una sesion de suplantacion sigue viva, con los datos de la organizacion. Existe para que el servidor no tenga que reimplementar la ventana de 60 minutos: la regla vive en un solo lugar. Solo devuelve sesiones propias.';

COMMIT;

-- ---------------------------------------------------------------------------
-- COMO SE AUDITA (no hay pantalla, a proposito)
-- ---------------------------------------------------------------------------
--   SELECT l.iniciada_at, l.terminada_at, o.name, l.motivo, u.email
--     FROM staff_app.impersonation_log l
--     JOIN staff_app.organizations o ON o.id = l.organization_id
--     LEFT JOIN auth.users u ON u.id = l.actor_user_id
--    ORDER BY l.iniciada_at DESC;
--
-- Una pantalla que muestre la mitad de esto es peor que este SELECT.
--
-- ---------------------------------------------------------------------------
-- LO QUE YA SE VERIFICO, CONTRA PRODUCCION Y CON ROLLBACK (5/9)
-- ---------------------------------------------------------------------------
-- Esta migracion NO esta aplicada, pero su logica no quedo sin probar: se
-- ejecuto entera contra la base de produccion adentro de transacciones con
-- ROLLBACK, actuando como el usuario real via request.jwt.claims. Resultados:
--
--   ✓ Sin suplantacion, is_org_writer sobre la organizacion ajena da FALSE.
--   ✓ Sin motivo -> 'falta_motivo', y no se inserta ninguna fila.
--   ✓ Sobre la propia organizacion plataforma -> 'es_la_plataforma'.
--   ✓ Camino feliz -> ok, con su fila de auditoria (motivo y terminada_at NULL).
--   ✓ Con la sesion abierta, is_org_writer sobre la ajena da TRUE aunque el
--     usuario NO sea miembro de ella. (Ojo al probarlo a mano: is_org_writer es
--     STABLE, asi que dentro de UNA sola sentencia no ve el INSERT que hizo esa
--     misma sentencia. En la app son dos pedidos distintos y no aplica.)
--   ✓ Suplantar una organizacion NO abre ninguna otra: la tercera sigue en
--     FALSE.
--   ✓ Con iniciada_at de hace 2 horas, el permiso vuelve a FALSE SOLO. El corte
--     vive en la base, no en la cookie.
--   ✓ CONTROL 5, el que decide: un usuario que no es admin de plataforma
--     llamando staff_app_actuar_como a mano recibe 'sin_permiso' y no deja
--     rastro.
--   ✓ La tabla no se puede leer como authenticated, ni siendo admin.
--
-- Falta correr, y NO se puede sin aplicar: los controles de interfaz (banner
-- visible en todas las pantallas, salida en un click, cookie manipulada,
-- navegador cerrado).
--
-- ---------------------------------------------------------------------------
-- LOS NUEVE CONTROLES, DESPUES DE APLICAR (para Franco)
-- ---------------------------------------------------------------------------
-- ⚠️ Antes: si Franco quedo como miembro de la organizacion de prueba, SACAR esa
--    membresia. El punto es suplantar una organizacion de la que NO se es
--    miembro; con la membresia puesta, todo "funciona" sin probar nada.
--
--  1. Camino feliz: entrar con motivo, crear un evento, y confirmar que el gig
--     quedo con el organization_id de la suplantada.
--  2. El rastro: una fila con actor, organizacion, motivo y terminada_at NULL.
--  3. La salida en un click estampa terminada_at en LA MISMA fila.
--  4. Sin motivo: falla con 'falta_motivo' y NO deja ninguna fila.
--  5. ⚠️ EL QUE IMPORTA: con una cuenta que NO sea admin de plataforma, llamar
--     staff_app_actuar_como a mano. Tiene que devolver 'sin_permiso' y no dejar
--     rastro. Si funciona, la tarea NO esta hecha, aunque el boton no se vea.
--  6. Cookie manipulada (otro UUID, o un sesion_id inventado): se ignora, se
--     borra, y no se muestra ni un dato de la organizacion apuntada.
--  7. Cerrar el navegador entero: la suplantacion NO sobrevive.
--  8. Vencimiento:
--       UPDATE staff_app.impersonation_log
--          SET iniciada_at = now() - interval '2 hours'
--        WHERE id = '<la sesion>';
--     Recargar: el portal vuelve solo a la organizacion propia. Es la prueba de
--     que el corte vive en la base y no en la cookie.
--  9. No-regresion sin suplantacion activa: /leads, /rentabilidad y /plataforma
--     siguen andando para el admin.
