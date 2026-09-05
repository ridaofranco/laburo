# Actores y flujos de LABURO

El mapa de quién usa LABURO, por dónde entra cada uno y qué puede hacer.

> ⚠️ **Hoy hay CERO productoras cliente.** LABURO es un producto multi-tenant
> con **un solo inquilino**: la organización que lo construyó. Hay 1.050 fichas
> de staff entrando solas, y cero eventos, cero ofertas, cero proveedores y cero
> salones. Todo lo que sigue describe capacidades que **existen y funcionan**,
> pero que casi nadie recorrió todavía. Leerlo sabiendo eso cambia cómo se lee
> todo lo demás.

Este documento sale del código, no de la intención. Cada ruta que se nombra acá
existe, y cada afirmación sobre permisos apunta a la migración que la
implementa.

---

## Los cinco actores

El PRD original describía dos. Son cinco, y hay **cuatro pools distintos**
(staff, proveedores, salones y productoras), no uno.

### 1. Plataforma

**Quién es:** la organización dueña del producto. Es una fila de
`staff_app.organizations` con `es_plataforma = true` — una columna, no un rol
(migración `0044`, activada por la `0054`). Solo puede haber una: lo garantiza
un índice único parcial en la base, no el código.

| | |
|---|---|
| **Cuenta** | Sí, con contraseña |
| **Entra por** | `/entrar` o `/login` |
| **Ve** | Todo el portal, más `/plataforma`, `/leads` y `/rentabilidad` |
| **Gate real** | `is_platform_admin()` **adentro de las RPC** de la `0054` |

Esconder los ítems del menú es cosmético y está comentado como tal en el código:
si alguien escribe la URL a mano, quien decide es la base.

En `/plataforma` ve la línea de tiempo de todo lo que pasó, las consultas entre
productoras y proveedores, las ofertas, las organizaciones, la moderación de
proveedores y salones, y la rentabilidad cruzada.

### 2. Productora

**Quién es:** la organización cliente. Una fila de `organizations` con sus
miembros en `staff_app.members`.

| | |
|---|---|
| **Cuenta** | Sí, con contraseña |
| **Se anota en** | `/registrar-productora` — **alta abierta: nadie aprueba nada** |
| **Entra por** | `/entrar` o `/login` |
| **Ve** | `/dashboard`, `/buscar`, `/proveedores`, `/tablero`, `/favoritos`, `/calendario`, `/pagos`, `/notificaciones`, `/config` |

El alta abierta es una decisión de producto tomada el 2/8: se anota, entra y
opera; el control es después, desde `/plataforma`. La puerta no dice
"productora": está abierta a agencias, marcas, empresas y particulares, porque
el que necesita staff no siempre se llama productora.

**Roles adentro de una organización:** `owner`, `writer` y `viewer`. Son los
tres que existen, y están fijados por un CHECK en la base
(`staff_app_0006_hardening.sql`). El rol es **por organización**: la misma
persona puede ser `owner` en una y `writer` en otra.

### 3. Staff

**Quién es:** la persona que trabaja en los eventos. **Hay dos formas de
existir**, y son distintas:

| | Sin cuenta | Con cuenta |
|---|---|---|
| **Entra por** | `/o/[token]` — token opaco, sin auth | `/acceso-staff`, con su mail |
| **Ve** | Solo esa oferta, mientras el token viva | `/panel-staff`, `/trabajos`, `/fichaje`, `/editar-perfil-staff` |
| **Gate** | RPC `SECURITY DEFINER` por token | `requireStaff()`, por **email verificado** |

Se anota en `/sumate`.

⚠️ **Aceptar una oferta NO crea una cuenta.** La regla completa de cuándo se
pasa de una forma a la otra —incluida la trampa del mail que no coincide, que es
la que va a generar el primer reclamo— está escrita en
**[`PRUEBAS.md`, sección 6](./PRUEBAS.md)**. No se repite acá para que no haya
dos versiones que se separen.

### 4. Proveedor

**Quién es:** quien vende servicios para eventos (sonido, catering, seguridad,
lo que sea).

| | |
|---|---|
| **Cuenta** | **Nunca tiene contraseña** |
| **Se anota en** | `/registrar-proveedor` (migración `0060`) — alta abierta |
| **Entra por** | Link mágico: `/acceso-proveedor/[token]` → `/mi-proveedor` |
| **Vidriera pública** | `/servicios` |

Que no tenga contraseña es deliberado: el proveedor entra pocas veces y una
contraseña más es una barrera que no paga lo que cuesta.

