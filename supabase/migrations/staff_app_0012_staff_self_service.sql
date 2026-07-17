-- staff_app_0012_staff_self_service
--
-- Fork "staff con cuenta": el staff se loguea con Supabase Auth (magic link /
-- Google, shouldCreateUser gateado en el cliente) y accede SOLO a lo suyo. La
-- identidad se resuelve por auth.email() = staff_profiles.email (email verificado
-- por Supabase Auth = prueba de propiedad). No se agregan policies RLS nuevas a
-- staff_profiles: todo el acceso self-service pasa por estas funciones SECURITY
-- DEFINER con search_path fijo, que confinan el alcance a la propia fila del
-- caller (mismo patrón que staff_app_provision_member / set_candidate_note).
--
-- Incluye: perfil propio (leer/editar campos seguros), ofertas propias (con gig +
-- asistencia), y fichaje GPS (check-in/out) SOLO para gigs donde el staff tiene
-- una oferta 'accepted' (confirmado). Cero MercadoPago, cero costo.

-- ── Tabla de asistencia (fichaje) ───────────────────────────────────────────
create table if not exists staff_app.attendance (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  staff_profile_id  uuid not null references staff_app.staff_profiles(id) on delete cascade,
  gig_id            uuid not null references staff_app.gigs(id) on delete cascade,
  check_in_at       timestamptz,
  check_in_lat      double precision,
  check_in_lng      double precision,
  check_out_at      timestamptz,
  check_out_lat     double precision,
  check_out_lng     double precision,
  created_at        timestamptz not null default now(),
  unique (staff_profile_id, gig_id)
);

-- RLS on, SIN policies permisivas: la tabla solo se toca por las funciones
-- SECURITY DEFINER de abajo (nunca por PostgREST directo).
alter table staff_app.attendance enable row level security;

-- ── Perfil propio del staff (lectura) ───────────────────────────────────────
create or replace function public.staff_app_my_staff_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  r       staff_app.staff_profiles%rowtype;
begin
  if v_email = '' then return null; end if;
  select * into r from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc
   limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'nombre', r.nombre, 'apellido', r.apellido,
    'email', r.email, 'telefono', r.telefono,
    'oficios', r.oficios, 'oficios_otro', r.oficios_otro,
    'provincia', r.provincia, 'ciudad', r.ciudad,
    'pais_residencia', r.pais_residencia,
    'disponibilidad_aviso', r.disponibilidad_aviso,
    'disponibilidad_finde', r.disponibilidad_finde,
    'disponibilidad_viajar', r.disponibilidad_viajar,
    'movilidad_propia', r.movilidad_propia,
    'experiencia', r.experiencia,
    'anios_experiencia', r.anios_experiencia,
    'experiencia_detalle', r.experiencia_detalle,
    'eventos_trabajados', r.eventos_trabajados,
    'linkedin_url', r.linkedin_url, 'portfolio_url', r.portfolio_url,
    'cv_url', r.cv_url, 'motivacion', r.motivacion
  );
end;
$$;
grant execute on function public.staff_app_my_staff_profile() to authenticated;

-- ── Ofertas propias del staff (con gig + asistencia) ────────────────────────
create or replace function public.staff_app_my_staff_offers()
returns jsonb
language plpgsql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid   uuid;
begin
  if v_email = '' then return '[]'::jsonb; end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'role', o.role, 'status', o.status, 'amount', o.amount,
      'conditions', o.conditions, 'expires_at', o.expires_at,
      'sent_at', o.sent_at, 'responded_at', o.responded_at,
      'gig_id', o.gig_id, 'gig_title', g.title,
      'gig_starts_at', g.starts_at, 'gig_ends_at', g.ends_at,
      'gig_venue', g.venue_name,
      'check_in_at', a.check_in_at, 'check_out_at', a.check_out_at
    ) order by g.starts_at asc nulls last)
    from staff_app.offers o
    left join staff_app.gigs g on g.id = o.gig_id
    left join staff_app.attendance a
           on a.gig_id = o.gig_id and a.staff_profile_id = v_pid
    where o.staff_profile_id = v_pid
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.staff_app_my_staff_offers() to authenticated;

