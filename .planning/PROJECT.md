# Staff App (nombre pendiente — familia "by DER")

## What This Is

App de contratación de staff eventual para eventos. En v1 es la herramienta interna de SOMOS DER: Franco busca personal por rol y disponibilidad sobre la base real de postulantes (`staff_profiles`, alimentada por el formulario "Trabajá con nosotros" de somosder-web), ve el perfil/CV, manda una oferta con pago y fechas, y la persona acepta con un link mágico — al aceptar queda contratada en HITO (`crew_member` + `crew_assignment`). La visión de largo plazo es un marketplace multi-empleador de staff eventual.

## Core Value

Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Buscador de staff por rol/oficio y disponibilidad sobre `staff_profiles` (146+ postulantes reales)
- [ ] Vista de perfil del postulante: datos, oficios, experiencia, CV (bucket `staff-cvs`), links
- [ ] Crear oferta de trabajo: evento, rol, fechas, monto y condiciones (monto solo informativo)
- [ ] Envío de oferta por email (SMTP marca DER existente) + botón wa.me con mensaje pre-armado
- [ ] Link mágico de aceptación: el staff acepta/rechaza sin crear cuenta
- [ ] Al aceptar: se crea `crew_member` + `crew_assignment` en HITO, atado al evento
- [ ] Estado de cada oferta visible (enviada / vista / aceptada / rechazada / vencida)
- [ ] Datos multi-tenant desde el día 1: todo atado a `organization_id` (patrón HITO existente)
- [ ] Migrar `staff_profiles` al modelo multi-tenant (hoy es standalone sin org_id)

### Out of Scope

- Marketplace multi-empleador (registro de terceros, billing, moderación) — v2: primero validar el flujo con la operación propia de SOMOS DER; la arquitectura queda preparada
- Login/cuenta del staff — v2: el link mágico cubre v1 sin fricción; el panel del staff (perfil, disponibilidad, historial) llega después
- Integración MeCubro (seguros por contratado) — v2: se integra cuando el ciclo base esté validado; mientras tanto sigue el circuito actual
- Procesar/trackear pagos reales al staff — el monto es informativo en v1; el pago sigue por el circuito actual de Franco (complejidad fiscal/CBU no justificada aún)
- API oficial de WhatsApp (Meta) — costo por conversación + aprobación de plantillas; v1 usa email automático + wa.me manual en un tap

## Context

- **Base de datos existente:** Supabase HITO (`luillpzfqzbpoqkgvjuw`). Tablas relevantes: `staff_profiles` (29 cols, RLS, insert público anon vía formulario web), bucket privado `staff-cvs`, `crew_members`, `crew_assignments`, `events`, multi-tenant por `organization_id` con helpers `is_org_member`/`is_org_writer` y patrón de acceso público por token con funciones SECURITY DEFINER (ya probado en `register_web_lead`, `get_public_proposal`, `accept_proposal`).
- **Alimentación de datos ya en producción:** formulario `StaffRegistro.astro` en somosder-web (`/trabaja-con-nosotros`), multi-país, 64 oficios, sube CV real. Autollenado de CV con Gemini construido (falta encender: `GEMINI_API_KEY`).
- **Repo HITO:** `github.com/ridaofranco/HITO-by-DER` (copia local en `/Users/fridao/Proyectos/HITO-by-DER-main` y `~/Downloads/hito-live`). Next.js 15 App Router + React 19 + Supabase SSR + Drizzle + Tailwind + Base UI + Motion + Capacitor. Franco lo considera sobre-scoped (~40 secciones) y no lo lanzó; hay flags `SHOW_*` para ocultar secciones.
- **Decisión abierta (la resuelve el research):** app standalone nueva vs módulo dentro del repo HITO-by-DER.
- **Cuentas/orgs sin consolidar:** Franco tiene 2 cuentas (ridaofrancorg@gmail.com y franco@somosder.ar); la org "SOMOS DER" real con datos está en la cuenta de su socia (cottludmila@gmail.com). Consolidar antes de operar en serio.
- **Infra existente reutilizable:** SMTP propio marca DER (ferozo, `src/lib/email.js` en somosder-web), Vercel (CLI logueado como ridaofranco-8135), Gemini API (tier gratis).
- **Origen del problema:** Franco gestionaba contrataciones con Google Form→Sheet (146 postulantes) + WhatsApp manual. La visión completa está en su nota de voz: marketplace → contratar → pagos HITO → seguro MeCubro por contratado.

## Constraints

- **Presupuesto**: CERO gasto en servicios pagos — regla dura de Franco (no pagar APIs, no Zapier). Todo en tiers gratis (Supabase existente, Vercel hobby, SMTP propio, Gemini free tier).
- **Tech stack**: Supabase HITO como única fuente de verdad del staff — "todo tiene que estar atado a esta tabla" (`staff_profiles`) y al patrón multi-tenant de HITO. No duplicar bases.
- **Dependencias**: HITO es la capa de datos de contratación (`crew_members`, `crew_assignments`, `events`) — la app escribe ahí, no inventa tablas paralelas de crew.
- **Seguridad**: RLS obligatoria en toda tabla nueva; acceso público solo vía funciones SECURITY DEFINER por token (patrón existente). El link mágico sigue este patrón.
- **UX**: mobile-first — tanto Franco como el staff operan desde el teléfono.
- **Animaciones**: librería Motion (`motion`) — preferencia global del usuario.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Interno primero, marketplace después | Validar el flujo con la operación propia antes de abrir a terceros; menos scope en v1 | — Pending |
| Datos multi-tenant desde el día 1 | Abrir el marketplace después debe ser configuración, no reescritura; HITO ya es org-based | — Pending |
| Staff sin cuenta: link mágico | Cero fricción para trabajadores de eventos; patrón token+SECURITY DEFINER ya probado en HITO | — Pending |
| Canal de oferta: email automático + wa.me en un tap | Email gratis con SMTP propio; WhatsApp API oficial cuesta y burocratiza; wa.me refuerza donde vive el staff | — Pending |
| Pagos solo informativos en v1 | Registrar monto/condiciones sin procesar plata; evita complejidad fiscal prematura | — Pending |
| MeCubro en v2 | Integrar seguros recién con el ciclo base validado | — Pending |
| Arquitectura standalone vs módulo HITO: decide el research | Franco no quiso decidir a ciegas; el research compara contra la DB y el repo reales | — Pending |
| Éxito v1 = 1 contratación real completa + Franco deja el Sheet | Criterio doble: funcional (ciclo entero con una persona real) y de adopción (la próxima búsqueda se gestiona 100% en la app) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-08 after initialization*
