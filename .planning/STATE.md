---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: context exhaustion at 75% (2026-07-18)
last_updated: "2026-07-18T04:16:23.038Z"
last_activity: 2026-07-15
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 20
  completed_plans: 19
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-13, after architecture revision)

**Core value:** Franco encuentra y contrata staff real para un evento real en un solo flujo dentro de la app — sin volver al Google Sheet ni al WhatsApp manual; la integración con HITO es un puente opcional, no un requisito.
**Current focus:** Phase 2 — Find Staff

## Current Position

Phase: 2 (Find Staff) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-07-31 - Quick task 260731-pe7: marketplace movimiento 2, la puerta de entrada del proveedor por link mágico (código completo, migración 0042 sin aplicar)

Progress (Phase 2 plans): [████████··] 3/4

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: ~17 min
- Total execution time: ~1.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Own Data Foundation | 2/4 | 24 min | 12 min |
| 1 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02-find-staff P04 | 50 min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture (2026-07-13): App has its OWN Supabase DB (staff/gigs/crew/offers); NOT sharing HITO's DB.
- Integration (2026-07-13): HITO reached via a PUENTE — SECURITY DEFINER receiver in HITO + event-read — not fusion, not direct table writes, not MCP.
- Build order: own data (SQL-tested) first, UI after; app must run without HITO.
- Priority (2026-07-13, discuss-phase 1): ALL HITO integration deferred to Phase 6 (last). Franco: "lo importante es que sea una app de trabajos; el enlace con HITO viene después por el medio que sea". Phase 1 = app foundation only (DATA-01..04); bridge mechanism re-confirmed at Phase 6 start.
- Data foundation (2026-07-14, plan 01-01): `staff_app` schema created inside HITO's project `luillpzfqzbpoqkgvjuw` (D-03, no new project). **Fixed SOMOS DER org UUID = `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`** — every later plan/backfill stamps `organization_id` with this value. Helpers named `staff_app.is_org_member`/`is_org_writer` (own schema, no collision with HITO public). `get_advisors(security)` post-migration is identical to the pre-migration baseline (zero NEW staff_app findings).
- Magic-link RPCs (2026-07-14, plan 01-02): migration `staff_app_0003_magic_link_rpcs` added `staff_app.get_public_offer`/`accept_offer`/`decline_offer` — SECURITY DEFINER, `SET search_path = staff_app, pg_temp`, 256-bit sha256-hashed tokens, in-RPC `expires_at > now()` + `status IN ('sent','viewed')` guard, atomic crew INSERT `ON CONFLICT (gig_id,staff_profile_id) DO NOTHING`. **Grant model:** anon has EXECUTE on those 3 RPCs + USAGE on schema `staff_app` (0001 had revoked schema usage — re-granted so the RPC grants are reachable); helpers `is_org_member`/`is_org_writer` locked from PUBLIC to authenticated-only (no other anon-callable function in staff_app). 7-case SQL harness passed; `get_advisors(security)` still clean vs baseline. **Phase-4 REST-exposure decision recorded (not built):** expose `staff_app` via PostgREST OR add thin `public` wrappers to call the RPCs from the anon client.
- Source-B import + Phase 1 complete (2026-07-14, plan 01-04): migration `staff_app_0005_staging_sheet` (transient) + Python normalizer (`supabase/backfills/staff_app_0005_source_b_gen.py`) imported the **711 Google-Sheet legacy applicants** into `staff_app.staff_profiles`. Deterministic normalization: name split (lossless first-token/rest), Sí/No→bool, dd/mm/yyyy→date (9 invalid birthdates→NULL), oficios free-text→text[] (mapped to somosder-web oficios catalog), CV Drive links→cv_url as-is. **Location normalization (Franco's requirement):** 221 raw `Provincia` variants → 24 official AR jurisdictions (named per web form `provinciasAr`) + `ciudad`; raw kept in `notas_internas '[sheet:provincia] …'`; **1 unmapped ('Argentina')**. Loaded via delimiter-encoded `staging_line` transport + server-side parse (MCP execute_sql payload workaround), deduped `DISTINCT ON (lower(email))` (27 in-Sheet dup groups → 1 each, 0 overlap with Source A). **Final `staff_app.staff_profiles` = 687 (8 web_somosder + 679 google_sheet), 0 NULL org, 0 dup emails**; staging tables dropped; `get_advisors` clean vs baseline. **DATA-02 complete → Phase 1 (Own Data Foundation) DONE.**
- DB read layer + Phase-1 hardening (2026-07-15, plan 02-01): migrations `staff_app_0006_hardening` (WR-04: `members_role_check` CHECK + `is_org_writer` enumerate-allowed `role IN ('owner','writer')`) and `staff_app_0007_read_layer`. 0007 adds **3 public security_invoker views** over `staff_app.*` (`staff_app_profiles`, `staff_app_my_membership` [filtered `WHERE user_id = auth.uid()`], `staff_app_crew_busy`) — zero `pgrst.db_schemas` change; `authenticated` granted base-table SELECT so security_invoker resolves, `anon` explicitly REVOKEd on the views. Search indexes: oficios GIN + provincia + `nombre` trigram (`pg_trgm` in `extensions`). **Seeded the 2 admin `members` owner rows** (both emails already in `auth.users`: ridaofrancorg=73fc15e0…, franco=37987a10…) → D-06 gate live on first login. `public.staff_app_provision_member()` SECURITY DEFINER, authenticated-only, in-DB allowlist self-provision (login-time fallback). Impersonated-JWT SQL proofs: non-member 0 rows, admin 687 + 1 owner membership, provision allowlisted→1 idempotent row / non-allowlisted→NULL+0. Advisor diff = only the sanctioned `staff_app_provision_member` under `authenticated_security_definer_function_executable`; no `security_definer_view`. **WR-05 gap:** `ALTER DEFAULT PRIVILEGES REVOKE FROM PUBLIC` is a no-op on this managed project (verified) — every new `staff_app` function MUST keep an explicit per-function `REVOKE EXECUTE FROM PUBLIC/anon`.
- Form cutover + Source-A backfill (2026-07-14, plan 01-03): migration `staff_app_0004_intake_function` added **`public.staff_app_register_applicant`** — the ONLY Staff App object in `public` (D-03 sanctioned so PostgREST serves `/rest/v1/rpc/…` with no exposed-schemas change), SECURITY DEFINER `SET search_path = staff_app, public, pg_temp`, validates nombre/email/telefono, forces organization_id/estado/source, inserts into `staff_app.staff_profiles`. anon+authenticated EXECUTE; anon has NO direct INSERT (staff_app not PostgREST-exposed). `StaffRegistro.astro` repointed from direct `POST /rest/v1/staff_profiles` to `.rpc('staff_app_register_applicant')` (same URL/anon key, CV bucket untouched) + Ley 25.326 consent (SOMOS DER controller + rights + rrhh@somosder.com.ar) + honest errors; **deployed to Vercel prod (`dpl_FCVmXqecEMKhiaqW7NDhNAbW3P3s` → www.somosder.ar) — cutover 2026-07-14T16:50:15Z**. HITO `public.staff_profiles` frozen; **N=8** captured (was 7, +1 from 2026-07-14 01:08) and backfilled into `staff_app` (id + cv_url intact, org stamped) — **8 in = 8 out**, zero NULL org, zero dup emails. `get_advisors` clean (0 new search_path findings). **NOTE: somosder-web is NOT a git repo — the form change is version-anchored by the Vercel deployment ID, not a commit.**

- Send toolkit ready (2026-07-16, plan 03-02): installed `nodemailer@^9.0.3` + `@react-email/components@^1.0.12` (bundles `@react-email/render@2.x`, **`render()` is ASYNC** → callers must `await`) + `@types/nodemailer@^6`. `lib/email/mailer.ts` = HITO's mailer ported **SMTP-only** (Resend branch dropped, CERO ESP pago); `sendMail()` returns `MailResult {ok,channel,error}`, **never throws, never fakes a 250-OK** (D-02); `smtpEnabled()` false → `{ok:false, channel:'none'}`. Ferozo transport lowercases `SMTP_USER`, short timeouts; `from = "${MAIL_FROM_NAME||'SOMOS DER'}" <${MAIL_FROM_ADDRESS||SMTP_USER}>` (**MAIL_FROM_ADDRESS not set → defaults to SMTP_USER**, documented). `components/emails/offer-email.tsx` (`OfferEmail`, voseo, NO em dash, conditional amount/conditions/whenText, default child escaping — no raw HTML injection, verified render escapes `<script>`). `components/icons/whatsapp-glyph.tsx` (`WhatsAppGlyph`) = official WhatsApp path copied **VERBATIM** from somosder-web `WhatsAppFab.astro` (D-03; `diff` identical), `fill=currentColor` for `#25D366`. **WR-06 FIXED:** `lib/wa.ts` `normalizeAr()` strips leading `0`/`15` and prefixes `54` (already-`54` untouched), wired into `waLink`/`telLink` (runtime-tested: `011 15 1234 5678`→`541112345678`). Commits `e090a16`, `7c99208`. 03-03 wires: `await render(<OfferEmail/>)` → `sendMail()` → check `.ok` → wa.me fallback + glyph button.
- Search home live (2026-07-15, plan 02-03): `(app)/page.tsx` = ONE server query over `public.staff_app_profiles` (card columns only) with `.overlaps('oficios',…)` (GIN) + parameterized `.or(ilike…)` on nombre/apellido/experiencia_detalle/oficios_otro/ciudad/provincia + `.eq` toggles + `crew_busy` exclusion + `.range(0,49)`. Client (`search-client.tsx`) = debounced text (280ms) + multi-select oficio chips that write the URL searchParams (server re-queries). `filtros-sheet.tsx` = Base UI Dialog bottom sheet (Motion slide-up) with provincia Select (24), ciudad, finde/viajar/movilidad + SRCH-02 "ocultar ya asignados" toggle; Aplicar/Limpiar footer with safe-area. Cards (D-03, no photo) = initials avatar colored by `oficioColor(oficios[0])` + tags + ciudad/provincia + experience pill. **Catalog reality:** the Phase-1 normalizer stored some category-level labels NOT in the somosder-web item list (Producción 192, Catering 149, Técnica 61, Orientador/a, Acomodador/a) — `lib/oficios.ts` includes them (OFICIOS_EXTRA_POOL) + a verified OFICIOS_FRECUENTES chip list so chips return >0 and the V5 whitelist accepts every chip/select value. **SRCH-02 = minimum-honest** (excludes current crew members only; crew_busy=0 today, no gigs; interval overlap deferred to Phase 3). **Live UI proof (Playwright 390px, authed via minted session):** home 50 (range cap), tap "Bartender" chip → 6 candidatos (=DB), Filtros→Córdoba→Aplicar → 18 candidatos (=DB), badge "1", zero console errors.
- LABURO app live at repo root (2026-07-15, plan 02-02): Next 15.5.20 + HITO-verbatim Supabase SSR clients (middleware i18n-stripped, public paths `['/login','/auth/callback']`) + LABURO `@theme` token layer (D-01) + Inter 400/600 / Baloo 2 700 lockup. Login = Google OAuth + magic link (D-05, exact UI-SPEC copy, no GitHub). `/auth/callback` provisions via `supabase.rpc('staff_app_provision_member')` with the authed client (never a PostgREST staff_app schema call — PGRST106). `(app)` layout gates on `staff_app_my_membership` `.maybeSingle()`; 0 rows renders AccesoDenegado. DB gate proof re-run: non-member 0/0 rows, admin 1 owner + 687. Env in `.env.local` (service key `sb_secret_…`, git-ignored). ⚠️ Redirect-URL allowlist entry `http://localhost:3000/auth/callback` unconfirmed (Franco ambiguous) — see 02-USER-SETUP.md; symptom = OAuth lands on wrong origin. Vercel project not yet created (later plan).
- [Phase 02-find-staff]: Profile + hybrid CV live (plan 02-04): /staff/[id] renders the full PERF-01 profile from public.staff_app_profiles (null-safe row omission; donde_trabajar is text[] in the live schema; portfolio/linkedin gated by isHttpUrl because the pool stores free text there). CV (PERF-02): classifyCv routes drive/bucket/none; A3 resolved live = 9 bucket CVs, 8 with 'staff-cvs/' prefix (stripped before signing), 1 orphan bare key that exercises the dead-link state. signCv ('use server') checks staff_app_my_membership BEFORE service-role createSignedUrl (TTL 60s, proven: 200 fresh, 400 after 65s, public/tampered paths 400). Quick actions: wa.me + tel: sticky bar. Playwright 390px smoke 25/25. Phase 2 complete (4/4). — Service-role must stay confined to membership-gated 'use server' actions returning only short-lived artifacts; classifyCv is the single CV routing source for Phase 3 offer emails.

### Pending Todos

- **DECISIÓN 2026-07-16 (Franco):** construir Fases 3-4-5 con la app funcionando de punta a punta usando el diseño ACTUAL como placeholder; el reskin premium (Stitch, sistema visual nuevo) se aplica TODO junto DESPUÉS de la Fase 5. No reskinear dos veces. Ver [[franco-diseno-cero-ia]].

- **Phase 2 code-review warnings diferidos (WR-01/02/03/06/07/08, non-blocking, UX/robustez):** WR-01 loop de debounce en search-client si el texto no matchea el canonical del server; WR-02 race de initialFilters (filtro fino en vuelo pisa chip recién tocado); WR-03 cap duro .range(0,49) sin paginación ni count sobre 688; WR-06 ✅ FIXED (plan 03-02, commit e090a16): `lib/wa.ts` `normalizeAr()` strips leading 0/15 + prefixes 54; WR-07 "ocultar asignados" no-op silencioso si crew_busy falla; WR-08 callback traga el fallo de PKCE cross-browser (magic link en apps de mail mobile) sin feedback. Abordar en Fase 3 o un pulido dedicado. Los 2 Critical (CR-01 signup DoS, CR-02 traversal en signCv) + WR-04/05 YA corregidos (commit 42ab56e).

- **Straggler intake en HITO (detectado 2026-07-15):** una postulante (14:06Z) cayó en `public.staff_profiles` de HITO post-cutover (página vieja cacheada; el INSERT anon viejo sigue vigente). Copiada a `staff_app` (total 688). PENDIENTE: tras ventana de gracia (~1 semana), revocar la policy de INSERT anon en `public.staff_profiles` de HITO ('contract' del expand-migrate-contract) + delta-check final antes de revocar.

- **WR-05 convention (from plan 02-01, 2026-07-15):** `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` does NOT take effect on this managed Supabase project (verified no-op). Any NEW `staff_app` function (Phase 3+ RPCs, HITO bridge) MUST include an explicit per-function `REVOKE EXECUTE ... FROM PUBLIC, anon;` + scoped `GRANT` — do not rely on default privileges.
- **Phase 4 planning note (from plan-checker 2026-07-13):** `accept_offer` returns `{ok:false, reason:'invalid_or_expired'}` on an already-accepted token (idempotency guard) — Phase 4's public page must add a distinct "already accepted" reason code or handle the client-side messaging so the candidate doesn't see a misleading error.

### Blockers/Concerns

- **Org/account consolidation unresolved**: Franco has 2 accounts (ridaofrancorg@, franco@somosder.ar); real SOMOS DER org data lives under partner's account (cottludmila@). Only relevant to the HITO push destination — now blocks Phase 6 (HITO Link), NOT Phase 1. (Backfill source is HITO's `staff_profiles`, read-only — no org decision needed for that.)
- **Verify exact `staff_profiles` columns via live query** — ✅ done in 01-03 (staff_app.staff_profiles = 31 HITO cols + organization_id, verified via information_schema before backfill).
- **Ferozo SMTP deliverability untested**: no mail-tester/Postmaster data yet; Phase 5 SPF/DKIM verification is the first real test, not an assumption.
- **Web-form PII/consent gap (Ley 25.326)**: ✅ RESOLVED in 01-03 — consent notice now names SOMOS DER (DER) as data controller, states access/rectify/delete rights, and gives rrhh@somosder.com.ar; deployed to production.

