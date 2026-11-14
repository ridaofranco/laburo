-- BOLSA DE TRABAJO PÚBLICA (14/11, Franco: «que cualquiera pueda poner a
-- disposición una posición de trabajo para que se postulen, tipo LinkedIn»).
--
-- Las búsquedas ya existían (0052/0053/0107): cualquier empresa o persona
-- registrada con CUIT o DNI publica, y el staff se postula desde /trabajos.
-- Lo que faltaba es verlas SIN cuenta: /empleos y /empleos/<id>, para
-- compartir por WhatsApp e Instagram y para que las encuentre Google.
--
-- Mismo filtro que staff_app_trabajos_abiertos (publicada, no cerrada, no
-- moderada, evento por venir). NO devuelve la dirección exacta del evento
-- (se ve al postularse) ni nada de la persona que mira.

create or replace function public.staff_app_empleos_publicos()
returns jsonb language sql stable security definer set search_path to 'staff_app', 'pg_temp' as $$
  select coalesce(jsonb_agg(j order by starts_at asc nulls last, publicado_at desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', o.id, 'role', o.role, 'cupo', o.cupo, 'pago', o.pago, 'notas', o.notas,
      'horario', o.horario, 'vestimenta', o.vestimenta, 'comida', o.comida, 'traslado', o.traslado,
      'forma_pago', o.forma_pago, 'plazo_pago', o.plazo_pago,
      'evento', g.title, 'empieza', g.starts_at, 'termina', g.ends_at, 'lugar', g.venue_name,
      'publica', org.name, 'publicado_at', o.publicado_at
    ) as j, g.starts_at, o.publicado_at
    from staff_app.gig_openings o
    join staff_app.gigs g on g.id = o.gig_id
    join staff_app.organizations org on org.id = o.organization_id
    where o.publicado_at is not null and o.cerrado_at is null and o.moderada_at is null
      and (g.starts_at is null or g.starts_at > now())
  ) x;
$$;

create or replace function public.staff_app_empleo_publico(p_id uuid)
returns jsonb language sql stable security definer set search_path to 'staff_app', 'pg_temp' as $$
  select jsonb_build_object(
    'id', o.id, 'role', o.role, 'cupo', o.cupo, 'pago', o.pago, 'notas', o.notas,
    'horario', o.horario, 'vestimenta', o.vestimenta, 'comida', o.comida, 'traslado', o.traslado,
    'forma_pago', o.forma_pago, 'plazo_pago', o.plazo_pago,
    'evento', g.title, 'empieza', g.starts_at, 'termina', g.ends_at, 'lugar', g.venue_name,
    'publica', org.name, 'publicado_at', o.publicado_at
  )
  from staff_app.gig_openings o
  join staff_app.gigs g on g.id = o.gig_id
  join staff_app.organizations org on org.id = o.organization_id
  where o.id = p_id
    and o.publicado_at is not null and o.cerrado_at is null and o.moderada_at is null
    and (g.starts_at is null or g.starts_at > now());
$$;

revoke execute on function public.staff_app_empleos_publicos(), public.staff_app_empleo_publico(uuid) from public;
grant execute on function public.staff_app_empleos_publicos(), public.staff_app_empleo_publico(uuid) to anon, authenticated, service_role;
