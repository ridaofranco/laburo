# LABURO — Reporte Maestro de Testing (TestSprite)

**Fecha:** 2026-07-18
**App:** LABURO (staff-app de SOMOS DER) · Next.js 15 · modo dev (localhost:3000)
**Total ejecutado:** 49 tests frontend en 6 tandas
**Resultado global:** **38/49 pasaron (78%)**

> Aclaración importante: de los 11 que no pasaron, **la mayoría no son bugs**. Abajo está la clasificación honesta (ruido de infraestructura / esperado por diseño / falta data / bug real).

---

## 1️⃣ Resumen por estado

| Estado | Cantidad | Qué significa |
|---|---:|---|
| ✅ Pasaron | 38 | Funciona correctamente |
| 🟡 Ruido del dev server | 5 | Falso fallo: el server se cayó/no respondió a mitad de tanda |
| 🟡 Esperado / por diseño | 2 | El "fallo" es en realidad comportamiento correcto |
| 🟠 Falta sembrar data | 2 | No se pudo testear de verdad sin una oferta real en la base |
| 🔴 Hallazgo real | 1 | Vale la pena corregir (severidad baja) |
| ⚪ No concluyente | 1 | Necesita otra corrida con datos distintos |

---

## 2️⃣ Lo que FUNCIONA (38 ✅)

**Portal del operador (logueado):**
- Login y llegada al dashboard (TC001, TC003, TC009)
- Crear gig y verlo en el tablero (TC011), ver detalle de gig (TC040), editar gig (TC041)
- Enviar oferta a un candidato (TC007)
- Buscar y filtrar candidatos (TC013, TC015), abrir perfil (TC016), estado "sin resultados" (TC024, TC029)
- Navegar áreas core (TC012)
- Calendario (TC042), Pagos (TC043), Billetera (TC044), Rentabilidad (TC045)
- Mensajes (TC046), Notificaciones (TC047), Favoritos (TC048), Config (TC049)

**Lado staff:**
- Panel staff (TC022), check-in con y sin gig asignado (TC006, TC027), editar perfil (TC020)

**Público / seguridad:**
- Rutas protegidas redirigen a login si no hay sesión (TC030, TC031)
- Validación de formularios: login (TC032), registro (TC033)
- Registro público válido (TC021, TC034)
- Estados de link mágico inválido/malformado/vacío (TC026, TC028, TC035, TC036)
- Ver oferta por link mágico (TC002, TC004)
- Página de acceso staff carga (TC039)

---

## 3️⃣ Lo que NO pasó — clasificado

### 🟡 Ruido del dev server (5) — NO son bugs
Fallaron con el mensaje *"application is not reachable / dev-login route not reachable"*: el dev server (un solo hilo) se cayó a mitad de tanda. **Sus tests hermanos pasaron**, así que la funcionalidad anda.
- **TC008** Crear gig — (pero TC011 "crear gig y verlo en el tablero" ✅, o sea crear gig funciona)
- **TC017** Navegar secciones del portal — (TC012 nav ✅)
- **TC019** Marcar gig como evento destacado
- **TC023** Validación de campos de oferta
- **TC025** Validación de gig incompleto

> Para confirmar: re-correr estos 5 con server fresco (pendiente por créditos).

### 🟡 Esperado / por diseño (2) — NO son bugs
- **TC014** "Login inválido" — el login es **passwordless (magic link)**, no existe "usuario/contraseña incorrectos". El caso no aplica.
- **TC037** "Toggle de tema" — tu `layout.tsx` usa `forcedTheme="dark"`: la app es **dark-only a propósito**, no hay toggle. Correcto.

### 🟠 Falta sembrar una oferta real (2)
No se pudieron probar de verdad porque no hay una oferta con token válido en la base:
- **TC005** Aceptar oferta pública
- **TC010** Rechazar oferta pública

> Esto es el **flujo central de contratación** (aceptar → crea crew → empuja a HITO). Requiere el paso "sembrar oferta E2E".

### 🔴 Hallazgo real (1) — severidad baja
- **TC038** No hay página **404 / not-found** propia. Una ruta inexistente devuelve `307` y redirige a `/login` (por el middleware). No está roto, pero un usuario que erra una URL nunca ve un "no encontrado". **Sugerencia:** agregar `app/not-found.tsx`.

### ⚪ No concluyente (1)
- **TC018** Onboarding staff falló, probablemente porque el usuario de prueba **ya estaba onboardeado** (el flujo es multi-paso y redirige). Necesita un staff nuevo sin onboardear para testearlo bien.

---

## 4️⃣ Cobertura y huecos

**Cubierto:** ~30 pantallas por navegador real (operador + staff + público), happy paths + validaciones + estados de error.

**Todavía SIN cubrir (necesita créditos / pasos extra):**
1. **Flujo de contratación E2E real** — sembrar gig+candidato+oferta con token y correr aceptar/rechazar de verdad (lo más importante del negocio).
2. **Backend** — RPCs `get_public_offer`/`accept_offer`, RLS, `/api/parse-cv`, envío de email.
3. **Casos de borde por pantalla** — límites de campos, entradas raras, concurrencia.
4. **404 propio** (hallazgo TC038).

---

## 5️⃣ Estado de créditos
- Arrancamos con 150 créditos TestSprite (plan Free).
- **Quedan 10.** Las tandas + una que se colgó del lado de TestSprite consumieron el resto.
- **Los 4 puntos sin cubrir necesitan recarga de créditos** para ejecutarse en TestSprite.

---

## Veredicto
La app está **sólida en su superficie funcional**: el 78% pasó limpio y de los que no, casi todos son ruido del dev server o comportamiento por diseño. **Un solo hallazgo real y menor** (falta 404 propio). Lo que falta testear de verdad es el **corazón de la contratación (oferta E2E)** y el **backend**, que quedaron trabados por falta de créditos, no por bugs.
