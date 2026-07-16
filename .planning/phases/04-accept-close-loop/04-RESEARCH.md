# Phase 4: Accept & Close the Loop - Research

**Researched:** 2026-07-16
**Domain:** Página pública unauth por token (Next.js 15.5 App Router) + RPCs SECURITY DEFINER de Supabase (`staff_app`), cierre del loop de contratación
**Confidence:** HIGH (todo verificado contra el repo y las migraciones aplicadas; el único punto que requiere aplicar SQL en vivo es la migración de wrappers que se detalla abajo)

## Summary

La Fase 4 construye la cara pública del link mágico: `/o/[token]`, una página mobile-first sin cuenta donde el candidato ve la oferta y la acepta/rechaza por POST explícito. Toda la lógica de datos (validación de token, expiry, aceptación atómica con creación de `crew`, idempotencia) **ya existe y está probada en SQL** en la migración `staff_app_0003_magic_link_rpcs` (Fase 1). El trabajo de la Fase 4 es sobre todo frontend.

**PERO hay un hallazgo que cambia el plan respecto de lo que asume el CONTEXT.md (D-01):** las tres RPCs viven en el schema `staff_app`, que **NO está expuesto por PostgREST** (error `PGRST106`, verificado repetidamente en Fases 1-3). El `GRANT EXECUTE ... TO anon` sobre esas funciones es necesario pero **no suficiente**: el cliente anon **no puede** llamar `supabase.rpc('accept_offer')` porque el schema no está en la config de esquemas expuestos del proyecto compartido con HITO. Por eso **la Fase 4 SÍ necesita una migración chica**: tres wrappers `public.*` que reenvíen a las RPCs de `staff_app` y estén otorgados a `anon`, exactamente como la Fase 3 puso `public.staff_app_create_offer` en `public` en vez de en `staff_app`. Esto NO es la "refinación de reason-code" que el CONTEXT.md consideraba opcional: es el requisito estructural que hace que el link mágico funcione. El propio header de la migración 0003 lo ordena literalmente.

Segundo hallazgo: STAT-01 (Franco ve el estado de la oferta) también necesita una vista de lectura nueva. No existe ninguna vista sobre `offers`, y `authenticated` no tiene `SELECT` sobre `staff_app.offers`. Ambas cosas (wrappers anon + vista de offers) se resuelven en **una sola migración `staff_app_0009`** aplicada en vivo por el orquestador.

