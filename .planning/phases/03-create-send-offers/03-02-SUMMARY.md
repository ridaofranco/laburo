---
phase: 03-create-send-offers
plan: 02
subsystem: infra
tags: [nodemailer, react-email, smtp, ferozo, whatsapp, wa.me, email]

# Dependency graph
requires:
  - phase: 02-find-staff
    provides: "lib/wa.ts (waLink/telLink), quick-actions.tsx, app/globals.css @theme tokens, classifyCv routing for offer emails"
provides:
  - "lib/email/mailer.ts — honest SMTP-only mailer (MailResult, never throws)"
  - "components/emails/offer-email.tsx — react-email OfferEmail (voseo, no em dash)"
  - "components/icons/whatsapp-glyph.tsx — official WhatsApp glyph as React component"
  - "lib/wa.ts — waLink/telLink with AR phone normalization (WR-06 fixed)"
  - "nodemailer@^9 + @react-email/components@^1 + @types/nodemailer installed"
affects: [03-03, 04-public-offer-page, 05-ship]

# Tech tracking
tech-stack:
  added: ["nodemailer@^9.0.3", "@react-email/components@^1.0.12", "@types/nodemailer@^6.4.24"]
  patterns:
    - "Honest mailer: sendMail() returns MailResult {ok,channel,error}, never throws, never fakes a 250-OK"
    - "react-email component rendered via async render() (v2) to an HTML string for nodemailer"
    - "Official brand glyph reused verbatim from sibling repo, not redrawn"

key-files:
  created:
    - lib/email/mailer.ts
    - components/emails/offer-email.tsx
    - components/icons/whatsapp-glyph.tsx
  modified:
    - lib/wa.ts
    - package.json
    - package-lock.json

key-decisions:
  - "SMTP-only mailer: Resend branch dropped (not just gated) — CERO ESP pago; MailChannel = 'smtp' | 'none'"
  - "MAIL_FROM_ADDRESS defaults to SMTP_USER (documented fallback) since it is not set in .env.local"
  - "WR-06 fixed with a deterministic AR-only heuristic (strip leading 0/15, prefix 54); no libphonenumber dep"
  - "WhatsApp path copied VERBATIM from somosder-web WhatsAppFab.astro (D-03); the plan's grep marker '1.886-.462z' was inaccurate about the middle of the path — verbatim rule wins"

patterns-established:
  - "Honest email feedback (D-02): callers MUST check MailResult.ok and fall back to wa.me on failure"
  - "Server-only mailer module (import 'server-only') reading process.env.SMTP_*"

requirements-completed: [OFER-02, OFER-03]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 3 Plan 02: Send Toolkit (mailer + email + WhatsApp glyph + wa.me) Summary

**Honest SMTP-only nodemailer mailer (MailResult, never throws), a voseo react-email OfferEmail rendered via async render(), the official WhatsApp glyph as a React component, and WR-06 AR phone normalization in wa.me — the SEND building blocks 03-03 will wire.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-16
- **Tasks:** 2 executed (Task 1 was the package gate — pre-authorized by Franco via the orchestrator)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Installed `nodemailer@^9.0.3`, `@react-email/components@^1.0.12` (bundles `@react-email/render@2.x`, async), `@types/nodemailer@^6` — lockfile committed.
- Ported HITO's `mailer.ts` as `lib/email/mailer.ts`, SMTP-only and honest: `sendMail()` returns `MailResult {ok, channel, error}`, never throws, never fakes a 250-OK; `smtpEnabled()` false → `{ok:false, channel:'none'}`.
- Authored `components/emails/offer-email.tsx` (`OfferEmail`) in Argentine voseo, no em dash, dark-brand inline styles echoing the `@theme` tokens; amount/conditions/whenText conditionally rendered; default child escaping (no raw HTML injection).
- Extracted the OFFICIAL WhatsApp glyph into `components/icons/whatsapp-glyph.tsx` (`WhatsAppGlyph`), path copied verbatim from `somosder-web/src/components/WhatsAppFab.astro`.
- Fixed WR-06 in `lib/wa.ts`: `normalizeAr()` strips a leading `0` (trunk) and `15` (subscriber) and prefixes `54`, leaving already-`54` numbers untouched; used by `waLink` and `telLink`.

## Task Commits

1. **Task 2: Install deps, port mailer.ts, fix wa.me AR normalization** — `e090a16` (feat)
2. **Task 3: OfferEmail react-email component + official WhatsApp glyph** — `7c99208` (feat)

_Task 1 was a `checkpoint:human-verify` package gate, pre-authorized by Franco via the orchestrator's `checkpoint_authorization` (packages + versions named explicitly). No separate commit._

