---
phase: quick-260731-pe7
plan: 01
subsystem: marketplace
tags: [marketplace, proveedores, magic-link, security-definer, mobile-first]
requires:
  - staff_app_0041_marketplace_identidad_propia (movimiento 1, ya aplicada)
  - staff_app_0035_org_base (resolve_org / is_org_writer)
provides:
  - "Token de acceso del proveedor (hasheado, con vencimiento) en marketplace_profiles"
  - "6 RPCs SECURITY DEFINER: generar_link + perfil + guardar_perfil + guardar_servicio + borrar_servicio + publicar"
  - "Ruta publica /acceso-proveedor/[token], mobile-first"
affects:
  - lib/supabase/middleware.ts (una entrada nueva en publicPrefixes)
tech-stack:
  added: []
  patterns:
    - "Token en columnas de la fila (patron staff_app.offers), no en tabla aparte"
    - "Guard del token en UNA sola funcion helper, compartida por las 5 RPCs"
    - "Server Actions POST-only con el cliente anon, cero service-role"
key-files:
  created:
    - supabase/migrations/staff_app_0042_puerta_proveedor.sql
    - supabase/tests/staff_app_0042_puerta_proveedor_harness.sql
    - lib/categorias-proveedor.ts
    - app/acceso-proveedor/[token]/page.tsx
    - app/acceso-proveedor/[token]/actions.ts
    - app/acceso-proveedor/[token]/estados.ts
    - app/acceso-proveedor/[token]/perfil-form.tsx
    - app/acceso-proveedor/[token]/servicios.tsx
    - app/acceso-proveedor/[token]/publicar.tsx
    - app/acceso-proveedor/[token]/wa-cta.tsx
  modified:
    - lib/supabase/middleware.ts
decisions:
  - "Las politicas de escritura de RLS se quedan cerradas a proposito: el proveedor entra como anon, sin auth.uid(), asi que una politica user_id = auth.uid() nunca lo alcanzaria. Corrige la nota de la 0041."
  - "El guard del token vive en una sola funcion (staff_app.perfil_proveedor_por_token) en vez de repetirse en las cinco RPCs."
  - "La pantalla sin acceso es UNA sola: la RPC no distingue token vencido de inventado, y la UI tampoco puede sin filtrar informacion."
  - "La migracion NO se aplico. Queda escrita en el repo y la aplica Franco."
metrics:
  duration: ~50 min
  tasks: 3 de 3 (mas 1 checkpoint humano pendiente)
  files: 11
  completed: 2026-07-31
---

# Quick 260731-pe7: Movimiento 2 del marketplace, la puerta de entrada del proveedor

Un proveedor que hasta hoy no podia entrar a nada ahora abre un link desde el telefono, sin cuenta y sin contrasena, completa su perfil, carga los servicios que presta y en que provincias trabaja, y se publica solo. No puede tocar su verificacion, su slug ni su calificacion, ni ver ni tocar el perfil de otro.

## Que se construyo

### 1. La migracion 0042 (commit `b8419e9`)

`supabase/migrations/staff_app_0042_puerta_proveedor.sql`, 100% aditiva.

**Tres columnas** en `staff_app.marketplace_profiles`, con `ADD COLUMN IF NOT EXISTS`:
`access_token_hash`, `access_token_expires_at`, `access_token_last_used_at`, mas un indice unico parcial sobre el hash. Solo persiste el sha256; el token en crudo sale una vez y no se guarda ni se loguea.

**Un helper** (no es RPC, no es alcanzable desde afuera): `staff_app.perfil_proveedor_por_token(text)`. Resuelve hash + vencimiento + `tipo = 'proveedor'` + `activo` y devuelve el id del perfil o NULL. Revocado de PUBLIC, anon y authenticated.

**Seis RPCs** en `public`, todas SECURITY DEFINER con `SET search_path = staff_app, public, pg_temp`:

