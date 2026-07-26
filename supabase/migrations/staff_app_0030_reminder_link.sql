-- ============================================================================
-- staff_app_0030_reminder_link.sql
--
-- EL BOTÓN EN EL MAIL DE "TU PROPUESTA ESTÁ POR VENCER" (pedido de Franco, 26/7).
--
-- ── EL PROBLEMA ──
-- El recordatorio dice "revisá el email de la propuesta que te mandamos y
-- confirmá desde ahí". Franco: "pedirle que busque un mail viejo es una fricción
-- que cuesta respuestas". Tiene razón: el mail que te apura a contestar es
-- justo el que no te deja contestar.
--
-- ── POR QUÉ NO ALCANZABA CON PONER EL LINK ──
-- No es que nadie lo haya pensado: el link ORIGINAL es irrecuperable a propósito.
-- De la oferta se guarda solo `token_hash` (sha256) y el token crudo aparece una
-- sola vez, en el jsonb que devuelve create_offer, que va derecho al mail. Ni la
-- base ni nosotros sabemos cuál era el link. Eso está bien y no se toca: si se
-- filtrara la base, no se filtran los accesos.
--
-- ── LA SALIDA, SIN AFLOJAR NADA ──
-- Un SEGUNDO token, válido en paralelo. El recordatorio genera el suyo, guarda
-- solo su hash en `token_hash_alt` y devuelve el crudo una única vez para el
-- mail. Los dos links funcionan: el del mail original NO se invalida, que era la
-- condición que puso Franco. El crudo sigue sin persistirse nunca.
--
-- Se eligió una columna y no una tabla de tokens porque son exactamente dos
-- momentos (la propuesta y su recordatorio) y no una cantidad abierta.
--
-- ADITIVA: columna nullable + funciones reemplazadas. No toca datos, no toca
-- policies, no afecta a HITO ni a PASE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La columna del segundo token.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.offers
  ADD COLUMN IF NOT EXISTS token_hash_alt text;

COMMENT ON COLUMN staff_app.offers.token_hash_alt IS
  'sha256 hex del SEGUNDO magic link, el que lleva el mail de recordatorio (0030). NULL hasta que sale ese recordatorio. Vale en paralelo con token_hash: el link del mail original NUNCA se invalida. El token crudo no se guarda acá ni en ningún lado, igual que token_hash.';

-- Un token no puede apuntar a dos ofertas.
CREATE UNIQUE INDEX IF NOT EXISTS offers_token_hash_alt_uniq
  ON staff_app.offers (token_hash_alt)
  WHERE token_hash_alt IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. get_public_offer: acepta cualquiera de los dos tokens.
