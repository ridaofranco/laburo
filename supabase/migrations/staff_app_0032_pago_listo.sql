-- Migration: staff_app_0032_pago_listo
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- ⚠️ NO APLICADA TODAVÍA (29/7/2026): va como archivo, la aplica Franco a mano
-- en el SQL editor (o Claude por MCP con su OK). Aditiva: una columna nullable,
-- un REPLACE de vista con columna al final y una función nueva. No toca datos
-- ni nada de HITO o PASE.
--
-- PARA QUÉ: el mail "Tu pago está listo". La política real de pago dice que se
-- coordina con SOMOS DER dentro de los 10 días hábiles de realizado el trabajo
-- (PAGO_TEXTO, ahora en lib/pago.ts). Hasta hoy, cuando Franco efectivamente
-- coordina o hace el pago, la persona NO se entera por ningún lado: se entera
-- cuando le llega la plata o cuando pregunta por WhatsApp. Este es el mail que
-- cierra ese ciclo, y este archivo le da el estado del que colgarlo.
--
-- DÓNDE VIVE EL ESTADO: en staff_app.offers (la oferta ACEPTADA), no en crew.
-- Se evaluó crew (nace al aceptar), pero el monto comprometido vive en
-- offers.amount y la pantalla /pagos ya lista exactamente esas filas
-- (status = 'accepted'): el botón "avisar que el pago está listo" se agrega
-- ahí, una fila = una oferta aceptada = un pago.
--
-- TRES objetos:
--   (1) offers.pago_listo_at — cuándo se avisó que el pago está listo. Es a la
--       vez el estado ("ya está coordinado/hecho") y el ancla exactly-once del
--       mail: NULL = no se avisó; la RPC solo estampa si está NULL.
--   (2) REPLACE de public.staff_app_offers agregando pago_listo_at AL FINAL
--       (regla de 0010/0026: solo append, jamás reordenar ni sacar columnas).
--   (3) public.staff_app_marcar_pago_listo(p_offer_id) — estampa y devuelve lo
--       que el mail necesita (email, nombre, evento, monto). service_role-only:
--       devuelve email (PII, modelo broker) y muta estado. El server action que
--       la llama gatea membresía ANTES (patrón de offer-actions).
--
-- SEGURIDAD: SECURITY DEFINER con search_path pineado, org forzada por
-- constante, REVOKE explícito de public/anon/authenticated.

-- ---------------------------------------------------------------------------
-- (1) La columna. Nullable, sin default: NULL = el pago todavía no se avisó.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_app.offers
  ADD COLUMN IF NOT EXISTS pago_listo_at timestamptz;

COMMENT ON COLUMN staff_app.offers.pago_listo_at IS
  'Cuándo se le avisó a la persona que su pago quedó coordinado/hecho (mail "Tu pago está listo"). NULL = no se avisó. Lo estampa public.staff_app_marcar_pago_listo solo si estaba NULL y la oferta está accepted: exactly-once, el botón apretado dos veces no manda dos mails. Solo aplica a ofertas aceptadas: es el cierre del ciclo laburo hecho → pago coordinado.';

-- ---------------------------------------------------------------------------
-- (2) La vista del board/pagos, con pago_listo_at AL FINAL. Lista de columnas
--     de 0010 verbatim (Postgres no deja reordenar/sacar en CREATE OR REPLACE).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.staff_app_offers WITH (security_invoker = true) AS
  SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
         o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
         g.title AS gig_title, o.organization_id,
         sp.nombre   AS staff_nombre,
         sp.apellido AS staff_apellido,
         o.pago_listo_at
  FROM staff_app.offers o
  JOIN staff_app.gigs g ON g.id = o.gig_id
  JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id;

-- Re-aplicados tras el REPLACE, como en 0010/0026.
GRANT SELECT ON public.staff_app_offers TO authenticated;
REVOKE ALL ON public.staff_app_offers FROM anon;

-- ---------------------------------------------------------------------------
-- (3) La RPC: estampa exactly-once y devuelve los datos del mail.
--     Respuestas: {ok:false, reason:'not_found'|'not_accepted'} ·
--     {ok:true, already:true} (ya estaba avisado, NO reenviar) ·
--     {ok:true, email, first_name, staff_nombre, staff_apellido, gig_title, role, amount}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_marcar_pago_listo(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';   -- org fija SOMOS DER, nunca de input
  v_row record;
BEGIN
  -- Estampa solo si accepted y sin avisar: exactly-once en la misma sentencia.
  UPDATE staff_app.offers o
     SET pago_listo_at = now()
   WHERE o.id = p_offer_id
     AND o.organization_id = v_org
     AND o.status = 'accepted'
     AND o.pago_listo_at IS NULL
  RETURNING o.id, o.role, o.amount, o.gig_id, o.staff_profile_id
    INTO v_row;

  IF v_row.id IS NULL THEN
    -- Distinguir por qué no estampó, para que la UI conteste con la verdad.
    IF EXISTS (SELECT 1 FROM staff_app.offers o
                WHERE o.id = p_offer_id AND o.organization_id = v_org
                  AND o.status = 'accepted' AND o.pago_listo_at IS NOT NULL) THEN
      RETURN jsonb_build_object('ok', true, 'already', true);
    ELSIF EXISTS (SELECT 1 FROM staff_app.offers o
                   WHERE o.id = p_offer_id AND o.organization_id = v_org) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_accepted');
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
  END IF;

  -- Los datos del mail. OJO: NO se filtra por baja_at a propósito. Este mail es
  -- TRANSACCIONAL (le avisa de SU plata por SU trabajo), no marketing: alguien
  -- que trabajó y después pidió la baja del pool igual tiene que enterarse de
  -- que su pago está listo.
  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'email', sp.email,
      'first_name', split_part(coalesce(sp.nombre, ''), ' ', 1),
      'staff_nombre', sp.nombre,
      'staff_apellido', sp.apellido,
      'gig_title', g.title,
      'role', v_row.role,
      'amount', v_row.amount
    )
    FROM staff_app.staff_profiles sp
    LEFT JOIN staff_app.gigs g ON g.id = v_row.gig_id
    WHERE sp.id = v_row.staff_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_marcar_pago_listo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_pago_listo(uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_marcar_pago_listo(uuid) IS
  'Estampa offers.pago_listo_at=now() (solo si accepted y NULL: exactly-once) y devuelve email, nombre, evento, rol y monto para el mail "Tu pago está listo". Si ya estaba avisado devuelve {ok:true, already:true} y el caller NO reenvía. No filtra baja_at: el aviso de pago es transaccional, no marketing. service_role EXECUTE solo (PII + mutación); el server action gatea membresía antes de llamarla.';
