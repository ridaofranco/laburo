# Phase 2: Find Staff - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 02-find-staff
**Areas discussed:** Nombre y look de la app · Pantalla de búsqueda · Login · Perfil del candidato (las 4 ofrecidas, todas seleccionadas)

---

## Nombre de la app

| Option | Selected |
|--------|----------|
| STAFF by DER | |
| CREW by DER | |
| Decidí vos | |
| **Other:** "ENTRA e HITO salieron como idea tuya, pensalo vos también por favor" | ✓ |

**Resolución:** Claude propone el nombre. Working name elegido: **LABURO** (alternativas: BOLO, CONVO). Franco puede vetar.

## Look / estética

| Option | Selected |
|--------|----------|
| Tema oscuro SOMOS DER | |
| Tema claro | |
| **Other (textual):** "Yo quiero algo con azul, confianza, que sea atractivo, letras medio glow, que sea tipo globos... [ref Shutterstock neon bubble font] ...no quiero usar como DER, ni como HITO. quiero que veas qué es lo más conveniente... atractivo para este tipo de rubros" | ✓ |

**Resolución:** marca propia — azul confianza + glow neon + tipografía bubble en momentos de marca, UI limpia sobre base oscura. Ni DER ni HITO.

## Resultados de búsqueda

| Option | Selected |
|--------|----------|
| Tarjetas | (✓ implícito) |
| Lista compacta | |
| **Other:** "decidí vos... quizás tarjeta por candidato como decís, no sé si con foto, sin foto, que sea sencillo, rápido, legible y sobre todo atractivo, y toda la app mobile adaptative" | ✓ |

**Resolución:** tarjetas sin foto (no hay fotos en el pool), avatar de iniciales, mobile adaptive.

## Filtros

**Franco:** "me gustan las 2, pero sí, decidí vos" → **híbrido**: buscador + chips de oficios arriba, panel completo para lo fino.

## Login

| Option | Selected |
|--------|----------|
| Magic link | |
| Email + contraseña | |
| **Other:** "quiero que funcione con gmail, github, accesos con plataformas, facebook y todas esas cosas además de magic link y gmail" | ✓ |

**Resolución:** Supabase Auth social — v1: Google OAuth + magic link (GitHub si es trivial); Facebook diferido (app Meta + review). Emails admin: **las dos** cuentas de Franco. Gate de membresía obligatorio (signup abierto ≠ acceso a datos).

## CV en el perfil

**Franco:** "Decidí vos" → visor embebido cuando sea viable, fallback "Abrir CV"; robusto ante Drive links muertos.

## Acciones rápidas

**Franco:** "Decidí vos" → botones WhatsApp (wa.me) + llamar (tel:).

## Claude's Discretion

- Render del CV (Drive vs bucket propio), acciones rápidas, micro-interacciones (Motion), detalles del sistema visual (tokens en UI-SPEC).

## Deferred Ideas

- Facebook OAuth y otros providers → v2
- Fotos de candidatos → v2 (panel del staff)
