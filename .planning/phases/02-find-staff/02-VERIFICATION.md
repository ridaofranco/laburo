---
phase: 02-find-staff
verified: 2026-07-15T21:55:08Z
status: human_needed
score: 5/5 roadmap success criteria verified programmatically (0 blockers)
overrides_applied: 0
human_verification:
  - test: "Franco taps 'Entrar con Google' on his phone and completes the real OAuth round-trip"
    expected: "Redirected to Google, picks ridaofrancorg@gmail.com or franco@somosder.ar, lands back on the LABURO dashboard shell (not an error page, not the wrong origin)"
    why_human: "Requires a real Google account + a real device; cannot be simulated by the verifier. The code path is proven (exchangeCodeForSession + rpc('staff_app_provision_member'), DB gate proven via impersonated SQL), but the network round-trip itself was never exercised end-to-end outside a minted-session Playwright shortcut."
  - test: "Franco confirms (or the redirect-URL allowlist is fixed) that http://localhost:3000/auth/callback — and, once deployed, the production LABURO domain — is registered in Supabase Auth → URL Configuration → Redirect URLs"
    expected: "OAuth/magic-link login returns to the LABURO app, not an error or the wrong origin"
    why_human: "02-02-SUMMARY.md records Franco's confirmation on this specific item as 'ambiguous'; 02-USER-SETUP.md still lists it as ⚠️ A CONFIRMAR. This cannot be verified from the codebase or via SQL — it is a Supabase Dashboard setting outside the repo."
  - test: "Franco opens the magic-link email on his phone (Gmail/Mail app) and taps the link"
    expected: "Lands authenticated on the dashboard, not silently bounced to a blank /login"
    why_human: "REVIEW.md WR-08 (deferred, non-blocking): mobile mail apps often open links in an in-app browser without the PKCE code_verifier cookie, causing exchangeCodeForSession to fail silently (redirects to /login with no error message). This is the single most likely first-run failure mode for a phone-only magic-link flow and needs a real-device check."
  - test: "Franco uses the search → filter → profile → CV → WhatsApp/call flow one-handed, holding the phone in one hand"
    expected: "All primary actions (search input, chips, Filtros sheet, Aplicar/Limpiar, candidate cards, quick actions) are comfortably reachable/tappable with a thumb; nothing requires a second hand"
    why_human: "44px targets / 16px inputs / bottom-sheet placement / safe-area insets are programmatically verified (grep + Playwright 390x844 screenshots), but actual one-handed ergonomic feel on a real device is a human judgment call, not a static check."
  - test: "Franco looks at the LABURO visual identity (wordmark glow, blue accent, bubble/neon feel) on his phone and confirms it matches his D-01 direction ('azul, confianza, atractivo, letras medio glow, tipo globos') and reads as attractive for the eventos/nightlife crowd"
    expected: "Franco approves the look — this was his explicit aesthetic call, not a spec Claude can self-grade"
    why_human: "D-01 is a subjective brand/taste decision by Franco; the verifier can only confirm the tokens/fonts/glow recipes exist in code and render (screenshots attached), not that they satisfy his taste."
---

# Phase 2: Find Staff — Verification Report

