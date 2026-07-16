# Phase 5: Status Board, Extras & Real Hire — Research

**Researched:** 2026-07-16
**Domain:** Next.js 15.5 App Router + Supabase `staff_app` (schema co-located en el proyecto de HITO `luillpzfqzbpoqkgvjuw`) + Vercel Hobby deploy + SMTP Ferozo
**Confidence:** HIGH (todo verificado contra las migraciones reales `staff_app_0001..0009` y el código de Fases 2-4 ya en el repo; el único punto MEDIUM es el diseño del recordatorio-por-token, que necesita una decisión de Franco/planner)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (design deferred):** construir con los tokens/componentes placeholder actuales (igual que Fase 2/3/4). El reskin premium (Stitch "Minimalista Radical") es DESPUÉS de esta fase, todo de una. Mantener TODO token-driven para que el reskin sea un swap.
- **D-02 (STAT-02 board por gig):** vista de cobertura por gig — por cada gig, los roles y, por rol/oferta, el estado (enviada/vista/aceptada/rechazada/vencida, "vencida" DERIVADA de `now() > expires_at`). Reusar `public.staff_app_offers` (04-01) + una lectura de gigs. Es también el fix del hueco de UX: Franco NO debería tener que cazar un candidato para ver el estado; el board es la superficie única de un vistazo.
- **D-03 (XTRA-01 favoritos + notas privadas):** favoritos y notas org-scoped, NUNCA visibles al candidato (viven del lado app/productor, jamás en un RPC/página candidate-facing). Nueva tabla `staff_app`, RLS org-scoped, expuesta al productor autenticado vía `public` security_invoker view (lecturas) + SECURITY DEFINER RPC (escrituras), WR-05 REVOKE explícito. Migración aplicada LIVE por el orchestrator.
- **D-04 (XTRA-03 re-filtro next-candidate):** tras rechazo/vencimiento, un tap vuelve a la misma búsqueda filtrada MINUS los ya ofertados para ese gig. Search param + exclusión "not in (offered for this gig)", espejando el patrón crew_busy de Fase 2.
- **D-05 (XTRA-02 vencimiento + UN recordatorio, gratis):** las ofertas vencen en `expires_at` (ya enforced en el accept RPC; "vencida" derivada en lectura). Enviar EXACTAMENTE UN recordatorio antes de vencer vía **Vercel Cron gratis** que pega a un route handler que busca ofertas por vencer (no recordadas aún, todavía sent/viewed) y envía vía el mailer de Fase 3. Necesita una columna `reminded_at` para el exactly-once. **GATED en credenciales SMTP** — construir cron + lógica ahora; sólo envía de verdad cuando Franco da el secreto SMTP.
- **D-06 (XTRA-04 rating post-evento):** Franco puntúa staff 1-5 + nota opcional tras un gig. Nueva tabla rating `staff_app`, org-scoped, producer-only. Mismo patrón de acceso (view/RPC + WR-05, migración live).
- **D-07 (SHIP-01 deploy) — GATED EN FRANCO:** deploy a un Vercel project PROPIO (Hobby, gratis) con env vars (Supabase URL/anon/service, SITE_URL, SMTP_*). SPF/DKIM verificados en el dominio Ferozo/DER. Necesita: OK de Franco para crear el project + credenciales SMTP + acceso DNS para SPF/DKIM. El bypass de dev-login (LABURO_DEV_BYPASS) NO debe shippear (la ruta ya 404ea en producción, pero confirmar).
- **D-08 (SHIP-02 real hire) — GATED EN FRANCO:** una persona REAL encontrada, ofertada, aceptada por el link, registrada como crew en la app. Hito humano que Franco hace una vez que la app está deployada + el email funciona. El push a HITO queda afuera (Fase 6; los gigs quedan hito_event_id NULL).
- **Copy:** voseo argentino, cálido, SIN em dash (regla dura).

### Claude's Discretion
- Forma exacta de las tablas/vistas/RPCs nuevas (columnas, nombres), consolidación de migraciones, estructura de componentes UI, cómo se agrupa el board, dónde cuelga el CTA "volver a la lista". Todo dentro de los patrones establecidos (0007/0008/0009).

### Deferred Ideas (OUT OF SCOPE)
- Puente HITO (BRDG-*) → Fase 6.
- Reskin visual premium (Stitch Minimalista Radical) → inmediatamente DESPUÉS de esta fase.
- Extras de Stitch fuera del roadmap (notifications center, payments, chat, onboarding interactivo, master calendar) → v2. XTRA-01..04 son los extras v1 curados.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción | Soporte de research |
|----|-------------|---------------------|
| STAT-02 | Tablero de ofertas por gig: qué roles cubiertos vs abiertos + estado de cada oferta | `public.staff_app_offers` (0009) ya trae todo lo de la oferta + `gig_title`; falta agregar nombre del candidato a la vista y agrupar por gig en el server. "Vencida" derivada con `offerLabel()` ya existente. |
| XTRA-01 | Favoritos + notas privadas org-scoped, nunca visibles al candidato | Nueva tabla `staff_app.candidate_notes` + view security_invoker + RPC SECURITY DEFINER upsert, patrón 0008. Cero superficie candidate-facing (verificado: hoy no existe ninguna referencia a notas). |
| XTRA-03 | Ante rechazo/vencimiento, un tap vuelve a la lista filtrada sin los ya ofertados | Reusa el patrón `.not("id","in",...)` de `app/(app)/page.tsx` (crew_busy). Fuente: `public.staff_app_offers` filtrado por `gig_id`. Nuevo param `gig` en `lib/search-params.ts`. Sin migración nueva. |
| XTRA-02 | Ofertas vencen y mandan UN recordatorio antes de vencer (cron gratis Vercel) | Columna `offers.reminded_at` (exactly-once) + `vercel.json` cron diario + route handler protegido por `CRON_SECRET` + RPC `public.staff_app_offers_due_reminder()` + mailer honesto. Ver Pitfall 1 (token no recuperable → rotación). |
| XTRA-04 | Calificar staff post-evento (1-5 + nota) | Nueva tabla `staff_app.staff_ratings` (score 1-5 + note, atada a staff_profile+gig) + view + RPC upsert. Cuelga del perfil o del board tras aceptar. |
| SHIP-01 | Deploy a Vercel project propio con SPF/DKIM verificados | Env vars enumeradas abajo + config de redirect URL de Supabase Auth + registros DNS SPF/DKIM/DMARC. Ver sección Deploy. |
| SHIP-02 | 1 contratación real end-to-end | Depende de SHIP-01 + SMTP funcionando. Hito humano de Franco. Guardrails ya existen (token single-use, crew idempotente). |
</phase_requirements>

