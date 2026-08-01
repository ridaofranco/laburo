---
phase: quick/260731-s6w
plan: 01
subsystem: portal + marca
tags: [marca, tipografia, multi-tenant, copy, rls]
status: parcial
requires:
  - "public/brand/laburo-wordmark.png (ya existia)"
  - "migracion 0035 (is_default como dato, no UUID)"
provides:
  - "components/laburo-wordmark.tsx: el wordmark oficial como imagen, punto unico"
  - "escala tipografica del producto (t-display, t-stat, t-stat-sm, t-section)"
  - "staff_app.organizations.es_plataforma + gate exigirPlataforma()"
  - "/rentabilidad y /pagos reencuadrados hacia la productora"
affects:
  - "las 16 pantallas que dibujaban el wordmark con Syne"
  - "26 pantallas del producto que tenian tamanos absolutos"
  - "/leads pasa a ser pantalla de plataforma"
tech-stack:
  added: []
  patterns:
    - "next/image para el wordmark, tamano por className h-[Npx] w-auto"
    - "@utility de Tailwind v4 con clamp() para la escala fluida"
    - "marcador booleano en la tabla + indice unico parcial, en vez de UUID en el codigo"
key-files:
  created:
    - components/laburo-wordmark.tsx
    - supabase/migrations/staff_app_0044_org_plataforma.sql
    - supabase/tests/staff_app_0044_org_plataforma_harness.sql
  modified:
    - app/globals.css
    - lib/org.ts
    - app/(portal)/portal-nav.tsx
    - app/(portal)/layout.tsx
    - app/(portal)/leads/page.tsx
    - app/(portal)/leads/lead-actions.ts
    - app/(portal)/dashboard/page.tsx
    - app/(portal)/rentabilidad/page.tsx
    - app/(portal)/pagos/page.tsx
    - "(y 26 pantallas mas, ver los commits)"
decisions:
  - "El wordmark sale de UN solo componente: el que quiera cambiar el tamano toca className, no el lockup"
  - "Escala con clamp() y no media queries: mobile-first sin escalones, y el proyecto ya trabajaba asi"
  - "es_plataforma como dato en la tabla, con backfill POR is_default: el UUID de SOMOS DER no vuelve al codigo"
  - "404 y no cartel de permiso en /leads: la pantalla no forma parte del producto de la productora"
  - "En /rentabilidad el numero heroe pasa a ser el margen, no la tasa de aceptacion"
metrics:
  duration: "~2h"
  completed: 2026-07-31
---

# Quick 260731-s6w: logo oficial, escala de titulos y separar plataforma de productora

El wordmark oficial reemplaza las 16 copias dibujadas con Syne, los titulos del producto salen de una escala fluida en vez de 35 tamanos absolutos, y la org duena del producto se separa de la productora cliente.

## Estado: 3 de 4 tareas cerradas, la tarea 3 con su gate SQL PENDIENTE

Las cuatro tareas estan implementadas y commiteadas. **La tarea 3 NO esta terminada** segun su propio `<done>`: la migracion 0044 no se aplico y su harness no se corrio contra la base. El detalle esta abajo, en "Lo que falta".

## Commits

| # | Hash | Que |
|---|------|-----|
| 1 | `69f0bde` | El wordmark oficial reemplaza las 16 copias escritas a mano |
| 2 | `3b44072` | Escala tipografica real y se tira el parche de `!important` |
| 3 | `546f24a` | La org duena de la plataforma se separa de la productora cliente |
| 4 | `f9e573f` | Rentabilidad, pagos y el dashboard hablan como la productora |

## Tarea 1: el wordmark

`components/laburo-wordmark.tsx` envuelve `next/image` sobre `public/brand/laburo-wordmark.png` (716x128 RGBA, transparente). El tamano lo pone el consumidor con `h-[Npx] w-auto`, que es lo que resuelve solo los casos responsive como `h-[18px] md:h-[26px]`.

Los 16 renderizados migrados: landing (header con `priority` y footer), los tres logins (conservando el `motion.h1` con `{...up(0)}` y sus margenes), los tres Shell publicos (`/o/[token]`, `/acceso-proveedor`, `/baja`), el blog (header y footer), el estado vacio de `/buscar`, el sidebar del portal, el chrome de staff (sidenav y topnav movil), `/onboarding-staff` y `/sumate`.