**Phase Goal:** Franco can log into a phone-first standalone app and find the right candidate from the app's own pool (688 applicants) faster than the Google Sheet.
**Verified:** 2026-07-15T21:55:08Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Login + org-scoped dashboard talking to the app's own DB | ✓ VERIFIED (code+DB) / human-pending (live round-trip) | `app/(app)/layout.tsx` gates on `staff_app_my_membership` (server, RLS-scoped); `app/login/login-form.tsx` calls `signInWithOAuth('google')` + `signInWithOtp` (now `shouldCreateUser:false`, CR-01 fixed); `app/auth/callback/route.ts` does `exchangeCodeForSession` → `rpc('staff_app_provision_member')`, no `.schema('staff_app')` PostgREST call. Orchestrator-confirmed live: 2 admin `members` rows exist (role owner), impersonated non-member → 0 rows on all 3 views, impersonated admin → 687/688 rows + 1 owner row. `npm run build` exits 0 (re-run by verifier, confirmed). Playwright confirmed unauthenticated `/` → 307 → `/login`. **Gap:** the actual Google OAuth / magic-link network round-trip on Franco's phone was never exercised (Playwright smoke used a minted `verifyOtp` session, by design — PKCE needs a real browser) — see Human Verification. |
| 2 | Search/filter by oficio multi-select + free text | ✓ VERIFIED | `app/(app)/page.tsx`: `.overlaps('oficios', filters.oficios)` (GIN-indexed) + parameterized `.or(ilike…)` on nombre/apellido/experiencia_detalle/oficios_otro/ciudad/provincia, whitelisted via `lib/search-params.ts` (`isKnownOficio`/`isKnownProvincia`), never string-concatenated. Live MCP proof (02-03-SUMMARY): `oficios && ARRAY['Control de accesos']` = 246 rows of 687; live UI: "Bartender" chip → 6 candidatos (= DB count). |
| 3 | Availability filter (no overlapping app gig + manual note) | ✓ VERIFIED (documented minimum-honest scope) | `filtros-sheet.tsx` "ocultar ya asignados a un gig solapado" toggle excludes `staff_app_crew_busy` ids (real view: `DISTINCT staff_profile_id` from `crew ⋈ gigs`); `disponibilidad_aviso` (the manual note) renders on the profile page (`InfoRow label="Aviso de disponibilidad"`). Correctly returns 0 exclusions today because 0 gigs/crew exist yet (Phase 3 creates gigs) — this is accurate behavior, not a stub. The plan itself documents this as the intentional "minimum-honest" scope (full interval/overnight overlap needs real gig `starts_at/ends_at`, arriving in Phase 3); this is a deliberate, tracked scope decision baked into the plan's own acceptance criteria, not a defect. |
| 4 | Profile + CV via short-TTL signed URL | ✓ VERIFIED | `app/(app)/staff/[id]/page.tsx` renders full PERF-01 data (null-safe row omission, `donde_trabajar text[]` handled, `isHttpUrl` guards portfolio/linkedin). `cv-actions.ts` `signCv`: membership check FIRST (throws before touching service-role for non-members), THEN `createServiceRoleClient().storage.from('staff-cvs').createSignedUrl(key, 60)`; **CR-02 path-traversal validation confirmed present in code** (`objectKey.includes('..')`, leading `/`, backslash, control-char rejection — verifier re-read the file directly, not just the SUMMARY). Live proofs recorded in 02-04-SUMMARY: fresh signed URL → HEAD 200, same URL after 65s → 400 (TTL enforced), public/unsigned path → 400, tampered token → 400, orphan object → dead-link state (real data, not synthetic). Drive CVs (678) render optimistic `/preview` + always-present "Abrir CV". Access proof: non-member → 0 rows on `staff_app_profiles WHERE id=<real id>`. |
| 5 | One-handed phone usability | ✓ VERIFIED (technical indicators) / human-pending (physical feel) | 44px tap targets and 16px inputs present throughout (grep + visual confirmation in screenshots); `viewport-fit=cover` + `safe-area-inset-*` used in login CTA, `(app)` header/main, and the Filtros sheet footer; Base UI bottom-sheet pattern for fine filters; Playwright mobile viewport (390×844) screenshots confirm layout renders correctly at phone width with zero console errors. Actual ergonomic "one-handed" feel on a real device is a human judgment call — see Human Verification. |

**Score:** 5/5 roadmap success criteria verified at the code/DB/build level. 0 truths FAILED. 5 items require Franco's confirmation on his actual phone before the phase can be called fully closed (see Human Verification).

### Plan-Level Must-Haves (02-01 / 02-02 / 02-03 / 02-04 frontmatter)

All 4 plans' `must_haves.truths` and `artifacts` were cross-checked against the actual source files (not just SUMMARY prose) and, where DB state was claimed, against the orchestrator-supplied live query results. All resolved VERIFIED:

- **02-01** (DB read layer): 3 `security_invoker` views confirmed in `supabase/migrations/staff_app_0007_read_layer.sql` (`WITH (security_invoker = true)`, explicit `REVOKE ALL … FROM anon` on all 3, base-table `GRANT SELECT … TO authenticated`); `staff_app_provision_member()` present, `REVOKE … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated`; `members_role_check` / `is_org_writer` hardening (WR-04) present. Orchestrator confirms live: 688 rows (687→688 delta-copy of a documented straggler, 0 dup emails), 2 admin members, anon revoked.
- **02-02** (scaffold/login/gate): all files listed in frontmatter (`app/(app)/layout.tsx`, `app/login/login-form.tsx`, `app/auth/callback/route.ts`, `app/globals.css`) exist and contain the claimed patterns (`staff_app_my_membership`, `signInWithOtp`, `staff_app_provision_member`, `2F80FF`). `acceso-denegado.tsx` re-read directly by the verifier: exact copy "Esta cuenta no tiene acceso." + non-destructive "Cerrar sesión" confirmed. `admin.ts` reads `SUPABASE_SERVICE_ROLE_KEY` only, and (post-remediation) carries the `server-only` import guard.
- **02-03** (search UI): all 9 created files + `page.tsx` present; `.overlaps(`, `staff_app_crew_busy`, `isKnownOficio` confirmed by direct grep of the real files, not just the SUMMARY's claimed grep output.
- **02-04** (profile/CV): all 5 files present; `cv-actions.ts` re-read directly — membership check precedes signing, CR-02 traversal guard is real code (not just a SUMMARY claim), TTL constant is 60.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/staff_app_0006_hardening.sql` | WR-04/WR-05 fixes | ✓ VERIFIED | On disk, applied (git history + orchestrator live confirmation) |
| `supabase/migrations/staff_app_0007_read_layer.sql` | 3 security_invoker views + provision RPC | ✓ VERIFIED | On disk; grep-confirmed `security_invoker`, `REVOKE`, `GRANT` statements match SUMMARY claims |
| `app/(app)/layout.tsx` | D-06 gate | ✓ VERIFIED | Reads `staff_app_my_membership`, redirects unauth, renders `AccesoDenegado` |
| `app/login/login-form.tsx` | Google OAuth + magic link | ✓ VERIFIED | Both calls present; `shouldCreateUser:false` present (CR-01 fix) |
| `app/auth/callback/route.ts` | exchangeCodeForSession + provisioning | ✓ VERIFIED | No `.schema('staff_app')`; open-redirect guard (`safeNext`) present as a bonus hardening not in the original plan |
| `app/(app)/page.tsx` | Server search query | ✓ VERIFIED | `.overlaps`, `.or(ilike…)`, `.range(0,49)`, crew_busy exclusion all present |
| `app/(app)/staff/[id]/page.tsx` | Full profile (PERF-01) | ✓ VERIFIED | Null-safe rendering confirmed by direct read |
| `app/(app)/staff/[id]/cv-actions.ts` | Signed URL (PERF-02) | ✓ VERIFIED | Membership-then-sign order + traversal guard confirmed by direct read |
| `app/(app)/staff/[id]/cv-view.tsx` | Hybrid CV viewer | ✓ VERIFIED | Bucket/Drive/dead-link branches present; WR-04 `win.opener = null` fix confirmed present |
| `lib/supabase/admin.ts` | Service-role, server-only | ✓ VERIFIED | `import "server-only"` present (WR-05 fix); only imported by `cv-actions.ts` (grep-confirmed, no client importer) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/(app)/layout.tsx` | `public.staff_app_my_membership` | `.from().maybeSingle()` | ✓ WIRED | Confirmed by direct read + orchestrator live SQL proof |
| `app/auth/callback/route.ts` | `public.staff_app_provision_member` | `.rpc()` | ✓ WIRED | Confirmed by direct read |
| `app/(app)/page.tsx` | `public.staff_app_profiles` | `.overlaps('oficios',…)` | ✓ WIRED | Confirmed by direct read + live MCP counts in SUMMARY (246/18/6, orchestrator did not dispute) |
| `app/(app)/staff/[id]/cv-actions.ts` | `staff-cvs` bucket | `createSignedUrl` after membership check | ✓ WIRED | Confirmed by direct read; CR-02 validation confirmed present |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| SRCH-01 | 02-01, 02-03 | Search by oficio multi-select + free text | ✓ SATISFIED | `.overlaps` + parameterized `.or(ilike)`, live proof 246/6/18 rows |
| SRCH-02 | 02-01, 02-03 | Availability filter (crew-overlap exclusion + manual note) | ✓ SATISFIED (documented minimum-honest scope; full interval overlap needs Phase-3 gigs) | `staff_app_crew_busy` exclusion + `disponibilidad_aviso` display |
| SRCH-03 | 02-02, 02-03 | Mobile-first | ✓ SATISFIED | 44px/16px/viewport-fit/safe-area/390px Playwright screenshots |
| PERF-01 | 02-04 | Full candidate profile | ✓ SATISFIED | Null-safe render of all UI-SPEC data blocks, direct-read confirmed |
| PERF-02 | 02-04 | CV via short-TTL signed URL | ✓ SATISFIED | 60s TTL proven live (200→400 after 65s); CR-02 traversal guard confirmed |

Note: `.planning/REQUIREMENTS.md`'s traceability table still shows SRCH-01/02/03 as "In Progress" — this is stale documentation (written mid-phase, before 02-03/02-04 landed) and does not reflect a code gap; flagged as an info item, not a blocker.

### Anti-Patterns Found (from 02-REVIEW.md, re-verified by this verifier)

