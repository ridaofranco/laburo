# LABURO — Staff App (SOMOS DER)

## What This Is

App de contratación de staff eventual para eventos — **producto independiente con base de datos propia**, que corre por su cuenta y a la vez está **integrado a HITO** (no fusionado). Tiene sus propios trabajadores, sus propios eventos/gigs y su propio crew. En v1 es la herramienta interna de SOMOS DER: Franco busca personal por rol y disponibilidad sobre su pool real de postulantes, ve el perfil/CV, manda una oferta con pago y fechas, y la persona acepta con un link mágico — al aceptar queda contratada como crew **de la app**. Si ese gig está marcado como evento de HITO, además se empuja a HITO como `crew_member` + `crew_assignment` para gestionarlo/evaluarlo/pagarlo desde HITO. La visión de largo plazo es un marketplace multi-empleador de staff eventual.

## Core Value

Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual. La integración con HITO es un puente opcional, no un requisito para que la app funcione.

## Requirements

### Validated

- [x] Base de datos PROPIA de la app — *Validated in Phase 1 (2026-07-14)*: schema `staff_app` dentro del proyecto de HITO (decisión D-03 por límite free-tier), tablas propias org-scoped con RLS, RPCs de link mágico SQL-tested
- [x] Backfill de postulantes — *Validated in Phase 1*: eran 711 en el Google Sheet (no 146 en HITO) + 8 del form web = **687 en la base tras dedup**, ubicación normalizada a provincias oficiales
- [x] Formulario "Trabajá con nosotros" repuntado — *Validated in Phase 1*: escribe en `staff_app` vía RPC endurecida, deploy verificado en producción con test real, aviso de consentimiento Ley 25.326 agregado

### Active
- [ ] Buscador de staff por rol/oficio y disponibilidad sobre el pool propio (los 64 oficios)
- [ ] Vista de perfil del postulante: datos, oficios, experiencia, CV, links
- [ ] Crear un gig/evento propio de la app (opcionalmente vinculable a un evento de HITO), con rol, fechas, monto informativo y condiciones
- [ ] Envío de oferta por email (SMTP marca DER) + botón wa.me con mensaje pre-armado
- [ ] Link mágico de aceptación: el staff acepta/rechaza sin crear cuenta
- [ ] Al aceptar: se crea crew **en la app**; y **si el gig está vinculado a un evento de HITO**, se empuja `crew_member` + `crew_assignment` a HITO por el puente (función/RPC de HITO)
- [ ] Estado de cada oferta visible (enviada / vista / aceptada / rechazada / vencida)
- [ ] Tablero de ofertas por gig (qué roles están cubiertos y cuáles no)

### Out of Scope

- Marketplace multi-empleador (registro de terceros, billing, moderación) — v2: primero validar el flujo con la operación propia de SOMOS DER; la arquitectura queda preparada (org-scoped)
- Login/cuenta del staff — v2: el link mágico cubre v1 sin fricción; el panel del staff (perfil, disponibilidad, historial) llega después
- MCP para que una IA opere la app hablándole ("buscá 3 bartenders y ofertá") — v2 opcional; NO es el mecanismo de integración con HITO (para datos, el puente es una función/RPC, no un MCP)
- Integración MeCubro (seguros por contratado) — v2: se integra cuando el ciclo base esté validado
- Procesar/trackear pagos reales al staff — el monto es informativo en v1; el pago sigue por el circuito actual de Franco
- API oficial de WhatsApp (Meta) — costo por conversación + aprobación de plantillas; v1 usa email automático + wa.me manual en un tap
- La app dependiendo de HITO para funcionar — explícitamente NO: la app corre sola; HITO es un puente opcional por gig

## Context

- **Base de datos propia (nueva):** la app tendrá su propio proyecto Supabase (crear en la org `wsvqlrjmizvivgrgnfpw`, costo verificado $0). Es dueña de sus datos: staff, gigs, crew, ofertas. Nada de escribir en las tablas de HITO como si fuera parte de HITO.
- **Puente con HITO (integración, no fusión):** el servidor de la app (Next.js) tiene credenciales de las dos bases. Cuando un gig está vinculado a un evento de HITO y se confirma un trabajador, la app llama a una función SECURITY DEFINER de HITO (mismo patrón ya probado: `register_web_lead`, `accept_proposal`) para crear el crew allá. Guarda las referencias `hito_event_id`/`hito_crew_member_id`. Si el gig no es de HITO, no hay llamada. Cross-project = sin foreign keys físicas; el vínculo es por referencia guardada.
- **Origen de datos del staff (a repuntar):** hoy el formulario `StaffRegistro.astro` de somosder-web inserta en `staff_profiles` de HITO (publishable key). Con la app dueña del staff, el form pasa a escribir en la base de la APP + su bucket de CVs. Los 146 postulantes de HITO se copian una vez a la app.
- **Autollenado de CV con Gemini** construido en la web (falta encender: `GEMINI_API_KEY`) — se conserva apuntando al nuevo destino.
- **Repo HITO (referencia de patrones a copiar, no a importar):** `github.com/ridaofranco/HITO-by-DER` (copias locales en `/Users/fridao/Proyectos/HITO-by-DER-main` y `~/Downloads/hito-live`). Next.js 15 App Router + React 19 + Supabase SSR + Drizzle + Tailwind + Base UI + Motion + Capacitor. Se copian auth+org gate, patrón de RPC de aceptación (`00008_proposal_acceptance.sql`) y `mailer.ts`.
- **HITO Supabase (`luillpzfqzbpoqkgvjuw`):** ahí se crea la función-puente que recibe el push de crew. Tiene `crew_members`, `crew_assignments`, `events`, multi-tenant por `organization_id` con `is_org_member`/`is_org_writer`.
- **Cuentas/orgs sin consolidar:** Franco tiene 2 cuentas (ridaofrancorg@gmail.com y franco@somosder.ar); la org "SOMOS DER" real con datos está en la cuenta de su socia (cottludmila@gmail.com). Relevante para el destino del push a HITO (a qué org/evento se empuja el crew).
- **Infra existente reutilizable:** SMTP propio marca DER (ferozo), Vercel (CLI logueado como ridaofranco-8135), Gemini API (tier gratis).
- **Origen del problema:** Franco gestionaba contrataciones con Google Form→Sheet (146 postulantes) + WhatsApp manual. Visión completa en su nota de voz: marketplace → contratar → pagos → seguro MeCubro por contratado, con HITO como uno de los destinos de trabajo.