--    Copia exacta de la 0003, cambiando SOLO la condición del WHERE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staff_app.get_public_offer(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, pg_temp
AS $$
DECLARE
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_rec  record;
BEGIN
  SELECT o.id, o.role, o.amount, o.conditions, o.status, o.expires_at,
         g.title AS gig_title, g.starts_at, g.ends_at, g.venue_name,
         org.name AS org_name,
         split_part(sp.nombre, ' ', 1) AS first_name
    INTO v_rec
    FROM offers o
    JOIN gigs g            ON g.id   = o.gig_id
    JOIN organizations org ON org.id = o.organization_id
    JOIN staff_profiles sp ON sp.id  = o.staff_profile_id
   -- 0030: el token del recordatorio vale igual que el original.
   WHERE o.token_hash = v_hash
      OR o.token_hash_alt = v_hash;

  IF NOT FOUND THEN
    RETURN NULL;                       -- non-matching token: no row leak
  END IF;

  IF v_rec.status = 'sent' THEN        -- first view flips sent -> viewed
    UPDATE offers SET status = 'viewed', viewed_at = now() WHERE id = v_rec.id;
    v_rec.status := 'viewed';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'offer', jsonb_build_object(
       'role',       v_rec.role,
       'amount',     v_rec.amount,
       'conditions', v_rec.conditions,
       'status',     v_rec.status,
       'expires_at', v_rec.expires_at),
    'gig', jsonb_build_object(
       'title',     v_rec.gig_title,
       'starts_at', v_rec.starts_at,
       'ends_at',   v_rec.ends_at,
       'venue',     v_rec.venue_name),
    'org',       jsonb_build_object('name', v_rec.org_name),
    'applicant', jsonb_build_object('first_name', v_rec.first_name)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. El recordatorio ahora devuelve un token usable.
--
--    Sigue siendo exactly-once: reminded_at se estampa en la MISMA sentencia que
--    selecciona, así que una segunda corrida no devuelve nada y no genera un
--    tercer token. Y sigue sin tocar token_hash: el original vive.
-- ---------------------------------------------------------------------------
-- ⚠️ El RETURNS TABLE cambia (se suma la columna `token`), y Postgres NO deja
-- cambiar el tipo de retorno con CREATE OR REPLACE: hay que DROPear primero o la
-- migración tira "cannot change return type of existing function". Es el mismo
-- tipo de trampa que la lista de columnas de la vista en la 0026.
DROP FUNCTION IF EXISTS public.staff_app_offers_due_reminder(int);

CREATE OR REPLACE FUNCTION public.staff_app_offers_due_reminder(p_within_days int DEFAULT 2)
RETURNS TABLE(offer_id uuid, email text, first_name text, gig_title text, role text, expires_at timestamptz, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- fixed SOMOS DER org (D-05), never from input
BEGIN
  -- Igual que la 0010: el UPDATE estampa reminded_at y devuelve las filas que
  -- tocó, todo en la misma sentencia, así que una segunda corrida no re-selecciona
  -- (exactly-once). Lo ÚNICO que cambia en 0030 es que además escribe
  -- token_hash_alt y devuelve el token crudo, que viaja en el RETURN y no queda
  -- guardado en ningún lado. token_hash NO se toca: el link original sigue vivo.
  RETURN QUERY
  -- Un token POR FILA. Ojo con la tentación de generarlo en el UPDATE con un
  -- FROM (SELECT gen_random_bytes(...)): esa subconsulta no está correlacionada,
  -- se evalúa UNA vez y le pone el MISMO token a todas las ofertas de la tanda,
  -- que además hace saltar el índice único. Acá se genera dentro del SELECT, que
  -- sí se evalúa fila por fila porque gen_random_bytes es VOLATILE.
  WITH cand AS (
    SELECT o.id, encode(extensions.gen_random_bytes(32), 'hex') AS raw
      FROM staff_app.offers o
      JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id
     WHERE o.organization_id = v_org
       AND o.status IN ('sent','viewed')
       AND o.reminded_at IS NULL
       AND o.expires_at > now()
       AND o.expires_at <= now() + make_interval(days => greatest(1, p_within_days))
       -- El que pidió la baja no recibe nada, ni siquiera un recordatorio (0026).
       AND sp.baja_at IS NULL
  ),
  due AS (
    UPDATE staff_app.offers o
       SET reminded_at    = now(),
           token_hash_alt = encode(extensions.digest(c.raw, 'sha256'), 'hex')
      FROM cand c
     -- El reminded_at IS NULL va TAMBIÉN acá, no solo en cand: es lo que sostiene
     -- el exactly-once. Si dos corridas se pisan, la segunda espera el lock de la
     -- fila y al liberarse re-evalúa esta condición, ve reminded_at ya escrito y
     -- no actualiza. Sin esta línea, la tanda podría salir dos veces.
     WHERE o.id = c.id
       AND o.reminded_at IS NULL
    RETURNING o.id, o.gig_id, o.staff_profile_id, o.role, o.expires_at, c.raw
  )
  SELECT d.id, sp.email, sp.nombre, g.title, d.role, d.expires_at, d.raw
  FROM due d
  JOIN staff_app.gigs g ON g.id = d.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = d.staff_profile_id;
END;
$$;

-- Mismo blindaje que tenía: solo el cron.
REVOKE ALL ON FUNCTION public.staff_app_offers_due_reminder(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_offers_due_reminder(int) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. create_offer ahora devuelve TAMBIÉN expires_at.
--
--    Es para el mail de la propuesta: hoy no dice hasta cuándo hay tiempo para
--    contestar, que es una de las tres preguntas que cualquiera se hace antes de
--    decir que sí (las otras dos son dónde es y cuándo se paga). El dato ya
--    existía en la tabla, simplemente no salía del RPC.
--
--    Sumar una clave al jsonb de retorno es aditivo: quien no la lea sigue igual.
--    El resto de la función queda EXACTAMENTE como estaba, incluido que el token
--    crudo se devuelve una sola vez y no se persiste.
-- ---------------------------------------------------------------------------
-- ⚠️ La firma queda IDÉNTICA a la de la 0008, con los 10 parámetros y en el mismo
-- orden (ojo con p_gig_ends_at: si se lo saltea, Postgres no reemplaza nada, crea
-- una función NUEVA con otra firma y quedan dos conviviendo). El cuerpo también es
-- el de la 0008 tal cual. Lo ÚNICO que cambia es que expires_at sale a una variable
-- para poder devolverlo en el jsonb final.
CREATE OR REPLACE FUNCTION public.staff_app_create_offer(
  p_staff_profile_id uuid,
  p_role             text,
  p_gig_id           uuid        DEFAULT NULL,   -- pick: existing gig
  -- quick-create fields (used ONLY when p_gig_id IS NULL):
  p_gig_title        text        DEFAULT NULL,
  p_gig_starts_at    timestamptz DEFAULT NULL,
  p_gig_ends_at      timestamptz DEFAULT NULL,
  p_gig_venue        text        DEFAULT NULL,
  p_amount           numeric     DEFAULT NULL,
  p_conditions       text        DEFAULT NULL,
  p_expires_in_days  int         DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org      uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';       -- fixed SOMOS DER org (D-05)
  v_gig      uuid := p_gig_id;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');       -- 256-bit, 64 hex
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');    -- sha256 hex, matches 0003
  v_offer_id uuid;
  -- 0030: antes se calculaba inline dentro del INSERT. Sale acá para poder
  -- devolverlo, que es lo que le permite al mail decir hasta cuándo hay tiempo.
  v_expires  timestamptz := now() + make_interval(days => greatest(1, p_expires_in_days));
BEGIN
  -- 1. Writer gate. auth.uid() is preserved inside SECURITY DEFINER, so this is
  --    the REAL caller (T-3-05). anon can never reach here (WR-05 grants below).
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(btrim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  -- 2. Quick-create the gig atomically if no existing gig was picked. Same
  --    transaction as the offer insert → no orphan gig, no race (Pitfall 5).
  IF v_gig IS NULL THEN
    IF coalesce(btrim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, btrim(p_gig_title), p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    -- Validate the picked gig belongs to the org (RLS does not apply here; T-3-02).
    PERFORM 1 FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
  END IF;

  -- 3. Validate the candidate belongs to the org (T-3-02).
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 4. Insert the offer. status relies on the table DEFAULT 'sent'; expires_at is
  --    forced to a future timestamp (>= 1 day). Only token_hash persists (T-3-03).
  INSERT INTO offers (organization_id, gig_id, staff_profile_id, role, amount, conditions,
                      token_hash, expires_at)
  VALUES (v_org, v_gig, p_staff_profile_id, btrim(p_role), p_amount, p_conditions,
          v_hash, v_expires)
  RETURNING id INTO v_offer_id;

  -- 5. Return the raw token ONCE (never persisted, never logged).
  --    0030 suma expires_at. Es aditivo: quien no lo lea sigue funcionando igual.
  RETURN jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'gig_id', v_gig,
                            'token', v_raw, 'expires_at', v_expires);
END;
$$;

COMMENT ON FUNCTION public.staff_app_offers_due_reminder(int) IS
  'Recordatorio de propuesta por vencer. Devuelve las ofertas por vencer y estampa reminded_at en la MISMA sentencia (exactly-once). 0030: ahora genera un SEGUNDO token, guarda su hash en token_hash_alt y devuelve el crudo una sola vez, para que el mail pueda llevar botón. NO toca token_hash: el link del mail original sigue valiendo. Excluye a quien pidió la baja. service_role EXECUTE only.';
