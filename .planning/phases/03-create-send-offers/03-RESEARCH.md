# Phase 3: Create & Send Offers - Research

**Researched:** 2026-07-16
**Domain:** Next.js 15.5 App Router server actions + Supabase SECURITY DEFINER RPCs (staff_app) + nodemailer/react-email transactional email + wa.me deep link
**Confidence:** HIGH (todo lo estructural está verificado contra el repo y las migraciones aplicadas; los únicos LOW son valores que sólo la DB en vivo confirma y las env SMTP que Franco debe cargar)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (design deferred):** Construir con el sistema de diseño placeholder ACTUAL (mismos tokens que Fase 2). El reskin premium se hace TODO junto DESPUÉS de la Fase 5. Componentes limpios para que el reskin sea un swap de tokens, no un rewrite. Ver [[franco-diseno-cero-ia]].
- **D-02 (email):** Enviar por el SMTP Ferozo de DER con nodemailer (reusar el patrón `somosder-web/src/lib/email.js` + env `SMTP_HOST/PORT/USER/PASSWORD/SECURE`, `MAIL_FROM_NAME/ADDRESS`). Cero ESP pago. Redactar el email de oferta como componente react-email renderizado a HTML. Feedback honesto (sending / sent / failed), nunca un success silencioso.
- **D-03 (WhatsApp):** El botón wa.me DEBE usar el logo REAL de WhatsApp (glifo oficial, verde `#25D366`), nunca un icono genérico. Mensaje pre-armado = resumen de la oferta + el mismo link mágico. Ver [[franco-whatsapp-logo]].
- **D-04 (gig):** La oferta se ata a un gig de la app — elegir un gig existente o crear uno rápido (name, fecha, lugar, rol). `gigs.hito_event_id` queda NULL esta fase (el link a HITO es Fase 6).
- **D-05 (offer creation writes to staff_app):** crear una oferta inserta en `staff_app.offers` con un token de 256-bit (hasheado en reposo, matcheando las RPC de Fase 1) via función creadora SECURITY DEFINER o un path members-scoped; el link emailed/wa.me apunta a `/o/[token]` (esa página se construye en Fase 4).
- **Copy:** voseo argentino, cálido, sin em dash (regla dura de Franco).

### Claude's Discretion
- Forma exacta de la RPC creadora vs. server action con service-role (esta research recomienda la RPC pública SECURITY DEFINER como primaria).
- Estructura del formulario pick-or-create y de los componentes de estado de envío.
- Micro-interacciones con Motion (opcional, mobile-first, `prefers-reduced-motion`).

### Deferred Ideas (OUT OF SCOPE)
- Link gig↔evento de HITO → Fase 6.
- Página pública `/o/[token]` + accept/decline → Fase 4 (esta fase SÓLO crea + envía; el destino del link se construye la fase que viene).
- Reskin visual premium → después de Fase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OFER-01 | Crear una oferta atada a un gig de la app (gig existente o quick-create), con rol, fechas, monto informativo y condiciones, scoped a org + candidato | Q1 (RPC creadora `staff_app_create_offer`) + Q2 (gigs pick-or-create). Mapeo de campos aclarado: **rol/monto/condiciones → `offers`; fechas/lugar/name → `gigs`** (offers NO tiene columnas de fecha propias) |
| OFER-02 | La oferta sale automática por email (SMTP marca DER) con el link mágico | Q3 (mailer nodemailer + react-email, server action, env vars) |
| OFER-03 | Botón wa.me con mensaje pre-armado (oferta + link) para reforzar en un tap | Q4 (deep-link + glifo oficial reutilizado de `WhatsAppFab.astro`) |
</phase_requirements>

## Summary

Fase 3 es "pegamento": TODA la infraestructura pesada ya existe y está SQL-probada. `staff_app.offers` ya tiene la forma exacta (token_hash sha256, status enum, expires_at 7d) y las tres RPC de link mágico (`get_public_offer`/`accept_offer`/`decline_offer`) ya matchean un token raw hasheándolo con `sha256`. Lo único que Fase 3 agrega es (a) el camino de **creación** de la oferta que genera el token de 256-bit, guarda sólo su hash y devuelve el raw una vez para armar el link, (b) el **envío** por el SMTP Ferozo con nodemailer + react-email, y (c) el **botón wa.me** con el glifo oficial. No hay página pública que construir (eso es Fase 4).

El landmine central de esta fase es de **arquitectura de acceso, no de UI**: `staff_app` NO está expuesto por PostgREST (PGRST106, verificado en Fase 1), y la tabla `offers` tiene `REVOKE ALL ... FROM authenticated` en 0002. Por lo tanto el cliente autenticado NO puede insertar en `offers` ni por vista ni por policy directa. El patrón establecido y correcto (idéntico a `public.staff_app_register_applicant` de 0004 y `public.staff_app_provision_member` de 0007) es **una nueva función `public.staff_app_create_offer(...)` SECURITY DEFINER**, callable por `authenticated`, que verifica `is_org_writer`, genera el token con `extensions.gen_random_bytes(32)`, inserta con el hash, y devuelve `{ok, offer_id, token}` con el raw token UNA sola vez. El service-role queda confinado (o directamente no se usa para esto).

