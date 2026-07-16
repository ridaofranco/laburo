# Phase 4: Accept & Close the Loop - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary
A candidate opens the magic link `/o/[token]` on their phone with NO account, sees the offer (role, gig, dates, amount, conditions), and accepts or declines via an explicit POST button. On accept, crew is created **in the app** atomically. Franco sees each offer's status flip (sent → viewed → accepted/declined/expired). ACPT-01, ACPT-02, ACPT-03 (app side only), STAT-01.
</domain>

<decisions>
## Implementation Decisions
- **D-01 (reuse existing RPCs):** The public page uses the Phase-1 SECURITY DEFINER RPCs already built and verified in migration 0003: `get_public_offer(p_token)` (read + flips `sent`→`viewed` on first hit), `accept_offer(p_token)` (validates token+expiry+status, flips to `accepted`, inserts app `crew` atomically `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING`), `decline_offer(p_token)`. Call them with the ANON supabase client from the public route (they are `GRANT EXECUTE ... TO anon`). Do NOT write a new create/accept path — reuse these. Verify their exact current signatures/returns before planning (query live + read 01-02-SUMMARY).
- **D-02 (no state-changing GET):** viewing the offer is a safe GET (calls `get_public_offer`, which only flips to `viewed` — acceptable side effect, not a booking). Accept/decline MUST be an explicit **POST** (Server Action or Route Handler), never a GET, so email/WhatsApp link-preview bots cannot trigger acceptance. (Pitfall from Phase-1 design: bots hit GETs.)
- **D-03 (idempotency / already-accepted):** `accept_offer` on an already-accepted or expired token returns `{ok:false, reason:'invalid_or_expired'}` (single-use guard). The public page MUST distinguish and message the candidate clearly: a distinct "esta oferta ya fue aceptada" / "el link venció" state, NOT a scary generic error. Consider whether `accept_offer` needs a distinct reason code (`already_accepted` vs `expired`) — if a code change helps, that is a small `staff_app` migration (applied live by the orchestrator; WR-05 explicit REVOKE). Prefer handling via the returned reason + offer status read if possible, no migration.
- **D-04 (HITO bridge OUT of scope):** ACPT-03 mentions the HITO bridge (BRDG-03), but the bridge is deferred to **Phase 6**, and gigs never carry a non-NULL `hito_event_id` until then. So Phase 4 = **app-only crew creation**. No HITO call. Note the seam but do not build it.
- **D-05 (design deferred):** placeholder tokens/components (same as Phase 2/3). This IS a public, unauthenticated, mobile-first page (candidate on a phone), so it must be clean and legible, but no premium reskin — that is after Phase 5.
- **D-06 (STAT-01 surface):** Franco sees offer status (enviada / vista / aceptada / rechazada / vencida). `viewed` is set by `get_public_offer`; `expired` is derived (`now() > expires_at`). Surface the status where Franco already looks — the candidate profile `/staff/[id]` (and/or the offer entry). Keep minimal; a full status board is Phase 5.
- **Copy:** Argentine voseo, warm, NO em dash (hard rule). The public page is candidate-facing — warm, clear, trustworthy.
</decisions>

<canonical_refs>
- .planning/phases/01-own-data-foundation/01-02-SUMMARY.md — the magic-link RPCs (get_public_offer/accept_offer/decline_offer), token shape, crew ON CONFLICT, status enum ('sent','viewed','accepted','declined','expired').
- .planning/phases/03-create-send-offers/03-01-SUMMARY.md + 03-03-SUMMARY.md — how offers are created; the link is `${SITE_URL}/o/${token}` (raw token in the URL, hashed at rest).
- staff-app app/(app)/staff/[id]/* — the authed profile/offer patterns; the anon supabase client pattern (browser + route) from Phase 2's magic-link / auth code.
- staff-app lib/supabase/* — the anon client for the public route (RLS-safe; these RPCs are the controlled door).
</canonical_refs>

<code_context>
- `/o/[token]` is a NEW public route OUTSIDE the `(app)` auth gate — add `/o` to the middleware public paths (like `/login`, `/auth/callback`).
- Reads/writes go through the anon client calling the 3 SECURITY DEFINER RPCs by token. No membership, no service-role.
- accept/decline = POST (Server Action or Route Handler). GET only renders + calls get_public_offer.
- Likely NO new migration (RPCs exist). If a reason-code refinement is needed, it is a small staff_app migration applied live by the orchestrator session (subagents lack the Supabase MCP tools).
</code_context>

<deferred>
- HITO bridge on accept (BRDG-01/03) → Phase 6.
- Full status board / dashboard → Phase 5 (STAT-01 here is the minimal status reflection on the profile/offer).
- Premium visual reskin → after Phase 5.
</deferred>

---
*Phase: 04-accept-close-loop · 2026-07-16*
