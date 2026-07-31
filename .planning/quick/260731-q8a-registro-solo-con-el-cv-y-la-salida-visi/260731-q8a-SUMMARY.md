---
phase: quick/260731-q8a
plan: 01
subsystem: ui
tags: [registro, cv, parse-cv, gemini, onboarding, accesibilidad, ley-25326, motion]

requires:
  - phase: quick/20260731-cron-unico-diario
    provides: "el cron diario que corre recordatorio-perfil, o sea el que va a levantar las fichas que este cambio deja a medias a proposito"
provides:
  - "Camino corto en /sumate: se termina el registro adjuntando solo el CV"
  - "Gate por `modo` del staff_app_mark_perfil_confirmado"
  - "registerApplicant tolerante a payload parcial (helpers txt/arr)"
  - "Oficios de la IA filtrados contra el catalogo antes de tocar la base"
  - "Salida a /sumate arriba del formulario de /acceso-staff"
affects: [recordatorio-perfil, editar-perfil-staff, marketplace-3-lados]

tech-stack:
  added: []
  patterns:
    - "El payload del cliente se lee siempre con helpers tolerantes (txt/arr), nunca por acceso directo a la clave"
    - "Salida de IA que va a la base pasa por allowlist del catalogo"
    - "El estado de una lectura asincrona se anuncia con role=status + aria-live"

key-files:
  created:
    - app/sumate/registro-rapido.tsx
    - app/sumate/sumate-client.tsx
  modified:
    - app/sumate/actions.ts
    - app/sumate/registro-form.tsx
    - app/sumate/page.tsx
    - app/acceso-staff/staff-login-form.tsx

key-decisions:
  - "El recordatorio de perfil incompleto agarra SOLO al que entra por la via corta del CV (decision de Franco). El gate es por `modo`, no por una regla de perfil util"
  - "El formulario largo no cambia su comportamiento: sigue estampando perfil_confirmado_at como hoy"
  - "modo ausente o desconocido cae en rapido: mandar un recordatorio de mas es barato, abandonar una ficha es para siempre"
  - "En la via corta el picker acepta solo PDF o imagen, que es lo unico que el servidor guarda"

patterns-established:
  - "Un solo intento de parseo por seleccion de archivo (la cuota de Gemini es compartida y la ruta tiene freno por IP)"
  - "Pantalla de exito unica para los dos caminos de registro, en sumate-client.tsx"

requirements-completed: [QUICK-260731-q8a]

duration: 35min
completed: 2026-07-31
---

# Quick 260731-q8a: registro solo con el CV y la salida visible en el login

**El registro de staff dejo de ser un muro de 21 campos: se termina adjuntando el CV y marcando el consentimiento, y el que cae en /acceso-staff sin ficha ve ese camino sin scrollear.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3
- **Files:** 2 creados, 4 modificados
- **Commits:** `701e558`, `f24b929`, `a4cf9f8`

## Decision de Franco aplicada (ajuste sobre el plan)

El plan dejaba abierto a quien agarra el recordatorio de perfil incompleto y proponia una regla de "perfil util" (telefono + oficio + provincia o ciudad). **Franco resolvio antes de ejecutar: el recordatorio agarra SOLO al que entra por la via corta del CV.** Se implemento eso y se descarto la regla de perfil util.

Concretamente:

- El **formulario largo no cambia**: quien lo manda sigue quedando marcado con `staff_app_mark_perfil_confirmado`, exactamente como hoy, sin importar que campos lleno.
- La **via corta no estampa la marca**, asi que la ficha queda con `perfil_confirmado_at` en NULL y `staff_app_perfil_reminder_batch` (que filtra justo por ese NULL) la levanta sola a los 5 dias.
- El gate quedo en dos lineas: `const modo = input.modo === "completo" ? "completo" : "rapido"` y `const perfilCompleto = modo === "completo"`. **Modo ausente o desconocido cae en "rapido"**: si nos equivocamos, que sea mandando un recordatorio de mas.
- **Cero migraciones nuevas**, como preveia el plan.

## Que se construyo

### Task 1 (`701e558`): el server acepta el payload corto

`app/sumate/actions.ts`:

- `RegisterInput` pasa a todo-opcional (mas la clave nueva `modo?: "rapido" | "completo"`) y aparecen dos helpers locales, `txt(v: unknown)` y `arr(v: unknown)`. **Esto cierra el bug latente que marcaba el plan**: el codigo hacia `input.apellido.trim()`, `input.oficios.length` y `input.donde_trabajar.length`, y el payload corto no trae ninguna de esas claves, o sea que sin los helpers el server action reventaba con un TypeError. Hoy no queda ni un acceso directo a una clave del payload (verificado por grep, ver abajo).
- Los tres booleanos pasan a `input.X === true`, `experiencia` solo se manda si es boolean y `fecha_nacimiento` solo si es texto no vacio.
- `OFICIOS_VALIDOS`: set plano del catalogo de `@/lib/data/oficios`, armado una sola vez a nivel de modulo. En la via corta el array de oficios lo arma un modelo de lenguaje leyendo el PDF, asi que es salida de IA y no input elegido por la persona: solo pasan al RPC los valores que existen en el catalogo (T-Q8A-03).
- El comentario viejo del bloque de la marca ("El que se registra por /sumate lleno el formulario ENTERO") se reescribio para decir la verdad nueva.
- **No se toco** la normalizacion del email (`.trim().toLowerCase()` sigue igual, ahora via `txt()`), ni el orden de las validaciones, ni el manejo del CV huerfano, ni el bloque de la bienvenida.

### Task 2 (`f24b929`): /sumate se termina solo con el CV

- **`app/sumate/registro-rapido.tsx` (nuevo).** Adjuntar el CV dispara la lectura sola, sin boton intermedio y con un solo intento por seleccion. `<label htmlFor="cv-rapido">` visible sobre un `<input type="file">` nativo (enfocable con teclado, `focus-visible:ring`), el bloque lleva `aria-busy` mientras lee y un `<p role="status" aria-live="polite">` anuncia "Leyendo tu CV", el resultado o el error. Si el parser trajo nombre y email se muestran como texto con un boton "Corregir"; si falta uno, se pide **solo** ese; si el parseo fallo, se piden los dos con una linea honesta (y el CV se sube igual). El consentimiento Ley 25.326 va con el texto exacto del formulario largo, en un click al lado del boton. Una sola columna, mobile-first, animacion con `motion/react`.
- **`app/sumate/sumate-client.tsx` (nuevo).** Switch `rapido | completo` (arranca en rapido) y la pantalla de exito compartida `RegistroListo`, extraida tal cual del branch `done` del form largo. Por la via corta agrega un parrafo que dice que los datos salieron del CV y que cuando pueda entre a revisarlos, que es exactamente lo que el recordatorio de la 0034 le va a pedir.
- **`app/sumate/registro-form.tsx`.** Pierde el estado `done` y el branch de exito, recibe `{ onDone, onVolver }`, suma `modo: "completo"` al payload y un "Volver al registro con CV" arriba. El resto del formulario, los comentarios de conversion L4/L5 y `PAGO_TEXTO` quedaron intactos.
- **`app/sumate/page.tsx`.** Renderiza `<SumateClient />`. Se confirmo por grep que era el unico consumidor de `RegistroForm`.

### Task 3 (`a4cf9f8`): la salida sube arriba en /acceso-staff

- `SalidaSumate`, entre el subtitulo "Portal de Staff" y el formulario: una linea de copy ("Primera vez aca? Sumate al pool con tu CV. No hace falta que llenes nada, solo adjuntarlo"), el boton a `/sumate` con el tratamiento visual de `InvitacionSumate`, y un separador con "o" mas la linea que ata con el login de abajo. Solo se renderiza cuando hay formulario (vista `clave` o `link` y `sent` en false).
- Se borro el bloque duplicado del pie ("Primera vez en LABURO?"). Los otros tres links del pie quedan igual.
- `InvitacionSumate` ahora tambien dice que alcanza con el CV, y su comentario de cabecera explica por que el mensaje sigue siendo uniforme.
- **`app/acceso-staff/actions.ts` no aparece en el diff.** La respuesta uniforme y los frenos de abuso quedaron intactos, y ningun texto nuevo confirma ni desmiente si un mail esta en el pool.

## Deviations from Plan

### Ajuste pedido por Franco

