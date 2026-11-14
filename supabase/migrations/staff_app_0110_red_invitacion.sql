-- INVITACIÓN A LA RED DE PROVEEDORES Y SALONES (14/11).
--
-- Los 758 perfiles que armó SOMOS DER (0108, armado_por = 'red_der') reciben
-- un mail de invitación en tandas diarias desde /api/cron/red-invitacion.
-- Decisión de Franco: máxima exposición, gratis, precios solo con su sí, baja
-- inmediata desde el mail.
--
-- Qué hace la tanda, en UNA sentencia (exactly-once, como las demás de 0038):
--   * elige los próximos sin invitar, sin baja y con mail: primero los que ya
--     nos contestaron alguna vez (fuente con «respuesta»);
--   * les genera la puerta a su panel (/acceso-proveedor/<token>, 90 días,
--     solo se guarda el sha256, igual que 0042);
--   * los publica (is_public = true): nombre, rubro y país, que es lo que ya es
--     público del negocio. Los precios NO (precios_publicos sigue en false);
--   * estampa invitado_at.
-- Si el mail falla, el perfil ya quedó marcado: preferimos perder una
-- invitación antes que mandar dos.

create or replace function public.staff_app_red_invitar_batch(p_limit int)
returns table (profile_id uuid, email text, nombre text, tipo text, pais text,
               rubro text, token text, baja_token text)
language plpgsql security definer set search_path to 'staff_app', 'public', 'extensions' as $$
begin
  return query
  with sel as (
    select m.id, encode(extensions.gen_random_bytes(32), 'hex') as raw
      from staff_app.marketplace_profiles m
     where m.armado_por = 'red_der'
       and m.invitado_at is null
       and m.baja_at is null
       and m.activo
       and m.email is not null and btrim(m.email) <> ''
     order by (coalesce(m.fuente, '') like '%respuesta%') desc, m.created_at, m.id
     limit least(greatest(coalesce(p_limit, 0), 0), 200)
     for update skip locked
  ), upd as (
    update staff_app.marketplace_profiles m
       set access_token_hash = encode(extensions.digest(sel.raw, 'sha256'), 'hex'),
           access_token_expires_at = now() + interval '90 days',
           access_token_last_used_at = null,
           is_public = true,
           invitado_at = now(),
           updated_at = now()
      from sel
     where m.id = sel.id
    returning m.id, m.email, m.display_name, m.tipo, m.pais, sel.raw, m.baja_token
  )
  select upd.id, upd.email, upd.display_name, upd.tipo, upd.pais,
         (select s.categoria from staff_app.provider_services s
           where s.profile_id = upd.id order by s.created_at limit 1),
         upd.raw, upd.baja_token
    from upd;
end $$;

create or replace function public.staff_app_red_invitar_pending()
returns int language sql stable security definer set search_path to 'staff_app', 'public' as $$
  select count(*)::int from staff_app.marketplace_profiles
   where armado_por = 'red_der' and invitado_at is null and baja_at is null
     and activo and email is not null and btrim(email) <> '';
$$;

revoke execute on function public.staff_app_red_invitar_batch(int), public.staff_app_red_invitar_pending() from public, anon, authenticated;
grant execute on function public.staff_app_red_invitar_batch(int), public.staff_app_red_invitar_pending() to service_role;
