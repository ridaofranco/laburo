-- staff_app_0016_revoke_anon_0013_rpcs
-- Menor privilegio: las 4 RPC de 0013 heredaron EXECUTE de PUBLIC (anon) al
-- crearse. Se autoprotegen (is_org_writer / auth.email()) pero se revoca igual,
-- por consistencia con 0012b/0014 y para no exponerlas a probing anónimo.
revoke all on function public.staff_app_create_gig(text, timestamptz, timestamptz, text) from public;
revoke all on function public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text) from public;
revoke all on function public.staff_app_accept_my_offer(uuid) from public;
revoke all on function public.staff_app_decline_my_offer(uuid) from public;

grant execute on function public.staff_app_create_gig(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.staff_app_accept_my_offer(uuid) to authenticated;
grant execute on function public.staff_app_decline_my_offer(uuid) to authenticated;
