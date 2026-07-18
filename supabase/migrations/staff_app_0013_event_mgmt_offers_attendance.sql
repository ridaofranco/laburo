-- staff_app_0013_event_mgmt_offers_attendance
--
-- Cierra los 3 loops que faltaban para que el producto sea usable de punta a punta:
--  1. PRODUCTOR crea/edita eventos (gigs) de forma directa (antes solo se creaban
--     "al pasar" dentro del envío de oferta).
--  2. STAFF logueado ve y ACEPTA/RECHAZA sus ofertas desde su cuenta (no solo por
--     el link mágico del email): accept/decline por identidad (email verificado).
--  3. PRODUCTOR ve la ASISTENCIA (check-ins) de su evento para verificar que la
--     persona realmente vino.

-- ── 1. Crear / editar evento (productor, is_org_writer) ─────────────────────
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
  insert into staff_app.gigs (organization_id, title, starts_at, ends_at, venue_name, status)
  values (v_org, btrim(p_title), p_starts_at, p_ends_at, nullif(btrim(p_venue), ''), 'activo')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'gig_id', v_id);
end;
$$;
grant execute on function public.staff_app_create_gig(text, timestamptz, timestamptz, text) to authenticated;

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

-- ── 2. Staff acepta / rechaza su propia oferta (por identidad) ───────────────
-- Calca staff_app.accept_offer (crea crew + flip status) pero resuelve la oferta
-- por id verificando que pertenezca al perfil del caller (email verificado).
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

  select * into v_o from staff_app.offers
   where id = p_offer_id and staff_profile_id = v_pid
     and status in ('sent','viewed') and expires_at > now();
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

create or replace function public.staff_app_decline_my_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
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

  update staff_app.offers set status = 'declined', responded_at = now()
   where id = p_offer_id and staff_profile_id = v_pid and status in ('sent','viewed');
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.staff_app_decline_my_offer(uuid) to authenticated;

-- ── 3. El productor ve la asistencia de sus eventos ─────────────────────────
-- Política de SELECT para miembros del org (la escritura sigue siendo solo por
-- las funciones definer check_in/out del staff).
drop policy if exists attendance_member_read on staff_app.attendance;
create policy attendance_member_read on staff_app.attendance
  for select using (staff_app.is_org_member(organization_id));

-- Vista pública security_invoker: el productor la lee con su JWT (RLS de arriba),
-- con el nombre del staff para mostrar quién fichó.
create or replace view public.staff_app_attendance
  with (security_invoker = true) as
select a.id, a.organization_id, a.gig_id, a.staff_profile_id,
       a.check_in_at, a.check_in_lat, a.check_in_lng,
       a.check_out_at, a.check_out_lat, a.check_out_lng,
       p.nombre as staff_nombre, p.apellido as staff_apellido
from staff_app.attendance a
left join staff_app.staff_profiles p on p.id = a.staff_profile_id;

grant select on public.staff_app_attendance to authenticated, anon;
