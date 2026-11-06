-- RED DE PROVEEDORES Y SALONES DE SOMOS DER (6/11).
--
-- Decisión de Franco: a todos los proveedores y salones que nos escribieron
-- (Argentina, Latinoamérica, México, Canadá, Europa) les armamos el perfil
-- nosotros y los invitamos por mail a sumarse gratis. Una sola lista, que se ve
-- en LABURO y en HITO. marketplace_profiles ya es esa lista (tiene tipo
-- proveedor / salón y el puente legacy_vendor_id a HITO); acá se le suma lo que
-- hace falta para este circuito.
--
-- Reglas que esta migración hace cumplir en la base:
--   * El perfil armado por nosotros nace OCULTO (is_public = false). Se publica
--     después, con lo que ya es público del negocio.
--   * Los precios se muestran SOLO si el proveedor dijo que sí
--     (precios_publicos). El tarifario de DER no entra nunca acá.
--   * La baja es inmediata e irreversible desde el link del mail: oculta el
--     perfil y no se le vuelve a escribir.

alter table staff_app.marketplace_profiles
  add column if not exists pais text,
  add column if not exists armado_por text,              -- 'red_der' cuando lo armamos nosotros
  add column if not exists fuente text,                  -- de dónde salió (red-latam, correo-ar, whatsapp)
  add column if not exists precios_publicos boolean not null default false,
  add column if not exists invitado_at timestamptz,      -- cuándo salió el mail de invitación
  add column if not exists reclamado_at timestamptz,     -- cuándo el dueño entró y lo hizo suyo
  add column if not exists baja_at timestamptz,          -- pidió no aparecer: no se publica ni se le escribe
  add column if not exists baja_token text unique;

create index if not exists marketplace_profiles_pais_idx on staff_app.marketplace_profiles (pais);
create index if not exists marketplace_profiles_red_idx on staff_app.marketplace_profiles (armado_por) where armado_por is not null;

-- Un perfil dado de baja nunca puede quedar público.
create or replace function staff_app.red_baja_oculta()
returns trigger language plpgsql as $$
begin
  if new.baja_at is not null then new.is_public := false; end if;
  return new;
end $$;
drop trigger if exists red_baja_oculta on staff_app.marketplace_profiles;
create trigger red_baja_oculta before insert or update on staff_app.marketplace_profiles
  for each row execute function staff_app.red_baja_oculta();

-- Baja desde el link del mail (sin sesión). Devuelve el nombre para confirmarle.
create or replace function public.staff_app_red_baja(p_token text)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'public' as $$
declare v_nombre text;
begin
  update staff_app.marketplace_profiles
     set baja_at = coalesce(baja_at, now()), is_public = false, updated_at = now()
   where baja_token = p_token
  returning display_name into v_nombre;
  if v_nombre is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'nombre', v_nombre);
end $$;

-- «Publiquen mis precios»: el proveedor lo acepta desde el link del mail.
create or replace function public.staff_app_red_aceptar_precios(p_token text)
returns jsonb language plpgsql security definer set search_path to 'staff_app', 'public' as $$
declare v_nombre text;
begin
  update staff_app.marketplace_profiles
     set precios_publicos = true, updated_at = now()
   where baja_token = p_token and baja_at is null
  returning display_name into v_nombre;
  return jsonb_build_object('ok', v_nombre is not null, 'nombre', v_nombre);
end $$;

revoke execute on function public.staff_app_red_baja(text), public.staff_app_red_aceptar_precios(text) from public;
grant execute on function public.staff_app_red_baja(text), public.staff_app_red_aceptar_precios(text) to anon, authenticated;
