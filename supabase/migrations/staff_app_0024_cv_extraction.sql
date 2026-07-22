-- staff_app_0024_cv_extraction
-- Columna cv_data (ficha estructurada extraída del CV con Gemini) + RPC de escritura
-- service-role-only para el batch de extracción de los ~680 CVs del pool.
-- Modelo "broker": guardamos formación/experiencia; el contacto NO va acá (queda
-- en las columnas existentes, solo para gestión interna).

alter table staff_app.staff_profiles
  add column if not exists cv_data jsonb;

-- Escritura idempotente y no destructiva:
--  - cv_data: se setea (fuente = extracción).
--  - experiencia_detalle: se completa (hoy vacío en los 680); si ya hubiera texto, no se pisa.
--  - anios_experiencia / oficios: SOLO si están vacíos (no pisar el dato del import).
create or replace function public.staff_app_set_cv_data(
  p_id                  uuid,
  p_cv_data             jsonb,
  p_experiencia_detalle text,
  p_anios               text,
  p_oficios             text[]
) returns void
language plpgsql
security definer
set search_path = public, staff_app
as $$
begin
  update staff_app.staff_profiles sp set
    cv_data = p_cv_data,
    experiencia_detalle = coalesce(nullif(sp.experiencia_detalle, ''), nullif(p_experiencia_detalle, '')),
    anios_experiencia = case
      when sp.anios_experiencia is null or sp.anios_experiencia = '' then p_anios
      else sp.anios_experiencia end,
    oficios = case
      when sp.oficios is null or array_length(sp.oficios, 1) is null then p_oficios
      else sp.oficios end
  where sp.id = p_id;
end;
$$;

-- Gotcha del repo: CREATE OR REPLACE re-grantea por default privileges → revocar anon explícito.
revoke all on function public.staff_app_set_cv_data(uuid, jsonb, text, text, text[]) from public, anon, authenticated;
grant execute on function public.staff_app_set_cv_data(uuid, jsonb, text, text, text[]) to service_role;

-- Lectura de pendientes para el batch (cv en Drive y todavía sin cv_data). Resumible solo.
create or replace function public.staff_app_cvs_pending(p_limit int default 1000)
returns table(id uuid, cv_url text)
language sql
security definer
set search_path = public, staff_app
as $$
  select sp.id, sp.cv_url
  from staff_app.staff_profiles sp
  where sp.cv_url is not null and sp.cv_url <> ''
    and sp.cv_url like '%drive.google%'
    and sp.cv_data is null
  order by sp.created_at desc
  limit p_limit;
$$;

revoke all on function public.staff_app_cvs_pending(int) from public, anon, authenticated;
grant execute on function public.staff_app_cvs_pending(int) to service_role;
