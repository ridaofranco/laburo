# Requirements: Staff App (by DER)

**Defined:** 2026-07-10
**Core Value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Datos (multi-tenant)

- [ ] **DATA-01**: `staff_profiles` queda migrada a multi-tenant (`organization_id` nullable + trigger de default + backfill) sin romper el formulario público vivo de somosder-web (expand-migrate-contract)
- [ ] **DATA-02**: Existe la tabla `offers` org-scoped (evento, rol, fechas, monto informativo, condiciones, token, estado, vencimiento) con RLS vía `is_org_member`/`is_org_writer`
- [ ] **DATA-03**: Las RPCs públicas del link mágico (`get_public_offer`, `accept_offer`, `decline_offer`) son SECURITY DEFINER con `search_path` fijado, token fuerte (256-bit, hasheado en reposo), vencimiento y aceptación de un solo uso — verificadas con tests SQL y `get_advisors` limpio

### Búsqueda

- [ ] **SRCH-01**: El usuario puede buscar candidatos por rol/oficio (multi-select sobre los 64 oficios) y texto libre sobre el pool real de `staff_profiles`
- [ ] **SRCH-02**: El usuario puede filtrar por disponibilidad básica: "no asignado ya a un evento solapado en HITO" + nota manual de disponibilidad
- [ ] **SRCH-03**: La búsqueda funciona bien en el teléfono (mobile-first)

### Perfil

- [ ] **PERF-01**: El usuario puede ver el perfil completo del candidato: datos, oficios, experiencia, links y estado
- [ ] **PERF-02**: El usuario puede ver/descargar el CV desde el bucket privado `staff-cvs` vía signed URL de TTL corto

### Oferta

- [ ] **OFER-01**: El usuario puede crear una oferta atada a un evento de HITO (elegir evento existente o crearlo rápido), con rol, fechas, monto informativo y condiciones
- [ ] **OFER-02**: La oferta sale automáticamente por email (SMTP marca DER) con el link mágico
- [ ] **OFER-03**: El usuario tiene un botón wa.me con el mensaje pre-armado (oferta + link) para reforzar por WhatsApp en un tap

### Aceptación (link mágico)

- [ ] **ACPT-01**: El candidato puede ver la oferta desde el link sin crear cuenta (página pública por token)
- [ ] **ACPT-02**: El candidato puede aceptar o rechazar con confirmación explícita por POST (los bots de preview de email/WhatsApp no pueden disparar la aceptación)
- [ ] **ACPT-03**: Al aceptar se crean `crew_member` + `crew_assignment` en HITO atómicamente, atados al evento y la org

### Estado

- [ ] **STAT-01**: El usuario ve el estado de cada oferta: enviada / vista (= link abierto) / aceptada / rechazada / vencida
- [ ] **STAT-02**: El usuario ve un tablero de ofertas por evento para saber qué roles están cubiertos y cuáles no

### Extras (después del ciclo core)

- [ ] **XTRA-01**: El usuario puede marcar candidatos como favoritos y escribir notas privadas org-scoped (nunca visibles para el candidato)
- [ ] **XTRA-02**: Las ofertas vencen a la fecha configurada y mandan UN recordatorio por email antes de vencer (cron gratuito de Vercel)
- [ ] **XTRA-03**: Ante rechazo o vencimiento, el usuario vuelve en un tap a la lista filtrada (sin los ya ofertados) para ofertar al siguiente
- [ ] **XTRA-04**: El usuario puede calificar al staff post-evento (1-5 + nota) — captura simple que siembra los datos de confiabilidad del marketplace v2

### Entrega

- [ ] **SHIP-01**: La app está deployada en producción (Vercel, proyecto propio) con SPF/DKIM verificados para que las ofertas no caigan en spam
- [ ] **SHIP-02**: Se completó 1 contratación real de punta a punta (persona real encontrada, ofertada, aceptó por el link, quedó en HITO para un evento real)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Marketplace

- **MRKT-01**: Registro de empleadores terceros (signup, onboarding, billing, moderación)
- **MRKT-02**: Login y panel del staff (perfil, disponibilidad estructurada, historial)
- **MRKT-03**: Matching asistido con ratings + historial acumulado
- **MRKT-04**: Broadcast de turnos abiertos con claim en tiempo real

### Integraciones

- **INTG-01**: Integración MeCubro (seguro por contratado al confirmar)
- **INTG-02**: Tracking de estados de pago reusando tablas de pagos de HITO

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calendario completo de scheduling/rostering | Scope masivo; HITO ya es dueño del crew assignment; es exactamente lo que hundió a HITO |
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
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Pending |
| OFER-01 | Phase 3 | Pending |
| OFER-02 | Phase 3 | Pending |
| OFER-03 | Phase 3 | Pending |
| ACPT-01 | Phase 4 | Pending |
| ACPT-02 | Phase 4 | Pending |
| ACPT-03 | Phase 4 | Pending |
| STAT-01 | Phase 4 | Pending |
| STAT-02 | Phase 5 | Pending |
| XTRA-01 | Phase 5 | Pending |
| XTRA-02 | Phase 5 | Pending |
| XTRA-03 | Phase 5 | Pending |
| XTRA-04 | Phase 5 | Pending |
| SHIP-01 | Phase 5 | Pending |
| SHIP-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total (note: earlier "21" was an off-by-one miscount — PERF-01/02 were not tallied)
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-10*
*Last updated: 2026-07-10 after roadmap creation (traceability populated)*
