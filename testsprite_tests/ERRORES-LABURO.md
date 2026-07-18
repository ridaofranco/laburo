# LABURO — Detalle COMPLETO de errores (TestSprite)

**Fecha:** 2026-07-18 · **App:** staff-app (LABURO) · Next.js 15, modo dev, localhost:3000
**Corrida:** 49 tests frontend · **38 pasaron / 11 no**
**Ojo:** leyendo el detalle fino, algunos "fallos" que parecían ruido resultaron **bugs reales**. Abajo está TODO, sin filtrar.

---

## 🔴 PRIORIDAD ALTA — bugs reales (arreglar primero)

### 1. El email de la oferta NO se envía (¡el corazón del flujo!)
- **Detectado en:** TC023 (validación de oferta)
- **Qué pasó:** al crear una oferta, la app mostró:
  > *"Oferta creada, pero el email no salió"* — detalle: *"No hay ninguna vía de envío de email configurada."*
- **Por qué importa:** el email lleva el **link mágico** que el staff usa para aceptar la oferta. Si no sale el mail, **nadie puede aceptar una contratación** por el flujo normal. Es lo más crítico de toda la corrida.
- **Causa probable:** faltan las credenciales SMTP (nodemailer) en el entorno, o no está cableado el transporte de email en dev.
- **Fix sugerido:** configurar las variables SMTP (el `email.js` que se copió de somosder-web) y probar el envío. Confirmar que en producción (Vercel) las env vars de SMTP estén cargadas.
- **Nota:** hay un fallback visible ("ENVIAR POR WHATSAPP" + link de la oferta), así que la oferta igual se puede compartir a mano — pero el canal automático está caído.
- 🔗 [Visualización TestSprite](https://www.testsprite.com/dashboard/mcp/tests/672957d9-5d1a-43e5-a219-de0a7ec3c5c9/8fe0f1b2-bd3a-4661-888e-ffa9f33d6631)

### 2. El formulario de oferta se envía sin validar campos requeridos
- **Detectado en:** TC023
- **Qué pasó:** se envió el formulario de oferta con campos requeridos vacíos y, en vez de mostrar un error de validación, **la oferta se creó igual**. No apareció ningún mensaje tipo "falta Condiciones" o similar.
- **Por qué importa:** se pueden generar ofertas incompletas/inválidas (sin condiciones, pago o fechas), que después llegan mal al candidato.
- **Fix sugerido:** validar en el submit (cliente + server action) los campos obligatorios antes de crear la oferta. Ya tenés `zod` + `react-hook-form` en el stack para esto.
- 🔗 misma visualización que arriba.

---

## 🟠 PRIORIDAD MEDIA — reales, de UX

### 3. Billetera y Mensajes no aparecen en el menú lateral
- **Detectado en:** TC017 (navegación del portal)
- **Qué pasó:** el sidebar muestra: Dashboard, Buscar, Eventos, Favoritos, Calendario, Rentabilidad, Pagos, Notificaciones, Ajustes, Logout. **Faltan "Billetera" (Wallet) y "Mensajes" (Messages).**
- **Detalle importante:** esas dos pantallas **SÍ existen y funcionan** (las probamos entrando por URL directa: TC044 Billetera ✅ y TC046 Mensajes ✅). El tema es que **no hay link en el menú** para llegar a ellas.
- **Fix sugerido:** agregar los ítems "Billetera" y "Mensajes" al `portal-nav.tsx` (o decidir si esas secciones van, y si no, quitar las páginas).
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/672957d9-5d1a-43e5-a219-de0a7ec3c5c9/b1b3c5da-fb3f-41f4-ad53-60953557f87c)

### 4. El onboarding de staff no avanza al hacer clic
- **Detectado en:** TC018 (onboarding staff)
- **Qué pasó:** en `/onboarding-staff` aparecen botones "Siguiente" y "Comenzar", pero al clickearlos (varios intentos, incluso scrolleando) **no aparecieron campos del formulario ni avanzó el flujo**. El panel staff (`/panel-staff`) sí es accesible.
- **Estado:** ⚠️ **no concluyente pero sospechoso.** Puede ser porque el usuario de prueba **ya estaba onboardeado** (y el flujo no re-onboardea), O puede ser un **bug real** donde los botones no disparan el avance.
- **Fix / próximo paso:** probar con un usuario staff **nuevo sin onboardear**. Si con uno nuevo tampoco avanza, es bug de la lógica de pasos del onboarding.
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/8138c135-2717-4f3a-ac34-b35b050589b7/1601e928-3389-4d85-880f-e84b9787f0db)

---

## 🟢 PRIORIDAD BAJA — real, menor

### 5. No hay página 404 propia
- **Detectado en:** TC038
- **Qué pasó:** al entrar a `/ruta-que-no-existe-xyz`, la app **redirige a `/login`** (HTTP 307 por el middleware) en vez de mostrar un "página no encontrada".
- **Por qué (menor):** un usuario que erra una URL nunca ve un mensaje de "no encontrado"; simplemente cae en login. No está roto, pero no es lo ideal.
- **Fix sugerido:** agregar `app/not-found.tsx` con un 404 propio (y, si querés, excluir del middleware las rutas claramente inexistentes).
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/9f9b56e6-fd6a-4018-9c62-0a6a62ce3980/d9478855-4581-4d42-9da7-fef55a4f5a8a)

