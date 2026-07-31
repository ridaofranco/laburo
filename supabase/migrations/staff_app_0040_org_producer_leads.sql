-- ===========================================================================
-- 0040 — LOS LEADS DE PRODUCTOR DEJAN DE TENER LA ORGANIZACIÓN ESCRITA A MANO
-- ===========================================================================
--
-- POR QUÉ EXISTE ESTA MIGRACIÓN
--
-- La 0039 (leads de productor, 30/7) nació con el UUID de SOMOS DER escrito
-- adentro de sus dos funciones. Estaba anotado como deuda en el propio archivo
-- y en PLAN-DESHARCODEAR-ORG.md, con una condición explícita:
--
--     "al aplicar las 0035-0038, ESTA FUNCIÓN Y staff_app_marcar_lead_estado
--      TIENEN QUE PASAR A staff_app.resolve_org(), o el marketplace
--      multi-productora nace con la fuga."
--
-- Esta es esa migración. Va DESPUÉS de la 0038 porque usa las piezas que la
-- 0035 crea (`default_org_id`, `org_id_by_slug`, `resolve_org`).
--
-- LAS DOS FUGAS QUE CIERRA, si mañana entra una segunda productora:
--
--   F6  staff_app_registrar_lead_productor
--       La landing pública guardaba el lead con `organization_id = <constante
--       DER>` sin mirar de qué productora venía el formulario. Si la
--       productora B publica su propia landing, TODAS sus consultas de clientes
--       (nombre, empresa, mail, teléfono y el texto del pedido) caen en la
--       bandeja de DER. B no ve ninguna. Es el mismo agujero que tenía
--       `staff_app_register_applicant` con el pool de personal (F5), pero del
--       lado de la demanda: en vez de fugarse el inventario, se fuga el cliente.
--
--   F7  staff_app_marcar_lead_estado
--       El gate `is_org_writer(<constante DER>)` se evaluaba siempre contra DER,
--       y el UPDATE filtraba por esa misma constante. Con dos productoras eso
--       da dos resultados igual de malos: un writer de B no puede mover NINGÚN
--       lead propio (siempre `forbidden`), y el filtro del UPDATE lo mandaría
--       contra filas de DER. Queda gateado contra la org del lead de verdad.
--
-- QUÉ NO CAMBIA HOY (por eso se puede aplicar sin avisarle a nadie)
--
-- Con una sola organización, `resolve_org(NULL)` y `default_org_id()` devuelven
-- exactamente el mismo UUID que estaba escrito a mano. El comportamiento es
-- idéntico: mismos leads, misma bandeja, mismos permisos. Lo único que cambia
-- es de dónde sale el valor.
--
-- COMPATIBILIDAD DE FIRMA
--
-- `staff_app_registrar_lead_productor` suma `p_org_slug` como ÚLTIMO parámetro
-- y con DEFAULT NULL, calcado de `staff_app_register_applicant` en la 0038. El
-- llamador actual (`app/landing/actions.ts`) lo invoca por nombre de parámetro
-- y sin ese campo, así que sigue funcionando sin tocar una línea de TypeScript.
-- `staff_app_marcar_lead_estado` no cambia de firma.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- (1) Alta del lead desde una landing pública, con la productora que corresponda
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_registrar_lead_productor(
  p_nombre   text,
  p_email    text,
  p_mensaje  text,
  p_telefono text DEFAULT NULL,
  p_empresa  text DEFAULT NULL,
  p_origen   text DEFAULT 'landing',
  p_org_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_id  uuid;
BEGIN
  IF coalesce(btrim(p_nombre), '') = ''
     OR coalesce(btrim(p_email), '') = ''
     OR coalesce(btrim(p_mensaje), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'datos_incompletos');
  END IF;

  -- Sin slug: la organización default (hoy y siempre que la landing de LABURO
  -- sea la de DER). Con slug: esa productora, y si no existe se corta acá y no
  -- se guarda nada. Nunca cae en la org equivocada "por las dudas".
  IF p_org_slug IS NULL OR btrim(p_org_slug) = '' THEN
    v_org := staff_app.default_org_id();
  ELSE
    v_org := staff_app.org_id_by_slug(p_org_slug);
    IF v_org IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'organizacion_desconocida');
    END IF;
  END IF;

  -- Fail-closed: si no hay org default configurada, no se inventa una.
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sin_organizacion');
  END IF;

  INSERT INTO producer_leads (
    organization_id, nombre, empresa, email, telefono, mensaje, origen
  ) VALUES (
    v_org,
    left(btrim(p_nombre), 120),
    nullif(left(btrim(coalesce(p_empresa, '')), 160), ''),
    -- lowercase por la misma razón que el registro de staff: si el mismo
    -- productor vuelve a consultar, las dos filas se agrupan a ojo por mail.
    lower(left(btrim(p_email), 200)),
    nullif(left(btrim(coalesce(p_telefono, '')), 60), ''),
    left(btrim(p_mensaje), 2000),
    coalesce(nullif(btrim(p_origen), ''), 'landing')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- La firma vieja (6 argumentos) queda huérfana: PostgreSQL la trata como otra
-- función por sobrecarga. Se borra para que no queden dos caminos y uno con el
-- UUID adentro. Se hace DESPUÉS de crear la nueva, así no hay una ventana en la
-- que el formulario no tenga a quién llamar.
DROP FUNCTION IF EXISTS public.staff_app_registrar_lead_productor(text, text, text, text, text, text);

REVOKE ALL ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.staff_app_registrar_lead_productor(text, text, text, text, text, text, text) IS
  'Guarda una consulta de productor de la landing en staff_app.producer_leads y devuelve {ok,id}. La organización sale de p_org_slug (una landing por productora) o de staff_app.default_org_id() si no viene: ya no hay UUID escrito a mano (0040 cierra la deuda de la 0039). service_role EXECUTE solo: la llama app/landing/actions.ts con el admin client, despues del honeypot y del rate limit por IP. A anon no se le abre ninguna escritura publica (0016/0019).';

-- ---------------------------------------------------------------------------
-- (2) Mover el estado del lead, gateado contra la org DEL LEAD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_app_marcar_lead_estado(
  p_lead_id uuid,
  p_estado  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_estado IS NULL OR p_estado NOT IN ('nuevo', 'contactado', 'descartado') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'estado_invalido');
  END IF;

  -- ORDEN IMPORTANTE: primero se averigua de QUIÉN es el lead, y recién después
  -- se pregunta si el caller puede escribir en ESA organización. Al revés (que
  -- es como estaba) el gate se evaluaba contra una org fija y el filtro del
  -- UPDATE también, así que un writer de B no podía tocar ni sus propios leads.
  SELECT organization_id INTO v_org FROM producer_leads WHERE id = p_lead_id;

  -- Mismo motivo por el que 'lead_not_found' va antes que 'forbidden' abajo:
  -- si el lead no existe, no hay org contra la cual autorizar.
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;

  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE producer_leads
     SET estado = p_estado,
         -- La primera vez que pasa a 'contactado' queda la fecha; volver a
         -- 'nuevo' la borra (fue un click equivocado, no un contacto real).
         contactado_at = CASE
                           WHEN p_estado = 'contactado' THEN coalesce(contactado_at, now())
                           WHEN p_estado = 'nuevo' THEN NULL
                           ELSE contactado_at
                         END
   WHERE id = p_lead_id AND organization_id = v_org;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lead_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'estado', p_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.staff_app_marcar_lead_estado(uuid, text) IS
  'Mueve el estado de un lead de productor (nuevo/contactado/descartado) y estampa contactado_at la primera vez que pasa a contactado. Resuelve la organizacion DEL LEAD y recien ahi gatea con is_org_writer sobre esa org, usando el JWT real del caller (auth.uid() sobrevive dentro de SECURITY DEFINER). Ya no hay UUID escrito a mano (0040). authenticated EXECUTE; anon revocado. La llama el boton de /leads.';

-- ===========================================================================
-- Recargar el esquema de PostgREST. Sin esto, la firma nueva de
-- registrar_lead_productor no se ve desde la API y el formulario tira PGRST202.
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
