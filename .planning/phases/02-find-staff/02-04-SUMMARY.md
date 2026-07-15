---
phase: 02-find-staff
plan: 04
subsystem: ui
tags: [nextjs, supabase-storage, signed-url, service-role, google-drive, wa.me, laburo, mobile-first]

requires:
  - phase: 02-find-staff (plan 02-01)
    provides: "public.staff_app_profiles + staff_app_my_membership security_invoker views (RLS = the authority)"
  - phase: 02-find-staff (plan 02-02)
    provides: "(app) authed shell + membership gate; lib/supabase/admin.ts (service-role, server-only); LABURO tokens"
  - phase: 02-find-staff (plan 02-03)
    provides: "candidate cards linking to /staff/[id]; lib/wa.ts (waLink/telLink); lib/avatar-color.ts (oficioColor/initials)"
provides:
  - "lib/cv.ts — classifyCv(cvUrl): drive (id + /preview + open?id=) / bucket (key normalized, staff-cvs/ prefix stripped per live A3) / none; isHttpUrl guard for junk link columns"
  - "app/(app)/staff/[id]/page.tsx — full profile (PERF-01): RLS-scoped .eq(id).maybeSingle() over public.staff_app_profiles, null-safe row omission, header avatar 56px + estado pill, oficios/experiencia/disponibilidad/situacion/motivacion/CV/links blocks"
  - "app/(app)/staff/[id]/cv-actions.ts — signCv server action: membership check FIRST, then service-role createSignedUrl('staff-cvs', key, 60); returns only the URL string"
  - "app/(app)/staff/[id]/cv-view.tsx — hybrid viewer: bucket signed embed + re-sign for new tab; Drive /preview optimistic + always-present Abrir CV; exact dead-link copy, never crashes"
  - "app/(app)/staff/[id]/quick-actions.tsx — sticky safe-area bar: Escribir por WhatsApp (wa.me) + Llamar (tel:, aria-label 'Llamar al candidato')"
affects: [phase-3-offers]

tech-stack:
  added: []
  patterns:
    - "Service-role usage pattern: ONLY inside a 'use server' action, ALWAYS after an RLS-backed membership check, returning only a short-lived artifact (never the client)"
    - "Hybrid CV: own-bucket objects signed server-side (60s TTL); third-party Drive links opened in the user's own Google session, never proxied"
    - "Data-quality guard: free-text columns that should be URLs (portfolio/linkedin) render as links only if isHttpUrl passes; otherwise the row is omitted"

key-files:
  created:
    - "lib/cv.ts"
    - "app/(app)/staff/[id]/page.tsx"
    - "app/(app)/staff/[id]/cv-actions.ts"
    - "app/(app)/staff/[id]/cv-view.tsx"
    - "app/(app)/staff/[id]/quick-actions.tsx"
  modified: []

key-decisions:
  - "A3 resolved live: 9 bucket CVs (not 8); 8 store cv_url WITH the 'staff-cvs/' bucket prefix, 1 stores a bare filename whose object does NOT exist in storage; classifyCv strips the prefix before signing and the orphan exercises the dead-link state with real data"
  - "Q2 confirmed as planned: service-role signing after membership check; zero shared-bucket storage-policy changes"
  - "Abrir CV for bucket objects re-signs on every click (60s TTL makes reusing a stale URL wrong); window.open is called synchronously before the await to survive popup blockers"
  - "portfolio_url/linkedin_url contain free text in the pool ('No tengo', names); isHttpUrl gates link rendering (extension of the null-safety rule)"

patterns-established:
  - "Membership-check-then-privileged-operation ordering for every future server action that touches elevated credentials"
  - "classifyCv as the single CV routing source (Phase 3 offer emails can reuse it)"

requirements-completed: [PERF-01, PERF-02]

duration: ~50min (across a spend-limit interruption)
completed: 2026-07-15
---

# Phase 2 Plan 04: Candidate Profile + Hybrid CV + Quick Actions Summary

**Phone-first candidate profile over `public.staff_app_profiles` with membership-gated 60s signed URLs for private-bucket CVs, optimistic Drive `/preview` embeds with a reliable new-tab escape hatch, a real-data dead-link state, and sticky wa.me/tel quick actions — closing the search → profile → contact flow.**

## Performance

