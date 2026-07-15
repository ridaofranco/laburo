# Requirements: Staff App (by DER)

**Defined:** 2026-07-10
**Revised:** 2026-07-13 (arquitectura: base propia + puente a HITO, no fusión)
**Core Value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual. La integración con HITO es un puente opcional, no un requisito para que la app funcione.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Datos (base propia)

- [x] **DATA-01**: La app tiene su esquema propio **`staff_app`** dentro del proyecto Supabase de HITO (`luillpzfqzbpoqkgvjuw`) — decisión de Franco 2026-07-14 por el límite de 2 proyectos activos del tier gratis; independencia lógica, cero escritura en `public.*` de HITO. Tablas propias: `staff_profiles`, `gigs` (eventos propios, con `hito_event_id` nullable opcional), `crew`, `offers` — todo org-scoped y con RLS desde el día 1
- [x] **DATA-02**: Los postulantes existentes quedan copiados a la base de la app (backfill único, verificado sin pérdida) — **Source A (8 web/HITO) en 01-03 + Source B (711 del Google Sheet → 679 post-dedup) en 01-04**; total 687 en `staff_app.staff_profiles`, 0 org NULL, 0 emails duplicados, ubicación normalizada a las 24 jurisdicciones oficiales ✅ 2026-07-14
- [x] **DATA-03**: El formulario "Trabajá con nosotros" de somosder-web (+ subida de CV) queda repuntado para escribir en la base de la APP (`staff_app` vía RPC pública `staff_app_register_applicant`), no en HITO — sin downtime; el intake sigue funcionando durante el corte ✅ 2026-07-14
- [x] **DATA-04**: Las RPCs públicas del link mágico (`get_public_offer`, `accept_offer`, `decline_offer`) son SECURITY DEFINER en la base de la APP, con `search_path` fijado, token fuerte (256-bit, hasheado en reposo), vencimiento y aceptación de un solo uso — verificadas con tests SQL y `get_advisors` limpio

### Puente con HITO

- [ ] **BRDG-01**: Existe en HITO una función SECURITY DEFINER que recibe el push de crew desde la app (crea `crew_member` + `crew_assignment` atómicamente en la org/evento de HITO correctos), idempotente y autenticada por token/service — probada en SQL
- [ ] **BRDG-02**: El usuario puede vincular un gig de la app a un evento existente de HITO (la app lee la lista de eventos de HITO por el puente); un gig también puede quedar SIN vincular
- [ ] **BRDG-03**: Al confirmarse un trabajador en un gig vinculado a HITO, la app llama al puente y guarda las referencias devueltas (`hito_event_id`, `hito_crew_member_id`); si el gig no está vinculado, no hay llamada; una falla del puente no pierde la contratación del lado app (reintentable)

### Búsqueda

- [ ] **SRCH-01**: El usuario puede buscar candidatos por rol/oficio (multi-select sobre los 64 oficios) y texto libre sobre el pool propio de `staff_profiles`
- [ ] **SRCH-02**: El usuario puede filtrar por disponibilidad básica: "no asignado ya a un gig solapado en la app" + nota manual de disponibilidad
- [ ] **SRCH-03**: La búsqueda funciona bien en el teléfono (mobile-first)

### Perfil

- [x] **PERF-01**: El usuario puede ver el perfil completo del candidato: datos, oficios, experiencia, links y estado
- [x] **PERF-02**: El usuario puede ver/descargar el CV desde el bucket privado de la app vía signed URL de TTL corto

### Oferta

- [ ] **OFER-01**: El usuario puede crear una oferta atada a un gig de la app (elegir gig existente o crearlo rápido; el gig puede o no estar vinculado a un evento de HITO), con rol, fechas, monto informativo y condiciones
- [ ] **OFER-02**: La oferta sale automáticamente por email (SMTP marca DER) con el link mágico
- [ ] **OFER-03**: El usuario tiene un botón wa.me con el mensaje pre-armado (oferta + link) para reforzar por WhatsApp en un tap

### Aceptación (link mágico)

- [ ] **ACPT-01**: El candidato puede ver la oferta desde el link sin crear cuenta (página pública por token)
- [ ] **ACPT-02**: El candidato puede aceptar o rechazar con confirmación explícita por POST (los bots de preview de email/WhatsApp no pueden disparar la aceptación)
- [ ] **ACPT-03**: Al aceptar se crea el crew **en la app** atómicamente; si el gig está vinculado a HITO, se dispara además el puente (BRDG-03)

### Estado

- [ ] **STAT-01**: El usuario ve el estado de cada oferta: enviada / vista (= link abierto) / aceptada / rechazada / vencida
- [ ] **STAT-02**: El usuario ve un tablero de ofertas por gig para saber qué roles están cubiertos y cuáles no

### Extras (después del ciclo core)

