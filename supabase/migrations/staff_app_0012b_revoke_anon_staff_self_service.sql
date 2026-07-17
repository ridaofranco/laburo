-- staff_app_0012b_revoke_anon_staff_self_service
-- Menor privilegio: al crear una función, PUBLIC (incl. anon) hereda EXECUTE.
-- Las funciones self-service del staff se autoprotegen con auth.email(), pero
-- igual se revoca el EXECUTE de PUBLIC y se deja SOLO authenticated.
revoke all on function public.staff_app_my_staff_profile() from public;
revoke all on function public.staff_app_my_staff_offers() from public;
revoke all on function public.staff_app_update_my_staff_profile(text, text, text, text[], text, text, boolean, boolean, boolean, text, text, text, text, text) from public;
revoke all on function public.staff_app_check_in(uuid, double precision, double precision) from public;
revoke all on function public.staff_app_check_out(uuid, double precision, double precision) from public;

grant execute on function public.staff_app_my_staff_profile() to authenticated;
grant execute on function public.staff_app_my_staff_offers() to authenticated;
grant execute on function public.staff_app_update_my_staff_profile(text, text, text, text[], text, text, boolean, boolean, boolean, text, text, text, text, text) to authenticated;
grant execute on function public.staff_app_check_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.staff_app_check_out(uuid, double precision, double precision) to authenticated;