---

## Summary

Toda la maquinaria de datos que Phase 5 necesita YA existe y está probada: `public.staff_app_offers` (0009) trae por oferta `id, gig_id, staff_profile_id, role, status, expires_at, sent_at, viewed_at, responded_at, gig_title`, RLS `is_org_member` vía security_invoker; `public.staff_app_gigs` (0008) lista gigs org-scoped; el mailer honesto (`lib/email/mailer.ts`) ya degrada solo cuando falta SMTP; y `app/(app)/page.tsx` ya demuestra el patrón exacto de exclusión `.not("id","in",(...))` que XTRA-03 reusa. No hay que inventar arquitectura nueva: Phase 5 es **extender el read-layer + 2 tablas producer-only + un cron + un deploy**, todo con los moldes de 0007/0008/0009 (security_invoker view para lecturas, SECURITY DEFINER RPC para escrituras, WR-05 REVOKE explícito de anon).

El board (STAT-02) NO es una tabla de "slots de rol requeridos": no existe un roster de roles pre-definido por gig. La cobertura se DERIVA de las ofertas: por gig, cada oferta tiene un `role` y un `status`; aceptada = rol cubierto, sent/viewed = pendiente, rechazada/vencida = abierto (re-ofertar). El único cambio de datos que el board pide es agregar el nombre del candidato a `public.staff_app_offers` (hoy no lo trae) para que Franco vea a QUIÉN le ofertó cada rol.

El punto más delicado es XTRA-02: el token crudo NUNCA se persiste (0008 guarda sólo `sha256(token)`), así que el cron **no puede reconstruir el link mágico** de una oferta existente. Hay que decidir entre (a) recordatorio con link recién rotado (RPC que genera un token nuevo, actualiza `token_hash`, invalida el link viejo) o (b) recordatorio sin link accionable. Recomiendo (a). Todo XTRA-02 se construye ahora pero no envía hasta que Franco dé SMTP.

**Primary recommendation:** 2 migraciones nuevas (`staff_app_0010` = board read-surface + `reminded_at` + RPC de recordatorio; `staff_app_0011` = tablas `candidate_notes` + `staff_ratings` con sus views/RPCs), ambas aplicadas LIVE por el orchestrator; reusar verbatim los patrones 0008/0009; XTRA-03 sin migración; y separar limpio lo buildable-ahora (STAT-02, XTRA-01/03/04, código de XTRA-02) de lo Franco-gated (SMTP, Vercel project, DNS, hire real).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board de cobertura por gig (STAT-02) | API/DB (`public.staff_app_offers` + gigs, RLS) | Frontend Server (RSC agrupa por gig) | La RLS scopea filas; el server sólo agrupa y deriva "vencida". |
| Favoritos + notas privadas (XTRA-01) | API/DB (tabla + RPC SECURITY DEFINER, WR-05) | Frontend Server (RSC lee la view; action llama al RPC) | El aislamiento producer-only es RLS + REVOKE anon, no lógica de cliente. |
| Re-filtro next-candidate (XTRA-03) | Frontend Server (RSC de búsqueda) | API/DB (`staff_app_offers` como fuente de exclusión) | Es una query más con `.not(...in...)`; misma superficie que Fase 2. |
| Recordatorio de vencimiento (XTRA-02) | API/Backend (route handler + RPC + mailer) | Infra (Vercel Cron scheduler) | El scheduler dispara; toda la lógica de exactly-once vive en el RPC/DB. |
| Rating post-evento (XTRA-04) | API/DB (tabla + RPC, WR-05) | Frontend Server | Igual que XTRA-01. |
| Deploy + SPF/DKIM (SHIP-01) | CDN/Infra (Vercel) + DNS (Ferozo/DER) | — | Config de plataforma + registros DNS; nada de código de app. |
| Real hire (SHIP-02) | Humano (Franco) sobre el flujo existente | Todos | Milestone operativo, no build. |

---

## Standard Stack

No hay librerías nuevas. El stack de Phase 5 es el mismo `package.json` ya instalado. Verificado en `/Users/fridao/Proyectos/SOMOS DER/staff-app/package.json`:

### Core (ya instalado, sin cambios)
| Library | Versión (pin actual) | Uso en Phase 5 |
|---------|----------------------|----------------|
| `next` | `^15.5.20` | RSC del board/perfil, Route Handler del cron, Server Actions de notas/rating |
| `@supabase/supabase-js` | `^2.110.6` | `.from(view)` para lecturas RLS, `.rpc(...)` para escrituras SECURITY DEFINER |
| `@supabase/ssr` | `^0.12.3` | cliente server (JWT de Franco) + cliente service-role para el cron |
| `nodemailer` | `^9.0.3` | envío del recordatorio vía `lib/email/mailer.ts` (ya portado) |
| `@react-email/components` | `^1.0.12` | template del email recordatorio (mismo patrón que `OfferEmail`) |
| `@base-ui/react` | `^1.6.0` | Select/Dialog para el rating y el filtro del board |
| `motion` | `^12.42.2` | micro-interacciones (preferencia global; import `motion/react`) |
| `sonner` | `^2.0.7` | toasts "Guardado", "Recordatorio enviado" |
| `lucide-react` | `^0.546.0` | íconos (Star para rating, Bookmark para favorito) |

