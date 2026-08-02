-- staff_app_0052_marketplace_postulaciones
-- EL STAFF PASA DE ESPERAR A PODER LEVANTAR LA MANO.
--
-- ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
--
-- Hasta hoy LABURO era de UNA sola dirección: la productora busca en el pool y
-- manda una oferta, y la persona recibe. La persona NO puede ver que existe un
-- evento, y no tiene forma de decir "yo quiero ese". Verificado el 1/8: no hay
-- ninguna tabla de postulaciones, y el panel del staff solo tiene Mis eventos,
-- Fichaje y Mi perfil.
--
-- Franco, textual: "no tengo el marketplace de trabajo como staff". Es cierto, y
-- no es un bug: es la pieza que nunca se construyó. En el plan del marketplace
-- de 3 lados es el Movimiento 3 ("publicar y postularse"), con los movimientos 1
-- y 2 ya aplicados.
--
-- Esto cambia el negocio, no solo la pantalla: hoy cada puesto que se llena
-- cuesta que alguien busque, elija y escriba. Con postulaciones, la oferta
-- aparece sola y la productora elige entre gente que YA dijo que sí.
--
-- ── LAS DOS TABLAS ───────────────────────────────────────────────────────────
--
-- `gig_openings`: "para este evento busco N personas de tal rol, se paga tanto".
-- Hoy eso no existe en ningún lado: el rol vive suelto en cada oferta
-- (offers.role, texto libre), así que el sistema nunca supo CUÁNTA gente hace
-- falta ni PARA QUÉ. Sin eso no hay nada que publicar.
--
-- `gig_applications`: quién levantó la mano para cada búsqueda.
--
-- ── DECISIONES QUE VALE LA PENA DEJAR ESCRITAS ───────────────────────────────
--
-- 1. PUBLICAR ES UN ACTO APARTE DE CREAR. `publicado_at` en NULL = la búsqueda
--    existe pero NO la ve nadie. La productora arma el evento tranquila y
--    publica cuando quiere. Sin esto, cargar un evento a medias se lo mostraría
--    a 1015 personas.
--
-- 2. POSTULARSE NO ES SER CONTRATADO, Y NO SE PARECE. La postulación tiene su
--    propio estado y NO toca `offers` ni `crew`. Contratar sigue siendo mandar
--    una oferta con monto y fecha, que la persona acepta. O sea la máquina de
--    contratación que ya funciona no se toca: esto le agrega una fuente de
--    candidatos, no la reemplaza.
--
-- 3. UNA POSTULACIÓN POR PERSONA Y POR BÚSQUEDA (índice único). Tocar dos veces
--    el botón no puede generar dos filas: del lado de la productora eso se ve
--    como dos personas.
--
-- 4. SE PUEDE DESPOSTULAR. Si alguien se anota y después no puede, tiene que
--    poder sacarse solo. Si no, la productora llama a gente que ya no está.
--
-- 5. NO SE TOCA `marketplace_profiles` NI NADA DEL LADO DEL PROVEEDOR. Esas
--    tablas (0041/0042/0045) las está trabajando otra sesión AHORA. Esta
--    migración es 100% aditiva y vive sobre las tablas que la app de staff ya
--    usa (gigs, staff_profiles). Cuando el proveedor se postule a algo, la forma
--    de esta tabla sirve igual: hay que sumarle una columna de perfil de
--    proveedor, no rehacerla.

-- ── TABLA 1: LAS BÚSQUEDAS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_app.gig_openings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  gig_id          uuid NOT NULL REFERENCES staff_app.gigs(id) ON DELETE CASCADE,
  role            text NOT NULL,
  cupo            integer NOT NULL DEFAULT 1 CHECK (cupo > 0),
  -- Lo que se paga. Se le muestra a la persona ANTES de que se postule: que
  -- alguien levante la mano sin saber cuánto se paga es hacerle perder el tiempo
  -- a los dos. Nullable porque a veces se define después.
  pago            numeric,
  notas           text,
  publicado_at    timestamptz,
  cerrado_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staff_app.gig_openings IS
  'Las busquedas de un evento: "para este gig necesito N personas de tal rol". Antes de la 0052 el rol solo existia suelto en cada oferta, asi que el sistema nunca supo cuanta gente hacia falta. publicado_at NULL = borrador, no la ve nadie.';
