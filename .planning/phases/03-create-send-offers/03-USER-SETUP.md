# Phase 3 — User Setup (SMTP de DER para el envío de ofertas)

**Necesario para:** OFER-02 (el email de la oferta sale por el SMTP Ferozo de DER). Sin estos valores la oferta igual se CREA y el botón wa.me funciona, pero el email reporta honestamente "no salió" (D-02).

**Por qué es manual:** `somosder-web` NO es un repo git — sus credenciales SMTP viven sólo en su panel de Vercel + su `.env`. Claude no puede leerlas; hay que copiarlas a mano.

## Qué hacer

1. Entrá al panel de Vercel del proyecto **somosder-web / accesos** → Settings → Environment Variables.
2. Copiá los valores de estas 7 variables a `.env.local` de LABURO (git-ignored) **y** al panel de Vercel del proyecto LABURO (cuando exista; el deploy propio es Fase 5).

| Variable | Valor (de somosder-web) | Notas |
|----------|--------------------------|-------|
| `SMTP_HOST` | ej. `c2630345.ferozo.com` | el mismo Ferozo de DER |
| `SMTP_PORT` | `465` | |
| `SMTP_SECURE` | `true` | |
| `SMTP_USER` | ej. `contacto@somosder.com.ar` | el mailer lo baja a minúsculas para evitar 535 por casing |
| `SMTP_PASSWORD` | (secreto) | NUNCA commitear; sólo en `.env.local` / Vercel |
| `MAIL_FROM_NAME` | `SOMOS DER` | o `LABURO · SOMOS DER` a gusto de Franco |
| `MAIL_FROM_ADDRESS` | = `SMTP_USER` | debe ser una casilla real de `somosder.com.ar` para no romper el alignment SPF |

## Decisión pendiente (no bloquea)

- **`from` definitivo:** ¿`contacto@` o una casilla dedicada tipo `rrhh@` / `laburo@`? Afecta el reply-to y la percepción. Default razonable: la misma casilla de somosder-web. Preguntarle a Franco.

## Notas

- **NO instalar Resend.** El mailer cae directo a la rama SMTP (`RESEND_API_KEY` queda sin setear a propósito).
- **SPF/DKIM** se verifica recién en Fase 5 (SHIP-01); acá alcanza con que el `from` sea una casilla real del dominio.
- El link `/o/<token>` del email va a dar 404 hasta Fase 4 — no le mandes una oferta a un candidato real todavía; probá mandándotela a vos.

---
*Phase: 03-create-send-offers · 2026-07-16*