**Instalación:** ninguna. `npm install` NO se corre en esta fase (cero paquetes nuevos → cero superficie slopsquatting). El único secreto nuevo de plataforma es `CRON_SECRET` (env var, no paquete).

### Alternativas consideradas (y descartadas)
| En vez de | Se podría usar | Por qué NO |
|-----------|----------------|-----------|
| Vercel Cron gratis | Supabase `pg_cron` / Edge Function schedule | pg_cron corre en el proyecto COMPARTIDO con HITO (efecto cross-app); Vercel Cron aísla el scheduler en el project propio de la app. D-05 fija Vercel Cron. |
| `reminded_at` column | tabla `offer_reminders` separada | Overkill para exactly-once de UN recordatorio; una columna nullable alcanza y es más simple. |
| Star rating con Base UI | librería de rating dedicada | Viola "cero paquetes nuevos"; 5 botones con `lucide-react` Star alcanzan. |

## Package Legitimacy Audit

**No aplica** — Phase 5 no instala ningún paquete externo. `package.json` queda intacto (verificado). El único agregado es la env var `CRON_SECRET` en Vercel. Sin superficie de slopsquatting/registry en esta fase.

---

## Data Layer — el molde exacto a copiar

### Lo que YA existe y se reusa (verificado en las migraciones)

**`public.staff_app_offers`** (staff_app_0009, líneas 121-131) — security_invoker view sobre `staff_app.offers JOIN staff_app.gigs`:
```
SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
       o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
       g.title AS gig_title, o.organization_id
```
RLS `offers_select (is_org_member)` scopea al org del caller. `GRANT SELECT ... TO authenticated; REVOKE ALL ... FROM anon`. **NO trae nombre del candidato** (limitación para el board).

**`public.staff_app_gigs`** (staff_app_0008, líneas 132-139): `id, title, starts_at, ends_at, venue_name, status, hito_event_id, organization_id`, security_invoker, authenticated-only.

**`public.staff_app_profiles`** (staff_app_0007, líneas 29-36): trae `id, nombre, apellido, oficios, ...` — fuente para nombres.

**`offers` (tabla base, staff_app_0002 líneas 75-91):** `status CHECK IN ('sent','viewed','accepted','declined','expired')`, `expires_at`, `token_hash text NOT NULL UNIQUE` (sha256, raw NUNCA guardado), `sent_at`, `viewed_at`, `responded_at`. **NO tiene `reminded_at`** — hay que agregarla.

**`offerLabel()`** (`app/(app)/staff/[id]/offer-status.tsx`, líneas 35-41) — deriva la etiqueta visible: accepted→"Aceptada", declined→"Rechazada", `now()>expires_at`→"Vencida" (DERIVADO, nunca del enum), viewed→"Vista", else "Enviada". **Reusar tal cual en el board** (exportar/compartir).

**Patrón de exclusión** (`app/(app)/page.tsx`, líneas 59-70): lee ids de una view, luego `query.not("id", "in", \`(${ids.join(",")})\`)`. Molde exacto para XTRA-03.

**Org fija:** `aa29aa2f-4d34-4e53-b62c-7397e8a4d123` (SOMOS DER). Toda RPC SECURITY DEFINER FUERZA este constante, nunca lo toma del input (0008 línea 65).

**Gate de escritura:** `staff_app.is_org_writer(org)` (0006) — enumera `role IN ('owner','writer')`. Toda RPC de escritura gatea con esto (0008 línea 73).

**WR-05 (crítico, verificado 0006 líneas 44-56):** en este proyecto Supabase-managed, `ALTER DEFAULT PRIVILEGES` es NO-OP; la default privilege del schema `public` auto-otorga `anon` en toda función/view nueva. Por eso CADA objeto nuevo lleva `REVOKE ALL ... FROM PUBLIC, anon` explícito + `GRANT` scoped. Sin el REVOKE explícito, la view/RPC nueva queda anon-callable.

### Migración nueva #1 — `staff_app_0010` (STAT-02 board + XTRA-02 recordatorio)

Objetos (todos aplicados LIVE por el orchestrator vía Supabase MCP `apply_migration`, luego `get_advisors(security)`):

1. **Columna `reminded_at`:**
   ```sql
   ALTER TABLE staff_app.offers ADD COLUMN reminded_at timestamptz;
   ```
   Exactly-once anchor para el recordatorio.

2. **Extender `public.staff_app_offers` para el board** (agregar nombre del candidato). `CREATE OR REPLACE VIEW` permite AGREGAR columnas al final:
   ```sql
   CREATE OR REPLACE VIEW public.staff_app_offers WITH (security_invoker = true) AS
     SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
            o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
            g.title AS gig_title, o.organization_id,
            sp.nombre AS staff_nombre, sp.apellido AS staff_apellido  -- NUEVAS
     FROM staff_app.offers o
     JOIN staff_app.gigs g            ON g.id  = o.gig_id
     JOIN staff_app.staff_profiles sp ON sp.id = o.staff_profile_id;
   ```
   (El GRANT SELECT sobre `staff_app.staff_profiles TO authenticated` ya existe desde 0007 línea 23; el de `offers` desde 0009 línea 115. Reaplicar los grants de la view por si `CREATE OR REPLACE` los resetea + REVOKE anon.)
   - **Nombre completo es PII org-scoped** — OK exponerlo acá: la view es authenticated + RLS is_org_member, jamás anon. NO tocar `staff_app.get_public_offer` (esa es la candidate-facing y sólo devuelve `first_name`).