| Funcion | Quien | Que hace |
|---|---|---|
| `staff_app_generar_link_proveedor(uuid, int)` | `authenticated` (nunca anon) | Genera el link y devuelve el token en crudo una sola vez |
| `staff_app_proveedor_perfil(text)` | `anon` + `authenticated` | Lee el perfil propio y sus servicios. Estampa `last_used_at` |
| `staff_app_proveedor_guardar_perfil(text, text x8)` | `anon` + `authenticated` | Guarda los ocho campos editables |
| `staff_app_proveedor_guardar_servicio(text, text, text, uuid, ...)` | `anon` + `authenticated` | Alta y edicion de un servicio |
| `staff_app_proveedor_borrar_servicio(text, uuid)` | `anon` + `authenticated` | Baja de un servicio |
| `staff_app_proveedor_publicar(text, boolean)` | `anon` + `authenticated` | Publicarse y despublicarse |

Cierra con `NOTIFY pgrst, 'reload schema'`.

**Los tres candados que importan**, y estan escritos en el archivo con el motivo:

1. `is_verified`, `slug`, `rating_avg`, `review_count`, `user_id`, `tipo`, `email` y `activo` NO aparecen en el SET de ninguna RPC por token.
2. Todo UPDATE y DELETE de servicios filtra por el `profile_id` resuelto DEL TOKEN, nunca por un id que mande el cliente.
3. `generar_link` resuelve la org DEL PERFIL leyendo `profile_org_links` y recien despues gatea con `is_org_writer` sobre esa org (la leccion de la 0040). Si el perfil no tiene vinculo, usa `resolve_org(NULL)`, gatea y crea el vinculo `pool` en la misma transaccion.

Cada funcion lleva su `REVOKE ALL ... FROM PUBLIC, anon` con la firma completa antes del GRANT (WR-05), y su `COMMENT ON FUNCTION`.

### 2. La ruta publica y el perfil (commit `749b8dc`)

- `lib/supabase/middleware.ts`: `"/acceso-proveedor"` entra en `publicPrefixes`, con el prefijo ENTERO. La lista se evalua con `startsWith`, asi que `"/p"`, `"/pr"` o `"/prov"` habrian abierto `/pagos` y `/panel-staff` al mundo sin sesion.
- `lib/categorias-proveedor.ts`: catalogo sugerido de 14 categorias mas las unidades de precio. Sugerido y no enum, porque la columna `categoria` es text libre a proposito.
- `app/acceso-proveedor/[token]/page.tsx`: server component `force-dynamic`, cliente anon, una sola llamada RPC. Sin datos renderiza la pantalla sin acceso y nada mas (cero segunda consulta, cero PII).
- `estados.ts`: tipos del jsonb + copy. Una sola pantalla terminal, a proposito.
- `actions.ts`: Server Actions POST-only, cliente anon, `reason` traducidos.
- `perfil-form.tsx`: mobile-first, targets de 48px, inputs de 16px (menos hace que iOS haga zoom solo), email deshabilitado con la aclaracion, provincia con las 24 jurisdicciones, `motion` en la confirmacion.

### 3. Los servicios y el publicarse (commit `b5cc8bd`)

- `servicios.tsx`: lista, alta, edicion y baja. Bottom sheet con Base UI Dialog mas `motion` (el patron de `filtros-sheet.tsx`), categoria del catalogo o escrita a mano, precio orientativo opcional con unidad, provincias como chips. Borrar confirma en dos pasos en la misma fila.
- `publicar.tsx`: el interruptor. Cuando la RPC devuelve `faltan_datos`, los codigos se traducen a castellano accionable ("Agrega al menos un servicio de los que prestas"). No existe ningun control de verificacion.
- `page.tsx` monta los tres bloques en el orden de uso: mis datos, mis servicios, publicarme.

## Como saca la productora el link de un proveedor

En este movimiento todavia no hay pantalla para esto (necesitaria un directorio, que es el movimiento 4). Se saca por SQL, con la sesion de Franco o como owner:

```sql
select public.staff_app_generar_link_proveedor(
  '<id de un staff_app.marketplace_profiles con tipo = proveedor>',
  30   -- dias de validez
);
```

Devuelve `{"ok": true, "profile_id": "...", "token": "<64 hex>", "expires_at": "..."}`. **El token sale una sola vez y no queda guardado en ningun lado.** Si se pierde, se genera otro (y el anterior muere solo, porque regenerar pisa el hash).

