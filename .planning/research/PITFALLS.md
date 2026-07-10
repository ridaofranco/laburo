# Pitfalls Research

**Domain:** Internal event-staffing / hiring tool (invite-by-link) on Supabase, solo-founder, path to marketplace
**Researched:** 2026-07-10
**Confidence:** HIGH (Supabase security, email deliverability, scheduling), MEDIUM (Argentina PDPA specifics — law is stable but a 2025 modernization bill is mid-process), HIGH (adoption/over-scoping — corroborated by Franco's own HITO history)

---

## Critical Pitfalls

### Pitfall 1: Guessable / unexpiring / replayable magic-link tokens

**What goes wrong:**
The acceptance link is *the security boundary* of the whole product — there is no login. If the token is a sequential ID, a short random string, a UUIDv4 used as a secret, or has no expiry / no single-use enforcement, then: (a) someone can enumerate or guess another person's offer, (b) an old accepted link can be replayed to re-accept or flip state, (c) a forwarded link lets a *different* person accept an offer meant for someone specific ("acceptó por vos"). Because acceptance writes `crew_member` + `crew_assignment` into HITO, a bad token directly forges a real hiring record.

**Why it happens:**
Devs reuse the row's primary key or a `gen_random_uuid()` as the "secret," assume UUID = unguessable (it is not a secret-grade token and often leaks in logs/referers), and skip expiry because "it's just internal." SECURITY DEFINER functions make the token the *only* check, so a weak token = full bypass.

**How to avoid:**
- Token = `encode(gen_random_bytes(32), 'hex')` (256-bit), stored **hashed** (sha256) in the DB, never the raw token — compare by hash so a DB leak doesn't hand out live links. HITO's existing `accept_proposal` pattern already does token+SECURITY DEFINER; match or exceed its token strength, don't invent a weaker one.
- Columns on the offer row: `token_hash`, `expires_at` (e.g. 7–14 days), `accepted_at`/`rejected_at`, `status`. The SECURITY DEFINER function must reject if `expires_at < now()`, if already terminal (accepted/rejected/cancelled), and must be **idempotent** (second click on an accepted link shows "ya aceptaste", never re-inserts crew rows).
- Bind identity where you can: the link lands on a page that shows the offer but requires one confirm action; consider a lightweight second factor (last 4 of the phone on file, or DOB) before the state-changing accept — this blunts link-forwarding without adding an account.
- Constant-time / single-query hash lookup; never `SELECT ... WHERE token = $1` with the raw token in a query that lands in logs.

**Warning signs:**
Token visible in the URL is short or looks like `?id=1042`; the accept endpoint is a GET that changes state (crawlers/WhatsApp link-preview bots will "accept" it — see Pitfall 3); accepting twice creates two `crew_assignment` rows; no `expires_at` column exists.

**Phase to address:** Magic-link / token acceptance phase (design the token schema *before* writing the accept function).

---

### Pitfall 2: State-changing link opened by a bot (WhatsApp/email link preview auto-accepts)

**What goes wrong:**
wa.me and email clients fetch the URL to render a preview. If "accept" is a `GET /accept?token=...`, the preview bot, the corporate mail scanner, or an antivirus link-checker silently triggers acceptance/rejection before the human ever taps. Offers show "aceptada" with no human behind it. This is a *very* common failure for exactly the wa.me + email channel this product depends on.

**Why it happens:**
The simplest implementation makes the emailed link do the action directly. Preview/prefetch bots issue GET requests and follow redirects.

**How to avoid:**
The emailed/wa.me link only **displays** the offer (safe idempotent GET). The actual accept/reject is a **POST** from a button the human taps, protected against CSRF. Never mutate state on GET.

**Warning signs:**
Offers flip to accepted seconds after sending, at odd times, or from datacenter IPs; acceptance timestamps cluster right after send.

**Phase to address:** Magic-link / token acceptance phase.

---

### Pitfall 3: Offer email lands in spam — the flow dies silently

**What goes wrong:**
The offer *is* the product. Sending from a shared/reseller host (ferozo) SMTP without aligned SPF, DKIM, and DMARC, or blasting a brand-new sending pattern, drops offers into Promotions/Spam. The worker never sees it, doesn't accept, Franco assumes "no le interesó," and the whole value prop ("todo en un flujo") collapses — but nothing *errors*, so it looks like it works.

**Why it happens:**
SMTP "sends successfully" (250 OK) regardless of inbox placement. SPF/DKIM/DMARC are DNS records nobody thinks about until deliverability is already bad. Reseller hosting IPs are frequently on shared blocklists. Transactional mail from a domain that mostly sends marketing gets filtered.

**How to avoid:**
- Verify DNS **before** first real send: SPF (`v=spf1 include:...`) must authorize the ferozo mail host; DKIM signing enabled and the selector published; DMARC record present (`p=none` to start, monitoring reports). Test with mail-tester.com and Google Postmaster.
- Send from a real, monitored role address on the DER domain (e.g. `no-reply@` with a working reply-to), not a look-alike; consistent From.
- Plain, transactional content — one clear CTA, minimal links/images, no marketing footer — to avoid Promotions bucketing.
- **Belt-and-suspenders:** wa.me is not just a nicety, it is the *deliverability fallback*. Treat WhatsApp as the primary human channel and email as the record/formal copy, given this audience (event workers live on WhatsApp). Show Franco a "copiar mensaje / abrir WhatsApp" path for every offer so a spam-foldered email never kills the deal.
- Track engagement: log `sent` vs `viewed` (the display page load) so a gap between sent-and-never-viewed surfaces a deliverability problem instead of hiding it.
- If free-tier ferozo deliverability proves bad, the zero-budget escape hatch is a free-tier transactional provider (e.g. Resend/Brevo free tiers) on the DER domain — but that's a later decision; don't pre-optimize.

**Warning signs:**
High "enviada" count, near-zero "vista"; test sends land in spam on Gmail/Outlook; mail-tester score < 8/10; no DKIM header on received mail.

**Phase to address:** Offer-sending / email phase — deliverability is a first-class deliverable, not an afterthought. Verify DNS in the very first slice that sends a real email.

---

### Pitfall 4: Building the marketplace before the internal tool is *adopted* (the real HITO failure, repeating)

**What goes wrong:**
The stated risk is demonstrated: HITO grew to ~40 sections and never launched. The identical trap here is building multi-employer registration, billing, moderation, staff accounts/dashboards, MeCubro, real payments — anything in "Out of Scope" — *before* one real hire has gone end-to-end and before Franco actually stops using the Google Sheet. Multi-tenant-from-day-1 (a good call) quietly becomes an excuse to build tenant management, invites, roles, and org onboarding UI that no second tenant needs yet.

**Why it happens:**
The marketplace is the exciting vision; the internal tool feels "too small." Solo founders build for the imagined future user instead of the one real user (Franco). "Prepare the architecture" slides into "build the architecture."

**How to avoid:**
- Hard definition of done for v1 = the doc's own criterion: **one real, complete hire + Franco's next search is run 100% in the app, not the Sheet.** Everything not on that critical path is deferred, on pain of repeating HITO.
- Multi-tenant = **data shape only** (every row carries `organization_id`, all queries filter by it). It does **not** mean org-management UI, self-serve tenant signup, or per-tenant billing in v1. Hardcode SOMOS DER's org id; that's fine.
- Ruthlessly protect the "Out of Scope" list in PROJECT.md — treat additions to it as regressions.
- Ship the thinnest vertical slice (search one role → send one offer → accept → crew row) end-to-end early, before breadth.

**Warning signs:**
You're writing an "invite another employer" or "org settings" screen; there's a `roles`/`permissions` UI before there's a working accept; you can't name the last real offer sent; the Sheet is still open in Franco's browser.

**Phase to address:** Roadmap-level — enforce via phase ordering (vertical slice first) and an explicit anti-scope gate at every phase transition. This is the single highest-probability killer of the project.

---

### Pitfall 5: Nobody migrates off the spreadsheet (adoption, not features)

**What goes wrong:**
Even a working app fails if Franco keeps reaching for the Sheet + manual WhatsApp because it's faster *for him* on a given day. Internal tools die when the new path is even slightly more friction than the old habit at the moment of need. 146 postulantes already live comfortably in a Sheet.

**Why it happens:**
The app optimizes the *happy path* Franco imagined, not the *actual* messy workflow (a rushed search from his phone the night before an event). Missing data (the Sheet has notes the DB doesn't), slower search, or one broken step sends him back to the familiar tool.

**How to avoid:**
- Mobile-first for **Franco's** operator flow, not just the worker's accept page — the search+offer must be faster from a phone than opening the Sheet.
- Make the app strictly better on day one at the one thing he does most: "find people for role X who are available on date Y and message them." If that's not faster than the Sheet, nothing else matters.
- Preserve the escape valves he relies on (wa.me with pre-filled message = his existing WhatsApp habit, upgraded, not replaced).
- Measure adoption explicitly: the success metric is behavioral (Sheet abandoned), so instrument "offers sent this week in-app."

**Warning signs:**
Franco describes a real search and the app can't do it in a couple taps; he asks "can I just export to the Sheet"; low weekly in-app offer count despite active events.

**Phase to address:** Search + offer phase (operator UX) and every phase's success criterion should be behavioral, not feature-complete.

---

### Pitfall 6: SECURITY DEFINER function = anon superuser (RLS bypass by design)

**What goes wrong:**
The whole public surface (offer display, accept, and the existing web form's `register_web_lead`) runs through SECURITY DEFINER functions callable by `anon`. A SECURITY DEFINER function *bypasses RLS* and runs with the definer's privileges. If it's over-broad (selects/updates more than the single token's row), has a mutable `search_path` (injection via a malicious schema), or is created in an API-exposed schema, an unauthenticated caller gets far more than intended — potentially read/write across all orgs' staff and crew data.

**Why it happens:**
Devs reach for SECURITY DEFINER to "make it work with RLS," then write the function like normal code — no per-row scoping, no `search_path` pin, parameters trusted, returning whole tables. Supabase's own advisor flags mutable-search-path functions precisely because this is common.

**How to avoid:**
- Every SECURITY DEFINER function: `SET search_path = ''` (or `= pg_catalog, public` explicitly, schema-qualify everything) to kill search-path injection. Supabase Security Advisor will flag `function_search_path_mutable` — treat it as a blocker.
- **Least privilege inside the function:** it must resolve exactly one row by token hash and touch only that row's offer + the specific crew rows it creates. Never `SELECT *` a table or return sets. Validate/whitelist every input.
- Keep these functions **out of exposed schemas**; grant `EXECUTE` only to the roles that need it; do not leave the default `EXECUTE` to `public` on internal helpers.
- Reuse HITO's proven trio (`register_web_lead`, `get_public_proposal`, `accept_proposal`) as the *template* and audit them for these same properties before copying — inherited bugs propagate.
- Run `get_advisors` (security lint) after every migration and fix all findings.

**Warning signs:**
Supabase advisor shows security-definer views or mutable-search-path functions; a public function returns more than one row or a whole table; `anon` can `EXECUTE` a function that updates by a client-supplied id (not a hashed token); RLS is "enabled" but a definer function is the actual gate and it's loose.

**Phase to address:** Every phase that adds a public (token) function; establish the hardened-function template in the magic-link phase and lint on every migration.

---

### Pitfall 7: `anon`-key public insert on `staff_profiles` is an open write endpoint (spam/abuse)

**What goes wrong:**
The live "Trabajá con nosotros" form inserts into `staff_profiles` with the anon key. That is a public, unauthenticated write to a production table feeding hiring decisions. Without constraints it's a spam/garbage/PII-poisoning vector: bots flood fake profiles, oversized payloads, or malicious CV uploads to the `staff-cvs` bucket. The anon key is *published in the web client* — it's not a secret.

**Why it happens:**
"It's just the public form" — but anon insert + permissive RLS INSERT policy = anyone with the (public) key can write arbitrary rows via the REST API, not just via your form.

**How to avoid:**
- Prefer routing the public insert through a **SECURITY DEFINER RPC** (like `register_web_lead`) with server-side validation, rather than a raw table INSERT policy for `anon` — it gives you a choke point for validation, rate limits, and defaults (like stamping `organization_id`).
- If keeping direct insert: a tight RLS `INSERT` policy with `WITH CHECK` constraints (required fields, enum whitelists for oficio/país, length limits), column-level grants (anon can insert only specific columns, never `organization_id`/status/internal flags), and DB constraints.
- Storage bucket `staff-cvs`: restrict upload MIME types and size, keep it private (it already is), generate signed URLs for reads — never public. Scan/limit file size to prevent bucket abuse.
- Add basic anti-abuse (honeypot field, hCaptcha/Turnstile free tier, or a per-IP rate limit at the edge) since the endpoint is internet-facing.

**Warning signs:**
Sudden new-profile spikes, duplicate/nonsense entries, CVs that aren't PDFs/DOCs, oversized uploads; the RLS INSERT policy is `WITH CHECK (true)`; anon can set `organization_id` or status columns.

**Phase to address:** Data-migration / RLS-hardening phase (the same phase that adds `org_id` should harden this endpoint).

---

### Pitfall 8: Adding `org_id` to a live table with an active public form (migration outage / silent data loss)

**What goes wrong:**
`staff_profiles` is standalone (no `organization_id`) *and* receiving live inserts from the production web form. A naive migration — add NOT NULL `organization_id` without a default, or backfill in one big lock — can (a) break the live form the instant the column is NOT NULL and the form doesn't supply it (every applicant lost during the window), (b) long-lock the table, (c) leave existing 146 rows with NULL org and thus invisible/orphaned once RLS filters by org, or (d) attach existing rows to the *wrong* org given the un-consolidated accounts (the real SOMOS DER org lives under the partner's account).

**Why it happens:**
Schema change treated as a static-DB operation. NOT NULL + no default + concurrent writer = immediate insert failures. Backfill and constraint added in the wrong order. And crucially: **which org?** is ambiguous while accounts/orgs aren't consolidated.

**How to avoid:**
- **Resolve org consolidation first (or at least fix the target org id).** Don't backfill 146 real applicants into an org that will move. This is a prerequisite, not a migration detail.
- Expand-migrate-contract, online-safe order: (1) add `organization_id` **nullable** with a sensible default = SOMOS DER's org id; (2) update the web form / its RPC to stamp org on new inserts; (3) backfill existing rows in batches to the correct org; (4) *then* add NOT NULL + FK + the RLS org filter. Never step 4 before steps 1–3.
- Do it in a migration file (versioned), test on a branch/copy, take a snapshot/backup before backfill, and verify counts before/after (146 in, 146 out, zero NULL org).
- Confirm the live form keeps working *throughout* — deploy the form change and the column in a compatible order (add nullable column before the form starts sending it, or have the RPC default it).
- Watch RLS interaction: the moment org filtering turns on, any row with NULL/wrong org **disappears** from the app. Verify all 146 are visible to Franco's org after cutover.

**Warning signs:**
Migration plan says `ADD COLUMN organization_id uuid NOT NULL` in one step; no backup before backfill; applicant count drops after cutover; the web form 500s post-migration; rows with NULL `organization_id` after backfill.

**Phase to address:** Dedicated data-migration phase, gated behind account/org consolidation. This is high-blast-radius on *production* data feeding the whole product.

---

### Pitfall 9: Scheduling modeled naively — double-booking, timezone, multi-day events

**What goes wrong:**
Event staffing is fundamentally an availability/allocation problem, and the classic mistakes bite hard: (a) **double-booking** — offering/assigning the same person to two overlapping events because "available" is a static flag, not a check against existing `crew_assignment`s for that date; (b) **timezone** — storing event times without tz (or in server/browser local time), so a 22:00 call-time shifts by hours; (c) **multi-day / overnight events** — modeling a shift as a single date instead of a start/end interval, so an event that runs 23:00–05:00 or across a weekend is mis-represented, and availability checks miss overlaps that cross midnight.

**Why it happens:**
"Available" gets modeled as a boolean on the profile instead of a function of a time range vs. existing commitments. Dates stored as `date` or naive `timestamp` (no `timestamptz`). Argentina is single-tz (UTC-3, no DST currently) so timezone bugs stay *hidden* until a marketplace/traveling gig crosses tz — then they surface as data corruption.

**How to avoid:**
- Store times as `timestamptz`; store events as `starts_at`/`ends_at` intervals, not a single date. Support multi-day via interval, and handle overnight (end < start-of-day) explicitly.
- Availability = **derived**, not a flag: "is person P free for [starts_at, ends_at)?" = no overlapping `crew_assignment` for P. Use interval overlap logic (`tstzrange && tstzrange`); a Postgres exclusion constraint (`EXCLUDE USING gist` on person + tstzrange) can make double-booking *impossible at the DB level* — strongly recommended.
- Even in v1 (Argentina-only, monetary informativo), don't skip `timestamptz` — the marketplace vision explicitly spans multi-country (the form is already multi-país). Getting tz right now is cheap; retrofitting later is a data migration.
- Surface conflicts in the operator UI at offer time: "P ya está asignada al evento X ese día."

**Warning signs:**
Availability is a boolean column; event has a single `date` not start/end; times stored as `timestamp` (no tz) or as strings; two assignments for one person overlap and nothing complains; overnight events show the wrong day.

**Phase to address:** Data model / offer-creation phase — decide the time+availability model before the offer schema is written; it's expensive to change after real assignments exist.

---

### Pitfall 10: PII / CV handling under Argentine data-protection law (Ley 25.326 / habeas data)

**What goes wrong:**
The product holds real applicants' PII and CVs (name, contact, docs, possibly DNI, photos). Argentina's Ley 25.326 (habeas data, constitutional Art. 43) plus AAIP regulations require lawful basis/consent, purpose limitation, security measures, and honoring access/rectification/deletion rights. Common failures: no consent/privacy notice at collection, indefinite retention, sensitive data collected without need (health, union, etc.), CVs exposed via public/guessable storage URLs, and no deletion path. A marketplace (sharing candidate data with third-party employers) is a **data transfer** that needs its own legal basis — building toward it without a consent model bakes in a liability.

**Why it happens:**
Solo founders treat compliance as "later." The web form already collects and stores CVs in production; the legal obligations attach *now*, not at marketplace launch. Sensitive-data categories (Art. 7) carry stricter rules and are easy to collect accidentally (e.g. a photo, health note, or union membership in a CV).

**How to avoid:**
- **Consent + privacy notice at the form** (the collection point): state who the controller is (SOMOS DER — pin the right legal entity once orgs are consolidated), the purpose (contratación de staff eventual), and rights (acceso, rectificación, supresión) with a contact. This likely already needs a fix on the existing form.
- **Purpose limitation is the marketplace blocker:** consent for "SOMOS DER internal hiring" ≠ consent to expose the profile to third-party employers. If v2 shares data, get *separate, explicit* consent then. Design the data model so third-party visibility is opt-in per candidate.
- **Security measures (Art. 9):** RLS everywhere, private `staff-cvs` bucket with **signed, expiring URLs** only (never public links — a leaked CV URL is a reportable breach), least-privilege, encrypted at rest (Supabase does this).
- **Retention + deletion:** provide a way to delete/anonymize an applicant on request (habeas data supresión). Don't keep CVs forever.
- **Data location:** cross-border transfer rules exist; Supabase region matters for the marketplace phase — note it, don't solve it in v1.
- Right-size it: v1 is internal, one controller — the load is a privacy notice + consent + signed URLs + a delete path. The heavy lifting (registro de bases ante AAIP, transfer agreements) is a marketplace-phase concern. A 2025 modernization bill (GDPR-aligned) is in Congress but not yet law — build to current 25.326 and don't get caught flat-footed by tighter consent rules.

**Warning signs:**
Form collects CVs with no privacy/consent text; `staff-cvs` served via public URLs; no way to delete an applicant; plans to show profiles to outside employers reuse the original internal consent; sensitive fields (health, DNI photos) collected without need.

**Phase to address:** Data-migration/RLS phase for storage + consent notice; flag marketplace-consent as a v2 gate. The signed-URL + private-bucket check belongs in any phase that displays a CV.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode SOMOS DER `organization_id` | Skip org-management UI | Must find every hardcode before 2nd tenant | **Yes, in v1** — as long as the *column* exists everywhere and queries filter by it |
| Store raw token instead of hash | Simpler function | DB leak = live acceptance links for everyone | **Never** — hashing is trivial |
| Direct anon INSERT on `staff_profiles` (no RPC) | Less code on the form | Open write endpoint, no validation choke point | Only with strict `WITH CHECK` + column grants + rate limit; prefer RPC |
| Availability as a boolean flag | Fast to build | Double-booking, no history, full rework once assignments exist | **Never** for the core — derive from assignments |
| `timestamp` without tz / single event date | Feels fine (Argentina is one tz) | Silent corruption once multi-country/marketplace; painful migration | **Never** — `timestamptz` + interval is the same effort |
| Skip DKIM/DMARC ("it sends") | Ship faster | Offers silently spam-foldered; product looks broken | **Never** — deliverability is the product |
| GET endpoint that accepts the offer | One less form | Preview bots auto-accept | **Never** — POST for state change |
| No `expires_at` on tokens | One less column | Old links live forever, replayable | **Never** |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ferozo / reseller SMTP | Assume 250 OK = delivered; no SPF/DKIM/DMARC | Align DNS auth, test with mail-tester, monitor sent-vs-viewed, treat wa.me as human-primary fallback |
| wa.me deep link | Rely on it as *the* channel but format message badly / no pre-fill | Pre-filled URL-encoded message; use as reliable human channel alongside (spam-prone) email |
| WhatsApp/email link previews | State-changing GET links get auto-triggered by preview bots | Display-only GET, POST to mutate |
| Supabase Storage `staff-cvs` | Public URLs / no MIME+size limits | Private bucket, signed expiring URLs, restrict upload type/size |
| Supabase RLS + SECURITY DEFINER | Definer function as loose bypass; mutable search_path | `SET search_path=''`, per-row scoping, out of exposed schemas, lint with `get_advisors` |
| HITO `crew_member`/`crew_assignment` write | App invents parallel crew tables or writes wrong-shaped rows | Write into HITO's real tables via the existing multi-tenant pattern; match its FKs/org model |
| Two Google accounts / orgs | Backfill data into an org that then moves | Consolidate (or fix target org id) *before* migrating `staff_profiles` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Availability check scans all assignments per candidate | Slow search as events grow | Interval index (gist on tstzrange) + exclusion constraint | Hundreds of assignments — but correctness matters from row 1 |
| Full-table load of `staff_profiles` in search UI | Sluggish on phone; grows with applicants | Server-side filter by role/oficio + date; paginate | A few hundred profiles on mobile |
| Sending offers synchronously in the request | Slow/blocking send, timeouts on flaky SMTP | Send is fine at v1 volume; just don't block the UI on SMTP round-trip | Low volume — not a near-term risk |

*(This is a low-scale internal tool in v1 — do not over-engineer for scale. The only "performance" issue that's really a *correctness* issue is the availability/overlap check; treat that one seriously, ignore the rest until real.)*

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Weak/unexpiring/replayable token | Forged hires, someone accepts on your behalf | 256-bit hashed token, expiry, single-use, idempotent accept |
| SECURITY DEFINER over-broad / mutable search_path | Anon caller reads/writes across all orgs | Per-row scope, `SET search_path=''`, out of exposed schemas, advisor lint |
| Anon INSERT with `WITH CHECK (true)` | Spam/PII poisoning of hiring DB via public key | RPC choke point or tight `WITH CHECK` + column grants + captcha/rate limit |
| Public/guessable CV URLs | Data breach of applicants' CVs (habeas data violation) | Private bucket, signed expiring URLs only |
| State change on GET | Preview bots auto-accept/reject | POST + CSRF protection |
| Trusting anon key as secret | Anyone can hit the REST API directly | RLS is the real boundary; anon key is public by design |
| Backfilling org into wrong entity | Real applicant data under the wrong controller (legal + access) | Consolidate orgs first; verify target org id |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Operator flow not truly faster than the Sheet | Franco reverts; project dies | Make "find by role+date → offer" 2-tap on mobile, faster than opening the Sheet |
| Worker must create an account | Event workers bounce | Magic link, no account (already the plan — protect it) |
| Offer email in spam, no fallback | Worker never sees offer; looks like disinterest | wa.me one-tap fallback for every offer; track viewed |
| No clear offer status | Franco doesn't know who saw/accepted | Explicit enviada/vista/aceptada/rechazada/vencida states (already in requirements) |
| Accept page not mobile-first | Worker on phone struggles to accept | Mobile-first accept page, big confirm button, works with no login |
| Silent expiry | Worker taps an expired link, dead end | Expired link shows a clear "esta oferta venció, contactá a…" with the wa.me path |

## "Looks Done But Isn't" Checklist

- [ ] **Magic link:** works in the happy path — but verify token is hashed-at-rest, has expiry, is single-use/idempotent, accept is POST-not-GET, and a *forwarded* link can't accept for someone else.
- [ ] **Offer email:** it "sends" — but verify SPF+DKIM+DMARC pass, mail-tester ≥ 8, it lands in Gmail *inbox* (not Promotions/Spam), and there's a wa.me fallback.
- [ ] **Accept → crew:** creates a `crew_assignment` — but verify double-accept doesn't create two, and it writes into HITO's real tables with the correct `organization_id` and event FK.
- [ ] **`staff_profiles` migration:** column added — but verify all 146 rows are visible to Franco's org, the live web form still inserts successfully, zero NULL `organization_id`, and it's the *right* org.
- [ ] **CV display:** CV opens — but verify it's a signed expiring URL from a private bucket, not a public/guessable link.
- [ ] **SECURITY DEFINER functions:** they work — but `get_advisors` shows zero security findings (no mutable search_path, not in exposed schema, anon can't call anything over-broad).
- [ ] **Availability:** search returns people — but verify it excludes those already assigned to an overlapping event (including overnight/multi-day), not just a stale boolean.
- [ ] **Consent:** form collects CVs — but verify a privacy/consent notice exists and there's a way to delete an applicant on request.
- [ ] **Multi-tenant:** looks org-scoped — but verify *every* new table has `organization_id` + RLS filtering by it, not just some.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Weak tokens already issued | MEDIUM | Rotate: invalidate all outstanding tokens, add hash+expiry columns, reissue links; audit any accepts made in the weak window |
| Email in spam discovered late | LOW–MEDIUM | Fix SPF/DKIM/DMARC, warm sending, lean on wa.me meanwhile; re-send affected offers via WhatsApp |
| org backfilled to wrong entity | HIGH | Requires careful `UPDATE` remap after consolidation; risk of orphaning rows / breaking FKs — why consolidation must come first |
| Double-booking shipped | MEDIUM | Add exclusion constraint (will reject on existing conflicts — must clean data first), then fix UI check; reconcile any double-booked assignments manually |
| SECURITY DEFINER hole | MEDIUM | Tighten function, pin search_path, revoke anon EXECUTE, rerun advisor; assume exposure — check logs for abuse |
| Marketplace built too early | HIGH (time already sunk) | Feature-flag it off (HITO already uses `SHOW_*` flags), refocus on the one-real-hire criterion — but the cost is the wasted build, exactly the HITO mistake |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Over-scoping / marketplace-too-early | Roadmap ordering + every phase-transition gate | v1 done = 1 real hire + Sheet abandoned; nothing off the critical path shipped |
| Adoption / Sheet not abandoned | Search + offer (operator UX) phase | Weekly in-app offers > 0; Franco runs next real search in-app |
| Org consolidation before migration | Prerequisite (Phase 0) before data-migration phase | Target `organization_id` fixed and owned by the right account |
| `org_id` migration on live table | Data-migration phase | 146 rows visible to org, form still inserts, zero NULL org, backup taken |
| Anon-insert abuse on `staff_profiles` | Data-migration / RLS-hardening phase | RPC or tight `WITH CHECK`; captcha/rate limit; column grants |
| Magic-link token security | Magic-link / acceptance phase | Hashed, expiring, single-use, POST-to-accept, forward-resistant |
| Preview-bot auto-accept | Magic-link / acceptance phase | Accept is POST; no state change on GET |
| SECURITY DEFINER hardening | Every public-function phase (template set early) | `get_advisors` clean after each migration |
| Email deliverability | Offer-sending / email phase | SPF/DKIM/DMARC pass; inbox placement; wa.me fallback; sent-vs-viewed tracked |
| Availability / scheduling model | Data model / offer-creation phase | `timestamptz` intervals; overlap check / exclusion constraint; overnight handled |
| PII / CV / habeas data | Storage phase (signed URLs) + consent at form; marketplace-consent v2 gate | Private bucket + signed URLs; consent notice; delete path |

## Sources

- Supabase Docs — Row Level Security; Database Advisors (`function_search_path_mutable`, security-definer flags): https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/database/database-advisors (HIGH)
- Supabase Troubleshooting — "Do I need to expose security definer functions in RLS policies?": https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw (HIGH)
- Supabase community — SECURITY DEFINER / RLS bypass discussions #3563, #26988: https://github.com/orgs/supabase/discussions/3563 (MEDIUM)
- AuditYour.App — Securing Supabase RPC Functions: https://www.audityour.app/guides/supabase-rpc-security-guide (MEDIUM)
- Ley 25.326 Protección de Datos Personales / Habeas Data (Infoleg texto actualizado): https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm ; Argentina.gob.ar resumen: https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790 (HIGH for law text; MEDIUM on 2025 reform status — bill in process, not enacted)
- Constitución Nacional Art. 43 (habeas data) — referenced via AAIP framework (HIGH)
- Email auth (SPF/DKIM/DMARC) deliverability — general transactional-email best practice; verify per ferozo DNS (MEDIUM, standard practice)
- Postgres interval / `tstzrange` exclusion constraints for no-double-booking — Postgres docs standard pattern (HIGH)
- Franco/HITO history (~40 sections, never launched; `SHOW_*` flags) — PROJECT.md (HIGH, primary)

---
*Pitfalls research for: internal event-staffing tool on Supabase, path to marketplace*
*Researched: 2026-07-10*
