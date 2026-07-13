# Architecture Research

**Domain:** Event-staffing app (greenfield app over brownfield Supabase/HITO data)
**Researched:** 2026-07-10
**Confidence:** HIGH (repo patterns read directly from `/Users/fridao/Proyectos/HITO-by-DER-main`; accept-flow RPC read from migration `00008_proposal_acceptance.sql`. MEDIUM only on the exact `staff_profiles` column list, taken from PROJECT.md not a live query.)

---

## THE VERDICT: Standalone app, shared Supabase

**Build a new standalone app (own repo, own Vercel project) that talks to the existing HITO Supabase as the single source of truth. Copy — do not import — HITO's proven patterns (Supabase SSR auth, org gate, crew writes, token-accept RPC, mailer).**

The data layer is shared no matter what you decide — PROJECT.md makes `staff_profiles` / `crew_members` / `crew_assignments` / `events` non-negotiable as the source of truth. So the only real question is where the *app* layer lives. The evidence points to standalone.

### Tradeoff analysis (evidence-based)

| Dimension | Module (inside HITO repo) | Standalone (new repo) | Winner |
|-----------|---------------------------|-----------------------|--------|
| **Auth reuse** | Free: `app/[orgSlug]/layout.tsx` already does `getUser → /login`, org-by-slug, `members` check, org switcher | Must rebuild — but it's ~3-4 copyable files (`lib/supabase/{server,client,middleware,admin}.ts`) + one login page + one gate. ~1-2 days, mostly paste | Module (marginal) |
| **Multi-tenant reuse** | Free: `organization_id`, `is_org_member`/`is_org_writer`, `getOrgId(slug)` pattern in `crew/actions.ts` | Same DB helpers work verbatim from any app; only `getOrgId` helper to copy | Tie (helpers live in DB) |
| **Deploy independence** | Coupled: every staff-app deploy ships the whole 45-section untested app; a bug anywhere blocks the staff hotfix | Own Vercel project, own release cadence, own env | **Standalone** |
| **Coupling to an unlaunched product** | High: HITO is unlaunched and owner considers it over-scoped. Bolting the one must-ship feature into it risks inheriting "never launched" | Zero: staff app ships on its own even if HITO pivots or dies | **Standalone** |
| **Franco iterate/launch fast** | Must reason about a 45-section, i18n-routed, Capacitor-wrapped codebase to change one flow | Tiny surface he understands end-to-end; the actual v1 success metric is "1 real hire + leaves the Sheet" → shipping speed dominates | **Standalone** |
| **Future marketplace** | Would live as a section inside a productivity suite | Own product identity in the "by DER" family; marketplace = its own front door | **Standalone** |
| **Scaffolding cost** | ~0 | ~2-3 days of copy-paste boilerplate | Module |
| **Data integrity / no parallel tables** | Natural (code sits next to crew tables) | Enforced by writing to the same Supabase; RPCs live in DB, shared regardless | Tie |

### Why standalone wins

The dominant risk in this project is **"Franco never launches"** — and that risk is *already evidenced*: HITO is over-scoped and unlaunched. Putting his one must-ship feature inside the product he never shipped is the single biggest threat to actually shipping. The counter-argument (save 2-3 days of boilerplate) is real but small, and that boilerplate is copy-paste from HITO, not net-new design. Deploy independence, launch speed, and decoupling from an unlaunched product outweigh it.

**Note on the "module is cheaper" objection:** HITO *does* already have a wedge mechanism to run narrow — `WEDGE_MODE`/`WEDGE_PATHS` in `lib/events/modules.ts` (currently `false`) and per-section `SHOW_*` flags. So a module *could* hide the other 40 sections. But that hides scope, it doesn't remove the coupling — the code, deploy, and risk still ride together. It doesn't change the verdict.