## Constraints

- **Presupuesto**: CERO gasto en servicios pagos — regla dura de Franco (no pagar APIs, no Zapier). Todo en tiers gratis (Supabase nuevo $0, Vercel hobby, SMTP propio, Gemini free tier).
- **Independencia**: la app es dueña de sus datos y corre sin HITO. HITO es un puente OPCIONAL por gig, no una dependencia. (Debe poder correr para un cliente que no tenga HITO.)
- **Integración**: el puente app→HITO es una función/RPC segura de HITO (patrón existente), NO un MCP y NO escritura directa cruda a las tablas de HITO. HITO controla qué se puede escribir.
- **Seguridad**: RLS obligatoria en toda tabla nueva; acceso público (link mágico) solo vía funciones SECURITY DEFINER por token con `search_path` fijado.
- **UX**: mobile-first — Franco y el staff operan desde el teléfono.
- **Animaciones**: librería Motion (`motion`) — preferencia global del usuario.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| App con base de datos PROPIA (proyecto Supabase nuevo), NO compartir la de HITO | Independencia real: corre sola, vendible a terceros sin HITO; no se acopla a un producto sobre-scopeado y sin lanzar. Costo verificado $0 | — Pending |
| Integración con HITO por PUENTE (función/RPC), no fusión | El evento puede no ser de HITO; si lo es, se empuja el crew a HITO para evaluar/pagar allá. HITO controla la escritura vía SECURITY DEFINER | — Pending |
| MCP descartado como mecanismo de integración de datos | MCP es para que una IA use herramientas, no para sincronizar dos apps; queda como lujo v2 (operar la app hablándole) | — Pending |
| El formulario web pasa a alimentar la base de la app | La app es dueña del staff; el intake flexible ya existe, solo se repunta el destino + se copian los 146 | — Pending |
| Interno primero, marketplace después; datos org-scoped desde el día 1 | Validar el flujo propio antes de abrir a terceros, sin reescribir después | — Pending |
| Staff sin cuenta: link mágico (token + SECURITY DEFINER) | Cero fricción para trabajadores de eventos; patrón ya probado en HITO | — Pending |
| Canal de oferta: email automático + wa.me en un tap | Email gratis con SMTP propio; WhatsApp API oficial cuesta y burocratiza | — Pending |
| Pagos solo informativos en v1; MeCubro en v2 | Evita complejidad fiscal prematura; integrar seguros con el ciclo base validado | — Pending |
| Stack: Next.js 15 standalone espejando patrones de HITO | Copiar código probado (auth, RPC, mailer) sin heredar el scope de HITO | — Pending |
| Éxito v1 = 1 contratación real completa + Franco deja el Sheet | Criterio doble: funcional (ciclo entero con una persona real) y de adopción | — Pending |
| Puente HITO diferido a la ÚLTIMA fase (Fase 6) — la app primero | Franco (2026-07-13): "lo importante es que sea una app de trabajos y que después sea enlazable con HITO mediante algún medio, sea API o MCP o lo que sea". No gastar tiempo de diseño en la integración antes de que la app funcione; el mecanismo del enlace se confirma recién al llegar a esa fase | — Pending |
| Schema `staff_app` dentro del proyecto Supabase de HITO, NO proyecto nuevo | Franco (2026-07-14): el tier gratis permite 2 proyectos activos y ambos trabajan (sales + HITO); no pausar nada, no pagar. Eligió HITO porque la app se enlaza a HITO al final. Independencia lógica (schema/RLS/orgs propios, cero escritura en `public.*` de HITO hasta Fase 6); migrable a proyecto propio a futuro | — Pending |

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
*Last updated: 2026-07-14 — Phase 1 complete + nombre confirmado: LABURO (elegido por Franco sobre propuesta de Claude; marca propia azul/glow/bubble, ni DER ni HITO)*