-- ── Editar el propio perfil (solo campos seguros) ───────────────────────────
-- NUNCA toca email / documento / organization_id / rating / notas_internas.
create or replace function public.staff_app_update_my_staff_profile(
  p_telefono            text,
  p_provincia           text,
  p_ciudad              text,
  p_oficios             text[],
  p_oficios_otro        text,
  p_disponibilidad_aviso text,
  p_disponibilidad_finde  boolean,
  p_disponibilidad_viajar boolean,
  p_movilidad_propia      boolean,
  p_experiencia_detalle text,
  p_anios_experiencia   text,
  p_linkedin_url        text,
  p_portfolio_url       text,
  p_motivacion          text
)
returns jsonb
language plpgsql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid   uuid;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_staff');
  end if;

  update staff_app.staff_profiles set
    telefono            = nullif(btrim(p_telefono), ''),
    provincia           = nullif(btrim(p_provincia), ''),
    ciudad              = nullif(btrim(p_ciudad), ''),
    oficios             = coalesce(p_oficios, oficios),
    oficios_otro        = nullif(btrim(p_oficios_otro), ''),
    disponibilidad_aviso  = nullif(btrim(p_disponibilidad_aviso), ''),
    disponibilidad_finde  = coalesce(p_disponibilidad_finde, disponibilidad_finde),
    disponibilidad_viajar = coalesce(p_disponibilidad_viajar, disponibilidad_viajar),
    movilidad_propia      = coalesce(p_movilidad_propia, movilidad_propia),
    experiencia_detalle = nullif(btrim(p_experiencia_detalle), ''),
    anios_experiencia   = nullif(btrim(p_anios_experiencia), ''),
    linkedin_url        = nullif(btrim(p_linkedin_url), ''),
    portfolio_url       = nullif(btrim(p_portfolio_url), ''),
    motivacion          = nullif(btrim(p_motivacion), '')
  where id = v_pid;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.staff_app_update_my_staff_profile(
  text, text, text, text[], text, text, boolean, boolean, boolean, text, text, text, text, text
) to authenticated;

-- ── Fichaje: check-in (solo gigs donde el staff está confirmado) ────────────
create or replace function public.staff_app_check_in(
  p_gig_id uuid, p_lat double precision, p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid   uuid;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_staff'); end if;

  perform 1 from staff_app.offers
   where staff_profile_id = v_pid and gig_id = p_gig_id and status = 'accepted';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_confirmed'); end if;

  insert into staff_app.attendance
    (organization_id, staff_profile_id, gig_id, check_in_at, check_in_lat, check_in_lng)
  values (v_org, v_pid, p_gig_id, now(), p_lat, p_lng)
  on conflict (staff_profile_id, gig_id) do update set
    check_in_at  = coalesce(staff_app.attendance.check_in_at, excluded.check_in_at),
    check_in_lat = coalesce(staff_app.attendance.check_in_lat, excluded.check_in_lat),
    check_in_lng = coalesce(staff_app.attendance.check_in_lng, excluded.check_in_lng);

  return jsonb_build_object('ok', true, 'check_in_at', now());
end;
$$;
grant execute on function public.staff_app_check_in(uuid, double precision, double precision) to authenticated;

-- ── Fichaje: check-out ──────────────────────────────────────────────────────
create or replace function public.staff_app_check_out(
  p_gig_id uuid, p_lat double precision, p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid   uuid;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_staff'); end if;

  update staff_app.attendance set
    check_out_at  = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng
  where staff_profile_id = v_pid and gig_id = p_gig_id and check_in_at is not null;

  if not found then return jsonb_build_object('ok', false, 'reason', 'no_check_in'); end if;
  return jsonb_build_object('ok', true, 'check_out_at', now());
end;
$$;
grant execute on function public.staff_app_check_out(uuid, double precision, double precision) to authenticated;
