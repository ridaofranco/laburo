# PRUEBAS

Cómo dar de alta la primera productora de prueba, qué se puede ver una vez
armada, y cómo sacarla sin dejar basura.

Este archivo existe porque **hoy el aislamiento entre organizaciones no se
puede ver.** Está escrito para que alguien lo siga de arriba a abajo sin tener
que decidir nada.

---

## 0. El estado real de la base, hoy

Contado contra producción el **5/9/2026**:

| Qué | Cuánto |
|-----|--------|
| Organizaciones | **2** |
| Miembros, en toda la base | **1** |
| Invitaciones (`member_invites`) | **1** |
| Fichas de staff (`staff_profiles`) | **1.050** |
| Eventos (`gigs`) | **0** |
| Ofertas (`offers`) | **0** |
| Crew (contrataciones) | **0** |
| Cobros al cliente (`client_payment_events`) | **0** |
| Perfiles de marketplace | **1.052**, todos `tipo = 'persona'` y ninguno público: son el espejo del pool. **Cero proveedores y cero salones.** |

Las dos organizaciones:

| Nombre | `slug` | `is_default` | `es_plataforma` | Miembros | Fichas |
|--------|--------|--------------|-----------------|----------|--------|
| SOMOS DER | `somos-der` | sí | **sí** | 1 (`franco@somosder.ar`, `owner`) | 1.050 |
| SOMOS DER | `somos-der-2` | no | no | **0** | 0 |

⚠️ **`somos-der-2` no sirve como productora de prueba.** No tiene miembros, no
tiene dueño, no se sabe de dónde salió y se llama igual que la otra. Está
esperando una decisión sobre qué se hace con ella, no es un instrumento.

**La consecuencia de todo esto:** hay UNA sola persona en UNA sola
organización, así que "la organización que eligió Postgres" y "la que se quiso"
son siempre la misma. Ningún bug de aislamiento se puede ver, y ninguna pantalla
que separe organizaciones se puede probar de verdad. Por eso está este archivo.

---

## 1. Qué tiene que haber al final

Una segunda organización **completa y aislada**:

1. La organización, con `es_plataforma = false`, `activa = true` y su `slug`.
2. **Un usuario propio**, dueño de esa organización y de ninguna otra.
3. **Franco, además, como segundo miembro de esa organización.**
4. Un evento propio.
5. Una oferta propia, con monto y fecha.
6. Opcional: una ficha de staff vinculada, para ver que `/buscar` no mezcla
   pools. ⚠️ Leé la trampa del punto 4 antes de sumarla.

### Por qué las dos cosas, el usuario nuevo Y Franco

Son dos preguntas distintas y las dos hay que contestarlas:

- **Un usuario nuevo** prueba el **aislamiento de verdad**: dos personas que no
  se ven. Lo que **no** prueba es el selector de contexto, porque nadie con una
  sola membresía tiene entre qué elegir.
- **Franco con dos membresías** prueba el **selector**. Lo que **no** prueba es
  el aislamiento entre usuarios distintos, porque Franco es legítimamente
  miembro de las dos.

Por eso el checklist arma las dos: el usuario nuevo es dueño, y Franco entra
como segundo miembro con rol `writer` (no `owner`: así además se ve si el rol
por organización cambia lo que se puede hacer).

---

## 2. El alta, paso a paso

**El principio: por el camino del producto donde existe, por SQL solo donde el
producto no ofrece pantalla.** Sembrar todo por SQL prueba tu SQL, no la app.

### Paso 1 — La organización y su dueño, por el producto

Camino real, el mismo que va a usar la primera productora de verdad.

1. Entrar a `/registrar-productora` (alta abierta desde la Fase 2, migraciones
   0056 y 0069).
2. Cargar:
   - **Productora:** `PRUEBA Aliada SRL` — el prefijo `PRUEBA` no es decorativo:
     es lo que hace que se reconozca de un vistazo en `/plataforma`.
   - **Mail:** una casilla real a la que tengas acceso. ⚠️ Tiene que ser real:
     el alta manda el mail con el link para elegir contraseña, y sin ese link no
     se puede entrar.
   - **Teléfono:** obligatorio desde la 0069.
