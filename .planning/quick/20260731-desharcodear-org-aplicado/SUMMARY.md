# Desharcodear la org: APLICADO en produccion (2026-07-31)

## Que se hizo

Se aplicaron contra `luillpzfqzbpoqkgvjuw` las migraciones 0035, 0036, 0037, 0038
y una 0040 nueva. La constante `aa29aa2f-4d34-4e53-b62c-7397e8a4d123` deja de
estar escrita adentro de las funciones y pasa a vivir en una sola fila:
`staff_app.organizations.is_default = true`.

## Tres cosas que aparecieron al aplicar (no estaban en el plan)

1. **La rama `desharcodear-org` estaba 10 commits ATRAS de `main`.** Mergearla
   como estaba habria revertido el cron unico diario (`409db85`), la pantalla de
   leads de productor, la migracion 0039 y los 5 commits de conversion del 30/7.
   Se mergeo `main` a la rama primero (sin conflictos).

2. **La 0038 tenia un bug que la abortaba entera.** Los `REVOKE`/`GRANT` de
   `staff_app_register_applicant` listaban 24 tipos, pero la funcion nueva tiene
   25 (suma `p_org_slug`). Postgres cortaba con 42883 apuntando a la funcion que
   el `DROP` acababa de borrar. Rollback limpio, nada quedo a medias. Arreglado
   en el archivo.

3. **Los dos archivos que entraron por el merge seguian con el patron viejo.**
   `leads/lead-actions.ts` y `auth/callback/route.ts` leian
   `staff_app_my_membership` con `.maybeSingle()`, que es exactamente el bug
   PGRST116 que la 0035 vino a resolver. Pasan a `exigirOrg()` / `orgActual()`.
   El de `auth/callback` era el peor lugar posible: es la puerta de entrada.

## La 0040 (nueva)

Cierra la deuda que la 0039 dejo anotada en su propio archivo: las dos funciones
de leads de productor tenian la org escrita a mano.

- `staff_app_registrar_lead_productor` suma `p_org_slug` (mismo patron que
  `register_applicant`) y resuelve por `default_org_id()` si no viene.
- `staff_app_marcar_lead_estado` ahora resuelve la org DEL LEAD y recien despues
  gatea con `is_org_writer` sobre esa org. Antes gateaba contra una constante, o
  sea que un writer de una segunda productora no podia tocar ni sus propios leads.

## Vuelta atras

`Desktop/SOMOS DER/PARA-FRANCO/_rollback-laburo-funciones-ANTES-de-0035.sql`
tiene la definicion EXACTA de las 49 funciones como estaban antes, sacada con
`pg_get_functiondef()` de la base real. Correrlo entero las deja como estaban.

No se uso un branch de Supabase porque se cobran por hora y la regla es cero gasto.

## Verificado

- `tsc --noEmit` y `next build` en verde, las 5 rutas de cron en el listado.
- Ninguna funcion viva contiene el UUID.
- Ningun nombre de RPC quedo con dos overloads (el error 42725 que temia el plan).
- `resolve_org(NULL)` devuelve el mismo UUID que estaba hardcodeado.
