---
phase: 05-status-board-extras-real-hire
plan: 05
subsystem: notifications / cron
tags: [vercel-cron, reminder, email, service-role, xtra-02]
requires:
  - "public.staff_app_offers_due_reminder (05-01, service_role EXECUTE, exactly-once via reminded_at)"
  - "lib/email/mailer.ts (honest sendMail / smtpEnabled, Fase 3)"
  - "lib/supabase/admin.ts (createServiceRoleClient, server-only)"
  - "components/emails/offer-email.tsx (molde react-email)"
provides:
  - "GET /api/cron/reminders — cron route fail-closed por CRON_SECRET que dispara UN recordatorio pre-vencimiento exactly-once"
  - "components/emails/reminder-email.tsx — template del recordatorio SIN link mágico (A1)"
  - "vercel.json — un único cron diario 0 9 * * * → /api/cron/reminders"
affects:
  - "El cron real recién dispara en prod tras SHIP-01 (deploy, 05-06) + SMTP (Franco-gated)"
tech-stack:
  added: []
  patterns:
    - "Route Handler App Router protegido por Bearer CRON_SECRET (fail-closed 401)"
    - "service-role client SÓLO en app/api/cron/* (además del webhook) para RPCs sin sesión de usuario"
    - "render() react-email v2 ASYNC + sendMail honesto por fila, nunca throw"
key-files:
  created:
    - "components/emails/reminder-email.tsx"
    - "app/api/cron/reminders/route.ts"
    - "vercel.json"
    - ".planning/phases/05-status-board-extras-real-hire/deferred-items.md"
  modified: []
decisions:
  - "A1 honrada: el recordatorio NO trae link/token; nudgea al email original (el link sigue vigente)"
  - "best-effort (Pitfall 1): el RPC ya estampa reminded_at aunque el SMTP falle/ausente — no se desmarca (rompería el exactly-once); la oferta igual vence y se ve en el board"
  - "Hobby: UN cron/día (0 9 * * *); un schedule sub-diario rompe el deploy"
metrics:
  duration: "~20 min"
  completed: "2026-07-16"
  tasks: 2
  files: 4
---

# Phase 5 Plan 05: Pre-expiry Reminder Cron (XTRA-02) Summary

Vercel Cron gratis (Hobby, 1/día) → route handler `/api/cron/reminders` fail-closed por `CRON_SECRET` → cliente service-role → RPC `staff_app_offers_due_reminder` (exactly-once real por `reminded_at`) → `ReminderEmail` (sin link mágico, A1) por el mailer honesto. No-op honesto hasta que Franco cargue el SMTP.

## What shipped

**Task 1 — `components/emails/reminder-email.tsx`** (commit `06da67b`)
Template react-email calcado de `offer-email.tsx`: mismos colores de marca inline (SURFACE_0/1, BORDER, FG, FG_MUTED), Container 480px, Section card, FONT_STACK. Props `ReminderEmailProps { firstName, gigTitle, role, expiresText? }`. Copy en voseo argentino sin em dash: encabezado "Hola {firstName}, tu propuesta está por vencer", línea `{role} · {gigTitle}`, "Vence el {expiresText}", y cierre que empuja a la acción SIN link accionable nuevo ("Revisá el email de la propuesta que te mandamos y confirmá desde ahí, o respondé este mail y lo vemos juntos"). **A1 (T-5-23):** no recibe ni renderiza ningún link/token — el original sigue válido. Sólo children escapados por react-email (T-5-25). Verificación grep-negativa de `token`/`/o/`/`link:` en TODO el archivo (incluidos comentarios): limpia.

**Task 2 — `app/api/cron/reminders/route.ts` + `vercel.json`** (commit `05405ce`)
Route Handler `GET` con `export const dynamic = "force-dynamic"`.
1. **Auth fail-closed (T-5-20):** lee el header `authorization`; si `CRON_SECRET` no está seteado o el header no es EXACTO `Bearer ${CRON_SECRET}` → `Response` 401 sin tocar nada. Vercel manda ese header sólo a las rutas de cron.
2. **service-role (T-5-21):** `createServiceRoleClient()` (server-only) → `rpc("staff_app_offers_due_reminder", { p_within_days: 2 })` (granteado sólo a service_role). Si el RPC error: log honesto + JSON `{ ok:false, error }` con 200 (no rompe el scheduler).
3. Por cada fila due `{ offer_id, email, first_name, gig_title, role, expires_at }`: sin email → `skipped`; con email → `render(createElement(ReminderEmail, {...}))` (ASYNC) + `sendMail({ to, subject, html })` con subject en voseo "Tu propuesta está por vencer" + (gig ? ' · '+gig : ''). Contadores `{ due, sent, failed, skipped }`. `render` envuelto en try/catch defensivo — NUNCA throw (T-5-24).
4. Devuelve `Response.json({ ok:true, due, sent, failed, skipped, smtp: smtpEnabled() })`. Sin SMTP → `sent=0`, `smtp=false`, no-op honesto sin error (D-05).

