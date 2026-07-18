-- staff_app_0019_revoke_anon_identity_rpcs
--
-- Defensa en profundidad: revoca EXECUTE de anon en todas las RPC de identidad
-- de staff (auth.email()) y de productor (is_org_writer). Estas nunca deberían
-- ser públicas; el anon volvió porque Supabase re-aplica sus default privileges
-- (grant execute a anon/authenticated) cada vez que se hace CREATE OR REPLACE,
-- así que los `revoke from public` de 0012b/0014/0016 no alcanzaban (no tocan el
-- grant EXPLÍCITO a anon). Acá se revoca anon EXPLÍCITO.
--
-- Los guards internos (auth.email() / is_org_writer) ya frenan a un caller anon,
-- así que esto no arregla una escalación real, pero restaura la postura buscada
-- y saca los findings del advisor.
--
-- NO se tocan las 4 funciones que SÍ deben ser públicas (flujo por token +
-- registro): accept_offer(token), decline_offer(token), get_public_offer(token),
-- register_applicant(...). Esas siguen con anon a propósito.

revoke all on function public.staff_app_accept_my_offer(uuid) from anon;
revoke all on function public.staff_app_decline_my_offer(uuid) from anon;
revoke all on function public.staff_app_check_in(uuid, double precision, double precision) from anon;
revoke all on function public.staff_app_check_out(uuid, double precision, double precision) from anon;
revoke all on function public.staff_app_create_gig(text, timestamptz, timestamptz, text) from anon;
revoke all on function public.staff_app_update_gig(uuid, text, timestamptz, timestamptz, text, text) from anon;
revoke all on function public.staff_app_update_my_cv(text) from anon;
revoke all on function public.staff_app_my_staff_profile() from anon;
revoke all on function public.staff_app_my_staff_offers() from anon;
revoke all on function public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text
) from anon;