**Primary recommendation:** Una migración `staff_app_0008` que agrega (1) `public.staff_app_create_offer` (crea gig quick si hace falta + inserta offer + devuelve raw token, todo atómico), y (2) una vista `public.staff_app_gigs` security_invoker para listar gigs; luego un server action `'use server'` member-gated que llama la RPC con el cliente autenticado, arma el link `${SITE_URL}/o/${token}`, renderiza el email react-email y lo manda con un mailer portado de HITO (`MailResult`, nunca tira), devolviendo estado honesto a la UI. El wa.me reusa el glifo oficial ya presente en `somosder-web/src/components/WhatsAppFab.astro`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generación + hash del token 256-bit | Database (Postgres RPC) | — | `extensions.gen_random_bytes(32)` server-authoritative; raw nunca persiste, sólo `token_hash`. Matchea `get_public_offer` que hashea el raw entrante. Igual que Fase 1 no confía en app-side entropy. |
| Insert de offer + quick-create de gig | Database (SECURITY DEFINER RPC) | — | `offers`/`gigs` tienen `REVOKE ALL FROM authenticated` (0002) y `staff_app` no está en PostgREST → la única puerta de escritura es una RPC pública SECURITY DEFINER con gate `is_org_writer`. |
| Listar gigs existentes (pick) | Database (security_invoker view) | — | Mismo patrón que las 3 vistas de 0007; RLS `is_org_member` scopea por org. |
| Orquestación crear→link→enviar | Frontend Server (server action `'use server'`) | — | App Router server action member-gated; corre en Node runtime (nodemailer NO anda en edge). |
| Render del email a HTML | Frontend Server (react-email `render()`) | — | `render(<OfferEmail/>)` → HTML string → `nodemailer html:`. Templating desacoplado del transporte. |
| Envío SMTP | Frontend Server (nodemailer, Node runtime) | — | Ferozo SMTP, zero-budget. Devuelve `MailResult` honesto. |
| Botón wa.me | Browser / Client | — | Deep link `https://wa.me/<E.164>?text=...`; el tap abre WhatsApp. Sin API paga. |
| Entry point "Crear oferta" | Frontend Server (route `/staff/[id]` extend) | Browser (form client) | Cuelga del perfil de candidato de Fase 2 (`app/(app)/staff/[id]/page.tsx`). |

## Standard Stack

### Core (ya instalado — verificado en `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | `^15.5.20` | Server actions + Node runtime para el envío | Ya presente; paridad HITO. [VERIFIED: package.json] |
| @supabase/ssr | `^0.12.3` | Cliente autenticado (JWT) que llama la RPC creadora | Ya presente; `lib/supabase/server.ts`. [VERIFIED: package.json] |
| @supabase/supabase-js | `^2.110.6` | `.rpc('staff_app_create_offer', …)` | Ya presente. [VERIFIED: package.json] |
| sonner | `^2.0.7` | Toasts de estado (sending/sent/failed) | Ya presente; HITO lo usa para exactamente este flujo. [VERIFIED: package.json] |
| lucide-react | `^0.546.0` | Iconos UI (NO para el glifo WhatsApp — ver Q4) | Ya presente. [VERIFIED: package.json] |
| motion | `^12.42.2` | Micro-interacciones opcionales | Ya presente; preferencia global del usuario. [VERIFIED: package.json] |

### Supporting (NUEVO — hay que instalar)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nodemailer | `^9.0.3` | Transporte SMTP Ferozo | D-02 locked. `9.0.3` es la actual. [VERIFIED: npm view nodemailer version → 9.0.3] |
| @types/nodemailer | `^6` (devDep) | Tipos TS para el mailer portado | HITO's `mailer.ts` es TS y los usa. [ASSUMED — verificar en install] |
| @react-email/components | `^1.0.12` | Autorar el email de oferta como componente React | D-02 locked. `1.0.12` actual; **bundlea `@react-email/render@2.0.6`** así que `render` viene incluido. [VERIFIED: npm view @react-email/components@1.0.12 dependencies → @react-email/render 2.0.6] |

**Nota de compatibilidad crítica (react-email v2 render):** en `@react-email/render` v2, `render(<Component/>)` es **async** (devuelve `Promise<string>`). HAY que `await render(...)`. Es el error #1 de integración (ver Pitfall 4). Importar `render` desde `@react-email/components` o desde `@react-email/render`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `public.staff_app_create_offer` RPC (primaria) | Server action con service-role que inserta directo (patrón `signCv`) | El service-role bypassa RLS y hay que replicar el gate `is_org_writer` a mano; la RPC mantiene el service-role fuera y matchea el patrón ya establecido (register_applicant/provision_member). **Recomendado: RPC.** El service-role igual se necesita para NADA en esta fase si se usa la RPC. |
| react-email (locked) | HTML template string a mano (como `email.js`) | D-02 lockea react-email. `email.js` sirve como REFERENCIA de shell/marca, no como mecanismo. |
| nodemailer/SMTP directo | Cascada Resend→SMTP (patrón `mailer.ts` de HITO) | Resend viola cero-gasto; portar `mailer.ts` PERO dejar `resendEnabled()` en false (sin `RESEND_API_KEY`) → cae directo a SMTP y ya trae el `MailResult` honesto gratis. **Recomendado: portar mailer.ts, sólo rama SMTP activa.** |

**Installation:**
```bash
npm install nodemailer@^9 @react-email/components@^1
npm install -D @types/nodemailer
```

## Package Legitimacy Audit

> slopcheck NO estaba disponible en el entorno de research (`command -v slopcheck` → no encontrado). Igual los 3 paquetes son de primer nivel del ecosistema, verificados en npm y ya en uso en HITO/somosder-web. Se verificó versión en el registry npm correcto (npm, ecosistema Node) — pero por la regla de provenance, los paquetes NUEVOS quedan marcados para que el planner meta un `checkpoint:human-verify` antes de instalar.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| nodemailer | npm | ~13 años | ~14M/sem | github.com/nodemailer/nodemailer | unavailable | Approved (ya usado en somosder-web + HITO) [VERIFIED: npm registry + repo uso] |
| @react-email/components | npm | ~3 años | ~600k/sem | github.com/resend/react-email | unavailable | Approved (org Resend, mainstream) [VERIFIED: npm view version 1.0.12] |
| @types/nodemailer | npm | DefinitelyTyped | alto | github.com/DefinitelyTyped/DefinitelyTyped | unavailable | Approved [ASSUMED version ^6] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
*slopcheck no disponible → el planner debería confirmar versiones con `npm view` en el momento del install (checkpoint:human-verify liviano). Ninguna postinstall de riesgo: nodemailer/react-email no traen postinstall con red.*

## Q1 — Offer creation RPC (VERIFICADO contra migraciones aplicadas)