3. **RPC de recordatorio `public.staff_app_offers_due_reminder()`** — SECURITY DEFINER, `SET search_path = staff_app, public, pg_temp`, para el cron. Selecciona ofertas con `status IN ('sent','viewed') AND reminded_at IS NULL AND expires_at > now() AND expires_at <= now() + interval 'N days'`; por cada una ROTA el token (nuevo `encode(extensions.gen_random_bytes(32),'hex')`, update `token_hash = sha256`), setea `reminded_at = now()`, y devuelve `jsonb`/SETOF con `{offer_id, email, first_name, gig_title, role, expires_at, token(raw nuevo)}`. WR-05: `REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO service_role` (el cron usa service-role; NO authenticated, NO anon). Ver Pitfall 1 para el trade-off de la rotación y la alternativa.

### Migración nueva #2 — `staff_app_0011` (XTRA-01 favoritos/notas + XTRA-04 rating)

1. **`staff_app.candidate_notes`** (una fila por (org, candidato)):
   ```sql
   CREATE TABLE staff_app.candidate_notes (
     id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
     staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
     is_favorite      boolean NOT NULL DEFAULT false,
     note             text,
     updated_by       uuid,
     updated_at       timestamptz NOT NULL DEFAULT now(),
     UNIQUE (organization_id, staff_profile_id)
   );
   ALTER TABLE staff_app.candidate_notes ENABLE ROW LEVEL SECURITY;
   CREATE POLICY candidate_notes_select ON staff_app.candidate_notes
     FOR SELECT USING (staff_app.is_org_member(organization_id));
   CREATE POLICY candidate_notes_write ON staff_app.candidate_notes
     FOR ALL USING (staff_app.is_org_writer(organization_id))
             WITH CHECK (staff_app.is_org_writer(organization_id));
   REVOKE ALL ON staff_app.candidate_notes FROM anon, authenticated;
   GRANT SELECT ON staff_app.candidate_notes TO authenticated;  -- para la view security_invoker
   ```
   - `public.staff_app_candidate_notes` security_invoker view (`id, staff_profile_id, is_favorite, note, updated_at, organization_id`), `GRANT SELECT TO authenticated; REVOKE ALL FROM anon`.
   - `public.staff_app_set_candidate_note(p_staff_profile_id uuid, p_is_favorite boolean, p_note text)` SECURITY DEFINER upsert: gate `is_org_writer(org fija)`, `INSERT ... ON CONFLICT (organization_id, staff_profile_id) DO UPDATE SET is_favorite=..., note=..., updated_by=auth.uid(), updated_at=now()`. WR-05: authenticated-only.

2. **`staff_app.staff_ratings`** (una fila por (org, candidato, gig)):
   ```sql
   CREATE TABLE staff_app.staff_ratings (
     id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id  uuid NOT NULL REFERENCES staff_app.organizations(id) ON DELETE CASCADE,
     staff_profile_id uuid NOT NULL REFERENCES staff_app.staff_profiles(id) ON DELETE CASCADE,
     gig_id           uuid NOT NULL REFERENCES staff_app.gigs(id) ON DELETE CASCADE,
     score            int  NOT NULL CHECK (score BETWEEN 1 AND 5),
     note             text,
     rated_by         uuid,
     created_at       timestamptz NOT NULL DEFAULT now(),
     UNIQUE (organization_id, staff_profile_id, gig_id)
   );
   ```
   Misma RLS/REVOKE/GRANT que candidate_notes. + view `public.staff_app_staff_ratings` + RPC `public.staff_app_rate_staff(p_staff_profile_id, p_gig_id, p_score, p_note)` SECURITY DEFINER upsert con gate `is_org_writer`. WR-05 authenticated-only.

**Consolidación:** 0010 y 0011 se pueden fusionar en UNA sola migración `staff_app_0010` si el planner prefiere una sola aplicación live. Recomiendo el split 2-a-1 porque mapea limpio a los planes sugeridos (05-01 board = 0010; 05-02 extras = 0011) y aísla el cambio de la view del board del alta de tablas nuevas. **Total nuevas migraciones Phase 5: 2 (consolidatables a 1).** XTRA-03 y SHIP-01/02 no necesitan migración.

**Nota sobre columnas legacy:** `staff_app.staff_profiles` ya tiene `rating numeric` y `notas_internas text` (0002 líneas 42, 45) — carryover del superset de HITO. NO usarlas para XTRA-01/04: `rating` escalar no soporta rating por-gig y `notas_internas` no está expuesto en ningún view. Las tablas nuevas org-scoped son el hogar correcto (D-03/D-06). Dejar las columnas legacy sin tocar.

---

## Architecture Patterns

### Flujo de datos del board (STAT-02)
```
Franco (JWT) ─▶ RSC /gigs (o /board)
                  │
                  ├─▶ supabase.from("staff_app_gigs").select(...)          → todos los gigs del org
                  └─▶ supabase.from("staff_app_offers").select(...)         → todas las ofertas (con staff_nombre)
                          │  RLS is_org_member scopea filas
                          ▼
                  server agrupa ofertas por gig_id
                          ▼
                  por gig: derivar por rol/oferta con offerLabel()
                    accepted → "cubierto"
                    sent/viewed (y expires_at>now) → "pendiente"
                    declined | now()>expires_at → "abierto" (mostrar CTA "buscar reemplazo")
                          ▼
                  gigs sin NINGUNA oferta aparecen sólo desde staff_app_gigs (left-join en el server)
```
No hay slots de rol pre-definidos: la cobertura se deriva de las ofertas existentes. Un gig con 0 ofertas se muestra como "sin ofertas todavía".

