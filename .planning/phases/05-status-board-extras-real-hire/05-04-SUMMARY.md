---
phase: 05-status-board-extras-real-hire
plan: 04
subsystem: profile-producer-tools
tags: [XTRA-01, XTRA-04, favorites, notes, ratings, producer-only, rls]
requires: ["05-02"]
provides: ["favorite+note en /staff/[id]", "rating 1-5 por gig aceptado en /staff/[id]"]
affects: ["app/(app)/staff/[id]/page.tsx"]
tech-stack:
  added: []
  patterns: ["server action member-gated → RPC SECURITY DEFINER con cliente autenticado", "client optimista + useTransition + toast sonner", "tipo LOCAL para derivación sin tocar tipos exportados de siblings"]
key-files:
  created:
    - app/(app)/staff/[id]/notes-actions.ts
    - app/(app)/staff/[id]/favorite-note.tsx
    - app/(app)/staff/[id]/rating-actions.ts
    - app/(app)/staff/[id]/rating.tsx
  modified:
    - app/(app)/staff/[id]/page.tsx
decisions:
  - "Favorito guarda optimista al toque; nota se persiste con botón Guardar (mismo RPC)"
  - "gig_id agregado SOLO al select de page.tsx; OfferRow de offer-status.tsx intacto vía tipo local RatableOffer"
  - "Sección Calificación se omite si no hay gigs aceptados (null-safety, molde del perfil)"
metrics:
  duration: ~25m
  completed: 2026-07-16
---

# Phase 5 Plan 04: Favoritos/Notas (XTRA-01) + Rating (XTRA-04) Summary

Franco marca favoritos, escribe notas privadas y califica 1-5 por gig a cada candidato desde `/staff/[id]`, todo producer-only vía los RPCs `public` SECURITY DEFINER de 05-02 con el cliente autenticado; cero fuga a superficies candidate-facing.

## What shipped

- **XTRA-01** — `notes-actions.ts` (`setCandidateNote`, member-gated → `rpc('staff_app_set_candidate_note')`) + `favorite-note.tsx` (toggle Bookmark optimista + textarea nota privada + toast, `useTransition`).
- **XTRA-04** — `rating-actions.ts` (`rateStaff`, member-gated, valida score entero 1..5 server-side → `score_out_of_range` sin tocar el RPC → `rpc('staff_app_rate_staff')`) + `rating.tsx` (5 estrellas Star + nota por gig aceptado + toast; microcopy "Vas a poder calificarlo cuando trabaje en un gig" si no hay gigs).
- **Cableado en `page.tsx`** — lecturas de `staff_app_candidate_notes` (maybeSingle) + `staff_app_staff_ratings` con el cliente autenticado (RLS is_org_member); render de `<FavoriteNote>` bajo el CTA "Crear oferta" y `<Section title="Calificación">` con `<Rating>`.

## gig_id fix (Task 3)

El select de `staff_app_offers` en `page.tsx` se extendió de
`id,role,gig_title,status,expires_at,sent_at,viewed_at,responded_at` a incluir `gig_id`.
La derivación de gigs calificables usa un **tipo LOCAL** `RatableOffer` (`gig_id, gig_title, status`) casteando `offersData` — el tipo exportado `OfferRow` de `offer-status.tsx` **NO se tocó** (OfferStatusList no necesita gig_id). Se derivan las ofertas `status='accepted'` (par gig_id+gig_title distinto, deduplicado), se hace merge con los ratings existentes para precargar score/note, y el `gigId` que va a `rateStaff` sale del `gig_id` real — nunca undefined.

## Seguridad / aislamiento (Pitfall 2 / D-03)

- Todas las escrituras pasan por los RPCs `public` SECURITY DEFINER con el **cliente autenticado**; gate `staff_app_my_membership.maybeSingle → throw "forbidden"` en ambas actions. Sin `createServiceRoleClient` en ningún path de UI (grep-negativo limpio).
- Lecturas vía las vistas security_invoker (RLS scopea al org).
- Grep-negativo en `app/o`: cero referencias a candidate_notes / staff_ratings / is_favorite / set_candidate_note / rate_staff / FavoriteNote / Rating. Producer-only garantizado.
- Validación de score en 3 capas: client (no guarda si score<1), server (`score_out_of_range` antes del RPC), CHECK de la tabla (05-02).

## Deviations from Plan

Ninguna que altere el diseño. Nota operativa: durante la verificación el build falló dos veces por un race del type-gen de Next 15 al escribir `.next/types/**` bajo el sandbox (el error saltaba de ruta en ruta, y una vez referenció un `route.ts` inexistente por caché stale). Se resolvió limpiando `.next` y corriendo el build sin sandbox — problema de entorno, no de código. `tsc --noEmit` standalone siempre pasó limpio.

## Verification

- `npm run typecheck` — limpio.
- `npm run lint` — 0 errores en mis archivos (2 warnings pre-existentes fuera de scope: `app/(app)/layout.tsx` Link no usado, `cv-actions.ts` eslint-disable).
- `npm run build` — pasa; `/staff/[id]` = 4.88 kB, 9/9 páginas generadas.
- Isolation grep-negativo en `app/o` — CLEAN.
- Sin service-role en los 5 archivos de UI — CLEAN.
- `gig_id` presente en el select de `page.tsx`.

## Commits

- `4095fc4` — feat(05-04): XTRA-01 favorito + nota privada (server action + client)
- `8378070` — feat(05-04): XTRA-04 rating post-evento por gig (server action + client)
- `8f29db8` — feat(05-04): cablear favorito/nota + rating en el perfil + gig_id fix

## Known Stubs

Ninguno. Favorito, nota y rating se persisten vía RPC real y sobreviven refresh (las lecturas del perfil los precargan).

## Self-Check: PASSED

- 4 archivos creados + 1 modificado (page.tsx) verificados en disco.
- 3 commits (4095fc4, 8378070, 8f29db8) presentes en git log.
