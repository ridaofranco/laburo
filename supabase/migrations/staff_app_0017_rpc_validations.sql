-- staff_app_0017_rpc_validations
--
-- Endurece las RPC de self-service y gestión de eventos (Lote 2 de seguridad):
--  · check_in / check_out: exigen lat/lng no-null y dentro de rango válido.
--  · check_out: solo cierra si todavía no hay salida (antes pisaba la salida ya
--    registrada con un segundo tap).
--  · accept_my_offer: bloquea la fila (for update) para no correr carrera con
--    decline_my_offer sobre la misma oferta.
--  · create_gig / update_gig: rechazan ends_at <= starts_at (evento que termina
--    antes de empezar).
--  · update_my_cv: valida que el path pertenezca al bucket staff-cvs y arranque
--    con el prefijo del propio staff (no puede apuntar al CV de otra persona).
--
-- Todas son CREATE OR REPLACE de funciones ya existentes: misma firma, mismo
-- search_path fijo, mismos grants. Solo cambia el cuerpo (validaciones nuevas).

-- ── check_in: valida coordenadas ────────────────────────────────────────────
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
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'reason', 'no_coords');
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'reason', 'bad_coords');
  end if;
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

-- ── check_out: valida coordenadas y no pisa una salida ya registrada ────────
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
  if p_lat is null or p_lng is null then
    return jsonb_build_object('ok', false, 'reason', 'no_coords');
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'reason', 'bad_coords');
  end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_staff'); end if;

  -- Solo cierra si hay entrada y todavía NO hay salida (no pisar la salida).
  update staff_app.attendance set
    check_out_at  = now(),
    check_out_lat = p_lat,
    check_out_lng = p_lng
  where staff_profile_id = v_pid and gig_id = p_gig_id
    and check_in_at is not null and check_out_at is null;

  if not found then return jsonb_build_object('ok', false, 'reason', 'no_check_in_or_already_out'); end if;
  return jsonb_build_object('ok', true, 'check_out_at', now());
end;
$$;
grant execute on function public.staff_app_check_out(uuid, double precision, double precision) to authenticated;

-- ── accept_my_offer: lockea la fila para no correr carrera con decline ──────
create or replace function public.staff_app_accept_my_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid   uuid;
  v_o     staff_app.offers%rowtype;
  v_crew  uuid;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_staff'); end if;

  -- for update: si un decline concurrente toca esta misma oferta, se serializa.
  select * into v_o from staff_app.offers
   where id = p_offer_id and staff_profile_id = v_pid
     and status in ('sent','viewed') and expires_at > now()
   for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); end if;

  insert into staff_app.crew (organization_id, gig_id, staff_profile_id, role)
  values (v_o.organization_id, v_o.gig_id, v_o.staff_profile_id, v_o.role)
  on conflict (gig_id, staff_profile_id) do nothing
  returning id into v_crew;
  if v_crew is null then
    select id into v_crew from staff_app.crew
     where gig_id = v_o.gig_id and staff_profile_id = v_o.staff_profile_id;
  end if;

  update staff_app.offers set status = 'accepted', responded_at = now() where id = v_o.id;
  return jsonb_build_object('ok', true, 'crew_id', v_crew);
end;
$$;
grant execute on function public.staff_app_accept_my_offer(uuid) to authenticated;

-- ── create_gig: rechaza ends_at <= starts_at ────────────────────────────────
create or replace function public.staff_app_create_gig(
  p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_venue text
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_id  uuid;
begin
  if not staff_app.is_org_writer(v_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if coalesce(btrim(p_title), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'title_required');
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    return jsonb_build_object('ok', false, 'reason', 'bad_dates');
  end if;
  insert into staff_app.gigs (organization_id, title, starts_at, ends_at, venue_name, status)
  values (v_org, btrim(p_title), p_starts_at, p_ends_at, nullif(btrim(p_venue), ''), 'activo')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'gig_id', v_id);
end;
$$;
grant execute on function public.staff_app_create_gig(text, timestamptz, timestamptz, text) to authenticated;

-- ── update_gig: rechaza ends_at <= starts_at ────────────────────────────────
create or replace function public.staff_app_update_gig(
  p_gig_id uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_venue text, p_status text
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
begin
  if not staff_app.is_org_writer(v_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    return jsonb_build_object('ok', false, 'reason', 'bad_dates');
  end if;
  update staff_app.gigs set
    title      = coalesce(nullif(btrim(p_title), ''), title),
    starts_at  = p_starts_at,
    ends_at    = p_ends_at,
    venue_name = nullif(btrim(p_venue), ''),
    status     = coalesce(nullif(btrim(p_status), ''), status)
  where id = p_gig_id and organization_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text) to authenticated;

-- ── update_my_cv: el path tiene que ser del bucket y del propio staff ───────
create or replace function public.staff_app_update_my_cv(p_cv_url text)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email  text := lower(coalesce(auth.email(), ''));
  v_org    uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_pid    uuid;
  v_prefix text;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select id into v_pid from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'reason', 'not_staff'); end if;

  -- El path lo arma el server como 'staff-cvs/<staff_id>_<ts>_<archivo>'. Validamos
  -- que apunte al bucket y al prefijo del propio staff (no al CV de otro).
  v_prefix := 'staff-cvs/' || v_pid::text || '_';
  if p_cv_url is null or left(p_cv_url, length(v_prefix)) <> v_prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  update staff_app.staff_profiles set cv_url = nullif(btrim(p_cv_url), '') where id = v_pid;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_update_my_cv(text) from public;
grant execute on function public.staff_app_update_my_cv(text) to authenticated;
