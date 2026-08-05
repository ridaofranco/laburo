-- staff_app_0062_proveedor_formulario_por_sesion
-- La ÚNICA pieza que le faltaba a la puerta por sesión del proveedor.
--
-- ── CONTEXTO ─────────────────────────────────────────────────────────────────
-- La 0045 construyó la puerta del proveedor POR CUENTA entera: resolver del
-- perfil (`perfil_proveedor_del_caller`), los cinco escritores compartidos, y
-- las RPC `staff_app_mi_proveedor_*`. Nunca se conectó a ninguna pantalla, así
-- que quedó dormida casi un mes. El 5/8 Franco pidió que ingresar sea simple y
-- que el proveedor tenga su cuenta como todos, y ahí se despierta.
--
-- Al conectarla apareció el único hueco: la 0058 (formulario de consulta) sumó
-- `staff_app_proveedor_formulario(p_token)` para LEER el formulario propio, y su
-- espejo por sesión para GUARDAR (`staff_app_mi_proveedor_guardar_formulario`),
-- pero **el espejo por sesión para LEER nunca se escribió**. Sin esto, el
-- proveedor que entra con su cuenta puede guardar su formulario pero no puede
-- verlo: la pantalla le mostraría el template de SOMOS DER como si no tuviera
-- nada guardado, y al primer guardado le pisaría lo suyo.
--
-- No sirve `staff_app_formulario_proveedor(p_profile_id)`: esa es la que usa
-- QUIEN CONSULTA, exige que el proveedor esté publicado y no devuelve el
-- formulario del dueño si todavía está despublicado.
--
-- Contrato calcado del de token: mismo jsonb, mismas claves. Que las dos puertas
-- devuelvan lo mismo es lo que permite que la pantalla no sepa por cuál entró.

CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_formulario()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_perfil_id uuid := staff_app.perfil_proveedor_del_caller();
  v_form      staff_app.provider_forms%ROWTYPE;
BEGIN
  -- NULL y no un error: es el mismo silencio que devuelve la puerta por token
  -- cuando el token no sirve. La pantalla ya sabe leer eso.
  IF v_perfil_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_form FROM staff_app.provider_forms WHERE profile_id = v_perfil_id;

  RETURN jsonb_build_object(
    'ok', true,
    'campos', coalesce(v_form.campos, '[]'::jsonb),
    'intro',  v_form.intro
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_formulario() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_formulario() TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_formulario() IS
  'El proveedor lee su propio formulario de consultas POR SESION. Espejo exacto de staff_app_proveedor_formulario(p_token), con el mismo jsonb, para que el panel no tenga que saber por que puerta entro. anon NUNCA: sin token ni sesion no hay identidad que resolver.';

NOTIFY pgrst, 'reload schema';
