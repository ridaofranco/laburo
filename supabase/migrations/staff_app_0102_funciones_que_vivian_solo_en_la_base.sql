-- FUNCIONES QUE VIVÍAN SOLO EN LA BASE (relevo noche 30/10/2026).
-- Estas 14 funciones estaban aplicadas pero no tenían migración en el repo.
-- Este archivo copia su definición vigente (pg_get_functiondef). Los permisos
-- quedan como estaban en la base (anotados arriba de cada una). Correrlo otra
-- vez no cambia nada. Ojo: staff_app_quiero_cotizar se cierra a anon en la 0103.

-- public.staff_app_categorias_proveedores()  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_categorias_proveedores()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_app.members m WHERE m.user_id = auth.uid()) THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(DISTINCT s.categoria)
    FROM staff_app.provider_services s
    JOIN staff_app.marketplace_profiles mp ON mp.id = s.profile_id
    WHERE s.activo AND mp.activo AND mp.is_public AND mp.tipo = 'proveedor'
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_cvs_errored()  permisos en la base: {postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_cvs_errored()
 RETURNS TABLE(id uuid, cv_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'staff_app'
AS $function$
  select sp.id, sp.cv_url
  from staff_app.staff_profiles sp
  where sp.cv_data->>'error' is not null and sp.cv_url like '%drive.google%';
$function$;

-- public.staff_app_licitaciones_abiertas(p_limit integer)  permisos en la base: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_licitaciones_abiertas(p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'cierra_at')
    FROM (
      SELECT jsonb_build_object(
        'slug', r.slug,
        'titulo', r.titulo,
        'categoria', r.categoria,
        'ciudad', r.ciudad,
        'provincia', r.provincia,
        'necesario_para', r.necesario_para,
        'cierra_at', r.cierra_at,
        'quien', CASE WHEN r.mostrar_productora THEN o.name ELSE 'Una productora' END
      ) AS x
      FROM staff_app.quote_requests r
      JOIN staff_app.organizations o ON o.id = r.organization_id
      WHERE r.visibilidad = 'publica' AND r.estado = 'abierta'
        AND r.slug IS NOT NULL AND r.cierra_at > now()
      ORDER BY r.cierra_at
      LIMIT least(greatest(coalesce(p_limit, 40), 1), 100)
    ) sub
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_plataforma_consultas()  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_consultas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', c.id,
        'created_at', c.created_at,
        -- 'cliente' = alguien de la calle desde la vidriera.
        -- 'productora' = una productora desde adentro de la app.
        'origen', c.origen,
        'quien', c.nombre_contacto,
        'email', c.email_contacto,
        'telefono', c.telefono_contacto,
        'a_quien', p.display_name,
        'tipo_destino', p.tipo,
        'slug', p.slug,
        -- Que el mail HAYA SALIDO es distinto de que la consulta exista. Un
        -- campo que dice que algo se escribio no dice que llego: si esto viene
        -- en null, alguien pidio presupuesto y el proveedor nunca se entero.
        'mail_salio', (c.email_enviado_at IS NOT NULL),
        'organizacion', o.name,
        'respuestas', c.respuestas
      ) AS x
      FROM staff_app.provider_contacts c
      JOIN staff_app.marketplace_profiles p ON p.id = c.profile_id
      LEFT JOIN staff_app.organizations o ON o.id = c.organization_id
      ORDER BY c.created_at DESC
      LIMIT 200
    ) sub
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_plataforma_contactos_proveedor()  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_contactos_proveedor()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id,
      'organizacion', org.name,
      'proveedor', mp.display_name,
      'gig_title', g.title,
      'mensaje', c.mensaje,
      'created_at', c.created_at
    ) ORDER BY c.created_at DESC)
    FROM staff_app.provider_contacts c
    JOIN staff_app.organizations org ON org.id = c.organization_id
    JOIN staff_app.marketplace_profiles mp ON mp.id = c.profile_id
    LEFT JOIN staff_app.gigs g ON g.id = c.gig_id
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_plataforma_ofertas()  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_ofertas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'sent_at' DESC NULLS LAST)
    FROM (
      SELECT jsonb_build_object(
        'id', f.id,
        'sent_at', f.sent_at,
        'responded_at', f.responded_at,
        'expires_at', f.expires_at,
        'monto', f.amount,
        'estado', CASE
                    WHEN f.status = 'sent' AND f.expires_at IS NOT NULL
                         AND f.expires_at < now() THEN 'vencida'
                    ELSE f.status
                  END,
        'a_quien', coalesce(sp.nombre, '') || ' ' || coalesce(sp.apellido, ''),
        'evento', g.title,
        'organizacion', o.name
      ) AS x
      FROM staff_app.offers f
      LEFT JOIN staff_app.gigs g ON g.id = f.gig_id
      LEFT JOIN staff_app.staff_profiles sp ON sp.id = f.staff_profile_id
      LEFT JOIN staff_app.organizations o ON o.id = f.organization_id
      ORDER BY f.sent_at DESC NULLS LAST
      LIMIT 200
    ) sub
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_plataforma_rentabilidad()  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_rentabilidad()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY (x->>'margen')::numeric DESC NULLS LAST)
    FROM (
      SELECT jsonb_build_object(
        'id',   org.id,
        'name', org.name,
        'slug', org.slug,
        'es_plataforma', org.es_plataforma,
        'eventos', (SELECT count(*) FROM staff_app.gigs g WHERE g.organization_id = org.id),
        -- Lo que le cobra al cliente. Puede estar sin cargar: ahi el margen no
        -- se puede calcular y se devuelve NULL, no cero. Un cero dicho sin datos
        -- es una mentira que despues alguien lee como "no gana nada".
        'ingreso', (SELECT sum(g.client_budget) FROM staff_app.gigs g
                     WHERE g.organization_id = org.id),
        -- Lo que paga al staff: solo lo ACEPTADO. Una oferta mandada y no
        -- contestada todavia no es plata que sale.
        'costo',   (SELECT sum(o.amount) FROM staff_app.offers o
                     WHERE o.organization_id = org.id AND o.status = 'accepted'),
        'ofertas_mandadas',  (SELECT count(*) FROM staff_app.offers o WHERE o.organization_id = org.id),
        'ofertas_aceptadas', (SELECT count(*) FROM staff_app.offers o
                               WHERE o.organization_id = org.id AND o.status = 'accepted'),
        'ultimo_movimiento', (SELECT max(o.sent_at) FROM staff_app.offers o WHERE o.organization_id = org.id),
        'margen', (
          SELECT CASE
                   WHEN (SELECT sum(g.client_budget) FROM staff_app.gigs g
                          WHERE g.organization_id = org.id) IS NULL THEN NULL
                   ELSE coalesce((SELECT sum(g.client_budget) FROM staff_app.gigs g
                                   WHERE g.organization_id = org.id), 0)
                      - coalesce((SELECT sum(o.amount) FROM staff_app.offers o
                                   WHERE o.organization_id = org.id AND o.status = 'accepted'), 0)
                 END
        )
      ) AS x
      FROM staff_app.organizations org
    ) sub
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_plataforma_timeline(p_dias integer)  permisos en la base: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_timeline(p_dias integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
DECLARE
  v_desde timestamptz := now() - make_interval(days => greatest(1, coalesce(p_dias, 30)));
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY cuando DESC)
    FROM (
      SELECT cuando, x FROM (
        SELECT s.created_at AS cuando, jsonb_build_object('cuando', s.created_at,
               'que', 'persona_nueva',
               'quien', btrim(coalesce(s.nombre,'') || ' ' || coalesce(s.apellido,'')),
               'detalle', coalesce(s.ciudad, s.provincia, ''), 'org', NULL) AS x
          FROM staff_app.staff_profiles s WHERE s.created_at > v_desde
        UNION ALL
        SELECT p.created_at, jsonb_build_object('cuando', p.created_at,
               'que', CASE WHEN p.tipo = 'salon' THEN 'salon_nuevo' ELSE 'proveedor_nuevo' END,
               'quien', p.display_name,
               'detalle', coalesce(p.provincia, p.ciudad, ''), 'org', NULL)
          FROM staff_app.marketplace_profiles p
         WHERE p.created_at > v_desde AND p.tipo IN ('proveedor','salon')
        UNION ALL
        SELECT o.created_at, jsonb_build_object('cuando', o.created_at,
               'que', 'productora_nueva', 'quien', o.name, 'detalle', '', 'org', o.name)
          FROM staff_app.organizations o WHERE o.created_at > v_desde
        UNION ALL
        SELECT g.created_at, jsonb_build_object('cuando', g.created_at,
               'que', 'evento_nuevo', 'quien', g.title, 'detalle', '', 'org', org.name)
          FROM staff_app.gigs g
          LEFT JOIN staff_app.organizations org ON org.id = g.organization_id
         WHERE g.created_at > v_desde
        UNION ALL
        SELECT f.sent_at, jsonb_build_object('cuando', f.sent_at,
               'que', 'oferta_mandada',
               'quien', btrim(coalesce(sp.nombre,'') || ' ' || coalesce(sp.apellido,'')),
               'detalle', coalesce(g2.title, ''), 'org', org2.name)
          FROM staff_app.offers f
          LEFT JOIN staff_app.staff_profiles sp ON sp.id = f.staff_profile_id
          LEFT JOIN staff_app.gigs g2 ON g2.id = f.gig_id
          LEFT JOIN staff_app.organizations org2 ON org2.id = f.organization_id
         WHERE f.sent_at > v_desde
        UNION ALL
        SELECT f.responded_at, jsonb_build_object('cuando', f.responded_at, 'que',
               CASE WHEN f.status = 'accepted' THEN 'oferta_aceptada' ELSE 'oferta_rechazada' END,
               'quien', btrim(coalesce(sp.nombre,'') || ' ' || coalesce(sp.apellido,'')),
               'detalle', coalesce(g3.title, ''), 'org', org3.name)
          FROM staff_app.offers f
          LEFT JOIN staff_app.staff_profiles sp ON sp.id = f.staff_profile_id
          LEFT JOIN staff_app.gigs g3 ON g3.id = f.gig_id
          LEFT JOIN staff_app.organizations org3 ON org3.id = f.organization_id
         WHERE f.responded_at > v_desde AND f.status IN ('accepted','declined')
        UNION ALL
        SELECT c.created_at, jsonb_build_object('cuando', c.created_at, 'que', 'consulta',
               'quien', c.nombre_contacto,
               'detalle', 'le escribió a ' || coalesce(mp.display_name,''), 'org', NULL)
          FROM staff_app.provider_contacts c
          LEFT JOIN staff_app.marketplace_profiles mp ON mp.id = c.profile_id
         WHERE c.created_at > v_desde
        UNION ALL
        SELECT l.created_at, jsonb_build_object('cuando', l.created_at, 'que', 'lead',
               'quien', l.nombre, 'detalle', coalesce(l.empresa, ''), 'org', NULL)
          FROM staff_app.producer_leads l WHERE l.created_at > v_desde
      ) todo
      -- EL ORDER BY VA ACA, ANTES DEL LIMIT. Ese es el arreglo entero.
      ORDER BY cuando DESC
      LIMIT 300
    ) sub
  ), '[]'::jsonb);