**Conditions under which module would win instead:** if Franco decides to actually launch HITO as the primary product and staff becomes one section of a suite he's committing to, OR if the 2-3 day scaffolding cost is genuinely unaffordable this sprint. Neither holds today.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       STAFF-APP (new Vercel project)                   │
│                      Next.js 15 · React 19 · Motion                    │
├──────────────────────────────────────────────────────────────────────┤
│  AUTHENTICATED (Franco)              PUBLIC / NO-AUTH (staff worker)    │
│  ┌────────────────────────┐         ┌────────────────────────────┐     │
│  │  Dashboard             │         │  Accept page  /o/[token]   │     │
│  │  - staff search/filter │         │  - view offer (RPC read)   │     │
│  │  - profile + CV view   │         │  - accept / reject         │     │
│  │  - create/send offer   │         │  mobile-first, no account  │     │
│  │  - offer status board  │         └───────────┬────────────────┘     │
│  └───────────┬────────────┘                     │                      │
│    server actions │  (auth+org gate)     get_public_offer / accept_offer│
│              │    │                              │ (anon-safe RPC)      │
│   ┌──────────▼────▼──────┐   ┌────────────┐      │                      │
│   │ Email sender (SMTP)  │   │ wa.me link │      │                      │
│   │  copy of mailer.ts   │   │ builder    │      │                      │
│   └──────────────────────┘   └────────────┘      │                      │
└───────────────────────────────┬──────────────────┴──────────────────---┘
                                 │  @supabase/ssr (anon key) + RLS
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SUPABASE HITO  (luillpzfqzbpoqkgvjuw) — SHARED             │
├──────────────────────────────────────────────────────────────────────┤
│  TABLES                         RPC (SECURITY DEFINER, token-gated)    │
│  staff_profiles (talent pool)   get_public_offer(token)   ← read       │
│  offers (NEW, org-scoped)       accept_offer(token, ...)  ← atomic     │
│  crew_members (org)             register_staff_application(...) (opt)   │
│  crew_assignments (org+event)                                          │
│  events (org)                   HELPERS: is_org_member / is_org_writer  │
│  organizations / members        STORAGE: staff-cvs (private, signed)   │
└──────────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ anon INSERT (unchanged — live!)
                    ┌────────────┴─────────────┐
                    │  somosder-web            │
                    │  StaffRegistro.astro     │
                    │  /trabaja-con-nosotros   │
                    └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Dashboard** (authed) | Franco searches/filters `staff_profiles`, views profile + CV, creates & sends offers, watches status board | Next.js server components + server actions; Supabase SSR (anon key + RLS); org gate copied from HITO `[orgSlug]/layout.tsx` |
| **Public accept pages** | Staff views one offer and accepts/rejects with no account | `/o/[token]` route (top-level, NOT behind auth); reads via `get_public_offer`, writes via `accept_offer` |
| **API / RPC layer** | All anon-facing reads/writes; the atomic hire | Postgres SECURITY DEFINER functions in shared Supabase (`get_public_offer`, `accept_offer`), granted to `anon, authenticated`, `search_path` locked. Authed writes = Next server actions |
| **Email sender** | Send offer email with magic link | Copy of HITO `lib/email/mailer.ts` cascade (Resend → SMTP/ferozo → none, returns honest `MailResult`) |
| **wa.me builder** | One-tap WhatsApp with pre-filled message + link | Client-side `https://wa.me/<phone>?text=...` — no Meta API, no cost |
| **Storage access** | Show the applicant's CV to Franco only | `staff-cvs` private bucket via `createSignedUrl` (server-side, short TTL). Never exposed on public accept pages |

---

## Recommended Project Structure

