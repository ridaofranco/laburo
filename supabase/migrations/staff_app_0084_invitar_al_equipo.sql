-- Migration: staff_app_0084_invitar_al_equipo
-- Escrita el 2026-09-07.
--
-- "INVITAR MIEMBROS: PROXIMAMENTE" dejaba a la productora sola adentro.
--
-- Franco, 7/9/2026: *"que invitar miembros este activo"*. La pantalla de Ajustes
-- mostraba ese cartel desde que se porteo de Stitch, y el efecto practico es que
-- una productora que quiere meter a su equipo NO PUEDE: el unico que entra es
-- quien creo la cuenta. Para un producto que se llama "el staff, los proveedores
-- y el salon en un solo lugar", que no entre el propio equipo es grave.
--
-- ⚠️ LA TABLA YA EXISTIA, A MEDIAS. `staff_app.member_invites` tenia cuatro
-- columnas (org, email, role, created_at) y DOS FILAS, sin token, sin
-- vencimiento y sin estado: o sea, ni siquiera se podia aceptar una invitacion.
-- Esta migracion la completa en vez de crear una tabla nueva al lado.
--
-- ── POR QUE NO SE REUSAN LAS FUNCIONES DE HITO ──────────────────────────────
-- HITO ya tiene create_invitation / get_invitation / accept_invitation y andan.
-- No se reusan por una razon concreta: guardan el token EN CLARO en la tabla.
-- Este modulo (0078 en adelante) guarda solo el sha256, asi que el link no se
-- puede reconstruir desde la base ni por quien la lee entera. Se copia el flujo,
-- no el almacenamiento.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. COMPLETAR LA TABLA
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE staff_app.member_invites
  ADD COLUMN IF NOT EXISTS token_hash  text,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS estado      text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS invited_by  uuid,
  ADD COLUMN IF NOT EXISTS enviado_at  timestamptz,
  ADD COLUMN IF NOT EXISTS aceptada_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_invites_estado_check'
  ) THEN
    ALTER TABLE staff_app.member_invites
      ADD CONSTRAINT member_invites_estado_check
      CHECK (estado = ANY (ARRAY['pendiente','aceptada','revocada']));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS member_invites_token_hash_key
  ON staff_app.member_invites (token_hash) WHERE token_hash IS NOT NULL;

-- ⚠️ LAS DOS FILAS VIEJAS SE REVOCAN. Son de antes de que existiera el token:
-- no tienen forma de aceptarse y, sin esto, el UNIQUE (organization_id, email)
-- bloquearia volver a invitar a esas dos personas para siempre.
UPDATE staff_app.member_invites
   SET estado = 'revocada'
 WHERE token_hash IS NULL AND estado = 'pendiente';