### Flujo del recordatorio (XTRA-02)
```
Vercel Cron (diario, vercel.json) ─▶ GET /api/cron/reminders
        Authorization: Bearer $CRON_SECRET   ← Vercel lo manda solo
                  │  el route valida el header contra process.env.CRON_SECRET (401 si no)
                  ▼
        cliente service-role (server-only) ─▶ supabase.rpc("staff_app_offers_due_reminder")
                  │  (staff_app NO es PostgREST-exposed → DEBE ser wrapper public + service_role)
                  ▼
        por cada oferta due: render <ReminderEmail> + sendMail() (honesto)
                  │  smtpEnabled()===false ⇒ {ok:false, channel:"none"} → no-op limpio (gate SMTP)
                  ▼
        log honesto; nunca throw (mailer no tira)
```
Frecuencia Vercel Hobby: **una vez por día máximo**, y Vercel puede disparar en cualquier momento DENTRO de la hora indicada. Por eso el recordatorio es "a ~1-2 días de vencer", no "X horas exactas antes".

### Flujo XTRA-03 (re-filtro next-candidate)
```
Board/perfil, rol abierto ─▶ Link "buscar reemplazo" ─▶ /?gig=<gigId>&oficios=<rol>
                  ▼
        RSC de búsqueda (page.tsx): si searchParams.gig presente →
          supabase.from("staff_app_offers").select("staff_profile_id").eq("gig_id", gigId)
          → ids ya ofertados → query.not("id","in",(...))   ← MISMO patrón que crew_busy
```

### Estructura de archivos sugerida (nueva)
```
app/(app)/gigs/                  # o /board — el tablero de cobertura (STAT-02)
  page.tsx                       # RSC: lee gigs + offers, agrupa, deriva
  gig-board.tsx                  # client: acordeón por gig, badges por rol/oferta
app/(app)/staff/[id]/
  notes-actions.ts               # server action → rpc staff_app_set_candidate_note
  favorite-note.tsx              # client: toggle favorito + textarea nota (XTRA-01)
  rating-actions.ts              # server action → rpc staff_app_rate_staff
  rating.tsx                     # client: 5 estrellas + nota (XTRA-04)
app/api/cron/reminders/route.ts  # XTRA-02: GET protegido por CRON_SECRET
components/emails/reminder-email.tsx   # template react-email (molde de offer-email.tsx)
lib/search-params.ts             # agregar PARAM.gig + parse/build (XTRA-03)
vercel.json                      # cron entry (nuevo archivo, hoy no existe)
```

### `vercel.json` (nuevo — hoy NO existe, verificado)
```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
  ]
}
```
`0 9 * * *` = una vez al día ~09:00 UTC (Hobby-válido). Expresiones sub-diarias (`0 * * * *`, `*/30 * * * *`) FALLAN el deploy en Hobby con "Hobby accounts are limited to daily cron jobs".

### Anti-patterns a evitar
- **NO** insertar directo en `staff_app.candidate_notes`/`staff_ratings` desde el cliente: `staff_app` no está PostgREST-exposed + REVOKE. Todo write pasa por RPC `public.*` SECURITY DEFINER.
- **NO** agregar notas/favoritos/rating a `staff_app.get_public_offer` ni a la página `/o/[token]` ni a ningún wrapper anon (fuga de datos privados al candidato).
- **NO** marcar el enum `status='expired'` con el cron: "vencida" es SIEMPRE derivada de `now()>expires_at` (D-02, ya así en `offer-status.tsx`). El cron sólo manda recordatorio, no cambia status.
- **NO** usar el cliente service-role para las lecturas de board/notas/rating: esas van con el JWT de Franco (RLS). Service-role SÓLO en el route del cron.

---

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Scheduler del recordatorio | loop/setInterval en un server, o un servicio externo pago | Vercel Cron (`vercel.json`), gratis en Hobby | D-05 + cero-gasto; el project propio aísla del cron de HITO |
| Autenticación del cron | secreto casero en query string | header `Authorization: Bearer $CRON_SECRET` que Vercel manda solo a rutas cron | patrón oficial Vercel; evita disparos externos |
| Exactly-once del recordatorio | tabla de "ya enviados" + dedupe en app | columna `reminded_at` + filtro `reminded_at IS NULL` en el RPC | una columna nullable resuelve el once |
| Envío de email | cliente SMTP propio | `lib/email/mailer.ts` ya portado (honesto, nunca tira) | ya resuelto en Fase 3, degrada solo sin SMTP |
| Derivar "vencida" | recomputar en cada componente | `offerLabel()` de `offer-status.tsx` (exportar y reusar) | una sola fuente de verdad, ya probada |
| Exclusión de ya-ofertados | join manual/subquery client-side | patrón `.not("id","in",(...))` de `page.tsx` | idéntico al crew_busy existente |
| Aislamiento de notas privadas | flags/checks en el componente | RLS org-scoped + REVOKE anon en la view + no exponerlas en RPCs anon | seguridad en Postgres, no en el render |

**Key insight:** Phase 5 no tiene lógica nueva de seguridad ni de envío; TODO reusa moldes ya probados en 0007/0008/0009 y en el código de Fases 2-4. El riesgo no es técnico, es de disciplina: aplicar WR-05 en cada objeto nuevo y no filtrar notas al candidato.

---

## Common Pitfalls

