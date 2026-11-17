---
fase: quick/261117-ori-origen-de-consultas
tipo: execute
modo: quick
autonomo: true
tareas: 3
migraciones_pendientes: []
base: bd9dba2
archivos:
  - public/origen-casa.js
  - lib/origen.ts
  - components/origen-casa.tsx
  - app/layout.tsx
  - app/landing/lead-form.tsx
  - components/vidriera/consulta-publica-form.tsx
  - app/registrar-productora/registro-client.tsx
  - app/empleos/[id]/page.tsx
  - app/servicios/filtros.tsx
  - app/salones/filtros.tsx
  - app/licitaciones/[slug]/licitacion-client.tsx
  - app/sumate/registro-rapido.tsx
  - app/sumate/registro-form.tsx
  - app/registrar-proveedor/registro-client.tsx
  - app/registrar-salon/registro-client.tsx
  - app/entrar/entrar-client.tsx
  - app/login/login-form.tsx
  - app/acceso-staff/staff-login-form.tsx
---

# Origen de cada consulta de LABURO, igual que en somosder.ar

Pedido de Franco (17/11/2026): LABURO no mide de dónde viene cada consulta (pauta, Google,
ChatGPT, directo). somosder.ar sí: guarda la cookie propia `der_o` en la primera visita y, cuando
alguien toca WhatsApp, un mail o manda un formulario, avisa a `https://www.somosder.ar/api/origen`,
que lo guarda en Sales OS (tabla `web_origen_clics`). El receptor ya acepta avisos de
`laburo.somosder.ar`. El rastreador (`origen-casa.js`) viene escrito y validado: no se reescribe.

Regla: el visitante no ve nada. No se toca ningún enlace, texto, mensaje ni formulario visible.
Sin migraciones ni variables de entorno.

## Tareas

1. `public/origen-casa.js` (copia del rastreador común) + `components/origen-casa.tsx` en
   `app/layout.tsx`. No hay un layout solo para lo público, así que el componente mira la ruta:
   carga el archivo con `next/script` (afterInteractive) solo en las páginas públicas (portada,
   `/para`, `/servicios`, `/salones`, `/blog`, `/en` `/pt` `/fr` `/it`, `/empleos`, `/licitaciones`,
   las puertas de alta y los textos legales). Como la navegación interna no recarga la página, el
   rastreador sigue vivo si alguien pasa de la portada al portal: para eso la copia de LABURO lleva
   un único ajuste, una pausa (`window.derOrigenPausa`) que el componente prende fuera de lo
   público. Sin eso, cada WhatsApp que una productora le manda a un trabajador desde el portal
   quedaría anotado como una consulta.
2. Consultas, contadas cuando el envío salió bien y no al tocar el botón (los tres formularios
   validan en el navegador después del envío y pueden rechazarlo; contando el intento habría
   consultas de más): portada `pedido-de-personal`, ficha de proveedor `consulta-proveedor`, ficha
   de salón `consulta-salon`, alta de productora `alta-productora`. El formulario lleva
   `data-origen="no"` y el aviso sale de `lib/origen.ts` (`avisarConsulta`).
3. Lo que no es una consulta lleva `data-origen="no"`: filtros de `/servicios` y `/salones`, alta
   de trabajadores (`/sumate`), alta de proveedor y de salón, pedido de link de una licitación y
   los tres ingresos (`/entrar`, `/login`, `/acceso-staff`). El enlace «Compartir por WhatsApp» de
   `/empleos/[id]` lleva `data-origen="compartir"` para poder separarlo de un contacto.

## Verificación

`npx tsc --noEmit` y lint sobre lo tocado (sin compilar acá: el servidor está justo de memoria,
compila Vercel). En producción: `/origen-casa.js` responde 200 como JavaScript y las páginas
públicas lo cargan. La prueba de un aviso real al receptor la hace Franco.
