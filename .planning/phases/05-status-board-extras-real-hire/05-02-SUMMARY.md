---
phase: 05-status-board-extras-real-hire
plan: 02
subsystem: db
tags: [migration, rls, security-definer, security-invoker, producer-only, notes, ratings]
requires:
  - staff_app.organizations / members / is_org_member / is_org_writer (0001)
  - staff_app.staff_profiles / gigs (0002)
  - security_invoker read-layer pattern + base-table GRANT (0007)
  - WR-05 REVOKE + org-forced SECURITY DEFINER pattern (0008)
provides:
  - staff_app.candidate_notes (favoritos + notas privadas, org-scoped, RLS)
  - staff_app.staff_ratings (rating 1..5 por gig, org-scoped, RLS)
  - public.staff_app_candidate_notes / public.staff_app_staff_ratings (vistas security_invoker authenticated-only)
  - public.staff_app_set_candidate_note / public.staff_app_rate_staff (RPCs upsert SECURITY DEFINER)
affects:
  - plan 05-04 (favoritos/notas + rating en el perfil) — Ola 1 bloqueante
tech-stack:
  added: []
  patterns: [security_invoker view, SECURITY DEFINER upsert (ON CONFLICT DO UPDATE), WR-05 per-object REVOKE/GRANT, org-forced constant, pinned search_path]
key-files:
  created:
    - supabase/migrations/staff_app_0011_notes_ratings.sql
    - supabase/tests/staff_app_0011_notes_ratings_harness.sql
  modified: []
decisions:
  - "Tablas nuevas org-scoped como hogar de favoritos/notas/rating; NO reusar legacy staff_profiles.rating / notas_internas (research §204)"
  - "score re-validado en el RPC ademas del CHECK de tabla: devuelve reason score_out_of_range en vez de excepcion cruda"
  - "note se normaliza con nullif(btrim(...),'') para no persistir strings vacios"
metrics:
  duration: ~15m
  completed: 2026-07-16
requirements: [XTRA-01, XTRA-04]
---

# Phase 5 Plan 02: candidate_notes + staff_ratings (producer-only data door) Summary

Migración `staff_app_0011` que crea la puerta de datos producer-only para favoritos+notas privadas (XTRA-01) y rating post-evento 1-5 (XTRA-04): dos tablas org-scoped en `staff_app`, cada una con su vista `public` security_invoker (lecturas authenticated-only) y su RPC `public` SECURITY DEFINER upsert (escrituras writer-gated, org forzada), todo con WR-05 verbatim de 0008 y cero superficie anon (Pitfall 2).

## Que se construyó

**BLOQUE A — candidate_notes (XTRA-01)**
- Tabla `staff_app.candidate_notes`: `is_favorite bool`, `note text`, `updated_by/updated_at`, `UNIQUE(organization_id, staff_profile_id)` (ancla del upsert). RLS: SELECT `is_org_member`, ALL `is_org_writer`. Grants: REVOKE anon+authenticated, GRANT SELECT authenticated (Pitfall 5).
- Vista `public.staff_app_candidate_notes` security_invoker, GRANT SELECT authenticated + REVOKE anon.
- RPC `public.staff_app_set_candidate_note(uuid, boolean, text)` SECURITY DEFINER, search_path pinned, org fija forzada, writer gate, valida candidato in-org, `ON CONFLICT (org, candidate) DO UPDATE`. WR-05 authenticated-only.

**BLOQUE B — staff_ratings (XTRA-04)**
- Tabla `staff_app.staff_ratings`: `gig_id` FK, `score int CHECK (score BETWEEN 1 AND 5)`, `note text`, `rated_by/created_at`, `UNIQUE(organization_id, staff_profile_id, gig_id)`. Misma RLS y grants.
- Vista `public.staff_app_staff_ratings` security_invoker, GRANT SELECT authenticated + REVOKE anon.
- RPC `public.staff_app_rate_staff(uuid, uuid, int, text)` SECURITY DEFINER, writer gate, re-valida score 1..5 (reason `score_out_of_range`), valida candidato+gig in-org, `ON CONFLICT (org, candidate, gig) DO UPDATE`. WR-05 authenticated-only.

