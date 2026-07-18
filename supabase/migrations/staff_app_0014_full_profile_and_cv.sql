-- staff_app_0014_full_profile_and_cv
--
-- El editor de perfil del staff tiene que reflejar TODO el formulario real de
-- postulación de SOMOS DER (StaffRegistro), no una fracción. Se reemplaza el
-- update anterior (14 campos) por uno completo (todos los campos editables del
-- form) y se agrega un RPC dedicado para el CV (subida vía service-role +
-- guardado del cv_url). Sigue scoped por email verificado (fila propia), sin RLS
-- nueva sobre staff_profiles.

-- Baja el update parcial anterior (0012).
drop function if exists public.staff_app_update_my_staff_profile(
  text, text, text, text[], text, text, boolean, boolean, boolean, text, text, text, text, text
);

create or replace function public.staff_app_update_my_staff_profile(
  p_nombre text, p_apellido text, p_telefono text, p_documento text,
  p_fecha_nacimiento date, p_pais_residencia text, p_provincia text, p_ciudad text,
  p_donde_trabajar text[], p_situacion_legal text,
  p_oficios text[], p_oficios_otro text,
  p_experiencia boolean, p_anios_experiencia text, p_experiencia_detalle text,
  p_disponibilidad_finde boolean, p_disponibilidad_viajar boolean, p_movilidad_propia boolean,
  p_disponibilidad_aviso text,
  p_linkedin_url text, p_portfolio_url text, p_motivacion text
)
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

  update staff_app.staff_profiles set
    nombre               = coalesce(nullif(btrim(p_nombre), ''), nombre),
    apellido             = nullif(btrim(p_apellido), ''),
    telefono             = nullif(btrim(p_telefono), ''),
    documento            = nullif(btrim(p_documento), ''),
    fecha_nacimiento     = p_fecha_nacimiento,
    pais_residencia      = nullif(btrim(p_pais_residencia), ''),
    provincia            = nullif(btrim(p_provincia), ''),
    ciudad               = nullif(btrim(p_ciudad), ''),
    donde_trabajar       = case when p_donde_trabajar is null then donde_trabajar else p_donde_trabajar end,
    situacion_legal      = nullif(btrim(p_situacion_legal), ''),
    oficios              = case when p_oficios is null then oficios else p_oficios end,
    oficios_otro         = nullif(btrim(p_oficios_otro), ''),
    experiencia          = coalesce(p_experiencia, experiencia),
    anios_experiencia    = nullif(btrim(p_anios_experiencia), ''),
    experiencia_detalle  = nullif(btrim(p_experiencia_detalle), ''),
    disponibilidad_finde  = coalesce(p_disponibilidad_finde, disponibilidad_finde),
    disponibilidad_viajar = coalesce(p_disponibilidad_viajar, disponibilidad_viajar),
    movilidad_propia      = coalesce(p_movilidad_propia, movilidad_propia),
    disponibilidad_aviso = nullif(btrim(p_disponibilidad_aviso), ''),
    linkedin_url         = nullif(btrim(p_linkedin_url), ''),
    portfolio_url        = nullif(btrim(p_portfolio_url), ''),
    motivacion           = nullif(btrim(p_motivacion), '')
  where id = v_pid;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text
) from public;
grant execute on function public.staff_app_update_my_staff_profile(
  text, text, text, text, date, text, text, text, text[], text, text[], text,
  boolean, text, text, boolean, boolean, boolean, text, text, text, text
) to authenticated;

-- Guardar el cv_url del propio staff (tras subir el archivo al bucket).
create or replace function public.staff_app_update_my_cv(p_cv_url text)
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

  update staff_app.staff_profiles set cv_url = nullif(btrim(p_cv_url), '') where id = v_pid;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.staff_app_update_my_cv(text) from public;
grant execute on function public.staff_app_update_my_cv(text) to authenticated;
