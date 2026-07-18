-- staff_app_0020_gig_extras_and_slots
--
-- Base del "batch verde" (aprobado por Franco): margen, dotación (gig_slots) y
-- geofencing. Todo ADITIVO y NO toca create_gig/update_gig (que ya corren en
-- prod): los datos nuevos se setean con RPCs nuevas. Así no hay ventana rota.
--
--  · gigs: client_budget (ingreso del cliente, para el margen), venue_lat/lng +
--    venue_address (para geocodificar y geofencing).
--  · attendance: check_in_distance_m (distancia al predio al fichar, la calcula
--    check_in en 0021).
--  · gig_slots: dotación requerida por evento ({rol, cantidad}).
--  · RPCs set_gig_details / set_gig_slots (is_org_writer), y vistas.

-- ── Columnas nuevas ─────────────────────────────────────────────────────────
alter table staff_app.gigs
  add column if not exists client_budget numeric,
  add column if not exists venue_lat double precision,
  add column if not exists venue_lng double precision,
  add column if not exists venue_address text;

alter table staff_app.attendance
  add column if not exists check_in_distance_m double precision;

-- ── Tabla de dotación requerida ─────────────────────────────────────────────
create table if not exists staff_app.gig_slots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gig_id          uuid not null references staff_app.gigs(id) on delete cascade,
  role            text not null,
  quantity        int  not null check (quantity > 0),
  created_at      timestamptz not null default now()
);
alter table staff_app.gig_slots enable row level security;
drop policy if exists gig_slots_member_read on staff_app.gig_slots;
create policy gig_slots_member_read on staff_app.gig_slots
  for select using (staff_app.is_org_member(organization_id));
grant select on staff_app.gig_slots to authenticated;

-- ── RPC: setear los extras del gig (budget + ubicación) ─────────────────────
create or replace function public.staff_app_set_gig_details(
  p_gig_id uuid, p_client_budget numeric,
  p_venue_lat double precision, p_venue_lng double precision, p_venue_address text
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
begin
  if not staff_app.is_org_writer(v_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_client_budget is not null and p_client_budget < 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_budget');
  end if;
  if p_venue_lat is not null and (p_venue_lat < -90 or p_venue_lat > 90) then
    return jsonb_build_object('ok', false, 'reason', 'bad_coords');
  end if;
  if p_venue_lng is not null and (p_venue_lng < -180 or p_venue_lng > 180) then
    return jsonb_build_object('ok', false, 'reason', 'bad_coords');
  end if;
  update staff_app.gigs set
    client_budget = p_client_budget,
    venue_lat     = p_venue_lat,
    venue_lng     = p_venue_lng,
    venue_address = nullif(btrim(p_venue_address), '')
  where id = p_gig_id and organization_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_set_gig_details(uuid, numeric, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.staff_app_set_gig_details(uuid, numeric, double precision, double precision, text) to authenticated;

-- ── RPC: reemplazar la dotación del gig (array {role, quantity}) ────────────
create or replace function public.staff_app_set_gig_slots(p_gig_id uuid, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_org  uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  v_slot jsonb;
  v_role text;
  v_qty  int;
begin
  if not staff_app.is_org_writer(v_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  perform 1 from staff_app.gigs where id = p_gig_id and organization_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  end if;

  delete from staff_app.gig_slots where gig_id = p_gig_id and organization_id = v_org;
  if p_slots is not null and jsonb_typeof(p_slots) = 'array' then
    for v_slot in select * from jsonb_array_elements(p_slots) loop
      v_role := btrim(coalesce(v_slot->>'role', ''));
      v_qty  := coalesce(nullif(v_slot->>'quantity', '')::int, 0);
      if v_role <> '' and v_qty > 0 then
        insert into staff_app.gig_slots (organization_id, gig_id, role, quantity)
        values (v_org, p_gig_id, v_role, least(v_qty, 999));
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_set_gig_slots(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.staff_app_set_gig_slots(uuid, jsonb) to authenticated;

-- ── Vistas (recreadas con las columnas nuevas) ──────────────────────────────
create or replace view public.staff_app_gigs with (security_invoker = true) as
  select id, title, starts_at, ends_at, venue_name, status, hito_event_id,
         organization_id, client_budget, venue_lat, venue_lng, venue_address
  from staff_app.gigs;
revoke all on public.staff_app_gigs from anon;
grant select on public.staff_app_gigs to authenticated;

create or replace view public.staff_app_gig_slots with (security_invoker = true) as
  select id, gig_id, role, quantity, organization_id
  from staff_app.gig_slots;
revoke all on public.staff_app_gig_slots from anon;
grant select on public.staff_app_gig_slots to authenticated;