### 5. Salón

**Quién es:** el espacio donde pasa el evento. Es el cuarto pool (migraciones
`0064`, `0066`, `0067`).

| | |
|---|---|
| **Se anota en** | `/registrar-salon` |
| **Entra por** | La **misma puerta que el proveedor** (`0066`) |
| **Vidriera pública** | `/salones` |

---

## Los flujos

### Contratar staff para un evento

1. La productora crea el evento en `/tablero` → `staff_app_create_gig`.
2. Busca gente en `/buscar`, filtrando por oficio, zona y disponibilidad.
3. Abre una ficha y manda una oferta → `staff_app_create_offer`. **Tiene que
   llevar monto y fecha**: lo exige la función desde la `0068`.
4. La persona recibe un mail con un link `/o/[token]`.
5. Acepta o rechaza **sin crear ninguna cuenta**. Al aceptar, queda como crew
   del evento en una sola transacción.
6. Se le ofrece —no se le exige— el panel de staff.

### Buscar un proveedor o un salón

1. La productora entra a `/proveedores`.
2. Manda una consulta.
3. Al proveedor le llega por mail.

⚠️ **La conversación se va afuera y no vuelve.** Hoy el proveedor contesta el
mail y ahí se pierde el rastro: **no se sabe si el negocio se cerró.** Es la
pieza que decide si esto es un marketplace o una guía de teléfonos, y no está
construida.

### Que alguien se sume al pool

`/sumate` → la ficha entra a `staff_app.staff_profiles` → se le manda la
bienvenida por lotes.

---

## El modelo de organizaciones

**Multi-tenant desde la migración `0001`**, no agregado después.

- `organizations` — las organizaciones, con `slug`, `is_default`, `activa` y
  `es_plataforma`.
- `members` — quién pertenece a cuál, y con qué rol.
- `member_invites` — la allowlist de altas. ⚠️ Su índice único es sobre
  `lower(email)` en **toda la tabla**: un mail no puede estar invitado a dos
  organizaciones.

**La RLS es el modelo de seguridad**, con `is_org_member()` e `is_org_writer()`
(`0001`), y las vistas son `security_invoker` a propósito: abrirlas para que la
plataforma vea todo las abriría para todos.

### Dos reglas que no son obvias y que cuestan caro olvidar

**1. Toda escritura pasa `p_org` explícito.**

La resolución de "en qué organización estoy" está **duplicada**: en TypeScript
(`lib/org.ts`) y adentro de Postgres (`current_org_id()`, que toma la membresía
más antigua). Ocho funciones de escritura pasan por
`resolve_org(p_org) = coalesce(p_org, current_org_id(), default_org_id())`.

Si el código no manda `p_org`, **la organización la elige Postgres, no la que se
validó**. Con un solo inquilino da igual; con dos, la escritura cae en la
equivocada. Está reproducido contra producción: la misma llamada, con `p_org`
cayó donde debía y sin `p_org` cayó en la otra.

**2. La RLS filtra por membresía, no por la organización elegida.**

Quien es miembro de dos organizaciones recibe las filas de las dos **juntas**.
Por eso las pantallas que leen datos filtran además por
`organization_id`: la RLS contesta "¿podés ver esto?", no "¿estás mirando esto
ahora?".

### El selector de contexto

Quien pertenece a más de una organización elige en nombre de cuál actúa. La
elección vive en una cookie de sesión `httpOnly`, se valida contra las
organizaciones del usuario y es **fail-closed**: una cookie con una organización
ajena se ignora entera y se vuelve a la de siempre, sin error distinto.

Con una sola organización el selector no se dibuja.

---

## Lo que NO existe

Para que nadie lo busque en el código:

- **Cobro de plataforma.** LABURO no le cobra a nadie. El circuito de pago está
  entero y **apagado por una bandera** (`lib/cobros.ts`), por decisión comercial
  del 2/9, no por falta de código.
- **Invitar miembros desde la pantalla.** Se hace por la base.
- **Mensajería in-app.** `/mensajes` es un placeholder honesto: la coordinación
  es por WhatsApp.
- **Billetera de documentos.** `/billetera`, ídem.
- **El puente a HITO.** Está previsto para una fase posterior y no está
  construido.
- **Que el proveedor conteste adentro de la app.** Ver "Los flujos".

---

## Para probar todo esto

**[`PRUEBAS.md`](./PRUEBAS.md)** — cómo dar de alta una segunda organización y
ver el aislamiento funcionando, con su limpieza.
