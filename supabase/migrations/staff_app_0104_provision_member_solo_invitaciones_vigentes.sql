-- 0104 · provision_member solo usa invitaciones VIGENTES y las marca aceptadas
--
-- Encontrado en el turno noche del 31/10 (relevo B6). provision_member corre en
-- cada ingreso (/auth/callback) y buscaba CUALQUIER fila de member_invites con
-- el mail de la persona, sin mirar el estado ni el vencimiento, y nunca la
-- marcaba como aceptada. Tres consecuencias:
--
--   1. 🔴 Sacar a alguien del equipo no servía: staff_app_quitar_miembro borra
--      la fila de members, pero la invitación queda, y en el próximo ingreso
--      provision_member lo volvía a sumar con el mismo rol.
--   2. 🔴 Cancelar una invitación tampoco: la fila 'revocada' seguía dando acceso
--      a quien entrara con ese mail.
--   3. 🟡 La invitación del alta de productora quedaba 'pendiente' para siempre
--      y Ajustes la mostraba como «El mail no salió» (9109a7f la escondió en la
--      pantalla; esto arregla la causa).
--
-- Ahora: solo 'pendiente' y sin vencer; al usarla se marca 'aceptada'. Quien ya
-- es miembro sigue entrando igual: si no hay invitación vigente, se devuelve su
-- membresía (el callback ya caía a orgActual() en ese caso, pero así el
-- resultado no cambia para nadie). El candado histórico de los dos mails de
-- Franco queda igual. Mismos permisos (authenticated), mismo search_path.

CREATE OR REPLACE FUNCTION public.staff_app_provision_member()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid;
  v_role  text;
  v_inv   uuid;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- 1. La invitación manda (org y rol), pero solo si sigue vigente.
  SELECT i.id, i.organization_id, i.role INTO v_inv, v_org, v_role
    FROM staff_app.member_invites i
   WHERE lower(i.email) = v_email
     AND i.estado = 'pendiente'
     AND (i.expires_at IS NULL OR i.expires_at > now())
   ORDER BY i.created_at
   LIMIT 1;

  -- 2. Fallback histórico (candado CR-01 original), por si la tabla se vacía.
  IF v_org IS NULL AND v_email IN ('ridaofrancorg@gmail.com', 'franco@somosder.ar') THEN
    v_org  := staff_app.default_org_id();
    v_role := 'owner';
  END IF;

  -- 3. Sin invitación vigente: si ya es miembro de algo, se devuelve eso.
  IF v_org IS NULL THEN
    SELECT m.organization_id, m.role INTO v_org, v_role
      FROM staff_app.members m
     WHERE m.user_id = v_uid
     ORDER BY m.created_at
     LIMIT 1;
    IF v_org IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object('organization_id', v_org, 'role', v_role);
  END IF;

  INSERT INTO staff_app.members (organization_id, user_id, role)
  VALUES (v_org, v_uid, coalesce(v_role, 'writer'))
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  IF v_inv IS NOT NULL THEN
    UPDATE staff_app.member_invites
       SET estado = 'aceptada', aceptada_at = now()
     WHERE id = v_inv;
  END IF;

  SELECT m.role INTO v_role
    FROM staff_app.members m
   WHERE m.organization_id = v_org AND m.user_id = v_uid;

  RETURN jsonb_build_object('organization_id', v_org, 'role', v_role);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_provision_member() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_provision_member() TO authenticated, service_role;
