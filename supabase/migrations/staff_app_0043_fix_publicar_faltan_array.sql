-- ===========================================================================
-- 0043: ARREGLO DE staff_app_proveedor_publicar (bug de la 0042)
-- ===========================================================================
--
-- QUÉ PASABA: la función armaba la lista de lo que falta con
--
--     v_faltan := v_faltan || 'servicios';
--
-- y eso no hace lo que uno cree. Con `v_faltan` de tipo text[] y un literal sin
-- tipo a la derecha, Postgres resuelve el operador `||` como "array || array" e
-- intenta castear 'servicios' a text[]. Revienta con
-- `22P02 malformed array literal`.
--
-- CONSECUENCIA REAL: el proveedor que tocaba "publicarme" sin tener servicios
-- cargados, que es el caso más común del primer uso, recibía una excepción en
-- vez del mensaje que le dice qué le falta. Justo el camino que la 0042 dice
-- cuidar en su propio comentario: "devuelve QUÉ falta, en códigos estables,
-- para que la pantalla lo diga en castellano y accionable en vez de mostrar un
-- error crudo".
--
-- POR QUÉ NO SE VIO ANTES, Y LA LECCIÓN: los gates de la tarea eran typecheck,
-- lint, build y greps. Ninguno de los cuatro ejecuta SQL. Un error de tipos de
-- plpgsql que vive adentro de un IF que no siempre se recorre no lo encuentra
-- ningún análisis estático del front: aparece corriendo la función contra una
-- base. Lo cazó el harness de la 0042 la primera vez que se corrió de verdad.
--
-- EL ARREGLO: `array_append()`, que no tiene la ambigüedad del operador. Se
-- reemplaza la función entera y no se toca nada más.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.staff_app_proveedor_publicar(
  p_token    text,
  p_publicar boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_id     uuid := staff_app.perfil_proveedor_por_token(p_token);
  v_p      marketplace_profiles%ROWTYPE;
  v_faltan text[] := '{}';
  v_con_servicio    boolean;
  v_con_provincia   boolean;
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalido');
  END IF;

  IF NOT coalesce(p_publicar, false) THEN
    UPDATE marketplace_profiles
       SET is_public  = false,
           updated_at = now()
     WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  SELECT * INTO v_p FROM marketplace_profiles WHERE id = v_id;

  SELECT EXISTS (SELECT 1 FROM provider_services s WHERE s.profile_id = v_id AND s.activo)
    INTO v_con_servicio;

  SELECT EXISTS (
           SELECT 1 FROM provider_services s
            WHERE s.profile_id = v_id
              AND s.activo
              AND array_length(s.provincias, 1) > 0
         )
    INTO v_con_provincia;

  -- array_append en vez de `||`: con el operador, un literal sin tipo se
  -- intenta castear a text[] y revienta (22P02). Es el bug que arregla esta
  -- migración. Si algún día se suma otro faltante, va con array_append también.
  IF coalesce(btrim(v_p.display_name), '') = '' THEN
    v_faltan := array_append(v_faltan, 'nombre');
  END IF;

  IF NOT v_con_servicio THEN
    v_faltan := array_append(v_faltan, 'servicios');
  END IF;

  IF v_con_servicio AND NOT v_con_provincia THEN
    v_faltan := array_append(v_faltan, 'provincias');
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'faltan_datos', 'faltan', to_jsonb(v_faltan));
  END IF;

  UPDATE marketplace_profiles
     SET is_public  = true,
         updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

-- WR-05: Supabase re-grantea anon en cada CREATE OR REPLACE de una función de
-- public, así que el REVOKE va de nuevo, con la firma completa, y recién
-- después el GRANT. Sin esto el arreglo reabriría lo que la 0042 cerró.
REVOKE ALL ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) TO anon, authenticated;

COMMENT ON FUNCTION public.staff_app_proveedor_publicar(text, boolean) IS
  'El proveedor se publica o se despublica solo, por token. Toca is_public y nada más: is_verified lo activa DER y no se escribe en ningún punto del flujo por token. Para pasar a público exige completitud mínima (nombre visible, al menos un servicio activo, y al menos un servicio con provincias) porque sin categoría ni provincia la búsqueda del movimiento 4 no lo encuentra, o sea que sería publicar algo invisible; devuelve {ok:false, reason:faltan_datos, faltan:[nombre|servicios|provincias]} para que la pantalla diga qué falta. Despublicar nunca valida nada. Reasons: token_invalido, faltan_datos. anon + authenticated EXECUTE. La lista de faltantes se arma con array_append: el operador || con un literal sin tipo intenta castearlo a text[] y revienta (bug corregido en la 0043).';

NOTIFY pgrst, 'reload schema';