END;
$function$;

-- public.staff_app_pool_publico()  permisos en la base: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_pool_publico()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
  SELECT greatest(0, (count(*) / 100) * 100)::int
    FROM staff_app.staff_profiles
   WHERE baja_at IS NULL;
$function$;

-- public.staff_app_quiero_cotizar(p_slug text, p_email text, p_nombre text)  permisos en la base: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_quiero_cotizar(p_slug text, p_email text, p_nombre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_r     record;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nom   text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_raw   text; v_hash text; v_id uuid; v_expires timestamptz;
BEGIN
  SELECT * INTO v_r FROM staff_app.quote_requests
   WHERE slug = btrim(coalesce(p_slug, '')) AND visibilidad = 'publica';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_existe');
  END IF;
  IF v_r.estado <> 'abierta' OR v_r.cierra_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cerrada');
  END IF;
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_invalido');
  END IF;

  v_expires := v_r.cierra_at + interval '30 days';
  v_raw  := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  SELECT id INTO v_id FROM staff_app.quote_invites
   WHERE request_id = v_r.id AND lower(email) = v_email;

  IF v_id IS NOT NULL THEN
    UPDATE staff_app.quote_invites
       SET token_hash = v_hash, token_expires_at = v_expires, nombre = coalesce(nombre, v_nom)
     WHERE id = v_id;
  ELSE
    INSERT INTO staff_app.quote_invites (request_id, email, nombre, token_hash, token_expires_at)
    VALUES (v_r.id, v_email, v_nom, v_hash, v_expires)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invite_id', v_id, 'token', v_raw,
                            'titulo', v_r.titulo, 'cierra_at', v_r.cierra_at);