`vercel.json` (nuevo): un único cron `{ path: "/api/cron/reminders", schedule: "0 9 * * *" }`. UNA entrada diaria (Hobby: sub-diario hace fallar el deploy — Pitfall 4).

## Evidence (static verification)

- **Fail-closed guard:** `route.ts:76` → `if (!secret || auth !== \`Bearer ${secret}\`) return 401`.
- **service-role para el RPC:** `route.ts:81-82` → `createServiceRoleClient()` + `.rpc("staff_app_offers_due_reminder", ...)`. Sin cliente anon/autenticado.
- **A1 (grep-negativo):** `grep -qiE "token|/o/|link:" reminder-email.tsx` → sin matches (limpio, incluidos comentarios).
- **No-op honesto:** `route.ts:141` → `smtp: smtpEnabled()`; el mailer devuelve `channel:none` sin SMTP.
- **vercel.json:** `node` valida `crons.length === 1` y schedule de 5 campos con minuto/hora NO `*`.
- **typecheck:** `npm run typecheck` (todo el proyecto) pasa, 0 errores.
- **lint (mis archivos):** `npx eslint components/emails/reminder-email.tsx app/api/cron/reminders/route.ts` → 0 problemas.
- **build:** `next build` → "Compiled successfully" (mis archivos compilan). Ver Deferred Issues.

## Deviations from Plan

None en los archivos de 05-05 — plan ejecutado tal cual.

**Sobre CRON_SECRET en el user-setup:** el plan pedía "add CRON_SECRET a 05-USER-SETUP.md (or note it for 05-06)". `05-USER-SETUP.md` todavía no existe (lo crea 05-06, Wave 3, `autonomous:false`). El `user_setup` de `05-06-PLAN.md` YA lista `CRON_SECRET` con su source ("Generar random; Vercel lo manda como Authorization: Bearer a /api/cron/reminders"). Se tomó la rama "note it for 05-06's deploy setup" — no se creó el archivo prematuramente.

## Deferred Issues (out of scope — files 05-05 no debe tocar)

`npm run build` termina en exit 1, pero por errores PRE-EXISTENTES en archivos del board (05-03) / perfil (05-04) que están sin commitear en el working tree y que el plan me prohíbe tocar. Verificado: el build falla IDÉNTICO con `app/api/cron` + `vercel.json` removidos → no es de 05-05. Registrado en `deferred-items.md`:

1. `app/(app)/page.tsx:105` — ESLint error `@next/next/no-html-link-for-pages` (`<a href="/">` en vez de `<Link>`). Aborta `next build`. Owner: **05-03**.
2. `unhandledRejection PageNotFoundError: /_document` en "Collecting page data". Pre-existente (surface sin mis archivos). Probablemente ligado al scaffold untracked `app/dev-login/`.
3. `cv-actions.ts:52` — warning (unused eslint-disable). Pre-existente, fase anterior.

Los archivos de 05-05 son estáticamente limpios (typecheck + eslint) y compilan; el gate de build completo lo desbloquea 05-03 al arreglar su `<a>`.

## Known Stubs

Ninguno. El route no es un stub: es código completo y honesto que hace no-op limpio sin SMTP por diseño (D-05, Franco-gated), no por falta de implementación.

## For downstream

- **05-06 (deploy, SHIP-01):** setear `CRON_SECRET` (random) en el Vercel project de LABURO; Vercel lee `vercel.json` y agenda el cron automáticamente al deployar. Con SMTP presente el recordatorio envía de verdad; sin SMTP, no-op honesto.
- El cron NO se dispara live acá (no SMTP, no prod) — es Franco-gated por diseño.

## Self-Check: PASSED
- FOUND: components/emails/reminder-email.tsx
- FOUND: app/api/cron/reminders/route.ts
- FOUND: vercel.json
- FOUND: commit 06da67b (feat 05-05 reminder-email template)
- FOUND: commit 05405ce (feat 05-05 cron route + vercel.json)
