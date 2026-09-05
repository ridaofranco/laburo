---
fase: quick/260902-li2-los-seis-arreglos-que-faltaban
tipo: execute
modo: quick
autonomo: false
tandas: 3
tareas: 9
migraciones_pendientes: [0068, 0069, 0070]
base: 3373ae9
archivos:
  # Tanda 1
  - app/(portal)/staff/[id]/offer-actions.ts
  - lib/supabase/middleware.ts
  - lib/dates.ts
  - app/(portal)/staff/[id]/oferta/offer-form.tsx
  - app/(portal)/tablero/gig-form.tsx
  - app/api/cron/diario/route.ts
  # Tanda 2
  - lib/search-params.ts
  - app/(portal)/buscar/page.tsx
  - app/(portal)/buscar/search-client.tsx
  - app/registrar-salon/actions.ts
  - app/registrar-salon/registro-client.tsx
  - app/registrar-proveedor/actions.ts
  - app/registrar-proveedor/registro-client.tsx
  - supabase/migrations/staff_app_0070_las_fotos_del_salon.sql
  # Tanda 3
  - app/auth/callback/route.ts
  - app/acceso-staff/actions.ts
  - app/entrar/entrar-client.tsx
  - app/entrar/actions.ts
  - app/login/login-form.tsx
  - components/emails/link-de-acceso-email.tsx
---

<objective>
Los nueve arreglos que quedaron abiertos despues de la auditoria del 2/9. Todos
verificados contra el codigo y contra la base, ninguno es hipotesis.

La carpeta se llama "los seis arreglos" porque asi arranco la conversacion. Son
nueve. El nombre de la carpeta no se cambia.

Salida: la hora del evento deja de correrse tres horas, la busqueda deja de
esconder 999 fichas de 1.049, un cron roto deja de reportar exito, reinscribirse
deja de decir "listo" sin guardar nada, las fotos del salon quedan documentadas
en una migracion, el link de acceso deja de vencer siendo valido en los dos
caminos que faltaban, reguardar un evento deja de borrarle las coordenadas,
crear una oferta refresca las pantallas, y el proveedor sin sesion aterriza en su
solapa y no en el selector generico.
</objective>

<reglas_duras>
1. Español rioplatense en comentarios, UI y mensajes de commit. Sin guiones
   largos en texto NUEVO. No salgas a limpiar los que ya existen en archivos que
   tocas.
2. Un commit por tarea, atomico. Nueve tareas, nueve commits.
3. Las migraciones se ESCRIBEN, no se aplican. Franco las aplica. La numeracion
   libre arranca en 0070 (0068 y 0069 estan escritas y sin aplicar).
4. NADA de `git push`.
5. Hay ~40 archivos de `testsprite_tests/` modificados y sin seguimiento, y
   `.gitignore` modificado sin commitear. NO los toques, NO los commitees.
   `git add` archivo por archivo, NUNCA `git add .` ni `git add -A`.
6. El commit `42b794e` trae la landing con "Armo un evento" y cuatro breakpoints
   calibrados. No lo pises.
7. Los SQL de `supabase/migrations/` van SIN acentos (mira la 0067). El
   TypeScript SI lleva acentos. ⚠️ Cuidado con aplicar esa regla de mas: en la
   0069 casi se rompe un `translate()` que justamente quita tildes. Ese tipo de
   literal es tabla de datos, no prosa, y va identico al original.
8. Los mensajes de commit van sin acentos, igual que todos los del `git log`.
9. ⚠️ NO tocar las plantillas de mail de Supabase (`supabase/email-templates/`
   ni el panel). El proyecto lo comparten LABURO y HITO: cambiarlas arregla uno
   y rompe el login del otro.
10. Seguí las convenciones del archivo que tocas. Este repo documenta el POR QUE
    de cada decision en el header: manten ese estandar.
</reglas_duras>

<corte_recomendado>
⚠️ **NUEVE TAREAS NO ENTRAN EN UNA SOLA TANDA.** El presupuesto de contexto de
una ejecucion sana es ~50%, y la suma estimada de las nueve pasa el 110%. Ejecutar
todo de un tiron significa que las ultimas (que son las mas delicadas) las hace un
agente cansado. La Tarea 9 toca AUTENTICACION: si sale mal, nadie entra.

**Tres tandas, tres sesiones, `/clear` entre cada una.**

| Tanda | Tareas | Que las une | Contexto |
|-------|--------|-------------|----------|
| 1 | 1 a 5 (H, I, A, G, C) | Nada externo: puro codigo local, sin migraciones, sin auth, sin dependencias entre si | ~40% |
| 2 | 6 a 8 (B, D, E) | Superficie mas grande y una migracion que hay que extraer de produccion | ~45% |
| 3 | 9 (F) | Autenticacion sola, con contexto fresco y atencion entera | ~30% |

Cada tanda cierra con `typecheck`, `lint`, `build` en verde y sus commits hechos.
La Tanda 3 arranca solo si la 1 y la 2 quedaron verdes: asi, si despues del cambio
de auth alguien no puede entrar, se sabe con certeza que la causa es la Tarea 9 y
no otra cosa.

Si Franco pide todo de un tiron igual, se hace en este mismo orden y se para en
cuanto el contexto pase del 60%.
</corte_recomendado>

<orden_y_por_que>
El orden va de menor a mayor riesgo REAL, que no es el orden en el que aparecieron.

1. **Oferta sin revalidar (H).** Un archivo, tres lineas. Va primera a proposito:
   sin esto, verificar cualquier tarea posterior adentro del portal es enganoso,
   porque el router puede estar mostrando cache viejo y uno cree que su cambio no
   anduvo.
2. **`/mi-proveedor` publica (I).** Un archivo, una linea mas su auditoria de
   prefijos. Va segunda porque destraba probar a mano el camino del proveedor y
   del salon, que es justo lo que hace falta para verificar las Tareas 7 y 9.
3. **La hora corrida (A).** Dos archivos mas un helper compartido. Es el bug con
   consecuencia mas directa sobre una persona real (al candidato le llega mal la
   hora del evento al que tiene que ir).
4. **Las coordenadas borradas (G).** Misma zona que la 3 (el tablero), aislada, y
   se resuelve sin tocar la base.
5. **El cron mudo (C).** Un archivo, sin UI, sin migracion. Cierra la tanda 1.
6. **La paginacion (B).** Primera de la tanda 2: superficie mas grande (parseo de
   params, query, UI) y un parametro de URL nuevo que hay que validar como
   entrada no confiable, igual que los otros seis de ese archivo.
7. **Reinscribirse (D).** Dos altas a la vez (salon y proveedor), porque es
   literalmente el mismo bug con la misma forma en los dos.
8. **La migracion de las fotos (E).** Puro SQL, cero riesgo de runtime hoy
   (queda escrita sin aplicar), pero necesita extraer piezas de produccion, y por
   eso conviene hacerla con la cabeza fresca y no al final del dia.
9. **El link de acceso (F).** Ultima y sola. Es la unica que puede dejar a todo
   el mundo afuera. Va con contexto entero y con todo lo demas ya verificado en
   verde.

Las tareas 1 a 8 no dependen entre si: si una se traba, las otras siguen.
La 9 no depende de ninguna, pero se hace ultima por seguridad, no por dependencia.
</orden_y_por_que>

<hallazgos_previos>
Cosas que aparecieron verificando el brief contra el codigo y que cambian como se
ejecuta. Leelas antes de arrancar.

**1. El orquestador tiene CUATRO tandas, no cinco.** `TANDAS` en
`app/api/cron/diario/route.ts` es `[reminders, bienvenida, quien-ficho,
recordatorio-perfil]`. Hay CINCO rutas en `app/api/cron/` porque `diario` es una
de ellas, pero el que orquesta orquesta a cuatro. El header del archivo tambien
dice "cuatro" y es correcto.

**2. `quien-ficho` devuelve 503 TODOS LOS DIAS, hoy mismo.** No es hipotetico:
`MAIL_ADMIN_TO` no esta cargada, asi que el guard de las lineas 80 a 93 corta
antes de la RPC y devuelve 503 en cada corrida. Un criterio ingenuo del tipo
"cualquier hija que no sea ok devuelve 500" haria que el orquestador tire 500
todos los dias para siempre, y en dos semanas Franco ignora la alarma. Eso es
peor que el bug actual. La Tarea 5 lo resuelve distinguiendo "roto" de
"sin configurar".

**3. La hora corrida afecta SOLO al camino de evento nuevo.** En
`offer-form.tsx:164`, `gigStartsAt` sale de `gigDate` (crudo del input) solo
cuando `isNewGig`; si la productora elige un evento ya cargado, sale de
`pickedGig.starts_at`, que ya viene ISO desde la base y esta bien. Verificado
tambien que `p_gig_starts_at` es `timestamptz` en la RPC
(`staff_app_0036_org_rpcs_productora.sql:359`), asi que el string sin zona lo
castea Postgres con el timezone de la sesion. Ese es el mecanismo exacto.

**4. Reinscribirse tiene el mismo bug en proveedor, y NO por descuido.** La 0060
lo documenta explicitamente en las lineas 115 a 118: no se pisan los datos porque
"si ya cargo sus servicios y vuelve a entrar por la landing, perderlos seria
destruir su trabajo por un click". O sea que la RPC esta bien pensada y la que
miente es la pantalla. La Tarea 7 arregla la pantalla, no la RPC. Hay ademas una
razon de seguridad que decide el empate, escrita adentro de la tarea.

**5. La RPC de fotos la llama el cliente ANON, no service_role.**
`guardarFotosSalon` (`app/acceso-proveedor/[token]/actions.ts:368-378`) usa
`createClient()`, y el salon entra por token SIN sesion. Si la migracion 0070 le
escribe un `REVOKE ... FROM anon` copiado de la 0064, las fotos dejan de
guardarse. Los grants se EXTRAEN de produccion, no se deducen.

