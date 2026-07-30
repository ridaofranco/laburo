-- staff_app_0036_org_rpcs_productora
-- DESHARCODEAR LA ORGANIZACIÓN — parte 2 de 4: el lado PRODUCTORA.
--
-- Las 8 RPCs que usa el panel (crear/editar evento, puestos, datos del predio,
-- link de cobro, favorito/nota, rating, mandar propuesta) más el alta de miembro
-- al loguearse. Todas hacían lo mismo:
--
--     v_org uuid := 'aa29aa2f-…';                 -- ← el literal
--     if not staff_app.is_org_writer(v_org) ...   -- ← gate contra ESA org
--     insert ... values (v_org, …)                -- ← y escribe en ESA org
--
-- El gate estaba bien; el literal no. Con dos productoras, el owner de la
-- segunda pide crear un evento, la función lo evalúa contra la org de DER, y le
-- contesta 'forbidden': la productora nueva simplemente no puede usar la app.
--
-- Acá el literal se reemplaza por:
--
--     v_org uuid := staff_app.resolve_org(p_org);
--
-- que devuelve (1) la org que mandó el caller, (2) si no, la del usuario según
-- su fila en staff_app.members, (3) si no, la default. El gate is_org_writer
-- queda EXACTAMENTE donde estaba, sobre la org ya resuelta: mandar p_org de otra
-- productora no habilita nada, solo consigue el 'forbidden' antes.
--
-- ── POR QUÉ DROP Y NO CREATE OR REPLACE ─────────────────────────────────────
-- Sumar un parámetro cambia la firma, así que CREATE OR REPLACE no reemplaza:
-- crea una función NUEVA y quedan las dos conviviendo. Y con dos overloads que
-- se pueden satisfacer con los mismos argumentos, Postgres devuelve
-- "function is not unique" (42725) y la app se cae. Por eso cada bloque hace
-- DROP + CREATE. La migración corre en UNA transacción: nadie ve el momento sin
-- función. Y como DROP se lleva los grants, cada bloque los vuelve a emitir.
--
-- ⚠️ p_org va SIEMPRE al final y con DEFAULT NULL: las llamadas actuales de la
-- app (que mandan los parámetros por nombre vía PostgREST y no mandan p_org)
-- siguen funcionando sin tocar una línea de TypeScript.
--
-- ⚠️ Después de aplicar, si alguna llamada devuelve PGRST202 ("could not find
-- function ... in the schema cache"), recargar el cache de PostgREST
-- (NOTIFY pgrst, 'reload schema'; o el botón de Supabase). El event trigger de
-- Supabase suele hacerlo solo.

-- ---------------------------------------------------------------------------
-- (1) create_gig
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_create_gig(text, timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.staff_app_create_gig(
  p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_venue text,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_id  uuid;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF coalesce(btrim(p_title), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'title_required');
  END IF;
  IF p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_dates');
  END IF;
  INSERT INTO staff_app.gigs (organization_id, title, starts_at, ends_at, venue_name, status)
  VALUES (v_org, btrim(p_title), p_starts_at, p_ends_at, nullif(btrim(p_venue), ''), 'activo')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'gig_id', v_id, 'organization_id', v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_create_gig(text, timestamptz, timestamptz, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_create_gig(text, timestamptz, timestamptz, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (2) update_gig
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.staff_app_update_gig(
  p_gig_id uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_venue text, p_status text,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_dates');
  END IF;
  UPDATE staff_app.gigs SET
    title      = coalesce(nullif(btrim(p_title), ''), title),
    starts_at  = p_starts_at,
    ends_at    = p_ends_at,
    venue_name = nullif(btrim(p_venue), ''),
    status     = coalesce(nullif(btrim(p_status), ''), status)
  WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (3) set_gig_details
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_set_gig_details(uuid, numeric, double precision, double precision, text);

CREATE OR REPLACE FUNCTION public.staff_app_set_gig_details(
  p_gig_id uuid, p_client_budget numeric,
  p_venue_lat double precision, p_venue_lng double precision, p_venue_address text,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_client_budget IS NOT NULL AND p_client_budget < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_budget');
  END IF;
  IF p_venue_lat IS NOT NULL AND (p_venue_lat < -90 OR p_venue_lat > 90) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  IF p_venue_lng IS NOT NULL AND (p_venue_lng < -180 OR p_venue_lng > 180) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_coords');
  END IF;
  UPDATE staff_app.gigs SET
    client_budget = p_client_budget,
    venue_lat     = p_venue_lat,
    venue_lng     = p_venue_lng,
    venue_address = nullif(btrim(p_venue_address), '')
  WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_gig_details(uuid, numeric, double precision, double precision, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_set_gig_details(uuid, numeric, double precision, double precision, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (4) set_gig_slots
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_set_gig_slots(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.staff_app_set_gig_slots(
  p_gig_id uuid, p_slots jsonb,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org  uuid := staff_app.resolve_org(p_org);
  v_slot jsonb;
  v_role text;
  v_qty  int;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  PERFORM 1 FROM staff_app.gigs WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;

  DELETE FROM staff_app.gig_slots WHERE gig_id = p_gig_id AND organization_id = v_org;
  IF p_slots IS NOT NULL AND jsonb_typeof(p_slots) = 'array' THEN
    FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
      v_role := btrim(coalesce(v_slot->>'role', ''));
      v_qty  := coalesce(nullif(v_slot->>'quantity', '')::int, 0);
      IF v_role <> '' AND v_qty > 0 THEN
        INSERT INTO staff_app.gig_slots (organization_id, gig_id, role, quantity)
        VALUES (v_org, p_gig_id, v_role, least(v_qty, 999));
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_gig_slots(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_set_gig_slots(uuid, jsonb, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (5) set_gig_payment_pref
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_set_gig_payment_pref(uuid, text);

CREATE OR REPLACE FUNCTION public.staff_app_set_gig_payment_pref(
  p_gig_id uuid, p_preference_id text,
  p_org uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF coalesce(btrim(p_preference_id), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_preference');
  END IF;
  UPDATE staff_app.gigs SET
    client_preference_id = p_preference_id,
    -- No pisar un cobro ya confirmado si se regenera el link.
    client_payment_status = CASE WHEN client_payment_status = 'paid' THEN 'paid' ELSE 'pending' END
  WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_gig_payment_pref(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_set_gig_payment_pref(uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- (6) set_candidate_note — favorito/nota interna sobre una ficha.
--
--     Ojo con esta: la nota se guarda POR ORG (UNIQUE (org, candidato)). Con el
--     literal, una productora aliada escribiendo una nota la escribía en el
--     casillero de DER y pisaba la nota de DER sobre esa persona. Resuelto por
--     resolve_org + el gate.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_set_candidate_note(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.staff_app_set_candidate_note(
  p_staff_profile_id uuid,
  p_is_favorite      boolean,
  p_note             text,
  p_org              uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- La ficha tiene que ser del pool de ESTA org (la RLS no aplica en definer).
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  INSERT INTO candidate_notes (organization_id, staff_profile_id, is_favorite, note, updated_by, updated_at)
  VALUES (v_org, p_staff_profile_id, coalesce(p_is_favorite, false), nullif(btrim(p_note), ''), auth.uid(), now())
  ON CONFLICT (organization_id, staff_profile_id) DO UPDATE
    SET is_favorite = excluded.is_favorite,
        note        = excluded.note,
        updated_by  = excluded.updated_by,
        updated_at  = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_set_candidate_note(uuid, boolean, text, uuid) IS
  'Favorito/nota interna sobre una ficha, PRODUCTORA-ONLY. La org sale de staff_app.resolve_org(p_org) — contexto del usuario, ya no un literal — y el gate is_org_writer se aplica sobre esa org. Valida que la ficha sea del pool de esa org. authenticated only; nunca anon. NUNCA se le muestra a la persona.';

-- ---------------------------------------------------------------------------
-- (7) rate_staff
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_rate_staff(uuid, uuid, int, text);

CREATE OR REPLACE FUNCTION public.staff_app_rate_staff(
  p_staff_profile_id uuid,
  p_gig_id           uuid,
  p_score            int,
  p_note             text,
  p_org              uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF p_score IS NULL OR p_score < 1 OR p_score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'score_out_of_range');
  END IF;
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;
  PERFORM 1 FROM gigs WHERE id = p_gig_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  END IF;

  INSERT INTO staff_ratings (organization_id, staff_profile_id, gig_id, score, note, rated_by, created_at)
  VALUES (v_org, p_staff_profile_id, p_gig_id, p_score, nullif(btrim(p_note), ''), auth.uid(), now())
  ON CONFLICT (organization_id, staff_profile_id, gig_id) DO UPDATE
    SET score    = excluded.score,
        note     = excluded.note,
        rated_by = excluded.rated_by;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_rate_staff(uuid, uuid, int, text, uuid) IS
  'Rating post-evento 1-5, PRODUCTORA-ONLY. La org sale de resolve_org(p_org) y el gate is_org_writer se aplica sobre ella; ficha y evento tienen que ser de esa misma org. authenticated only; nunca anon. NUNCA se le muestra a la persona.';

-- ---------------------------------------------------------------------------
-- (8) create_offer — el corazón de la máquina de contratación.
--     Firma idéntica a la de 0030 más p_org al final. El token crudo sigue
--     saliendo UNA sola vez y sin persistirse.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.staff_app_create_offer(uuid, text, uuid, text, timestamptz, timestamptz, text, numeric, text, int);

CREATE OR REPLACE FUNCTION public.staff_app_create_offer(
  p_staff_profile_id uuid,
  p_role             text,
  p_gig_id           uuid        DEFAULT NULL,   -- pick: evento existente
  -- quick-create (solo cuando p_gig_id IS NULL):
  p_gig_title        text        DEFAULT NULL,
  p_gig_starts_at    timestamptz DEFAULT NULL,
  p_gig_ends_at      timestamptz DEFAULT NULL,
  p_gig_venue        text        DEFAULT NULL,
  p_amount           numeric     DEFAULT NULL,
  p_conditions       text        DEFAULT NULL,
  p_expires_in_days  int         DEFAULT 7,
  p_org              uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org      uuid := staff_app.resolve_org(p_org);
  v_gig      uuid := p_gig_id;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');       -- 256-bit, 64 hex
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');    -- sha256 hex, igual que 0003
  v_offer_id uuid;
  v_expires  timestamptz := now() + make_interval(days => greatest(1, p_expires_in_days));
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  -- 1. Writer gate. auth.uid() se preserva dentro de SECURITY DEFINER, así que
  --    este es el caller REAL. anon nunca llega (grants de abajo).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(btrim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  -- 2. Si no eligió evento, se crea al toque en la MISMA transacción que la
  --    propuesta: no queda evento huérfano ni carrera posible.
  IF v_gig IS NULL THEN
    IF coalesce(btrim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, btrim(p_gig_title), p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    -- El evento elegido tiene que ser de esta org (la RLS no aplica en definer).
    PERFORM 1 FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
  END IF;

  -- 3. Y la ficha también.
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 4. La propuesta. status por DEFAULT 'sent'; solo persiste el hash del token.
  INSERT INTO offers (organization_id, gig_id, staff_profile_id, role, amount, conditions,
                      token_hash, expires_at)
  VALUES (v_org, v_gig, p_staff_profile_id, btrim(p_role), p_amount, p_conditions,
          v_hash, v_expires)
  RETURNING id INTO v_offer_id;

  -- 5. El token crudo sale UNA vez (nunca se guarda, nunca se loguea).
  RETURN jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'gig_id', v_gig,
                            'token', v_raw, 'expires_at', v_expires,
                            'organization_id', v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_create_offer(uuid, text, uuid, text, timestamptz, timestamptz, text, numeric, text, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_create_offer(uuid, text, uuid, text, timestamptz, timestamptz, text, numeric, text, int, uuid) TO authenticated;

COMMENT ON FUNCTION public.staff_app_create_offer(uuid, text, uuid, text, timestamptz, timestamptz, text, numeric, text, int, uuid) IS
  'Camino de ESCRITURA de la propuesta. Igual que la 0030 salvo que la organización ya no es un literal: sale de staff_app.resolve_org(p_org) (p_org del caller → org del usuario → org default) y el gate is_org_writer se aplica sobre esa org. Crea el evento al toque si no se eligió uno; valida que evento y ficha sean de la misma org; guarda solo el sha256 del token y devuelve el crudo UNA vez. authenticated only; nunca anon.';

-- ---------------------------------------------------------------------------
-- (9) provision_member — el alta de miembro al loguearse.
--
--     Tenía DOS cosas escritas a mano: la org y la lista de mails habilitados.
--     Ahora la lista es staff_app.member_invites (0035), que además dice a QUÉ
--     org y con qué rol entra cada uno: eso es lo que permite dar de alta al
--     owner de una productora aliada con un INSERT en vez de un deploy.
--
--     La firma NO cambia (sin parámetros), así que acá sí alcanza REPLACE y los
--     grants se mantienen. Se re-emiten igual, por las dudas.
--
--     ⚠️ Fallback deliberado: si la tabla de invitaciones estuviera vacía, los
--     dos mails de Franco siguen entrando a la org default. Nadie se queda
--     afuera de su propia app por un dato faltante.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_provision_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid;
  v_role  text;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN NULL;                                 -- sin sesión
  END IF;

  -- 1. La invitación manda: dice org y rol.
  SELECT i.organization_id, i.role INTO v_org, v_role
    FROM staff_app.member_invites i
   WHERE lower(i.email) = v_email
   LIMIT 1;

  -- 2. Fallback histórico (candado CR-01 original), por si la tabla se vacía.
  IF v_org IS NULL AND v_email IN ('ridaofrancorg@gmail.com', 'franco@somosder.ar') THEN
    v_org  := staff_app.default_org_id();
    v_role := 'owner';
  END IF;

  IF v_org IS NULL THEN
    RETURN NULL;                                 -- no invitado: ni fila ni error
  END IF;

  INSERT INTO staff_app.members (organization_id, user_id, role)
  VALUES (v_org, v_uid, coalesce(v_role, 'writer'))
  ON CONFLICT (organization_id, user_id) DO NOTHING;   -- idempotente

  SELECT m.role INTO v_role
    FROM staff_app.members m
   WHERE m.organization_id = v_org AND m.user_id = v_uid;

  RETURN jsonb_build_object('organization_id', v_org, 'role', v_role);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_provision_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_provision_member() TO authenticated;

COMMENT ON FUNCTION public.staff_app_provision_member() IS
  'Alta de miembro al loguearse. Lee auth.uid()/auth.email() del servidor (el caller no puede pasar un mail) y busca la invitación en staff_app.member_invites: de ahí salen la ORGANIZACIÓN y el ROL, ya no de un literal ni de una lista escrita en el cuerpo. Si no hay invitación devuelve NULL sin error (candado CR-01). Fallback: los dos mails históricos de DER siguen entrando a la org default. Idempotente. authenticated only; nunca anon.';