**Primary recommendation:** Plan de 2 olas. **Ola 0 / bloqueante:** migración `staff_app_0009` con (a) tres wrappers `public` anon-callable para `get_public_offer`/`accept_offer`/`decline_offer` y (b) una vista `public.staff_app_offers` (security_invoker) + `GRANT SELECT ON staff_app.offers TO authenticated` para STAT-01. Luego: página pública `app/o/[token]/page.tsx` (fuera del grupo `(app)`, con `/o` agregado a los public paths del middleware, GET seguro que renderiza + flipea a `viewed`), Server Actions POST para aceptar/rechazar, y el reflejo de estado en `/staff/[id]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (reuse existing RPCs):** La página pública usa las RPCs SECURITY DEFINER de Fase 1 (migración 0003): `get_public_offer(p_token)` (lee + flipea `sent`→`viewed` en el primer hit), `accept_offer(p_token)` (valida token+expiry+status, flipea a `accepted`, inserta `crew` atómicamente `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING`), `decline_offer(p_token)`. Llamarlas con el cliente ANON desde la ruta pública. NO escribir un path nuevo de create/accept. Verificar firmas/returns exactos antes de planificar. **[NOTA DEL RESEARCH: se cumple reusando las RPCs, pero se acceden a través de wrappers `public` porque `staff_app` no es alcanzable por el cliente anon vía PostgREST. Ver hallazgo estructural.]**
- **D-02 (no state-changing GET):** ver la oferta es un GET seguro (llama `get_public_offer`, que sólo flipea a `viewed` — efecto lateral aceptable). Aceptar/rechazar DEBE ser un **POST** explícito (Server Action o Route Handler), nunca un GET, para que los bots de preview de email/WhatsApp no disparen la aceptación.
- **D-03 (idempotency / already-accepted):** `accept_offer` sobre un token ya aceptado o vencido devuelve `{ok:false, reason:'invalid_or_expired'}` (guard de un solo uso). La página pública DEBE distinguir y mensajear con claridad: un estado propio "esta oferta ya fue aceptada" / "el link venció", NO un error genérico feo. Considerar si `accept_offer` necesita un reason code distinto (`already_accepted` vs `expired`) — si un cambio de código ayuda, es una migración chica de `staff_app` (aplicada en vivo por el orquestador; WR-05 REVOKE explícito). Preferir manejarlo con el reason devuelto + lectura del status de la oferta si es posible, sin migración.
- **D-04 (HITO bridge OUT of scope):** ACPT-03 menciona el puente a HITO (BRDG-03), pero el puente está diferido a **Fase 6**, y los gigs nunca llevan un `hito_event_id` no-NULL hasta entonces. Así que Fase 4 = creación de crew **sólo en la app**. Sin llamada a HITO. Marcar la costura pero no construirla.
- **D-05 (design deferred):** tokens/componentes placeholder (igual que Fase 2/3). Es una página pública, sin auth, mobile-first (candidato en el teléfono), tiene que ser limpia y legible, pero sin reskin premium — eso es después de Fase 5.
- **D-06 (STAT-01 surface):** Franco ve el estado de la oferta (enviada / vista / aceptada / rechazada / vencida). `viewed` lo setea `get_public_offer`; `expired` es derivado (`now() > expires_at`). Mostrar el estado donde Franco ya mira — el perfil del candidato `/staff/[id]` (y/o la entrada de la oferta). Mínimo; un tablero completo de estado es Fase 5.
- **Copy:** voseo argentino, cálido, SIN em dash (regla dura). La página pública es de cara al candidato — cálida, clara, confiable.

### Claude's Discretion
(No hay una sección explícita de discreción en el CONTEXT.md; las decisiones de implementación de estructura de archivos, forma exacta de los wrappers y forma de la vista de offers quedan a criterio del planner dentro de las reglas de seguridad WR-05 del repo.)

### Deferred Ideas (OUT OF SCOPE)
- Puente a HITO en accept (BRDG-01/03) → Fase 6.
- Tablero de estado completo / dashboard → Fase 5 (STAT-01 acá es el reflejo mínimo de estado en el perfil/oferta).
- Reskin visual premium → después de Fase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACPT-01 | El candidato ve la oferta desde el link sin crear cuenta (página pública por token) | `get_public_offer` ya devuelve todo lo que la página necesita (rol, monto, condiciones, status, expires_at, gig title/fechas/venue, org name, first name del candidato) sin PII. Falta: wrapper `public` anon-callable + ruta `app/o/[token]` fuera del gate + `/o` en public paths. |
| ACPT-02 | Aceptar/rechazar con confirmación explícita por POST (bots de preview no disparan la aceptación) | GET renderiza + flipea `viewed` (benigno). Accept/decline = Server Action POST. `accept_offer`/`decline_offer` guardan `status IN ('sent','viewed') AND expires_at > now()`. |
| ACPT-03 | Al aceptar se crea el crew en la app atómicamente; segundo tap nunca duplica | `accept_offer` inserta `crew` en la misma transacción con `ON CONFLICT (gig_id, staff_profile_id) DO NOTHING` — idempotente, probado en SQL (harness caso 5). Sin llamada a HITO (D-04). |
| STAT-01 | Franco ve el estado de cada oferta (enviada / vista / aceptada / rechazada / vencida) | NO existe vista de offers y `authenticated` no tiene SELECT sobre `staff_app.offers`. Necesita `public.staff_app_offers` (security_invoker) + grant base, y derivar `vencida` de `now() > expires_at`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Validación de token / expiry / single-use | Database (RPC SECURITY DEFINER) | — | La seguridad vive en Postgres; el guard `status IN (...) AND expires_at > now()` no puede ser bypasseado desde el cliente. Ya construido en 0003. |
| Creación atómica de crew al aceptar | Database (RPC) | — | Una sola transacción = sin estado a medias. `ON CONFLICT DO NOTHING` = idempotencia. Ya construido. |
| Exposición de las RPCs al cliente anon | Database (wrappers `public`) | — | `staff_app` no es PostgREST-exposed; el único camino es un wrapper en `public` otorgado a `anon`. **Migración nueva (0009).** |
| Render de la oferta (GET) | Frontend Server (RSC) | — | Server Component que llama `get_public_offer` con el cliente anon. `dynamic = 'force-dynamic'` para que el flip a `viewed` corra siempre. |
| Aceptar / rechazar (POST) | Frontend Server (Server Action) | — | Mutación por POST explícito, nunca GET. El token es el secreto portador. |
| Mensajería de estado al candidato (ya aceptada / vencida) | Frontend Server | Database (re-lectura) | El estado se deriva de `offer.status` + `now() > expires_at`; ante `invalid_or_expired` en el POST, re-leer para mensajear preciso. |
| Reflejo de estado para Franco (STAT-01) | Frontend Server (RSC autenticado) | Database (vista security_invoker) | La vista `public.staff_app_offers` con RLS `is_org_member` scopea al org; el perfil `/staff/[id]` la lee. |

## Standard Stack

Sin dependencias nuevas. Todo el stack ya está instalado y en uso (verificado en `package.json` y en el código de Fase 2/3).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `^15.5.20` (verificado en package.json) | App Router: RSC público + Server Actions POST | Paridad HITO; Server Actions son la vía limpia para el POST anti-bot. |
| `react` | `19.1.0` | UI runtime | Requerido por Next 15.5. |
| `@supabase/ssr` | `^0.12.3` | Cliente Supabase cookie-based (server + browser) | Ya en uso en `lib/supabase/{server,client,middleware}.ts`. |
| `@supabase/supabase-js` | `^2.110.6` | `supabase.rpc(...)` a los wrappers públicos | El cliente anon es el que llama las RPCs por token. |
| `motion` | `^12.42.2` | Micro-interacción al aceptar (preferencia global del usuario) | Import desde `motion/react`. Usar con moderación en mobile (D-05). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Wrappers `public` anon-callable | Exponer el schema `staff_app` en la config de esquemas PostgREST del proyecto | RECHAZADO: el proyecto es COMPARTIDO con HITO (`luillpzfqzbpoqkgvjuw`, D-03). Cambiar `pgrst.db_schemas` afectaría a HITO y expondría TODO `staff_app` vía REST. Los wrappers son cirugía mínima y son el patrón ya establecido (0004/0007/0008). |
| Server Action para el POST | Route Handler `app/o/[token]/accept/route.ts` | Ambos válidos. Server Action con `<form>` es más simple y trae protección de origen POST-only de Next 15. Route Handler si se quiere una URL explícita. Recomendado: Server Action. |
| Reason-code nuevo (`already_accepted` vs `expired`) en `accept_offer` | Re-leer `get_public_offer` tras el fallo y derivar el estado | Recomendado NO tocar `accept_offer`. La re-lectura da el estado verdadero (accepted/declined/vencida) sin modificar una RPC ya probada y con `get_advisors` limpio. Ver Pitfall 1. |

**Installation:** Nada que instalar.

## Package Legitimacy Audit

No aplica: la Fase 4 no instala paquetes externos nuevos. Todo el stack ya está presente y auditado en fases previas.

## The Load-Bearing Finding: `staff_app` no es alcanzable por el cliente anon

**Verificado (HIGH):** En tres lugares del repo se documenta que `staff_app` NO está expuesto por PostgREST (`PGRST106`):
- `staff_app_0003` header (líneas 19-24): *"Phase 4 must EITHER add staff_app to the project's exposed-schemas config OR add thin public wrapper functions that call staff_app.get_public_offer/accept_offer/decline_offer."*
- `staff_app_0007` (líneas 8-11): *"PostgREST does NOT expose the `staff_app` schema (Phase 1 verified PGRST106)... surfaced through `public` security-invoker VIEWS."*
- `staff_app_0008` (líneas 16-19): *"staff_app is NOT PostgREST-exposed (PGRST106, verified Phase 1)... The only correct write door is a `public` SECURITY DEFINER RPC."*
- `app/auth/callback/route.ts` (líneas 11-13): *"NO intentar acceder al schema staff_app via PostgREST: no está expuesto y cualquier llamada falla con PGRST106 (probado en 01-03)."*

**Implicación directa:** `supabase.rpc('accept_offer', {...})` desde el cliente anon fallaría con PGRST106. El `GRANT EXECUTE ... TO anon` de 0003 es real pero inalcanzable sin exposición del schema. **Toda la Fase 3 escribió a través de `public.staff_app_create_offer` por exactamente esta razón.** La Fase 4 debe hacer lo mismo para el lado anon.

### Migración recomendada: `staff_app_0009_public_magic_link` (aplicada en vivo por el orquestador)

Dos partes. Los wrappers son la única forma correcta; la vista de offers cubre STAT-01.

**Parte A — tres wrappers `public` anon-callable.** Reenvían a las RPCs de `staff_app` (que ya son SECURITY DEFINER y hacen toda la seguridad). Firma del wrapper = firma que llama el cliente anon:

```sql
-- Wrapper de lectura (GET-safe). Devuelve el jsonb tal cual (o SQL NULL para token malo).
CREATE OR REPLACE FUNCTION public.staff_app_get_public_offer(p_token text)
RETURNS jsonb
LANGUAGE sql
VOLATILE                         -- el inner flipea sent->viewed; no marcar STABLE
SECURITY INVOKER                 -- anon ya tiene EXECUTE + USAGE sobre el inner (0003)
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.get_public_offer(p_token); $$;

