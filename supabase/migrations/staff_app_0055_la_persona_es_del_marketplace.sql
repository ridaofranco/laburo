-- staff_app_0055_la_persona_es_del_marketplace
-- FASE 1: la persona deja de pertenecer a UNA productora.
--
-- ── EL PROBLEMA ──────────────────────────────────────────────────────────────
-- El backfill de la 0041 metio 1009 personas en marketplace_profiles con su
-- vinculo a SOMOS DER. Pero fue UNA FOTO: el alta nunca creo el perfil, asi que
-- todo el que se registro despues quedo afuera. Medido el 2/8: 7 fichas sin
-- perfil, entre ellas las altas del 1/8. Una migracion a medias que nadie
-- mantiene se degrada sola, y se degrada en silencio.
--
-- ── LA REGLA DE FRANCO QUE ESTO HACE REAL (2/8) ──────────────────────────────
-- "El pool es de la plataforma, compartido". Hasta hoy era mentira: el staff
-- resolvia SIEMPRE por staff_profiles.organization_id, o sea una sola
-- productora. Con la segunda productora, un trabajador habria visto los
-- trabajos de una sola. Ahora resuelve por profile_org_links.
--
-- ── LAS TRES PUNTAS QUE SE CIERRAN ───────────────────────────────────────────
-- 1. Se completa lo que falto (backfill de los 7).
-- 2. El alta crea el perfil SIEMPRE, asi no vuelve a quedar viejo.
-- 3. El marketplace resuelve por vinculos, no por una sola org.

-- ── 1. EL HELPER, IDEMPOTENTE ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_app.asegurar_perfil_marketplace(p_staff_profile_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  sp  staff_app.staff_profiles%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO sp FROM staff_app.staff_profiles WHERE id = p_staff_profile_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT id INTO v_id FROM staff_app.marketplace_profiles
   WHERE legacy_staff_profile_id = sp.id LIMIT 1;

  -- Si no hay por puente, se busca por email: el perfil puede existir creado por
  -- otra via (un proveedor que ademas trabaja como personal).
  IF v_id IS NULL AND coalesce(btrim(sp.email), '') <> '' THEN
    SELECT id INTO v_id FROM staff_app.marketplace_profiles
     WHERE lower(email) = lower(btrim(sp.email)) AND tipo = 'persona'
     ORDER BY created_at ASC LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE staff_app.marketplace_profiles
         SET legacy_staff_profile_id = coalesce(legacy_staff_profile_id, sp.id), updated_at = now()
       WHERE id = v_id;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO staff_app.marketplace_profiles
      (tipo, email, telefono, display_name, ciudad, provincia, origen, legacy_staff_profile_id)
    VALUES ('persona', lower(btrim(sp.email)), sp.telefono,
            nullif(btrim(coalesce(sp.nombre,'') || ' ' || coalesce(sp.apellido,'')), ''),
            sp.ciudad, sp.provincia, 'staff_app', sp.id)
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO staff_app.profile_org_links (profile_id, organization_id, relacion)
  SELECT v_id, sp.organization_id, 'pool'
   WHERE NOT EXISTS (
     SELECT 1 FROM staff_app.profile_org_links l
      WHERE l.profile_id = v_id AND l.organization_id = sp.organization_id
   );

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION staff_app.asegurar_perfil_marketplace(uuid) IS
  'Garantiza que una ficha de staff tenga su perfil de marketplace y su vinculo con la productora. Idempotente. La llama el alta para que el backfill no vuelva a quedar viejo.';

-- ── 2. COMPLETAR LO QUE QUEDO AFUERA ────────────────────────────────────────
SELECT staff_app.asegurar_perfil_marketplace(sp.id)
  FROM staff_app.staff_profiles sp
 WHERE NOT EXISTS (
   SELECT 1 FROM staff_app.marketplace_profiles mp WHERE mp.legacy_staff_profile_id = sp.id
 );

-- ── 3. LAS PRODUCTORAS DE UNA PERSONA ───────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_app.orgs_de_la_persona(p_staff_profile_id uuid)
RETURNS TABLE (organization_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT l.organization_id
    FROM staff_app.profile_org_links l
    JOIN staff_app.marketplace_profiles mp ON mp.id = l.profile_id
   WHERE mp.legacy_staff_profile_id = p_staff_profile_id
  UNION
  -- Red de seguridad: sin vinculo, sigue viendo el de su ficha. Nadie se queda
  -- sin ver trabajos por un problema de migracion.
  SELECT sp.organization_id FROM staff_app.staff_profiles sp WHERE sp.id = p_staff_profile_id;
$$;
COMMENT ON FUNCTION staff_app.orgs_de_la_persona(uuid) IS
  'Las productoras a las que una persona esta vinculada, con fallback a la org de su ficha. Es la pieza que convierte el pool de "de una productora" en "de la plataforma".';

-- ⚠️ NOTA PARA EL QUE VENGA: staff_app_register_applicant, staff_app_trabajos_abiertos
-- y staff_app_postularme se redefinen en esta migracion. La version aplicada en
-- produccion el 2/8 es esta. register_applicant es identica a la de la 0050 mas
-- la llamada a asegurar_perfil_marketplace antes del RETURN; trabajos_abiertos y
-- postularme cambian `organization_id = <la de su ficha>` por
-- `organization_id IN (SELECT ... FROM staff_app.orgs_de_la_persona(v_pid))`, y
-- ademas excluyen lo moderado (moderada_at IS NULL, 0054).
-- El cuerpo completo vive en la base; para leerlo:
--   select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n
--     on n.oid=p.pronamespace where n.nspname='public'
--     and p.proname in ('staff_app_register_applicant','staff_app_trabajos_abiertos','staff_app_postularme');