- [ ] **XTRA-01**: El usuario puede marcar candidatos como favoritos y escribir notas privadas org-scoped (nunca visibles para el candidato)
- [ ] **XTRA-02**: Las ofertas vencen a la fecha configurada y mandan UN recordatorio por email antes de vencer (cron gratuito de Vercel)
- [ ] **XTRA-03**: Ante rechazo o vencimiento, el usuario vuelve en un tap a la lista filtrada (sin los ya ofertados) para ofertar al siguiente
- [ ] **XTRA-04**: El usuario puede calificar al staff post-evento (1-5 + nota) — captura simple que siembra los datos de confiabilidad del marketplace v2

### Entrega

- [ ] **SHIP-01**: La app está deployada en producción (Vercel, proyecto propio) con SPF/DKIM verificados para que las ofertas no caigan en spam
- [ ] **SHIP-02**: Se completó 1 contratación real de punta a punta (persona real encontrada, ofertada, aceptó por el link, quedó como crew en la app; y si el gig era de HITO, también en HITO)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Marketplace

- **MRKT-01**: Registro de empleadores terceros (signup, onboarding, billing, moderación)
- **MRKT-02**: Login y panel del staff (perfil, disponibilidad estructurada, historial)
- **MRKT-03**: Matching asistido con ratings + historial acumulado
- **MRKT-04**: Broadcast de turnos abiertos con claim en tiempo real

### Integraciones

- **INTG-01**: Integración MeCubro (seguro por contratado al confirmar)
- **INTG-02**: Sincronización enriquecida con HITO (evaluaciones/pagos de vuelta a la app, no solo push de crew)
- **INTG-03**: MCP para operar la app por lenguaje natural (una IA busca staff y ofertá por vos)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| App dependiente de HITO para funcionar | Explícitamente NO: la app corre sola; HITO es un puente opcional por gig |
| Escritura directa cruda a las tablas de HITO | El puente es una función SECURITY DEFINER que HITO controla; no se tocan sus tablas desde afuera |
| MCP como mecanismo de integración de datos | MCP es para IA↔herramientas, no para sincronizar apps; queda v2 como operación por lenguaje |
| Calendario completo de scheduling/rostering | Scope masivo; es exactamente lo que hundió a HITO |
| Time-tracking / clock-in geofenced / timesheets | Requiere app del staff; el pago es informativo en v1 — costo puro sin valor |
| Procesar pagos reales / payroll | Complejidad fiscal/CBU + regla de cero servicios pagos; circuito manual actual |
| WhatsApp Business API oficial | Costo por conversación + aprobación Meta — viola cero-gasto; wa.me cumple |
| Oferta simultánea a varios candidatos ("blast") | Riesgo de doble-booking y quema de confianza en un pool chico; mecánica de marketplace v2 |
| AI matching / forecasting | Necesita volumen y ratings que no existen aún; filtros determinísticos alcanzan |
| Molde rígido de importación del pool | Franco nunca usó HITO en parte por moldes rígidos; el form web ya es el intake flexible |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete (01-01, 2026-07-14) |
| DATA-02 | Phase 1 | Complete (Source A 01-03 + Source B 01-04; 687 total) |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete (01-02, 2026-07-14) |
| BRDG-01 | Phase 6 | Pending |
| BRDG-02 | Phase 6 | Pending |
| SRCH-01 | Phase 2 | In Progress (02-01 DB read layer: staff_app_profiles view + oficios GIN / nombre trigram indexes; UI in 02-03) |
| SRCH-02 | Phase 2 | In Progress (02-01 staff_app_crew_busy view + disponibilidad columns; UI toggle in 02-03) |
| SRCH-03 | Phase 2 | In Progress (02-02 mobile-first foundation: dark theme, 16px inputs, 44px targets, viewport-fit, LABURO tokens; search UI in 02-03) |
| PERF-01 | Phase 2 | Complete |
| PERF-02 | Phase 2 | Complete |
| OFER-01 | Phase 3 | Pending |
| OFER-02 | Phase 3 | Pending |
| OFER-03 | Phase 3 | Pending |
| ACPT-01 | Phase 4 | Pending |
| ACPT-02 | Phase 4 | Pending |
| ACPT-03 | Phase 4 | Pending |
| BRDG-03 | Phase 6 | Pending |
| STAT-01 | Phase 4 | Pending |
| STAT-02 | Phase 5 | Pending |
| XTRA-01 | Phase 5 | Pending |
| XTRA-02 | Phase 5 | Pending |
| XTRA-03 | Phase 5 | Pending |
| XTRA-04 | Phase 5 | Pending |
| SHIP-01 | Phase 5 | Pending |
| SHIP-02 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 26 total (the earlier "24" count was stale — enumerating the IDs after the DATA/BRDG split yields 26)
- Mapped to phases: 26
- Unmapped: 0 ✓

**Per-phase counts:** Phase 1 = 4 · Phase 2 = 5 · Phase 3 = 3 · Phase 4 = 4 · Phase 5 = 7 · Phase 6 = 3

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-13 — HITO bridge (BRDG-01/02/03) deferred to Phase 6 per Franco's direction: app standalone first, HITO link last*