CREATE OR REPLACE FUNCTION public.staff_app_accept_offer(p_token text, p_user_agent text)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.accept_offer(p_token, p_user_agent); $$;

CREATE OR REPLACE FUNCTION public.staff_app_decline_offer(p_token text)
RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = staff_app, public, pg_temp
AS $$ SELECT staff_app.decline_offer(p_token); $$;

-- WR-05: estos SÍ deben ser anon-callable (a diferencia de los otros wrappers public).
REVOKE ALL ON FUNCTION public.staff_app_get_public_offer(text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_accept_offer(text, text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_app_decline_offer(text)           FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_app_get_public_offer(text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_accept_offer(text, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_decline_offer(text)        TO anon, authenticated;
```

Nota de seguridad para el planner: `SECURITY INVOKER` es correcto y preferible aquí porque el inner ya es SECURITY DEFINER y anon ya tiene `EXECUTE` sobre el inner + `USAGE` sobre el schema `staff_app` (ambos otorgados en 0003). El wrapper no escala privilegios: sólo hace alcanzable la función. **Confirmar en vivo** con `get_advisors(security)` que no aparezca `function_search_path_mutable` nuevo (el `SET search_path` fijo lo previene) — mismo chequeo que en 0007/0008.

**Parte B — vista de offers para STAT-01.** No existe y `authenticated` no tiene SELECT sobre `staff_app.offers` (0007 otorgó SELECT sobre `staff_profiles`/`members`/`crew`/`gigs`, NO `offers`):

```sql
GRANT SELECT ON staff_app.offers TO authenticated;   -- requerido por el security_invoker

CREATE VIEW public.staff_app_offers WITH (security_invoker = true) AS
  SELECT o.id, o.gig_id, o.staff_profile_id, o.role, o.amount, o.conditions,
         o.status, o.expires_at, o.sent_at, o.viewed_at, o.responded_at,
         g.title AS gig_title, o.organization_id
  FROM staff_app.offers o
  JOIN staff_app.gigs g ON g.id = o.gig_id;
-- RLS offers_select (is_org_member) sobre la tabla base scopea filas al org del caller.

GRANT SELECT ON public.staff_app_offers TO authenticated;
REVOKE ALL ON public.staff_app_offers FROM anon;     -- WR-05: public default privileges auto-otorgan anon
```

**Instrucción para el orquestador:** aplicar `staff_app_0009` en vivo vía Supabase MCP `apply_migration` (los subagentes no tienen las tools MCP), correr un harness chico (crear oferta → `public.staff_app_accept_offer` como anon simulado devuelve `{ok:true}` + crea 1 crew; segundo call → `{ok:false, invalid_or_expired}`; `public.staff_app_offers` visible al writer, invisible a anon) y `get_advisors(security)` limpio. Persistir el archivo bajo `supabase/migrations/staff_app_0009_public_magic_link.sql`.

## RPC Contracts (exactos, desde migración 0003)

Todas en `staff_app`, todas SECURITY DEFINER, `SET search_path = staff_app, pg_temp`.

### `get_public_offer(p_token text) RETURNS jsonb` — VOLATILE
- **Token match:** devuelve
  ```json
  {"ok": true,
   "offer": {"role","amount","conditions","status","expires_at"},
   "gig":   {"title","starts_at","ends_at","venue"},
   "org":   {"name"},
   "applicant": {"first_name"}}
  ```
  Y si `status = 'sent'`, flipea a `viewed` + setea `viewed_at` (efecto lateral en GET, aceptable per D-02).
- **Token no match:** devuelve **SQL `NULL`** (no un `{ok:false}`). El código cliente recibe `data === null`.
- **CRÍTICO — NO chequea expiry:** una oferta vencida igual devuelve su payload con su status actual. El status NUNCA se auto-flipea a `'expired'` (no hay cron). Por eso la página debe derivar "vencida" de `now() > offer.expires_at` incluso cuando `status` sea `'sent'` o `'viewed'`.
- **PII-safe:** devuelve sólo `first_name` (via `split_part(nombre,' ',1)`) — nunca cv_url/email/telefono/documento ni otros postulantes. Ya cubre TODO lo que la página necesita renderizar (ACPT-01). No agregar campos.

### `accept_offer(p_token text, p_user_agent text) RETURNS jsonb`
- **Ojo — toma DOS argumentos:** `p_token` y `p_user_agent`. El cliente debe pasar ambos (el UA puede venir del header `user-agent`, o `''`).
- **Guard:** `token_hash = sha256(p_token)` AND `status IN ('sent','viewed')` AND `expires_at > now()`.
- **Éxito:** `INSERT INTO crew (...) ON CONFLICT (gig_id, staff_profile_id) DO NOTHING` + `UPDATE offers SET status='accepted', responded_at=now()`; devuelve `{"ok": true, "crew_id": <uuid>}`. Atómico (una transacción). Idempotente: segundo tap no inserta un segundo crew (harness caso 5).
- **Fallo (token malo / vencido / ya aceptado / ya rechazado):** `{"ok": false, "reason": "invalid_or_expired"}`. **Un único reason colapsa los cuatro casos** — no distingue "ya aceptada" de "vencida". Ver Pitfall 1 para la estrategia de mensajería.

### `decline_offer(p_token text) RETURNS jsonb`
- **Guard:** idéntico a accept.
- **Éxito:** `UPDATE offers SET status='declined', responded_at=now()`; devuelve `{"ok": true, "status": "declined"}`.
- **Fallo:** `{"ok": false, "reason": "invalid_or_expired"}`.

## Architecture Patterns

### System Architecture Diagram

```
                          Candidato (teléfono, SIN cuenta)
                                     │  abre el link del email/WhatsApp
                                     ▼
                    GET  /o/<raw-token>   (ruta pública, fuera de (app))
                                     │
        middleware.ts publicPaths ["/o", ...] ──► NO redirige a /login
                                     │
                app/o/[token]/page.tsx  (RSC, dynamic='force-dynamic')
                    cliente ANON ──► supabase.rpc('staff_app_get_public_offer', {p_token})
                                     │                     │
                                     │        public.staff_app_get_public_offer (INVOKER)
                                     │                     │  reenvía
                                     │        staff_app.get_public_offer (DEFINER)
                                     │           lee offer+gig+org+first_name
                                     │           si status='sent' → flip a 'viewed'
                                     ▼
                    ┌────────────────┴───────────────────────────┐
             data === null                          jsonb {ok:true, offer:{status,expires_at}, ...}
        "Link no válido"          derivar estado en el servidor:
                                    status='accepted'  → pantalla "Ya aceptaste ✅" (sin botones)
                                    status='declined'  → "Ya rechazaste"
                                    now()>expires_at    → "El link venció"
                                    else (activa)       → render oferta + <form> Aceptar / Rechazar
                                                                         │
                                              POST (Server Action, nunca GET) ──► anon
                                                        │
                          supabase.rpc('staff_app_accept_offer', {p_token, p_user_agent})
                          supabase.rpc('staff_app_decline_offer', {p_token})
                                                        │
                                    {ok:true, crew_id}   →  crew creado en la app (ACPT-03)
                                    {ok:false, invalid_or_expired} → re-leer get_public_offer
                                                                     y mostrar el estado real

  ── Lado Franco (autenticado, STAT-01) ──
  /staff/[id]  (RSC autenticado) ──► supabase.from('staff_app_offers').select(...).eq('staff_profile_id', id)
       RLS is_org_member scopea al org; derivar 'vencida' de now()>expires_at en el render
```

### Recommended Project Structure
```
app/
├── o/                          # NUEVO grupo público (fuera de (app), sin auth gate)
│   └── [token]/
│       ├── page.tsx            # RSC: get_public_offer + deriva estado + render
│       ├── offer-actions.ts    # 'use server': acceptOffer / declineOffer (POST)
│       └── accept-decline.tsx  # 'use client': <form> con botones + micro-anim motion
lib/supabase/
│   └── (reusar client.ts / server.ts — el anon key ya está en ambos)
supabase/migrations/
└── staff_app_0009_public_magic_link.sql   # wrappers anon + vista offers (aplica el orquestador)
```

### Pattern 1: Ruta pública fuera del gate + middleware
**What:** `/o/[token]` NO puede estar dentro del grupo `(app)` (su layout hace el gate de membresía). Va a nivel raíz: `app/o/[token]/`. Además, agregar `"/o"` al array `publicPaths` en `lib/supabase/middleware.ts`.
**Edit exacto** (`lib/supabase/middleware.ts` línea 37):
```typescript
// antes:
const publicPaths = ["/login", "/auth/callback", "/dev-login"];
// después:
const publicPaths = ["/login", "/auth/callback", "/dev-login", "/o"];
```
El check ya es `.startsWith(p)`, así que `/o/<cualquier-token>` matchea. El `matcher` del `middleware.ts` raíz ya excluye estáticos y no necesita cambios.

### Pattern 2: Cliente anon en el RSC público + force-dynamic
**What:** El Server Component usa el cliente server existente (`@/lib/supabase/server` → `createClient()`), que ya usa el anon key. En una ruta pública no hay usuario logueado: eso está bien, las RPCs son por token, no por JWT.
**CRÍTICO:** marcar la página como dinámica para que el flip `sent→viewed` corra en cada request y no se sirva un RSC cacheado:
```typescript
// app/o/[token]/page.tsx
export const dynamic = "force-dynamic";   // o import { unstable_noStore } de next/cache

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_get_public_offer", { p_token: token });
  if (!data) { /* "Este link no es válido" */ }
  // derivar estado (ver Pattern 3) y renderizar
}
```

### Pattern 3: Derivación de estado en el servidor (el corazón de D-03 + D-06)
**What:** A partir del jsonb de `get_public_offer`, decidir qué pantalla mostrar. NUNCA mostrar botones de aceptar si la oferta ya no está activa.
```typescript
const offer = data.offer;               // {status, expires_at, role, amount, conditions}
const expired = new Date(offer.expires_at).getTime() <= Date.now();
type View = "activa" | "aceptada" | "rechazada" | "vencida";
const view: View =
  offer.status === "accepted" ? "aceptada"
  : offer.status === "declined" ? "rechazada"
  : expired ? "vencida"          // status sigue 'sent'/'viewed' pero venció: derivar
  : "activa";
```
- `activa` → render de la oferta + `<form>` Aceptar / Rechazar.
- `aceptada` → pantalla cálida de confirmación ("Ya confirmaste, nos vemos ahí"). Sin botones.
- `rechazada` → "Ya rechazaste esta propuesta". Sin botones.
- `vencida` → "Este link venció. Escribinos por WhatsApp si seguís interesado/a". Sin botones.

### Pattern 4: POST vía Server Action (anti-bot) + re-lectura ante carrera
**What:** El accept/decline es un Server Action invocado desde un `<form action={...}>`. Los bots de preview hacen GET, no POST, así que no pueden disparar la aceptación (D-02). Next 15 valida el origen del POST del Server Action automáticamente.
```typescript
// offer-actions.ts
"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function acceptOffer(token: string) {
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent") ?? "";
  const { data } = await supabase.rpc("staff_app_accept_offer", { p_token: token, p_user_agent: ua });
  if (data?.ok) return { ok: true as const };
  // {ok:false, invalid_or_expired}: NO mostrar error genérico. Re-leer para el estado real (Pitfall 1).
  const { data: fresh } = await supabase.rpc("staff_app_get_public_offer", { p_token: token });
  return { ok: false as const, view: deriveView(fresh) };  // 'aceptada' | 'vencida' | 'rechazada' | 'invalido'
}
```
El componente cliente (`'use client'`) puede envolver el submit con `useTransition` + una micro-animación `motion/react` al confirmar.

### Anti-Patterns to Avoid
- **Poner `/o/[token]` dentro de `app/(app)/`:** heredaría el gate de membresía y redirigiría al candidato a `/login`. Debe ir a nivel raíz.
- **Llamar `supabase.rpc('accept_offer')` (schema `staff_app`) directo:** falla con PGRST106. Siempre a través del wrapper `public.staff_app_accept_offer`.
- **Aceptar/rechazar en un GET o en un Route Handler GET:** los bots lo dispararían. Sólo POST.
- **Mostrar `{ok:false, reason:'invalid_or_expired'}` como error crudo:** feo y confuso. Re-leer y mensajear el estado real.
- **Confiar en `offer.status === 'expired'` para detectar vencimiento:** ese valor del enum nunca se escribe (no hay cron). Derivar de `now() > expires_at`.
- **Cachear el RSC público:** sin `force-dynamic`, el flip a `viewed` puede no correr. 

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validación de token / expiry / single-use | Lógica en el server action | `accept_offer`/`decline_offer` (ya guardan todo en la RPC) | La seguridad no puede vivir en el cliente; ya está probada en SQL. |
| Creación de crew atómica + idempotente | INSERT manual desde el server action | `accept_offer` (ON CONFLICT DO NOTHING en la misma tx) | Un INSERT desde el cliente rompería atomicidad y RLS. |
| Hashing del token | Hashear en Node | La RPC hashea el `p_token` crudo con sha256 | El raw token va en la URL; la RPC lo matchea contra `token_hash`. |
| Alcanzar `staff_app` desde anon | Exponer el schema en PostgREST | Wrappers `public` (patrón 0004/0007/0008) | Exponer el schema afecta a HITO (proyecto compartido). |
| Estado "vencida" | Cron que flipea a 'expired' | Derivar `now() > expires_at` en el read | Cero costo, sin cron; el enum 'expired' queda para Fase 5/XTRA-02. |

**Key insight:** La Fase 4 es casi enteramente frontend + una migración de plomería (wrappers + vista). El planner NO debe re-implementar nada de la lógica de negocio: las tres RPCs ya son la única puerta y ya están verificadas.

## Runtime State Inventory

> No es una fase de rename/refactor, pero sí toca exposición PostgREST y RLS, así que vale documentar el estado en vivo relevante.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `staff_app.offers` filas creadas por Fase 3 (status 'sent' tras `staff_app_create_offer`). El enum status incluye 'expired' pero NUNCA se escribe (sin cron). | Ninguna migración de datos. La vista deriva 'vencida' en read. |
| Live service config | Config de esquemas expuestos de PostgREST del proyecto `luillpzfqzbpoqkgvjuw`: `staff_app` NO está en la lista (PGRST106). Vive en la config del proyecto Supabase, NO en git. | NO cambiar la config (afecta a HITO). Usar wrappers `public`. |
| OS-registered state | Ninguno. | Ninguna. |
| Secrets/env vars | `SITE_URL` (usado en `offer-actions.ts` para armar `${SITE_URL}/o/${token}`). El link ya se emite en Fase 3 y 404ea hasta que exista `/o/[token]`. | Confirmar que `SITE_URL` esté seteado en local (`.env.local`) y prod (Vercel) para que el link apunte al host correcto. |
| Build artifacts | Ninguno relevante. | Ninguna. |

**Grants en vivo a verificar (el orquestador, tras aplicar 0009):**
- `has_function_privilege('anon', 'public.staff_app_accept_offer(text,text)', 'EXECUTE') = true`
- `has_table_privilege('anon', 'public.staff_app_offers', 'SELECT') = false`
- `has_table_privilege('authenticated', 'staff_app.offers', 'SELECT') = true`
- `get_advisors(security)`: 0 findings nuevos vs baseline.

## Common Pitfalls

### Pitfall 1: El reason único `invalid_or_expired` colapsa cuatro casos distintos
**What goes wrong:** `accept_offer`/`decline_offer` devuelven el mismo `{ok:false, reason:'invalid_or_expired'}` para token inexistente, vencido, ya aceptado y ya rechazado. Mostrar un error genérico viola D-03 (mensajería cálida y precisa).
**Why it happens:** El guard SQL es una sola condición (`status IN ('sent','viewed') AND expires_at > now()`); no expone cuál sub-condición falló.
**How to avoid:** Estrategia recomendada SIN tocar la RPC: **re-leer `get_public_offer` tras el fallo** y derivar el estado real (`accepted`→"ya aceptaste", `declined`→"ya rechazaste", `now()>expires_at`→"venció", `null`→"link no válido"). Esto también cubre la carrera donde la oferta cambió de estado entre el render y el submit (otra pestaña, o venció en el medio). Sólo si el planner considera que la re-lectura es demasiado indirecta, se puede agregar reason codes distintos en `accept_offer` (migración WR-05), pero el research recomienda NO hacerlo: la re-lectura es más simple y no modifica una RPC probada.
**Warning signs:** El candidato ve "error" en vez de "ya confirmaste".

### Pitfall 2: `get_public_offer` NO chequea expiry
**What goes wrong:** Se asume que una oferta vencida "desaparece" o devuelve error. En realidad `get_public_offer` devuelve su payload con `status` intacto ('sent'/'viewed'), porque el status nunca se auto-flipea a 'expired'.
**Why it happens:** No hay cron de expiración (diferido a XTRA-02, Fase 5). El vencimiento es puramente derivado.
**How to avoid:** Derivar `expired = now() > offer.expires_at` en el servidor SIEMPRE, y priorizarlo por sobre el status para la vista `activa`. Si venció, no mostrar botones aunque el status siga 'viewed'.
**Warning signs:** Botones de aceptar visibles en una oferta vencida (que igual el POST rechazaría, pero da mala UX).

### Pitfall 3: `accept_offer` toma dos argumentos
**What goes wrong:** Llamar `supabase.rpc('staff_app_accept_offer', { p_token })` sin `p_user_agent` → error de firma / función no encontrada.
**Why it happens:** La firma es `accept_offer(p_token text, p_user_agent text)` (0003 línea 85). El wrapper debe reflejar los dos args.
**How to avoid:** Pasar siempre `{ p_token, p_user_agent }`. El UA puede salir de `headers().get('user-agent')` o ser `''`.

### Pitfall 4: RSC público cacheado no corre el flip a `viewed`
**What goes wrong:** Sin `dynamic='force-dynamic'`, Next puede servir un RSC cacheado y `get_public_offer` no corre por request → STAT-01 nunca refleja "vista".
**How to avoid:** `export const dynamic = "force-dynamic"` en `app/o/[token]/page.tsx`.

### Pitfall 5: Ruta dentro del grupo `(app)` → redirect a login
**What goes wrong:** Poner la página bajo `app/(app)/o/...` la mete bajo el layout con gate de membresía; el candidato sin cuenta es redirigido a `/login`.
**How to avoid:** `app/o/[token]/` a nivel raíz + `/o` en `publicPaths`.

### Pitfall 6: `hito_event_id` siempre NULL en Fase 4 → nada de puente
**What goes wrong:** Intentar disparar el puente a HITO al aceptar (ACPT-03 lo menciona).
**Why it happens:** ACPT-03 incluye BRDG-03, pero D-04 lo difiere a Fase 6; los gigs de Fase 3 se crean con `hito_event_id = NULL` (verificado en `staff_app_0008` y en el summary 03-01).
**How to avoid:** `accept_offer` sólo crea crew en la app. No agregar ninguna llamada a HITO. Marcar la costura en un comentario, no construirla.

### Pitfall 7: Fuga de PII en la página pública
**What goes wrong:** Agregar email/teléfono/CV del candidato a la vista pública "para completar".
**How to avoid:** `get_public_offer` ya devuelve sólo `first_name` + oferta/gig/org. Renderizar exactamente eso; no agregar más campos ni una segunda query.

## Code Examples

### Reflejo de estado STAT-01 en `/staff/[id]` (lado Franco)
```typescript
// dentro de app/(app)/staff/[id]/page.tsx, tras cargar el perfil
const { data: offers } = await supabase
  .from("staff_app_offers")          // vista nueva (0009), RLS is_org_member scopea al org
  .select("id,role,gig_title,status,expires_at,sent_at,viewed_at,responded_at")
  .eq("staff_profile_id", id)
  .order("sent_at", { ascending: false });

// derivar el label visible (mismo criterio que la página pública)
function offerLabel(o: { status: string; expires_at: string }): string {
  if (o.status === "accepted") return "Aceptada";
  if (o.status === "declined") return "Rechazada";
  if (new Date(o.expires_at).getTime() <= Date.now()) return "Vencida";
  if (o.status === "viewed") return "Vista";
  return "Enviada";
}
```
Fuente: patrón de lectura verificado en `app/(app)/staff/[id]/page.tsx` (usa `supabase.from('staff_app_profiles').select(...).eq('id', id)`), replicable sobre la vista de offers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CONTEXT.md D-01 asume "llamá las RPCs con el cliente anon (tienen GRANT a anon)" | Las RPCs de `staff_app` NO son alcanzables por anon vía PostgREST; hay que reenviarlas por wrappers `public` | Verificado Fase 1-3 (PGRST106) | La Fase 4 necesita la migración 0009 (wrappers). No es opcional. |
| STAT-01 "leer el status de la oferta donde Franco ya mira" | No existe vista de offers ni SELECT de `authenticated` sobre `staff_app.offers` | Estado actual del repo | La migración 0009 incluye `public.staff_app_offers` + grant base. |

**Deprecated/outdated:** Nada. Todas las RPCs de 0003 están vigentes y probadas.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `staff_app` sigue sin estar expuesto en PostgREST (nadie cambió la config del proyecto desde Fase 1) | Load-Bearing Finding | Bajo. Si alguien lo expuso, los wrappers son redundantes pero inofensivos. El orquestador puede confirmar con una llamada `supabase.rpc('get_public_offer')` de prueba antes de aplicar 0009. |
| A2 | `SECURITY INVOKER` en los wrappers funciona porque anon ya tiene EXECUTE+USAGE sobre las funciones `staff_app` (otorgado en 0003) | Migración 0009 Parte A | Bajo. Verificable en vivo. Si fallara, cambiar a `SECURITY DEFINER` con el mismo `SET search_path`. El orquestador debe correr el harness de anon antes de dar por buena la migración. |
| A3 | `SITE_URL` está seteado en local y prod para que `/o/<token>` resuelva al host correcto | Runtime State | Medio. Si falta, el link del email (ya emitido en Fase 3) apunta a un host vacío. Confirmar antes del deploy. |

## Open Questions

1. **¿Wrapper `SECURITY INVOKER` o `SECURITY DEFINER`?**
   - What we know: anon tiene EXECUTE + USAGE sobre las RPCs `staff_app` (0003), así que INVOKER alcanza y es el mínimo privilegio.
   - What's unclear: si hay algún advisor que prefiera DEFINER por consistencia con 0004/0007/0008.
   - Recommendation: empezar con INVOKER; el orquestador confirma con harness anon + `get_advisors`. Si algo chilla, DEFINER con `SET search_path` idéntico.

2. **¿La vista `staff_app_offers` debe joinear gigs para el title, o alcanza con offers puro?**
   - What we know: Franco quiere ver "estado por oferta" en el perfil; el gig title da contexto.
   - Recommendation: incluir `g.title AS gig_title` en la vista (barato, un join, security_invoker respeta RLS de ambas tablas). El planner decide el set final de columnas.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js App Router | Ruta pública + Server Actions | ✓ | `^15.5.20` | — |
| Supabase (proyecto `luillpzfqzbpoqkgvjuw`) | RPCs + vista | ✓ (compartido con HITO) | — | — |
| Supabase MCP `apply_migration` | Aplicar 0009 en vivo | ✓ (sólo en la sesión orquestadora, no en subagentes) | — | El subagente escribe el `.sql`; el orquestador lo aplica. |
| `SITE_URL` env var | Link `/o/<token>` correcto | ⚠️ verificar | — | Sin él el link apunta a host vacío. |

**Missing dependencies with no fallback:** Ninguna que bloquee. La migración 0009 la aplica el orquestador (los subagentes no tienen MCP).

## Validation Architecture

> El repo es zero-budget y NO tiene framework de test instalado (confirmado en 03-03: *"this zero-zero-budget repo has no test framework installed"*). `.planning/config.json` no fue provisto al research; si `nyquist_validation` no está en false, la validación real de la Fase 4 es: (a) el harness SQL en vivo de la migración 0009 (lo corre el orquestador), y (b) prueba manual del flujo `/o/<token>` en el dev server.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Command / Check | Exists? |
|--------|----------|-----------|-----------------|---------|
| ACPT-01 | La página muestra la oferta sin cuenta | manual + SQL harness | abrir `/o/<token>` en el dev server sin sesión; `public.staff_app_get_public_offer` como anon devuelve payload | ❌ (harness nuevo en 0009) |
| ACPT-02 | Accept sólo por POST | manual | `curl` GET a `/o/<token>` NO cambia status; el `<form>` POST sí | ❌ |
| ACPT-03 | Accept crea 1 crew, idempotente | SQL harness | `public.staff_app_accept_offer` ×2 → 1 sola fila crew | ❌ (0009) |
| STAT-01 | Franco ve el estado | manual | `/staff/[id]` muestra el badge de estado de la oferta | ❌ |

### Wave 0 Gaps
- [ ] Harness SQL en `staff_app_0009` que pruebe: get vía wrapper anon, accept vía wrapper anon (+idempotencia), decline, vista offers visible al writer / invisible a anon. Lo corre el orquestador (mismo patrón que 0003/0008).
- [ ] No se instala framework de test JS (fuera de scope, decisión de repo). La verificación de UI es manual en el dev server + greps de construcción (patrón establecido en Fase 2/3).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (por diseño) | La página es unauth por token — "staff sin cuenta" es un requisito. El token de 256-bit hasheado en reposo ES la credencial. |
| V3 Session Management | no | Sin sesión para el candidato. |
| V4 Access Control | yes | RLS `is_org_member`/`is_org_writer` sobre `staff_app.*`; la vista de offers es security_invoker; los wrappers anon sólo exponen las 3 RPCs por token, nada más. |
| V5 Input Validation | yes | El único input es el token (text). La RPC lo hashea y matchea; token malo → NULL / invalid_or_expired. Sin superficie de inyección (parametrizado). |
| V6 Cryptography | yes | Token `gen_random_bytes(32)` (256-bit), hasheado sha256 en reposo, raw sólo en la URL. Ya construido (0003). No hand-roll. |

### Known Threat Patterns for esta stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bot de preview de email/WhatsApp dispara la aceptación | Tampering | Accept/decline sólo por POST (Server Action); GET sólo lee (D-02). |
| Replay del token / doble-tap | Tampering | Guard `status IN ('sent','viewed')` + crew `ON CONFLICT DO NOTHING` = idempotente (0003). |
| Enumeración de tokens | Information Disclosure | Token de 256-bit = espacio inbrute-forceable; token malo devuelve NULL sin filtrar existencia. |
| Fuga de PII de otros postulantes | Information Disclosure | `get_public_offer` devuelve sólo `first_name` + oferta/gig/org; nunca email/tel/cv/documento. |
| Exponer `staff_app` entero al abrir REST | Elevation of Privilege | NO cambiar `pgrst.db_schemas` (afecta a HITO); wrappers `public` que exponen exactamente 3 funciones + 1 vista. |
| `function_search_path_mutable` en los wrappers | Tampering | `SET search_path = staff_app, public, pg_temp` fijo en cada wrapper; confirmar con `get_advisors` limpio. |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/staff_app_0003_magic_link_rpcs.sql` — firmas/returns/guards exactos de las 3 RPCs + grants anon + nota de exposición PostgREST para Fase 4.
- `supabase/migrations/staff_app_0002_core_tables.sql` — schema de `offers` (enum status, expires_at, token_hash UNIQUE), RLS `offers_select`/`offers_write`, `REVOKE ALL FROM anon, authenticated`.
- `supabase/migrations/staff_app_0007_read_layer.sql` — patrón de vistas security_invoker en `public`, grants base a authenticated (NO incluye offers), WR-05.
- `supabase/migrations/staff_app_0008_create_offer.sql` — patrón de wrapper `public` (WHY public, PGRST106), forma del token, WR-05, `staff_app_gigs` view.
- `lib/supabase/middleware.ts` — `publicPaths` (línea 37), patrón de gate.
- `app/(app)/layout.tsx`, `app/(app)/staff/[id]/page.tsx`, `app/(app)/staff/[id]/offer-actions.ts`, `app/auth/callback/route.ts` — patrones de RSC, Server Action, cliente anon/server, membership gate, y confirmación PGRST106.
- `.planning/phases/01-own-data-foundation/01-02-SUMMARY.md` — resultados del harness SQL de las RPCs (7 casos, idempotencia, PII-safe).
- `.planning/phases/03-create-send-offers/03-01-SUMMARY.md` + `03-03-SUMMARY.md` — creación de offers, link `${SITE_URL}/o/${token}`, gigs con `hito_event_id` NULL, SMTP bloqueado.
- `package.json` — versiones verificadas (next ^15.5.20, react 19.1.0, @supabase/ssr ^0.12.3, supabase-js ^2.110.6, motion ^12.42.2).

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01/D-03 — el research corrige la asunción de D-01 (anon puede llamar las RPCs directo) con evidencia del repo.

### Tertiary (LOW confidence)
- Ninguna. Todo se ancló en archivos del repo.

## Metadata

**Confidence breakdown:**
- RPC contracts: HIGH — leídos verbatim de la migración 0003 + harness de 01-02.
- Necesidad de migración (wrappers + vista offers): HIGH — PGRST106 documentado en 4 lugares del repo; patrón idéntico ya usado en Fase 3.
- Ruta pública / middleware / Server Action: HIGH — patrones existentes en el repo (login, auth/callback, offer-actions).
- Manejo de reason `invalid_or_expired`: HIGH — colapso confirmado en el SQL; estrategia de re-lectura es la recomendación.
- `SECURITY INVOKER` vs `DEFINER` en wrappers: MEDIUM — funciona por los grants de 0003, pero conviene que el orquestador lo confirme en vivo (A2).

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (estable; sólo cambiaría si alguien modifica la config de esquemas expuestos del proyecto o toca las RPCs de 0003).

## RESEARCH COMPLETE

**Lo que más moldea el plan:**
1. **SÍ hace falta una migración** (`staff_app_0009`, aplicada en vivo por el orquestador), pero NO por reason-codes: las RPCs de `staff_app` no son alcanzables por el cliente anon vía PostgREST (PGRST106), así que hay que agregar **tres wrappers `public` anon-callable** que reenvíen a `get_public_offer`/`accept_offer`/`decline_offer` (mismo motivo por el que Fase 3 puso `create_offer` en `public`). Esto corrige la asunción de CONTEXT.md D-01.
2. La misma migración debe agregar la **vista `public.staff_app_offers`** (security_invoker) + `GRANT SELECT ON staff_app.offers TO authenticated` para STAT-01: hoy no existe ninguna vista de offers ni grant de lectura.
3. **Manejo de accepted/expired:** `accept_offer` colapsa todo en `{ok:false, reason:'invalid_or_expired'}`. Recomendación firme: NO tocar la RPC; ante el fallo, **re-leer `get_public_offer` y derivar el estado real** (aceptada / rechazada / vencida / inválida) para mensajear cálido. `get_public_offer` NO chequea expiry y el status nunca se auto-flipea a 'expired', así que **"vencida" siempre se deriva de `now() > expires_at`** en el servidor.
4. El resto es frontend puro: `app/o/[token]/` a nivel raíz (fuera de `(app)`), `"/o"` en `publicPaths`, RSC con `force-dynamic` para el GET seguro, Server Actions para el POST anti-bot, y sin puente a HITO (gigs con `hito_event_id` NULL, D-04).
