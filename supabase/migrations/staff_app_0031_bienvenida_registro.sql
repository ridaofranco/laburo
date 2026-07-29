-- staff_app_0031_bienvenida_registro
-- RPC para estampar bienvenida_enviada_at cuando la bienvenida se manda EN EL
-- MOMENTO del registro (/sumate), y no por la tanda del cron.
--
-- POR QUÉ EXISTE: desde el 29/7 el registro nuevo por /sumate manda el welcome
-- corto al toque (decisión de Franco). La tanda a los 699 (cron /api/cron/bienvenida)
-- selecciona fichas con bienvenida_enviada_at IS NULL, así que sin estampar acá,
-- el que se registró hoy y ya recibió su bienvenida recibiría DESPUÉS el mail
-- largo de la tanda: dos bienvenidas distintas a la misma persona.
--
-- CONTRATO: solo estampa si estaba en NULL (no pisa la marca de la tanda) y
-- devuelve si estampó. El caller lo llama SOLO cuando el envío del welcome
-- salió ok: si el mail falló, la ficha queda en NULL a propósito y la tanda la
-- agarra más adelante como red de seguridad.
--
-- Aditiva: no toca datos existentes, ni vistas, ni nada de HITO o PASE.

CREATE OR REPLACE FUNCTION public.staff_app_mark_bienvenida(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
BEGIN
  UPDATE staff_app.staff_profiles
     SET bienvenida_enviada_at = now()
   WHERE id = p_profile_id
     AND bienvenida_enviada_at IS NULL;
  RETURN FOUND;
END;
$$;

-- service_role EXECUTE solo: la llama el server action de /sumate con el admin
-- client. anon/authenticated revocados porque muta estado del pool.
REVOKE ALL ON FUNCTION public.staff_app_mark_bienvenida(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_mark_bienvenida(uuid) TO service_role;

COMMENT ON FUNCTION public.staff_app_mark_bienvenida(uuid) IS
  'Estampa bienvenida_enviada_at=now() en la ficha si estaba NULL (el welcome se mandó al registrarse por /sumate). Devuelve si estampó. service_role EXECUTE solo; evita que la tanda del cron le mande una segunda bienvenida a quien ya la recibió en el registro.';