3. Confirmar. La pantalla dice si el mail salió o no salió: **son dos cosas
   distintas y la cuenta existe igual.**
4. Abrir el mail, elegir contraseña, entrar.

Qué pasa por atrás, para poder diagnosticar si algo falla:
`staff_app_crear_productora` crea la organización y le deja una **invitación de
owner** a ese mail en `member_invites`. Cuando la persona entra por primera vez,
`provision_member` (que ya corre en `/auth/callback`) lee esa invitación y la
hace `owner`. No hay ninguna auth nueva.

⚠️ **Usá un mail que no tenga invitación previa.** El índice
`member_invites_email_key` es único sobre `lower(email)` **en toda la tabla, sin
importar la organización**: un mail no puede estar invitado a dos
organizaciones. Hoy la única invitación cargada es `franco@somosder.ar` →
`somos-der`, así que ese mail **no sirve** para esto.

**Control:**

```sql
-- La organizacion quedo creada, con su invitacion de owner.
SELECT o.id, o.name, o.slug, o.es_plataforma, o.activa,
       i.email AS invitado, i.role
FROM staff_app.organizations o
LEFT JOIN staff_app.member_invites i ON i.organization_id = o.id
WHERE o.slug LIKE 'prueba-%';

-- Y despues de que la persona entro por primera vez, es miembro owner.
SELECT m.role, u.email
FROM staff_app.members m
JOIN auth.users u ON u.id = m.user_id
JOIN staff_app.organizations o ON o.id = m.organization_id
WHERE o.slug LIKE 'prueba-%';
```

### Paso 2 — Franco como segundo miembro, por SQL

Esto **no tiene pantalla**: "Invitar miembros" sigue siendo *próximamente*. Y
tampoco se puede hacer con una invitación, por el índice único global del mail
que se explicó arriba. Va INSERT directo:

```sql
-- Franco, como segundo miembro de la productora de prueba. Rol writer y no
-- owner a proposito: asi ademas se ve si el rol POR ORGANIZACION cambia lo que
-- se puede hacer (lib/permisos.ts lee el rol de la org actual).
INSERT INTO staff_app.members (organization_id, user_id, role)
SELECT o.id, u.id, 'writer'
FROM staff_app.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'prueba-aliada'          -- WHERE acotado: una sola organizacion
  AND u.email = 'franco@somosder.ar'    -- WHERE acotado: un solo usuario
ON CONFLICT (organization_id, user_id) DO NOTHING;
```

**Control:** Franco tiene que quedar con **dos** membresías.

```sql
SELECT o.slug, m.role
FROM staff_app.members m
JOIN staff_app.organizations o ON o.id = m.organization_id
JOIN auth.users u ON u.id = m.user_id
WHERE u.email = 'franco@somosder.ar'
ORDER BY m.created_at;
```

### Paso 3 — El evento, por el producto

Entrando **con el usuario nuevo** (no con Franco): `/tablero` → crear evento.
Ponele `PRUEBA Evento de la aliada` y una fecha futura.

Va por el producto a propósito: es justamente el camino donde vivía el bug de la
organización equivocada (`gig-actions.ts`), así que **crearlo desde la app es
parte de la prueba**. Si aparece con el `organization_id` de SOMOS DER, eso es
el hallazgo.

**Control:**

```sql
SELECT g.title, o.slug AS organizacion
FROM staff_app.gigs g
JOIN staff_app.organizations o ON o.id = g.organization_id;
```

### Paso 4 — La oferta, por el producto (y no por SQL)

Con el usuario nuevo: `/buscar` → abrir una ficha → mandar oferta, **con monto y
con fecha** (la 0068 los exige y sin ellos la función corta).

⚠️ **Esta no se siembra por SQL ni queriendo.** `offers.token_hash` es `NOT
NULL`: sembrarla a mano obliga a fabricar el hash del token del link mágico a
mano, o sea a reimplementar afuera la parte más delicada del producto. El camino
del producto lo hace bien y además deja el mail y el link andando.

