-- staff_app_0067_un_salon_se_publica_por_capacidad
--
-- LA PUERTA DE UNA SOLA DIRECCION.
--
-- `proveedor_set_publicado` exige, para publicar, que el perfil tenga al menos
-- un servicio activo con provincias. Un salon NO tiene servicios: la 0064
-- decidio a proposito no darle `provider_services`, porque lo suyo es la
-- capacidad y no un catalogo de rubros.
--
-- Resultado, medido: el alta (0064) publica al salon escribiendo `is_public =
-- true` directo en el INSERT, asi que nace publicado y todo parece andar. Pero
-- el dia que el dueño toca "despublicarme" para corregir algo, ya no puede
-- volver: `faltan: ['servicios']` para siempre. Un salon se apagaba solo y la
-- unica salida era editar la base a mano.
--
-- Es el peor tipo de bug de los que estuvimos viendo: no falla al hacerlo, falla
-- despues, le pasa a UNA persona que no puede explicarlo, y no deja rastro en
-- ningun log porque la funcion contesta ok=false con su razon, como debe.
--
-- ── QUE SE PIDE PARA PUBLICAR, POR TIPO ─────────────────────────────────────
-- La regla de fondo es la misma para los dos, y no es "tener los campos
-- llenos": es NO PUBLICAR A ALGUIEN INVISIBLE. Un perfil que no puede aparecer
-- en ninguna busqueda esta peor publicado que despublicado, porque ocupa un
-- lugar en el directorio y no recibe una sola consulta.
--
--   proveedor  → nombre + un servicio activo + provincias en ese servicio
--                (se busca por rubro y por provincia)
--   salon      → nombre + provincia + capacidad
--                (se busca por cuanta gente entra y donde queda, que son los
--                 dos filtros de staff_app_vidriera_salones)
--
-- Los codigos nuevos que puede devolver `faltan` son 'provincia' y 'capacidad'.
-- El front los traduce en FALTA_COPY; si alguna vez aparece uno sin traducir,
-- `textoFalta` ya tiene su fallback honesto.

CREATE OR REPLACE FUNCTION staff_app.proveedor_set_publicado(
  p_profile_id uuid, p_publicar boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $$
DECLARE
  v_p             marketplace_profiles%ROWTYPE;
  v_faltan        text[] := '{}';
  v_con_servicio  boolean;
  v_con_provincia boolean;
  v_cap           int;
BEGIN
  -- Despublicarse NUNCA pide requisitos. Bajarse tiene que poder hacerse
  -- siempre, incluso con el perfil a medias: es el freno de mano del dueño.
  IF NOT coalesce(p_publicar, false) THEN
    UPDATE marketplace_profiles
       SET is_public = false, updated_at = now()
     WHERE id = p_profile_id;
    RETURN jsonb_build_object('ok', true, 'is_public', false);
  END IF;

  SELECT * INTO v_p FROM marketplace_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inexistente');
  END IF;

  -- El nombre lo piden los dos: sin nombre no hay ficha que mostrar.
  IF coalesce(btrim(v_p.display_name), '') = '' THEN
    v_faltan := array_append(v_faltan, 'nombre');
  END IF;

  IF v_p.tipo = 'salon' THEN
    SELECT capacidad_max INTO v_cap FROM venue_details WHERE profile_id = p_profile_id;

    IF coalesce(btrim(v_p.provincia), '') = '' THEN
      v_faltan := array_append(v_faltan, 'provincia');
    END IF;
    IF v_cap IS NULL OR v_cap <= 0 THEN
      v_faltan := array_append(v_faltan, 'capacidad');
    END IF;
  ELSE
    SELECT EXISTS (SELECT 1 FROM provider_services s
                    WHERE s.profile_id = p_profile_id AND s.activo)
      INTO v_con_servicio;

    SELECT EXISTS (
             SELECT 1 FROM provider_services s
              WHERE s.profile_id = p_profile_id
                AND s.activo
                AND array_length(s.provincias, 1) > 0
           )
      INTO v_con_provincia;

    -- array_append y NUNCA el operador ||: con un literal sin tipo, Postgres
    -- intenta castearlo a text[] y revienta con 22P02. Bug de la 0042 que paso
    -- typecheck, lint y build, corregido en la 0043.
    IF NOT v_con_servicio THEN
      v_faltan := array_append(v_faltan, 'servicios');
    END IF;

    IF v_con_servicio AND NOT v_con_provincia THEN
      v_faltan := array_append(v_faltan, 'provincias');
    END IF;
  END IF;

  IF array_length(v_faltan, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'faltan_datos',
                              'faltan', to_jsonb(v_faltan));
  END IF;

  UPDATE marketplace_profiles
     SET is_public = true, updated_at = now()
   WHERE id = p_profile_id;

  RETURN jsonb_build_object('ok', true, 'is_public', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