COMMENT ON COLUMN staff_app.gig_openings.publicado_at IS
  'NULL = borrador (invisible para el staff). Con fecha = publicada en el marketplace. Publicar es un acto aparte de crear a proposito: cargar un evento a medias no puede mostrarselo a todo el pool.';
COMMENT ON COLUMN staff_app.gig_openings.cerrado_at IS
  'Cuando se dejo de recibir gente (se lleno o se cancelo). Con fecha, deja de aparecer en el marketplace pero las postulaciones que ya entraron se conservan.';

CREATE INDEX IF NOT EXISTS gig_openings_gig_idx ON staff_app.gig_openings (gig_id);
CREATE INDEX IF NOT EXISTS gig_openings_abiertas_idx
  ON staff_app.gig_openings (organization_id, publicado_at)
  WHERE publicado_at IS NOT NULL AND cerrado_at IS NULL;

ALTER TABLE staff_app.gig_openings ENABLE ROW LEVEL SECURITY;
-- Mismo molde que offers: la productora lee lo de su org y escribe si es writer.
-- El STAFF no entra por acá (no es miembro de ninguna org): entra por los RPC
-- SECURITY DEFINER de más abajo, que son la única puerta.
CREATE POLICY gig_openings_select ON staff_app.gig_openings
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY gig_openings_write ON staff_app.gig_openings
  FOR ALL USING (staff_app.is_org_writer(organization_id))
  WITH CHECK (staff_app.is_org_writer(organization_id));