### Forma exacta de `staff_app.offers` [VERIFIED: supabase/migrations/staff_app_0002_core_tables.sql:75-91]
```
id               uuid PK default gen_random_uuid()
organization_id  uuid NOT NULL → organizations
gig_id           uuid NOT NULL → gigs
staff_profile_id uuid NOT NULL → staff_profiles
role             text NOT NULL            -- el "rol" de OFER-01
amount           numeric(18,2)            -- "monto informativo" (nullable)
conditions       text                     -- "condiciones" (nullable)
token_hash       text NOT NULL UNIQUE     -- sha256 hex del token raw
status           text NOT NULL DEFAULT 'sent' CHECK IN ('sent','viewed','accepted','declined','expired')
expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days')
sent_at          timestamptz NOT NULL DEFAULT now()
viewed_at        timestamptz
responded_at     timestamptz
created_at       timestamptz NOT NULL DEFAULT now()
```
**Clave de diseño:** `offers` NO tiene columnas de fecha propias. Las "fechas" de OFER-01 son del **gig** (`gigs.starts_at`/`ends_at`). El monto de la oferta (`offers.amount`) es informativo y NO se copia a `crew` al aceptar (ver más abajo).

### Qué esperan las RPC de Fase 1 (el contrato a matchear) [VERIFIED: staff_app_0003_magic_link_rpcs.sql]
- **Hash algo:** `v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex')` — sha256 hex de 64 chars. El creador DEBE guardar exactamente esto en `token_hash`. (`digest` vive en el schema `extensions`, schema-qualified.)
- **Statuses activos para leer/aceptar:** `get_public_offer` matchea por token y flipa `sent→viewed`; `accept_offer`/`decline_offer` guardan `status IN ('sent','viewed') AND expires_at > now()`. → Una oferta recién creada DEBE nacer con `status='sent'` (default) y `expires_at` futuro. El default de tabla ya lo garantiza.
- **Token entropy:** Fase 1 usó `extensions.gen_random_bytes(32)` → 64 hex chars (256-bit). El creador debe usar la MISMA fuente.
- `accept_offer(p_token, p_user_agent)` inserta en `crew (organization_id, gig_id, staff_profile_id, role)` — **NO** copia amount/days. Nota para Fase 4/5.

### RPC creadora recomendada — `public.staff_app_create_offer` (SECURITY DEFINER, en `public`)
Va en `public` (no en `staff_app`) para ser callable por PostgREST con el cliente autenticado, exactamente como `staff_app_register_applicant` (0004) y `staff_app_provision_member` (0007). Diseño:

```sql
-- Migration staff_app_0008 (nueva). extensions.* schema-qualified (gen_random_bytes/digest
-- viven en `extensions` en este proyecto). search_path incluye staff_app para is_org_writer.
CREATE OR REPLACE FUNCTION public.staff_app_create_offer(
  p_staff_profile_id uuid,
  p_role             text,
  p_gig_id           uuid    DEFAULT NULL,   -- pick: gig existente
  -- quick-create (usados sólo si p_gig_id IS NULL):
  p_gig_title        text    DEFAULT NULL,
  p_gig_starts_at    timestamptz DEFAULT NULL,
  p_gig_ends_at      timestamptz DEFAULT NULL,
  p_gig_venue        text    DEFAULT NULL,
  p_amount           numeric DEFAULT NULL,
  p_conditions       text    DEFAULT NULL,
  p_expires_in_days  int     DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = staff_app, public, pg_temp
AS $$
DECLARE
  v_org      uuid := 'aa29aa2f-4d34-4e53-b62c-7397e8a4d123';  -- org fija SOMOS DER
  v_gig      uuid := p_gig_id;
  v_raw      text := encode(extensions.gen_random_bytes(32), 'hex');   -- 256-bit
  v_hash     text := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  v_offer_id uuid;
BEGIN
  -- 1. Gate de escritura (writer de la org). auth.uid() se preserva en SECURITY DEFINER.
  IF NOT staff_app.is_org_writer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF coalesce(trim(p_role), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_required');
  END IF;

  -- 2. Quick-create de gig (atómico, sin race) si no vino p_gig_id.
  IF v_gig IS NULL THEN
    IF coalesce(trim(p_gig_title), '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_required');
    END IF;
    INSERT INTO gigs (organization_id, title, starts_at, ends_at, venue_name, hito_event_id, status)
    VALUES (v_org, p_gig_title, p_gig_starts_at, p_gig_ends_at, p_gig_venue, NULL, 'draft')
    RETURNING id INTO v_gig;
  ELSE
    -- validar que el gig es de la org (defensa; RLS no aplica dentro de SECURITY DEFINER)
    PERFORM 1 FROM gigs WHERE id = v_gig AND organization_id = v_org;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'gig_not_found');
    END IF;
  END IF;

  -- 3. Validar candidato de la org.
  PERFORM 1 FROM staff_profiles WHERE id = p_staff_profile_id AND organization_id = v_org;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'candidate_not_found');
  END IF;

  -- 4. Insert de la oferta (status='sent' por default, expires_at explícito).
  INSERT INTO offers (organization_id, gig_id, staff_profile_id, role, amount, conditions,
                      token_hash, expires_at)
  VALUES (v_org, v_gig, p_staff_profile_id, trim(p_role), p_amount, p_conditions,
          v_hash, now() + make_interval(days => greatest(1, p_expires_in_days)))
  RETURNING id INTO v_offer_id;

  -- 5. Devolver el raw token UNA vez (nunca persistido).
  RETURN jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'gig_id', v_gig, 'token', v_raw);
END;
$$;

-- WR-05 (regla dura del proyecto): REVOKE explícito por función — ALTER DEFAULT PRIVILEGES
-- es no-op en este managed Supabase. anon NUNCA; sólo authenticated.
REVOKE ALL ON FUNCTION public.staff_app_create_offer(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_app_create_offer(uuid,text,uuid,text,timestamptz,timestamptz,text,numeric,text,int) TO authenticated;
```