**6. No existe ningun patron de paginacion en el repo.** `.range(` aparece una
sola vez en todo el codigo, justo en la linea que hay que arreglar. Asi que la
Tarea 6 elige el patron y lo justifica; la eleccion esta escrita adentro.

**7. No hay MCP de Supabase ni CLI en esta maquina.** No hay `supabase` ni `psql`
en el PATH, y `.env.local` no tiene cadena de conexion. La extraccion de las dos
funciones de vidriera la tiene que hacer el ejecutor con el MCP de Supabase. Las
consultas exactas estan escritas en la Tarea 8.

**8. `lib/dates.ts` ya es el lugar de las fechas del proyecto** y su header ya
explica el problema del server en UTC. El helper de la Tarea 3 va ahi, no en un
archivo nuevo.
</hallazgos_previos>

<tasks>

<!-- ══════════════════ TANDA 1 ══════════════════ -->

<task type="auto" n="1">
  <name>Tarea 1 (H): crear una oferta no refrescaba ninguna pantalla</name>

  <files>
    app/(portal)/staff/[id]/offer-actions.ts
  </files>

  <action>
  Verificado: `offer-actions.ts` no importa `revalidatePath`. Sus hermanas si:
  `app/(portal)/tablero/gig-actions.ts:9` y
  `app/(portal)/tablero/[gigId]/busquedas/actions.ts:10`. Al volver de crear una
  oferta, el cache del router puede mostrar el perfil y el tablero sin la oferta
  recien creada.

  Importar `revalidatePath` de `next/cache` y llamarlo DESPUES de que la RPC
  confirmo (o sea, despues del bloque que valida `res.ok` y antes de armar el
  link), no al final: si el mail falla, la oferta igual existe y las pantallas
  igual tienen que reflejarla. Ese es el mismo criterio de "estado honesto" que ya
  usa el paso 6 del header de este archivo.

  Que rutas. Verificado quien muestra ofertas:
  - `/staff/${input.staffProfileId}`: la ficha del candidato lista sus ofertas
    (`app/(portal)/staff/[id]/page.tsx:130-135` y `369-371`). Es la pantalla a la
    que se vuelve, asi que es la mas importante.
  - `/tablero`: el board lee ofertas (`gig-board.tsx`, `tablero/page.tsx`).
  - `/dashboard`: es lo que `createGig` ya revalida, y una oferta con quick-create
    crea un evento nuevo, asi que el dashboard tambien queda viejo.

  Seguí el molde de `gig-actions.ts:124-127`: las llamadas juntas, una por linea,
  sin condicionales.

  Sumá al header del archivo, en la lista numerada de pasos, el paso nuevo con su
  numero (el que hoy es 6 pasa a 7, o donde corresponda segun donde lo pongas), y
  explicá en una linea POR QUE se revalida despues de la RPC y no al final. Ese
  matiz es el que se pierde cuando alguien lo "ordena" mas tarde.

  No toques nada mas del archivo. No agregues dependencias.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -c "revalidatePath" "app/(portal)/staff/[id]/offer-actions.ts"</automated>
    <human-check>
      1. `/dev-login`, entrar a `/staff/[id]` de un candidato con email cargado
      2. Crear una oferta con monto y fecha
      3. Volver al perfil del candidato: la oferta nueva tiene que estar en la
         lista SIN apretar recargar
      4. Ir a /tablero: el evento nuevo (si fue quick-create) tiene que estar
    </human-check>
  </verify>

  <done>
  `offer-actions.ts` revalida `/staff/[id]`, `/tablero` y `/dashboard` despues de
  que la RPC confirmo. El header explica por que va ahi y no al final.
  </done>

  <commit>fix(ofertas): al crear una oferta no se refrescaba ninguna pantalla</commit>
</task>

<task type="auto" n="2">
  <name>Tarea 2 (I): /mi-proveedor no era publica y el proveedor caia en el selector</name>

  <files>
    lib/supabase/middleware.ts
  </files>

  <action>
  Verificado: `/mi-proveedor` no esta en `publicPrefixes` (lineas 40 a 155). Un
  proveedor sin sesion que entra ahi se come un 307 a `/entrar`, y ademas
  `url.search = ""` (linea 164) le borra el querystring, asi que aterriza en el
  selector generico en vez de su solapa. El `redirect("/entrar?como=proveedor")`
  que la propia pagina tiene escrito (`app/mi-proveedor/page.tsx:72`) nunca llega
  a ejecutarse, porque el middleware corta antes.

  Agregar `"/mi-proveedor"` a la lista, con su comentario del POR QUE, siguiendo
  exactamente el molde de sus vecinas `/panel-staff` y `/trabajos`: la ruta pasa,
  y el gate real lo hace la propia pagina, que ademas es la unica que sabe a que
  solapa mandarlo. Nombra en el comentario que el bug era doble (el 307 y el
  querystring borrado), porque la segunda mitad es la que no es obvia.

  ⚠️ **AUDITORIA DE PREFIJOS, OBLIGATORIA.** La lista se evalua con `startsWith`
  y el propio archivo tiene anotada la trampa en las lineas 90 a 93 (un `/prov`
  abriria `/proveedores`). Antes de dar la tarea por hecha:

  1. `ls -1 app` y mira TODA ruta de primer nivel que empiece con `/mi`.
     Verificado hoy: `mi-proveedor` es la unica, y adentro solo hay `page.tsx`
     (no hay subrutas). Reconfirmalo igual, porque el repo se mueve.
  2. Confirma que `/mi-proveedor` NO es prefijo de ninguna otra ruta existente.
  3. Dejá escrito en el comentario que el prefijo va ENTERO, igual que hicieron
     con `/acceso-proveedor`.

  Ubicacion: ponelo pegado a `/acceso-proveedor` o a `/panel-staff`, que son sus
  parientes conceptuales, no al final de la lista. Que se lea agrupado.

  Nada mas de este archivo se toca. En particular NO toques `url.search = ""`:
  borrar el querystring al rebotar esta bien (evita arrastrar params de una ruta
  privada a la puerta), y lo que estaba mal era que `/mi-proveedor` rebotara.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -n "mi-proveedor" lib/supabase/middleware.ts</automated>
    <human-check>
      1. `npm run dev`, ventana de incognito (sin sesion)
      2. Ir a http://localhost:3000/mi-proveedor
      3. Tiene que aterrizar en `/entrar?como=proveedor`, con la solapa de
         proveedor ya elegida. NO en el selector generico.
      4. Probar que NO se abrio nada de mas: sin sesion, `/buscar`, `/tablero`,
         `/staff` y `/plataforma` tienen que seguir rebotando a `/entrar`.
    </human-check>
  </verify>

  <done>
  `/mi-proveedor` esta en `publicPrefixes` con su comentario del por que. Un
  proveedor sin sesion llega a `/entrar?como=proveedor`. Ninguna otra ruta quedo
  abierta por el `startsWith`, verificado a mano.
  </done>

  <commit>fix(middleware): /mi-proveedor no era publica y el proveedor caia en el selector</commit>
</task>

