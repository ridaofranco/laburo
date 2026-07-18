-- staff_app_0023_payment_events
--
-- Log de intentos de cobro al cliente (MercadoPago). El webhook registra CADA
-- notificación de pago con su estado (approved / rejected / pending / ...), así
-- el productor ve en un panel qué pasó con cada intento sin preguntar. Una fila
-- por payment_id (upsert: si MP re-notifica el mismo pago, actualiza el estado).

create table if not exists staff_app.client_payment_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  gig_id          uuid references staff_app.gigs(id) on delete set null,
  mp_payment_id   text unique,
  status          text,
  status_detail   text,
  amount          numeric,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table staff_app.client_payment_events enable row level security;
drop policy if exists cpe_member_read on staff_app.client_payment_events;
create policy cpe_member_read on staff_app.client_payment_events
  for select using (staff_app.is_org_member(organization_id));
grant select on staff_app.client_payment_events to authenticated;

-- El webhook (service_role) registra/actualiza el intento.
create or replace function public.staff_app_log_payment_event(
  p_gig_id uuid, p_payment_id text, p_status text, p_status_detail text, p_amount numeric
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
begin
  if coalesce(btrim(p_payment_id), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_payment');
  end if;
  insert into staff_app.client_payment_events
    (organization_id, gig_id, mp_payment_id, status, status_detail, amount)
  values (v_org, p_gig_id, p_payment_id, p_status, p_status_detail, p_amount)
  on conflict (mp_payment_id) do update set
    status = excluded.status,
    status_detail = excluded.status_detail,
    amount = coalesce(excluded.amount, staff_app.client_payment_events.amount),
    gig_id = coalesce(excluded.gig_id, staff_app.client_payment_events.gig_id),
    updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_log_payment_event(uuid, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.staff_app_log_payment_event(uuid, text, text, text, numeric) to service_role;

-- Vista para el panel (con el título del evento).
create or replace view public.staff_app_client_payment_events with (security_invoker = true) as
select e.id, e.organization_id, e.gig_id, e.mp_payment_id, e.status, e.status_detail,
       e.amount, e.created_at, e.updated_at, g.title as gig_title
from staff_app.client_payment_events e
left join staff_app.gigs g on g.id = e.gig_id;
revoke all on public.staff_app_client_payment_events from anon;
grant select on public.staff_app_client_payment_events to authenticated;
