---
fase: quick/260902-li2-los-seis-arreglos-que-faltaban
tanda: 2
tareas_plan: [6 (B), 7 (D), 8 (E)]
tareas_hechas: [6 (B), 7 (D)]
tareas_bloqueadas: [8 (E)]
tareas_pendientes: [9 (F)]
commits: [d6f36c4, 486a187]
base_de_la_tanda: 73f36e5
migraciones_escritas_sin_aplicar: [0068, 0069]
fecha: 2026-09-05
---

# Tanda 2: la paginación, la reinscripción, y la migración que quedó trabada

Dos de las tres tareas quedaron hechas y commiteadas. La tercera (la migración
0070 de las fotos del salón) **no se pudo hacer y no se escribió ningún archivo**,
por una razón concreta que está abajo: no hubo forma de leer producción desde esta
sesión, y el propio plan prohíbe deducir la pieza que se puede romper sola.

## Lo que quedó hecho

### Tarea 6 (B) · `d6f36c4` · la búsqueda muestra los 1.049, no los primeros 50

`feat(buscar): la busqueda muestra los 1049 candidatos, no los primeros 50`

- `lib/search-params.ts`: `PARAM.pagina = "p"`, `pagina: number` en
  `SearchFilters`, y un `parsePagina` que trata el valor como entrada NO confiable
  igual que el resto del archivo: sólo dígitos, entero, mínimo 1 y tope duro de
  999. Cualquier otra cosa cae a 1. `buildQueryString` manda `p` sólo si es mayor
  a 1. `activeFineFilterCount` no la cuenta, con su comentario.
- `app/(portal)/buscar/page.tsx`: `POR_PAGINA = 50` (lo mismo que había),
  `select(..., { count: "exact" })` para el total real después de los filtros, y
  `.range(desde, desde + POR_PAGINA - 1)`.
- `app/(portal)/buscar/search-client.tsx`: el contador dice el total real y qué
  página se está mirando; controles de anterior/siguiente de 44 px, deshabilitados
  en los extremos, que no se dibujan si hay una sola página; y un estado propio
  para la página fuera de rango que ofrece volver a la primera.
- La trampa principal quedó cubierta: `composeAndPush` NO propaga `pagina`, así
  que cambiar cualquier filtro vuelve a la página 1. `irAPagina` es el único
  camino que la manda. Los dos tienen el comentario del por qué.

**Decisión de patrón:** paginado por parámetro de URL (`?p=N`), como pedía el
plan, y la justificación quedó escrita en el header de `lib/search-params.ts`.

### Tarea 7 (D) · `486a187` · reinscribirse decía listo y no actualizaba nada

`fix(altas): reinscribirse decia listo y no actualizaba nada`

- `app/registrar-salon/actions.ts` y `app/registrar-proveedor/actions.ts`: cada
  uno pasa a devolver un tipo propio exportado (`RegistrarSalonResult` /
  `RegistrarProveedorResult`) con `yaExistia`, que antes se leía y se tiraba. Es
  el mismo molde de "estado honesto" que ya usaba `mailOk`.
- Los dos headers explican las tres razones por las que la RPC **no** se toca, con
  la de seguridad primero: el formulario es público y sin sesión, así que dejar
  que pise datos convierte "conozco tu mail" en "reescribo tu ficha pública".
- Las dos pantallas (`registro-client.tsx` de salón y de proveedor) pasaron de
  `useState(false)` a un solo `useState<boolean | null>` (null = todavía no se
  mandó), molde de `offer-form.tsx`. El alta nueva quedó **palabra por palabra
  igual**; la reinscripción dice las tres cosas en orden: ya tenías ficha, lo que
  escribiste acá no se guardó y por qué, y te mandamos un link nuevo.
- El link de abajo cambia de destino: directorio en el alta nueva, `/mi-proveedor`
  en la reinscripción, con el comentario de por qué el token NO se puede usar ahí
  (viaja en el mail y no vuelve en la respuesta del action, y está bien que sea
  así).
- **Ninguna migración, ninguna RPC tocada.**