<task type="auto" n="3">
  <name>Tarea 3 (A): la hora del evento se corria tres horas al crear la oferta</name>

  <files>
    lib/dates.ts
    app/(portal)/staff/[id]/oferta/offer-form.tsx
    app/(portal)/tablero/gig-form.tsx
  </files>

  <action>
  Verificado: `offer-form.tsx:164` manda `gigStartsAt: isNewGig ? gigDate || null
  : ...`, o sea el valor CRUDO del input `datetime-local` (un string sin zona,
  tipo "2026-09-10T20:00"). El otro camino, `gig-form.tsx:42-47`, si convierte con
  `new Date(v).toISOString()`. La RPC recibe `p_gig_starts_at timestamptz`
  (`staff_app_0036_org_rpcs_productora.sql:359`), asi que el string sin zona lo
  castea Postgres con el timezone de la sesion, que en Supabase es UTC: la
  productora escribe 20:00 y al candidato le llega 17:00.

  Verificado tambien el alcance: solo pasa en el camino de EVENTO NUEVO
  (`isNewGig`). Con un evento ya cargado, `gigStartsAt` sale de
  `pickedGig.starts_at`, que ya viene ISO de la base y esta bien. Deciló asi en el
  comentario, porque si no el proximo que lea el arreglo va a pensar que los dos
  caminos estaban rotos.

  **Paso 1: el helper compartido, en `lib/dates.ts`.** Ahi y no en un archivo
  nuevo: ese archivo YA es el lugar de las fechas del proyecto y su header YA
  explica el problema del server en UTC ("Vercel corre en UTC... un gig a las
  21:00 se veia 00:00"). Este bug es exactamente el mismo problema del otro lado
  del viaje (al escribir en vez de al mostrar), asi que vive al lado de su
  hermano.

  Mové las dos funciones locales de `gig-form.tsx` (`toLocalInput`, lineas 33 a 40,
  y `fromLocalInput`, lineas 42 a 47) a `lib/dates.ts`, con nombres coherentes con
  los que ya hay ahi (que estan en castellano: `fmtFecha`, `fmtHora`,
  `fmtFechaHora`, `calcEdad`). Proponé algo del estilo `desdeInputLocal` y
  `aInputLocal`, o los nombres que mejor se lean junto a los existentes; lo que no
  puede pasar es que queden en spanglish a medias.

  `lib/dates.ts` no tiene `server-only` y se usa desde componentes cliente, asi que
  mover esto no rompe nada. Verificalo: los dos formularios son `"use client"`.

  Sumá al header de `lib/dates.ts` un parrafo corto explicando el segundo problema
  que ahora cubre: un `datetime-local` NO tiene zona, y mandarlo crudo a un
  `timestamptz` deja que el server decida la zona por vos. Contá el caso concreto
  (20:00 que llega como 17:00) para que el proximo entienda de una.

  **Paso 2: `gig-form.tsx`.** Borrá las dos funciones locales e importa las de
  `lib/dates.ts`. Comportamiento identico, cero cambio funcional. Actualizá la
  linea del header que dice "datetime-local <-> ISO" para que apunte a donde vive
  ahora esa conversion.

  **Paso 3: `offer-form.tsx`.** En la linea 164, pasar `gigDate` por el helper en
  vez de mandarlo crudo. Cuidado con el `|| null` que ya esta: el helper ya
  devuelve null con string vacio, asi que no lo dupliques ni lo saques sin mirar
  que el resultado siga siendo `string | null`.

  Comentario al lado, corto, con el por que y el alcance (solo el camino de evento
  nuevo). Y revisá si el header del archivo dice algo sobre fechas que ahora deje
  de ser cierto.

  **Paso 4: el barrido.** `grep -rn 'datetime-local' app lib components`.
  Verificado hoy: cuatro inputs en total, dos en `gig-form.tsx` (lineas 156 y 160,
  los dos ya pasan por `fromLocalInput`) y uno en `offer-form.tsx` (linea 337, el
  que se arregla). El cuarto match es un comentario en `offer-actions.ts:53`, que
  dice "starts_at del gig: ISO / datetime-local": ese comentario documenta
  justamente la ambiguedad que era el bug, asi que corregilo para que diga que
  llega SIEMPRE ISO. Reconfirma el grep igual antes de cerrar.

  No agregues dependencias. No metas date-fns ni dayjs por tres lineas.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -rn "datetime-local" app lib components</automated>
    <human-check>
      1. `/dev-login`, ir a `/staff/[id]/oferta` de un candidato
      2. Elegir "evento nuevo", ponerle titulo y fecha 20:00 de un dia cualquiera
      3. Crear la oferta
      4. Abrir el link `/o/<token>` (el de la propuesta): tiene que decir 20:00,
         no 17:00
      5. Ir a /tablero y abrir ese evento: tiene que decir 20:00
      6. ⚠️ Este bug NO se reproduce en localhost si la Mac esta en hora AR: el
         `new Date(...)` local coincide con la zona del server. Para probarlo de
         verdad hay que mirar el valor guardado en la base (`gigs.starts_at` en
         UTC tiene que ser 23:00Z para un evento de las 20:00 AR) o correrlo con
         `TZ=UTC npm run dev`.
      7. Editar un evento existente desde /tablero y guardarlo sin cambiar la
         hora: la hora NO puede moverse (control de que el paso 2 no rompio nada)
    </human-check>
  </verify>

  <done>
  La conversion vive en `lib/dates.ts` y la usan los dos formularios. Un evento
  creado desde la oferta a las 20:00 queda a las 20:00. El comentario de
  `offer-actions.ts:53` ya no dice que puede llegar un `datetime-local`. El grep
  de `datetime-local` no muestra ningun input que mande el valor crudo.
  </done>

  <commit>fix(ofertas): la hora del evento se corria tres horas al crear la oferta</commit>
</task>

<task type="auto" n="4">
  <name>Tarea 4 (G): reguardar un evento podia borrarle las coordenadas</name>

  <files>
    app/(portal)/tablero/gig-form.tsx
  </files>

  <action>
  Verificado: `gig-form.tsx:100-106` recalcula el geocode en CADA submit y manda
  `venueLat: geo?.lat ?? null`. La RPC hace un UPDATE plano sin COALESCE
  (`staff_app_0036_org_rpcs_productora.sql:150-155`). Si Nominatim falla, tarda
  mas de 8s (`gig-actions.ts:47`) o devuelve vacio, las coordenadas guardadas se
  pisan con null y el fichaje por GPS deja de medir distancia. Y el comentario de
  las lineas 92 a 94 afirma lo contrario: "la ubicacion se preserva de lo que ya
  habia". La trampa esta documentada al reves.

  **DECISION: se arregla en el cliente, NO en la base. No hay migracion.**

  El razonamiento, escribilo tambien en el comentario porque es lo que evita que
  alguien lo "mejore" mal mas adelante:

  Un `COALESCE(p_venue_lat, venue_lat)` en la RPC parece la solucion obvia y es
  peor. Cubre el caso "no toque la direccion y el geocode fallo" (bien), pero
  arruina el caso "cambie la direccion y el geocode fallo": ahi deja las
  coordenadas VIEJAS pegadas a una direccion nueva, y el fichaje pasa a medir la
  distancia contra un lugar donde el evento ya no es. Coordenadas equivocadas son
  peores que coordenadas ausentes: sin coordenadas el geofencing simplemente no
  aplica, con coordenadas mentirosas le rebota el fichaje a alguien que esta
  parado en el lugar correcto. Ademas un COALESCE haria imposible BORRAR una
  ubicacion, que es una operacion legitima.

  Quien sabe si la direccion cambio es el formulario, porque tiene `initial`. Por
  eso el arreglo va ahi.

  **El cambio, en `onSubmit` (lineas 92 a 106):**

  1. Comparar la direccion del form contra `initial?.venue_address`, las dos
     normalizadas igual (trim, y comparacion insensible a mayusculas, que es como
     una persona percibe "la misma direccion").
  2. Si la direccion NO cambio: no llamar a `geocodeAddress` y mandar
     `venueLat`/`venueLng` con los valores que ya venian en
     `initial.venue_lat` / `initial.venue_lng`. Esto ademas deja de pegarle a
     Nominatim en cada guardado, que es lo correcto segun su policy de uso (el
     header de `geocodeAddress` en `gig-actions.ts` habla justo de eso), y evita
     que el mismo domicilio devuelva un punto distinto de un dia para el otro.
  3. Si la direccion SI cambio (o es un evento nuevo, donde no hay `initial`):
     geocodificar como hoy. Si falla, mandar null a proposito, y el toast que ya
     existe ("Guarde la direccion, pero no pude ubicarla en el mapa...") ya avisa.
     Reforzá ese texto si hace falta para que quede claro que el fichaje por GPS
     no va a medir distancia hasta que la direccion se pueda ubicar.
  4. Si la direccion quedo VACIA habiendo tenido una: eso es un borrado explicito,
     y ahi si van null los tres campos. Que quede escrito.

  **Y corregí el comentario de las lineas 92 a 94**, que hoy miente. Que diga lo
  que de verdad pasa: la ubicacion se preserva SOLO si la direccion no cambio, y
  por que la comparacion es la que decide.

  ⚠️ No toques `setGigDetails` ni la RPC. No escribas migracion. No cambies el
  timeout de 8s de Nominatim.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -n "venue_address\|venueLat" "app/(portal)/tablero/gig-form.tsx"</automated>
    <human-check>
      1. `/dev-login`, /tablero, crear un evento con una direccion real y completa
         (calle, numero, ciudad). Tiene que guardar coordenadas.
      2. Verificar en la base que `gigs.venue_lat` y `venue_lng` no son null.
      3. Editar ESE evento cambiando solo el titulo, y guardar.
      4. Verificar en la base: las coordenadas tienen que seguir siendo LAS
         MISMAS. Este es el bug: antes podian quedar en null.
      5. Simular el fallo de Nominatim (modo avion, o cortando la red un segundo)
         y repetir el paso 3: las coordenadas TIENEN que seguir intactas, porque
         con la direccion sin cambios ya no se llama a Nominatim.
      6. Editar el evento cambiando la direccion por una inventada que no exista:
         ahi SI las coordenadas quedan en null y sale el toast avisando.
      7. Borrar la direccion entera y guardar: coordenadas en null, sin toast de
         error (es un borrado querido, no una falla).
    </human-check>
  </verify>

  <done>
  Reguardar un evento sin tocar la direccion nunca pierde las coordenadas, ni
  siquiera con Nominatim caido. Cambiar la direccion a una que no se puede ubicar
  las limpia y lo dice. El comentario de las lineas 92 a 94 describe lo que el
  codigo hace de verdad. Cero migraciones.
  </done>

  <commit>fix(eventos): reguardar un evento podia borrarle las coordenadas</commit>
</task>

<task type="auto" n="5">
  <name>Tarea 5 (C): si una tanda se rompe, el cron ahora lo dice con un 500</name>

  <files>
    app/api/cron/diario/route.ts
  </files>

  <action>
  Verificado: `app/api/cron/diario/route.ts:145-152` devuelve SIEMPRE 200. El
  `ok:false` va solo en el cuerpo, que el despachador de Cloudflare no lee. Las
  cuatro tandas corren exclusivamente adentro de este orquestador, asi que una RPC
  rota queda invisible. Y el unico aviso que quedaria depende de `alerta()`, que
  sin `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` ni `MAIL_ADMIN_TO` (verificado:
  ninguna cargada) devuelve false sin hacer nada.

  **PASO CERO, ANTES DE ESCRIBIR NADA: verificar la premisa de los reintentos.**

  Todo el criterio de abajo se apoya en una afirmacion del header del propio
  archivo: "las cuatro RPC estampan su ancla de exactly-once AL SELECCIONAR".
  Si eso es cierto, un reintento del despachador NO manda ningun mail dos veces,
  porque las filas ya quedaron marcadas y la segunda corrida las selecciona
  vacias. Si NO es cierto para alguna, devolver 500 puede provocar mails
  duplicados, y ahi el criterio cambia.

  Verificalo RPC por RPC, mirando la definicion en `supabase/migrations/`:
  `staff_app_welcome_batch`, la de reminders, `staff_app_fichaje_resumen_batch` y
  la de `recordatorio-perfil`. Buscá que cada una haga el UPDATE de la marca en la
  MISMA sentencia que el SELECT (patron `WITH ... UPDATE ... RETURNING`), no
  despues. Si alguna NO cumple, PARA y decilo: esa tanda no puede quedar bajo un
  status que invite a reintentar, y hay que resolverlo distinto (por ejemplo
  reportarla como error en el cuerpo pero sin subir el status).

  **EL CRITERIO (asumiendo que el paso cero da verde).**

  La regla de una linea: **el status HTTP dice si algo se ROMPIO, no si todo
  CORRIO.** Tres desenlaces distintos y por eso tres tratos distintos:

  1. **Roto** (la hija tiro una excepcion, o devolvio 5xx que no sea 503): el
     orquestador devuelve **500**. Es una falla real, un reintento es deseable, y
     es seguro por el exactly-once del paso cero.
  2. **Sin configurar**: hoy `quien-ficho` devuelve **503** todos los dias porque
     `MAIL_ADMIN_TO` no esta cargada (lineas 80 a 93). Eso no es una rotura, es
     una pieza que falta, es permanente, y reintentar no arregla nada. Si esto
     entrara como error, el orquestador tiraria 500 TODOS LOS DIAS PARA SIEMPRE y
     en dos semanas Franco ignora la alarma. La alarma que suena siempre no es una
     alarma. Va a un estado propio y NO sube el status.
  3. **Salteada** por presupuesto de tiempo: ya existe, es por diseno y se
     autorepara en la vuelta siguiente. No sube el status.

  **Implementacion.**

  - Agregá `"sin_configurar"` al type `ResultadoTanda["estado"]`, con su comentario
    explicando la diferencia entre "roto" y "falta cargar una variable", que es la
    distincion entera de esta tarea.
  - En el bloque del try (lineas 118 a 133), donde hoy se hace
    `estado: res.ok ? "ok" : "error"`, agregá el caso 503 como
    `"sin_configurar"`. Dejá el `detalle` como esta: el cuerpo de la hija ya trae
    el `hint` con que variable falta, y eso es exactamente lo que hace falta leer.
  - El `catch` sigue produciendo `"error"`.
  - Al final, contá `sinConfigurar` igual que ya se cuenta `conError` y
    `salteadas`, y sumalo al cuerpo de la respuesta.
  - `ok` pasa a ser `conError === 0` igual que hoy (no cambia), y el `Response.json`
    lleva `{ status: conError > 0 ? 500 : 200 }`.
  - Si `conError > 0`, llamá a `alerta()` con el titulo en criollo (algo del estilo
    "El cron diario tuvo tandas rotas"), el detalle con los nombres de las tandas
    que fallaron y su motivo, y una `clave` propia para que el anti repeticion no
    se lo coma con otro aviso. ⚠️ Dejá escrito en el comentario que HOY esto es un
    no-op, porque las tres variables estan sin cargar, y que el valor real del
    arreglo es el status HTTP. Si no queda escrito, el proximo que lo lea va a
    creer que el aviso funciona.

  **El header del archivo.** Tiene una seccion "TOLERANCIA A FALLAS". Sumale (o
  ampliala a) una seccion nueva que cuente los tres desenlaces, por que el 503 no
  es un 500, y por que devolver 500 es seguro (el exactly-once que verificaste en
  el paso cero). Ese parrafo es el que evita que dentro de seis meses alguien
  "simplifique" esto a "cualquier cosa que no sea ok es 500".

  ⚠️ NO toques el 401 (fail-closed, sigue igual). NO toques el presupuesto de
  tiempo, ni `RESERVA_MS`, ni `MINIMO_POR_TANDA_MS`, ni el orden de `TANDAS`. NO
  toques ninguna de las cuatro rutas hijas.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; grep -n "sin_configurar\|status: conError\|alerta(" app/api/cron/diario/route.ts</automated>
    <human-check>
      1. `npm run dev`. Cargar `CRON_SECRET=probando` en `.env.local` (NO se
         commitea).
      2. `curl -i -H "Authorization: Bearer probando" http://localhost:3000/api/cron/diario`
      3. Con la config de hoy (sin MAIL_ADMIN_TO): tiene que devolver **200**, y
         en el cuerpo `quien-ficho` tiene que figurar como `sin_configurar`, NO
         como `error`. Este es el punto entero de la tarea.
      4. Sin el header o con un secreto equivocado: sigue 401.
      5. Forzar una rotura de verdad (por ejemplo, cambiar temporalmente el nombre
         de la RPC de bienvenida a una que no existe): tiene que devolver **500**,
         con esa tanda en `error` y las demas con su estado real. Revertir el
         cambio despues de probar.
      6. Confirmar en el cuerpo que `corridas`, `con_error`, `salteadas` y el
         contador nuevo cierran contra la cantidad de tandas.
    </human-check>
  </verify>

  <done>
  El orquestador devuelve 500 cuando una tanda se rompe de verdad, y 200 cuando lo
  unico que pasa es que falta cargar una variable o que no hubo tiempo. El header
  explica los tres desenlaces y por que el 500 no duplica mails. La premisa del
  exactly-once quedo verificada RPC por RPC, no asumida.
  </done>

  <commit>fix(cron): si una tanda se rompe, el orquestador ahora lo dice con un 500</commit>
</task>

<!-- ══════════════════ TANDA 2 (sesion nueva, /clear antes) ══════════════════ -->

<task type="auto" n="6">
  <name>Tarea 6 (B): la busqueda muestra los 1.049 candidatos, no los primeros 50</name>

  <files>
    lib/search-params.ts
    app/(portal)/buscar/page.tsx
    app/(portal)/buscar/search-client.tsx
  </files>

  <action>
  Verificado: `app/(portal)/buscar/page.tsx:112` es un `.range(0, 49)` fijo,
  `lib/search-params.ts` no tiene ningun parametro de pagina, y el contador de
  `search-client.tsx:172-175` dice "50 candidatos" siempre que el filtro no achique.
  Con 1.049 fichas hay 999 que no se pueden ver. El header de `page.tsx` incluso
  dice "+ paginacion", que nunca existio.

  **DECISION DE PATRON: paginado por parametro de URL (`?p=N`), no "ver mas".**

  Verificado que en el repo NO hay ningun patron de paginacion: `.range(` aparece
  UNA sola vez en todo el codigo, justo en la linea a arreglar. Asi que hay que
  elegir, y la eleccion se justifica sola con la arquitectura que ya tiene esta
  pantalla: el estado vive en la URL, el cliente hace `router.replace` y el server
  component vuelve a consultar (`search-client.tsx:44-65`, y esta escrito en el
  header de los dos archivos). Un "ver mas" que acumula obliga a guardar
  resultados en estado del cliente y a mezclar dos fuentes de verdad; `?p=` es una
  sexta clave en `PARAM` y encaja sin pelear con nada. Ademas queda compartible y
  el boton "atras" del navegador funciona.

  Escribí esa justificacion en el header de `lib/search-params.ts`, en dos lineas.

  **`lib/search-params.ts`:**
  - `PARAM.pagina = "p"` (clave corta, como las demas: el header dice "mobile
    payload chico").
  - `pagina: number` en `SearchFilters`.
  - Parseo: ⚠️ es entrada NO confiable y este archivo tiene una postura explicita
    al respecto ("TODO valor estructurado se valida contra un whitelist conocido").
    Segui esa postura: solo digitos, entero, minimo 1, y un tope duro (algo del
    orden de 999) para que `?p=99999999` no genere un `.range()` absurdo. Cualquier
    cosa que no matchee cae a 1, igual que hace el UUID del `gig`.
  - `buildQueryString`: incluir `p` SOLO si es mayor a 1 (la pagina 1 no ensucia
    la URL, igual que los toggles apagados).
  - ⚠️ **LA TRAMPA PRINCIPAL, y va con comentario:** cuando cambia CUALQUIER otro
    filtro, la pagina vuelve a 1. Si no, alguien parado en la pagina 8 escribe
    "bartender", el resultado son 12 fichas, y la pantalla le muestra el vacio de
    "no hay candidatos" con 12 candidatos ahi nomas. Es un bug que se ve como
    "la busqueda no anda". El lugar natural es `composeAndPush` en
    `search-client.tsx`, que es el unico que arma la URL cuando cambia un filtro:
    que NO propague la pagina. Y la navegacion de paginas usa su propio camino,
    que si la propaga.
  - `activeFineFilterCount`: la pagina NO cuenta como filtro fino (igual que
    `gig`, que ya tiene su comentario explicando por que). Dejale su linea de
    comentario tambien.

  **`app/(portal)/buscar/page.tsx`:**
  - Constante `POR_PAGINA = 50` arriba, al lado de `CARD_COLUMNS`, con comentario.
    50 es lo que ya habia; no es el momento de discutir el numero.
  - `select(CARD_COLUMNS, { count: "exact" })` para tener el total REAL despues de
    aplicar todos los filtros. Es lo que hace honesto al contador.
  - `.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)`.
  - ⚠️ Trampa de PostgREST: un `range` mas alla del total puede devolver error de
    rango en vez de una lista vacia. No lo dejes reventar la pantalla: si no hay
    datos y el total es mayor a cero y la pagina es mayor a 1, tratalo como
    "pagina vacia" y que la UI ofrezca volver a la primera. Probalo de verdad con
    `?p=999`, no lo asumas.
  - Pasale a `SearchClient` el total y la pagina actual.
  - Actualizá el header del archivo: hoy promete paginacion y recien ahora es cierto.

  **`app/(portal)/buscar/search-client.tsx`:**
  - El contador (lineas 172 a 175) tiene que decir la VERDAD: cuantos hay en
    total, no cuantos se muestran. Y si hay mas de una pagina, que se entienda
    cual se esta viendo. Redactalo en criollo y corto, en el tono del resto de la
    pantalla (el label ya es `label-tech` en mayusculas chiquitas). Singular y
    plural, como ya hace hoy.
  - Controles de pagina debajo de la grilla: anterior y siguiente, deshabilitados
    en los extremos. Area tactil de 44px como el resto de la pantalla (mira el
    `min-h-[44px]` del link "Ver todos" en `page.tsx:120-125`). Nada de una tira
    de numeros: con 21 paginas no entra en un telefono y no aporta.
  - Que usen `startTransition` + `router.replace` igual que `composeAndPush`, para
    que el `pending` ya existente muestre el `LoadingResults` que ya esta escrito.
  - Al cambiar de pagina, subir al principio de los resultados. Hoy todos los
    `router.replace` van con `{ scroll: false }` a proposito (para que ajustar un
    filtro no te patee la pantalla), pero cambiar de pagina es el caso opuesto:
    quedarse abajo del todo mirando el pie de la pagina 2 es desorientador.
    Resolvelo explicito y con comentario, no cambiando el `scroll: false` de los
    otros llamados.
  - Con una sola pagina, los controles no se dibujan.

  ⚠️ No toques los filtros, ni el saneado del texto, ni el `.or()`, ni la
  exclusion de `crew_busy`, ni el modo "buscar reemplazo" (`?gig=`). Solo se suma
  paginacion.
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run build &amp;&amp; grep -n "count\|range\|POR_PAGINA" "app/(portal)/buscar/page.tsx"</automated>
    <human-check>
      1. `/dev-login`, ir a /buscar sin filtros
      2. El contador tiene que decir el total real (~1.049), no 50
      3. "Siguiente" trae candidatos DISTINTOS y la URL muestra `?p=2`
      4. "Anterior" en la pagina 1 esta deshabilitado; "Siguiente" en la ultima
         tambien
      5. Recargar con `?p=2` en la URL: muestra la pagina 2 (el estado vive en la
         URL, que es el punto del patron elegido)
      6. ⚠️ Ir a la pagina 8 y recien ahi escribir un texto en el buscador: tiene
         que volver a la pagina 1 y mostrar resultados. Si muestra el vacio de
         "no hay candidatos", la trampa no quedo cubierta.
      7. Probar `?p=0`, `?p=-3`, `?p=abc` y `?p=99999999`: ninguno puede romper la
         pantalla ni tirar un error crudo
      8. Con un filtro que devuelva menos de 50 (ej. un oficio raro): no se dibujan
         los controles de pagina y el contador dice el numero exacto
      9. El modo "buscar reemplazo" (`?gig=<uuid>`) sigue andando y conserva el gig
         al pasar de pagina
    </human-check>
  </verify>

  <done>
  Se pueden ver las 1.049 fichas. El contador dice el total real. La pagina vive
  en la URL, se valida como entrada no confiable, y vuelve a 1 cuando cambia
  cualquier otro filtro. Una pagina fuera de rango no rompe nada.
  </done>

  <commit>feat(buscar): la busqueda muestra los 1049 candidatos, no los primeros 50</commit>
</task>

<task type="auto" n="7">
  <name>Tarea 7 (D): reinscribirse decia listo y no actualizaba nada</name>

  <files>
    app/registrar-salon/actions.ts
    app/registrar-salon/registro-client.tsx
    app/registrar-proveedor/actions.ts
    app/registrar-proveedor/registro-client.tsx
  </files>

  <action>
  Verificado en los dos lados, es el MISMO bug con la misma forma:

  - **Salon** (`staff_app_0064_pool_de_salones.sql:192-199`): si el mail ya tiene
    ficha de salon, la RPC solo regenera el token y devuelve `ya_existia = true`.
    La capacidad, la direccion, las amenities y todo lo que la persona acaba de
    escribir se descarta EN SILENCIO. `app/registrar-salon/actions.ts:220` devuelve
    `{ ok: true }` pelado y `registro-client.tsx:170-190` muestra "Listo, X ya
    esta publicado" igual.
  - **Proveedor** (`staff_app_0060_alta_abierta_de_proveedor.sql:119-136`):
    identico. `actions.ts:203` devuelve `{ ok: true }` pelado y
    `registro-client.tsx:112-142` muestra el mismo texto de exito.

  **DECISION: se dice la verdad y se lo manda a su panel. NO se actualizan los
  datos desde el formulario publico.**

  Tres razones, en orden de peso. Escribilas en el header de las dos actions,
  porque esta es exactamente la decision que alguien va a querer revertir sin
  entender el punto 1:

  1. **Seguridad, y es la que decide.** El formulario es PUBLICO y sin sesion:
     cualquiera que sepa el mail de un salon lo puede completar. Hoy lo peor que
     logra es invalidar el token viejo y hacer que salga un mail nuevo A LA CASILLA
     DEL DUENO, o sea que el atacante no recibe nada. Si el formulario pudiera
     pisar los datos, un desconocido reescribe la ficha publica de un salon
     (nombre, direccion, capacidad, web, instagram, bio) sin probar jamas que ese
     mail es suyo. Eso es una toma de perfil, y seria una regresion de seguridad
     para arreglar un problema de copy.
  2. **Ya esta decidido y documentado.** La 0060 lo explica en las lineas 115 a
     118: no se pisan los datos porque destruirlos por un click seria peor. En el
     proveedor es todavia mas evidente, porque el alta trae servicios (una tabla
     hija entera). La RPC esta bien; la que miente es la pantalla.
  3. **El lugar para editar ya existe y es autenticado.** La persona recibe un
     link nuevo por mail que la lleva a su panel (`/acceso-proveedor/<token>`,
     y desde 0066 el salon y el proveedor comparten `/mi-proveedor`). Ahi si puede
     corregir la capacidad, con la propiedad del mail ya probada.

  **NO se escribe ninguna migracion. Las dos RPC quedan como estan.**

  **`app/registrar-salon/actions.ts`:** la firma de retorno pasa de
  `{ ok: boolean; error?: string }` a llevar tambien `yaExistia: boolean`, tomado
  de `r.ya_existia` (que ya se lee y ya se usa para elegir el asunto del mail y el
  titulo del aviso a Franco, lineas 182 a 218). Solo hay que dejar de tirarlo en el
  `return { ok: true }` de la linea 220. Es el mismo molde de "estado honesto" que
  la Tarea 5 del plan anterior aplico a `mailOk` en `registrar-productora`.

  **`app/registrar-proveedor/actions.ts`:** identico, sobre el `return { ok: true }`
  de la linea 203. `r.ya_existia` ya se lee en la linea 130.

  **Las dos pantallas (`registro-client.tsx` de salon y de proveedor):** el bloque
  `listo` pasa a tener dos caras, guardando el dato en un estado
  (`useState<boolean | null>`) y no en dos booleanos sueltos. Es el molde de
  `offer-form.tsx:200-227`, que ya resuelve esto bien en el repo:

  - **Alta nueva:** exactamente lo que dice hoy. No lo toques.
  - **Ya existia:** que diga las tres cosas, en este orden y en criollo:
    1. Ya tenias tu ficha publicada (no es un error, no se creo nada duplicado).
    2. **Lo que acabas de escribir aca NO se guardo**, y por que: los datos se
       editan desde el panel, entrando con el link, que es donde se sabe que sos
       vos. Esta frase es el corazon del arreglo. Sin ella el arreglo no existe.
    3. Te mandamos un link nuevo al mail para entrar y corregir lo que quieras.
       Si no lo ves, mira en spam.
  - El link de abajo tambien cambia de destino segun el caso: en el alta nueva
    sigue yendo al directorio ("Ver el directorio"), y en el caso de ya existia lo
    util es su panel. Ojo: sin el token no se puede linkear
    `/acceso-proveedor/<token>` desde la pantalla (el token viaja en el mail, no en
    la respuesta, y esta bien que sea asi). Mandalo a `/mi-proveedor`, que es la
    puerta con sesion, o dejale el mismo link al directorio si el destino no cierra.
    Elegí uno y explicá en un comentario por que el token NO se puede usar aca.
    ⚠️ `/mi-proveedor` recien queda alcanzable sin sesion despues de la Tarea 2.
    Si esta tanda corre sin la Tarea 2 hecha, verificalo antes.

  **Consistencia con el mail.** Verificado que el mail de "ya existia" YA tiene
  asunto propio ("Tu link nuevo para entrar a LABURO") en los dos lados. Leelo
  entero y confirmá que el cuerpo tampoco diga que se publico algo nuevo. Si lo
  dice, corregilo: el mail y la pantalla son dos piezas del mismo hecho y no
  pueden decir cosas distintas.

  Y actualizá el header de cada `registro-client.tsx` si dice algo que deja de ser
  cierto sobre el bloque de "listo".
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run build &amp;&amp; grep -n "yaExistia" app/registrar-salon/actions.ts app/registrar-proveedor/actions.ts</automated>
    <human-check>
      1. `/registrar-salon` con un mail NUEVO: la pantalla de exito es la de
         siempre, palabra por palabra
      2. Repetir el alta con EL MISMO mail y cambiando la capacidad: la pantalla
         tiene que decir que ya tenias ficha, que lo que escribiste NO se guardo,
         y mandarte a entrar por el link
      3. Verificar en la base que la capacidad NO cambio (el comportamiento de la
         RPC es el correcto y no se toco)
      4. Verificar que el mail que llega es el de "Tu link nuevo para entrar a
         LABURO" y que no promete una publicacion nueva
      5. Repetir los pasos 1 a 4 en `/registrar-proveedor`
      6. El aviso de Telegram (cuando este configurado) sigue distinguiendo alta
         nueva de pedido de link, como ya hacia
    </human-check>
  </verify>

  <done>
  Reinscribirse deja de decir "listo" cuando no guardo nada. Las dos pantallas
  dicen la verdad y ofrecen la salida real. Ninguna RPC cambio, ninguna migracion
  se escribio, y la razon de seguridad quedo escrita en los dos headers.
  </done>

  <commit>fix(altas): reinscribirse decia listo y no actualizaba nada</commit>
</task>

<task type="auto" n="8">
  <name>Tarea 8 (E): la 0070 documenta las fotos del salon aplicadas a mano</name>

  <files>
    supabase/migrations/staff_app_0070_las_fotos_del_salon.sql (nuevo, NO aplicar)
  </files>

  <action>
  Verificado: las fotos de los salones existen en la base y NO tienen migracion en
  el repo. Las migraciones cortan en 0067 (mas la 0068 y la 0069 que escribio la
  tanda anterior y siguen sin aplicar) y
  `grep -rn "fotos" supabase/migrations/` da CERO. El codigo TypeScript SI esta
  commiteado (`6c347d0`, "feat(salones): las fotos, que es lo que mas le faltaba al
  pool"): `components/proveedor/salon-fotos.tsx`, `lib/salones.ts:76-87`,
  `app/salones/[slug]/page.tsx:125-145` y
  `app/acceso-proveedor/[token]/actions.ts:330-378` ya usan todo esto. O sea que un
  entorno nuevo levantado desde cero se queda sin fotos y con codigo que llama a
  una funcion que no existe.

  Escribí `supabase/migrations/staff_app_0070_las_fotos_del_salon.sql`. **NO la
  apliques.** Franco la aplica.

  **El header, primero.** Convencion de la 0067: `-- staff_app_0070_<nombre>`,
  despues el relato en criollo, TODO el archivo sin acentos. Este header ademas
  tiene que decir algo que ningun otro dice, y es lo mas importante del archivo:
  esta migracion NO introduce un cambio, DOCUMENTA uno que ya esta aplicado a mano
  en produccion; la fecha en que se detecto (2/9/2026); y que por eso es idempotente
  y segura de correr sobre una base que ya la tiene. Sin ese parrafo, el proximo que
  la lea va a creer que las fotos no estan en produccion.

  **PIEZA 1: la columna.** Verificada en produccion:
  `staff_app.venue_details.fotos`, tipo `text[]`, `NOT NULL`,
  `DEFAULT '{}'::text[]`, ultima columna de la tabla.
  Va con `ADD COLUMN IF NOT EXISTS`. ⚠️ Ojo con el orden: en una tabla que ya tiene
  filas, un `NOT NULL` sin default falla. El default resuelve eso solo, pero
  escribilo en una sola sentencia con el default incluido y dejalo comentado.

  **PIEZA 2: la funcion `public.staff_app_salon_guardar_fotos`.** Verificada en
  produccion:
  - Firma: `(p_fotos text[], p_token text DEFAULT NULL::text)`
  - `RETURNS jsonb`, `LANGUAGE plpgsql`, `SECURITY DEFINER`,
    `SET search_path TO 'staff_app','public','pg_temp'`
  - Cuerpo, en este orden: resuelve el perfil con
    `staff_app.perfil_proveedor_del_caller()`; si da null y hay token, con
    `staff_app.perfil_proveedor_por_token(p_token)`; si no hay perfil devuelve
    `sin_perfil`; verifica que el perfil sea `tipo='salon'` o devuelve
    `no_es_salon`; deduplica CONSERVANDO EL ORDEN original con
    `SELECT DISTINCT ON (f) f, orden FROM unnest(coalesce(p_fotos,'{}')) WITH
    ORDINALITY AS t(f, orden)`, filtrando vacios y rechazando `f LIKE 'http%'` y
    `f LIKE '%..%'`; reagrupa con `array_agg(f ORDER BY orden)`; recorta a 8 con
    `v_fotos[1:8]`; hace `UPDATE venue_details SET fotos=v_fotos, updated_at=now()
    WHERE profile_id=v_id`; devuelve `sin_detalles` si `NOT FOUND`; si no,
    `{ok:true, fotos:...}`.
  - ⚠️ **CONSERVA LOS COMENTARIOS QUE TRAE ADENTRO.** Explican por que NO usa
    `array_agg(DISTINCT ...)` (ordenaria alfabetico y le cambiaria la portada al
    salon) y por que filtra las URLs externas (para que no se pueda guardar una
    imagen alojada afuera). Son la parte mas valiosa de la funcion y son
    exactamente lo que se pierde cuando algo se aplica a mano.
  - Va con `CREATE OR REPLACE FUNCTION`.

  **PIEZA 3: el bucket y sus politicas.** Verificado en produccion: bucket
  `venue-photos`, `public = true`, hoy con 0 archivos. Dos politicas sobre
  `storage.objects`: `venue-photos public insert` (INSERT) y
  `venue-photos public read` (SELECT).
  - El bucket: `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING`.
  - Las politicas: `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`, con el
    nombre EXACTO (llevan espacios y guiones, asi que van entrecomilladas).
  - Extraé las definiciones reales de las dos politicas (`qual` y `with_check`) de
    `pg_policies`, no las inventes. El bucket es publico a proposito y
    `lib/salones.ts:76` explica por que; que la migracion diga lo mismo.

  **PIEZA 4, LA QUE TENES QUE EXTRAER VOS.** Las funciones
  `public.staff_app_vidriera_salones(p_texto text, p_provincia text, p_personas
  integer)` y `public.staff_app_vidriera_salon(p_slug text)` TAMBIEN fueron
  modificadas fuera del repo. Verificado por dos caminos: las dos mencionan `fotos`
  en su cuerpo en produccion, y la version de la 0064 en el repo no; y el codigo ya
  consume lo nuevo (`app/salones/actions.ts:48-51` espera `portada` y
  `cuantas_fotos` en el listado, y `:59` espera `fotos: string[]` en la ficha).

  Traelas TAL CUAL estan corriendo, con el MCP de Supabase, proyecto
  `luillpzfqzbpoqkgvjuw`:

      SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('staff_app_vidriera_salones', 'staff_app_vidriera_salon');

  Pegalas en la migracion como `CREATE OR REPLACE FUNCTION`, sin reescribirlas ni
  "mejorarlas". Si el `pg_get_functiondef` viene sin los comentarios internos (los
  comentarios de adentro del cuerpo si vienen; los de afuera no), sumá arriba de
  cada una un comentario tuyo diciendo que se extrajo de produccion el 2/9 y por
  que.

  Aprovechá la misma sesion de MCP para reconfirmar las piezas 1, 2 y 3, que
  vienen dictadas en este plan pero fueron leidas antes de escribirlo. Si algo no
  coincide, manda lo que hay en la base, no lo que dice el plan.

  **PIEZA 5: los grants. ⚠️ ESTA ES LA QUE SE PUEDE ROMPER SOLA.**
  Verificado: `guardarFotosSalon` (`app/acceso-proveedor/[token]/actions.ts:368-378`)
  usa `createClient()`, o sea el cliente con el JWT del caller, y el salon entra
  por token SIN sesion. Si copias el patron de la 0064
  (`REVOKE ... FROM public, anon, authenticated` + `GRANT ... TO service_role`), las
  fotos DEJAN DE GUARDARSE en produccion el dia que Franco aplique esto. Lo mismo
  con las dos vidrieras, que las llaman paginas publicas sin sesion.

  Extraé los grants REALES, no los deduzcas:

      SELECT p.proname, p.proacl
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('staff_app_salon_guardar_fotos',
                           'staff_app_vidriera_salones',
                           'staff_app_vidriera_salon');

  Traducí ese ACL a `REVOKE`/`GRANT` explicitos con la firma completa, como hacen
  todas las migraciones del repo. Y dejá un comentario al lado del grant de
  `staff_app_salon_guardar_fotos` diciendo POR QUE lleva ese rol y no
  `service_role`: el salon entra por token, sin sesion, y la seguridad la da el
  token que la propia funcion valida, no el grant. Ese comentario es el que evita
  que alguien lo "endurezca" y rompa las fotos.

  **Cierre:** `COMMENT ON FUNCTION` para las tres funciones, como hace el resto del
  repo.

  ⚠️ **NO APLIQUES NADA.** Ni la migracion, ni un `apply_migration` por MCP, ni un
  `execute_sql` que escriba. El MCP se usa SOLO para leer. Escribís el archivo y
  ahi termina tu trabajo.
  </action>

  <verify>
    <automated>test -f supabase/migrations/staff_app_0070_las_fotos_del_salon.sql &amp;&amp; grep -c "IF NOT EXISTS\|CREATE OR REPLACE\|ON CONFLICT DO NOTHING\|DROP POLICY IF EXISTS" supabase/migrations/staff_app_0070_las_fotos_del_salon.sql &amp;&amp; ! grep -nP '[áéíóúñÁÉÍÓÚÑ¿¡]' supabase/migrations/staff_app_0070_las_fotos_del_salon.sql</automated>
    <human-check>
      1. Leer el archivo entero de arriba a abajo: el header tiene que decir que
         documenta un cambio YA aplicado a mano y en que fecha se detecto
      2. Toda sentencia es idempotente: `ADD COLUMN IF NOT EXISTS`,
         `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING`,
         `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`
      3. Los comentarios internos de `staff_app_salon_guardar_fotos` (el del
         `array_agg(DISTINCT ...)` y el de las URLs externas) estan presentes
      4. Las dos vidrieras vienen de `pg_get_functiondef`, no reescritas
      5. Los grants salen de `proacl` y NO de copiar la 0064. El de
         `staff_app_salon_guardar_fotos` tiene su comentario del por que
      6. Cero acentos en todo el archivo (el chequeo automatico ya lo cubre), pero
         ⚠️ mirá a mano si quedo algun literal de datos que NECESITE acentos, como
         paso con el `translate()` de la 0069. Si lo hay, va identico al de
         produccion y con un comentario al lado aclarando que es tabla de datos y
         no prosa
      7. Ninguna sentencia se ejecuto contra la base
    </human-check>
  </verify>

  <done>
  La 0070 esta escrita y sin aplicar. Un entorno nuevo levantado desde cero
  reproduce la columna, la funcion de guardado, el bucket, sus dos politicas, las
  dos vidrieras actualizadas y los grants reales. El archivo dice que documenta un
  cambio ya aplicado a mano el 2/9.
  </done>

  <commit>docs(migraciones): la 0070 documenta las fotos del salon aplicadas a mano</commit>
</task>

<!-- ══════════════════ TANDA 3 (sesion nueva, /clear antes) ══════════════════ -->

<task type="auto" n="9">
  <name>Tarea 9 (F): el link de acceso vencia siendo valido en los otros dos caminos</name>

  <files>
    app/auth/callback/route.ts
    app/acceso-staff/actions.ts
    app/entrar/actions.ts
    app/entrar/entrar-client.tsx
    app/login/login-form.tsx
    components/emails/link-de-acceso-email.tsx (nuevo)
  </files>

  <action>
  ⚠️ **ESTA ES LA MAS DELICADA DE LAS NUEVE. TOCA AUTENTICACION. SI SALE MAL,
  NADIE ENTRA.** Va sola, en su propia sesion, con las ocho anteriores ya verdes.

  **EL PROBLEMA, verificado.** El arreglo YA existe y funciona en UN camino:
  `lib/auth-link.ts:46-64` arma el link con `admin.generateLink({type:'recovery'})`
  y `token_hash`, y `app/definir-contrasena/confirmar/route.ts:43-53` lo canjea con
  `verifyOtp`. Los otros dos siguen con `exchangeCodeForSession` puro, que es PKCE
  y falla cuando el link se abre en otro navegador (el caso real: el visor interno
  de Gmail en el celular, donde no existe el `code_verifier` que quedo guardado en
  el navegador que pidio el link):
  - `app/auth/callback/route.ts:61`: el magic link de `/entrar`, `/login` y
    `/acceso-staff`.
  - `app/definir-contrasena/confirmar/route.ts:60`: la rama `code`, la que usa "es
    mi primera vez" via `resetPasswordForEmail` en `app/acceso-staff/actions.ts:119`.

  Es el camino que le toca a las 686 fichas del pool viejo, porque el cron de
  bienvenida las manda a `/acceso-staff` sin token
  (`app/api/cron/bienvenida/route.ts:140`).

  **LA PIEZA QUE HAY QUE ENTENDER ANTES DE ESCRIBIR UNA LINEA.**

  Aceptar `token_hash` en el canje no alcanza por si solo: si el link que llega al
  mail sigue trayendo `code`, la rama nueva no se ejecuta nunca. Para que el link
  traiga `token_hash` hay dos caminos y uno esta prohibido:

  - ❌ Cambiar la plantilla de Supabase a `{{ .TokenHash }}`. **PROHIBIDO** (regla
    dura 9): el proyecto lo comparten LABURO y HITO, y las plantillas son una sola
    por proyecto. Arregla uno y rompe el login del otro.
  - ✅ Dejar de usar el mail de Supabase para estos dos caminos y mandar el
    NUESTRO, con el link armado por `admin.generateLink`, que devuelve el
    `hashed_token` sin mandar nada. **Es exactamente lo que el repo ya decidio y
    ya probo** en `lib/auth-link.ts` (leé su header: "POR QUE generateLink Y NO
    resetPasswordForEmail"). No toca ninguna plantilla, y de yapa saca a LABURO de
    depender de un mail compartido con HITO.

  Se va por el segundo.

  **REGLA DURA DE ESTA TAREA, ademas de las generales:**
  1. **`exchangeCodeForSession` NO SE SACA DE NINGUNO DE LOS DOS LADOS.** Los links
     viejos ya estan en casillas de gente real y tienen que seguir andando. El
     resultado acepta LAS DOS formas. Es el mismo criterio que ya esta escrito en
     `definir-contrasena/confirmar/route.ts:41-42`.
  2. **Valvula de seguridad:** si armar el link propio falla por cualquier motivo,
     se cae a `signInWithOtp` / `resetPasswordForEmail`, o sea al comportamiento de
     HOY. El peor caso posible de esta tarea tiene que ser "quedo como estaba",
     nunca "no entra nadie". `lib/auth-link.ts` ya esta escrito con esa filosofia
     ("devuelve null si algo falla; el que llama TIENE que seguir andando igual").
  3. **No se toca `signInWithPassword`.** Entrar con mail y contrasena queda intacto
     de punta a punta: es la red debajo de la red mientras se prueba esto.

  **PASO 1: `app/auth/callback/route.ts`, la rama nueva.**
  Antes de la rama de `code` (linea 60), agregá la de `token_hash`, calcada de
  `definir-contrasena/confirmar/route.ts:43-53`:
  - Leer `token_hash` y `type` de los search params.
  - `type` es entrada no confiable: whitelistealo contra `magiclink | email |
    recovery` y cae a `magiclink` si no matchea. Mismo criterio que ya usa
    `comoValido()` en este archivo dos funciones mas arriba.
  - `verifyOtp({ token_hash, type })`. Si falla, redirigir a
    `/entrar?motivo=link_vencido`, que es exactamente lo que ya hace la rama de
    `code` y ya tiene su pantalla.
  - Si sale bien, NO redirigir a ningun panel: seguir de largo al ruteo por
    identidad que ya esta escrito abajo. ⚠️ Esto es lo mas importante del paso: el
    header del archivo tiene la regla dura de que toda pantalla de dos actores sale
    por aca, y saltearla es el bug que ya rompio LABURO tres veces. El `como` se
    conserva igual que hoy.
  - Actualizá el header con las dos formas de link y el por que, en el mismo tono
    que el de `definir-contrasena/confirmar`.

  **PASO 2: el mail propio.** `components/emails/link-de-acceso-email.tsx`.
  Uno solo, corto: saludo, un boton con el link, el link en texto plano abajo
  (para el que no puede tocar el boton), y el pie que ya usan los demas. Molde:
  `components/emails/welcome-email.tsx`, y reusa `components/emails/encabezado.tsx`
  y `components/emails/pie-whatsapp.tsx` si aplica. Nada nuevo: que se sienta de la
  misma familia que los otros catorce.

  Contenido en criollo, corto, y que diga que el link es de un solo uso y vence.
  Sin guiones largos.

  **PASO 3: el generador del link, compartido.** En `lib/auth-link.ts`, al lado de
  `linkParaElegirContrasena`, sumá su hermano para ENTRAR (no para definir
  contrasena): `admin.generateLink({ type: 'magiclink', email })` y devolver
  `siteUrl('/auth/callback?token_hash=...&type=magiclink' + (como ? '&como=' + como : ''))`.
  - Mismo contrato: devuelve `null` si algo falla, nunca tira, loguea con etiqueta.
  - ⚠️ `generateLink` con `type: 'magiclink'` falla si el usuario no existe.
    Manejalo con el mismo patron que ya tiene el archivo arriba: `admin.createUser`
    con `.catch(() => undefined)` ANTES, pero **solo cuando el caller dice que se
    puede crear**. Esa decision no es del helper: hoy la toman los callers
    (`crearSiHaceFalta` en `entrar-client.tsx:150-152`, `shouldCreateUser: true`
    despues del chequeo de pool en `acceso-staff/actions.ts:51-56`, y
    `shouldCreateUser: false` en `login-form.tsx:102`). Pasala como parametro y
    respetala: crear cuentas de mas convierte la puerta en un oraculo de mails.
  - ⚠️ Verificá empiricamente que `verifyOtp` acepta el `type` que devuelve
    `generateLink` para magiclink. Si en esta version de Supabase el tipo correcto
    resulta ser `email` y no `magiclink`, ajustá el link Y el whitelist del paso 1,
    y dejalo escrito en el header. No lo des por sentado: es el unico detalle de
    esta tarea que no se puede verificar leyendo el repo.
  - Ampliá el header de `lib/auth-link.ts` para que cuente que ahora vive ahi el
    generador de los DOS links (definir contrasena y entrar), y por que los dos
    esquivan las plantillas de Supabase (la de HITO compartida, ademas de la de la
    marca).

  **PASO 4: los tres emisores.** Los tres pasan a: armar el link propio, y si sale,
  mandar el mail nuevo; si no sale, caer al comportamiento de hoy.

  - **`app/acceso-staff/actions.ts`**, las DOS funciones:
    - `pedirLink` (linea 51, `signInWithOtp`): despues del chequeo de pool que ya
      esta, armar el link con `como: "staff"`. ⚠️ Hoy el `emailRedirectTo` va sin
      `como`, asi que alguien que sea staff Y productora aterriza en el panel
      equivocado por el orden natural; agregarlo es correcto y es gratis, porque
      estamos tocando justo esa llamada.
    - `pedirLinkDeContrasena` (linea 119, `resetPasswordForEmail`): reemplazalo por
      `linkParaElegirContrasena(admin, clean, "acceso-staff")`, que YA existe, YA
      devuelve un `token_hash` y YA apunta a
      `/definir-contrasena/confirmar?token_hash=...&type=recovery`, que es una ruta
      que la 43-53 de ese route handler YA sabe canjear. O sea: la mitad de este
      paso es borrar codigo y usar lo que ya funciona.
    - ⚠️ Los rate limits, el chequeo de pool y el retorno SIEMPRE `{ ok: true }`
      (respuesta uniforme, decision de Franco del 28/7) quedan EXACTAMENTE como
      estan. Ninguna de las dos funciones puede empezar a revelar si el mail
      existe.

  - **`app/entrar/entrar-client.tsx`** (linea 155): hoy llama a `signInWithOtp`
    desde el CLIENTE. Mové el envio a un server action en `app/entrar/actions.ts`
    (que ya existe), que hace el chequeo de `proveedorPuedeCrearCuenta` del lado
    del servidor (hoy ya es un server action llamado desde el cliente, asi que solo
    se muda adentro), arma el link con el `como` correcto y manda el mail. El
    cliente queda con una sola llamada y sigue mostrando `setLinkMandado(true)`
    pase lo que pase. ⚠️ La respuesta uniforme del comentario de las lineas 163 a
    165 no se toca: el server action devuelve siempre lo mismo.

  - **`app/login/login-form.tsx`** (linea 100): mismo cambio, con
    `shouldCreateUser: false` respetado (o sea, el helper NO crea cuenta). El
    comentario largo de las lineas 112 a 125 explica por que la pantalla es igual
    exista o no la cuenta: sigue valiendo palabra por palabra y no se toca.

  **LO QUE NO SE HACE (y va escrito como pendiente para Franco):**
  Las plantillas `supabase/email-templates/magic-link.html` y
  `definir-contrasena.html` quedan como estan, en el repo y en el panel. Despues de
  esta tarea LABURO ya no depende de ellas, pero HITO si, asi que sacarlas o
  cambiarlas es trabajo de otro dia y de otra cabeza. Dejalo escrito en el SUMMARY.

  ⚠️ Si en algun momento de la ejecucion aparece que el arreglo NECESITA tocar una
  plantilla de Supabase, PARÁ. No lo hagas. Dejalo escrito como pendiente para
  Franco explicando exactamente que habria que cambiar, en que plantilla, y por que
  es riesgoso (el login de HITO).
  </action>

  <verify>
    <automated>npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run build &amp;&amp; grep -n "exchangeCodeForSession\|verifyOtp" app/auth/callback/route.ts app/definir-contrasena/confirmar/route.ts</automated>
    <human-check>
      ⚠️ ESTA VERIFICACION NO ES OPCIONAL Y NO SE HACE "MIRANDO EL CODIGO".
      Se prueba entrando de verdad, y el caso que importa es el de DOS navegadores
      distintos, que es el bug que se vino a arreglar.

      1. `npm run dev`. Confirmar que `SUPABASE_SERVICE_ROLE_KEY` esta en
         `.env.local` (verificado que si) y que el mailer local manda o loguea.
      2. `/entrar` como productora, mail sin contrasena: pedir el link. El mail que
         llega tiene que ser EL NUESTRO, con marca, y su URL tiene que traer
         `token_hash` y `como=productora`.
      3. ⚠️ **Copiar ese link y abrirlo en OTRO navegador** (o en una ventana de
         incognito recien abierta, que es donde no existe el `code_verifier`).
         Tiene que entrar y aterrizar en `/dashboard`. ESE es el bug arreglado.
      4. Repetir 2 y 3 con `/entrar` como staff, como proveedor y como salon:
         cada uno tiene que aterrizar en su panel (`/panel-staff` y
         `/mi-proveedor`), no en el del otro.
      5. `/acceso-staff`, "es mi primera vez": el mail tiene que traer
         `token_hash` y llevar a `/definir-contrasena`, abierto en otro navegador.
      6. `/login` con un mail que NO tenga cuenta: la pantalla tiene que ser la
         misma de siempre (respuesta uniforme) y no puede crearse ninguna cuenta.
         Verificalo en `auth.users`.
      7. **Compatibilidad hacia atras, obligatoria.** Generar un link VIEJO con
         `code` (por ejemplo revirtiendo temporalmente un emisor, o disparando
         `signInWithOtp` a mano desde la consola del navegador) y confirmar que
         `/auth/callback?code=...` y `/definir-contrasena/confirmar?code=...`
         SIGUEN canjeando bien. Si esto falla, la tarea no esta hecha.
      8. Link ya usado y link vencido: los dos tienen que caer en la pantalla con
         `motivo=link_vencido`, no en un error crudo ni en una pantalla muda.
      9. Entrar con mail y CONTRASENA desde `/entrar` y desde `/login`: intacto.
      10. Prender la valvula a mano (por ejemplo, forzando que el helper devuelva
          null) y confirmar que el envio cae al camino viejo y la persona igual
          recibe su link. El peor caso tiene que ser "como antes".
    </human-check>
  </verify>

  <done>
  Los tres caminos aceptan `token_hash` y ninguno perdio `exchangeCodeForSession`.
  Un link abierto en un navegador distinto del que lo pidio entra. Los tres
  emisores mandan nuestro mail y caen al camino viejo si algo falla. Las plantillas
  de Supabase no se tocaron. La respuesta de las puertas sigue siendo uniforme y no
  revela que mails existen.
  </done>

  <commit>fix(login): el link de acceso vencia siendo valido en los otros dos caminos</commit>
</task>

</tasks>

<verificacion_final>
Al cerrar CADA tanda (no solo al final de las tres):

1. `npm run typecheck && npm run lint && npm run build` en verde.
2. `git log --oneline`: un commit por tarea, ninguno mezclado, todos arriba de
   `3373ae9`.
3. `git status`: limpio salvo los ~40 de `testsprite_tests/` y el `.gitignore`
   modificado, que ya estaban antes y NO se tocan.
4. Ningun `git push` ejecutado.
5. Ninguna migracion aplicada. Al terminar la tanda 2, `supabase/migrations/`
   tiene TRES archivos sin aplicar: 0068, 0069 y 0070.
6. Guiones largos en las lineas AGREGADAS:
   `git diff 3373ae9 -U0 | grep '^+' | grep '—'` tiene que dar vacio.
7. Acentos en el SQL nuevo:
   `grep -nP '[áéíóúñÁÉÍÓÚÑ¿¡]' supabase/migrations/staff_app_0070_*.sql`
   tiene que dar vacio (salvo un literal de datos justificado y comentado).
8. `git diff 42b794e --stat`: ninguna ruta ni archivo renombrado, y la landing
   sin cambios de copy.

Y al final de la tanda 3, ademas:

9. Entrar a LABURO por los cuatro caminos (productora, staff, proveedor, salon),
   con link y con contrasena, desde dos navegadores distintos. Si alguno falla, se
   revierte SOLO el commit de la Tarea 9 y se avisa: los otros ocho no dependen de
   el.
</verificacion_final>

<pendiente_para_franco>
Al terminar, decirle a Franco, en este orden:

1. **TRES migraciones para aplicar, en orden: 0068, 0069 y 0070.** Las dos
   primeras venian de la tanda anterior.
2. **La 0070 no cambia nada en produccion**: documenta lo que alguien ya aplico a
   mano (la columna `fotos`, la funcion de guardado, el bucket `venue-photos` y sus
   dos politicas, y las dos vidrieras de salones). Es idempotente a proposito, para
   poder correrla igual sobre la base que ya la tiene. Su valor real es que un
   entorno nuevo levantado desde cero ahora reproduce las fotos.
3. **Ninguna de las tres tiene orden de deploy.** Las razones de la 0068 y la 0069
   ya estaban escritas; la 0070 no toca ninguna firma que el codigo llame distinto.
4. **Despues de aplicar la 0070**, subir una foto a un salon de prueba desde su
   panel y confirmar que aparece en `/salones/<slug>`. Es la unica forma de
   confirmar que los grants extraidos quedaron bien.
5. **Las plantillas de mail de Supabase quedaron sin tocar.** Despues de la Tarea 9,
   LABURO ya no depende de ellas para entrar, pero HITO si. Sacarlas o cambiarlas
   es trabajo de otro dia.
6. **`quien-ficho` devuelve 503 todos los dias** porque `MAIL_ADMIN_TO` no esta
   cargada. Con la Tarea 5 eso figura como `sin_configurar` y no dispara falsa
   alarma, pero el resumen de fichaje NO se esta mandando a nadie. Cargar
   `MAIL_ADMIN_TO` lo prende.
7. **`alerta()` sigue siendo un no-op.** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` y
   `MAIL_ADMIN_TO` estan las tres sin cargar, asi que el aviso nuevo del cron no
   llega a ningun lado. El que sirve hoy es el status 500, que Cloudflare si ve.
8. **Los commits siguen sin pushear.** Contar cuantos son en total (los seis
   anteriores mas los de estas tandas).
9. **Los ~40 archivos de `testsprite_tests/` y el `.gitignore` modificado quedaron
   exactamente como estaban**, sin commitear, sin borrar y sin tocar.
</pendiente_para_franco>

<fuera_de_alcance>
Cosas que aparecieron y NO se tocan, para que no se cuelen:

- **Poner `COALESCE` en `staff_app_set_gig_details`.** La Tarea 4 explica por que
  seria peor. Si alguien insiste, que lea ese razonamiento primero.
- **Cambiar las RPC de reinscripcion** (`staff_app_registrar_salon` y
  `staff_app_registrar_proveedor`) para que pisen los datos. La Tarea 7 explica por
  que es una regresion de seguridad.
- **Tocar las plantillas de Supabase**, en el repo o en el panel.
- **Sacar `exchangeCodeForSession`** de ningun lado.
- **Editar los datos del salon o del proveedor desde el formulario publico.** El
  lugar es el panel con link, y ya existe.
- **Cambiar el tamano de pagina de la busqueda** (queda en 50) ni agregar una tira
  de numeros de pagina.
- **Aplicar cualquier migracion**, con MCP o sin MCP. El MCP se usa solo para leer.
- **Los ~40 archivos de `testsprite_tests/` y el `.gitignore` modificado.**
- **Los cuatro breakpoints que calibro `42b794e`** y la copy de la landing.
- **Limpiar los guiones largos que ya existen en el repo.**
</fuera_de_alcance>
