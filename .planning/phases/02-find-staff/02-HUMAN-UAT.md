---
status: partial
phase: 02-find-staff
source: [02-VERIFICATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

[awaiting human testing on Franco's phone — requires a deployed URL]

## Tests

### 1. Login real con Google
expected: Tocar "Entrar con Google", elegir ridaofrancorg@gmail.com o franco@somosder.ar, y caer en el dashboard de LABURO (no una página de error).
result: [pending]

### 2. Redirect URL en Supabase
expected: La URL de la app (localhost y/o el dominio de producción) está en Supabase Auth → URL Configuration → Redirect URLs, y el login vuelve a LABURO.
result: [pending]

### 3. Magic link en el teléfono
expected: Abrir el email del link mágico en el teléfono (Gmail/Mail) y tocar el link → entra autenticado, no rebota a /login en blanco.
result: [pending]

### 4. Uso con una sola mano
expected: Todo el flujo (buscar → filtrar → perfil → CV → WhatsApp/llamar) es cómodo con el pulgar, sin necesitar la otra mano.
result: [pending]

### 5. Identidad visual LABURO
expected: El look (logo con glow, azul, sensación bubble/neon) matchea tu dirección "azul, confianza, letras medio glow, tipo globos" y resulta atractivo para el rubro eventos.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