**Harness** `supabase/tests/staff_app_0011_notes_ratings_harness.sql` re-ejecutable (bloque DO $harness$): seed candidato+gig, assert upsert idempotente (1 fila tras 2 llamadas) para notes y ratings, vista devuelve valores actualizados, rechazo de score=6, aislamiento anon (has_function_privilege/has_table_privilege) + positivo authenticated. Cada assert con RAISE EXCEPTION; cleanup total; JWT simulado vía `request.jwt.claims`.

## Aislamiento (Pitfall 2)

Ninguna tabla/vista/RPC nueva concede nada a anon. Ninguna se agrega a get_public_offer / accept_offer / la página `/o`. Verificado por diseño (REVOKE explícito por objeto) y por el assert (d) del harness.

## Deviations from Plan

None - plan ejecutado exactamente como fue escrito. (El harness usa un bloque `DO $harness$` con variables/RAISE EXCEPTION en vez de statements sueltos — sigue el molde de assert-con-excepción de 0008 y cumple los gates de verificación.)

## Estado del [BLOCKING] apply (Task 3)

**NO aplicada en vivo.** El executor no tiene acceso a Supabase MCP; el apply + verificación en vivo son del ORQUESTADOR. Runbook abajo.

### Runbook para el orquestador (Supabase project `luillpzfqzbpoqkgvjuw`)

1. **Baseline advisors (antes):** `get_advisors(type=security)` — guardar la lista de findings actual (baseline Fase 4).
2. **Aplicar:** `apply_migration(name="staff_app_0011_notes_ratings", query=<contenido de supabase/migrations/staff_app_0011_notes_ratings.sql>)`.
3. **Correr el harness:** `execute_sql(<contenido de supabase/tests/staff_app_0011_notes_ratings_harness.sql>)`. Debe terminar con el NOTICE `HARNESS 0011 PASSED`; cualquier `RAISE EXCEPTION` = fallo a corregir.
4. **Advisors (después):** `get_advisors(type=security)` — diff vs baseline. Esperado: CERO clase de finding nueva. En particular NO debe aparecer:
   - `function_search_path_mutable` sobre `public.staff_app_set_candidate_note` / `public.staff_app_rate_staff` (ambos tienen `SET search_path` pinned).
   - `security_definer_view` sobre `public.staff_app_candidate_notes` / `public.staff_app_staff_ratings` (ambas son `security_invoker`, no security_definer).
   - RLS deshabilitada en `staff_app.candidate_notes` / `staff_app.staff_ratings` (ambas tienen ENABLE ROW LEVEL SECURITY).
5. **Confirmar grants** (`execute_sql`):
   ```sql
   SELECT
     has_function_privilege('anon','public.staff_app_set_candidate_note(uuid,boolean,text)','EXECUTE') AS anon_set_note,   -- false
     has_function_privilege('anon','public.staff_app_rate_staff(uuid,uuid,int,text)','EXECUTE')          AS anon_rate,      -- false
     has_table_privilege('anon','public.staff_app_candidate_notes','SELECT')                             AS anon_notes_view,-- false
     has_table_privilege('anon','public.staff_app_staff_ratings','SELECT')                               AS anon_rate_view, -- false
     has_table_privilege('authenticated','public.staff_app_candidate_notes','SELECT')                    AS auth_notes_view,-- true
     has_table_privilege('authenticated','public.staff_app_staff_ratings','SELECT')                      AS auth_rate_view; -- true
   ```
6. **Resume-signal:** escribir "aplicada" cuando apply + harness (PASSED) + advisors limpio + grants OK; o pegar el finding a corregir.

Tras "aplicada", avanzar el contador de plan y marcar XTRA-01/XTRA-04 (no hecho aquí porque el gate live no está cerrado).

## Self-Check: PASSED
- FOUND: supabase/migrations/staff_app_0011_notes_ratings.sql
- FOUND: supabase/tests/staff_app_0011_notes_ratings_harness.sql
- FOUND commit 08ab5b6 (feat migration)
- FOUND commit 376c87e (test harness)