-- ── TABLA 2: QUIÉN LEVANTÓ LA MANO ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_app.gig_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  opening_id       uuid NOT NULL REFERENCES staff_app.gig_openings(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
  estado           text NOT NULL DEFAULT 'postulada'
                     CHECK (estado IN ('postulada','vista','ofertada','descartada')),
  mensaje          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Una sola postulación por persona y por búsqueda. Tocar dos veces el botón no
-- puede aparecer como dos personas del otro lado.
CREATE UNIQUE INDEX IF NOT EXISTS gig_applications_unica
  ON staff_app.gig_applications (opening_id, staff_profile_id);
CREATE INDEX IF NOT EXISTS gig_applications_perfil_idx
  ON staff_app.gig_applications (staff_profile_id);

COMMENT ON TABLE staff_app.gig_applications IS
  'Postulaciones del staff a una busqueda publicada. POSTULARSE NO ES SER CONTRATADO: no toca offers ni crew. Contratar sigue siendo mandar una oferta con monto y fecha que la persona acepta; esto solo aporta candidatos que ya dijeron que si.';
COMMENT ON COLUMN staff_app.gig_applications.estado IS
  'postulada (levanto la mano) / vista (la productora la abrio) / ofertada (se le mando la oferta) / descartada. El estado real de la contratacion sigue viviendo en offers.';

ALTER TABLE staff_app.gig_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_applications_select ON staff_app.gig_applications
  FOR SELECT USING (staff_app.is_org_member(organization_id));
CREATE POLICY gig_applications_write ON staff_app.gig_applications
  FOR ALL USING (staff_app.is_org_writer(organization_id))
  WITH CHECK (staff_app.is_org_writer(organization_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- LA PUERTA DEL STAFF: SECURITY DEFINER, porque el staff no es miembro de la
-- organización y la RLS de arriba lo dejaría afuera de todo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Qué trabajos hay disponibles para MÍ ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_trabajos_abiertos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(NULL);
BEGIN
  IF v_pid IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'opening_id', o.id,
      'role', o.role,
      'cupo', o.cupo,
      'pago', o.pago,
      'notas', o.notas,
      'gig_id', g.id,
      'gig_title', g.title,
      'gig_starts_at', g.starts_at,
      'gig_ends_at', g.ends_at,
      'gig_venue', g.venue_name,
      -- Si ya se postuló, el botón tiene que decir otra cosa. Sin este dato la
      -- pantalla invita a postularse a algo donde ya estás anotado.
      'ya_me_postule', (a.id IS NOT NULL),
      'mi_estado', a.estado
    ) ORDER BY g.starts_at ASC NULLS LAST)
    FROM staff_app.gig_openings o
    JOIN staff_app.gigs g ON g.id = o.gig_id
    LEFT JOIN staff_app.gig_applications a
           ON a.opening_id = o.id AND a.staff_profile_id = v_pid
    WHERE o.publicado_at IS NOT NULL
      AND o.cerrado_at IS NULL
      -- Solo lo que todavía no pasó. Un evento de ayer no es una oportunidad.
      AND (g.starts_at IS NULL OR g.starts_at > now())
      -- Y solo de la organización donde esta persona está en el pool.
      AND o.organization_id = (SELECT sp.organization_id FROM staff_app.staff_profiles sp WHERE sp.id = v_pid)
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_trabajos_abiertos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_trabajos_abiertos() TO authenticated;
COMMENT ON FUNCTION public.staff_app_trabajos_abiertos() IS
  'Las busquedas publicadas y a futuro de la organizacion donde el caller esta en el pool, con la marca de si ya se postulo. Solo authenticated; resuelve por my_staff_profile_id, asi que nadie ve el marketplace de otra productora.';

-- ── Postularme ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_postularme(p_opening_id uuid, p_mensaje text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(NULL);
  v_o   staff_app.gig_openings%ROWTYPE;
  v_org uuid;
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT sp.organization_id INTO v_org FROM staff_app.staff_profiles sp WHERE sp.id = v_pid;

  -- Todas las guardas del lado del servidor: el id del opening viene del
  -- browser, así que no se confía en que esté publicado ni en que sea de su org.
  SELECT * INTO v_o FROM staff_app.gig_openings o
   WHERE o.id = p_opening_id
     AND o.organization_id = v_org
     AND o.publicado_at IS NOT NULL
     AND o.cerrado_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_disponible');
  END IF;

  PERFORM 1 FROM staff_app.gigs g
   WHERE g.id = v_o.gig_id AND (g.starts_at IS NULL OR g.starts_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_paso');
  END IF;

  -- Idempotente: tocar dos veces no crea dos postulaciones ni tira error.
  INSERT INTO staff_app.gig_applications (organization_id, opening_id, staff_profile_id, mensaje)
  VALUES (v_org, p_opening_id, v_pid, nullif(btrim(coalesce(p_mensaje, '')), ''))
  ON CONFLICT (opening_id, staff_profile_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_postularme(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_postularme(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.staff_app_postularme(uuid, text) IS
  'El staff levanta la mano para una busqueda publicada. Valida server-side que exista, este publicada, sea de SU organizacion y que el evento no haya pasado. Idempotente. NO contrata a nadie: contratar sigue siendo mandar una oferta.';

-- ── Bajarme de una postulación ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_app_despostularme(p_opening_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_pid uuid := staff_app.my_staff_profile_id(NULL);
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  -- Solo se puede bajar de lo que TODAVÍA no le ofertaron. Si ya le mandaron la
  -- oferta, el camino es aceptarla o rechazarla, no desaparecer de la lista.
  DELETE FROM staff_app.gig_applications a
   WHERE a.opening_id = p_opening_id
     AND a.staff_profile_id = v_pid
     AND a.estado IN ('postulada','vista');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_se_puede');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_app_despostularme(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_despostularme(uuid) TO authenticated;
COMMENT ON FUNCTION public.staff_app_despostularme(uuid) IS
  'La persona se baja de una busqueda. Solo si todavia no le ofertaron: con la oferta ya mandada el camino es aceptar o rechazar, no desaparecer. Sin esto la productora llama a gente que ya no esta disponible.';

-- ═══════════════════════════════════════════════════════════════════════════
-- EL LADO DE LA PRODUCTORA: vista de postulados, para leer con la RLS de arriba.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.staff_app_postulaciones
WITH (security_invoker = true) AS
  SELECT a.id,
         a.organization_id,
         a.opening_id,
         a.staff_profile_id,
         a.estado,
         a.mensaje,
         a.created_at,
         o.gig_id,
         o.role,
         o.cupo,
         o.pago,
         sp.nombre,
         sp.apellido,
         sp.email,
         sp.telefono,
         sp.ciudad,
         sp.provincia,
         sp.oficios,
         sp.eventos_trabajados,
         sp.cv_url
    FROM staff_app.gig_applications a
    JOIN staff_app.gig_openings o ON o.id = a.opening_id
    JOIN staff_app.staff_profiles sp ON sp.id = a.staff_profile_id;

REVOKE ALL ON public.staff_app_postulaciones FROM anon;
GRANT SELECT ON public.staff_app_postulaciones TO authenticated;
COMMENT ON VIEW public.staff_app_postulaciones IS
  'Los postulados de cada busqueda con los datos del perfil, para el panel de la productora. security_invoker: la RLS de gig_applications decide que filas ve cada uno, o sea solo las de su organizacion.';