**Control:**

```sql
SELECT of.amount, of.status, o.slug AS organizacion
FROM staff_app.offers of
JOIN staff_app.organizations o ON o.id = of.organization_id;
```

### Paso 5 — La ficha de staff propia (opcional)

Solo si querés ver que `/buscar` no mezcla pools.

⚠️⚠️ **La trampa que hay que conocer ANTES de sumarla: si sumás una ficha
vinculada a la productora de prueba, ya no vas a poder borrar la organización
hasta desvincularla.** Ver la sección 4.

```sql
INSERT INTO staff_app.staff_profiles (nombre, apellido, email, telefono, organization_id)
SELECT 'PRUEBA', 'Ficha Aliada', 'prueba.ficha.aliada@example.invalid', '0', o.id
FROM staff_app.organizations o
WHERE o.slug = 'prueba-aliada';        -- WHERE acotado: una sola organizacion
```

---

## 3. Qué se puede ver, una vez armado

Esto es para lo que existe todo lo de arriba. Cada línea es una pregunta que
**hoy no se puede contestar**:

1. **`/buscar` no mezcla pools.** Entrando con el usuario nuevo tiene que verse
   su ficha y **no** las 1.050 de SOMOS DER.
2. **`/tablero` no muestra el evento de la otra.**
3. **Una oferta de A no aparece en `/pagos` de B.**
4. **El selector de contexto cambia de verdad la organización de escritura.**
   Con Franco (dos membresías): elegir la aliada, crear un evento, y confirmar
   en la base que quedó con el `organization_id` de la aliada y no con el de
   SOMOS DER. **Esta es la prueba que importa**: la pantalla puede decir una
   cosa y la base hacer otra.
5. **El rol es por organización.** Franco es `owner` en SOMOS DER y `writer` en
   la aliada: con la aliada elegida, `lib/permisos.ts` tiene que darle los
   permisos de `writer`.
6. **Las pantallas de plataforma se cierran.** Con la aliada elegida, `/leads`,
   `/rentabilidad` y `/plataforma` tienen que dejar de estar disponibles, y el
   ítem del menú tiene que desaparecer. **Es deliberado, no un bug.**

⚠️ **Aviso, mientras la productora de prueba exista:** aparece en `/plataforma`,
en los conteos del panel y en la rentabilidad cruzada. **Es esperado.** Hay que
sacarla cuando se termina de probar, y por eso está la sección 4.

---

## 4. La limpieza

⚠️⚠️ **La trampa, verificada contra producción:** casi todo lo que cuelga de una
organización tiene `ON DELETE CASCADE` — `members`, `member_invites`, `gigs`,
`offers`, `crew`, `candidate_notes`, `staff_ratings`, `producer_leads`,
`profile_org_links` —, **pero `staff_profiles.organization_id` NO.** Es `NO
ACTION`.

Consecuencia concreta, con el error textual que devuelve:

```
ERROR: 23503: update or delete on table "organizations" violates foreign key
constraint "staff_profiles_organization_id_fkey" on table "staff_profiles"
```

O sea: **si hiciste el paso 5, borrar la organización primero FALLA.** Y el
error no dice "sacá la ficha", dice el nombre de una constraint.

Y la trampa en el otro sentido, que es la cara: **el cascade se lleva miembros,
invitaciones, eventos y ofertas sin nombrarlos ni pedir confirmación.** Un
`slug` equivocado en ese `DELETE` y te llevaste puesta la organización real.

### El orden correcto

**Primero lo que NO cascadea. Después la organización.**