Los dos sitios que NO se tocaron, y esta escrito en el comentario del componente: el eyebrow en `label-tech` de `app/blog/chrome.tsx` (es etiqueta de seccion, no lockup) y la marca en prosa de `welcome-legacy-email.tsx`.

`font-lockup` se quedo sin un solo consumidor y se borro de `globals.css`.

**Gates:** G1=0, G2a=0, G2b=0, G3=2, G4=1. Typecheck, lint y build en verde.

**Nota sobre el baseline:** el plan esperaba G1=13 y dio 11. La diferencia es real y benigna: 11 nodos usaban `font-lockup` y los otros 5 wordmarks se dibujaban con `SYNE` a mano (portal-nav, staff-nav x2, onboarding-staff, sumate). Los 16 renderizados que declaraba el plan estaban todos, contados por G2a (15) + G2b (1).

## Tarea 2: la escala

Cuatro `@utility` en `app/globals.css`, cada una con familia, peso, `line-height` y `letter-spacing`, para que el consumidor deje de repetir cuatro clases por nodo:

| Utility | Rol | Tamano |
|---------|-----|--------|
| `t-display` | Titulo de pantalla | `clamp(34px, 6vw, 56px)` |
| `t-stat` | Numero heroe de un bento | `clamp(44px, 9vw, 80px)` |
| `t-stat-sm` | Numero secundario | `clamp(28px, 5vw, 44px)` |
| `t-section` | Cabecera de card o seccion | `clamp(20px, 3vw, 28px)` |

Se migraron 26 pantallas: se fueron los 35 tamanos absolutos de 40px para arriba (siete de 120px) y los 11 `clamp` sueltos. Y se borro entero el bloque `@media (max-width: 767px)` con `!important` del 28/7.

**Decision sobre los `text-[32px]` que sobreviven:** el bloque borrado tambien pisaba 32px. Los que quedan viven en pantallas publicas de un solo titulo (`/baja`, `/o/[token]`, `/acceso-proveedor`, y el `md:` de la landing, que en movil ya es 26px). 32px en un telefono es un titulo razonable, no uno de los monstruos de 120px que motivaron el parche, asi que se borro el bloque completo y G4 dio 0 en vez de 1.

Efecto colateral limpiado: al sacar los wordmarks y los titulos, cinco archivos quedaron con la constante `SYNE` sin uso y se borro la declaracion.

**Gates:** G1=4, G2=0, G3=0, G4=0, G5=71. Typecheck, lint y build en verde.

## Tarea 3: plataforma vs productora

**Migracion `staff_app_0044_org_plataforma.sql`** (escrita, NO aplicada):
- `es_plataforma boolean NOT NULL DEFAULT false` en `staff_app.organizations`.
- Indice unico parcial `organizations_one_plataforma`, mismo patron que `organizations_one_default`: la base garantiza que haya UNA sola.
- Backfill `WHERE is_default`, sin escribir el UUID. Ese es el punto: la 0035 ya convirtio el UUID en dato y esto no lo revierte.
- La vista `public.staff_app_my_orgs` expone la columna, agregada AL FINAL (lo unico que deja un `CREATE OR REPLACE VIEW`).
- Ninguna RPC ni policy de UPDATE, a proposito. Sobre `organizations` hay solo `organizations_select` y a `authenticated` solo se le dio SELECT: eso deja la columna fuera del alcance de escritura del cliente (mitigacion de T-s6w-03).

**Harness `staff_app_0044_org_plataforma_harness.sql`** (escrito, NO corrido), con los cinco asserts: una sola plataforma y coincide con `is_default`; la segunda la rechaza el indice (`unique_violation`); la vista expone la columna y devuelve `false` para la productora de prueba; devuelve `true` para la plataforma; y `has_table_privilege('authenticated', ..., 'UPDATE')` es false. Modelado sobre el harness de la 0042: mismo simulacro de identidad por `request.jwt.claims` a nivel sesion, misma nota de MVCC, mismo paso 0 de limpieza para re-correrlo, misma limpieza final.