**1. El gate del perfil confirmado es por `modo`, sin regla de "perfil util"**
- **Task:** 1
- **Que decia el plan:** `perfilCompleto = modo === "completo" && perfilUtil(telefono, oficios, ubicacion)`.
- **Que se hizo:** `perfilCompleto = modo === "completo"`. Franco cerro la decision antes de ejecutar: el formulario largo no cambia su comportamiento y el recordatorio agarra solo a la via corta.
- **Commit:** `701e558`

### Auto-fixed Issues

**2. [Rule 1 - Bug] Un payload que no es objeto tiraba un 500**
- **Found during:** Task 1
- **Issue:** `JSON.parse("null")`, `"3"` o `"[]"` parsean bien y despues revientan al leer la primera clave. Con los helpers nuevos el riesgo seguia igual (`txt(input.nombre)` sobre `null` explota).
- **Fix:** guarda explicita despues del parse: si no es un objeto plano, se devuelve "Datos invalidos" en vez de romper el server action.
- **Files:** `app/sumate/actions.ts`
- **Commit:** `701e558`

**3. [Rule 2 - Missing critical] El picker de la via corta ofrecia formatos que el servidor rechaza**
- **Found during:** Task 2
- **Issue:** el plan pedia `accept=".pdf,.doc,.docx,image/*"` (copiado del form largo), pero `sniffCvMime` valida el MIME real y solo acepta PDF o imagen. En el form largo el CV es opcional y el error es un tropiezo; en la via corta el CV **es** el registro, asi que un .docx garantizaba llegar hasta el final y comerse "El CV tiene que ser un PDF o una imagen" con todo lleno.
- **Fix:** `accept=".pdf,image/*"` mas una guarda en el `onChange` que avisa al instante ("Ese formato no lo podemos leer. Subi el CV en PDF o sacale una foto") y limpia la seleccion.
- **Files:** `app/sumate/registro-rapido.tsx`
- **Commit:** `f24b929`

**4. [Rule 3 - Blocking] El bloque nuevo empujaba el campo de email fuera de pantalla**
- **Found during:** Task 3
- **Issue:** el subtitulo "Portal de Staff" tenia `mb-[64px]` en mobile; sumando el bloque nuevo, el requisito de "ver la salida sin scrollear sin perder el campo de email" no cerraba en 390px de ancho con pantallas cortas.
- **Fix:** el margen del subtitulo se achica a `mb-10 md:mb-16` **solo** en las vistas con formulario; en las pantallas de resultado queda como estaba. Sumado al borrado del bloque del pie, el neto de altura es practicamente cero.
- **Files:** `app/acceso-staff/staff-login-form.tsx`
- **Commit:** `a4cf9f8`

### Limpieza de estilo

Se saco el guion largo de los comentarios de cabecera de `page.tsx` y `registro-form.tsx`, como pedia el plan. Cero guiones largos en los seis archivos tocados (gate abajo).

## Verification

Todos los gates corridos de verdad. Salida real:

**`npm run typecheck`** (limpio, sin output):
```
> laburo@0.1.0 typecheck
> tsc --noEmit
```

**`npm run lint`** (0 errores; las 3 warnings son preexistentes y ninguna esta en un archivo de este plan salvo la de `registro-form.tsx:50`, que es el `toggle()` de siempre, solo se corrio de linea 44 a 50):
```
/Users/fridao/Proyectos/SOMOS DER/staff-app/app/(portal)/staff/[id]/cv-actions.ts
  47:5  warning  Unused eslint-disable directive ...
/Users/fridao/Proyectos/SOMOS DER/staff-app/app/sumate/registro-form.tsx
  50:5  warning  Expected an assignment or function call and instead saw an expression
/Users/fridao/Proyectos/SOMOS DER/staff-app/components/emails/pie-whatsapp.tsx
  62:9  warning  Using `<img>` could result in slower LCP ...
✖ 3 problems (0 errors, 3 warnings)
```

**Greps del Task 1:**
```
OK gate        (grep -q 'if (profileId && perfilCompleto)')
OK oficios     (grep -q 'OFICIOS_VALIDOS')
0              (grep -c 'input.apellido.trim()')
em dash: 0
```

