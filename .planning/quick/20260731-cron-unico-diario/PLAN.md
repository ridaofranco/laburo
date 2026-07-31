---
type: quick
slug: cron-unico-diario
created: 2026-07-31
status: in-progress
---

# Cron único diario: que las 4 tandas de mail se disparen de verdad

## El problema (verificado, no supuesto)

`vercel.json` agenda **un solo cron**:

```json
{ "crons": [ { "path": "/api/cron/reminders", "schedule": "0 9 * * *" } ] }
```

Pero en `app/api/cron/` hay **cuatro** rutas: `reminders`, `bienvenida`, `quien-ficho`,
`recordatorio-perfil`. Las tres últimas **no las llama nadie, nunca**.

Esto se volvió visible hoy (31/7) al aplicar las migraciones `0032-0034`: el código de los
3 mails nuevos está en producción y la base ya los soporta, pero 2 de los 3 dependen de
rutas que no están agendadas. El tercero (`pago listo`) no usa cron, es un botón manual,
y por eso ese sí funciona.

## Por qué un cron único y no cuatro

El plan **Hobby de Vercel topea en 2 cron jobs**. Agregar tres entradas más al `vercel.json`
no es una opción, y aunque lo fuera, cada tanda nueva que se agregue en el futuro volvería
a chocar contra el mismo techo. Un orquestador diario resuelve el problema una sola vez.

## Diseño

Ruta nueva `app/api/cron/diario/route.ts`:

1. **Auth fail-closed idéntica a las 4 existentes**: sin `CRON_SECRET` o con header que no
   coincida exacto → 401. No se inventa un patrón nuevo.
2. **Llama a los `GET` de las 4 rutas importándolos como módulos** y pasándoles el
   `request` original. Se verificó que ninguna de las 4 lee `searchParams`: todas leen
   solo el header de authorization, así que el request original les sirve tal cual.
   **Cero lógica duplicada**: si mañana cambia una tanda, cambia en un solo lugar.
3. **Cada tanda va en su propio `try/catch`**: que `bienvenida` explote no puede impedir
   que salga `quien-ficho`. Se reporta el resultado de cada una por separado.
4. **Presupuesto de tiempo**: antes de arrancar cada tanda se mira el reloj. Si ya no queda
   margen contra `maxDuration`, esa tanda **no se arranca** y queda para mañana. Esto es
   seguro porque **las cuatro RPC estampan su ancla de exactly-once al seleccionar**: una
   tanda que no corre hoy no pierde nada, simplemente corre en la próxima vuelta.
   Lo inseguro sería lo contrario (que la función muera a mitad de un envío).
5. Las 4 rutas individuales **se dejan intactas y siguen siendo llamables a mano**, que es
   lo que permite probar una sola sin esperar al cron.

`vercel.json`: el único cron pasa a apuntar a `/api/cron/diario`, mismo horario (`0 9 * * *`).

## Orden de ejecución

`reminders` → `bienvenida` → `quien-ficho` → `recordatorio-perfil`.

No hay dependencia dura entre ellas dentro de una misma corrida (el recordatorio de perfil
persigue bienvenidas de hace 5 días o más, nunca la que se acaba de mandar en esta vuelta),
pero se deja a `bienvenida` antes que a su recordatorio por lectura, y las dos de mayor
valor comercial primero por si el presupuesto de tiempo corta la cola.

## Verificación

- `tsc --noEmit` y `npm run build` en verde.
- Que el build siga listando la misma cantidad de rutas + la nueva.
- Probar la ruta contra el server local: sin header → 401, con header equivocado → 401.
- Post-deploy: probar `/api/cron/diario` en producción con el `CRON_SECRET` real y
  confirmar que devuelve el resumen de las 4 tandas.

## Fuera de alcance

- No se toca la lógica interna de ninguna de las 4 tandas.
- No se cambia el horario ni la frecuencia.
- No se resuelve que la tanda de bienvenida esté apagada (las 702 fichas tienen
  `bienvenida_enviada_at` en NULL): eso es una decisión de negocio de Franco, no un bug.
