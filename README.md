# LABURO

Marketplace de staff eventual para producción de eventos. Una productora publica
un evento, busca gente por oficio y disponibilidad sobre un pool real de
postulantes, manda una oferta con monto y fechas, y la persona la acepta desde
un link — **sin crear ninguna cuenta**.

Alrededor de eso hay tres pools más: proveedores de servicios, salones y las
productoras mismas.

## Estado y alcance de v1

**En producción.** Hoy tiene **1.050 fichas de staff** y **cero productoras
cliente**: es multi-tenant con un solo inquilino. Ver
[`ACTORES.md`](./ACTORES.md).

**Lo que v1 incluye:** una organización plataforma, **alta abierta de
productoras** (nadie aprueba nada), el pool de staff con búsqueda y ofertas por
link mágico, el directorio de proveedores y salones con sus altas abiertas,
aislamiento entre organizaciones con selector de contexto, y la plataforma
pudiendo operar una productora dejando rastro. **Sin cobro**: es gratis para
todos, por decisión comercial, con el circuito de pago entero y apagado por una
bandera.

**Fuera de v1, a propósito** — no es deuda, es alcance:

- SSO y cualquier login corporativo
- Suite de tests automatizados (las pruebas son manuales, ver [`PRUEBAS.md`](./PRUEBAS.md))
- Mensajería dentro de la app: la coordinación es por WhatsApp
- Cobro de plataforma prendido
- Alcance por zona o por evento dentro de un rol
- El puente a HITO
- Base de datos propia separada

**Revisión de este alcance: 30 días después del lanzamiento.**

## Quién lo usa

Cinco actores, cada uno con su puerta:

- **Plataforma** — la organización dueña del producto. Ve todo, modera todo.
- **Productora** — el cliente. Publica eventos y contrata. Alta abierta.
- **Staff** — la persona que trabaja. Acepta ofertas **sin cuenta**; el panel
  aparece si ella lo pide.
- **Proveedor** — servicios para eventos. **Nunca tiene contraseña**: entra por
  link mágico.
- **Salón** — el espacio. Comparte la puerta del proveedor.

El mapa completo, con rutas, permisos y flujos: **[`ACTORES.md`](./ACTORES.md)**.

## Stack

| | |
|---|---|
| Framework | Next.js 15.5 (App Router) · React 19 · TypeScript 5 |
| Datos y auth | Supabase (`supabase-js` 2, `@supabase/ssr` 0.12) — **la RLS es el modelo de seguridad** |
| Estilos | Tailwind CSS 4 · Base UI · lucide-react |
| Animación | Motion |
| Mail | nodemailer + `@react-email/components`, sobre SMTP propio |
| Pagos | MercadoPago — **integrado y apagado por bandera** (`lib/cobros.ts`) |

Sin ORM en el camino de datos: las lecturas y escrituras van por `supabase-js`
con el JWT del usuario, para que la RLS se aplique sola. Una conexión directa la
saltearía.

## Levantarlo en local

```bash
npm install
npm run dev
```

Hace falta un `.env.local`. Las variables, **por nombre** (los valores no están
en el repo y no van a estar):

**Imprescindibles**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     # solo servidor, nunca en el cliente
SITE_URL
```

**Mail** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_REPLY_TO`,
`MAIL_ADMIN_TO`

**Cobro (opcional, hoy apagado)** — `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`,
`MP_SANDBOX`

**Otros** — `GEMINI_API_KEY` (lectura de CV), `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` (avisos internos), `CRON_SECRET`, `BIENVENIDA_BATCH`

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

**No hay suite de tests automatizados.** Las pruebas son manuales y están
escritas en [`PRUEBAS.md`](./PRUEBAS.md).

⚠️ Para probar en serio conviene `npm run build && npm run start` y no `dev`: el
servidor de desarrollo se cae bajo carga y fabrica errores que no existen.

## Migraciones

Viven en `supabase/migrations/`, numeradas y en orden. **Se aplican a mano**, no
hay pipeline automático.

⚠️ **El orden es migración primero, deploy después.** Un parámetro opcional
nuevo protege al código *viejo* contra la base nueva, no al revés: si el código
nuevo sale antes que su migración, rompe.

## Documentación

- **[`ACTORES.md`](./ACTORES.md)** — quién usa LABURO, por dónde entra y qué
  puede hacer. **Empezá por acá.**
- **[`PRUEBAS.md`](./PRUEBAS.md)** — cómo dar de alta una organización de
  prueba, qué se puede ver, y cómo sacarla.
- **[`PRD-LABURO.md`](./PRD-LABURO.md)** — el documento de intención original
  (en inglés, 2026). Valor histórico: el producto creció y el mapa vigente es
  `ACTORES.md`.
- **[`RUNBOOK.md`](./RUNBOOK.md)** — qué hacer cuando algo falla: no llegó un
  mail, alguien no puede entrar, hay que bajar una publicación.
- **`COBROS.md`** — qué falta para prender el cobro.

## Licencia

<!-- TODO (Franco): decidir. El repo es público; el producto no. Mientras no
     haya decisión, no hay licencia abierta: sin licencia explícita rige el
     copyright por defecto (todos los derechos reservados). -->

Sin licencia definida todavía. El código es público para poder ser revisado; el
producto es privado.