**Notas de seguridad (verificadas contra los patrones del repo):**
- `is_org_writer` está granteada authenticated-only (0003) y usa `auth.uid()` — dentro de SECURITY DEFINER `auth.uid()` sigue siendo el del caller JWT, así que el gate es real. [VERIFIED: staff_app_0003:169-172 + get_public_offer/provision_member usan auth.uid() igual]
- Dentro de SECURITY DEFINER la RLS de las tablas NO aplica (el owner de la función es superuser-ish), por eso hay que **validar org a mano** en pasos 2/3 — igual que register_applicant fuerza organization_id.
- `extensions.gen_random_bytes` / `extensions.digest` schema-qualified: obligatorio, igual que 0003. [VERIFIED]
- El raw token vuelve SÓLO en el jsonb de retorno; el server action lo usa para armar el link y lo descarta. Nunca va a la DB ni a un log.

**Confidence:** HIGH para la forma (todo verificado en migraciones). **LOW-flagged:** confirmar en la DB en vivo que `extensions.gen_random_bytes` y `extensions.digest` existen bajo `extensions` (Fase 1 los usó, así que casi seguro — pero es lo único que la migración nueva no puede asumir a ciegas). Query de verificación:
```sql
SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname IN ('gen_random_bytes','digest') ORDER BY 1,2;
```

## Q2 — Gigs pick-or-create (VERIFICADO)

### Forma de `staff_app.gigs` [VERIFIED: staff_app_0002_core_tables.sql:50-61]
```
id uuid PK · organization_id uuid NOT NULL · title text NOT NULL · starts_at/ends_at timestamptz
· timezone text default 'America/Argentina/Buenos_Aires' · venue_name text · hito_event_id uuid (NULL esta fase)
· status text default 'draft' · created_at timestamptz
```
**Mapeo D-04 (name, fecha, lugar, rol):** name→`title`, fecha→`starts_at`(/`ends_at`), lugar→`venue_name`, **rol→`offers.role`** (el gig no tiene rol; el rol es de la oferta). `hito_event_id` queda NULL (Fase 6).

### Listar gigs existentes (pick) — NO existe vista de gigs todavía
0007 creó vistas para profiles/my_membership/crew_busy pero **NO** para gigs. Fase 3 debe agregarla (mismo patrón security_invoker):
```sql
CREATE VIEW public.staff_app_gigs WITH (security_invoker = true) AS
  SELECT id, title, starts_at, ends_at, venue_name, status, hito_event_id, organization_id
  FROM staff_app.gigs;
GRANT SELECT ON public.staff_app_gigs TO authenticated;   -- authenticated ya tiene base SELECT en gigs (0007:26)
REVOKE ALL ON public.staff_app_gigs FROM anon;            -- default-privileges de public auto-grantean anon → REVOKE obligatorio
```
El server component lista con `supabase.from('staff_app_gigs').select('id,title,starts_at,venue_name').order('starts_at',{ascending:false})` — RLS `is_org_member` scopea por org. [VERIFIED: patrón idéntico a staff_app_profiles en 0007]

### Quick-create
Recomendado: **NO** una RPC separada de gig — foldearlo dentro de `staff_app_create_offer` (params `p_gig_title/starts_at/ends_at/venue`) como muestra Q1. Ventaja: gig+offer en una sola transacción → sin race (Pitfall 5), un solo round-trip, sin gig huérfano si el insert de offer falla. Para pick-or-create en un form: un `<Select>` de gigs existentes + una opción "Crear gig nuevo" que muestra los 4 campos (title/fecha/lugar).

**Confidence:** HIGH.

## Q3 — Email (nodemailer + react-email)

### Transporte + env vars [VERIFIED: somosder-web/src/lib/email.js + HITO lib/email/mailer.ts]
Transporte nodemailer idéntico en ambos repos:
```ts
nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE ?? "true") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,  // Ferozo es lento → fallar rápido
});
```
`from` header: `"${MAIL_FROM_NAME || 'SOMOS DER'}" <${MAIL_FROM_ADDRESS || SMTP_USER}>`.

**Env vars que hay que agregar a `.env.local` + Vercel** (hoy `.env.local` sólo tiene SUPABASE_*/SITE_URL/VERCEL_OIDC/LABURO_DEV_BYPASS — [VERIFIED: .env.local keys]):
| Var | Valor (reusar de somosder-web/accesos) | Notas |
|-----|----------------------------------------|-------|
| `SMTP_HOST` | ej `c2630345.ferozo.com` | mismo Ferozo de DER |
| `SMTP_PORT` | `465` | |
| `SMTP_SECURE` | `true` | |
| `SMTP_USER` | ej `contacto@somosder.com.ar` | `email.js` lo baja a lowercase para evitar 535 por casing |
| `SMTP_PASSWORD` | (secreto) | |
| `MAIL_FROM_NAME` | `SOMOS DER` | o "LABURO · SOMOS DER" a gusto de Franco |
| `MAIL_FROM_ADDRESS` | = SMTP_USER | |

`somosder-web` NO es git repo (los valores están sólo en su Vercel + `.env`), así que los valores reales hay que copiarlos del panel de Vercel de somosder-web/accesos. [VERIFIED: STATE.md nota "somosder-web is NOT a git repo"] → tarea de USER-SETUP.

### Mailer portado — recomendación
Portar `HITO-by-DER-main/lib/email/mailer.ts` a `lib/email/mailer.ts` de LABURO tal cual, con `import "server-only"` arriba. Ese archivo YA devuelve `MailResult {ok, channel, error}` y **nunca tira** — es exactamente el "estado honesto" que pide D-02. Dejar `RESEND_API_KEY` sin setear → `resendEnabled()` es false → cae directo a la rama SMTP. No instalar Resend. [VERIFIED: HITO mailer.ts:143-175]

