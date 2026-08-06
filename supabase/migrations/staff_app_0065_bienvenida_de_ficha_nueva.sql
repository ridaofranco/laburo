-- ---------------------------------------------------------------------------
-- LA BIENVENIDA DEL QUE SE ANOTA POR somosder.ar (6/8/2026)
--
-- EL AGUJERO, MEDIDO: de 1.020 personas en el pool, SOLO 2 habían recibido un
-- mail alguna vez. El que se anota por LABURO recibe la bienvenida al toque,
-- pero el que se anota por somosder.ar no recibía NADA: esa web guarda la ficha
-- llamando staff_app_register_applicant desde el navegador y ahí termina. Se
-- anotaban, no les llegaba nada, y no tenían forma de enterarse de que existe
-- una app donde entrar. La tanda del cron (0025) era la red de seguridad, pero
-- está apagada y encima manda el mail LARGO, el del pool viejo.
--
-- ESTA FUNCIÓN es lo que /api/bienvenida de LABURO usa para responder una sola
-- pregunta: "esta ficha recién creada, ¿todavía no recibió nada?". Devuelve el
-- mail y el nombre, o nada.
--
-- ── POR QUÉ NO MARCA ACÁ, A DIFERENCIA DE staff_app_welcome_batch ────────────
-- La tanda estampa bienvenida_enviada_at en la MISMA sentencia que selecciona,
-- y asume el trade-off de perder alguna bienvenida antes que mandar dos: con
-- 1.018 fichas, un loop que le escriba a la misma persona todos los días es
-- mucho peor que una que se pierda.
--
-- Acá el cálculo se da vuelta. Esto corre para UNA ficha, en el momento en que
-- la persona se acaba de anotar. Si marcáramos antes de mandar y el envío
-- fallara, esa persona no recibiría nada NUNCA (la tanda ya no la ve, porque
-- está marcada), que es exactamente el agujero que vinimos a tapar. El peor
-- caso de no marcar acá es que reciba el mail dos veces, y eso es molesto pero
-- no la deja afuera. Marca el que llama, DESPUÉS de que el envío salió bien,
-- con staff_app_mark_bienvenida (0031).
--
-- ── LOS TRES CANDADOS ───────────────────────────────────────────────────────
--   * Solo fichas de la org de SOMOS DER, constante fija, nunca de parámetro.
--   * Solo si bienvenida_enviada_at IS NULL: no sirve para reenviar.
--   * Solo fichas creadas hace menos de 30 minutos. Esto es lo que hace que el
--     uuid de la ficha alcance como permiso del lado de la route: pasada la
--     media hora no se puede despertar a nadie desde afuera, y el pool viejo
--     queda fuera de alcance por definición.
--
-- SEGURIDAD: SECURITY DEFINER con search_path fijo, igual que las 16 del
-- barrido del 25/7. Y REVOKE EXPLÍCITO a anon y authenticated: toda función
-- nueva en public nace con EXECUTE para anon, y esta devuelve un mail (PII).
-- Un REVOKE FROM PUBLIC solo NO le saca el permiso a anon.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_app_bienvenida_ficha_nueva(p_profile_id uuid)
RETURNS TABLE(profile_id uuid, email text, first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
  SELECT
    sp.id,
    sp.email,
    split_part(btrim(coalesce(sp.nombre, '')), ' ', 1)
  FROM staff_app.staff_profiles sp
  WHERE sp.id = p_profile_id
    AND sp.organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'::uuid
    AND sp.bienvenida_enviada_at IS NULL
    AND sp.email IS NOT NULL
    AND btrim(sp.email) <> ''
    AND sp.created_at > now() - interval '30 minutes'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.staff_app_bienvenida_ficha_nueva(uuid) IS
  'Devuelve mail y nombre de pila de una ficha RECIEN creada que todavia no recibio la bienvenida, o nada. La usa /api/bienvenida de LABURO, que es lo que llama somosder.ar despues de registrar a alguien: hasta el 6/8 el que se anotaba por la web no recibia ningun mail (2 de 1.020 fichas del pool tenian bienvenida). NO marca: el que llama estampa bienvenida_enviada_at con staff_app_mark_bienvenida despues de que el envio salio, porque marcar antes dejaria a esa persona sin recibir nada nunca si el mail falla. Ventana de 30 minutos: es el candado que hace que el uuid de la ficha alcance como permiso.';

REVOKE ALL ON FUNCTION public.staff_app_bienvenida_ficha_nueva(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_bienvenida_ficha_nueva(uuid) TO service_role;