**Ningun acceso directo a una clave del payload** (`grep -n 'input\.' app/sumate/actions.ts`): las 24 lecturas pasan por `txt()`, `arr()` o una comparacion `=== true` / `typeof === "boolean"`. Las unicas excepciones son comparaciones seguras: `input.consentimiento !== true` y `input.modo === "completo"`. **El camino del payload corto (`{ email, nombre, consentimiento, modo }`) no puede tirar un TypeError.**

**Greps del Task 2:**
```
OK rapido      (modo: "rapido" en registro-rapido.tsx)
OK completo    (modo: "completo" en registro-form.tsx)
OK aria-live
OK htmlFor="cv-rapido"
OK ley         (Ley 25.326)
OK motion      (motion/react)
em dash total: 0   (registro-rapido + sumate-client + registro-form + page)
```

**Greps del Task 3:**
```
OK actions.ts intacto     (git status --porcelain app/acceso-staff/actions.ts vacio)
OK sin oraculo            (cero coincidencias de "no esta registrad|mail no encontrado|no encontramos ese|no existe ese")
GATES_OK                  ("Primera vez en LABURO" = 0, em dash = 0)
2                         (href="/sumate": el de arriba + el de InvitacionSumate)
```

**`npm run build`:** compila. `/sumate` sale como ruta estatica, 6.61 kB / 165 kB First Load.

## Self-Check: PASSED

- `app/sumate/registro-rapido.tsx` FOUND
- `app/sumate/sumate-client.tsx` FOUND
- `app/sumate/actions.ts` FOUND (modificado)
- `app/sumate/registro-form.tsx` FOUND (modificado)
- `app/sumate/page.tsx` FOUND (modificado)
- `app/acceso-staff/staff-login-form.tsx` FOUND (modificado)
- Commits `701e558`, `f24b929`, `a4cf9f8` FOUND en `git log`
- Working tree limpio despues del ultimo commit

## Human-check pendiente (NO verificado por mi)

No corri el navegador ni toque la base. Franco, esto es lo que falta probar, con `npm run dev` y el navegador en 390px de ancho:

1. Entrar a `/acceso-staff`. El bloque "Sumate con tu CV" tiene que verse **sin scrollear**, arriba del campo de email, y el campo de email tiene que seguir visible.
2. Leer el copy de esa pantalla: no puede decir ni sugerir si un mail esta o no en el pool.
3. Tocar el boton: tiene que llevar a `/sumate`.
4. En `/sumate`, adjuntar un PDF de CV real. Tiene que leerse solo (sin apretar nada), anunciarse "Leyendo tu CV" y despues aparecer "Te registramos como {nombre}, {email}" con los datos sacados del CV.
5. Marcar el consentimiento y enviar **sin escribir un caracter**. Tiene que llegar a "Quedaste registrado/a".
6. En la base, esa ficha tiene que haber quedado con `perfil_confirmado_at` en NULL:
   `select email, perfil_confirmado_at from staff_app.staff_profiles order by created_at desc limit 1;`
   (si la 0034 todavia no esta aplicada la columna no existe, y el chequeo pasa a ser el log: para el registro rapido **no** tiene que aparecer "mark_perfil_confirmado failed").
7. Probar el formulario largo ("Prefiero completar todo a mano") y enviarlo: esa ficha **si** tiene que quedar con `perfil_confirmado_at` estampado.
8. Probar el teclado en el paso 4: llegar al input del CV con Tab y abrirlo con Enter o Espacio, y que el foco se vea.

## Notas para el que siga

- **El CV es obligatorio en la via corta.** Es el sentido del camino: sin archivo no hay datos que leer. El que no lo tiene a mano tiene el link "Prefiero completar todo a mano" al pie.
- **El nombre se parte first-token / resto** al enviar (misma convencion con la que entro todo el pool viejo desde el Sheet), asi `p_nombre` no queda con el nombre completo adentro.
- **La cuota de Gemini es compartida con somosder-web.** Se hace **una** llamada por seleccion de archivo, sin reintento. Si el freno de la ruta (6 por minuto por IP) corta, la persona ve el mensaje honesto y escribe nombre y mail a mano.
- **Cero dependencias nuevas, cero migraciones nuevas.** Nada que aplicar contra la base por este cambio.
