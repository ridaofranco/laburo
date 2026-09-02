---
fase: quick/260902-i2g-gratis-y-arreglos-para-salir
tipo: execute
modo: quick
autonomo: false
migraciones_pendientes: [0068, 0069]
archivos:
  - app/dev-login/route.ts
  - app/dev-login-staff/route.ts
  - lib/cobros.ts
  - app/(portal)/tablero/payment-actions.ts
  - app/(portal)/tablero/gig-board.tsx
  - COBROS.md
  - supabase/migrations/staff_app_0068_la_oferta_exige_monto_y_fecha.sql
  - app/(portal)/staff/[id]/offer-actions.ts
  - app/(portal)/staff/[id]/oferta/offer-form.tsx
  - app/page.tsx
  - app/registrarme/page.tsx
  - app/entrar/page.tsx
  - app/entrar/entrar-client.tsx
  - app/registrar-productora/page.tsx
  - app/registrar-productora/registro-client.tsx
  - app/registrar-productora/actions.ts
  - supabase/migrations/staff_app_0069_la_productora_deja_su_telefono.sql
---

<objective>
LABURO pasa a ser GRATIS para todos por ahora (no cobra comisión ni acceso) y se
cierran los arreglos que bloquean salir a buscar usuarios.

Cinco tareas, cinco commits atómicos, en el orden de abajo. Todo lo que sigue
está verificado contra el código y contra la base, no es hipótesis.

Salida: el cobro fuera del camino sin borrar una línea de MercadoPago, la oferta
imposible de crear rota desde un POST, la puerta de alta ancha (productoras,
agencias, marcas, empresas, particulares) y con teléfono, y el atajo de
desarrollo entrando con la cuenta que sí tiene acceso.
</objective>

<reglas_duras>
1. Español rioplatense en comentarios, UI y mensajes de commit.
2. Sin guiones largos en texto NUEVO. No salgas a limpiar los que ya existen en
   archivos que tocás (el repo está lleno y no es el trabajo de hoy).
3. Un commit por tarea. Nada de commits mezclados.
4. Las migraciones se ESCRIBEN, no se aplican. Franco las aplica.
5. Nada de `git push`.
6. Seguí las convenciones del archivo que tocás. Este repo documenta el POR QUÉ
   de cada decisión en el header del archivo: mantené ese estándar.
7. Los SQL de `supabase/migrations/` van SIN acentos (mirá la 0067). El código
   TypeScript sí lleva acentos.
</reglas_duras>

<orden_y_por_que>
El orden no es el del pedido: es el que hace que cada tarea se pueda verificar.

1. dev-login. Va primero porque sin él no se puede entrar al portal, y las
   tareas 2 y 3 se verifican adentro del portal (/tablero y /staff/[id]/oferta).
2. Cobro fuera del camino (+ COBROS.md).
3. Monto y fecha de la oferta (migración 0068 + server action + copy).
4. La puerta ancha: copy de toda la cadena de alta.
5. Alta de productora: campos nuevos + `mailOk` honesto (migración 0069).

Las tareas 4 y 5 tocan las MISMAS dos pantallas, así que van seguidas y en ese
orden. Regla de propiedad para no pisarse:
- La tarea 4 toca SOLO strings visibles (títulos, eyebrows, labels, bajadas,
  metadata). No agrega campos ni toca el header de comentario del archivo.
