-- Migration: staff_app_0076_visibilidad_en_la_red
-- Escrita el 2026-09-05. SIN APLICAR.
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA COLUMNA ES UNA DECISION LEGAL Y NO UNA PREFERENCIA
-- ---------------------------------------------------------------------------
-- Las 1.050 personas del pool se anotaron en el formulario de SOMOS DER.
-- Consintieron que SOMOS DER tenga sus datos para convocarlas a SUS eventos.
-- NO consintieron aparecer en un catalogo que miran otras productoras.
--
-- Abrir el pool a las productoras cliente cambia QUIEN TRATA sus datos. Eso no
-- se arregla con un termino de uso nuevo: el consentimiento se pide antes, no
-- despues. Esta columna es donde vive esa respuesta.
--
-- ⚠️ TRES ESTADOS, NO DOS. El default es NULL, que significa "no contesto", y
-- NO es lo mismo que "dijo que no":
--
--   NULL   no contesto todavia  -> NO se comparte
--   false  dijo que no          -> NO se comparte, y no se le vuelve a preguntar
--   true   dijo que si          -> se comparte
--
-- Las dos primeras se comportan igual hoy, pero hay que poder distinguirlas: a
-- la que no contesto se le puede reenviar la pregunta una vez; a la que dijo
-- que no, nunca. Colapsarlas en un boolean NOT NULL DEFAULT false hace
-- imposible saber a quien se le pregunto y perdio la diferencia para siempre.
--
-- ⚠️ EL SILENCIO NO ES UN SI. Esa es la unica regla que hace que esto sea un
-- consentimiento y no un aviso.

BEGIN;

ALTER TABLE staff_app.staff_profiles
  ADD COLUMN IF NOT EXISTS visible_para_red        boolean,
  ADD COLUMN IF NOT EXISTS visibilidad_respondida_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibilidad_preguntada_at timestamptz;

COMMENT ON COLUMN staff_app.staff_profiles.visible_para_red IS
  'Si la persona acepto que su ficha la vean otras productoras de la red, ademas de la organizacion donde se anoto. TRES ESTADOS: NULL = no contesto (NO se comparte), false = dijo que no (NO se comparte, no se le vuelve a preguntar), true = dijo que si. El silencio NO es un si: sin respuesta explicita la ficha no sale de su organizacion. Se responde por link firmado, sin login (lib/visibilidad.ts).';

COMMENT ON COLUMN staff_app.staff_profiles.visibilidad_preguntada_at IS
  'Cuando se le mando el mail preguntandole. Sirve para no preguntarle dos veces en la misma tanda y para medir la tasa de respuesta.';

COMMENT ON COLUMN staff_app.staff_profiles.visibilidad_respondida_at IS
  'Cuando contesto. Con visible_para_red NULL y esta columna cargada, algo salio mal: son inconsistentes.';

-- Para las tandas de mail y para el catalogo compartido del dia de manana:
-- las que dijeron que si, y las que todavia no se les pregunto.
CREATE INDEX IF NOT EXISTS staff_profiles_visibilidad_idx
  ON staff_app.staff_profiles (visible_para_red, visibilidad_preguntada_at)
  WHERE baja_at IS NULL;

-- ---------------------------------------------------------------------------
-- LA RPC QUE GUARDA LA RESPUESTA
-- ---------------------------------------------------------------------------
-- Mismo molde que staff_app_set_baja: la persona no tiene cuenta ni sesion, asi
-- que el token del link lo valida el servidor (HMAC, lib/visibilidad.ts) ANTES
-- de llamar a esto, y esta funcion solo escribe. Por eso NO esta granteada a
-- anon: la llama el server con service_role, nunca el navegador.
CREATE OR REPLACE FUNCTION public.staff_app_set_visibilidad(p_profile_id uuid, p_quiere boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  UPDATE staff_app.staff_profiles
     SET visible_para_red          = p_quiere,
         visibilidad_respondida_at = now()
   WHERE id = p_profile_id
     AND baja_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_encontrada');
  END IF;

  RETURN jsonb_build_object('ok', true, 'visible', p_quiere);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_set_visibilidad(uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_set_visibilidad(uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.staff_app_set_visibilidad(uuid, boolean) IS
  'Guarda si la persona acepta que su ficha la vean otras productoras. Solo service_role: el gate es el token HMAC del link, que valida el servidor antes de llamar. Granteada a anon seria un endpoint para cambiarle la visibilidad a cualquiera probando UUIDs.';

COMMIT;

-- ---------------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE, A PROPOSITO
-- ---------------------------------------------------------------------------
-- NO abre el pool. No toca la RLS de staff_profiles ni ninguna vista: hoy la
-- ficha sigue siendo visible solo para su organizacion, exactamente igual que
-- antes. Esta columna guarda la RESPUESTA; abrir el catalogo es otra decision y
-- otra migracion, y no se puede tomar hasta saber cuanta gente dijo que si.
--
-- El dia que se abra, el patron ya esta escrito: es el mismo CASE WHEN de la
-- 0074 sobre las vistas, con la condicion "la organizacion que mira no es la
-- duena de la ficha Y visible_para_red no es true".
