-- staff_app_0021_geofencing_checkin
--
-- Geofencing (aprobado por Franco): al fichar, el server calcula la distancia
-- (Haversine, sin PostGIS, sin costo) entre el GPS del staff y la ubicación del
-- predio (gigs.venue_lat/lng, geocodificada de la dirección). La guarda en
-- attendance.check_in_distance_m. El productor ve si alguien fichó lejos (o sin
-- ubicación cargada) y decide. NO bloquea el fichaje (v1): marca, no impide.

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
  v_glat  double precision;
  v_glng  double precision;
  v_dist  double precision;
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

  -- Distancia al predio (metros), solo si el gig tiene ubicación cargada.
  select venue_lat, venue_lng into v_glat, v_glng
   from staff_app.gigs where id = p_gig_id and organization_id = v_org;
  if v_glat is not null and v_glng is not null then
    v_dist := 2 * 6371000 * asin(least(1, sqrt(
      power(sin(radians(v_glat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(v_glat)) *
      power(sin(radians(v_glng - p_lng) / 2), 2)
    )));
  else
    v_dist := null;
  end if;

  insert into staff_app.attendance
    (organization_id, staff_profile_id, gig_id, check_in_at, check_in_lat, check_in_lng, check_in_distance_m)
  values (v_org, v_pid, p_gig_id, now(), p_lat, p_lng, v_dist)
  on conflict (staff_profile_id, gig_id) do update set
    check_in_at         = coalesce(staff_app.attendance.check_in_at, excluded.check_in_at),
    check_in_lat        = coalesce(staff_app.attendance.check_in_lat, excluded.check_in_lat),
    check_in_lng        = coalesce(staff_app.attendance.check_in_lng, excluded.check_in_lng),
    check_in_distance_m = coalesce(staff_app.attendance.check_in_distance_m, excluded.check_in_distance_m);

  return jsonb_build_object('ok', true, 'check_in_at', now(), 'distance_m', v_dist);
end;
$$;
revoke all on function public.staff_app_check_in(uuid, double precision, double precision) from public, anon;
grant execute on function public.staff_app_check_in(uuid, double precision, double precision) to authenticated;

-- Vista de asistencia con la distancia (append al final; el productor la lee).
create or replace view public.staff_app_attendance
  with (security_invoker = true) as
select a.id, a.organization_id, a.gig_id, a.staff_profile_id,
       a.check_in_at, a.check_in_lat, a.check_in_lng,
       a.check_out_at, a.check_out_lat, a.check_out_lng,
       p.nombre as staff_nombre, p.apellido as staff_apellido,
       a.check_in_distance_m
from staff_app.attendance a
left join staff_app.staff_profiles p on p.id = a.staff_profile_id;
revoke all on public.staff_app_attendance from anon;
grant select on public.staff_app_attendance to authenticated;