### Pitfall 1: el token crudo no existe → el recordatorio no puede armar el link (XTRA-02) — CRÍTICO
**Qué pasa:** 0008 guarda sólo `sha256(token)` (`token_hash`), el raw se devuelve UNA vez y se pierde. El cron NO puede reconstruir `${SITE_URL}/o/<token>` de una oferta vieja.
**Cómo resolver (recomendado):** el RPC `staff_app_offers_due_reminder()` ROTA el token: genera uno nuevo (`encode(extensions.gen_random_bytes(32),'hex')`), actualiza `token_hash = encode(extensions.digest(nuevo,'sha256'),'hex')` (mismo algoritmo que 0003/0008), y devuelve el raw nuevo para el email. Trade-off: **invalida el link del email original** (si el candidato hace click en el viejo tras el recordatorio, 404ea). Aceptable porque el recordatorio lo supersede. Setear `reminded_at=now()` en la MISMA transacción → exactly-once real.
**Alternativa (más simple, más débil):** recordatorio sin link, sólo "tu propuesta para X vence el DD/MM, revisá el email original o escribinos". No requiere rotación. **Decisión para Franco/planner.**
**Segundo trade-off de la rotación:** si el SMTP falla DESPUÉS de marcar `reminded_at`, ese recordatorio se pierde (no reintenta al día siguiente). Dado que XTRA-02 está SMTP-gated y el recordatorio es best-effort (la oferta igual vence y se ve en el board), es aceptable. Documentarlo.

### Pitfall 2: notas/favoritos/rating filtrados al candidato — CRÍTICO (XTRA-01)
**Qué pasa:** si alguna vez se agrega `candidate_notes`/`staff_ratings` a `staff_app.get_public_offer`, a la view `/o/[token]`, o a cualquier wrapper con `GRANT ... TO anon`, la nota privada queda pública.
**Cómo evitar:** las tablas/views nuevas son authenticated-only + `REVOKE ALL FROM anon` explícito (WR-05). La página `/o/[token]` ya es PII-safe (verificado: sólo renderiza lo que devuelve `get_public_offer` = `first_name` + oferta/gig/org, sin segunda query). Verificación de plan: `grep -riE "candidate_notes|staff_ratings|favorite|is_favorite" app/o lib` debe volver VACÍO. Hoy no existe ninguna referencia a notas en todo el repo (verificado).

### Pitfall 3: doble-envío del recordatorio
**Qué pasa:** el cron corre, marca, pero por retry/redeploy corre dos veces.
**Cómo evitar:** el filtro `reminded_at IS NULL` dentro del RPC + el `UPDATE ... SET reminded_at=now()` en la misma transacción hacen que una segunda corrida no seleccione la misma oferta. Idempotente por diseño.

### Pitfall 4: frecuencia del cron en Hobby
**Qué pasa:** un `schedule` sub-diario (`0 * * * *`) hace FALLAR el deploy en Hobby.
**Cómo evitar:** una sola entrada diaria (`0 9 * * *`). Vercel puede disparar en cualquier minuto de esa hora → la ventana del recordatorio debe ser "a 1-2 días de vencer", no horas exactas. La imprecisión no importa para un recordatorio de vencimiento a días.

### Pitfall 5: la view security_invoker necesita SELECT base sobre las tablas nuevas
**Qué pasa:** una view `security_invoker` corre como el usuario que consulta; sin `GRANT SELECT ON staff_app.candidate_notes TO authenticated`, la view devuelve permission denied.
**Cómo evitar:** por cada tabla nueva, `GRANT SELECT ... TO authenticated` (como 0007 línea 23 y 0009 línea 115). La RLS igual scopea las filas al org.

### Pitfall 6: WR-05 olvidado en un objeto nuevo
**Qué pasa:** una view/RPC nueva queda anon-callable porque en este proyecto managed la default privilege auto-otorga anon y `ALTER DEFAULT PRIVILEGES` es no-op (0006 líneas 44-56).
**Cómo evitar:** CADA objeto nuevo lleva `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT` scoped explícito. Confirmar con `get_advisors(security)` post-apply (busca `function_search_path_mutable` y RLS findings).

### Pitfall 7: `CREATE OR REPLACE VIEW` y el orden/tipos de columnas
**Qué pasa:** `CREATE OR REPLACE VIEW` sólo permite AGREGAR columnas AL FINAL, no reordenar ni cambiar tipos de las existentes.
**Cómo evitar:** agregar `staff_nombre`/`staff_apellido` al final del SELECT (como en el snippet de 0010). Re-otorgar `GRANT SELECT TO authenticated` + `REVOKE FROM anon` tras el replace por las dudas.

---

## Deploy (SHIP-01) — pasos exactos

### Env vars a setear en el nuevo Vercel project (fuente: `.env.local`, verificado)
| Var | Scriptable / Franco | Nota |
|-----|---------------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | scriptable (mismo valor que local) | proyecto `luillpzfqzbpoqkgvjuw` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | scriptable | público por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | Franco (secreto) | server-only; lo usa el cron y admin.ts |
| `SITE_URL` | scriptable, pero **debe ser la URL de producción** (ej. `https://laburo.somosder.ar`) | la usa el link mágico y el redirect del dev-login. Si queda en localhost, los links se rompen |
| `CRON_SECRET` | scriptable (generar random) | NUEVO. Vercel lo manda como `Authorization: Bearer` a la ruta cron |
| `MAIL_FROM_NAME` | scriptable | "SOMOS DER" |
| `MAIL_FROM_ADDRESS` | Franco (recomendado setear) | HOY no está seteada → cae a `SMTP_USER`. Para alineación DMARC conviene fijar la dirección branded @somosder.ar |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | Franco (Ferozo) | GATE de OFER-02 + XTRA-02. Sin esto el mailer es no-op honesto |
| `LABURO_DEV_BYPASS` | **NO SETEAR** | su ausencia + `NODE_ENV=production` hacen 404 al dev-login |
| `VERCEL_OIDC_TOKEN` | **NO SETEAR manual** | lo gestiona Vercel solo |

