# Deferred items — Phase 05

Out-of-scope discoveries logged during execution (NOT fixed by the discovering plan).

## Found during 05-05 (cron reminders) — 2026-07-16

Pre-existing, out-of-scope build blockers in files 05-05 is explicitly forbidden to touch
(05-03 board / 05-04 profile). `npm run build` exits 1 because of these, independent of the
05-05 files (verified: build fails identically with `app/api/cron` + `vercel.json` removed).

1. **`app/(app)/page.tsx:105` — ESLint error `@next/next/no-html-link-for-pages`**
   Uses a raw `<a href="/">` to navigate to a Next page; must be `<Link />`. This is a hard
   ESLint error that aborts `next build`. File belongs to the 05-03 board slice (uncommitted `M`
   in the working tree). Owner: 05-03. Fix: replace `<a>` with `next/link` `<Link>`.

2. **`unhandledRejection PageNotFoundError: Cannot find module for page: /_document`** during
   "Collecting page data". Pre-existing; surfaces with 05-05 files removed too. Likely tied to
   the untracked `app/dev-login/` scaffold or the pages/app boundary — not a 05-05 concern.

3. **`app/(app)/staff/[id]/cv-actions.ts:52` — ESLint warning** (unused eslint-disable directive).
   Warning only, pre-existing, owner: earlier phase.

### 05-05 static verification (its own files) — CLEAN
- `npm run typecheck` (whole project) → passes, no errors.
- `npx eslint components/emails/reminder-email.tsx app/api/cron/reminders/route.ts` → 0 problems.
- `next build` → "Compiled successfully" (my files compile); it only fails later at the
  page-data/lint stage on the out-of-scope files above.
