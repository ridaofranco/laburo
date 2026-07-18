-- staff_app_0015_profiles_view_documento_fecha
-- El productor tiene que ver DNI/CUIT y edad del candidato (se registran pero la
-- vista no los exponía). Se agregan documento y fecha_nacimiento a la vista de
-- lectura (security_invoker: RLS is_org_member). Columnas nuevas AL FINAL porque
-- create-or-replace view no permite reordenar. (Aplicada en vivo por MCP el
-- 2026-07-18; versionada acá para que un rebuild reconstruya la base igual — sin
-- esto, PROFILE_COLUMNS pide documento/fecha_nacimiento y PostgREST tira 42703 →
-- 404 en TODO perfil de candidato.)
create or replace view public.staff_app_profiles with (security_invoker = true) as
select id, nombre, apellido, oficios, oficios_otro, provincia, ciudad,
       experiencia, anios_experiencia, eventos_trabajados, experiencia_detalle,
       disponibilidad_finde, disponibilidad_viajar, movilidad_propia,
       disponibilidad_aviso, estado, cv_url, portfolio_url, linkedin_url,
       telefono, email, situacion_legal, donde_trabajar, pais_residencia,
       motivacion, organization_id, documento, fecha_nacimiento
from staff_app.staff_profiles;