```
staff-app/
├── app/
│   ├── [orgSlug]/                 # authenticated dashboard (org-gated)
│   │   ├── layout.tsx             # AUTH GATE — copy from HITO
│   │   ├── page.tsx               # staff search + filter (staff_profiles)
│   │   ├── staff/[id]/page.tsx    # profile + CV (signed URL)
│   │   └── ofertas/
│   │       ├── page.tsx           # offer status board
│   │       ├── actions.ts         # createOffer, sendOffer (server actions)
│   │       └── nueva/page.tsx     # create-offer form
│   ├── o/[token]/                 # PUBLIC accept page (no auth)
│   │   ├── page.tsx               # get_public_offer(token)
│   │   └── AcceptOffer.tsx        # accept_offer(token, ...) — clone of AcceptProposal
│   ├── login/page.tsx             # copy from HITO
│   └── auth/callback/route.ts     # copy from HITO
├── lib/
│   ├── supabase/                  # server.ts client.ts middleware.ts admin.ts — COPY
│   ├── email/mailer.ts            # COPY from HITO
│   ├── org.ts                     # getOrgId(slug) helper — COPY pattern
│   └── wa.ts                      # wa.me link builder
├── middleware.ts                  # session refresh (strip HITO i18n complexity)
└── supabase/migrations/           # NEW migrations against shared project
    ├── 0001_staff_profiles_org.sql
    ├── 0002_offers.sql
    └── 0003_offer_rpcs.sql
```

### Structure Rationale

- **`app/[orgSlug]/`:** keep HITO's org-slug convention so the same Supabase org/`members`/RLS model works verbatim and marketplace-opening is config, not rewrite.
- **`app/o/[token]/` at top level:** matches HITO's public-route convention (`p/[token]`, `invite/[token]`, `checkin/[token]` all live *outside* `[orgSlug]` = no auth). Critical: the accept page must never hit the auth gate.
- **`supabase/migrations/`:** the app owns new migrations but they run against the *shared* project — no second database (PROJECT.md constraint).

---

## Data Model Plan

### 1. Migrate `staff_profiles` to multi-tenant WITHOUT breaking the live web form

The web form does a **public anon INSERT** today (live, 146 rows). Do NOT make `organization_id` `NOT NULL` — that breaks the form instantly. Non-breaking path:

```sql
-- 0001_staff_profiles_org.sql
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Backfill existing 146 applicants to the SOMOS DER org
UPDATE staff_profiles SET organization_id = '<SOMOS_DER_ORG_ID>'
  WHERE organization_id IS NULL;

-- Stamp new anon inserts automatically → web form needs ZERO changes
CREATE OR REPLACE FUNCTION set_staff_default_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := '<SOMOS_DER_ORG_ID>';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_staff_default_org BEFORE INSERT ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION set_staff_default_org();

-- RLS: keep the existing anon INSERT policy untouched.
-- Add a dashboard SELECT policy so only org members read profiles.
CREATE POLICY staff_select_org ON staff_profiles
  FOR SELECT USING (is_org_member(organization_id));
```

**Design note (marketplace-ready):** treat `staff_profiles` as a **global talent pool**; `organization_id` is the *sourcing / origin* org (who the applicant came in through), not exclusive ownership. In v1 with one org this is invisible. For v2 marketplace, relax the SELECT policy to a shared-pool view — the offers stay org-scoped, so no rewrite. This honors the "multi-tenant day 1" decision while keeping the door open.

### 2. New table: `offers` (ofertas)

```sql
-- 0002_offers.sql
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role text NOT NULL,
  start_date date, end_date date, days integer NOT NULL DEFAULT 1,
  amount numeric(18,2),                 -- informational only in v1
  conditions text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'sent'   -- sent|viewed|accepted|rejected|expired
    CHECK (status IN ('sent','viewed','accepted','rejected','expired')),
  expires_at timestamptz,
  sent_at timestamptz DEFAULT now(),
  viewed_at timestamptz, responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_select ON offers FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY offers_write  ON offers FOR ALL    USING (is_org_writer(organization_id))
                                                 WITH CHECK (is_org_writer(organization_id));
-- anon NEVER touches this table directly — only via SECURITY DEFINER RPC below.
```

### 3. Atomic accept: `crew_member` + `crew_assignment` in ONE SECURITY DEFINER RPC

Clone of the proven `accept_proposal` pattern (migration `00008`). A plpgsql function is a single transaction → atomic by construction.