### dev-login en producción — CONFIRMADO seguro (verificado en `app/dev-login/route.ts`)
La ruta 404ea con **doble** guardia: `process.env.LABURO_DEV_BYPASS !== "1" || process.env.NODE_ENV === "production"`. Aunque alguien setee `LABURO_DEV_BYPASS=1` por error, `NODE_ENV==="production"` en Vercel lo bloquea igual. No requiere borrar la ruta, pero el plan puede borrarla por higiene.

### Config Supabase Auth (Franco-gated / orchestrator con acceso al dashboard) — NO olvidar
Para que el login Google/magic-link de Franco funcione en el dominio de producción, agregar en Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://<dominio-prod>`
- **Redirect URLs:** `https://<dominio-prod>/auth/callback`
Sin esto, el login en prod redirige mal / falla. Es un paso de deploy fácil de olvidar (no está en el código).

### SPF/DKIM/DMARC (Franco-gated — DNS del dominio Ferozo/DER)
- **SPF:** TXT en el dominio (o subdominio de envío) incluyendo el servidor de Ferozo (valor exacto lo da el panel Ferozo, típicamente `v=spf1 include:_spf.ferozo.com ~all` o el host MX que Ferozo indique).
- **DKIM:** Ferozo provee un selector + clave pública → publicar como TXT `<selector>._domainkey.<dominio>`.
- **DMARC (recomendado):** TXT `_dmarc.<dominio>` con `v=DMARC1; p=none; rua=mailto:...` para empezar en monitoreo.
- **Alineación:** el `From` (MAIL_FROM_ADDRESS) debe ser del dominio con SPF/DKIM para pasar DMARC → no caer en spam.
- **Verificar:** enviar a mail-tester.com o revisar en MXToolbox tras propagar DNS.
Los VALORES exactos vienen del panel Ferozo (Franco); el researcher/planner sólo especifica la FORMA de los registros. Inherentemente Franco-gated (necesita acceso DNS).

### SHIP-02 (real hire) — qué tiene que ser verdad
1. App deployada (SHIP-01) con `SITE_URL` de producción correcta.
2. SMTP funcionando (email sale de verdad) — o Franco refuerza por wa.me con el link.
3. Un candidato real del pool con email válido.
4. Franco crea gig real + oferta real (monto informativo), manda.
5. El candidato abre el link (`/o/<token>`), acepta con POST explícito.
6. `accept_offer` crea la fila `crew` atómicamente (idempotente, single-use ya probado).
7. Verificación: el board (STAT-02) muestra ese rol del gig como "cubierto".
**Guardrails ya existentes:** token single-use 256-bit hasheado, `expires_at` enforced en el RPC, crew `UNIQUE(gig_id,staff_profile_id)` ON CONFLICT DO NOTHING (no doble-booking). Hito humano, no build.

---

## Environment Availability

| Dependency | Required by | Available | Nota / Fallback |
|------------|-------------|-----------|-----------------|
| Vercel CLI (`ridaofranco-8135`, logueado) | SHIP-01 deploy | ✗ en este shell (subagent) | Verificado: `vercel` no está en el PATH de este subagent. El orchestrator/Franco lo corre. CONTEXT confirma CLI logueado. |
| Vercel Hobby cron | XTRA-02 | ✓ (plan) | Límite: 1 job/día, disparo dentro de la hora. |
| SMTP Ferozo | OFER-02, XTRA-02 real send | ✗ (creds no dadas) | GATE Franco. Mailer degrada a no-op honesto sin esto. |
| DNS del dominio DER (Ferozo) | SHIP-01 SPF/DKIM | ✗ | GATE Franco (acceso DNS). |
| Supabase MCP `apply_migration` | 0010/0011 live | ✗ en subagent | Sólo el orchestrator tiene Supabase MCP. Las migraciones se entregan como SQL para que el orchestrator las aplique + `get_advisors`. |
| Node/Next/paquetes | build local | ✓ | `package.json` sin cambios; nada nuevo que instalar. |

**Bloqueantes sin fallback:** SMTP creds, Vercel project + env, DNS SPF/DKIM, hire real → todos Franco-gated (esperado por D-05/D-07/D-08).
**Con fallback:** el envío de oferta sin SMTP cae a wa.me (ya implementado en Fase 3).

---

## Security Domain

`security_enforcement` no está en config como `false` → aplica.

### Categorías ASVS relevantes
| Categoría ASVS | Aplica | Control estándar (ya en el repo) |
|----------------|--------|----------------------------------|
| V4 Access Control | sí | RLS `is_org_member`/`is_org_writer` en toda tabla nueva; WR-05 REVOKE anon en views/RPCs |
| V5 Input Validation | sí | `score CHECK (1..5)`; whitelist de search params (`lib/search-params.ts`); RPCs re-validan server-side |
| V6 Cryptography | sí | token 256-bit `gen_random_bytes(32)` + `sha256` hasheado en reposo (no hand-roll; reusa 0003/0008) |
| V9/V13 API/Auth | sí | cron protegido por `CRON_SECRET` bearer; service-role sólo server-side |

### Amenazas específicas de esta fase (STRIDE)
| Patrón | STRIDE | Mitigación |
|--------|--------|-----------|
| Nota privada leída por el candidato | Information Disclosure | tabla authenticated-only + REVOKE anon + no exponerla en ninguna superficie por-token (Pitfall 2) |
| Disparo externo del cron | Spoofing/DoS | validar `Authorization: Bearer $CRON_SECRET`; 401 si no coincide |
| Objeto nuevo anon-callable por default privilege | Elevation of Privilege | WR-05 REVOKE explícito por objeto (Pitfall 6) + `get_advisors` post-apply |
| service-role key en el cliente | Information Disclosure | service-role SÓLO en `app/api/cron/*` (server); lecturas de UI con JWT |
| Doble/replay del recordatorio o del accept | Tampering | `reminded_at IS NULL` + update transaccional; token single-use + `expires_at>now()` ya en 0003 |