### react-email → HTML → nodemailer
```tsx
// components/emails/offer-email.tsx  (react-email component)
import { Html, Body, Container, Heading, Text, Button, Section } from "@react-email/components";
export function OfferEmail({ firstName, gigTitle, role, amount, conditions, whenText, link }: {...}) {
  return (
    <Html lang="es">
      <Body style={{ background:"#0a0f1f", color:"#f2f5fa", fontFamily:"..." }}>
        <Container>
          <Heading>Hola {firstName}, tenés una propuesta de laburo</Heading>
          <Text>{role} · {gigTitle}{whenText ? ` · ${whenText}` : ""}</Text>
          {amount ? <Text>Pago informativo: {amount}</Text> : null}
          {conditions ? <Text>{conditions}</Text> : null}
          <Section><Button href={link}>Ver la oferta</Button></Section>
        </Container>
      </Body>
    </Html>
  );
}
```
```ts
// dentro del server action:
import { render } from "@react-email/components";   // o "@react-email/render"
const html = await render(<OfferEmail {...props} />);   // ⚠️ v2 render es ASYNC → await
const result = await sendMail({ to: candidateEmail, subject: `Tenés una propuesta · ${gigTitle}`, html });
```

### Dónde poner el envío (Next 15.5 App Router)
- Un **server action `'use server'`** member-gated (patrón de `cv-actions.ts`: primero `staff_app_my_membership.maybeSingle()`, si no hay → `throw new Error("forbidden")`). El action: (1) valida input (zod recomendado; NO está instalado aún — o validación manual), (2) llama `supabase.rpc('staff_app_create_offer', …)` con el **cliente autenticado** (`lib/supabase/server.ts`), (3) arma `link = \`${process.env.SITE_URL}/o/${res.token}\``, (4) `render()` + `sendMail()`, (5) devuelve `{ offerId, link, waLink, mail: result }` a la UI.
- **Runtime Node obligatorio** (nodemailer no anda en edge). Los server actions corren en Node por default en Next 15.5 — no forzar edge. Si se usara un Route Handler en su lugar, agregar `export const runtime = "nodejs"` y `export const maxDuration = 60` (HITO usa `maxDuration=60` por lo lento de Ferozo).
- **El envío NO usa service-role.** La RPC creadora corre con el JWT del caller (gate is_org_writer). El service-role client (`lib/supabase/admin.ts`) NO hace falta en esta fase.

### Deliverability (nota, no acción esta fase)
SPF/DKIM es explícitamente Fase 5 (SHIP-01). [VERIFIED: REQUIREMENTS SHIP-01 + STATE "Ferozo SMTP deliverability untested"]. Relevante ahora sólo: (a) el `from` debe ser una casilla real de somosder.com.ar (no un dominio ajeno) para no romper alignment; (b) el link `/o/[token]` va a devolver 404 hasta Fase 4 — el email se puede mandar igual, pero para una prueba real de punta a punta conviene ordenar Fase 3→4 antes de mandarle a un candidato real (ver Open Questions).

**Confidence:** HIGH para transporte/mailer (código verificado en 2 repos). MEDIUM para react-email exacto (API verificada por versión npm, no ejecutada en este repo).

## Q4 — wa.me + glifo oficial

### Deep link [VERIFIED: lib/wa.ts ya existe]
`lib/wa.ts` ya tiene `waLink(phone, text)` → `https://wa.me/${digitsOnly}?text=${encodeURIComponent(text)}` (wa.me NO quiere el `+`). Reusable tal cual para el mensaje de oferta. **Pero WR-06 (STATE.md):** `e164()` sólo saca no-dígitos, NO normaliza teléfonos AR (0 inicial / falta código país 54). Para un candidato con teléfono `011 15…` el link puede salir mal. Fase 3 debería arreglar WR-06 (prefijar `54` si falta) ya que acá el wa.me es load-bearing, no un extra.

Mensaje pre-armado (voseo, sin em dash): `\`Hola ${primerNombre}, te paso la propuesta para ${role} en ${gigTitle}. Mirá los detalles y confirmá acá: ${link}\``.

### Glifo oficial — REUSAR, no crear [VERIFIED: somosder-web/src/components/WhatsAppFab.astro:28-30]
D-03 exige el glifo REAL. El actual `quick-actions.tsx` de Fase 2 usa `lucide-react` `MessageCircle` (icono GENÉRICO) — **eso NO cumple D-03 para el botón de oferta**. El glifo oficial ya existe en el repo hermano `somosder-web/src/components/WhatsAppFab.astro`: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16.004 0C7.17 0 .002 7.168…"/></svg>` con fondo `#25d366`. Extraer ese mismo `<path>` a un componente React `components/icons/whatsapp-glyph.tsx` y usarlo en el botón de oferta con `bg-[#25D366]` y `text-white`. Copiar el `viewBox="0 0 32 32"` y el `d` verbatim (está en WhatsAppFab.astro línea 29). No inventar un SVG nuevo.

