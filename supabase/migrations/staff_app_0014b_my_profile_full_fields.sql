-- staff_app_0014b_my_profile_full_fields
-- staff_app_my_staff_profile ahora devuelve TODOS los campos editables (agrega
-- documento, fecha_nacimiento, donde_trabajar, situacion_legal). Sin esto el
-- editor de perfil prefillea esos campos vacíos y el primer guardado los borra.
-- (Se aplicó en vivo por MCP el 2026-07-17; este archivo la deja versionada en el
-- repo para que cualquier rebuild/clone reconstruya la base igual.)
create or replace function public.staff_app_my_staff_profile()
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.email(), ''));
  v_org   uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';
  r       staff_app.staff_profiles%rowtype;
begin
  if v_email = '' then return null; end if;
  select * into r from staff_app.staff_profiles
   where lower(email) = v_email and organization_id = v_org
   order by created_at asc, id asc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'nombre', r.nombre, 'apellido', r.apellido,
    'email', r.email, 'telefono', r.telefono, 'documento', r.documento,
    'fecha_nacimiento', r.fecha_nacimiento,
    'oficios', r.oficios, 'oficios_otro', r.oficios_otro,
    'provincia', r.provincia, 'ciudad', r.ciudad, 'pais_residencia', r.pais_residencia,
    'donde_trabajar', r.donde_trabajar, 'situacion_legal', r.situacion_legal,
    'disponibilidad_aviso', r.disponibilidad_aviso,
    'disponibilidad_finde', r.disponibilidad_finde,
    'disponibilidad_viajar', r.disponibilidad_viajar,
    'movilidad_propia', r.movilidad_propia,
    'experiencia', r.experiencia, 'anios_experiencia', r.anios_experiencia,
    'experiencia_detalle', r.experiencia_detalle, 'eventos_trabajados', r.eventos_trabajados,
    'linkedin_url', r.linkedin_url, 'portfolio_url', r.portfolio_url,
    'cv_url', r.cv_url, 'motivacion', r.motivacion
  );
end;
$$;
