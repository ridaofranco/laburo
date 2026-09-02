---
fase: quick/260902-i2g-gratis-y-arreglos-para-salir
tipo: summary
modo: quick
status: completo
fecha: 2026-09-02
tareas: 5/5
commits: [1540460, d1c4b86, a2af129, 7e1dbb7, 795651c]
base: 42b794e
migraciones_escritas: [0068, 0069]
migraciones_aplicadas: []
push: no
verificacion_final: verde
pendiente_humano:
  - aplicar 0068 y 0069
  - reprobar el alta de productora despues de aplicar la 0069
---

# LABURO gratis y los arreglos para salir a buscar usuarios

Las cinco tareas ejecutadas en el orden del plan, un commit atómico por tarea,
arriba de `42b794e` y sin pushear. `typecheck`, `lint` y `build` en verde.
Ninguna migración aplicada: las dos están escritas y esperan a Franco.

---

## Los cinco commits

| # | Hash | Mensaje |
|---|------|---------|
| 1 | `1540460` | `fix(dev-login): el atajo entraba con una cuenta sin organizacion` |
| 2 | `d1c4b86` | `feat(cobros): LABURO es gratis, el cobro se apaga con una bandera` |
| 3 | `a2af129` | `fix(ofertas): el monto y la fecha se validan en la base, no solo en el navegador` |
| 4 | `7e1dbb7` | `feat(alta): la puerta se abre a quien sea que necesite staff, no solo a productoras` |
| 5 | `795651c` | `feat(alta-productora): el telefono, dos datos mas, y dejar de mentir sobre el mail` |

18 archivos, +1369 / -68. Cero renombres de rutas, archivos o ids.

---

## Tarea 1: el atajo de desarrollo

`/dev-login` pasó de `ridaofrancorg@gmail.com` a `franco@somosder.ar`. La cuenta
vieja existe como `auth.user` pero no es miembro de ninguna organización, así que
el atajo "funcionaba" y aterrizaba en "Esta cuenta no tiene acceso.". Reproducido
y verificado: con la cuenta nueva, `/dashboard` carga con los datos de SOMOS DER.

**El `Unexpected end of JSON input` de `/dev-login-staff` quedó resuelto y era
otra cosa que lo que se sospechaba.** No era `createServiceRoleClient` ni un
throw sin capturar: era que `LABURO_DEV_BYPASS` no estaba en `.env.local`, así
que el guard devolvía un 404 de texto plano, el router de Next lo buscaba como
payload RSC y el browser mostraba el error de JSON en vez del 404.

Con la variable puesta, la ruta anda: crea el usuario, genera el magic link y
setea la sesión. Pero `/panel-staff` la rebotaba a `/acceso-staff` sin decir por
qué, porque `ridaofrancorg+staff@gmail.com` no tiene ficha en `staff_profiles`.

**Decisión tomada sobre la marcha:** el plan ofrecía cambiar `STAFF_EMAIL` por
"la cuenta de staff real que sí tiene ficha". No se hizo: apuntar un atajo de
desarrollo al mail de un trabajador real es impersonarlo. En su lugar la ruta
chequea la ficha después de crear la sesión (con el RPC
`staff_app_my_staff_profile` que ya existía, sin dependencias nuevas) y devuelve
un 500 que dice exactamente qué falta y cuáles son las dos salidas. Verificado
ejecutándolo.

## Tarea 2: el cobro fuera del camino

`lib/cobros.ts` nuevo, con `COBRO_AL_CLIENTE_ACTIVO = false` y el motivo. Módulo
aparte por la misma razón que `lib/pago.ts`: `payment-actions.ts` es
`"use server"` y `gig-board.tsx` es cliente. La bandera corta en la primera línea
de `createClientCheckout`, antes de leer `MP_ACCESS_TOKEN`, y es el primer
término de `puedeCobrar` en el tablero. La rama de "Cobrado" quedó intacta.

**Ni una línea de MercadoPago borrada.**

