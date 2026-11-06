-- 0106 · Búsqueda dudosa queda EN REVISIÓN (Franco 31/10, plan fase 2 punto 7).
-- Aditiva: solo una función nueva. El filtro de palabras vive en lib/filtro-avisos.ts;
-- cuando una búsqueda es dudosa (no prohibida), el servidor la crea y la deja bajada
-- con moderada_at/moderada_motivo (0054): no se ve en el listado público y aparece en
-- /plataforma, donde «Volver a publicar» es la aprobación. Solo service_role.
CREATE OR REPLACE FUNCTION public.staff_app_busqueda_a_revision(p_opening_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  UPDATE staff_app.gig_openings
     SET moderada_at = now(),
         moderada_motivo = left(coalesce(nullif(btrim(p_motivo), ''), 'En revisión'), 300)
   WHERE id = p_opening_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'inexistente'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_busqueda_a_revision(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_busqueda_a_revision(uuid, text) TO service_role;