```sql
-- (a) CONTROL ANTES. Anota estos numeros.
SELECT
  (SELECT count(*) FROM staff_app.organizations)  orgs,
  (SELECT count(*) FROM staff_app.members)        miembros,
  (SELECT count(*) FROM staff_app.member_invites) invitaciones,
  (SELECT count(*) FROM staff_app.gigs)           eventos,
  (SELECT count(*) FROM staff_app.offers)         ofertas,
  (SELECT count(*) FROM staff_app.staff_profiles) fichas;

-- (b) VER QUE SE VA A BORRAR, antes de borrar nada.
SELECT id, name, slug, es_plataforma, is_default
FROM staff_app.organizations
WHERE slug = 'prueba-aliada';
-- Tiene que devolver UNA fila, con es_plataforma = false y is_default = false.
-- Si devuelve cero, o mas de una, o alguna en true: FRENA.

-- (c) Las fichas vinculadas, que son las que NO cascadean.
DELETE FROM staff_app.staff_profiles
WHERE organization_id = (SELECT id FROM staff_app.organizations WHERE slug = 'prueba-aliada');

-- (d) Y recien ahora la organizacion. El resto se va en cascada.
DELETE FROM staff_app.organizations
WHERE slug = 'prueba-aliada';         -- WHERE acotado: un solo slug

-- (e) CONTROL DESPUES. Tiene que dar exactamente lo mismo que (a).
SELECT
  (SELECT count(*) FROM staff_app.organizations)  orgs,
  (SELECT count(*) FROM staff_app.members)        miembros,
  (SELECT count(*) FROM staff_app.member_invites) invitaciones,
  (SELECT count(*) FROM staff_app.gigs)           eventos,
  (SELECT count(*) FROM staff_app.offers)         ofertas,
  (SELECT count(*) FROM staff_app.staff_profiles) fichas;
```

### El usuario nuevo

El `DELETE` de arriba borra la **membresía**, no la cuenta de `auth.users`. La
cuenta queda viva, sin organización, y al entrar ve *"Esta cuenta no tiene
acceso"*.

**Dejala.** Borrar de `auth.users` es una operación aparte, más delicada, y una
cuenta huérfana no molesta a nadie: cuando quieras volver a armar la productora
de prueba, la reusás. Si igual querés sacarla, va de a una y por mail exacto,
nunca por patrón.

### Cómo se probó esto

El ciclo entero (alta → ficha vinculada → borrado en el orden correcto) se
ejecutó **contra la base de producción, adentro de una transacción con
`ROLLBACK`**. El error de la constraint que está copiado arriba es el que
devolvió de verdad, no uno inventado, y los seis conteos de control volvieron
exactos a los de la sección 0. La base quedó igual.

---

## 5. Reglas de este archivo

1. **Todo SQL de acá corre contra PRODUCCIÓN.** No hay base de staging.
2. **Ninguna sentencia sin `WHERE`.** Ningún `DELETE` que pueda barrer más de lo
   que dice su línea.
3. **Antes de cada `DELETE`, el `SELECT` que muestra qué se va a borrar.**
4. **Si dudás, envolvelo en `BEGIN; … ROLLBACK;`** y mirá los conteos. Es lo que
   se hizo para escribir este archivo.
5. **Nombres con prefijo `PRUEBA`.** Lo que no se distingue de un dato real
   termina quedándose.

---

## 6. Cuándo el staff pasa a tener panel

Hay **dos formas de ser staff en LABURO** y hasta ahora no había ninguna regla
escrita sobre cuándo se pasa de una a la otra. Esto es esa regla.

⚠️ La Tarea 8 va a mover o citar esta sección desde `ACTORES.md`. **Esta es la
versión original: si las dos se separan, manda esta.**

### Las dos formas

- **Sin cuenta** — `/o/<token>`. Token opaco, RPC `SECURITY DEFINER`, cero auth.
  Es como se acepta una oferta.
- **Con cuenta** — `/panel-staff`, `/trabajos`, `/fichaje`,
  `/editar-perfil-staff`. Gate `requireStaff()`, que resuelve identidad **por
  email verificado**.

### Las cinco preguntas, contestadas

**1. ¿Aceptar una oferta crea una cuenta?**