- La tarea 5 agrega los campos, cambia el estado de "listo" y reescribe el
  header de comentario de `registro-client.tsx` (que hoy dice "dos campos y
  listo" y deja de ser cierto recién ahí).
</orden_y_por_que>

<hallazgos_previos>
Dos cosas que aparecieron auditando y que cambian cómo se verifica:

**`LABURO_DEV_BYPASS` NO está en `.env.local`.** Hoy el archivo tiene solo
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY`. Con eso, `/dev-login` y
`/dev-login-staff` devuelven 404 en la línea 22 antes de hacer nada. Paso cero
de la tarea 1: agregar `LABURO_DEV_BYPASS=1` a `.env.local` (que está
gitigmoreado, no se commitea). Sin eso no se puede reproducir ningún bug de esas
dos rutas.

**`SUPABASE_SERVICE_ROLE_KEY` sí está cargada.** O sea que el
`Unexpected end of JSON input` de `/dev-login-staff` NO es el throw de
`createServiceRoleClient()` (que además tira un mensaje explícito, no un error
de JSON). Hay que buscar en otro lado.
</hallazgos_previos>

<tasks>

<task type="auto" n="1">
  <name>Tarea 1: dev-login entra con la cuenta que tiene acceso</name>

  <files>
    app/dev-login/route.ts
    app/dev-login-staff/route.ts
    .env.local (NO se commitea, está gitignoreado)
  </files>

  <action>
  Paso cero: agregar `LABURO_DEV_BYPASS=1` a `.env.local`. Sin eso las dos rutas
  devuelven 404 (route.ts:22) y no se puede reproducir nada. NO se commitea.

  **`app/dev-login/route.ts`:** cambiar la constante de la línea 18:
  `ADMIN_EMAIL = "ridaofrancorg@gmail.com"` pasa a `"franco@somosder.ar"`.

  Verificado contra la base: `ridaofrancorg@gmail.com` no es miembro de ninguna
  organización (rol nulo, organización nula), así que el atajo generaba la
  sesión bien y aterrizaba en "Esta cuenta no tiene acceso.". `franco@somosder.ar`
  es owner de la organización SOMOS DER, que tiene `es_plataforma = true`.

  Actualizar el comentario del header, que dice "el admin ya sembrado": ahora
  tiene que decir cuál es la cuenta y POR QUÉ es esa (owner de SOMOS DER, la org
  de plataforma). Ese dato es justamente el que se perdió y costó el bug.

  **`app/dev-login-staff/route.ts`:** investigar el `Unexpected end of JSON input`.
  Ese error es un `JSON.parse` sobre un cuerpo vacío, así que no es el throw de
  `createServiceRoleClient` (que además tiene mensaje propio) ni un 404. Revisar
  en este orden, ejecutando de verdad y mirando el error crudo:

  1. Si `ridaofrancorg+staff@gmail.com` existe como `auth.user`. La ruta llama
     `admin.auth.admin.createUser` (línea 29) que es idempotente por diseño, pero
     el filtro de la línea 34 solo tolera `already|registered|exists`: cualquier
     otro fallo devuelve 500 con el mensaje, no un error de JSON.
  2. Si el error sale de `createUser` o de `generateLink`: envolvé cada llamada
     en su propio try/catch temporal y logueá el error crudo con
     `console.error(e)` para saber cuál de las dos revienta. Un throw sin
     capturar adentro del handler es lo que produce el error de JSON del lado
     del browser.
  3. Si esa cuenta tiene fila en `staff_profiles`. Si no la tiene, la ruta puede
     estar entrando bien y el que falla es `/panel-staff`. Ahí el arreglo no es
     esta ruta.

  Arreglo mínimo según lo que aparezca:
  - Si es un problema de cuenta (como el de `/dev-login`), corregí la constante
    `STAFF_EMAIL` a la cuenta de staff real que sí tiene ficha, y documentá cuál
    y por qué en el header.
  - Si es un throw sin capturar, envolvé el handler para que devuelva un 500 con
    el mensaje real en vez de reventar. Un atajo de desarrollo que falla tiene
    que decir qué le pasó: es literalmente su único trabajo.

  No agregues dependencias ni refactorices las rutas. Es un arreglo de una línea
  más una investigación acotada.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint</automated>
    <human-check>
      1. `npm run dev`, ir a http://localhost:3000/dev-login
      2. Tiene que aterrizar en /dashboard CON datos, no en "Esta cuenta no tiene acceso."
      3. Ir a http://localhost:3000/dev-login-staff
      4. Tiene que aterrizar en /panel-staff, o devolver un 500 con un mensaje
         que diga qué falló. Lo que NO puede pasar es `Unexpected end of JSON input`.
    </human-check>
  </verify>

  <done>
  /dev-login entra al portal como owner de SOMOS DER. /dev-login-staff entra al
  panel de staff, o falla diciendo exactamente qué le pasa. El header de cada
  ruta dice cuál es la cuenta y por qué es esa.
  </done>

  <commit>fix(dev-login): el atajo entraba con una cuenta sin organizacion</commit>
</task>

<task type="auto" n="2">
  <name>Tarea 2: el cobro sale del camino sin borrar una línea de MercadoPago</name>

  <files>
    lib/cobros.ts (nuevo)
    app/(portal)/tablero/payment-actions.ts
    app/(portal)/tablero/gig-board.tsx
    COBROS.md
  </files>

  <action>
  Decisión de producto de Franco: LABURO es GRATIS para todos por ahora. No cobra
  comisión ni acceso. El circuito de MercadoPago funciona y es trabajo válido
  para más adelante, así que NO se borra nada. Se apaga con una bandera.

  **Nuevo `lib/cobros.ts`.** Un módulo chiquito con la bandera y el motivo.

  Por qué un módulo aparte y no una constante adentro de `payment-actions.ts`:
  ese archivo es `"use server"` y un archivo `"use server"` solo puede exportar
  funciones async. Es exactamente el problema que ya resolvió `lib/pago.ts`
  cuando `PAGO_TEXTO` necesitó un segundo consumidor (está escrito en su header).
  Además `gig-board.tsx` es un componente cliente y necesita leer la bandera.
  Seguí ese molde: mismo tono de header, misma idea de "si esto cambia, se
  cambia SOLO acá".

  El header tiene que decir, en criollo: que es una decisión de producto y no una
  limitación técnica, la fecha, y CÓMO SE REVIERTE (poner la constante en `true`
  y repasar COBROS.md). Nada de sistema de feature flags: es una constante
  booleana y un string.

  Exportar dos cosas:
  - `COBRO_AL_CLIENTE_ACTIVO = false`
  - el motivo que se le muestra a la productora si igual llega a llamarlo

  **`payment-actions.ts`:** primerísima línea de `createClientCheckout`, ANTES de
  leer `MP_ACCESS_TOKEN` (línea 23), cortar con la bandera devolviendo
  `{ ok: false, reason: <el motivo> }`. Una server action es un endpoint POST
  invocable: esconder el botón no alcanza, tiene que fallar explícito del lado
  del servidor. Sumá una línea al header del archivo diciendo que el circuito
  está entero pero apagado por decisión de producto, con el puntero a
  `lib/cobros.ts`.

  **`gig-board.tsx`:** línea 136, sumar la bandera como primer término:
  `const puedeCobrar = COBRO_AL_CLIENTE_ACTIVO && (Number(gig.client_budget) || 0) > 0 && !cobrado;`

  Ojo: NO toques la rama de `cobrado` (línea 226 entra por `puedeCobrar` recién
  después de otra condición). Un gig que ya figure cobrado tiene que seguir
  mostrando su estado; lo que desaparece es el botón "Cobrar al cliente".

  **`COBROS.md`:** hoy MIENTE y está verificado. Las líneas 11 a 13 dicen que
  borrar `MP_SANDBOX` es "lo único que separa a LABURO de facturar de verdad".
  Es falso por tres razones, todas verificadas:

  1. `MP_ACCESS_TOKEN` no está cargada. `payment-actions.ts:23-24` corta antes de
     hacer nada y devuelve "MercadoPago no está configurado todavía."
  2. `MP_WEBHOOK_SECRET` no está cargada. `webhook/route.ts:38-39` hace
     `if (!secret) return true`: sin ella la verificación de firma se saltea
     ENTERA, no se degrada, se saltea. Está escrito a propósito y documentado en
     el header del webhook, pero COBROS.md no lo cuenta.
  3. Nada verifica que el token sea de producción. `payment-actions.ts:69-70`
     elige sandbox por `NODE_ENV` y `MP_SANDBOX`, nunca por el prefijo `TEST-`
     del token. Con un token de prueba y `MP_SANDBOX` borrada, `init_point`
     viene igual y se entrega un link de pago DE PRUEBA como si fuera real, sin
     un solo aviso.

  Reescribir:
  - El bloque de advertencia de las líneas 11 a 13: reemplazarlo por el estado
    real. Que arranque diciendo que LABURO es gratis por decisión de producto y
    que el cobro está apagado en `lib/cobros.ts`, y que ADEMÁS faltan las tres
    piezas de arriba. Las cuatro reglas de más abajo (que están todas en verde y
    son trabajo bien hecho) no se tocan.
  - La sección "Antes de sacar `MP_SANDBOX`" (línea 71): pasa a llamarse algo
    tipo "Antes de prender el cobro" y lista, como checklist, las tres piezas
    faltantes MÁS poner la bandera en `true`. Dejá la quinta regla que ya está
    escrita (que avise por Telegram cuando algo falle).

  Este archivo vive en tres repos (ENTRÁ, LABURO, PASE). Lo que cambiás es el
  estado de LABURO, no las cuatro reglas compartidas.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -rn "createClientCheckout\|MercadoPago" "app/(portal)/tablero/payment-actions.ts" | head -3</automated>
    <human-check>
      1. /dev-login, ir a /tablero
      2. Un gig con "ingreso del cliente" cargado y sin cobrar NO muestra el
         botón "Cobrar al cliente"
      3. Un gig ya marcado como cobrado sigue mostrando su estado igual que antes
      4. Leer COBROS.md de arriba a abajo: no puede quedar ninguna frase que diga
         que borrar MP_SANDBOX alcanza para facturar
    </human-check>
  </verify>

  <done>
  El botón no se ofrece, la server action corta explícito si la llaman igual,
  el código de MercadoPago está entero y sin tocar, y COBROS.md dice la verdad:
  gratis por decisión, y tres piezas faltantes para el día que se prenda.
  </done>

  <commit>feat(cobros): LABURO es gratis, el cobro se apaga con una bandera</commit>
</task>

<task type="auto" n="3">
  <name>Tarea 3: la oferta exige monto y fecha en la base, no solo en el navegador</name>

  <files>
    supabase/migrations/staff_app_0068_la_oferta_exige_monto_y_fecha.sql (nuevo, NO aplicar)
    app/(portal)/staff/[id]/offer-actions.ts
    app/(portal)/staff/[id]/oferta/offer-form.tsx
  </files>

  <action>
  Verificado contra la función que corre en producción (definida en
  `staff_app_0036_org_rpcs_productora.sql:361`): `public.staff_app_create_offer`
  valida `role_required` (línea 398) y `gig_required` (línea 405), pero NO valida
  `p_amount` ni `p_gig_starts_at`. El formulario sí frena
  (`offer-form.tsx:124-140`), pero una server action es un endpoint POST
  invocable: se puede crear una oferta con monto nulo y evento sin fecha. Es el
  bug del 18/07 y sigue vivo a medias.

  **Migración `supabase/migrations/staff_app_0068_la_oferta_exige_monto_y_fecha.sql`.**

  Convención confirmada mirando la 0067: header `-- staff_app_0068_<nombre>`,
  después el relato en criollo de qué pasaba y por qué, SIN acentos en todo el
  archivo SQL.

  La firma no cambia (11 parámetros), así que alcanza `CREATE OR REPLACE` y los
  grants se mantienen. Re-emitilos igual junto con el `COMMENT`, que es lo que
  hace la 0036 ("se re-emiten igual, por las dudas").

  Dos guardas, con el mismo estilo de retorno que las que ya están
  (`jsonb_build_object('ok', false, 'reason', '<motivo>')`):

  1. **Monto.** Justo después del chequeo de `role_required` (línea 398), antes
     de crear nada: si `p_amount IS NULL OR p_amount <= 0` devolver
     `amount_required`. Va ahí arriba a propósito: si va más abajo, el
     quick-create ya insertó el gig y queda un evento huérfano, que es
     exactamente lo que la propia función explica que vino a evitar (comentario
     de la línea 402).

  2. **Fecha.** Tiene dos ramas y las dos hay que cubrirlas, igual que hace el
     formulario:
     - Rama quick-create (`v_gig IS NULL`, línea 404): además de
       `gig_required`, si `p_gig_starts_at IS NULL` devolver
       `gig_starts_at_required`, ANTES del INSERT.
     - Rama de evento elegido (`ELSE`, línea 411): hoy hace
       `PERFORM 1 FROM gigs WHERE id = v_gig AND organization_id = v_org`.
       Cambialo por un `SELECT starts_at INTO v_starts FROM gigs WHERE ...`
       (que setea `FOUND` igual, así que el `IF NOT FOUND` de la línea 414 sigue
       funcionando tal cual), y sumá después: si `v_starts IS NULL` devolver
       `gig_starts_at_required`. Declarar `v_starts timestamptz` en el DECLARE.

  ⚠️ ESTA MIGRACIÓN QUEDA PENDIENTE DE APLICAR. La escribís y ahí termina tu
  trabajo. Franco la aplica.

  **`app/(portal)/staff/[id]/offer-actions.ts`.** Hoy, entre las líneas 83 y 103,
  solo hace `exigirOrg()` y le pasa el input crudo a la RPC. Sumá la validación
  en servidor con el molde EXACTO de `rating-actions.ts:52-61` (mismo lugar,
  mismo comentario numerado, mismo estilo de retorno): después de `exigirOrg()`
  y antes del `supabase.rpc(...)`, un bloque "2. Validación server-side" que
  chequee rol no vacío, monto finito y mayor a cero, y `gigStartsAt` presente.
  Renumerá los pasos del comentario del header y del cuerpo (el que hoy es 2
  pasa a 3, y así).

  Y el segundo pedazo: hoy, cuando la RPC dice que no, la línea 109 devuelve
  `res.reason` crudo, y `offer-form.tsx:176` lo pinta tal cual en pantalla. O sea
  que la productora lee "role_required" o "candidate_not_found". Agregá un
  `Record<string, string>` que traduzca los motivos de la RPC a castellano
  legible, y usalo en ese return con fallback al texto genérico que ya está.
  Cubrí los que devuelve la función: `no_org`, `forbidden`, `role_required`,
  `gig_required`, `gig_not_found`, `candidate_not_found`, más los dos nuevos
  `amount_required` y `gig_starts_at_required`. El molde de traducción por
  motivo ya existe en `app/registrar-proveedor/actions.ts:133-141`.

  **`app/(portal)/staff/[id]/oferta/offer-form.tsx`: el copy que miente.**
  La línea 368 rotula el monto como "Pago informativo, opcional." y la 335 la
  fecha como "Cuándo arranca el gig (opcional)." pero las líneas 124 a 136
  bloquean el submit sin los dos. Corregí los dos rótulos para que digan la
  verdad (el monto va en la propuesta que lee el candidato, la fecha también) y
  sumá `required` a los dos inputs, igual que ya lo tiene el input de rol
  (línea 361). NO toques la lógica de validación del cliente: ya está bien, el
  problema era el rótulo.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -c "amount_required\|gig_starts_at_required" supabase/migrations/staff_app_0068_la_oferta_exige_monto_y_fecha.sql</automated>
    <human-check>
      1. /dev-login, ir a /staff/[id]/oferta de cualquier candidato
      2. Ningún campo dice "opcional" si el formulario lo exige
      3. Mandar sin monto: frena con mensaje legible
      4. Mandar con monto y fecha: la oferta se crea igual que antes
      5. Cuando Franco aplique la 0068, reintentar el caso del POST directo sin
         monto: tiene que volver "Poné el monto..." y no crearse ninguna oferta
    </human-check>
  </verify>

  <done>
  La migración 0068 está escrita (sin aplicar) y agrega las dos guardas.
  `offer-actions.ts` valida antes de llamar a la RPC y traduce los motivos.
  Ningún rótulo del formulario dice "opcional" sobre un campo obligatorio.
  </done>

  <commit>fix(ofertas): el monto y la fecha se validan en la base, no solo en el navegador</commit>
</task>

<task type="auto" n="4">
  <name>Tarea 4: la puerta es ancha, y el lenguaje también</name>

  <files>
    app/page.tsx
    app/registrarme/page.tsx
    app/entrar/page.tsx
    app/entrar/entrar-client.tsx
    app/registrar-productora/page.tsx
    app/registrar-productora/registro-client.tsx
  </files>

  <action>
  Decisión de Franco: "productoras o agencias, quien sea que necesite staff". El
  que necesita staff puede ser una agencia de marketing, una marca armando su
  fiesta de fin de año, un wedding planner, un salón que organiza su propio
  evento, una empresa o un particular. Todos leen "productora" y asumen que no es
  para ellos. Productoras hay pocas; gente que necesita staff hay muchísima.

  ⚠️ **LEER PRIMERO EL COMMIT 42b794e.** `git show 42b794e` (está commiteado y
  SIN pushear). Ya cambió los dos botones primarios de la landing de "Necesito
  staff" a "Armo un evento", el mensaje precargado de WhatsApp y el ejemplo del
  formulario. Franco venía intuyendo lo mismo. NO lo repitas ni lo pises:
  construí encima.

  Ese mismo commit arregló cuatro textos que se cortaban en producción, midiendo
  con el Range del texto contra el borde del contenedor (scrollWidth da 0 igual).
  Son el hero, las cifras, el proceso y el formulario. Toda copy más larga que la
  actual en esa página puede volver a desbordar sin dar ningún error. Está en la
  verificación.

  **NO se renombran rutas ni archivos.** `/registrar-productora` se queda como
  está: cambiar la URL rompe links y no aporta. **Y el nombre interno del
  concepto tampoco se toca**: `organizations`, `productora`, el tipo `Rol`, los
  ids de las opciones y el querystring `?c=productora` (`entrar-client.tsx:111`)
  quedan igual. Esto es capa de usuario, no arquitectura.

  Punto de partida: `grep -rn "productora\|Productora\|Productores" app/page.tsx
  app/registrarme app/entrar app/registrar-productora app/landing`. Triage: lo
  que está adentro de un comentario de código es historia y se deja. Lo visible
  se abre. Una excepción confirmada: `app/page.tsx:381` dice "LABURO nace adentro
  de SOMOS DER, productora de eventos", que es un hecho sobre SOMOS DER y se
  queda tal cual.

  **`app/registrar-productora/page.tsx`:** `title` y `description` de la metadata
  se abren. Hoy el title es "Creá la cuenta de tu productora".

  **`app/registrar-productora/registro-client.tsx`** (solo strings visibles):
  - eyebrow línea 61: "Para productoras" se abre.
  - bajada líneas 82 a 84: hoy dice "Cargá tus eventos, publicá qué personal
    necesitás y recibí a la gente que quiere trabajar. Publicar es gratis.". Que
    nombre a los otros: productora, agencia, marca, empresa. Que se note que la
    puerta es ancha en la primera línea que se lee.
  - label línea 88: "Nombre de tu productora *" pasa a "Nombre de tu productora o
    empresa *".
  - el pie "¿Trabajás en eventos? Entrá como staff" (línea 149) se queda: es la
    salida para el que se equivocó de puerta y sigue sirviendo.
  - NO toques el header de comentario ni el bloque de "listo": son de la tarea 5.

  **`app/registrarme/page.tsx`:** la opción 0 (líneas 36 a 42). La bajada dice
  "Soy productora o empresa" y el cta "Crear la cuenta de mi productora". Abrí
  las dos. El cta puede pasar a algo neutro tipo "Crear mi cuenta".

  **`app/entrar/entrar-client.tsx`:** `ROLES[0]` (líneas 54 a 58): el título "Soy
  productora" define a la persona por lo que ES y ahí se pierde la agencia y la
  marca. Pasalo a definirla por lo que HACE (armar eventos), y que la bajada
  nombre los casos. Y `ALTA.productora.texto` (línea 85), mismo criterio que el
  cta de /registrarme. El id `"productora"` NO se toca.

  **`app/entrar/page.tsx`:** la `description` de la línea 21 ("Entrá a LABURO como
  productora, como staff o como proveedor") se abre. Ojo que además se olvida de
  los salones, que ya son el cuarto pool.

  **`app/page.tsx`:** leé el bloque de las cuatro tarjetas (líneas 445 a 545).
  - Tarjeta 1: el eyebrow "Productores" (línea 452) se abre. El h3 "Necesitás
    staff" está bien porque nombra la NECESIDAD y no la identidad: dejalo. El
    párrafo de abajo se abre para nombrar agencia, marca y empresa.
  - Tarjeta de proveedores, línea 519: "y las productoras te encuentran cuando
    arman un evento". Sacale el "las productoras" y dejá quién arma el evento.
  - Los comentarios de las líneas 463 a 467 y 577 son historia: se dejan.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run build</automated>
    <human-check>
      1. Recorrer la cadena entera en el navegador: / , /registrarme , /entrar ,
         /registrar-productora. En ninguna pantalla puede quedar la sensación de
         que hay que ser productora para usar LABURO.
      2. Los dos botones primarios de la landing siguen diciendo "Armo un evento"
         (los del commit 42b794e, intactos).
      3. ⚠️ Medir desborde de texto en la landing a 360, 390, 768 y 1280 px, que
         son los anchos donde 42b794e encontró los cuatro recortes. Cero textos
         cortados, cero desborde. Si alguna copy nueva desborda, se acorta la
         copy, no se toca el breakpoint que ese commit dejó calibrado.
      4. `git diff` no puede mostrar ninguna ruta ni ningún id renombrado.
    </human-check>
  </verify>

  <done>
  La cadena entera de alta habla de quien arma eventos, no solo de productoras.
  Ninguna ruta, ningún archivo y ningún nombre interno cambió. El trabajo de
  42b794e sigue intacto y la landing no desborda en ningún ancho.
  </done>

  <commit>feat(alta): la puerta se abre a quien sea que necesite staff, no solo a productoras</commit>
</task>

<task type="auto" n="5">
  <name>Tarea 5: el alta pide teléfono y deja de mentir sobre el mail</name>

  <files>
    supabase/migrations/staff_app_0069_la_productora_deja_su_telefono.sql (nuevo, NO aplicar)
    app/registrar-productora/registro-client.tsx
    app/registrar-productora/actions.ts
  </files>

  <action>
  Verificado: el alta de productora pide SOLO 2 campos (nombre y email,
  `registro-client.tsx:87-113`). Comparado con el resto: `/sumate` pide 18 campos
  más CV, `/registrar-salon` pide 13, `/registrar-proveedor` pide 9. Los tres
  piden teléfono. La productora, que es la punta que da volumen, no.

  **DECISIÓN 1: qué se pide.** Tres campos nuevos, uno solo obligatorio. La
  productora es la que menos fricción tiene que tener: el objetivo es no
  perderla, no interrogarla.

  1. **Teléfono / WhatsApp. OBLIGATORIO.** Es el más importante y el que
     justifica todo lo demás: hoy, si el mail no le llega, no hay forma de
     recuperar a esa productora. Las otras tres altas tienen teléfono; la oferta
     al staff tiene respaldo por WhatsApp; esta alta no tiene ningún respaldo.
  2. **"Qué eventos armás". Texto libre de una línea, opcional.** Molde del
     `headline` de `/registrar-proveedor` (líneas 213 a 222), con placeholder
     tipo "Ej: casamientos y eventos corporativos". A propósito NO es una lista
     de chips ni un select: la tarea 4 acaba de abrir la puerta a agencias,
     marcas y particulares, y meterlos en una taxonomía cerrada los vuelve a
     dejar afuera. El texto libre es la versión coherente con esa decisión.
  3. **Cuántos eventos por año. `select`, opcional.** Molde del select de
     provincia de `/registrar-proveedor` (líneas 257 a 273). Cuatro opciones,
     rangos y no números exactos: "Es mi primer evento", "1 a 3 por año",
     "4 a 12 por año", "Más de 12 por año". Es la pregunta que le dice a Franco
     con quién está hablando antes de la primera charla.

  Nada más. Ni CUIT, ni dirección, ni web. Se piden cuando sirvan para algo.

  Los tres campos van con el MISMO patrón visual y de código que
  `/registrar-proveedor` y `/registrar-salon` (mismas clases `input` y `label`,
  mismo orden nombre / email / teléfono, mismo `autoComplete`). Los tres
  formularios tienen que sentirse de la misma familia.

  **DECISIÓN 2: qué se persiste.** El teléfono SÍ va a la base. El tipo de
  eventos y el volumen van SOLO en el aviso interno a Franco.

  Por qué partido y no todo a un lado: el teléfono es el dato de RECUPERACIÓN.
  Si vive solo en un mensaje de Telegram, no existe cuando hace falta, y además
  `/plataforma` (que es donde Franco mira quién se sumó) no puede mostrarlo
  nunca. Los otros dos son cualitativos, sirven para la primera conversación,
  ninguna pantalla los consume, y pagar una columna por ellos hoy es caro y
  prematuro. El aviso ya existe y ya lleva datos sueltos: sumarlos ahí cuesta
  dos líneas.

  **Migración `supabase/migrations/staff_app_0069_la_productora_deja_su_telefono.sql`.**
  Verificado: `staff_app.organizations` tiene `id`, `name`, `created_at` (0001),
  `slug`, `activa`, `is_default` (0035) y `es_plataforma` (0044). No hay teléfono.
  La RPC `public.staff_app_crear_productora(p_nombre text, p_email text)` (0056)
  toma solo esos dos parámetros y está granteada SOLO a `service_role`.

  Contenido, sin acentos y con el relato en el header como la 0067:
  1. `ALTER TABLE staff_app.organizations ADD COLUMN IF NOT EXISTS telefono text;`
  2. `DROP FUNCTION IF EXISTS public.staff_app_crear_productora(text, text);` y
     recrearla con `p_telefono text DEFAULT NULL`, guardándolo en el INSERT de la
     organización (línea 90 de la 0056). Todo lo demás de la función queda igual:
     mismo chequeo de `ya_tiene_cuenta`, misma invitación de owner, mismos
     retornos.
  3. Re-emitir `REVOKE ALL ... FROM public, anon, authenticated` y
     `GRANT EXECUTE ... TO service_role` con la firma NUEVA de tres parámetros, y
     el `COMMENT ON FUNCTION`. Esto no es opcional: al hacer DROP se van los
     grants viejos, y si no los reponés el alta queda muerta para service_role.

  ⚠️ **PENDIENTE DE APLICAR. El orden de deploy YA NO IMPORTA** (cambio aprobado
  por Franco el 2/9, durante la ejecución). El parámetro entra como
  `p_telefono text DEFAULT NULL`, así que una llamada de DOS argumentos (el
  código que hoy corre en producción) sigue resolviendo contra la función nueva,
  y una de TRES también. No queda ninguna ventana con el alta rota, se aplique
  antes o después del deploy.

  Por eso la migración TIENE que dropear explícitamente
  `public.staff_app_crear_productora(text, text)` antes de crear la de tres: con
  las dos vivas, una llamada de dos argumentos se vuelve ambigua y Postgres tira
  error. Molde: `staff_app_0036_org_rpcs_productora.sql`. Y el porqué del
  parámetro opcional va escrito en el header, para que nadie lo "arregle"
  volviéndolo obligatorio dentro de seis meses.

  **`app/registrar-productora/actions.ts`:**
  - Sumar los tres campos a la firma de `registrarProductora`. Validar el
    teléfono con el mismo criterio liviano que el email (no vacío después de
    trim), con mensaje en castellano en el mismo tono que los de las líneas 40 y
    41. La validación va ANTES del rate limit, igual que ahora.
  - Pasar `p_telefono` a la RPC.
  - Sumar tipo de eventos y volumen a los `datos` del `alerta()` (líneas 125 a
    131), con las mismas claves en criollo que ya usa ("le llegó el mail",
    "ya se había registrado"). Si vienen vacíos, no los mandes.

  **EL BUG DEL MAIL, confirmado.** Las líneas 99 a 108 capturan `mailOk` (si el
  mail salió o no) y la línea 134 devuelve `{ ok: true }` pelado, tirando ese
  dato a la basura. La pantalla (`registro-client.tsx:66-71`) entonces afirma
  SIEMPRE "Le mandamos un mail" aunque no haya salido.

  Arreglo, con el molde que el repo YA resuelve bien en la oferta:
  - `actions.ts`: devolver `{ ok: true, mailOk }`. Es el mismo criterio del
    "estado honesto" de `offer-actions.ts:156-157`, que devuelve `ok: true` con
    `mail.ok: false` adentro porque la oferta ya existe aunque el mail falle.
    Acá igual: la cuenta ya está creada, el mail es otra cosa.
  - `registro-client.tsx`: el bloque `listo` (líneas 64 a 78) pasa a tener dos
    caras, como hace `offer-form.tsx:200-227`:
    - Mail OK: lo que dice hoy.
    - Mail NO: "Tu cuenta quedó creada, pero el mail no salió." más qué hacer
      ahora. Que ofrezca el respaldo concreto: entrar por `/entrar` y pedir el
      link desde ahí, y avisar que Franco ya tiene el teléfono (que es
      justamente por qué ahora se pide). Copiá el tono de
      `offer-form.tsx:213-227`: la cosa quedó registrada igual, y acá está la
      salida.
    - Guardá `mailOk` en un estado (`useState<boolean | null>`) igual que
      `offer-form` guarda su `result`, no en dos booleanos sueltos.

  Y recién ahora reescribí el header de comentario del archivo, que hoy dice
  "dos campos y listo" y "el resto (teléfono, CUIT, dirección) se pide cuando
  sirva para algo". Deja de ser cierto: contá por qué el teléfono SÍ entró (es
  el canal de recuperación, y sin él una productora perdida es una productora
  perdida para siempre) y por qué los otros dos no se persisten.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -n "p_telefono\|GRANT EXECUTE" supabase/migrations/staff_app_0069_la_productora_deja_su_telefono.sql</automated>
    <human-check>
      1. /registrar-productora: se ven los tres campos nuevos y el formulario se
         siente de la misma familia que /registrar-proveedor y /registrar-salon
      2. Mandar sin teléfono: frena con mensaje en castellano
      3. Los dos campos opcionales se pueden dejar vacíos y el alta funciona
      4. Simular un fallo de mail (sacar la config de Resend en local): la
         pantalla tiene que decir "el mail no salió" y ofrecer el respaldo, NO
         "Le mandamos un mail"
      5. Con el mail andando: el mensaje de siempre
      6. El aviso de Telegram llega con los datos nuevos
      7. ⚠️ Los puntos 2 a 6 solo pasan DESPUÉS de que Franco aplique la 0069.
         Antes, la RPC no existe con esa firma y el alta devuelve error.
    </human-check>
  </verify>

  <done>
  El alta pide teléfono obligatorio y dos datos opcionales. El teléfono queda en
  la base, los otros dos en el aviso a Franco. La pantalla dice la verdad sobre
  si el mail salió o no. La migración 0069 está escrita y sin aplicar, con el
  orden de deploy documentado.
  </done>

  <commit>feat(alta-productora): el telefono, dos datos mas, y dejar de mentir sobre el mail</commit>
</task>

</tasks>

<verificacion_final>
Después de los cinco commits, antes de dar por cerrado:

1. `npm run typecheck && npm run lint && npm run build` en verde.
2. `git log --oneline -6`: cinco commits nuevos arriba de 42b794e, uno por tarea,
   ninguno mezclado.
3. `git status`: limpio salvo lo de testsprite que ya estaba antes.
4. Ningún `git push` ejecutado.
5. Ninguna migración aplicada. `supabase/migrations/` tiene dos archivos nuevos
   (0068 y 0069) y nada más.
6. `git diff 42b794e --stat` no muestra ninguna ruta ni archivo renombrado.
7. Grep de guiones largos en las líneas AGREGADAS:
   `git diff 42b794e -U0 | grep '^+' | grep '—'` tiene que dar vacío.
</verificacion_final>

<pendiente_para_franco>
Al terminar, decirle a Franco, en este orden:

1. **Dos migraciones para aplicar, en orden: 0068 y después 0069.**
2. **NINGUNA de las dos tiene orden de deploy.** Se pueden aplicar antes o
   después de deployar el código, en cualquier combinación, sin ventana rota.
   Verificado migración por migración:
   - **0069:** cambió respecto del plan original. El teléfono entra como
     `p_telefono text DEFAULT NULL` (cambio aprobado por Franco el 2/9), así que
     el código viejo, que llama con dos argumentos, sigue resolviendo contra la
     función nueva. La advertencia de "la 0069 va ANTES de deployar" YA NO
     APLICA. Lo que sí es obligatorio es el `DROP FUNCTION` de la firma vieja de
     dos parámetros, que la migración hace: sin él, una llamada de dos
     argumentos queda ambigua entre las dos firmas y Postgres tira error.
   - **0068:** nunca tuvo orden de deploy y sigue sin tenerlo. La firma no
     cambia (los mismos 11 parámetros), solo se agregan dos guardas. Con el
     código viejo, la RPC nueva ya rechaza el monto y la fecha faltantes; con el
     código nuevo y la RPC vieja, la validación del server action tapa el mismo
     agujero. Los dos ordenes funcionan.
3. `LABURO_DEV_BYPASS=1` quedó agregada al `.env.local` local (gitignoreada, no
   se commitea, no existe en Vercel).
4. El commit 42b794e sigue sin pushear, igual que los cinco nuevos.
5. Para el día que se prenda el cobro: `lib/cobros.ts` en `true`, más las tres
   piezas que ahora están escritas en COBROS.md (`MP_ACCESS_TOKEN`,
   `MP_WEBHOOK_SECRET`, y verificar que el token no sea `TEST-`).
</pendiente_para_franco>

<fuera_de_alcance>
Cosas que aparecieron y NO se tocan hoy, para que no se cuelen:

- Mostrar el teléfono de la productora en `/plataforma`. La columna queda
  disponible con la 0069, la pantalla es otro trabajo.
- Borrar o refactorizar el circuito de MercadoPago. Queda entero.
- Renombrar `/registrar-productora`, la tabla `organizations` o el tipo `Rol`.
- Limpiar los guiones largos que ya existen en el repo.
- Los cuatro breakpoints que calibró 42b794e. Se respetan.
</fuera_de_alcance>