COMMENT ON COLUMN staff_app.member_invites.token_hash IS
  'sha256 del token. El token en crudo sale UNA vez, al crear la invitacion, y no queda guardado en ningun lado.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. INVITAR
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_invitar_miembro(
  p_email text,
  p_role  text DEFAULT 'writer',
  p_org   uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, extensions, pg_temp
AS $$
DECLARE
  v_org   uuid := staff_app.resolve_org(p_org);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_rol   text := lower(btrim(coalesce(p_role, 'writer')));
  v_raw   text;
  v_hash  text;
  v_id    uuid;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  -- ⚠️ INVITAR ES MAS QUE ESCRIBIR: suma gente que va a ver el pool, las
  -- ofertas y la plata comprometida. Un `writer` puede cargar un evento, pero
  -- no puede agrandar el equipo. Solo owner y manager.
  IF NOT EXISTS (
    SELECT 1 FROM staff_app.members m
     WHERE m.organization_id = v_org
       AND m.user_id = auth.uid()
       AND m.role IN ('owner','manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalido');
  END IF;

  -- No se invita a `owner`: el dueño se define al crear la organizacion y
  -- traspasarlo es otra operacion, con otras consecuencias.
  IF v_rol NOT IN ('manager','writer','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rol_invalido');
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_app.members m
     JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = v_org AND lower(u.email) = v_email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_es_miembro');
  END IF;

  v_raw  := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  -- Reinvitar a la misma persona pisa la invitacion anterior en vez de fallar
  -- por el UNIQUE: el caso real es "no le llego, mandasela de nuevo".
  INSERT INTO staff_app.member_invites
    (organization_id, email, role, token_hash, expires_at, estado, invited_by, created_at)
  VALUES
    (v_org, v_email, v_rol, v_hash, now() + interval '14 days', 'pendiente', auth.uid(), now())
  ON CONFLICT (organization_id, email) DO UPDATE
    SET role        = excluded.role,
        token_hash  = excluded.token_hash,
        expires_at  = excluded.expires_at,
        estado      = 'pendiente',
        invited_by  = excluded.invited_by,
        created_at  = now(),
        enviado_at  = NULL,
        aceptada_at = NULL
  RETURNING id INTO v_id;

  -- El token en crudo viaja UNA sola vez, para armar el link del mail.
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'email', v_email, 'rol', v_rol, 'token', v_raw);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_invitar_miembro(text, text, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. MARCAR QUE EL MAIL SALIO
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_invitacion_enviada(
  p_invite_id uuid,
  p_org       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  UPDATE staff_app.member_invites
     SET enviado_at = now()
   WHERE id = p_invite_id AND organization_id = v_org;
  RETURN jsonb_build_object('ok', FOUND);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_invitacion_enviada(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. VER LA INVITACION (pantalla publica, sin sesion)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_ver_invitacion_miembro(
  p_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, extensions, pg_temp
AS $$
DECLARE
  v_hash text := encode(extensions.digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_inv  record;
  v_org  record;
BEGIN
  SELECT * INTO v_inv FROM staff_app.member_invites WHERE token_hash = v_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;
  IF v_inv.estado = 'revocada' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revocada');
  END IF;
  IF v_inv.estado = 'aceptada' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_aceptada');
  END IF;
  IF v_inv.expires_at IS NOT NULL AND now() > v_inv.expires_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'vencida');
  END IF;

  SELECT * INTO v_org FROM staff_app.organizations WHERE id = v_inv.organization_id;

  -- ⚠️ Devuelve el mail invitado a proposito: la pantalla lo muestra para que la
  -- persona sepa con QUE direccion tiene que entrar. Sin eso, quien tiene dos
  -- cuentas entra con la equivocada y la invitacion no le sirve.
  RETURN jsonb_build_object(
    'ok', true,
    'email', v_inv.email,
    'rol', v_inv.role,
    'organizacion', coalesce(v_org.name, 'una productora'),
    'vence', v_inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_ver_invitacion_miembro(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. ACEPTAR
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_aceptar_invitacion_miembro(
  p_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, extensions, pg_temp
AS $$
DECLARE
  v_hash  text := encode(extensions.digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_inv   record;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_sesion');
  END IF;

  SELECT * INTO v_inv FROM staff_app.member_invites WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;
  IF v_inv.estado <> 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_inv.estado);
  END IF;
  IF v_inv.expires_at IS NOT NULL AND now() > v_inv.expires_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'vencida');
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();

  -- ⚠️ LA INVITACION ES PARA UNA DIRECCION, NO PARA CUALQUIERA QUE TENGA EL
  -- LINK. Sin esto, un link reenviado por WhatsApp mete al que lo abra dentro
  -- de la productora, con acceso al pool y a la plata comprometida.
  IF v_email IS DISTINCT FROM lower(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'otro_mail', 'esperado', v_inv.email);
  END IF;

  INSERT INTO staff_app.members (organization_id, user_id, role)
  VALUES (v_inv.organization_id, auth.uid(), v_inv.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE staff_app.member_invites
     SET estado = 'aceptada', aceptada_at = now()
   WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'organization_id', v_inv.organization_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_aceptar_invitacion_miembro(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. EL EQUIPO: LISTAR, REVOCAR, CAMBIAR ROL, SACAR
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_app_equipo(
  p_org uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_puede boolean;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN jsonb_build_object('miembros', '[]'::jsonb, 'invitaciones', '[]'::jsonb, 'puede_invitar', false);
  END IF;

  v_puede := EXISTS (
    SELECT 1 FROM staff_app.members m
     WHERE m.organization_id = v_org AND m.user_id = auth.uid() AND m.role IN ('owner','manager')
  );

  RETURN jsonb_build_object(
    'puede_invitar', v_puede,
    'yo', auth.uid(),
    'miembros', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'user_id', m.user_id, 'email', u.email,
               'rol', m.role, 'desde', m.created_at
             ) ORDER BY m.created_at)
        FROM staff_app.members m
        JOIN auth.users u ON u.id = m.user_id
       WHERE m.organization_id = v_org
    ), '[]'::jsonb),
    'invitaciones', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'email', i.email, 'rol', i.role,
               'vence', i.expires_at, 'enviado', i.enviado_at is not null,
               'creada', i.created_at
             ) ORDER BY i.created_at DESC)
        FROM staff_app.member_invites i
       WHERE i.organization_id = v_org
         AND i.estado = 'pendiente'
         AND (i.expires_at IS NULL OR i.expires_at > now())
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_equipo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_revocar_invitacion_miembro(
  p_invite_id uuid,
  p_org       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM staff_app.members m
     WHERE m.organization_id = v_org AND m.user_id = auth.uid() AND m.role IN ('owner','manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE staff_app.member_invites
     SET estado = 'revocada'
   WHERE id = p_invite_id AND organization_id = v_org AND estado = 'pendiente';

  RETURN jsonb_build_object('ok', FOUND);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_revocar_invitacion_miembro(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_quitar_miembro(
  p_member_id uuid,
  p_org       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_row record;
BEGIN
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM staff_app.members m
     WHERE m.organization_id = v_org AND m.user_id = auth.uid() AND m.role IN ('owner','manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_row FROM staff_app.members
   WHERE id = p_member_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;

  -- ⚠️ NO SE SACA AL DUEÑO, ni siquiera un manager, ni uno a si mismo: una
  -- organizacion sin owner queda sin nadie que pueda invitar ni traspasarla, y
  -- eso no se arregla desde la pantalla.
  IF v_row.role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'es_owner');
  END IF;
  IF v_row.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sos_vos');
  END IF;

  DELETE FROM staff_app.members WHERE id = p_member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_quitar_miembro(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_app_cambiar_rol_miembro(
  p_member_id uuid,
  p_role      text,
  p_org       uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_rol text := lower(btrim(coalesce(p_role, '')));
  v_row record;
BEGIN
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM staff_app.members m
     WHERE m.organization_id = v_org AND m.user_id = auth.uid() AND m.role IN ('owner','manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_rol NOT IN ('manager','writer','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rol_invalido');
  END IF;

  SELECT * INTO v_row FROM staff_app.members WHERE id = p_member_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;
  IF v_row.role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'es_owner');
  END IF;

  UPDATE staff_app.members SET role = v_rol WHERE id = p_member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_app_cambiar_rol_miembro(uuid, text, uuid) TO authenticated;

COMMIT;
