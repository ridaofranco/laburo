-- staff_app_0022_client_payments
--
-- Fase 1 de pagos (aprobado por Franco, MercadoPago): COBRARLE AL CLIENTE del
-- evento. Se genera una preferencia de Checkout Pro por gig (monto = ingreso del
-- cliente) y se sigue el estado del cobro. NO toca el flujo del staff.
--
--  · gigs: estado de cobro al cliente (preference_id, payment_id, status, paid_at).
--  · set_gig_payment_pref (is_org_writer): guarda la preferencia recién creada.
--  · mark_gig_paid (service_role): la usa el webhook para marcar cobrado. Idempotente.

alter table staff_app.gigs
  add column if not exists client_payment_status text not null default 'none',
  add column if not exists client_preference_id text,
  add column if not exists client_payment_id text,
  add column if not exists client_paid_at timestamptz;

-- ── El productor guarda la preferencia creada (queda 'pending' esperando pago) ──
create or replace function public.staff_app_set_gig_payment_pref(
  p_gig_id uuid, p_preference_id text
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare v_org uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
begin
  if not staff_app.is_org_writer(v_org) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if coalesce(btrim(p_preference_id), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_preference');
  end if;
  update staff_app.gigs set
    client_preference_id = p_preference_id,
    -- No pisar un cobro ya confirmado si se regenera el link.
    client_payment_status = case when client_payment_status = 'paid' then 'paid' else 'pending' end
  where id = p_gig_id and organization_id = v_org;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gig_not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_set_gig_payment_pref(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_app_set_gig_payment_pref(uuid, text) to authenticated;

-- ── El webhook marca cobrado (service_role). Matchea por gig id (= external
--    reference que devuelve MP en el pago, re-fetcheado y autoritativo). Idempotente. ──
create or replace function public.staff_app_mark_gig_paid(
  p_gig_id uuid, p_payment_id text
)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
begin
  update staff_app.gigs set
    client_payment_status = 'paid',
    client_payment_id = p_payment_id,
    client_paid_at = coalesce(client_paid_at, now())
  where id = p_gig_id and client_payment_status <> 'paid';
  if not found then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_mark_gig_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_app_mark_gig_paid(uuid, text) to service_role;

-- ── Vista con el estado de cobro (append) ──────────────────────────────────
create or replace view public.staff_app_gigs with (security_invoker = true) as
  select id, title, starts_at, ends_at, venue_name, status, hito_event_id,
         organization_id, client_budget, venue_lat, venue_lng, venue_address,
         client_payment_status, client_preference_id, client_payment_id, client_paid_at
  from staff_app.gigs;
revoke all on public.staff_app_gigs from anon;
grant select on public.staff_app_gigs to authenticated;