La URL que se le manda al proveedor:

```
https://laburo.somosder.ar/acceso-proveedor/<token>
```

**La pantalla de la productora para listar proveedores y copiar el link queda para el movimiento 4**, que es cuando existe el directorio sobre el que apoyarla.

## ⚠️ La migracion NO esta aplicada

Por instruccion explicita de esta corrida, la 0042 se escribio en el repo pero **no se aplico contra la base de produccion**. Aplicarla es decision de Franco.

Comando exacto (MCP de Supabase, proyecto `luillpzfqzbpoqkgvjuw`):

```
mcp__supabase__apply_migration(
  project_id = "luillpzfqzbpoqkgvjuw",
  name       = "staff_app_0042_puerta_proveedor",
  query      = <el contenido de supabase/migrations/staff_app_0042_puerta_proveedor.sql>
)
```

Hasta que se aplique, `/acceso-proveedor/<lo que sea>` va a mostrar la pantalla sin acceso, porque la RPC todavia no existe. El resto de la app no cambia en nada.

**Justo despues de aplicarla, correr el harness** (`supabase/tests/staff_app_0042_puerta_proveedor_harness.sql`) con `mcp__supabase__execute_sql`, y despues `mcp__supabase__get_advisors(type='security')` para confirmar que no suma findings nuevos (esperado: cero `function_search_path_mutable`).

## Verificacion que SI se corrio

| Gate | Resultado |
|---|---|
| Gate automatico de la tarea 1 (12 condiciones sobre el SQL) | `GATES OK` |
| Gate automatico de la tarea 2 (7 condiciones) | `GATES OK` |
| Gate automatico de la tarea 3 (7 condiciones) | `GATES OK` |
| `npm run typecheck` | pasa limpio, cero errores |
| `npm run lint` | 0 errores, 3 warnings preexistentes en archivos que no toque |
| `npm run build` | `✓ Compiled successfully`, `✓ Generating static pages (45/45)`, ruta `ƒ /acceso-proveedor/[token]` dinamica como corresponde |
| Cero guion largo en la migracion, en el harness y en todo `app/acceso-proveedor/` | verificado por grep |
| Cero `DROP TABLE` / `DROP COLUMN` / funcion previa reescrita | verificado por grep |

Contadores del SQL: 7 `SET search_path`, 7 `REVOKE ALL ON FUNCTION`, 7 `COMMENT ON FUNCTION`, 6 `GRANT EXECUTE` (el helper no tiene grant a nadie, a proposito).

## Verificacion que NO se pudo correr

| Gate del plan | Por que no |
|---|---|
| Harness SQL de 8 casos | Requiere la migracion aplicada. Queda escrito y listo en `supabase/tests/` |
| `get_advisors(type='security')` | Idem, y ademas las herramientas MCP de Supabase no estaban disponibles en esta corrida |
| Chequeo de sintaxis del SQL contra un Postgres real | No hay `psql` ni Docker en la maquina. Los nombres de columna se verificaron leyendo la 0041 uno por uno |
| Prueba a mano en el telefono | Es el checkpoint humano, ver abajo |

## Desviaciones del plan

**1. [Regla 2, funcionalidad critica faltante] El guard del token se extrajo a una funcion**
- Encontrado en: tarea 1.
- Situacion: el plan pedia seis funciones, cada una con su propio guard de token (hash + vencimiento + tipo + activo), escrito cinco veces.
- Que se hizo: se agrego `staff_app.perfil_proveedor_por_token(text)`, STABLE, revocada de PUBLIC, anon y authenticated, y las cinco RPCs por token la llaman.
- Por que: cinco copias del mismo guard es pedir que una quede distinta el dia que alguien toque una sola. El plan mismo marca este guard como "el agujero mas probable de todo el movimiento".
- Impacto en los gates: ninguno, los conteos siguen dando `>= 6`. Se le agrego su propio REVOKE y su COMMENT.