---

## 🟡 NO son bugs — comportamiento por diseño

### 6. Login "con credenciales inválidas" no se pudo probar
- **Test:** TC014
- **Motivo:** la página de login **no tiene campo de contraseña**. Es un flujo **passwordless** (magic link + Google). No existe "usuario/contraseña incorrectos", así que el caso no aplica. Correcto.
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/3bb7c127-29c9-4b14-a4fd-ff8f6c230d64/7f6b2389-bae7-401d-afed-e53d0d190e4c)

### 7. Toggle de tema (oscuro/claro) no existe
- **Test:** TC037
- **Motivo:** tu `layout.tsx` usa `forcedTheme="dark"`: la app es **dark-only a propósito**. No hay toggle porque no debe haberlo. Correcto.
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/9f9b56e6-fd6a-4018-9c62-0a6a62ce3980/67d1e55a-5381-41fb-94a2-e25c8bcbba10)

---

## 🟡 NO son bugs — ruido del dev server (falsos fallos)
El dev server de Next (un solo hilo) se cayó a mitad de tanda. Estos NO son problemas de tu app; la funcionalidad la confirman los tests hermanos que sí pasaron. **Se deben re-correr con server fresco.**

### 8. TC019 — Marcar gig como evento destacado — BLOCKED
- **Error:** al ir a `/dev-login` el navegador mostró **`ERR_INVALID_HTTP_RESPONSE`** (server caído). No se pudo crear sesión ni seguir.
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/672957d9-5d1a-43e5-a219-de0a7ec3c5c9/16a93533-5919-4f62-8f43-aa2427f38407)

### 9. TC025 — Validación de gig incompleto — BLOCKED
- **Error:** `/dashboard` mostró **`ERR_INVALID_HTTP_RESPONSE`** ("This page isn't working"). Server caído.
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/672957d9-5d1a-43e5-a219-de0a7ec3c5c9/c4b189a4-89d6-43db-8a85-cb02df22e5da)

### 10. TC008 — Crear gig — BLOCKED
- **Error:** *"No se pudo iniciar la sesión admin: Email link is invalid or has expired"* — el token del magic-link de `/dev-login` expiró en ese intento puntual. (Crear gig en sí funciona: TC011 ✅.)
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/17983047-9822-4d85-9df3-84a0d3663f0f/65dd21ff-f5a4-4717-b72b-becb2d0111af)

---

## 🟠 BLOQUEADOS — necesitan una oferta real sembrada (paso E2E pendiente)
No se pudieron testear de verdad porque el token de oferta usado no corresponde a una oferta real en la base → la UI muestra correctamente *"Este link no es válido"*, pero por eso no hay botones de aceptar/rechazar para probar.

### 11. TC005 — Aceptar oferta pública — BLOCKED
- **Error:** la página muestra *"Este link no es válido"*; no hay detalle de oferta ni botón "Aceptar".
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/3bb7c127-29c9-4b14-a4fd-ff8f6c230d64/8ddf7152-ca18-4195-88be-36d1e96ffd8e)

### 12. TC010 — Rechazar oferta pública — FAIL
- **Error:** ídem, *"Este link no es válido"*; no hay botón "Rechazar".
- 🔗 [Visualización](https://www.testsprite.com/dashboard/mcp/tests/3bb7c127-29c9-4b14-a4fd-ff8f6c230d64/3ce45fa3-957c-49d0-99bd-80915deefdcf)

> Estos dos son el **flujo central de contratación**. Se testean de verdad en el paso "sembrar oferta real E2E" (pendiente por créditos).

---

## Resumen ejecutivo

| # | Hallazgo | Severidad | ¿Bug real? |
|---|---|---|---|
| 1 | Email de oferta no se envía (SMTP sin configurar) | 🔴 Alta | ✅ Sí |
| 2 | Oferta se crea sin validar campos requeridos | 🔴 Alta | ✅ Sí |
| 3 | Billetera y Mensajes faltan en el menú lateral | 🟠 Media | ✅ Sí |
| 4 | Onboarding staff no avanza al clickear | 🟠 Media | ⚠️ A confirmar |
| 5 | No hay página 404 propia | 🟢 Baja | ✅ Sí (menor) |
| 6 | Login sin campo password | — | ❌ Por diseño |
| 7 | Sin toggle de tema | — | ❌ Por diseño |
| 8-10 | ERR_INVALID_HTTP_RESPONSE / token dev-login | — | ❌ Ruido dev server |
| 11-12 | Aceptar/rechazar oferta | — | ⏸️ Falta oferta real |

**Prioridad de acción:** arreglar **#1 (email)** y **#2 (validación de oferta)** primero — son los que rompen el flujo real de contratación. Después #3 y #4 (UX), y #5 cuando haya tiempo.

**Pendiente (necesita recarga de créditos TestSprite):** sembrar oferta real y correr el E2E de contratación (aceptar→crea crew→push HITO), tests de backend (RPC/RLS/parse-cv/email) y casos de borde.