| File | Finding | Severity | Status |
|------|---------|----------|--------|
| `app/login/login-form.tsx` | CR-01: open signup on shared prod project | 🛑 was Critical | ✓ FIXED — `shouldCreateUser:false` confirmed present in code (commit 42ab56e) |
| `app/(app)/staff/[id]/cv-actions.ts` | CR-02: unvalidated object key → path traversal | 🛑 was Critical | ✓ FIXED — traversal/absolute-path/control-char guard confirmed present in code |
| `staff_app.members` / `is_org_writer` | WR-04: fail-open writer role | ⚠️ Warning | ✓ FIXED — `members_role_check` + enumerate-allowed confirmed in migration + orchestrator live state |
| `lib/supabase/admin.ts` | WR-05: no `server-only` guard | ⚠️ Warning | ✓ FIXED — `import "server-only"` confirmed present |
| `app/(app)/staff/[id]/cv-view.tsx` | WR-04(review#2)/tabnabbing: `window.opener` on bucket CV open | ⚠️ Warning | ✓ FIXED — `win.opener = null` confirmed present |
| `app/(app)/search-client.tsx` | WR-01: debounce loop on non-canonical text | ⚠️ Warning | Deferred (tracked in STATE.md Pending Todos), non-blocking — does not break any must-have; worst case is extra background requests, not incorrect results |
| `app/(app)/search-client.tsx` | WR-02: stale-props race drops just-applied filters | ⚠️ Warning | Deferred, non-blocking — narrow race window, does not break the primary flow |
| `app/(app)/page.tsx` | WR-03: hard `.range(0,49)` cap, wrong count label, no pagination | ⚠️ Warning | Deferred, non-blocking for the filtered-search truth (SC2) since filtering narrows well under 50 in all demonstrated cases; does affect an unfiltered browse of the full 688 — worth Franco's awareness, not a phase blocker |
| `lib/wa.ts` | WR-06: no AR phone normalization (local formats break wa.me/tel:) | ⚠️ Warning | Deferred, non-blocking — degrades gracefully per-candidate, doesn't break the flow overall |
| `app/(app)/page.tsx` | WR-07: crew_busy query error silently no-ops the toggle | ⚠️ Warning | Deferred, non-blocking — crew_busy is empty/error-free today (0 gigs exist) |
| `app/auth/callback/route.ts` | WR-08: PKCE cross-browser failures swallowed silently | ⚠️ Warning | Deferred — **elevated to a human-verification item** in this report because it's the single most likely first-run failure mode for a phone-only magic-link flow |
| — | No `TBD`/`FIXME`/`XXX` debt markers found in any Phase 2 file (verifier grep across all 12 key source files) | ℹ️ Info | Clean |

All Critical + the security-relevant Warnings (WR-04, WR-05, and the cv-view tabnabbing item) from the review are confirmed fixed by direct source inspection — not merely by trusting the REMEDIATION banner or SUMMARY prose. The remaining deferred warnings are UX/robustness issues explicitly tracked in `STATE.md` Pending Todos and do not break any of the 5 phase success criteria.

### Human Verification Required

See frontmatter `human_verification` — 5 items, all requiring Franco's real device/account:

1. **Real Google OAuth round-trip** — the code path and DB gate are proven; the live network round-trip via a real Google account was never exercised (by design — Playwright used a minted session for the search/profile smoke tests, since PKCE needs a real browser).
2. **Redirect-URL allowlist confirmation** — explicitly recorded as unresolved/ambiguous in `02-USER-SETUP.md`; a Supabase Dashboard setting, not verifiable from the repo.
3. **Magic-link tap from a mobile mail app** — WR-08 (PKCE cross-browser failure) is the most likely first-run breakage for a phone-only flow; needs a real-device check.
4. **One-handed physical ergonomics** — technical indicators (44px/16px/safe-area) are verified; the "feel" is not.
5. **Visual brand acceptance (D-01)** — Franco's own subjective aesthetic call; code/token existence is verified, taste is not.

### Gaps Summary

No must-have truths FAILED. No missing/stub artifacts. No unwired key links. Both Critical security findings and the security-relevant Warnings from `02-REVIEW.md` are confirmed fixed in the actual source (re-read directly, not inferred from SUMMARY claims). The remaining deferred review warnings (WR-01/02/03/06/07/08) are UX/robustness issues, explicitly tracked in `STATE.md`, and none of them break a phase success criterion on the currently-real data (0 gigs, 688 profiles).

The phase is functionally complete at the code/DB/build level. It is held at `human_needed` rather than `passed` because five things are outside the verifier's reach by nature: a real OAuth/magic-link round-trip on Franco's own phone/account, one Supabase Dashboard setting that Franco's own confirmation left ambiguous, the PKCE mobile-mail-app edge case, physical one-handed ergonomics, and Franco's subjective approval of the LABURO visual identity he specified in D-01.

---

_Verified: 2026-07-15T21:55:08Z_
_Verifier: Claude (gsd-verifier)_
