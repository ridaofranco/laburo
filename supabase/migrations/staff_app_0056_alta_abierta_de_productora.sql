-- staff_app_0056_alta_abierta_de_productora
-- FASE 2: la productora se registra sola.
--
-- Decision de Franco (2/8): "que quede abierto, ya esta, sino no tiene sentido".
-- Se anota, entra y opera. Nadie aprueba la cuenta ni lo que publica; el control
-- es DESPUES, desde /plataforma (0054). Hasta hoy una productora dejaba una
-- consulta en la landing y habia que contactarla a mano (decision del 28/7, que
-- esta la reemplaza).
--
-- ── POR QUE REUSA member_invites Y NO INVENTA UN CAMINO NUEVO ────────────────
-- provision_member (que ya corre en /auth/callback) sabe leer member_invites y
-- convertir a alguien en miembro de una organizacion con un rol. Entonces dar de
-- alta una productora es: crear la organizacion y dejarle la invitacion a su
-- mail. Cuando entra por primera vez, la maquinaria que ya existe hace el resto.
-- Cero auth nueva, cero camino paralelo que despues se desincronice.
--
-- ── SEGURIDAD ────────────────────────────────────────────────────────────────
-- Granteada SOLO a service_role. La llama el server action, NUNCA el browser: si
-- fuera anon-callable, cualquiera crearia organizaciones en loop. El freno de
-- abuso vive en el server action (lib/rate-limit).
--
-- ⚠️ TRAMPA QUE COSTO UNA MIGRACION EXTRA (0056b en produccion): la primera
-- version uso unaccent_simple() para el slug y esa funcion NO existe en esta
-- base (42883). Este archivo ya trae la version buena, con translate(), que es
-- core de Postgres y no depende de ninguna extension. Se cazo llamando la
-- funcion de verdad, no leyendo el codigo.

CREATE OR REPLACE FUNCTION public.staff_app_crear_productora(
  p_nombre text,
  p_email  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_slug   text;
  v_base   text;
  v_n      int := 1;
  v_org    uuid;
BEGIN
  IF v_nombre = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_email');
  END IF;

  -- Si ese mail YA es miembro de alguna organizacion, no se crea nada. Sin esto,
  -- alguien que se olvido de que tenia cuenta termina con dos productoras y sus
  -- eventos partidos entre las dos.
  IF EXISTS (
    SELECT 1 FROM staff_app.members m
     JOIN auth.users u ON u.id = m.user_id
    WHERE lower(u.email) = v_email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_tiene_cuenta');
  END IF;

  -- Idem si ya tiene invitacion pendiente (se registro y todavia no entro). Se
  -- devuelve ok para que el server action le vuelva a mandar el mail: el caso
  -- normal de registrarse dos veces es "no me llego".
  SELECT i.organization_id INTO v_org
    FROM staff_app.member_invites i
   WHERE lower(i.email) = v_email
   LIMIT 1;
  IF v_org IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'organization_id', v_org, 'ya_existia', true);
  END IF;

  -- Slug legible y unico. Se usa en URLs y en p_org_slug del alta de staff, asi
  -- que no puede chocar. translate() saca los acentos sin extensiones.
  v_base := regexp_replace(
              regexp_replace(
                lower(translate(v_nombre,
                  'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
                  'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC')),
                '[^a-z0-9]+', '-', 'g'),
              '(^-+|-+$)', '', 'g');
  IF v_base = '' THEN v_base := 'productora'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM staff_app.organizations o WHERE o.slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  INSERT INTO staff_app.organizations (name, slug, activa, es_plataforma, is_default)
  VALUES (v_nombre, v_slug, true, false, false)
  RETURNING id INTO v_org;

  -- La invitacion: cuando entre, provision_member la lee y lo hace owner.
  INSERT INTO staff_app.member_invites (organization_id, email, role)
  VALUES (v_org, v_email, 'owner');

  RETURN jsonb_build_object('ok', true, 'organization_id', v_org, 'slug', v_slug, 'ya_existia', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_app_crear_productora(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_crear_productora(text, text) TO service_role;
COMMENT ON FUNCTION public.staff_app_crear_productora(text, text) IS
  'Alta abierta de productora (Fase 2, decision de Franco 2/8). Crea la organizacion y le deja la invitacion de owner a su mail; cuando entra, provision_member hace el resto. SOLO service_role.';