## Quick Tasks Completed

| Fecha | Slug | Qué resolvió | Estado |
|-------|------|--------------|--------|
| 2026-07-31 | [cron-unico-diario](quick/20260731-cron-unico-diario/SUMMARY.md) | `vercel.json` agendaba 1 de las 4 rutas de cron, así que `bienvenida`, `quien-ficho` y `recordatorio-perfil` no las llamaba nadie y sus mails no salían nunca. Se agregó `/api/cron/diario`, que corre las 4 en secuencia con presupuesto de tiempo y aislamiento de fallas. El plan Hobby topea en 2 crons, por eso un orquestador y no cuatro entradas. | complete ✓ |
| 2026-07-31 | [260731-pe7-movimiento-2-del-marketplace-puerta-de-e](quick/260731-pe7-movimiento-2-del-marketplace-puerta-de-e/260731-pe7-SUMMARY.md) | Marketplace de 3 lados, movimiento 2: la puerta de entrada del proveedor. El movimiento 1 dejó el perfil creado pero al proveedor sin forma de entrar. Migración `0042` (token hasheado en `marketplace_profiles` + 6 RPCs `SECURITY DEFINER`) y la ruta pública `/acceso-proveedor/[token]`: entra sin cuenta, completa su perfil, carga sus servicios con zonas y se publica solo. `is_verified`, `slug` y `rating` quedan fuera de su alcance a propósito. Commits `b8419e9`, `749b8dc`, `b5cc8bd`. **La migración quedó escrita y SIN aplicar: la aplica Franco.** | código completo, falta aplicar la migración |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-18T04:16:23.022Z
Stopped at: context exhaustion at 75% (2026-07-18)
Resume file: None
