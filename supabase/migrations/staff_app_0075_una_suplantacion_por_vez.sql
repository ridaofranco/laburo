-- Migration: staff_app_0075_una_suplantacion_por_vez
-- Escrita el 2026-09-05 y APLICADA DE VERDAD el 2026-09-05, mas tarde.
--
-- ⚠️ Esta cabecera decia APLICADA y NO lo estaba: se verifico consultando
-- pg_get_functiondef contra produccion y el cuerpo era el de la 0073, sin el
-- cierre de las suplantaciones anteriores. Escribir APLICADA no aplica nada.
--
-- Cada llamada a staff_app_actuar_como abria una fila y NO cerraba las
-- anteriores, asi que con dos pestanas se podian tener dos organizaciones
-- ajenas abiertas al mismo tiempo.
--
-- No era escalada de privilegios: para abrir cada una hay que ser admin de
-- plataforma y dejar su motivo, y las dos quedan registradas. Pero si era un
-- estado que nadie queria: el banner dice UNA organizacion y los gates de la
-- RLS dejaban escribir en dos. Quien mira la pantalla no tiene forma de saber
-- en cual de las dos esta cayendo lo que hace.
--
-- Lo encontro una revision externa.
--
-- El cierre va ANTES del INSERT, no despues, para que no exista ni un instante
-- con dos abiertas.
--
-- Verificado con ROLLBACK: dos llamadas seguidas dejan DOS filas y UNA sola
-- viva.

BEGIN;

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

  -- Una suplantacion viva por persona (0075).
  UPDATE staff_app.impersonation_log
     SET terminada_at = now()
   WHERE actor_user_id = auth.uid()
     AND terminada_at IS NULL;

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


COMMIT;
