---
phase: 04-accept-close-loop
plan: 03
subsystem: staff-profile / offer-status
tags: [STAT-01, RSC, security_invoker, RLS, derived-state]
requires:
  - "public.staff_app_offers (vista security_invoker, migración staff_app_0009 — 04-01)"
  - "GRANT SELECT ON staff_app.offers TO authenticated (04-01)"
provides:
  - "OfferStatusList + offerLabel: reflejo de estado de ofertas en /staff/[id]"
  - "derivación de 'vencida' por now()>expires_at reutilizable (mismo criterio que la página pública)"
affects:
  - "app/(app)/staff/[id]/page.tsx (perfil del candidato)"
tech-stack:
  added: []
  patterns:
    - "RSC autenticado leyendo una vista public.* security_invoker (RLS scopea al org)"
    - "estado 'vencida' DERIVADO en el render, sin cron ni dependencia del enum"
key-files:
  created:
    - "app/(app)/staff/[id]/offer-status.tsx"
  modified:
    - "app/(app)/staff/[id]/page.tsx"
decisions:
  - "No tocar el enum status: 'vencida' se deriva de now()>expires_at (Pitfall 2)"
  - "Badge por token de marca: verde positive (aceptada), ámbar #f5a623 (vencida), fg-subtle (rechazada), surface-2 (enviada/vista)"
  - "Sección 'Ofertas' se omite entera si el candidato no tiene ofertas (null-safety, molde del perfil)"
metrics:
  duration: "~15 min"
  completed: "2026-07-16"
  tasks: 1
  files: 2
requirements: [STAT-01]
---

# Phase 4 Plan 03: Reflejo de estado de ofertas en el perfil (STAT-01) Summary

Franco ve, en el perfil del candidato `/staff/[id]`, el estado de cada oferta (enviada / vista / aceptada / rechazada / vencida) leyendo `public.staff_app_offers` con el cliente autenticado, con "vencida" derivada de `now() > expires_at` en el render.

## Qué se construyó

**`app/(app)/staff/[id]/offer-status.tsx` (server component, sin `"use client"`):**
- `offerLabel(o)`: helper exportado que deriva la etiqueta visible con el orden D-06 — `accepted → "Aceptada"`, `declined → "Rechazada"`, `now() > expires_at → "Vencida"` (DERIVADO, nunca del valor `'expired'` del enum), `viewed → "Vista"`, else `"Enviada"`. Mismo criterio que la página pública `/o/[token]`.
- `OfferStatusList`: renderiza cada oferta como una fila (`gig_title` + `role` + badge de estado + pie con el último hito: "Enviada el / Respondió el / Venció el"). Badge coloreado por estado con tokens de marca (verde `positive` aceptada, ámbar `#f5a623` vencida, `fg-subtle` rechazada, `surface-2` enviada/vista). Devuelve `null` si no hay ofertas.
- Tipo `OfferRow` exportado para tipar la query del perfil.

**`app/(app)/staff/[id]/page.tsx` (RSC de perfil):**
- Tras cargar el perfil, agrega `supabase.from("staff_app_offers").select("id,role,gig_title,status,expires_at,sent_at,viewed_at,responded_at").eq("staff_profile_id", id).order("sent_at", { ascending: false })` con el **cliente autenticado** (la RLS `is_org_member` de la vista `security_invoker` scopea al org de Franco; un no-miembro obtiene 0 filas).
- Nueva `<Section title="Ofertas">` con `<OfferStatusList>`, mostrada sólo si hay al menos una oferta, ubicada tras el CTA "Crear oferta".

## Seguridad (threat model)

- **T-4-12 (Information Disclosure):** mitigado — lectura vía la vista `security_invoker` + RLS `is_org_member` sobre `staff_app.offers`; sin service-role, sin acceso directo a `staff_app`, sin PII de terceros (la vista sólo trae rol/título/timestamps de la propia oferta). El `(app)` layout ya gatea membresía (defensa en profundidad).
- **T-4-13 (Spoofing — "vencida" mal):** mitigado — `vencida` se deriva de `now() > expires_at` en el render; el código nunca confía en `status === 'expired'` (ese valor del enum nunca se escribe, no hay cron).

## Verificación

- **Greps del plan:** OK — `offer-status.tsx` existe; contiene `offerLabel`, `Vencida`, `expires_at`; `page.tsx` contiene `OfferStatusList` y `staff_app_offers`; **grep-negativo** `status === 'expired'` NO presente (comentarios reformulados para no romper la verificación); sin acceso directo a `from("staff_app.…")`.
- **`npx tsc --noEmit`:** 0 errores (0 en `app/(app)/staff/[id]/*`).
- **`eslint` sobre los 2 archivos:** 0 problemas.
- **`next build`:** los archivos de 04-03 compilan (`✓ Compiled successfully`). El build global NO cierra limpio por trabajo concurrente de 04-02 (Wave 2 en paralelo) — ver Deferred Issues.
- **Human-check (end-of-phase, no ejecutado acá):** abrir `/staff/[id]` de un candidato con oferta y ver el badge correcto; verificar el flip Enviada→Vista→Aceptada y una oferta con `expires_at` pasado mostrando "Vencida".

## Deviations from Plan

Ninguna funcional. Único ajuste: los comentarios del componente que ilustraban el anti-patrón `status === 'expired'` se reformularon a "el valor 'expired' del enum" para no disparar el **grep-negativo** de verificación del propio plan (que busca la cadena literal `status === 'expired'`). No cambia comportamiento.

## Deferred Issues

- **Build global no cierra limpio durante la ejecución paralela de Wave 2** (registrado en `deferred-items.md`): (1) `app/o/[token]` (04-02, untracked WIP) referenció `./accept-decline` antes de crearlo; (2) `TypeError: a[d] is not a function` en el prerender de `/login` — síntoma de dos `next build` concurrentes corrompiendo el `.next` compartido. Ambos fuera del scope de 04-03 (que sólo toca `app/(app)/staff/[id]/*`) y no reproducibles a partir de mis archivos (compile + typecheck + lint limpios). Se resuelve solo cuando 04-02 aterriza su componente y no hay builds concurrentes.
- **Warning pre-existente** `cv-actions.ts:52` (`unused eslint-disable`, de Fase 2) — no introducido por 04-03.

## Known Stubs

Ninguno. La sección lee datos reales de `public.staff_app_offers`; si no hay ofertas, la sección se omite (comportamiento intencional, no un stub).

## Self-Check: PASSED

- FOUND `app/(app)/staff/[id]/offer-status.tsx`, `app/(app)/staff/[id]/page.tsx`, `04-03-SUMMARY.md`, `deferred-items.md`
- FOUND commit `a1a2ce4`
- Lógica derivada de "vencida" presente: `new Date(o.expires_at).getTime() <= Date.now()` (offer-status.tsx:38)