**NO.** Ni "silenciosamente" ni "por las dudas". Es requisito del PRD (*"A staff
member can accept an offer from the magic link **without creating an
account**"*) y decisión de arquitectura del research (*"Supabase Auth magic link
para staff: NUNCA"*). Crear una cuenta que la persona no pidió rompe la promesa
de que aceptar es un solo click.

**2. ¿Entonces cuándo aparece el panel?**

Cuando **la persona lo pide**: se anota en `/sumate`, o entra por
`/acceso-staff` con su mail. **El disparador es la persona, nunca el sistema.**

**3. ¿Qué pasa justo después de aceptar?**

Se le **ofrece** el panel, con la ventaja concreta y no como trámite: *"mirá tus
próximos laburos, fichá y enterate cuando está el pago"*. Ofrecer, no exigir. Es
el momento de mayor intención —acaba de decir que sí a un laburo—, y lo único
que la puede mover es qué gana.

⚠️ **Rechazar no es momento de ofrecer nada.** La vista de rechazo no muestra
este link, a propósito.

**4. ¿La ficha del pool y la cuenta son lo mismo?**

**No, y es la parte que más confunde.**

- La **ficha** existe desde que alguien se anota. Hay **1.050 fichas** y
  prácticamente ninguna tiene cuenta.
- La **cuenta** se crea después, por su lado.
- Lo único que las une es el **email verificado**, en `requireStaff()`.

⚠️⚠️ **Si los dos mails no coinciden, la persona entra y no ve nada suyo.** Se
anotó con el mail del trabajo y entra con el personal, o al revés:
`requireStaff()` no encuentra perfil y la manda a `/acceso-staff`. Desde afuera
se ve idéntico a "no tenés cuenta", pero la persona **sí está en el pool**, con
sus ofertas y su historial, mirando una puerta que le dice que no.

**Es el caso que va a generar el primer reclamo.** Hoy no está resuelto: no hay
forma de que la persona una los dos mails sola. Cuando pase, se arregla **del
lado del dato** (corrigiendo el email de la ficha), no relajando el gate:
resolver por email verificado es correcto y no se toca.

**5. ¿Qué ve cada uno?**

| | Sin cuenta | Con cuenta |
|---|---|---|
| Qué ve | **Solo esa oferta**, por su token, mientras el token viva | Todas sus ofertas, el fichaje y su perfil |
| Cómo entra | El link del mail | Su mail, en `/acceso-staff` |
| Cuánto dura | Lo que dure el token | Mientras tenga la cuenta |

### Una puerta, no dos

Antes había **dos puentes al mismo lugar**, decididos en dos momentos: la
pantalla de aceptación mandaba a `/acceso-staff` y el mail de confirmación a
`/panel-staff`. Ahora los dos van a **`/acceso-staff`**.

Por qué esa y no la otra: `/panel-staff` **exige sesión**, así que a quien no
tiene cuenta —que es el caso normal— lo rebotaba a `/acceso-staff` igual, con
una pantalla de más justo cuando menos dispuesta está. `/acceso-staff` sabe
atender a los dos casos: al que ya tiene cuenta lo rutea, y al que no, le pide
el mail.

### Lo que NO se cambió, y es decisión

- **No se crea ninguna cuenta al aceptar.**
- **No se tocó la RPC de aceptar.** Es atómica, de un solo uso, y anda.
- **No se tocó `requireStaff()`.** Resolver por email verificado es correcto.
- **No se tocó `middleware.ts`.** `/panel-staff` y `/acceso-staff` ya están en
  `publicPrefixes` y el gate real es la página.

⚠️ **Con 0 ofertas en la base, nadie recorrió nunca este camino.** No hay
comportamiento en producción que preservar, y para probarlo **hay que fabricar
una oferta**: ver el paso 4 de la sección 2.

---

## 7. Estado: ¿hay una productora de prueba viva ahora mismo?

**No.** Al 5/9/2026 este archivo está escrito y su ciclo verificado con
`ROLLBACK`, pero **el alta por el camino del producto no se corrió**: crea una
organización de verdad y manda un mail de verdad a una casilla real, así que la
ejecuta Franco.

Cuando se corra, **anotarlo acá**: nombre de la organización, `slug`, mail del
usuario nuevo y fecha. Es la única forma de saber que hay basura de prueba viva
y desde cuándo.

| Organización | `slug` | Usuario nuevo | Desde | Sacada |
|--------------|--------|---------------|-------|--------|
| — | — | — | — | — |