**Verificado y sin cambios:** el mail de "ya existía" ya decía la verdad
(`components/emails/bienvenida-proveedor.tsx:122`: *"Tu perfil sigue como lo
dejaste, no se tocó nada"*), así que no hubo que corregirlo. El asunto propio
("Tu link nuevo para entrar a LABURO") y el aviso a Franco que distingue alta
nueva de pedido de link también estaban bien y quedaron intactos.

## Lo que NO se pudo hacer: Tarea 8 (E), la migración 0070

**No existe `supabase/migrations/staff_app_0070_las_fotos_del_salon.sql`. No se
escribió. Es a propósito.**

### Por qué

El plan y el brief mandan extraer de producción, con el MCP de Supabase, cinco
piezas: el cuerpo exacto de `staff_app_salon_guardar_fotos`, las definiciones
reales de las dos políticas de storage, los cuerpos actuales de
`staff_app_vidriera_salones` y `staff_app_vidriera_salon`, y sobre todo **los
grants reales sacados de `proacl`**.

En esta sesión no hubo ningún camino para leer producción:

1. **Las herramientas del MCP de Supabase no llegaron a este agente.** Aparecen
   descriptas en las instrucciones del entorno, pero no están en el toolset
   disponible (`mcp__claude_ai_Supabase__execute_sql` responde *"No such tool
   available"*). Es el bug conocido de las MCP tools recortadas en agentes con
   `tools:` restringido.
2. **No hay CLI:** `psql` y `supabase` no están en el PATH.
3. **No hay cadena de conexión:** `.env.local` tiene URL, anon key y
   service_role key, pero ninguna `DATABASE_URL`. Con la service_role key sólo se
   llega a PostgREST, que **no expone `pg_catalog`**, así que ni
   `pg_get_functiondef` ni `pg_policies` ni `proacl` son alcanzables desde ahí.

Esto coincide con el hallazgo 7 del propio plan ("No hay MCP de Supabase ni CLI en
esta maquina"), que asumía que el ejecutor sí lo tendría.

### Por qué no se escribió una versión "a ojo"

Escribir la migración deduciendo las piezas sería peor que no escribirla, por dos
motivos que no son teóricos:

- **Los grants.** El plan los marca como *"la que se puede romper sola"*: copiar
  el patrón de la 0064 (`REVOKE ... FROM anon` + `GRANT ... TO service_role`)
  haría que las fotos dejen de guardarse el día que Franco aplique el archivo.
- **Los `CREATE OR REPLACE` de las dos vidrieras.** Un cuerpo reconstruido de
  memoria no documenta lo que corre: lo **reemplaza**. Aplicar eso pisaría en
  producción dos funciones que hoy andan, con una versión inventada.

Un archivo a medias en `supabase/migrations/` es peor todavía, porque el contrato
de esa carpeta es "se aplican en orden": quedaría una migración que Franco corre
confiado y hace medio trabajo. Por eso no hay archivo.

### Qué hace falta para destrabarla (una sola tanda de consultas)

Corriendo esto en el proyecto `luillpzfqzbpoqkgvjuw` (SQL editor del panel, o una
sesión con el MCP vivo) y pegando la salida, la migración se escribe de una:

```sql
-- 1. Los tres cuerpos, tal cual corren
SELECT p.proname, pg_get_functiondef(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('staff_app_salon_guardar_fotos',
                     'staff_app_vidriera_salones',
                     'staff_app_vidriera_salon');

-- 2. Los grants reales (LA pieza que no se puede deducir)
SELECT p.proname, p.proacl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('staff_app_salon_guardar_fotos',
                     'staff_app_vidriera_salones',
                     'staff_app_vidriera_salon');

-- 3. Las dos politicas de storage, con su qual y su with_check
SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects'
   AND policyname IN ('venue-photos public insert', 'venue-photos public read');

-- 4. El bucket
SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id = 'venue-photos';

-- 5. La columna, para reconfirmar tipo/default/orden
SELECT column_name, data_type, is_nullable, column_default, ordinal_position
  FROM information_schema.columns
 WHERE table_schema = 'staff_app' AND table_name = 'venue_details'
 ORDER BY ordinal_position;
```

### Lo único que sí se pudo verificar de la Tarea 8

Con la anon key, y sólo leyendo (lo mismo que hace la página pública `/salones`):

- **`staff_app_vidriera_salones(p_texto, p_provincia, p_personas)` es ejecutable
  por `anon`**: devuelve HTTP 200, no 404 ni permission denied. O sea que su grant
  a `anon` existe y el plan tenía razón en que copiar la 0064 lo rompería. La
  firma de los tres parámetros también quedó confirmada.
- Los cuerpos siguen sin poder leerse: eso PostgREST no lo expone.

## Hallazgo nuevo, fuera del plan

**Hoy `/salones` en producción está vacío.** `https://laburo.somosder.ar/salones`
devuelve 200 y muestra *"Todavía no hay salones publicados"*, y la RPC de vidriera
llamada sin filtros devuelve `[]`. Coincide con que el bucket `venue-photos`
tenía 0 archivos.

No es un bug causado por esta tanda (no se tocó nada de salones más allá del texto
de la pantalla de alta), pero cambia una cosa práctica: **el paso 4 de los
pendientes del plan (subir una foto a un salón de prueba después de aplicar la
0070 y ver que aparezca en `/salones/<slug>`) hoy no se puede hacer con datos
reales**, porque no hay ni un salón publicado. Hay que dar de alta uno de prueba
primero. Vale la pena que Franco mire si eso es esperado o si se despublicaron
solos.

## Deviaciones del plan

Ninguna en las tareas 6 y 7: se ejecutaron como estaban escritas, incluida la
decisión de patrón (`?p=`) y la decisión de no tocar las RPC de reinscripción.

La única deviación es la Tarea 8, que se detuvo en vez de improvisarse, por la
razón de arriba.

## Verificación

- `npm run typecheck` → limpio.
- `npm run lint` → 0 errores, 4 warnings, **los cuatro preexistentes** (cv-actions,
  app/page.tsx, sumate/registro-form, pie-whatsapp). Ninguno en archivos tocados.
- `npm run build` → *Compiled successfully*.
- Guiones largos en las líneas agregadas por esta tanda
  (`git diff 73f36e5..HEAD -U0 | grep '^+' | grep '—'`) → vacío.
- `git status` → limpio salvo el `.gitignore` modificado, los ~40 de
  `testsprite_tests/` y esta carpeta de `.planning/`, **todos sin tocar**.
- Ningún `git push` ejecutado.
- Ninguna migración aplicada. Ninguna sentencia de escritura corrida contra la
  base: lo único que se llamó fue la RPC de lectura de la vidriera, con la anon
  key, que es lo mismo que hace la web pública.

### Verificaciones a mano que quedaron pendientes

Las dos tareas se validaron con typecheck, lint y build, pero **no se probaron en
un navegador** (no se levantó `npm run dev` ni se entró con sesión). Quedan sin
confirmar empíricamente:

1. **El `?p=999` fuera de rango.** El plan pedía probarlo de verdad y no asumirlo.
   El código cubre las dos formas en que PostgREST puede contestar (error de rango
   416/PGRST103, o lista vacía), así que ninguna de las dos rompe la pantalla,
   pero cuál de las dos ocurre no está medido.
2. **El contador contra el total real** (~1.049) y que "siguiente" traiga fichas
   distintas.
3. **El caso de la página 8 + texto nuevo**, que es la trampa principal. El código
   la cubre por construcción (`composeAndPush` no manda `pagina`), pero conviene
   verla.
4. **El modo `?gig=<uuid>` conservando el gig al pasar de página.** Por código se
   conserva (`irAPagina` spreadea `initialFilters` entero), sin probar.
5. **La reinscripción de salón y de proveedor con el mismo mail**, para ver la
   pantalla nueva y confirmar en la base que la capacidad no cambió.

## Pendiente para Franco

1. **Tarea 9 (F), el link de acceso que vence siendo válido, NO se hizo.** Va sola
   y con contexto fresco, como manda el plan: es la única que puede dejar a todo
   el mundo afuera.
2. **La Tarea 8 (E) quedó trabada**, con las consultas listas arriba. No hay
   archivo 0070.
3. **Dos migraciones para aplicar, no tres: la 0068 y la 0069.** La 0070 todavía
   no existe.
4. **`/salones` está vacío en producción.** Ver el hallazgo de arriba.
5. **Los commits siguen sin pushear.** Esta tanda sumó **dos** (`d6f36c4` y
   `486a187`). Con los cinco de la tanda 1 más el del favicon, son ocho arriba de
   `3373ae9`.
6. **Los ~40 archivos de `testsprite_tests/` y el `.gitignore` modificado quedaron
   exactamente como estaban**, sin commitear, sin borrar y sin tocar.

## Self-Check: PASSED

- `lib/search-params.ts`, `app/(portal)/buscar/page.tsx`,
  `app/(portal)/buscar/search-client.tsx`, `app/registrar-salon/actions.ts`,
  `app/registrar-salon/registro-client.tsx`,
  `app/registrar-proveedor/actions.ts`,
  `app/registrar-proveedor/registro-client.tsx` → los siete existen y están
  commiteados.
- `d6f36c4` y `486a187` → los dos existen en `git log`.
- `supabase/migrations/staff_app_0070_las_fotos_del_salon.sql` → **NO existe, y es
  el resultado esperado** (ver arriba).