`COBROS.md` decía que borrar `MP_SANDBOX` era lo único que faltaba para facturar.
Ahora dice el estado real y lista las tres piezas que además faltan
(`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, y que nada verifica que el token no sea
`TEST-`). La sección pasó a llamarse "Antes de prender el cobro" y es un
checklist. Las cuatro reglas compartidas con ENTRÁ y PASE no se tocaron.

## Tarea 3: monto y fecha de la oferta

Migración **0068 escrita, sin aplicar**. Dos guardas en `staff_app_create_offer`:
el monto se valida arriba de todo (si fuera abajo, el quick-create ya habría
insertado el gig y quedaría un evento huérfano) y la fecha se cubre en las dos
ramas. En la rama del evento elegido, el `PERFORM 1` pasó a
`SELECT starts_at INTO v_starts`, que setea `FOUND` igual, así que el
`gig_not_found` sigue funcionando tal cual. La firma no cambia.

`offer-actions.ts` valida rol, monto y fecha antes de llamar a la RPC, y un mapa
`MOTIVOS` traduce los ocho `reason` posibles a castellano. Antes la productora
leía `candidate_not_found` tal cual en pantalla.

`offer-form.tsx`: el monto decía "Pago informativo, opcional." y la fecha
"(opcional)" mientras el submit los exigía desde el 18/07. Los dos rótulos dicen
la verdad y los dos inputs llevan `required`. La lógica de validación del cliente
no se tocó. Quedan como opcionales solo "Lugar" y "Condiciones", que sí lo son.

## Tarea 4: la puerta ancha

Solo capa de usuario. Se abrió el eyebrow de la tarjeta 1, su párrafo, el de
proveedores, el eyebrow de la sección 04, las dos metadata, la opción 0 de
`/registrarme`, `ROLES[0]` y `ALTA.productora` de `/entrar`, y el eyebrow, la
bajada y el label de `/registrar-productora`.

En `/entrar` el rol pasó de "Soy productora" (lo que la persona ES) a "Armo
eventos" (lo que HACE), que es exactamente donde se perdían la agencia y la
marca.

**Nada renombrado:** `organizations`, `productora`, el tipo `Rol`, los ids de las
opciones y `?c=productora` quedaron igual. Los dos CTA "Armo un evento" de
`42b794e` están intactos. El comentario de `page.tsx:381` sobre SOMOS DER como
productora de eventos se quedó, que es un hecho.

**Desborde medido de verdad, en los cuatro anchos.** Se midió el Range de cada
nodo de texto contra el borde de su contenedor, que es la técnica de `42b794e`
(`scrollWidth` da 0 igual). Resultado a 360, 390, 768 y 1280: **desborde de
página 0px y 0 textos recortados** en los cuatro, con 114 nodos de texto
recorridos y la copy nueva confirmada presente en el DOM.

Cómo se hizo, por si hay que repetirlo: no hay Playwright instalado y **el
Chromium headless no baja de 500px de viewport**, así que las capturas "de
celular" mienten. Se usó una página de medición temporal servida desde `public/`
(mismo origen, para poder leer el DOM del iframe) que carga la landing en un
iframe del ancho pedido, la recorre entera para disparar los `Reveal` y mide.
**La herramienta se borró antes de commitear** y nunca entró a git.

Dos trampas que aparecieron ahí y valen para la próxima:
- Los `Reveal` no disparan en headless: quedan en `opacity: 0` y con transform, y
  sus `Range` miden 0, así que el medidor los saltea en silencio y reporta "cero
  recortes" habiendo mirado solo el hero. Hay que forzarlos visibles.
- `innerText` aplica `text-transform`, así que buscar "Armás eventos" da `false`
  cuando en pantalla dice "ARMÁS EVENTOS".

## Tarea 5: teléfono y el mail honesto

Migración **0069 escrita, sin aplicar**. Columna `telefono` en
`staff_app.organizations` y la RPC la guarda.

**Con el cambio que aprobó Franco:** el parámetro entra como
`p_telefono text DEFAULT NULL`, así que una llamada de dos argumentos (el código
que hoy corre en producción) resuelve contra la función nueva y una de tres
también. **El orden de deploy dejó de importar y no queda ninguna ventana con el
alta rota.** Por eso mismo la migración dropea explícitamente la firma vieja
`(text, text)` antes de crear la de tres: con las dos vivas, una llamada de dos
argumentos se vuelve ambigua y Postgres tira error. Molde copiado de la 0036. El
porqué del parámetro opcional quedó escrito en el header de la migración, para
que nadie lo "arregle" volviéndolo obligatorio.

Tres campos nuevos con el patrón visual y de código de `/registrar-proveedor`:
teléfono obligatorio, "Qué eventos armás" (texto libre, a propósito no una
taxonomía cerrada) y "Cuántos eventos por año" (cuatro rangos), los dos
opcionales. El teléfono va a la base; los otros dos solo al aviso de Telegram.

**El bug del mail, arreglado.** `mailOk` se calculaba y se tiraba: la acción
devolvía `{ ok: true }` pelado y la pantalla afirmaba SIEMPRE "Le mandamos un
mail". Ahora vuelve con el resultado y el bloque de `listo` tiene dos caras
(molde de `offer-form.tsx`, un solo `useState<boolean | null>` y no dos booleanos
sueltos): si el mail no salió lo dice, ofrece entrar por `/entrar` a pedir el
link, y avisa que ya tenemos el teléfono, que es justamente por qué ahora se pide.

---

## Desviaciones del plan

**1. `/dev-login-staff` no cambió de cuenta (Tarea 1).** El plan daba dos
salidas; se tomó la segunda (fallar diciendo qué pasa) en vez de la primera
(apuntar a una cuenta de staff real), porque un atajo de desarrollo no puede
impersonar a un trabajador del pool. La causa raíz del error de JSON quedó
documentada en el header.

**2. Se abrió también el eyebrow "04 // Productores" (Tarea 4).** No estaba en la
lista explícita del plan, pero el triage decía "lo visible se abre" y era la
última palabra "Productores" visible en la landing. Pasó a "04 // Tu consulta",
más corta que la anterior, así que cero riesgo de desborde.

**3. Casi se rompe el slug de la 0069.** La regla "los SQL van sin acentos" se
aplicó de más y por un momento el literal de origen de `translate()` quedó sin
acentos, lo que habría dejado de limpiar los nombres con tilde. Se detectó antes
de commitear, se restauró idéntico al de la 0056 y quedó un comentario al lado
diciendo que ese literal es tabla de datos y no prosa.

**4. `npm run build` se llevó puesto el server de desarrollo.** Correr `build`
mientras hay un `next dev` vivo pisa `.next` y el dev empieza a tirar
`__webpack_modules__[moduleId] is not a function`. Se reinició el server de
pruebas; el de Franco en el puerto 3000 se verificó al final y responde 200.

---

## Lo que no se pudo verificar y por qué

- **El botón "Cobrar al cliente" en el tablero.** La organización SOMOS DER no
  tiene ningún gig cargado en esta base, así que `/tablero` está vacío. El
  cambio es un `&&` con una constante `false` y `typecheck`/`build` pasan, pero
  la comprobación visual queda para Franco cuando haya un evento con ingreso del
  cliente cargado.
- **Los puntos 2 a 6 del chequeo humano de la Tarea 5.** El alta real crearía una
  organización de verdad y mandaría un mail de verdad, así que no se ejecutó.
  Además la 0069 todavía no está aplicada. Lo que sí se verificó: los tres campos
  renderizan, el teléfono sale con `required` en el HTML y los dos opcionales
  sin él.

---

## Pendiente para Franco

1. **Aplicar las dos migraciones, en orden: 0068 y después 0069.**
2. **Ninguna de las dos tiene orden de deploy.** Se pueden aplicar antes o después
   de deployar, en cualquier combinación:
   - La **0069** ya no lo tiene por el `DEFAULT NULL` que aprobaste: el código
     viejo, que llama con dos argumentos, sigue resolviendo.
   - La **0068** nunca lo tuvo: la firma no cambia. Con el código viejo, la RPC
     nueva ya rechaza monto y fecha faltantes; con el código nuevo y la RPC
     vieja, la validación del server action tapa el mismo agujero.
3. **Después de aplicar la 0069**, probar el alta de productora entera: mandar sin
   teléfono (tiene que frenar), mandar con los dos opcionales vacíos (tiene que
   funcionar), y mirar que el aviso de Telegram llegue con los datos nuevos.
4. `LABURO_DEV_BYPASS=1` quedó agregada al `.env.local` local. Está gitignoreada,
   no se commiteó y no existe en Vercel.
5. **El commit `42b794e` sigue sin pushear, igual que los cinco nuevos.** Son seis
   commits esperando.
6. **Los ~40 archivos de `testsprite_tests/` quedaron exactamente como estaban**,
   sin commitear, sin borrar y sin sumar al `.gitignore`. La modificación de
   `.gitignore` que ya estaba en el working tree tampoco se tocó.
7. Para el día que se prenda el cobro: `lib/cobros.ts` en `true`, más las tres
   piezas que ahora están escritas en `COBROS.md`.
8. `/dev-login-staff` sigue sin poder entrar al panel: falta cargar la ficha de
   `ridaofrancorg+staff@gmail.com` desde `/sumate`. La ruta ahora lo dice sola.
