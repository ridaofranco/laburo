---
fase: quick/261116-fdc-fichas-de-la-casa-y-familia-der
status: complete
commit: ae21214
fecha: 2026-11-16
---

# Resumen

- Las fichas `somos-der` (18 servicios), `pase` (5), `hito` (4) y `entra` (2) están publicadas y
  verificadas en la vidriera; por estar verificadas salen primero en `/servicios`.
- En esas cuatro fichas el enlace al sitio sale sin `nofollow` y con el dominio como texto.
- Renglón «También de SOMOS DER» en el pie de `/servicios`, `/servicios/[slug]`, `/salones`,
  `/salones/[slug]` y el blog en español. En la portada se cambió el texto de los enlaces que ya
  estaban y se sumó HITO.
- Rubros nuevos: «Ticketera y venta de entradas» y «Consultoría y negocio».

## Verificado en producción (16/11)

`/servicios/pase`, `/hito`, `/entra` y `/somos-der` responden 200, son indexables, muestran
«verificado por SOMOS DER», el enlace al sitio con `rel="noopener"` y el renglón de la familia.
`npx tsc --noEmit` sin errores; lint sin errores (1 aviso viejo en `app/page.tsx`).

## Para tener en cuenta

- Las fichas de PASE, HITO y ENTRÁ usan `franco+pase@`, `franco+hito@` y `franco+entra@somosder.ar`:
  las consultas del formulario llegan a la casilla de Franco. No están atadas a un usuario, así que
  no se editan desde `/mi-proveedor`: se editan en la base.
- No hubo migraciones. Los textos salen de las páginas de cada producto.
