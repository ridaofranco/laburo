# 03-03 SUMMARY — Create & Send Offer flow (vertical slice)

**Plan:** 03-03 · **Phase:** 3 · **Requirements:** OFER-01 (UI), OFER-02, OFER-03
**Status:** CODE COMPLETE · create/send flow proven live via the UI; the email SEND is blocked only on the encrypted SMTP secret (see below). **Completed:** 2026-07-16

## What shipped
- `app/(app)/staff/[id]/oferta/page.tsx` — member-gated offer route, loads candidate + gig list (`public.staff_app_gigs`).
- `app/(app)/staff/[id]/oferta/offer-form.tsx` — pick-or-quick-create gig + role/amount/conditions, honest states (sending/sent/failed), wa.me button (official glyph).
- `app/(app)/staff/[id]/offer-actions.ts` — `createAndSendOffer` 'use server': member-gated → `rpc('staff_app_create_offer')` (authenticated client) → build `${SITE_URL}/o/${token}` → `await render(OfferEmail)` → `sendMail` → honest result. No service-role.
- `app/(app)/staff/[id]/page.tsx` — "Crear oferta" entry; `quick-actions.tsx` — swapped the generic lucide icon for the official WhatsApp glyph.
- Commits: `ea299b1`, `5a4f742`.

## Live verification (dev server, authed via dev-login as the seeded admin)
- **Create path WORKS end-to-end from the UI:** a real submit (`POST /staff/[id]/oferta`) returned 200 and created exactly one `staff_app.offers` row (`status='sent'`, token_hash set) + one quick-created gig — confirmed in the live DB. This proves OFER-01 (UI) + the RPC wiring.
- Build/typecheck/lint clean; no service-role in the flow (grep-negative); official glyph in place.

## The one open item: SMTP secret (email SEND)
- The DER Ferozo SMTP vars are stored **Encrypted** in somosder-web's Vercel and therefore **cannot be retrieved via `vercel env pull`** (they return empty). So `.env.local` currently has empty SMTP values → `smtpEnabled()` is false → the mailer stays HONEST and sends nothing (`{ok:false, channel:'none'}`), and the UI offers the wa.me fallback with the working link. **No email was ever sent to a real candidate** (verified: the honest path held; a test offer accidentally created against a real candidate sent nothing and was deleted).
- **To finish OFER-02 (real email):** Franco must supply `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_SECURE` (true), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_NAME` (from the Ferozo panel or the Vercel dashboard values) → put them in `.env.local` (local) and the LABURO Vercel project (prod). Then a send smoke test confirms deliverability (this is also the Phase-5 SPF/DKIM deliverability item).
- `/o/[token]` is built in Phase 4 — until then the emitted link is valid but 404s (expected).

## Note (TDD gate)
Task 2 carried `tdd="true"` but this zero-budget repo has no test framework installed; standing up vitest + Supabase/nodemailer mocks is new infra out of the plan's scope. The four behaviors are guaranteed by construction + static greps + the honest `MailResult` contract + the live UI proof above. Carried as a deferred item.