## Files Created/Modified
- `lib/email/mailer.ts` (created) — honest SMTP-only mailer; `sendMail` returns `MailResult`, never throws; Ferozo transport with lowercased `SMTP_USER` and short timeouts; `from` = `"${MAIL_FROM_NAME||'SOMOS DER'}" <${MAIL_FROM_ADDRESS||SMTP_USER}>`.
- `components/emails/offer-email.tsx` (created) — `OfferEmail` react-email component (voseo, no em dash, no raw HTML injection).
- `components/icons/whatsapp-glyph.tsx` (created) — `WhatsAppGlyph`, official verbatim path, `fill="currentColor"` for a `#25D366` button.
- `lib/wa.ts` (modified) — `normalizeAr` AR heuristic wired into `waLink`/`telLink` (WR-06).
- `package.json` / `package-lock.json` (modified) — new deps.

## Decisions Made
- **SMTP-only mailer:** dropped HITO's Resend fetch branch entirely (not just gated off) so no Resend path is wired — CERO gasto. `MailChannel` is `'smtp' | 'none'`. The honest never-throws contract is preserved.
- **`MAIL_FROM_ADDRESS` fallback:** not set in `.env.local`, so the mailer defaults it to `SMTP_USER` (documented in-code). Franco can add a dedicated `from` later without code changes.
- **AR normalization heuristic:** deterministic AR-only (no `libphonenumber`, zero-budget). The `15` strip is anchored to the subscriber position (`^(\d{2,4})15(\d{6,8})$`) so it does not eat a legitimate area code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a code comment so the security grep gate passes**
- **Found during:** Task 3 (OfferEmail component)
- **Issue:** The plan's verify gate runs `! grep -q "dangerouslySetInnerHTML"`. My explanatory comment mentioned the token literally, which would trip the gate as a false positive.
- **Fix:** Reworded the comment to "NUNCA inyectamos HTML crudo" — no functional change; the component never uses raw HTML injection.
- **Files modified:** components/emails/offer-email.tsx
- **Verification:** `grep -q "dangerouslySetInnerHTML"` now returns no match; render escaping test confirms pool data is escaped.
- **Committed in:** `7c99208` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, comment-only).
**Impact on plan:** No scope creep. All acceptance criteria met.

## Issues Encountered

- **Plan grep marker inaccuracy (not a code issue):** the glyph verify gate greps for `1.886-.462z`, but the verbatim official path has additional segments between `1.886` and the final `.462z`. The VERBATIM requirement (D-03 hard rule, orchestrator `critical_rules`, "do not redraw") is authoritative, so the path was copied byte-for-byte (`diff` against `WhatsAppFab.astro` = identical). The path does start with `M16.004 0C` and end with `.462z`. The buggy grep substring was not honored over the verbatim logo.

## Verification (beyond typecheck/lint)

- `npm run typecheck` clean; `npm run lint` clean for plan files (1 pre-existing warning in `cv-actions.ts` logged to `deferred-items.md`, out of scope).
- **Runtime render test:** compiled `offer-email.tsx` and called `render()` — confirmed it returns a Promise (async, v2), resolves to an HTML string containing the heading/CTA/amount/link, and that an injected `<script>` in a pool field is escaped (T-3-06).
- **Runtime wa.me test:** `011 15 1234 5678` → `541112345678`, `+54 9 351 555 0000` → `5493515550000` (unchanged), plus 3 more AR cases — all pass.
- **Glyph verbatim:** `diff` of the `d=` path against `somosder-web/src/components/WhatsAppFab.astro` = identical.

## User Setup Required

**SMTP env vars for real sending.** `SMTP_HOST/PORT/USER/PASSWORD/SECURE` + `MAIL_FROM_NAME` are already present in `.env.local`. `MAIL_FROM_ADDRESS` is NOT set and defaults to `SMTP_USER` in the mailer — set it explicitly only if Franco wants a distinct `from`. See `03-USER-SETUP.md`. With SMTP absent the mailer stays honest (`{ok:false, channel:'none'}`) and the wa.me fallback still works.

## Next Phase Readiness
- 03-03 can `await render(<OfferEmail .../>)`, hand the HTML to `sendMail()`, check `MailResult.ok`, and drop `<WhatsAppGlyph/>` into a `bg-[#25D366]` wa.me button.
- No `/o/[token]` destination yet (Phase 4) — the emailed link is valid but 404s until then; do not offer to a real candidate before Phase 4.

## Self-Check: PASSED

All created files exist on disk (`lib/email/mailer.ts`, `components/emails/offer-email.tsx`, `components/icons/whatsapp-glyph.tsx`, modified `lib/wa.ts`) and both task commits (`e090a16`, `7c99208`) are present in git history.

---
*Phase: 03-create-send-offers*
*Completed: 2026-07-16*
