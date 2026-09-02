# Las 4 reglas de un cobro (LABURO)

Item 4 del plan único: hasta el 26/7/2026 estas reglas no estaban escritas en
ningún lado. Vivían en la cabeza de quien había arreglado el último bug, así que
cada producto que empezaba a cobrar volvía a cometer los mismos errores. **Este
archivo va en los tres repos que cobran o van a cobrar (ENTRÁ, LABURO, PASE).**

No se unifica el CÓDIGO de MercadoPago: son tres casos distintos y el refactor
tocaría plata sin ganar nada. Lo que se unifica es **el checklist**.

> ⚠️ **LABURO no cobra: es gratis.** Decisión de producto de Franco (2/9/2026), no
> una limitación técnica. El circuito de MercadoPago está entero y no se borró una
> línea, pero está APAGADO en `lib/cobros.ts` (`COBRO_AL_CLIENTE_ACTIVO = false`):
> el tablero no ofrece el botón y la server action corta antes de hacer nada.
>
> **Y aunque se prendiera la bandera, hoy no cobraría igual.** Lo que decía este
> archivo hasta el 2/9 (que borrar `MP_SANDBOX` era "lo único" que faltaba) era
> falso por tres razones, las tres verificadas contra el código:
>
> 1. **`MP_ACCESS_TOKEN` no está cargada.** `payment-actions.ts` corta ahí mismo y
>    devuelve "MercadoPago no está configurado todavía." Sin ese token no hay
>    checkout de ningún tipo.
> 2. **`MP_WEBHOOK_SECRET` no está cargada.** `app/api/mp/webhook/route.ts` hace
>    `if (!secret) return true`: sin esa variable la verificación de firma no se
>    degrada, se **saltea entera**. Está escrito a propósito y documentado en el
>    header del webhook, pero acá nunca se había contado.
> 3. **Nada verifica que el token sea de producción.** El sandbox se elige por
>    `NODE_ENV` y `MP_SANDBOX`, nunca por el prefijo `TEST-` del token. Con un
>    token de prueba y `MP_SANDBOX` borrada, `init_point` viene igual: se entrega
>    un link de pago DE PRUEBA como si fuera real, sin un solo aviso.

---

## Regla 1. Verificar cuánto se pagó ANTES de entregar

Nunca confiar en que el link de pago siga valiendo lo mismo que cuando se generó.
Comparar contra el precio real guardado en la base.

**Por qué acá:** el link se genera con el presupuesto del evento en ese momento,
pero el presupuesto cambia (se agrega gente, se suma un día). Si el cliente paga
el link viejo, MercadoPago avisa "approved" igual y el evento quedaba dado por
cobrado por menos plata. Es el mismo agujero que tenía ENTRÁ, cerrado acá **antes**
de que LABURO cobre de verdad.

> **Estado: ✅** `app/api/mp/webhook/route.ts` compara `transaction_amount` contra
> `client_budget`. Dos decisiones tomadas a propósito: la lectura del esperado es
> **fail-open** (si no se puede averiguar, se marca cobrado igual y queda en los
> logs, porque un pago real sin registrar es peor), y un pago insuficiente se
> loguea como `PAGO INSUFICIENTE` y lo resuelve una persona.

## Regla 2. Devolver error para que MercadoPago reintente, nunca un 200 silencioso

Si el proceso falla a mitad de camino, 500. MP reintenta y el cobro termina
registrándose. Un 200 le dice a MP "listo" y el pago queda perdido.

**La contracara:** lo que no se arregla reintentando va con 200 explícito y
logueado. Un pago insuficiente reintentado sigue siendo insuficiente.

> **Estado: ✅** 500 ante error inesperado. El pago insuficiente devuelve 200 a
> propósito, con el warning en el cuerpo y el detalle en los logs.

## Regla 3. No entregar dos veces el mismo pago

MP notifica el mismo pago varias veces.

**Dónde va el candado:** en la base, en la misma sentencia que hace el trabajo, no
en un `if` del código. Dos webhooks en paralelo pasan los dos por el `if`.

> **Estado: ✅ por naturaleza, no por candado.** Acá el trabajo es marcar el gig
> como cobrado, que es idempotente (marcarlo dos veces lo deja igual), y cada
> notificación queda registrada con `staff_app_log_payment_event`. **Ojo el día que
> el cobro dispare algo que NO sea idempotente** (mandar un mail, liberar un pago
> al staff): ahí hace falta el candado de verdad, como el `paymentFailedEmailAt`
> de ENTRÁ.

## Regla 4. Esperar a que el mail salga antes de terminar

El aviso se `await`ea dentro del flujo. Nada de fire-and-forget: en serverless la
función se congela apenas devolvés la respuesta, y el mail se corta a la mitad.
**Ese es el motivo por el que ENTRÁ estuvo mandando entradas que nunca llegaban.**

> **Estado: ⏳ todavía no aplica.** El cobro de LABURO no manda ningún mail hoy.
> Cuando se sume el "tu pago está listo" (está escrito en el CENTRO-DE-MAILS.html
> esperando el OK), tiene que ir awaiteado y con candado de una sola vez.

---

## Antes de prender el cobro

Checklist, en este orden. No alcanza con ninguno solo:

- [ ] **Poner `COBRO_AL_CLIENTE_ACTIVO = true` en `lib/cobros.ts`.** Mientras esté
      en `false`, LABURO es gratis y el botón del tablero ni aparece.
- [ ] **Cargar `MP_ACCESS_TOKEN` en Vercel.** Hoy no está: sin ella la action corta
      con "MercadoPago no está configurado todavía."
- [ ] **Cargar `MP_WEBHOOK_SECRET` en Vercel.** Hoy no está, y sin ella la
      verificación de firma del webhook se saltea entera.
- [ ] **Verificar que el token NO empiece con `TEST-`.** El código no lo chequea:
      elige sandbox por `NODE_ENV` y `MP_SANDBOX`. Con un token de prueba y
      `MP_SANDBOX` borrada, se entrega un link de prueba como si fuera real.
- [ ] **Repasar las 4 reglas de arriba** contra el código y no de memoria.

Y una quinta que no es del cobro pero se paga igual de caro: **que avise cuando
algo de esto falle**. El webhook ya avisa por Telegram (`lib/alerta.ts`) ante falla
y ante pago de menos, pero eso solo funciona con `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` cargadas.