**App:** `OrgActual.esPlataforma` + `exigirPlataforma()` en `lib/org.ts`; el gate real en `lead-actions.ts`; `notFound()` en `leads/page.tsx`; el layout le pasa `esPlataforma` y `orgNombre` al nav; el nav filtra los items de plataforma (y el `MOBILE` que se calculaba a nivel de modulo paso adentro del componente, para que el bottom-nav no quede desalineado con el sidebar); y la bajada de la barra lateral dice el nombre de la productora.

**Gates estaticos:** G1=0, G2=4, G3=2, G4=1, G5=0, G6=0. Typecheck, lint y build en verde.
**Gate SQL: NO CORRIDO.** Ver abajo.

Verificado y sin nada que hacer, como decia el plan: `/billetera` y `/mensajes` no estan en el array `MAIN`, o sea que no aparecen en la navegacion. Siguen siendo placeholders honestos y se quedan como estan.

## Tarea 4: las tres pantallas hablan como la productora

- **`/dashboard`:** el eyebrow y el titulo pasan a "Tu operacion" y "Tus eventos". Tambien se cambio "para el despliegue inicial" (jerga del mockup) por "para tu proximo evento". Los datos no se tocaron.
- **`/rentabilidad`:** el bloque grande ya no es la tasa de aceptacion sino el MARGEN, con "Lo que cobras al cliente" y "Lo que te cuesta el staff" al lado como cifras de apoyo. La tasa de aceptacion y las ofertas por mes bajaron a una fila de metricas secundarias. Titulo "Tu rentabilidad" con una bajada que dice en una linea que esto contesta cuanto gana. El estado vacio honesto se conserva y ahora ademas informa lo comprometido con el staff. **Ni una query ni un calculo cambiaron.**
- **`/pagos`:** el comentario de cabecera estaba escrito desde DER ("lo que Franco tiene comprometido") y se reescribio en la voz del producto. La pantalla ahora separa "Lo que cobras" (MercadoPago, lo que entra) de "Lo que le debes al staff" (lo que sale), cada una con su bajada. La logica, las queries y el `PagoListoBoton` no se tocaron.

**Gates:** G1=0, G2=0, G3=0, G4=0, G5=0. Typecheck, lint y build en verde.

## Lo que falta, y es bloqueante para la tarea 3

**La migracion 0044 no se aplico y el harness no se corrio.** Las herramientas MCP de Supabase (`apply_migration`, `execute_sql`) no estaban expuestas en el entorno de ejecucion, y tampoco hay CLI de Supabase, ni `psql`, ni un personal access token en el inventario de claves. Solo hay service-role keys, que sobre PostgREST no ejecutan DDL.

No se invento un camino alternativo a proposito: la leccion de la 0043 es justamente que typecheck, lint y build no ejecutan SQL, y dar por bueno un harness que no corrio seria el mismo error.

**Consecuencia si se deploya asi (y es importante):** sin la 0044, el select de `es_plataforma` falla, `lib/org.ts` cae al fallback y devuelve `esPlataforma: false` para todos. El portal sigue cargando (fail closed, T-s6w-05 aceptado), pero **Franco tambien pierde el item Leads y recibe 404 en `/leads`**, y la barra lateral dice "Panel de productora" en vez de "SOMOS DER". Se arregla solo, sin deploy, en cuanto la migracion aterrice.

**Lo que hay que correr, en este orden, contra el proyecto `luillpzfqzbpoqkgvjuw`:**
1. `apply_migration` con `supabase/migrations/staff_app_0044_org_plataforma.sql`.
2. `execute_sql` con `supabase/tests/staff_app_0044_org_plataforma_harness.sql`, y verificar los cinco asserts.
3. `get_advisors(type='security')` y comparar contra el baseline de hoy: `function_search_path_mutable`=12, `rls_enabled_no_policy`=15, `extension_in_public`=3. Ninguno tiene que subir. La 0044 no crea funciones ni tablas, asi que lo esperable es que los tres queden iguales.

## Pendientes declarados (no son huecos)

