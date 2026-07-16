# Phase 3: Create & Send Offers - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary
Franco turns a chosen candidate into a job offer tied to an app gig, and gets it to the person by email (magic link) + one-tap WhatsApp. OFER-01/02/03. NO HITO event link (Phase 6). NO accept flow (Phase 4). Uses the Phase-1 offers table + magic-link RPCs already built.
</domain>

<decisions>
## Implementation Decisions
- **D-01 (design deferred):** Build with the CURRENT placeholder design system (same tokens as Phase 2). The premium reskin happens AFTER Phase 5, all at once. Keep components cleanly structured so the reskin is a token swap, not a rewrite. See [[franco-diseno-cero-ia]].
- **D-02 (email):** Send via the DER Ferozo SMTP with nodemailer (reuse somosder-web/src/lib/email.js pattern + env: SMTP_HOST/PORT/USER/PASSWORD/SECURE, MAIL_FROM_NAME/ADDRESS). Zero paid ESP. Author the offer email as a React email (react-email) rendered to HTML. Honest send feedback (sending / sent / failed), never a silent success.
- **D-03 (WhatsApp):** The wa.me button MUST use the REAL WhatsApp logo (official glyph, green #25D366), never a generic icon. Pre-filled message = offer summary + the same magic link. See [[franco-whatsapp-logo]].
- **D-04 (gig):** Offer is tied to an app gig — pick an existing gig or quick-create one (name, fecha, lugar, rol). `gigs.hito_event_id` stays NULL this phase (linking is Phase 6).
- **D-05 (offer creation writes to staff_app):** creating an offer inserts into `staff_app.offers` with a 256-bit token (hashed at rest, matching the Phase-1 RPC expectations) via a SECURITY DEFINER creator function or a members-scoped path; the emailed/wa.me link points to the public offer page `/o/[token]` (that page is built in Phase 4).
- **Copy:** Argentine voseo, warm, no em dash (Franco hard rule).
</decisions>

<canonical_refs>
- .planning/phases/02-find-staff/02-UI-SPEC.md — current design tokens/components to reuse
- .planning/phases/01-own-data-foundation/01-02-SUMMARY.md — the offers table + get_public_offer/accept_offer/decline_offer RPCs, token shape (256-bit sha256 hashed, staff_app schema)
- /Users/fridao/Proyectos/SOMOS DER/somosder-web/src/lib/email.js — the working Ferozo SMTP/nodemailer pattern to copy
- /Users/fridao/Proyectos/HITO-by-DER-main — mailer.ts pattern + Base UI form components
- staff-app: existing app/(app)/* (search, profile) — the shell/patterns to extend; server accesses staff_app via public security_invoker views + SECURITY DEFINER RPCs (PostgREST does NOT expose staff_app)
</canonical_refs>

<code_context>
- Offer creation is an authed (member) action → can use a public SECURITY DEFINER RPC (like staff_app_register_applicant) or a members-scoped insert path, since staff_app isn't PostgREST-exposed. Token generated server-side, hashed at rest, raw token only in the link.
- gigs table exists (staff_app.gigs, nullable hito_event_id). Need create/list gigs (members-scoped).
- SMTP creds must be added to the app's env (.env.local + Vercel) — reuse somosder-web values.
</code_context>

<deferred>
- HITO event linking on the gig → Phase 6.
- The public offer page + accept/decline → Phase 4 (this phase only creates + sends; the link target is built next phase).
- Premium visual reskin → after Phase 5.
</deferred>

---
*Phase: 03-create-send-offers · 2026-07-16*