```sql
-- 0003_offer_rpcs.sql
CREATE OR REPLACE FUNCTION get_public_offer(p_token text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'role', o.role, 'start_date', o.start_date, 'end_date', o.end_date,
    'days', o.days, 'amount', o.amount, 'conditions', o.conditions,
    'status', o.status, 'expires_at', o.expires_at,
    'event', jsonb_build_object('title', e.title, 'start_date', e.start_date),
    'organization', jsonb_build_object('name', org.name, 'logo_url', org.logo_url),
    'staff_name', sp.full_name          -- greet by name; NO other PII, NO other CVs
  )
  FROM offers o
  JOIN events e ON e.id = o.event_id
  JOIN organizations org ON org.id = o.organization_id
  JOIN staff_profiles sp ON sp.id = o.staff_profile_id
  WHERE o.token = p_token;
$$;
GRANT EXECUTE ON FUNCTION get_public_offer(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION accept_offer(p_token text, p_user_agent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_o offers%ROWTYPE; v_sp staff_profiles%ROWTYPE; v_crew_id uuid;
BEGIN
  SELECT * INTO v_o FROM offers
    WHERE token = p_token AND status IN ('sent','viewed')
      AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); END IF;

  SELECT * INTO v_sp FROM staff_profiles WHERE id = v_o.staff_profile_id;

  -- Reuse crew_member if this person is already crew for this org; else create.
  SELECT id INTO v_crew_id FROM crew_members
    WHERE organization_id = v_o.organization_id AND staff_profile_id = v_o.staff_profile_id;
  IF v_crew_id IS NULL THEN
    INSERT INTO crew_members (organization_id, name, role, phone, staff_profile_id)
    VALUES (v_o.organization_id, v_sp.full_name, v_o.role, v_sp.phone, v_sp.id)
    RETURNING id INTO v_crew_id;
  END IF;

  -- Assign to the event (idempotent on the unique (crew_member_id,event_id)).
  INSERT INTO crew_assignments (crew_member_id, event_id, organization_id, days, amount)
  VALUES (v_crew_id, v_o.event_id, v_o.organization_id, v_o.days, v_o.amount)
  ON CONFLICT (crew_member_id, event_id) DO NOTHING;

  UPDATE offers SET status = 'accepted', responded_at = now() WHERE id = v_o.id;
  RETURN jsonb_build_object('ok', true, 'crew_member_id', v_crew_id);
END; $$;
GRANT EXECUTE ON FUNCTION accept_offer(text, text) TO anon, authenticated;
```

Requires two small adds to `crew_members`: `staff_profile_id uuid REFERENCES staff_profiles(id)` (link back to the pool) and a unique constraint on `crew_assignments (crew_member_id, event_id)` (the code in `crew/actions.ts` already handles error `23505`, so the constraint likely exists — verify).

---

## Data Flow: magic-link accept, end to end

```
1. Franco (dashboard)  ─ search staff_profiles (RLS: is_org_member) ─▶ pick candidate
2. Create offer  ─ server action (authed, is_org_writer) ─▶ INSERT offers
                   (token auto, status='sent', expires_at, event/role/dates/amount)
3. Send  ─ mailer.ts (SMTP) ─▶ email w/ https://staff-app/o/<token>
          ─ wa.me builder ─▶ one-tap WhatsApp w/ pre-filled text + same link
4. Staff opens /o/<token>  (anon, no account)
          ─ get_public_offer(token) [SECURITY DEFINER] ─▶ offer + event + org brand
          ─ (optional) status 'sent'→'viewed', viewed_at=now()
5. Staff taps ACCEPT
          ─ accept_offer(token, ua) [SECURITY DEFINER, ATOMIC] ─▶
               validate token+status+expiry
               upsert crew_member (org, from staff_profile)
               insert crew_assignment (crew, event, org, days, amount)
               offers.status='accepted'
6. Dashboard status board shows 'accepted'; crew now lives in HITO's
   crew_members/crew_assignments (shared DB) — visible in HITO too.
```

