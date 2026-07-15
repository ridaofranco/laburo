---
phase: 02-find-staff
reviewed: 2026-07-15T20:07:17Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - app/(app)/acceso-denegado.tsx
  - app/(app)/candidate-card.tsx
  - app/(app)/filtros-sheet.tsx
  - app/(app)/layout.tsx
  - app/(app)/page.tsx
  - app/(app)/results-states.tsx
  - app/(app)/search-client.tsx
  - app/(app)/staff/[id]/cv-actions.ts
  - app/(app)/staff/[id]/cv-view.tsx
  - app/(app)/staff/[id]/page.tsx
  - app/(app)/staff/[id]/quick-actions.tsx
  - app/auth/callback/route.ts
  - app/layout.tsx
  - app/login/login-form.tsx
  - app/login/page.tsx
  - lib/avatar-color.ts
  - lib/cv.ts
  - lib/oficios.ts
  - lib/provincias.ts
  - lib/search-params.ts
  - lib/supabase/admin.ts
  - lib/supabase/client.ts
  - lib/supabase/middleware.ts
  - lib/supabase/server.ts
  - lib/utils.ts
  - lib/wa.ts
  - middleware.ts
  - supabase/migrations/staff_app_0006_hardening.sql
  - supabase/migrations/staff_app_0007_read_layer.sql
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---


> **REMEDIATION (2026-07-15, commit 42ab56e):** CR-01, CR-02, WR-04, WR-05 FIXED and build-verified. WR-01/02/03/06/07/08 deferred to a dedicated polish pass or Phase 3 (tracked in STATE.md Pending Todos). Info items acknowledged.

# Phase 2: Code Review Report

**Reviewed:** 2026-07-15T20:07:17Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the full Phase 2 surface: auth/session (middleware, PKCE callback, login), the D-06 membership gate, the read layer (security_invoker views + grants), search param handling, the profile screen, and the CV signing path.