**2. [Regla 2] Un `reason` mas en `generar_link_proveedor`**
- El plan listaba `perfil_no_encontrado`, `no_es_proveedor`, `forbidden` y `sin_organizacion`, y pedia validar tambien `activo`. Se agrego `perfil_inactivo` en vez de mezclar un perfil dado de baja con "no es proveedor", que habria sido un mensaje enganoso.

**3. [Regla 2] Normalizacion del array de provincias**
- `guardar_servicio` limpia los vacios, recorta cada entrada a 120 caracteres, saca repetidas y corta en 40 elementos (`demasiadas_provincias`). El array llega del cliente por PostgREST, asi que sin esto se podia mandar uno gigante. El plan no lo pedia.

**4. [Regla 3] `wa-cta.tsx` local en vez de importar el de las ofertas**
- El plan decia reutilizar `app/o/[token]/wa-cta.tsx` "si aplica sin cambios". Aplicaba, pero importarlo habria significado un import cruzado entre dos rutas privadas (`@/app/o/[token]/wa-cta`), o sea acoplar la puerta del proveedor a la ruta de las ofertas del staff. Se copio, que es la alternativa que el propio plan autoriza. Ademas no es el mismo componente: aca no va `PortalStaffLink` (el proveedor todavia no tiene portal). Se reutilizan si las dos piezas compartidas de verdad: `WhatsAppGlyph` y `waLink`.

**5. [adaptacion a la restriccion de no aplicar] El harness se entrega como archivo**
- El plan pedia correr el harness de 8 casos contra la base. Como no se puede aplicar la migracion, el harness se escribio siguiendo la convencion del repo (`supabase/tests/`, mismo estilo que el de la 0003 y el de la 0008), con los 8 casos mas tres extra: que `guardar_perfil` no mueva `is_verified`/`slug`/`email`/`tipo`/`activo`/`rating`, que con un servicio con provincias si publique, y que regenerar el link mate el anterior. Limpia todo lo que siembra.

**6. Un archivo mas del que el plan listaba**
- `app/acceso-proveedor/[token]/wa-cta.tsx`, por el punto 4.

## Registro de amenazas: como quedo cada una

| ID | Disposicion | Donde quedo mitigada |
|---|---|---|
| T-pe7-01 | mitigada | `extensions.gen_random_bytes(32)`, 256 bits, identico a 0003/0008 |
| T-pe7-02 | mitigada | Solo persiste el sha256; el crudo se devuelve una vez y no se loguea |
| T-pe7-03 | mitigada | `is_verified` fuera del SET de toda RPC por token, con comentario. No hay control en ninguna pantalla |
| T-pe7-04 | mitigada | UPDATE y DELETE filtran por el `profile_id` del token. Caso 7 del harness |
| T-pe7-05 | mitigada | Org del perfil primero, `is_org_writer` despues. `authenticated` sola |
| T-pe7-06 | mitigada | Token inexistente y vencido devuelven los dos SQL NULL. Una sola pantalla terminal en la UI |
| T-pe7-07 | mitigada | Las 7 funciones con `search_path` pineado y `extensions.*` calificado. **Falta confirmarlo con el advisor** |
| T-pe7-08 | mitigada | REVOKE explicito por funcion con la firma completa, antes del GRANT |
| T-pe7-09 | mitigada | Prefijo `/acceso-proveedor` entero, verificado por gate |
| T-pe7-10 | aceptada | `access_token_last_used_at`, sin historial |
| T-pe7-11 | mitigada | La RPC de lectura no toca `profile_org_links` |
| T-pe7-SC | mitigada | Cero dependencias nuevas. `package.json` sin cambios |

## Pendiente: el checkpoint humano

El plan es `autonomous: false` y su ultima tarea es un `checkpoint:human-verify` bloqueante. Todo el codigo esta escrito, verificado y commiteado, pero la prueba de punta a punta no se puede hacer sin la migracion aplicada. Los pasos estan en el plan y repetidos abajo, en el mensaje de handoff.

## Self-Check: PASSED

Los 10 archivos existen en disco y los 3 commits existen en el repo (`b8419e9`, `749b8dc`, `b5cc8bd`).