- **Duration:** ~50 min effective (execution interrupted once by a spend limit and resumed; no work lost)
- **Completed:** 2026-07-15T18:35Z
- **Tasks:** 2 (committed atomically)
- **Files:** 5 created, 3 screenshots

## Accomplishments

- **PERF-01:** `/staff/[id]` renders the full profile from the RLS-scoped view (header with 56px oficio-colored avatar, name 20/600, estado pill, location; oficios tags; experiencia line + detalle; disponibilidad pills; situación legal/dónde trabajar/país; motivación; portfolio/LinkedIn links). Null-safe: empty values omit the whole row; `false`/`0` never render as negative badges.
- **PERF-02:** hybrid CV. Bucket objects sign server-side (service-role confined to the `"use server"` action, TTL 60s, membership check first). Drive links (678) render the `/preview` iframe optimistically and ALWAYS offer "Abrir CV" in a new tab (Franco's own Google session). Dead links show the exact UI-SPEC copy and never crash — proven with a real orphan cv_url in the pool.
- **Quick actions (Claude's Discretion, locked):** sticky bottom bar respecting `safe-area-inset-bottom`, primary "Escribir por WhatsApp" (`wa.me/<digits>?text=…` with a voseo greeting), secondary "Llamar" with `aria-label="Llamar al candidato"` (`tel:+<digits>`).

## A3 finding (recorded per plan)

Live sample of all non-Drive `cv_url` values (project `luillpzfqzbpoqkgvjuw`):
- **9 bucket CVs** (research said 8; one more web applicant arrived since).
- **8/9** store the path **WITH the bucket-name prefix**: `staff-cvs/<timestamp>_<rand>_<filename>.pdf`. `createSignedUrl` expects the bucket-relative key → `classifyCv` strips the leading `staff-cvs/`.
- **1/9** (`Screenshot_…_Sabrina Luana Soler.jpg`) is a bare filename with **no matching object** in the bucket → signs to "Object not found" → `signCv` returns null → dead-link UI. This real row was used as the live dead-CV test case.
- Bucket verified **private** (`storage.buckets.public = false`); 678 Drive CVs; 687/687 profiles have a cv_url.

## Task Commits

1. **Task 1: profile page + classifyCv + quick actions** - `dff3ee8` (feat)
2. **Task 2: CV signing action + hybrid CV viewer** - `3d7e8aa` (feat)

**Plan metadata:** this SUMMARY commit (docs).

## Verification Evidence

**Build/type:** `npm run build` exit 0 (route `ƒ /staff/[id]`); `npx tsc --noEmit` clean.

**Unit-check (`classifyCv`, node against compiled lib/cv.ts):** `open?id=X` → drive with `/file/d/X/preview`; `/file/d/Y/view` → drive; `staff-cvs/<key>` → bucket with prefix stripped; bare key → bucket unchanged; null/empty → none; `isHttpUrl('No tengo')` false. ALL PASS.

**Greps (acceptance):** cv-actions.ts starts `"use server"`, contains `staff_app_my_membership` + `createSignedUrl` + TTL 60; only importer of `supabase/admin` in app/+lib/ is cv-actions.ts; no `"use client"` file imports admin; no `NEXT_PUBLIC_*SERVICE*` anywhere. cv-view.tsx contains the exact dead-link copy + "Abrir CV" + `/preview` branch and imports the ACTION, not admin. quick-actions.tsx has the exact copy + aria-label + waLink. No em dash in any user-facing copy (the one visible em dash in a screenshot is stored DB data, not UI copy).

**Access proofs (impersonated-JWT SQL via MCP, independent of UI):**
- Non-member (random uid): `staff_app_profiles WHERE id=<real id>` → **0 rows** (T-02-17); `staff_app_my_membership` → **0 rows** → `signCv` throws 'forbidden' before touching service-role (T-02-16).

**Signing proofs (live, service-role, same bucket/TTL as the action):**
- Fresh signed URL for a real bucket CV → HEAD **200**; same URL after 65s → **400 (expired)** — TTL 60s enforced.
- Public/unsigned path `object/public/staff-cvs/<key>` → **400** (bucket private, URL not guessable; T-02-14).
- Tampered token → **400**.
- Orphan object key → sign error "Object not found" → null → dead-link UI.

**Live UI smoke (Playwright chromium 390x844, real minted admin session — 25/25 PASS, screenshots committed):**
- Drive-CV profile (Belén Fernández): header + estado "Pendiente" + Oficios/Experiencia/Disponibilidad/Motivación sections + optimistic Drive `/preview` iframe + always-present "Abrir CV" + Portfolio link rendered (real URL) while null LinkedIn omitted. `wa.me/<digits>?text=…` and `tel:+<digits>` hrefs verified. → `02-04-profile-drive.png`
- Bucket-CV profile (Franco Ridao): "Ver CV" → iframe src is a `/storage/v1/object/sign/staff-cvs/…token=…` signed URL (never a public path). → `02-04-profile-bucket-cv.png`
- Dead-CV profile (Sabrina): "Ver CV" → exact copy "No pudimos abrir este CV." / "Probá abrirlo en una pestaña nueva." + "Abrir CV", page intact (no crash). → `02-04-profile-dead-cv.png`
- Search → profile flow: first card on home links to `/staff/[id]` and opens the profile (Success Criterion #4 closed).
- Console: only the expected Drive-preview 401 (Google permission wall inside the iframe — the documented best-effort case whose escape hatch is always visible); zero app errors.

## Decisions Made

See frontmatter `key-decisions`. Load-bearing: the A3 prefix-strip in `classifyCv` (without it all 8 real bucket CVs would fail to sign) and the sign-per-click for "Abrir CV" (60s TTL).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `donde_trabajar` is `text[]`, not `text`**
- **Found during:** Task 2 live smoke (profile with values → 500: `.trim is not a function`).
- **Issue:** The plan's PERF-01 mapping implied scalar text; the live schema (verified via information_schema) has `donde_trabajar text[]`.
- **Fix:** Typed as `string[] | null`, rendered joined with ", "; row omitted when empty.
- **Verification:** tsc clean; profile with 6-country array renders correctly (visible in `02-04-profile-bucket-cv.png`).
- **Committed in:** `3d7e8aa`.

**2. [Rule 2 - Missing Critical] `isHttpUrl` guard for portfolio/linkedin links**
- **Found during:** Task 1 test-candidate sampling (live rows contain "No tengo" and bare names in the URL columns).
- **Issue:** Rendering those values as `<a href>` would produce broken relative-URL links — an empty-row violation in spirit.
- **Fix:** `isHttpUrl()` in lib/cv.ts; ExternalRow renders only real http(s) URLs, otherwise omits the row.
- **Verification:** Live profile shows Portfolio (real URL) and omits junk/null links.
- **Committed in:** `dff3ee8`.

---

**Total deviations:** 2 auto-fixed (1 bug vs live schema, 1 missing critical data-quality guard). **Impact:** both required by the plan's own null-safety acceptance; no scope creep.

## Issues Encountered

- Execution was interrupted once by a monthly spend limit and resumed cleanly (uncommitted Task 1 work found on disk matched context; no rework).
- Headless Chromium doesn't paint embedded PDFs, so the bucket-CV screenshot shows the frame + signed src rather than rendered pages; the signed URL itself was proven with HEAD 200 + expiry.
- Drive `/preview` in a session-less headless browser shows Google's permission wall — expected (Pitfall 5); on Franco's phone his Google session applies, and "Abrir CV" is always present either way.

## User Setup Required

None - no new external service configuration. (Carried from 02-02: the `http://localhost:3000/auth/callback` redirect-allowlist entry remains the one open item in `02-USER-SETUP.md`; smoke used a minted session.)

## Next Phase Readiness

- **Phase 2 complete (4/4 plans):** login → gate → search → profile → CV → WhatsApp/call, all proven live against the real 687-candidate pool. Success Criteria #1-#5 met.
- Phase 3 (offers) consumes: the profile screen as the offer entry point, `lib/wa.ts`, `classifyCv` (CV links in offer emails), and the membership-check-then-privileged-op pattern for its RPC calls.
- Human verify pending (end-of-phase): Franco opens a candidate on his phone, views a Drive CV and the bucket CV, taps WhatsApp/Llamar.
- Vercel project still not created (deploy is outside Phase 2's plans; queued in USER-SETUP).

## Self-Check: PASSED

- All 5 key files exist on disk; `git log --grep="02-04"` returns 2 feat commits (`dff3ee8`, `3d7e8aa`).
- Every task acceptance criterion re-verified post-implementation (build 0, tsc clean, greps, unit-check, MCP access proofs, signing + TTL proofs, 25/25 Playwright checks with screenshots).

---
*Phase: 02-find-staff*
*Completed: 2026-07-15*