The load-bearing security design is fundamentally sound: RLS via security_invoker views is the real authority (the layout gate is correctly treated as defense-in-depth only), the service-role key is confined to `cv-actions.ts` behind a membership check, `anon` is explicitly revoked from all three views, search params are whitelist-validated (`oficios`, `provincia`) and free text is stripped of the PostgREST `.or()` grammar characters (`,`, `(`, `)`, `\`, `%`, `*`), and free-text profile fields are rendered as React text (auto-escaped) with `isHttpUrl` correctly blocking `javascript:` hrefs on links.

Two Critical findings remain: the login form allows anonymous account creation in the SHARED production Supabase project (missing `shouldCreateUser: false`), and `signCv` passes a client-controlled object key to the service-role storage client without validation, enabling path traversal out of the `staff-cvs` bucket into any bucket of the shared HITO project. Warnings cover a search debounce/URL-canonicalization loop, a stale-props race that silently drops applied filters, a hard 50-result cap that both lies in the count and makes candidates 51+ unreachable, reverse tabnabbing from untrusted uploaded CVs, missing `server-only` guard on `admin.ts`, broken wa.me/tel links for non-E.164 phone data, a silently no-op'ing "ocultar asignados" toggle on error, and silent auth-callback failures.

## Critical Issues

### CR-01: Login form allows anonymous account creation in the shared production Supabase project

**File:** `app/login/login-form.tsx:33-38`
**Issue:** `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })` is called without `shouldCreateUser: false`. The Supabase default is `shouldCreateUser: true`, so **anyone** who reaches `/login` (a public page) can type any email and create a brand-new row in `auth.users` — in the SHARED live HITO project (`luillpzfqzbpoqkgvjuw`), not an isolated one. This is an unauthenticated write to shared production infrastructure:

- Pollutes HITO's `auth.users` with unbounded junk accounts. If HITO has any `on auth.users insert` trigger (a very common `handle_new_user` pattern), every junk signup also writes rows into HITO's own tables.
- Every junk account holds the `authenticated` role, i.e., the exact role your views and `staff_app_provision_member` are granted to. RLS returns them 0 rows today, but this needlessly widens the population that can exercise those grants.
- Burns the project-wide auth email quota (magic-link sends are rate-limited per project on the free tier) — an attacker can exhaust it and lock Franco out of his own login (denial of service on the only auth path).

The allowlist is exactly 2 emails and both already exist in `auth.users` (verified in `staff_app_0007` seed comments), so there is zero legitimate need for signups from this form. Note the project-level "Disable new user signups" toggle is NOT a safe alternative here because the project is shared with HITO — the fix must be in this app's code.
**Fix:**
```ts
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: callbackUrl(),
    shouldCreateUser: false, // allowlisted admins already exist; never create users
  },
});
```
(With `shouldCreateUser: false`, unknown emails get an "otp_disabled"-style error and no user row; the two real admins are unaffected. Keep the generic error toast so the form doesn't become an email oracle.)

### CR-02: `signCv` signs a client-controlled object key with the service-role client — path traversal out of the `staff-cvs` bucket

**File:** `app/(app)/staff/[id]/cv-actions.ts:31-49`
**Issue:** `signCv(objectKey)` is a server action whose `objectKey` argument is fully attacker-controllable by any caller who passes the membership gate (and by any script running in a member's session, e.g., via a future XSS). The key is passed unvalidated into `admin.storage.from("staff-cvs").createSignedUrl(objectKey, 60)`. storage-js builds the request URL as `.../object/sign/staff-cvs/<objectKey>`; a key like `../hito-private-bucket/secret.pdf` is normalized by URL dot-segment resolution into `.../object/sign/hito-private-bucket/secret.pdf` — signed with the **service role**, which bypasses all storage policies. Because this is HITO's shared live project, the blast radius is not just LABURO's CVs: it is every object in every bucket of the shared project. The membership check limits callers to the 2 owner accounts today, but this is exactly the boundary (`only staff-cvs, only via this one door`) the phase's own security contract (T-02-14/15/16) claims to enforce — and the enforcement is missing.
**Fix:** Do not accept a raw object key from the client at all. Sign from the profile id and derive the key server-side:
```ts
export async function signCv(staffProfileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("staff_app_my_membership").select("role").maybeSingle();
  if (!membership) throw new Error("forbidden");

  // Derive the key from the RLS-scoped row, never from the client.
  const { data: row } = await supabase
    .from("staff_app_profiles").select("cv_url").eq("id", staffProfileId).maybeSingle();
  const cv = classifyCv(row?.cv_url);
  if (cv.kind !== "bucket") return null;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(CV_BUCKET).createSignedUrl(cv.key, SIGNED_URL_TTL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}
```
At absolute minimum (if keeping the current signature), reject traversal before signing:
```ts
if (!objectKey || objectKey.includes("..") || objectKey.startsWith("/")) return null;
```

## Warnings

### WR-01: Search debounce loop — non-canonical text never converges, causing endless `router.replace` refetch cycles

**File:** `app/(app)/search-client.tsx:69-73` (with `lib/search-params.ts:51-53`)
**Issue:** The debounce effect fires whenever `text !== initialFilters.q`. The client writes the **raw** text into the URL (`buildQueryString` does not sanitize), but the server parses it back through `sanitizeText`, which trims, collapses whitespace, and strips `, ( ) \ % *`. So if the user types anything that sanitization changes — a trailing space (extremely common on mobile keyboards/autocomplete), a comma, `%`, parentheses — then `text` can never equal `initialFilters.q`. Each server response produces a new `initialFilters` object → new `composeAndPush` identity (`useCallback` deps include `initialFilters`) → the effect re-runs → after 280 ms it `router.replace`s the same URL → dynamic RSC refetch → new props → repeat. Net effect: a permanent background request loop (~1 request per 280 ms + RTT) for as long as the screen is mounted, on a mobile-first app.
**Fix:** Compare canonical values and skip no-op navigations:
```ts
useEffect(() => {
  if (sanitizeText(text) === initialFilters.q) return; // compare canonical forms
  const id = setTimeout(() => composeAndPush(text, selectedRef.current), 280);
  return () => clearTimeout(id);
}, [text, initialFilters.q, composeAndPush]);
```
(Also consider sanitizing in `buildQueryString` so the URL always carries the canonical `q`.)

### WR-02: Stale `initialFilters` race silently drops just-applied fine filters

**File:** `app/(app)/search-client.tsx:43-62`
**Issue:** `composeAndPush` falls back to `initialFilters.provincia/ciudad/finde/...` (server props from the LAST completed render) when called from the text debounce or `toggleOficio`. If the user applies fine filters in the sheet and then types or taps an oficio chip before the server round-trip completes (a normal sequence on a slow mobile connection — the race window is the full network latency plus 280 ms), the next `composeAndPush` rebuilds the URL from the stale props and **silently removes the filters they just applied**. The badge count and the sheet will then disagree with what the user did.
**Fix:** Keep the fine filters in a client ref that is the source of truth for URL building (updated in `applyFine` and re-synced from `initialFilters` on prop change), mirroring the existing `textRef`/`selectedRef` pattern, instead of reading them from server props inside `composeAndPush`.

### WR-03: Hard 50-result cap with no pagination — count label is wrong and candidates 51+ are unreachable

**File:** `app/(app)/page.tsx:72` and `app/(app)/search-client.tsx:164-167`
**Issue:** The query is capped at `.range(0, 49)` and there is no "load more"/pagination UI, no `count` request, and no truncation indicator. With 688 profiles in the pool, the default view reports "50 candidatos" — a factually wrong number — and candidates 51 onward (sorted by `nombre`, so everyone from roughly the second letter of the alphabet down) can never be surfaced except by narrowing filters. For a tool whose core value is "Franco finds staff in his real pool", silently hiding ~93% of the unfiltered pool is a correctness defect, not a style choice.
**Fix:** Minimum viable: request `{ count: "exact" }` (or `"estimated"`) in the select, render "50 de 688 candidatos" when truncated, and add a "Ver más" that extends the range via a `page`/`offset` search param. If pagination is deliberately deferred, at least show the true total and a truncation notice.

### WR-04: Reverse tabnabbing — `window.open` + navigate exposes `window.opener` to untrusted uploaded CV files

**File:** `app/(app)/staff/[id]/cv-view.tsx:82-96`
**Issue:** `BucketCv.abrir()` opens `about:blank` synchronously and later assigns `win.location.href` to the signed URL. The opened tab retains a live `window.opener` reference to the app. The content it navigates to is an **applicant-uploaded file** from the public intake form, served by Supabase storage with its stored content type — a malicious applicant can upload an HTML file as their "CV", and when Franco taps "Abrir CV" that page can script `window.opener.location = "https://evil-login-clone..."` (classic reverse tabnabbing / phishing against the one privileged user of the system). Note `DriveCv.abrir()` correctly passes `"noopener,noreferrer"` — only the bucket path is exposed.
**Fix:** Sever the opener right after opening, before any navigation:
```ts
const win = window.open("about:blank", "_blank");
if (win) win.opener = null;
```

### WR-05: `lib/supabase/admin.ts` lacks the `server-only` build-time guard

**File:** `lib/supabase/admin.ts:13-15`
**Issue:** Nothing prevents a future client component from importing `createServiceRoleClient`. Today the key would not leak (non-`NEXT_PUBLIC_` env vars are not inlined into client bundles, so it would throw at runtime), but the file's whole contract is "server only", and the phase's own security contract (T-02-15) depends on that confinement holding as the codebase grows in Phases 3+. The standard one-line guard turns an accidental client import into a **build error** instead of a runtime surprise.
**Fix:**
```ts
import "server-only"; // first line of lib/supabase/admin.ts (npm i server-only)
```

### WR-06: `waLink`/`telLink` assume E.164-with-country-code data — local Argentine formats produce broken links

**File:** `lib/wa.ts:7-17` and `app/(app)/staff/[id]/quick-actions.tsx:29,38`
**Issue:** The pool's `telefono` is free text from a public web form. `e164()` only strips non-digits; it does not validate length or add a country code. Real-world AR entries like `11 5555-5555` (no country code) or `011 4444-5555` (leading 0) yield `wa.me/1155555555` / `wa.me/01144445555` — WhatsApp rejects both ("phone number shared via url is invalid") — and `tel:+01144445555` is equally wrong (the `+` is unconditionally prepended to a national-format number). A phone with no digits at all yields `https://wa.me/?text=…`. Since these two buttons are the phase's primary conversion action, silently broken deep links for a chunk of the 688 real rows is a functional defect.
**Fix:** Normalize AR numbers in `e164`: strip non-digits, drop a leading `0`, drop a `15` mobile prefix after the area code where detectable, and prepend `54` (and `9` for mobiles) when the number doesn't already start with `54`; return `null` for fewer than 8 digits and hide/disable the buttons in `QuickActions` when normalization fails.

### WR-07: "Ocultar ya asignados" silently no-ops when the crew_busy query errors

**File:** `app/(app)/page.tsx:60-70`
**Issue:** The `staff_app_crew_busy` fetch destructures only `data`; if the query errors, `busy` is `null`, `ids` is empty, and the exclusion filter is simply not applied — the page renders results **with** assigned people while the Filtros badge asserts the toggle is active. The user gets a wrong answer with no indication anything failed (contrast: the main query's `error` does drive the error state). Secondary: `ids` is interpolated unbounded into a `.not("id","in",...)` URL — fine while crew is near-empty, but this will hit URL-length limits as Phase 3 populates crew.
**Fix:** Capture the error and treat it as a failed search:
```ts
const { data: busy, error: busyError } = await supabase
  .from("staff_app_crew_busy").select("staff_profile_id");
if (busyError) {
  return <SearchClient candidates={[]} error initialFilters={filters} />;
}
```
For Phase 3, move the exclusion into the view/query server-side (e.g., a `NOT EXISTS` in the view or an RPC) instead of shipping id lists through the URL.

### WR-08: Auth callback failures are silently swallowed — user lands on /login with zero feedback

**File:** `app/auth/callback/route.ts:21-35` and `app/login/login-form.tsx`
**Issue:** Every failure mode of the callback — missing `code`, expired/used link, and the important PKCE cross-client case (magic link opened in a different browser than the one that requested it, which is the DEFAULT behavior of mobile mail apps opening their in-app browser: the `code_verifier` cookie doesn't exist there, so `exchangeCodeForSession` always fails) — redirects to plain `/login` with no error param. The login page renders as if nothing happened; Franco taps the emailed link on his phone, silently bounces back to the login form, and has no way to know why. For an app whose only users log in from a phone, this is the most likely first-run failure and it is invisible.
**Fix:** Redirect with a reason and surface it: `return NextResponse.redirect(`${origin}/login?error=auth`)`; in `app/login/page.tsx` read `searchParams.error` and pass it to `LoginForm` to render "No pudimos validar el link. Pedí uno nuevo desde este mismo navegador." Also log `error.message` server-side in the callback for diagnosis.

## Info

### IN-01: `classifyCv` fallback misroutes any non-Drive http URL to the bucket path (guaranteed dead link)

**File:** `lib/cv.ts:38-56`
**Issue:** Anything that isn't a Drive match becomes `{ kind: "bucket" }` — including real http URLs (Dropbox, `docs.google.com/document/...`, personal sites). Those get sent to `createSignedUrl` (fails) and render dead-link, when simply opening the URL in a new tab would work. The live data today is only Drive + 9 bucket keys (verified per the file's A3 note), so this is latent, but new intake rows can break it at any time.
**Fix:** Add an `external` branch: `if (isHttpUrl(url)) return { kind: "external", href: url }` before the bucket fallback, rendered as an "Abrir CV" new-tab link (with `noopener`).

### IN-02: Duplicate `oficios` array values produce duplicate React keys

**File:** `app/(app)/candidate-card.tsx:73-84` and `app/(app)/staff/[id]/page.tsx:185-196`
**Issue:** `key={oficio}` over a free-form `text[]` column; a row with a repeated oficio (nothing in the schema prevents it) triggers duplicate-key rendering bugs.
**Fix:** Dedupe once: `const tags = [...new Set((c.oficios ?? []).filter(Boolean))]`.

### IN-03: Search query error is swallowed without server-side logging

**File:** `app/(app)/page.tsx:72-73`
**Issue:** `error` is collapsed to a boolean for the client (correct — don't leak details), but nothing logs it on the server, so a broken view/grant/RLS regression in the shared project surfaces only as a generic "Reintentar" screen with no diagnostic trail.
**Fix:** `if (error) console.error("staff_app_profiles query failed:", error.message);` before rendering.

### IN-04: `sanitizeText` does not strip the `_` LIKE wildcard

**File:** `lib/search-params.ts:51-53`
**Issue:** `%` and `*` are stripped but `_` (single-char LIKE wildcard) is not, so a query like `ana_maria` fuzzily matches any character in that position. Not a security issue (it stays inside the value slot of the filter grammar); just an unexpected-match quirk.
**Fix:** Include `_` in the strip class, or escape it: `.replace(/[,()\\%*_]/g, " ")`.

### IN-05: Callback builds the redirect from `request.url` origin — fragile behind proxies

**File:** `app/auth/callback/route.ts:15,30`
**Issue:** `new URL(request.url).origin` is correct on Vercel, but behind any other proxy/load balancer the origin can be the internal host. The reference Supabase SSR callback checks `x-forwarded-host` for exactly this reason. Zero impact on the current Vercel Hobby deployment; noting it as deployment-portability hardening only.
**Fix:** Prefer `request.headers.get("x-forwarded-host")` (with `https://`) over `origin` when present, per the supabase-ssr example.

---

_Reviewed: 2026-07-15T20:07:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
