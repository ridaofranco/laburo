-- staff_app_0063_proveedor_ve_sus_consultas
-- El proveedor ve en su panel las consultas que le llegaron.
--
-- ── EL AGUJERO ───────────────────────────────────────────────────────────────
-- El 6/8 entró la primera consulta real de la vidriera: una fiesta privada para
-- 10.000 personas. El mail salió bien (quedó sellado `email_enviado_at`). Pero
-- Franco, textual: *"si bien la puede ver por correo, sino le llega, quizas
-- abriendo su panel con usuario y contraseña como hacen todos, le funciona"*.
--
-- Y tenía razón: el panel del proveedor mostraba sus datos, sus servicios, su
-- formulario y el botón de publicarse. **Las consultas no estaban en ningún
-- lado.** O sea que todo el producto dependía de que un mail no se perdiera. Un
-- mail que cae en spam es una consulta perdida y un proveedor que cree que la
-- vidriera no sirve.
--
-- Es la misma lección de `vigia-borrador-escrito-no-es-enviado`: que algo se
-- haya mandado no es que haya llegado. La app tiene que poder mostrarlo igual.
--
-- ── DOS PUERTAS, UN CONTRATO ────────────────────────────────────────────────
-- Igual que el resto del panel: una por token (0042) y una por sesión (0045),
-- devolviendo EXACTAMENTE el mismo jsonb, para que la pantalla no sepa por cuál
-- entró el proveedor.
--
-- ── QUÉ SE DEVUELVE Y QUÉ NO ────────────────────────────────────────────────
-- SÍ el mail y el teléfono de quien consulta: es una consulta dirigida a él y
-- sin eso no puede contestar, que es el punto de todo esto.
-- NO se devuelve `organization_id` ni `gig_id`: son de la productora, no suyos,
-- y no le sirven para nada.

-- El lector interno, compartido por las dos puertas. Escrito una sola vez para
-- que ninguna quede distinta: es exactamente el error que dejó las dos familias
-- de funciones desincronizadas durante un mes.
CREATE OR REPLACE FUNCTION staff_app.proveedor_consultas(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'id',            c.id,
             'created_at',    c.created_at,
             'origen',        c.origen,
             'nombre',        c.nombre_contacto,
             'email',         c.email_contacto,
             'telefono',      c.telefono_contacto,
             'mensaje',       c.mensaje,
             'respuestas',    coalesce(c.respuestas, '[]'::jsonb),
             -- Para que el proveedor sepa si además le llegó por mail o si esta
             -- pantalla es la unica forma de haberse enterado.
             'mail_enviado',  (c.email_enviado_at IS NOT NULL)
           ) AS x
      FROM staff_app.provider_contacts c
     WHERE c.profile_id = p_profile_id
     ORDER BY c.created_at DESC
     LIMIT 200
  ) t;
$$;

REVOKE ALL ON FUNCTION staff_app.proveedor_consultas(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION staff_app.proveedor_consultas(uuid) IS
  'Las consultas que le llegaron a UN proveedor. Guard compartido de las dos puertas (token y sesion), escrito una sola vez. Revocado de todos: solo se llama desde adentro de las SECURITY DEFINER de public.';

-- ── Puerta por TOKEN ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_proveedor_consultas(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_por_token(p_token);
BEGIN
  -- NULL y no un error: es el mismo silencio que devuelve el resto del panel
  -- cuando el token no sirve. La pantalla ya sabe leer eso.
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN staff_app.proveedor_consultas(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_proveedor_consultas(text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_proveedor_consultas(text) TO anon, authenticated;

-- ── Puerta por SESIÓN ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_mi_proveedor_consultas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_id uuid := staff_app.perfil_proveedor_del_caller();
BEGIN
  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN staff_app.proveedor_consultas(v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_mi_proveedor_consultas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_mi_proveedor_consultas() TO authenticated;

COMMENT ON FUNCTION public.staff_app_mi_proveedor_consultas() IS
  'El proveedor lee sus consultas POR SESION. Espejo de staff_app_proveedor_consultas(p_token) con el mismo jsonb. anon NUNCA: sin token ni sesion no hay identidad que resolver.';

NOTIFY pgrst, 'reload schema';
