---
type: quick
slug: cron-unico-diario
created: 2026-07-31
completed: 2026-07-31
status: complete
---

# SUMMARY — Cron único diario

## Qué se hizo

- **Nueva** `app/api/cron/diario/route.ts`: orquestador que corre las 4 tandas en secuencia.
- **Cambiado** `vercel.json`: el único cron pasó de `/api/cron/reminders` a `/api/cron/diario`,
  mismo horario (`0 9 * * *`).
- **No se tocó** la lógica interna de ninguna de las 4 tandas. Las 4 rutas siguen existiendo
  y siendo llamables a mano, que es lo que permite probar una sola sin esperar al cron.

## Decisiones que importan

1. **Se pasa el `request` original a cada handler**, no un Request sintético. Se verificó con
   grep que las 4 rutas leen únicamente `request.headers.get("authorization")` y ninguna
   toca `searchParams`, así que el request original les sirve tal cual.
2. **Presupuesto de tiempo con salteo, no con corte a mitad.** Antes de arrancar cada tanda
   se mira el reloj contra `maxDuration` (60s, techo de Hobby) menos una reserva de 8s. Si no
   hay margen, la tanda **no se arranca** y queda para mañana. Es seguro porque las 4 RPC
   estampan su ancla de exactly-once AL SELECCIONAR: la tanda que no corre hoy no pierde
   nada. Lo peligroso sería lo contrario, que la función muera a mitad de un envío y deje
   filas estampadas sin mail mandado.
3. **Cada tanda aislada en su try/catch**, y el resumen reporta el estado de cada una por
   separado. Que `bienvenida` explote no puede impedir que salga `quien-ficho`.

## Verificación

- `npx tsc --noEmit` → sin errores.
- `npm run build` → compiló OK; las **5** rutas de cron aparecen en el listado
  (`bienvenida`, `diario`, `quien-ficho`, `recordatorio-perfil`, `reminders`).
- `next start` local + curl: `/api/cron/diario` **sin header → 401** y con **header
  equivocado → 401**. Fail-closed confirmado, no heredado de memoria.
- **NO se probó el camino feliz en local a propósito**: ejecutarlo habría pegado contra la
  Supabase real y mandado mails de verdad. Se prueba en producción después del deploy.

## Lo que esto NO resuelve

- **La tanda de bienvenida sigue apagada de hecho**: las 702 fichas del pool tienen
  `bienvenida_enviada_at` en NULL. El cron ahora la llama, pero mandar 702 bienvenidas es
  una decisión de negocio de Franco, no un bug a arreglar acá.
- El recordatorio de perfil, por consecuencia, arranca en 0 destinatarios: persigue fichas
  con bienvenida mandada hace 5 días o más, y hoy no hay ninguna.
- La primera corrida sí va a mandar **3 mails de "quién fichó"** por 3 eventos ya terminados
  (20/7 al 27/7) que nunca tuvieron resumen. Ruido esperado, una sola vez.
