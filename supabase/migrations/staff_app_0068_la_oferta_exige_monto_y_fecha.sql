-- staff_app_0068_la_oferta_exige_monto_y_fecha
--
-- LO QUE FRENA EL NAVEGADOR NO LO FRENA NADIE MAS.
--
-- `staff_app_create_offer` (0036) valida el rol y valida que haya evento, pero
-- NUNCA mira `p_amount` ni `p_gig_starts_at`. El formulario de /staff/[id]/oferta
-- si los exige, asi que en la practica no se veian ofertas rotas y el agujero
-- parecia cerrado. No lo estaba: una server action es un endpoint POST
-- invocable, y llamandola directo se podia crear una oferta con monto NULL sobre
-- un evento sin fecha.
--
-- Que sale de ahi, y por eso importa: la propuesta que le llega al candidato es
-- literalmente "te ofrezco un laburo" sin plata y sin dia. Es la peor version
-- posible del producto, y la persona la juzga una sola vez.
--
-- ── DONDE VAN LAS GUARDAS, Y POR QUE AHI ────────────────────────────────────
-- Las dos van ARRIBA, antes de crear nada.
--
-- El monto se chequea junto al rol, antes del bloque de quick-create. Si fuera
-- despues, el INSERT en `gigs` ya habria pasado y quedaria un evento huerfano en
-- la base cada vez que alguien manda una oferta sin plata. Es exactamente lo que
-- la propia funcion explica que vino a evitar cuando decidio crear el evento en
-- la MISMA transaccion.
--
-- La fecha tiene dos ramas y hay que cubrir las dos, igual que hace el
-- formulario:
--   * quick-create (no eligio evento): se valida `p_gig_starts_at` antes del
--     INSERT, junto al `gig_required` que ya estaba.
--   * evento elegido: el chequeo de pertenencia era un `PERFORM 1`, que no traia
--     ningun dato. Pasa a ser un `SELECT starts_at INTO v_starts`, que setea
--     FOUND igual (asi el `gig_not_found` sigue funcionando tal cual) y ademas
--     deja la fecha a mano para mirarla. Un evento existente sin `starts_at` es
--     posible: el quick-create de antes de esta migracion los creaba asi.
--
-- Motivos nuevos que puede devolver: 'amount_required' y 'gig_starts_at_required'.
-- Los traduce a castellano `app/(portal)/staff/[id]/offer-actions.ts`, que hasta
-- hoy pintaba el codigo crudo en pantalla.
--
-- La firma NO cambia (los mismos 11 parametros), asi que alcanza con
-- CREATE OR REPLACE y los grants se mantienen. Se re-emiten igual junto con el
-- COMMENT, por las dudas, como hace la 0036.

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
  v_starts   timestamptz;   -- 0068: la fecha del evento elegido, para exigirla
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_org');
  END IF;

  -- 1. Writer gate. auth.uid() se preserva dentro de SECURITY DEFINER, asi que
  --    este es el caller REAL. anon nunca llega (grants de abajo).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(btrim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  -- 1b. (0068) El monto, ANTES del quick-create. Una propuesta sin plata no es
  --     una propuesta. Si este chequeo fuera mas abajo, el evento ya estaria
  --     insertado y quedaria huerfano.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_required');
  END IF;

  -- 2. Si no eligio evento, se crea al toque en la MISMA transaccion que la
  --    propuesta: no queda evento huerfano ni carrera posible.
  IF v_gig IS NULL THEN
    IF coalesce(btrim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    -- (0068) Sin fecha no se crea el evento: la propuesta diria "algun dia".
    IF p_gig_starts_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_starts_at_required');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, btrim(p_gig_title), p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    -- El evento elegido tiene que ser de esta org (la RLS no aplica en definer).
    -- (0068) El PERFORM pasa a SELECT INTO: setea FOUND igual y ademas trae la
    -- fecha, que es lo que hay que exigir en el renglon de abajo.
    SELECT starts_at INTO v_starts FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
    IF v_starts IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_starts_at_required');
    END IF;
  END IF;

  -- 3. Y la ficha tambien.
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
  'Camino de ESCRITURA de la propuesta. La organizacion sale de staff_app.resolve_org(p_org) y el gate is_org_writer se aplica sobre esa org. Crea el evento al toque si no se eligio uno; valida que evento y ficha sean de la misma org; guarda solo el sha256 del token y devuelve el crudo UNA vez. Desde la 0068 exige ademas monto mayor a cero (amount_required) y fecha de inicio del evento en las dos ramas, quick-create y evento elegido (gig_starts_at_required): lo que frenaba el formulario ahora lo frena la base. authenticated only; nunca anon.';
