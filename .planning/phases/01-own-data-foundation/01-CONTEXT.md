# Phase 1: Own Data Foundation - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The app's own data layer, proven in SQL before any UI exists: (1) a new Supabase project owned by the app with an org-scoped, RLS-enabled schema — `staff_profiles`, `gigs` (nullable `hito_event_id` as a cheap future-link reference), `crew`, `offers`; (2) the somosder-web "Trabajá con nosotros" form + CV bucket repointed to write into the APP database with zero downtime; (3) the 146+ existing applicants backfilled from HITO's `staff_profiles` (one-time, read-only copy, verified no loss); (4) the magic-link RPCs (`get_public_offer` / `accept_offer` / `decline_offer`) as SECURITY DEFINER functions with hashed 256-bit single-use expiring tokens, SQL-tested with clean `get_advisors`.

**Explicitly NOT in this phase:** anything HITO-integration related. No bridge function, no HITO event reading, no push of crew to HITO. All of that moved to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Prioridad del producto (decisión central de Franco, 2026-07-13)
- **D-01:** La app es una **app de trabajos standalone** — eso es lo importante. TODO el trabajo de integración con HITO (función-puente, lectura de eventos de HITO, push de crew, elección de org/evento destino) sale de la Fase 1 y se difiere a la **Fase 6 (última)**. Franco, textual: "lo importante es que sea una app de trabajos y que después sea enlazable con HITO mediante algún medio, sea API o MCP o lo que sea". El mecanismo del enlace se decide recién al llegar a esa fase — no condiciona el diseño de la Fase 1 más allá de dejar `gigs.hito_event_id` nullable (costo cero hoy).
- **D-02:** La consolidación de cuentas/orgs de Franco (2 cuentas + org real en la cuenta de Ludmila) **deja de ser prerequisito de la Fase 1**. Solo importa para el destino del push a HITO → bloquea la Fase 6, no esta. El backfill de los 146 lee `staff_profiles` de HITO (read-only) y no necesita esa decisión.

### Claude's Discretion
El resto de las áreas grises de la fase quedan a criterio de Claude (Franco no quiso gastar más tiempo en discusión — priorizar velocidad y defaults razonables, guiados por PROJECT.md y el research):
- **Corte del formulario web:** estrategia de cutover sin downtime (directo vs doble escritura), y qué pasa con `staff_profiles` de HITO después del corte. Regla dura: el intake vivo no se rompe ni pierde postulantes.
- **Modelo de datos del staff propio:** copiar el esquema de HITO tal cual vs limpieza mínima; los 64 oficios como catálogo o tags; manejo de duplicados en el backfill. Verificar columnas reales con query viva antes de migrar (prerequisito del roadmap).
- **Política de tokens/ofertas:** vencimiento default, semántica single-use, renovación. Seguir el patrón probado de HITO (`proposal_acceptance`) y los pitfalls documentados (256-bit hasheado, POST-only accept, expiry en la RPC).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research del proyecto (en este repo)
- `.planning/research/ARCHITECTURE.md` — arquitectura base propia + patrones a copiar de HITO; el addendum del puente aplica a la Fase 6, NO a esta fase
- `.planning/research/STACK.md` — stack lockeado (Supabase JS vs Drizzle, patrón de token del link mágico, versiones)
- `.planning/research/PITFALLS.md` — riesgo #1 sobre-scopear; token = frontera de seguridad; migración sobre tabla viva con form público (expand-migrate-contract)
- `.planning/research/SUMMARY.md` — síntesis del research original

### Código externo de referencia (patrones a copiar, no importar)
- `/Users/fridao/Proyectos/HITO-by-DER-main` — repo HITO local; en particular la migración `00008_proposal_acceptance.sql` (patrón RPC de aceptación SECURITY DEFINER con token) y el esquema multi-tenant (`organization_id`, `is_org_member`/`is_org_writer`)
- `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/components/StaffRegistro.astro` — el formulario vivo a repuntar (hoy inserta en `staff_profiles` de HITO con publishable key)
- `/Users/fridao/Proyectos/SOMOS DER/somosder-web/src/pages/trabaja-con-nosotros.astro` — página que monta el form

### Bases de datos
- HITO Supabase `luillpzfqzbpoqkgvjuw` — SOLO como fuente read-only del backfill de los 146 postulantes en esta fase (nada de escribir ni crear funciones ahí)
- Proyecto Supabase nuevo de la app — crear en la org `wsvqlrjmizvivgrgnfpw` (costo verificado $0)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Repo de la app vacío (solo `.planning/` + `CLAUDE.md`) — esta fase es SQL/Supabase, no crea app code.
- Patrón RPC de aceptación de HITO (`00008_proposal_acceptance.sql`): token + SECURITY DEFINER + `search_path` fijado + single-use — replicar en la base de la app.
- Form `StaffRegistro.astro` ya funciona (validación, CV upload, autollenado Gemini construido): solo se repunta el destino (URL + key de Supabase), no se reescribe.

### Established Patterns
- Multi-tenant por `organization_id` con helpers `is_org_member`/`is_org_writer` (de HITO) — replicar en el esquema propio desde el día 1.
- RLS obligatoria en toda tabla; acceso anon solo vía funciones SECURITY DEFINER.

### Integration Points
- somosder-web (Astro) → base de la app: nuevo endpoint/keys en el form.
- HITO DB: solo lectura una vez para el backfill.

</code_context>

<specifics>
## Specific Ideas

- Franco quiere velocidad y foco: la app funcionando como producto propio. Evitar cualquier rabbit hole de integración.
- El formulario web es el intake flexible que Franco SÍ usa (a diferencia de HITO) — no romperlo es sagrado.

</specifics>

<deferred>
## Deferred Ideas

- **Puente HITO completo** (BRDG-01, BRDG-02, BRDG-03: receptor SECURITY DEFINER en HITO, lectura de eventos, push de crew con refs y retry) → movido a **Fase 6 (HITO Link)**, con el mecanismo (RPC/API/otro) a confirmar al llegar. La consolidación de cuentas/orgs de Franco se resuelve recién ahí.
- **Ubicación real elegida por el staff + autocomplete de mapa (idea de Franco, 2026-07-14):** cuando el staff tenga su panel (v2, MRKT-02), cada persona elige/corrige su ubicación real con autocomplete. Restricción $0: NO Google Maps Platform (pide tarjeta) — usar Georef API (datos.gob.ar, gratis, provincias/localidades oficiales AR) o Nominatim/OpenStreetMap. Lo que SÍ entra en v1: normalización determinística de ubicación en el import (Fase 1, plan 01-04) + campos estructurados provincia/ciudad para que el filtro de la Fase 2 funcione.

</deferred>

---

*Phase: 01-own-data-foundation*
*Context gathered: 2026-07-13*
