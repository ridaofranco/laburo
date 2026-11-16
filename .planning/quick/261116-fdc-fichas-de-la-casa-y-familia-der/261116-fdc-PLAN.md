---
fase: quick/261116-fdc-fichas-de-la-casa-y-familia-der
tipo: execute
modo: quick
autonomo: true
tareas: 3
migraciones_pendientes: []
base: 5457cd7
archivos:
  - lib/categorias-proveedor.ts
  - lib/fichas-de-la-casa.ts
  - components/familia-der.tsx
  - app/servicios/[slug]/page.tsx
  - app/servicios/page.tsx
  - app/salones/page.tsx
  - app/salones/[slug]/page.tsx
  - app/blog/chrome.tsx
  - app/page.tsx
---

# Fichas de la casa en la vidriera y pie con la familia SOMOS DER

Pedido de Franco (16/11/2026): «deberías crear como productos en LABURO a mis productos y
productoras y ofrecer sus servicios, ahí tenés el principal directorio propio, y mis productos
entre sí deberían hablarse».

## Datos (ya cargados en producción el 16/11, sin migración)

`staff_app.marketplace_profiles` (tipo proveedor, `is_public`, `is_verified`, `origen = alta_abierta`,
`armado_por` vacío para que no entren en las tandas de invitación de la red):

| slug | ficha | servicios |
|---|---|---|
| `somos-der` | ya existía: titular corregido, país, web con https, verificada | 18 |
| `pase` | nueva (`franco+pase@somosder.ar`) | 5 |
| `hito` | nueva (`franco+hito@somosder.ar`) | 4 |
| `entra` | nueva (`franco+entra@somosder.ar`) | 2 |

Los mails con `+` caen en la casilla de Franco: la clave única es `(lower(email), tipo)` y la
consulta del formulario se manda a ese mail.

## Tareas

1. `lib/categorias-proveedor.ts`: rubros «Ticketera y venta de entradas» y «Consultoría y negocio».
2. `lib/fichas-de-la-casa.ts` + `app/servicios/[slug]/page.tsx`: en las fichas de la casa el
   enlace al sitio sale sin `nofollow` y con el dominio como texto (en el resto queda «Su web»
   con `nofollow`, como estaba).
3. `components/familia-der.tsx`: renglón con los otros productos (SOMOS DER, PASE, ENTRÁ, HITO),
   con la búsqueda como texto del enlace. Va en el pie de `/servicios`, `/servicios/[slug]`,
   `/salones`, `/salones/[slug]` y el blog en español. En la portada se corrige el texto de los
   enlaces que ya estaban.

## Verificación

`npx tsc --noEmit`, `npm run lint` sobre lo tocado, build, y en producción: las 4 fichas responden
200, son indexables, muestran «verificado por SOMOS DER» y el enlace al sitio sin `nofollow`.
