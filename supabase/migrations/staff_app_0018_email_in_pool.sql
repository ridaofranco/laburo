-- staff_app_0018_email_in_pool
--
-- Gate del login de staff (Lote 2). El login mandaba el magic link con
-- shouldCreateUser:true directo desde el browser a CUALQUIER email → abría
-- email-bombing (mandar links a direcciones ajenas) y llenaba auth.users de
-- cuentas basura de gente que no está en el pool.
--
-- Esta función chequea, server-side y solo con service_role, si un email está
-- en el pool de staff. La server action la llama ANTES de mandar el OTP y
-- responde SIEMPRE lo mismo al browser (sin oráculo de enumeración público:
-- nadie puede averiguar quién está en el pool). Granteada SOLO a service_role.

create or replace function public.staff_app_email_in_pool(p_email text)
returns boolean
language sql
security definer
set search_path to 'staff_app', 'pg_temp'
as $$
  select exists (
    select 1 from staff_app.staff_profiles
    where lower(email) = lower(btrim(p_email))
      and organization_id = 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'
  );
$$;
-- Supabase grantea execute a anon/authenticated por default privileges: hay que
-- revocarlos explícito para que la función sea SOLO service_role (server-side).
revoke all on function public.staff_app_email_in_pool(text) from public, anon, authenticated;
grant execute on function public.staff_app_email_in_pool(text) to service_role;
