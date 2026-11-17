---
fase: quick/261117-ori-origen-de-consultas
status: complete
commit: ce78f2f
fecha: 2026-11-17
---

# Resumen

- `public/origen-casa.js` (el rastreador común de la casa) se carga con `next/script`
  (afterInteractive) desde `components/origen-casa.tsx`, puesto en `app/layout.tsx`, solo en las
  páginas públicas: portada, `/para`, `/servicios`, `/salones`, `/blog`, `/en` `/pt` `/fr` `/it`,
  `/empleos`, `/licitaciones`, `/registrarme`, `/registrar-productora`, `/registrar-proveedor`,
  `/registrar-salon`, `/sumate`, `/privacidad` y `/terminos` (la lista está en `lib/origen.ts`).
- Guarda la cookie propia `der_o` (primera visita, 90 días) y avisa a
  `https://www.somosder.ar/api/origen` cada clic a WhatsApp o a un mail. Queda en Sales OS, tabla
  `web_origen_clics`, con sitio `laburo.somosder.ar`.
- Consultas, anotadas cuando el envío salió bien (`avisarConsulta` en `lib/origen.ts`):
  `pedido-de-personal` (formulario de la portada), `consulta-proveedor` y `consulta-salon`
  (formulario de las fichas), `alta-productora` (una empresa crea su cuenta).
- No cuentan (`data-origen="no"`): filtros de `/servicios` y `/salones`, alta de trabajadores
  (`/sumate`, los dos formularios), alta de proveedor y de salón, pedido de link de una licitación,
  `/entrar`, `/login` y `/acceso-staff`.
- «Compartir por WhatsApp» de `/empleos/[id]` queda con ubicación `compartir`: es un `wa.me` sin
  número y el rastreador lo anota como clic a WhatsApp; así se lo separa de un contacto.

## Único ajuste sobre el rastreador común

La copia de LABURO tiene dos renglones más que la de los otros sitios: una pausa
(`window.derOrigenPausa`). La prende `components/origen-casa.tsx` fuera de las páginas públicas.
Hace falta porque pasar de la portada al portal no recarga la página y el rastreador seguiría
anotando como consulta cada WhatsApp o mail que se toca adentro de la aplicación. Si se actualiza
el rastreador común, hay que volver a sumar esos dos renglones.

## Verificado

- `npx eslint` sobre los archivos tocados: sin errores (1 aviso viejo en `app/sumate/registro-form.tsx`).
- `tsc --noEmit` limitado a los archivos tocados y lo que importan: sin errores. El chequeo de todo
  el proyecto y la compilación no se corrieron en el servidor (poca memoria): compiló Vercel, deploy
  del commit `ce78f2f` en `success`.
- En producción (17/11): `/origen-casa.js` responde 200 como `application/javascript` e igual al
  del repo; `/`, `/para`, `/servicios`, `/salones`, `/blog` y `/en/blog` lo cargan; `/entrar` no.

## Para tener en cuenta

- No había Content-Security-Policy (ni en `next.config.ts`, ni en `vercel.json`, ni en el
  middleware): no hubo que tocar nada.
- Los formularios del portal y de los paneles con sesión no se tocaron: ahí el rastreador no se
  carga y, si quedó cargado por venir de la portada, está en pausa.
- Sin migraciones ni variables de entorno. La prueba de un aviso real al receptor la hace Franco.