Rejection / expiry follow the same RPC shape (`reject_offer`, or a scheduled job flipping `sent`/`viewed` past `expires_at` → `expired`).

---

## Suggested Build Order

1. **Data layer first (in shared Supabase).** Migrate `staff_profiles` (nullable org_id + trigger + backfill), create `offers`, create `get_public_offer` + `accept_offer` RPCs. **Test the RPCs in SQL with a real token before writing any UI** — this is the risky, load-bearing part. Verify the live web-form insert still works after the trigger.
2. **App scaffold.** New Next.js 15 repo + Vercel project. Copy `lib/supabase/*`, `middleware.ts` (drop HITO's i18n routing), login page, `auth/callback`, `[orgSlug]/layout.tsx` auth gate, `getOrgId`.
3. **Dashboard read.** Staff search + filter over `staff_profiles`; profile page with CV via `createSignedUrl`.
4. **Offer create + send.** Create-offer form + server action; copy `mailer.ts`; wa.me builder.
5. **Public accept page.** `/o/[token]` wired to the step-1 RPCs (clone `AcceptProposal.tsx`). This closes the loop end to end.
6. **Status board + polish.** Offer status board, mobile-first pass, Motion transitions, expiry job.

**Dependency:** step 5 cannot be trusted until step 1's RPCs are SQL-tested. Steps 3-4 depend only on step 2. Do 1 and 2 in parallel if possible.

---

## Scaling Considerations

| Scale | Adjustment |
|-------|-----------|
| v1 — 1 org, ~146 staff, few events | Trivial on Supabase + Vercel free tiers. No caching, no queues needed. |
| v2 — marketplace, N employer orgs | Already org-scoped (`offers.organization_id`, `is_org_member`). Opening = add employer orgs + relax `staff_profiles` SELECT to a shared-pool view + add staff accounts. **Config, not rewrite** — the day-1 multi-tenant decision pays off here. |
| Higher volume | First bottleneck is email deliverability on shared SMTP (ferozo), not DB. Mitigate by enabling the Resend leg of the copied `mailer.ts` cascade (still a free tier). |

---

## Anti-Patterns

### Parallel crew tables
**Mistake:** the staff app invents its own `hires`/`workers` tables. **Why wrong:** breaks PROJECT.md's single-source-of-truth constraint; HITO wouldn't see the hire. **Instead:** write to `crew_members` / `crew_assignments` via the accept RPC.

### Anon touching tables directly
**Mistake:** open RLS on `offers`/`staff_profiles` so the public page can read/write. **Why wrong:** leaks PII and lets anyone enumerate offers. **Instead:** anon only ever calls `get_public_offer` / `accept_offer` (SECURITY DEFINER, `search_path` locked, granted to `anon`). Exactly HITO's proven pattern.

### NOT NULL org_id migration
**Mistake:** `ALTER ... SET NOT NULL` on `staff_profiles.organization_id`. **Why wrong:** the live anon web-form insert has no org and fails instantly. **Instead:** nullable column + BEFORE INSERT trigger default + backfill.

### Two-call hire (non-atomic)
**Mistake:** create `crew_member`, then separately create `crew_assignment` from the client. **Why wrong:** a failure between them leaves an orphan crew member or a lost assignment. **Instead:** one plpgsql RPC = one transaction.

### CV exposure on public pages
**Mistake:** the accept page fetches CVs or lists other applicants. **Why wrong:** private `staff-cvs` bucket leaked. **Instead:** CVs only in the authed dashboard via short-TTL signed URLs.

### Forking HITO for auth
**Mistake:** fork the whole HITO repo to "reuse" auth. **Why wrong:** drags 45 unlaunched sections, i18n routing, Capacitor — the exact baggage the standalone verdict avoids. **Instead:** copy the 4 Supabase files + login + gate.

---

## Integration Points

| Service | Integration | Notes |
|---------|-------------|-------|
| Supabase HITO | `@supabase/ssr` anon key + RLS (authed); SECURITY DEFINER RPC (anon) | Same project as HITO — no CORS, no cross-project session issues |
| `staff-cvs` bucket | `createSignedUrl` server-side, short TTL | Dashboard only |
| SMTP (ferozo, marca DER) | Copied `mailer.ts` cascade | Free; slow (15-25s) — show honest sending state |
| WhatsApp | `wa.me` deep link, client-side | No Meta API (cost/approval avoided per PROJECT.md) |
| somosder-web form | Untouched — keeps its anon INSERT | Trigger stamps org transparently |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dashboard ↔ DB (authed writes) | Next server actions + RLS `is_org_writer` | Never service-role in the request path |
| Public page ↔ DB | SECURITY DEFINER RPC only | Token is the sole credential |
| Staff-app ↔ HITO | Shared DB tables (`crew_*`, `events`), zero code coupling | Decoupled deploys, coupled data — the intended split |

---

## Sources

- `/Users/fridao/Proyectos/HITO-by-DER-main/` — read directly: `app/[orgSlug]/layout.tsx` (auth gate), `app/[orgSlug]/crew/{actions,page}.tsx` (crew writes + org pattern), `app/p/[token]/{page,AcceptProposal}.tsx` (public token flow), `lib/supabase/{server,admin}.ts`, `lib/email/mailer.ts`, `lib/events/modules.ts` (WEDGE_MODE/SHOW_* flags), `middleware.ts` — **HIGH**
- `supabase/migrations/00008_proposal_acceptance.sql` — the exact SECURITY DEFINER accept pattern being cloned — **HIGH**
- `supabase/migrations/00018_crew_payroll.sql` — `crew_assignments` columns (days/amount/paid) — **HIGH**
- `.planning/PROJECT.md` — constraints, `staff_profiles` shape (29 cols, no org_id, anon insert), existing token RPCs — **MEDIUM** on exact columns (owner-stated, not live-queried)

---
*Architecture research for: event-staffing app over HITO Supabase*
*Researched: 2026-07-10*

---

## ⚠️ ADDENDUM 2026-07-13 — Decisión del dueño anula el veredicto de "Supabase compartida"

Franco corrigió la premisa: la app NO debe ser un anexo de HITO ni escribir en su base como si fuera parte de HITO. Debe ser **un producto independiente con base de datos propia**, integrado a HITO por un **puente**, no fusionado.

**Decisión final (reemplaza la sección de data model de arriba):**
- **Base propia:** proyecto Supabase nuevo (org `wsvqlrjmizvivgrgnfpw`, costo verificado **$0** vía `get_cost`). La app es dueña de: `staff_profiles` (propio), `gigs` (eventos propios, con `hito_event_id` nullable opcional), `crew` (propio), `offers`.
- **El formulario web se repunta** a la base de la app; los 146 postulantes de HITO se copian una vez (backfill). Ya NO se migra `staff_profiles` in-place dentro de HITO.
- **Puente app→HITO:** función SECURITY DEFINER EN HITO que recibe el push de crew (crea `crew_member`+`crew_assignment` en la org/evento de HITO), idempotente, por token/service. La app la llama SOLO cuando el gig está vinculado a un evento de HITO. Cross-project ⇒ sin FKs físicas; vínculo por referencia guardada (`hito_event_id`, `hito_crew_member_id`).
- **Puente HITO→app (lectura):** la app lee la lista de eventos de HITO para poder vincular un gig.
- **MCP:** descartado como mecanismo de integración de datos (es IA↔herramientas, no sync de apps). Posible v2: operar la app por lenguaje natural.

Lo que SIGUE vigente del veredicto original: standalone Next.js 15 espejando patrones de HITO (auth+org gate, patrón de RPC de aceptación, `mailer.ts`); RLS + tokens SECURITY DEFINER para el link mágico; el mismo build order (datos y RPCs primero, UI después). Lo único que cambia es DÓNDE viven los datos (base propia, no la de HITO) y que aparece una capa-puente explícita.