END;
$function$;

-- public.staff_app_visibilidad_de(p_request_id uuid, p_org uuid)  permisos en la base: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_visibilidad_de(p_request_id uuid, p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_r record;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_member(v_org) THEN
    RETURN NULL;
  END IF;
  SELECT visibilidad, mostrar_productora, slug INTO v_r
    FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'visibilidad', v_r.visibilidad,
    'publica', v_r.visibilidad = 'publica',
    'mostrar_productora', v_r.mostrar_productora,
    'slug', v_r.slug,
    'puede_editar', staff_app.is_org_writer(v_org)
  );
END;
$function$;

-- public.staff_app_visibilidad_pedido(p_request_id uuid, p_publica boolean, p_mostrar_productora boolean, p_org uuid)  permisos en la base: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.staff_app_visibilidad_pedido(p_request_id uuid, p_publica boolean, p_mostrar_productora boolean DEFAULT true, p_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := staff_app.resolve_org(p_org);
  v_r record;
  v_slug text;
BEGIN
  IF v_org IS NULL OR NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO v_r FROM staff_app.quote_requests
   WHERE id = p_request_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_no_encontrado');
  END IF;

  v_slug := v_r.slug;
  IF p_publica AND v_slug IS NULL THEN
    v_slug := staff_app.slug_de_pedido(v_r.titulo);
  END IF;

  UPDATE staff_app.quote_requests
     SET visibilidad = CASE WHEN p_publica THEN 'publica' ELSE 'privada' END,
         mostrar_productora = coalesce(p_mostrar_productora, true),
         slug = v_slug
   WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'visibilidad', CASE WHEN p_publica THEN 'publica' ELSE 'privada' END, 'slug', v_slug);
END;
$function$;

-- staff_app.marcar_perfil_confirmado()  permisos en la base: None
CREATE OR REPLACE FUNCTION staff_app.marcar_perfil_confirmado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'public', 'extensions', 'auth', 'pg_temp'
AS $function$
begin
  if auth.email() is not null
     and lower(btrim(coalesce(new.email, ''))) = lower(btrim(auth.email()))
  then
    new.perfil_confirmado_at := now();
  end if;
  return new;
end $function$;

-- staff_app.slug_de_pedido(p_titulo text)  permisos en la base: None
CREATE OR REPLACE FUNCTION staff_app.slug_de_pedido(p_titulo text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'staff_app', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_base text;
  v_slug text;
  v_n int := 0;
BEGIN
  v_base := lower(btrim(coalesce(p_titulo, '')));
  v_base := translate(v_base, 'áéíóúàèìòùäëïöüâêîôûñç', 'aeiouaeiouaeiouaeiounc');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(v_base, '-');
  v_base := left(nullif(v_base, ''), 60);
  IF v_base IS NULL THEN v_base := 'pedido'; END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM staff_app.quote_requests WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;
  RETURN v_slug;
END;
$function$;