---

## Assumptions Log

| # | Claim | Sección | Riesgo si está mal |
|---|-------|---------|--------------------|
| A1 | Recordatorio con rotación de token (invalida el link viejo) es aceptable | Pitfall 1 | Si Franco quiere que el link original siga vivo, hay que elegir la alternativa sin-link o persistir el raw (rompe hash-at-rest). Decisión de discuss/planner. |
| A2 | Valor SPF de Ferozo ≈ `include:_spf.ferozo.com` | Deploy SPF/DKIM | `[ASSUMED]` — el valor real lo da el panel Ferozo; usar el que Ferozo indique, no éste. |
| A3 | Dominio de producción tipo `laburo.somosder.ar` | Deploy env | `[ASSUMED]` — Franco define el dominio final; ajustar `SITE_URL` + redirect URLs a ese valor. |
| A4 | Ventana del recordatorio = 1-2 días antes de vencer | XTRA-02 | Elegible; el default de oferta es 7 días (0002 línea 86). Franco/planner fija el N. |
| A5 | El board vive en `/gigs` (o `/board`) como ruta nueva | Estructura | Nombre de ruta a discreción; no afecta datos. |

---

## Open Questions

1. **Recordatorio: ¿con link rotado o sin link?** (A1) — recomiendo link rotado; necesita OK de Franco por el trade-off del link viejo que muere.
2. **¿Consolidar 0010+0011 en una sola migración?** — funcionalmente equivalente; recomiendo 2 por mapeo a planes, pero el orchestrator puede aplicar 1.
3. **Dominio de producción y valores DNS exactos** — dependen de Franco (A2, A3).
4. **¿Rating cuelga del perfil o del board?** — recomiendo del perfil (ya tiene la sección "Ofertas"); el board podría linkear "calificar" en gigs pasados. Discreción de UI.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/staff_app_0001..0009` — schema, RLS, helpers, views, RPCs, WR-04/WR-05, patrones exactos (LEÍDOS verbatim).
- `app/(app)/page.tsx`, `search-client.tsx`, `lib/search-params.ts` — patrón de exclusión `.not(...in...)` + whitelist de params.
- `app/(app)/staff/[id]/page.tsx`, `offer-status.tsx`, `oferta/*`, `offer-actions.ts` — superficies donde cuelgan favoritos/notas/rating + `offerLabel()` reusable.
- `lib/email/mailer.ts` — mailer honesto SMTP-only, `smtpEnabled()` gate.
- `app/dev-login/route.ts` — doble guardia 404 en producción (confirmado).
- `package.json`, `.env.local` (nombres de var), `next.config.ts` — stack + env sin cambios.
- Grep verificado: cero referencias a `notes/favorite/rating/reminded` en `app|lib|components`; no existe `app/api` ni `vercel.json` aún.

### Secondary (MEDIUM confidence)
- [Vercel Cron — Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) y [Cron Jobs](https://vercel.com/docs/cron-jobs) — Hobby = 1 job/día, disparo dentro de la hora, hasta 100 jobs/project.
- [Vercel changelog: 100 crons/project](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan).

---

## Metadata
**Confidence breakdown:**
- Data layer / migraciones: HIGH — moldes 0007/0008/0009 leídos verbatim y replicados.
- Board / XTRA-03: HIGH — patrón crew_busy ya en producción, sólo cambia la fuente.
- XTRA-02 cron: MEDIUM — mecánica Vercel verificada; el diseño del token-en-recordatorio necesita decisión (A1).
- Deploy SPF/DKIM: MEDIUM — forma HIGH, valores Ferozo ASSUMED (A2).

**Research date:** 2026-07-16
**Valid until:** ~2026-08-15 (estable; el único ítem volátil es la política de cron de Vercel Hobby).

---

## RESEARCH COMPLETE

**Migraciones nuevas:** 2 (`staff_app_0010` = board read-surface con nombre del candidato + columna `offers.reminded_at` + RPC de recordatorio; `staff_app_0011` = tablas `candidate_notes` y `staff_ratings` con sus views security_invoker + RPCs upsert SECURITY DEFINER). Consolidables a 1. Ambas LIVE por el orchestrator + `get_advisors`. XTRA-03 y SHIP-* no requieren migración.

**Forma del board (STAT-02):** no hay slots de rol pre-definidos; la cobertura se DERIVA de las ofertas por gig — accepted=cubierto, sent/viewed=pendiente, declined|`now()>expires_at`=abierto. Fuente: `public.staff_app_offers` (ya trae status/expires_at/gig_title; sólo falta agregarle nombre del candidato) + `public.staff_app_gigs` para gigs sin ofertas. "Vencida" con el `offerLabel()` existente.

**Buildable-ahora (sin dep externa):** STAT-02 board, XTRA-01 favoritos/notas, XTRA-03 re-filtro, XTRA-04 rating, y TODO el código de XTRA-02 (cron + RPC + `reminded_at` + template), que queda no-op honesto hasta que haya SMTP.
**Franco-gated:** credenciales SMTP (desbloquea envío real + recordatorios), creación del Vercel project + env vars + config de redirect URL en Supabase Auth (SHIP-01), registros DNS SPF/DKIM/DMARC en Ferozo (SHIP-01), y la contratación real end-to-end (SHIP-02).
**Riesgo #1 a decidir antes de planear:** el recordatorio no puede reusar el link mágico viejo (token no persistido) — elegir rotación de token vs recordatorio sin link (A1).