1. **`app/page.tsx` y `app/blog/**` quedaron fuera de la escala tipografica.** Son superficies de marketing, ya usan `clamp` responsable y no son de lo que se quejo Franco. La frontera esta anotada en el comentario de la escala en `globals.css`. Cuando se unifiquen, entran.
2. **`/billetera` y `/mensajes` siguen siendo placeholders honestos.** Se verifico que NO estan en el menu, asi que no hubo nada que sacar.
3. **El cobro de plataforma (LABURO le cobra a la productora) sigue sin construirse**, por decision de Franco, hasta que defina el precio. La columna `es_plataforma` deja el lugar listo y no se dejo ni un pixel de UI preparada.

## Desviaciones del plan

### 1. [Regla 3 - Bloqueante] `next build` pisaba el server de desarrollo de Franco
- **Cuando:** tarea 1, al ir a verificar.
- **Problema:** `next dev` y `next build` escriben los dos en `.next/`, y Franco tenia el dev server vivo en el puerto 3000 probando la app. Verificar con un build lo habria roto, y la consigna era no matarlo.
- **Arreglo:** `distDir: process.env.NEXT_DIST_DIR || ".next"` en `next.config.ts`. Sin la variable no cambia nada (Vercel y local siguen usando `.next`); los builds de verificacion corrieron con `NEXT_DIST_DIR=.next-verify`. Se sumo la carpeta al `.gitignore`.
- **Archivos:** `next.config.ts`, `.gitignore`. **Commit:** `69f0bde`.
- El dev server quedo vivo. La carpeta `.next-verify` (371 MB) se borro al terminar, porque el disco de esta Mac esta casi lleno.

### 2. [Regla 1 - Bug] eslint lintaba la carpeta del build de verificacion
- **Cuando:** tarea 2. `npm run lint` paso de 3 warnings a 15938 problemas y 2213 errores.
- **Causa:** `eslint.config.mjs` ignora `.next/**` pero no conocia `.next-verify/**`, asi que lintaba el bundle compilado.
- **Arreglo:** sumar `.next-verify/**` a los ignores. Volvio a los 3 warnings preexistentes y 0 errores.
- **Archivo:** `eslint.config.mjs`. **Commit:** `3b44072`.

### 3. [Regla 3 - Higiene] `next build` reescribe `tsconfig.json`
- Cada build agrega `.next-verify/types/**` al `include` y reformatea el archivo entero. Se revirtio con `git checkout -- tsconfig.json` antes de cada commit, para no ensuciar el diff.

### 4. [Ajuste de alcance] Dos frases de copy de mas
- El plan acotaba el dashboard al eyebrow y al titulo. Se cambio ademas "para el despliegue inicial" por "para tu proximo evento", y en rentabilidad el pie "LABURO // Analisis de operaciones" por "LABURO // Tu rentabilidad". Son las dos frases que mas sonaban a mockup traducido en pantallas que la tarea ya estaba reencuadrando. Cero riesgo: es copy, no logica.

### 5. [Ajuste de gate] Tres greps daban 1 por mis propios comentarios
- G5 de la tarea 3 (`Production Portal`) y G1/G2 de la tarea 4 (`franco`, `Resumen de Operaciones`) daban 1 porque yo habia citado el texto viejo dentro de un comentario que explicaba el cambio. Se reescribieron esos comentarios para describir lo que habia sin citarlo literal. Los gates dan 0 y la explicacion historica sigue estando.

## Notas de seguridad

- El UUID de SOMOS DER no volvio a `app/`, `lib/`, `components/` ni a la migracion. Verificado con grep.
- El gate de `/leads` esta en el servidor por partida doble: `exigirPlataforma()` en la server action (T-s6w-01) y `notFound()` en la pagina (T-s6w-02). Esconder el item del menu no cuenta como mitigacion y esta escrito asi en los comentarios.
- La columna `es_plataforma` no se puede escribir desde el cliente. El harness lo verifica con `has_table_privilege` en vez de asumirlo, pero **ese harness todavia no corrio**.
- Cero dependencias nuevas. `next/image` y `motion` ya estaban.
- El cobro al cliente final por MercadoPago quedo intacto: `git diff` sobre `tablero/payment-actions.ts` y `api/mp/webhook/route.ts` da 0 archivos.

## Self-Check: PASSED

Los tres archivos creados existen en disco y los cuatro commits existen en `git log`.