**Nota:** el botón "Escribir por WhatsApp" de Fase 2 (`quick-actions.tsx`) es informal (contacto), el de Fase 3 es la OFERTA. Franco quiere el glifo oficial al menos en el de oferta (D-03). Considerar unificar y meter el glifo oficial también en el de Fase 2 para consistencia (Claude's discretion).

**Confidence:** HIGH.

## Q5 — Shell integration

### Entry point [VERIFIED: app/(app)/staff/[id]/page.tsx]
El perfil de candidato Fase 2 (`app/(app)/staff/[id]/page.tsx`) es un server component que ya trae la fila del candidato y renderiza `<QuickActions>` sticky abajo. El "Crear oferta" cuelga de acá. Dos opciones:
1. Botón primario "Crear oferta" en el perfil → navega a `/staff/[id]/oferta` (nueva ruta, server component con el form) — recomendado (mobile-first, pantalla dedicada para el form pick-or-create).
2. Un Base UI Dialog/bottom-sheet desde el perfil (patrón `filtros-sheet.tsx` de Fase 2).

### Clientes Supabase + patrón de server action a EXTENDER (no reescribir) [VERIFIED]
- `lib/supabase/server.ts` — cliente autenticado SSR (cookies). Úsalo en el server component del form y en el action para la RPC. [VERIFIED]
- `lib/supabase/admin.ts` — service-role, `server-only`. NO hace falta esta fase (la RPC creadora corre con JWT). [VERIFIED]
- Patrón de action member-gated: `app/(app)/staff/[id]/cv-actions.ts` `signCv` es el molde exacto — `'use server'` → check `staff_app_my_membership.maybeSingle()` → si no, `throw`. Copiar ese gate al `createOffer` action. [VERIFIED: cv-actions.ts:31-40]
- El `(app)/layout.tsx` ya bloquea no-miembros (defensa en profundidad); el action igual re-chequea (nunca confiar sólo en el layout). [VERIFIED: layout.tsx:27-34]

### Tokens de diseño a reusar (D-01) [VERIFIED: app/globals.css @theme]
`surface-0/1/2`, `border`, `accent (#2f80ff)`, `box-glow` utility, `fg/fg-muted/fg-subtle`, spacing `xs..3xl`, `text-heading/body/label`, `font-baloo` (lockup). Inputs: 16px (evita zoom iOS), targets 44px+, safe-area en sticky bars — todo ya establecido en UI-SPEC Fase 2. Sin diseño nuevo (D-01).

**Confidence:** HIGH.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generación/entropía del token | `crypto.randomUUID()` app-side + hash en Node | `extensions.gen_random_bytes(32)` dentro de la RPC | Server-authoritative, matchea Fase 1 byte a byte, raw nunca sale de la transacción salvo el retorno |
| Estado honesto de envío | try/catch a mano + flags | Portar `HITO mailer.ts` (`MailResult`, nunca tira) | Ya resuelto y probado en HITO; D-02 exige exactamente eso |
| Glifo WhatsApp | Dibujar/bajar un SVG nuevo | `<path>` de `WhatsAppFab.astro` | D-03 exige el oficial; ya está en el repo hermano |
| Deep link wa.me | Concatenar URL a mano | `lib/wa.ts` `waLink()` (+ fix WR-06) | Ya existe; sólo falta normalizar AR |
| Insert a offers desde el cliente | Exponer `staff_app` en PostgREST o service-role suelto | RPC pública SECURITY DEFINER `staff_app_create_offer` | Patrón establecido (register_applicant/provision_member); mantiene RLS y service-role confinados |
| HTML del email | Template string gigante | react-email component + `render()` | D-02 locked; componible y mantenible |

**Key insight:** todo lo difícil de esta fase (token, hash, atomicidad, honest-mail, glifo) YA está resuelto en el codebase o en los repos hermanos. Fase 3 es ensamblado, no invención.

## Runtime State Inventory

No aplica en sentido de rename/refactor, pero SÍ hay estado que la fase CREA por primera vez en producción:
| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Primeras filas reales en `staff_app.gigs` y `staff_app.offers` (hasta ahora vacías tras el harness cleanup de Fase 1) | Ninguna migración de datos; sólo inserts nuevos via RPC |
| Live service config | SMTP Ferozo — credenciales viven en el Vercel de somosder-web/accesos, NO en git | Copiar 7 env vars a `.env.local` + Vercel de LABURO (USER-SETUP) |
| OS-registered state | None — verificado (app en Vercel, sin cron esta fase; reminder cron es Fase 5 XTRA-02) | none |
| Secrets/env vars | `SMTP_*`, `MAIL_FROM_*` nuevos; `SUPABASE_SERVICE_ROLE_KEY` ya existe pero NO se usa esta fase | Agregar SMTP vars |
| Build artifacts | react-email + nodemailer nuevos en `node_modules`/lockfile | `npm install` + commit del lockfile |

## Common Pitfalls

### Pitfall 1: Insert directo a `offers` desde el cliente autenticado
**Qué sale mal:** el dev asume que como existe la policy `offers_write (is_org_writer)` puede `supabase.from('offers').insert(...)`. Falla con PGRST106 (staff_app no expuesto) y además 0002 hizo `REVOKE ALL FROM authenticated`.
**Cómo evitar:** SIEMPRE via la RPC pública SECURITY DEFINER. [VERIFIED: staff_app_0002:124-127 + PGRST106 en STATE]
**Warning sign:** cualquier `.from('offers')` o `.from('gigs').insert` en el cliente.

### Pitfall 2: Olvidar el REVOKE explícito en la nueva RPC/vista (WR-05)
**Qué sale mal:** `ALTER DEFAULT PRIVILEGES` es NO-OP en este managed Supabase, y el public schema auto-grantea anon/authenticated/service_role a toda vista/función nueva. Sin REVOKE explícito, anon queda con acceso.
**Cómo evitar:** por-función `REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;` y por-vista `REVOKE ALL ... FROM anon;`. [VERIFIED: STATE WR-05 + 0007:64-66,131-133]
**Warning sign:** `get_advisors(security)` con un finding nuevo, o anon pudiendo llamar la RPC.

### Pitfall 3: RLS no aplica dentro de SECURITY DEFINER
**Qué sale mal:** confiar en que la RLS filtra el gig/candidato dentro de la RPC → un writer podría pasar un gig_id/profile_id de otra org.
**Cómo evitar:** validar `organization_id = v_org` a mano en cada SELECT/INSERT (como hace register_applicant forzando org). Ver Q1 pasos 2-3.
**Warning sign:** la RPC inserta sin un `WHERE organization_id = v_org` previo.

### Pitfall 4: `render()` de react-email v2 es async
**Qué sale mal:** `const html = render(<OfferEmail/>)` (sin await) → `html` es una Promise, nodemailer manda `[object Promise]` como cuerpo.
**Cómo evitar:** `const html = await render(...)`. [VERIFIED: @react-email/render@2.0.6 bundled]
**Warning sign:** email llega vacío o con "[object Promise]".

### Pitfall 5: Race en quick-create de gig
**Qué sale mal:** crear gig en un request y la oferta en otro → gig huérfano si el segundo falla, o doble gig por doble-tap.
**Cómo evitar:** gig+offer en UNA transacción dentro de `staff_app_create_offer` (Q1). Deshabilitar el botón submit mientras el action está en vuelo.
**Warning sign:** dos RPC separadas `create_gig` + `create_offer`.

### Pitfall 6: Success silencioso cuando Ferozo falla (viola D-02)
**Qué sale mal:** el action inserta la oferta OK pero el SMTP tira (Ferozo lento/caído) y la UI dice "enviada".
**Cómo evitar:** el mailer devuelve `MailResult.ok=false` → la UI muestra "Oferta creada, pero el email falló" + ofrecer el wa.me como fallback (el token/link ya existe). NUNCA asumir 250-OK. La oferta YA está en la DB (status 'sent') aunque el mail falle — el candidato igual puede recibir el link por wa.me. [VERIFIED: HITO mailer patrón + D-02]
**Warning sign:** toast de éxito sin chequear `result.ok`.

### Pitfall 7: Re-envío de oferta y token
**Qué sale mal:** Franco toca "enviar de nuevo" y se crea una segunda oferta (segundo token, segunda fila) para el mismo candidato+gig, o se pisa el status 'viewed'.
**Cómo evitar (decidir en plan):** para v1 lo más simple es "re-enviar" = re-mandar el MISMO link (no crear oferta nueva) — pero el raw token no se puede recuperar (sólo el hash está guardado). Entonces "re-enviar" debe re-usar el link que la UI ya tiene en memoria de la creación, o crear una oferta nueva conscientemente. NO hay UNIQUE(gig,profile) en offers (sí en crew), así que se pueden crear duplicados. **Recomendación:** botón único "Crear y enviar"; el "reenviar por WhatsApp" usa el link devuelto en la creación (misma sesión). Reenvío por email posterior = fuera de scope v1 o Fase 5.
**Warning sign:** intentar leer el raw token de una oferta ya creada (imposible por diseño — sólo hash).

### Pitfall 8: `/o/[token]` todavía no existe (Fase 4)
**Qué sale mal:** mandar el email y el candidato clickea → 404.
**Cómo evitar:** consciente de que el destino se construye Fase 4. Para la PRUEBA real de punta a punta, no ofertar a un candidato real hasta Fase 4. El plan puede construir/testear Fase 3 con el link apuntando a la ruta futura sin bloquear. [VERIFIED: CONTEXT deferred + ROADMAP Fase 4]
**Warning sign:** SHIP-02 (hire real) se intenta antes de Fase 4 — es Fase 5 por algo.

## Code Examples

### Server action (esqueleto) — member-gated, honest state
```ts
// app/(app)/staff/[id]/offer-actions.ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email/mailer";
import { render } from "@react-email/components";
import { OfferEmail } from "@/components/emails/offer-email";
import { waLink } from "@/lib/wa";

export async function createAndSendOffer(input: {
  staffProfileId: string; role: string; email: string; telefono: string; firstName: string;
  gigId?: string; gigTitle?: string; gigStartsAt?: string; gigVenue?: string;
  amount?: number; conditions?: string;
}) {
  const supabase = await createClient();
  // 1. Gate de membresía (defensa en profundidad; la RPC igual chequea is_org_writer).
  const { data: m } = await supabase.from("staff_app_my_membership").select("role").maybeSingle();
  if (!m) throw new Error("forbidden");

  // 2. Crear oferta + gig (atómico) → raw token una vez.
  const { data, error } = await supabase.rpc("staff_app_create_offer", {
    p_staff_profile_id: input.staffProfileId, p_role: input.role,
    p_gig_id: input.gigId ?? null, p_gig_title: input.gigTitle ?? null,
    p_gig_starts_at: input.gigStartsAt ?? null, p_gig_venue: input.gigVenue ?? null,
    p_amount: input.amount ?? null, p_conditions: input.conditions ?? null,
  });
  if (error || !data?.ok) return { ok: false as const, reason: data?.reason ?? error?.message };

  const link = `${process.env.SITE_URL}/o/${data.token}`;
  const summary = `${input.role}${input.gigTitle ? ` en ${input.gigTitle}` : ""}`;
  const wa = waLink(input.telefono,
    `Hola ${input.firstName}, te paso la propuesta para ${summary}. Confirmá acá: ${link}`);

  // 3. Email honesto (nunca tira).
  const html = await render(<OfferEmail firstName={input.firstName} role={input.role}
    gigTitle={input.gigTitle ?? ""} amount={input.amount} conditions={input.conditions} link={link} />);
  const mail = await sendMail({ to: input.email,
    subject: `Tenés una propuesta de laburo${input.gigTitle ? ` · ${input.gigTitle}` : ""}`, html });

  return { ok: true as const, offerId: data.offer_id, link, waLink: wa, mail };
}
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| SMTP Ferozo (host/user/pass) | OFER-02 email | ✗ (no en `.env.local` de LABURO) | — | wa.me link (OFER-03) sigue funcionando aunque el mail falle |
| nodemailer | envío SMTP | ✗ (no instalado) | `^9.0.3` disponible npm | — |
| @react-email/components | render del email | ✗ (no instalado) | `^1.0.12` disponible npm | template string (pero viola D-02) |
| `extensions.gen_random_bytes`/`digest` | token en la RPC | ✓ (Fase 1 los usó) | — | — |
| `SITE_URL` | armar el link | ✓ (`.env.local`) | — | — |
| `/o/[token]` route | destino del link | ✗ (Fase 4) | — | link válido pero 404 hasta Fase 4 |

**Missing dependencies with no fallback:** SMTP creds — sin ellas el email no sale (pero la oferta se crea y el wa.me funciona; `smtpEnabled()` false → `MailResult.ok=false, channel:'none'` → UI honesta). Tarea de USER-SETUP.
**Missing dependencies with fallback:** el destino `/o/[token]` (Fase 4) — no bloquea construir/testear Fase 3.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth existente (Supabase); el action re-chequea `staff_app_my_membership` |
| V4 Access Control | yes | `is_org_writer` gate DENTRO de la RPC SECURITY DEFINER + validación org manual (RLS no aplica en definer) |
| V5 Input Validation | yes | Validar role/gig/amount en el action (zod opcional) + la RPC valida org de gig/profile; escapar todo lo que va al HTML del email |
| V6 Cryptography | yes | Token `gen_random_bytes(32)` (256-bit) + sha256 at rest — NUNCA hand-roll; ya establecido Fase 1 |
| V7 Errors/Logging | yes | NO loguear el raw token; `MailResult.error` es seguro de mostrar |

### Known Threat Patterns for este stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| anon llama la RPC creadora | Elevation | REVOKE FROM anon explícito (WR-05); GRANT sólo authenticated |
| Writer de otra org pasa gig_id ajeno | Tampering | Validar `organization_id = v_org` en la RPC (RLS no aplica en definer) |
| Raw token en logs/DB | Info disclosure | Sólo `token_hash` persiste; raw sólo en el retorno jsonb + el link; no loguear |
| HTML injection en el email (nombre/conditions del candidato) | Tampering/XSS-in-email | react-email escapa por default en children; nunca `dangerouslySetInnerHTML` con datos del pool |
| Success silencioso en fallo SMTP | Repudiation | `MailResult.ok` chequeado; estado honesto (D-02) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `extensions.gen_random_bytes` y `extensions.digest` existen bajo `extensions` en la DB en vivo | Q1 | Alto — la RPC creadora no compila; mitigado: Fase 1 (0003) YA los usa, así que casi seguro OK. Query de verificación provista. |
| A2 | Los valores SMTP de somosder-web sirven tal cual para LABURO (misma casilla DER) | Q3 | Medio — si Franco quiere un `from` distinto (ej. rrhh@) hay que ajustar; no bloquea el código |
| A3 | `@types/nodemailer@^6` es la versión correcta | Standard Stack | Bajo — verificar en install |
| A4 | react-email `render()` es async en la versión que se instale (v2 bundled) | Q3/Pitfall 4 | Medio — si se pinnea una v1 vieja sería sync; verificar tras install |
| A5 | No hace falta zod (no instalado); validación manual alcanza para v1 | Q3/Security | Bajo — el plan puede decidir instalar zod (recomendado en CLAUDE.md stack) |

## Open Questions

1. **Orden de prueba real vs. Fase 4**
   - Qué sabemos: `/o/[token]` se construye en Fase 4; el email se puede mandar en Fase 3.
   - Qué falta: si Franco quiere probar mandándose una oferta a sí mismo en Fase 3, el link dará 404.
   - Recomendación: construir/testear Fase 3 con el link apuntando a la ruta futura; la prueba end-to-end real (SHIP-02) es Fase 5, después de Fase 4. No ofertar a un candidato real hasta Fase 4.

2. **Re-envío / duplicados de oferta**
   - Qué sabemos: `offers` NO tiene UNIQUE(gig,profile); el raw token no se puede recuperar (sólo hash).
   - Qué falta: política de v1 para "reenviar".
   - Recomendación: "reenviar por WhatsApp" usa el link devuelto en la creación (misma sesión); no crear ofertas nuevas por re-tap; considerar deshabilitar submit en vuelo. Reenvío por email posterior → fuera de scope v1.

3. **`from` address definitivo**
   - Recomendación: preguntar a Franco si prefiere `contacto@` o una casilla `rrhh@`/`laburo@` para las ofertas (afecta reply-to y percepción). No bloquea; default = la casilla de somosder-web.

4. **zod sí/no**
   - CLAUDE.md recomienda zod v4 + resolvers v5; hoy no está instalado. Recomendación: instalarlo si el form crece; para v1 la validación en la RPC + checks manuales alcanzan.

## Project Constraints (from CLAUDE.md)
- **Cero gasto:** ningún servicio pago. → SMTP Ferozo (no Resend/SendGrid), wa.me (no WhatsApp Business API). [Respetado]
- **Seguridad:** RLS obligatoria; acceso público sólo via SECURITY DEFINER con search_path fijado. → La RPC creadora es authenticated-only (no público), pero sigue el mismo hardening (search_path fijo, REVOKE explícito WR-05). [Respetado]
- **Animaciones:** librería Motion (`motion/react`) — ya instalada; usar sparingly. [Respetado]
- **UX mobile-first:** form pick-or-create y estados en pantalla dedicada de teléfono. [Respetado]
- **Independencia de HITO:** `hito_event_id` NULL esta fase; cero escritura a HITO. [Respetado]
- **GSD workflow:** los edits van por un comando GSD (esta fase se planifica con /gsd-plan-phase). [Nota para el planner]

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/staff_app_0002_core_tables.sql` — forma exacta de offers/gigs/crew + REVOKE FROM authenticated
- `supabase/migrations/staff_app_0003_magic_link_rpcs.sql` — contrato del token (sha256, gen_random_bytes, statuses), grants, WR-05
- `supabase/migrations/staff_app_0007_read_layer.sql` — patrón de vista security_invoker + REVOKE anon + provision_member SECURITY DEFINER
- `.planning/phases/01-own-data-foundation/01-02-SUMMARY.md` — lifecycle probado + nota Fase 3
- `HITO-by-DER-main/lib/email/mailer.ts` — mailer con MailResult honesto (a portar)
- `somosder-web/src/lib/email.js` — transporte Ferozo + env vars
- `somosder-web/src/components/WhatsAppFab.astro:28-30` — glifo oficial WhatsApp (path + #25D366)
- `app/(app)/staff/[id]/cv-actions.ts` — patrón de server action member-gated
- `app/(app)/layout.tsx`, `lib/supabase/{server,admin}.ts`, `lib/wa.ts`, `app/globals.css` — shell/clients/tokens a extender
- npm registry (2026-07-16) — nodemailer 9.0.3, @react-email/components 1.0.12 (bundlea render 2.0.6)

### Secondary (MEDIUM confidence)
- `HITO-by-DER-main/app/api/proposals/accepted/route.ts` + `ProposalEditor.tsx` — patrón send + wa.me + toast en el análogo HITO

### Tertiary (LOW confidence)
- Existencia en vivo de `extensions.gen_random_bytes/digest` (inferida de que Fase 1 los usa; query de verificación provista)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versiones verificadas en npm; core ya en package.json
- Architecture (RPC creadora + vista + action): HIGH — todos los patrones verificados en migraciones aplicadas y código del repo
- Email wiring: HIGH transporte / MEDIUM react-email exacto (API por versión, no ejecutada acá)
- Pitfalls: HIGH — derivados de facts del repo (REVOKE, PGRST106, WR-05, sha256, render async)

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stack estable; re-verificar versiones npm si el install es después)
</content>
</invoke>
