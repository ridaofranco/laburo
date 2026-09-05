# Pedidos de cotización

Pedirle precio a varias empresas por lo mismo, al mismo tiempo, y comparar las
respuestas en una tabla. Cada una cotiza **sin ver lo que cotizaron las otras**.

> **Estado: LAS CINCO ETAPAS ESTÁN CONSTRUIDAS, aplicadas en producción y
> probadas** (5/9/2026). Se puede usar de verdad: crear el pedido, invitar a
> quien sea por mail, que cotice sin cuenta, el recordatorio antes del cierre,
> comparar y adjudicar avisándole a todos.
>
> **Lo único que falta es correrlo con un caso real**, que manda mails de verdad
> a empresas de verdad y por eso no lo puede hacer una sesión de trabajo.

---

## Por qué esto existe

Hoy, cuando una productora necesita presupuestos, el circuito es: busca en
`/proveedores`, manda una consulta, y **el proveedor contesta por mail**. Ahí la
conversación se va afuera de LABURO y nunca se sabe si el negocio se cerró.

Eso tiene dos consecuencias, y la segunda es la cara:

1. El que pide termina con quince hilos de correo y una planilla a mano.
2. **LABURO no se entera de nada**, así que no puede cobrar comisión nunca, ni
   saber qué proveedor cumple.

### El caso real que da forma a todo esto

El transporte de un pallet a siete destinos: **370 correos, 45 respuestas, y
solo 2 cotizaciones con un precio adentro.**

De ahí salen las tres reglas de diseño que siguen. No son teoría: cada una costó
semanas.

**Regla 1 — El problema no es que no contesten. Es que contestan sin cotizar.**
De 45 respuestas, 43 eran preguntas, aclaraciones o "pasame más datos". Por eso
el precio no es un campo más del formulario: **es lo primero y lo más grande de
la pantalla**, y una cotización sin monto no se puede enviar.

**Regla 2 — Un requisito excluyente devuelve cero.** Pedir portón hidráulico
espantó a las 37 empresas. Partir la carga en dos destrabó a una que ya había
dicho que no. Por eso **acá no hay filtros duros**: lo que se necesita se pide
como dato, y el que compara ve quién lo cumple. Espantar a alguien antes de que
cotice es perder una cotización que quizás servía igual.

**Regla 3 — El seguro costaba más que el flete.** Un precio suelto no se puede
comparar: uno incluye seguro, otro no, otro lo cobra por bulto. Por eso toda
cotización lleva **qué incluye y qué NO incluye**, escritos aparte del número.
Sin eso, la tabla comparativa miente.

---

## Cómo funciona

### Para el que pide

1. Crea un pedido: qué necesita, dónde, para cuándo, y hasta cuándo recibe
   respuestas.
2. Arma el desglose: qué quiere que cada empresa le detalle además del precio.
   Hay una plantilla por rubro para no arrancar de cero.
3. Invita: elige proveedores del directorio **y/o pega una lista de mails**.
4. A cada invitado le llega **su propio link**.
5. Ve las cotizaciones entrar en una tabla, ordenables por precio.
6. Marca la ganadora. Se avisa a todos: al que ganó y a los que no.

### Para el que cotiza

1. Recibe un mail con un link. **No tiene que registrarse ni tener cuenta.**
2. Abre y ve: quién pide, qué necesita, para cuándo, y hasta cuándo hay tiempo.
3. Carga el precio, qué incluye, qué no, y el desglose.
4. Manda. Puede corregir hasta que cierre el pedido.
5. Cuando se resuelve, le avisan si ganó o no.

⚠️ **Nunca ve cuántos más fueron invitados, quiénes son, ni qué cotizaron.**

---

## Las tres decisiones, tomadas

**1. Se puede invitar a cualquiera, por mail.** No hace falta que esté
registrado en LABURO. Es lo único que sirve para el caso real —las 37 empresas
de transporte no estaban— y además cada empresa que cotiza queda con un pie
adentro: es la mejor máquina de sumar proveedores que tiene el producto.

**2. El que cotiza SÍ ve quién le pide.** Un proveedor serio cotiza distinto y
más rápido cuando sabe con quién habla. Lo ciego es **entre proveedores**, no
hacia el que pide.

**3. Al elegir se avisa a todos.** Al ganador que ganó, a los demás que se
cerró. Dos razones: queda registrado quién ganó y por cuánto —que es el único
dato que después permite cobrar una comisión sin discutir—, y el que cotizó y
nunca supo nada **no te vuelve a cotizar**. Avisar es lo que sostiene la red.

---

## El modelo de datos

Tres tablas. Los nombres van en inglés, como el resto del esquema.

### `quote_requests` — el pedido

| Campo | Qué es |
|---|---|
| `organization_id` | Quién pide |
| `gig_id` | Opcional: el evento al que pertenece |
| `titulo`, `descripcion` | Qué se necesita |
| `categoria` | Rubro, del catálogo que ya existe |
| `provincia`, `ciudad` | Dónde |
| `necesario_para` | La fecha del trabajo |
| `cierra_at` | Hasta cuándo se reciben cotizaciones |
| `campos` | `jsonb`: el desglose que se le pide a cada uno |
| `estado` | `abierta`, `cerrada`, `adjudicada`, `cancelada` |

### `quote_invites` — a quién se le pidió

| Campo | Qué es |
|---|---|
| `request_id` | El pedido |
| `profile_id` | Si es un proveedor del directorio. **Nullable**: los de afuera no tienen |
| `email`, `nombre` | Siempre, aunque no esté registrado |
| `token_hash`, `token_expires_at` | Su link único. Mismo patrón que las ofertas de staff |
| `enviado_at`, `visto_at` | Si el mail salió, y si lo abrió |

⚠️ Índice único sobre `(request_id, lower(email))`: **al mismo pedido, un mail se
invita una sola vez**. Sin eso, pegar una lista con un repetido manda dos links
al mismo lugar y llegan dos cotizaciones de la misma empresa.

### `quotes` — la cotización

| Campo | Qué es |
|---|---|
| `invite_id` | **UNIQUE**: una cotización por invitado |
| `monto`, `moneda` | El número. Campo de primer nivel, no adentro del `jsonb` (regla 1) |
| `incluye`, `no_incluye` | Texto, obligatorio el primero (regla 3) |
| `validez_dias` | Cuánto vale ese precio |
| `respuestas` | `jsonb`: el desglose que pidió el que pide |
| `estado` | `enviada`, `ganadora`, `no_elegida` |

---

## Lo ciego, que es el punto

**No se resuelve escondiendo cosas en la pantalla. Se resuelve en la base.**

- `quotes` se lee con `is_org_member(organization_id del pedido)`. El proveedor
  no es miembro de ninguna organización: **no puede leer la tabla, punto**.
- El proveedor llega solo por su token, y la función que le contesta le devuelve
  **su propia cotización y nada más**. No recibe un listado que después se
  filtra en el cliente: recibe una fila.
- La cantidad de invitados tampoco viaja. Saber que sos uno de doce ya cambia
  cómo cotizás.

Mismo patrón que la oferta de staff, que ya está probado en producción: token
opaco, función `SECURITY DEFINER` con `search_path` fijo, y el `GRANT` a `anon`
solo sobre las funciones del token.

---

## Cómo se construye, por etapas

Cada una deja algo que funciona. No hay etapa que sirva solo para la siguiente.

**Etapa 1 — La base.** ✅ **HECHA el 5/9** (`staff_app_0078`). Las tres tablas,
su RLS, y las seis funciones: `staff_app_crear_pedido`,
`staff_app_invitar_a_cotizar`, `staff_app_ver_invitacion`, `staff_app_cotizar`,
`staff_app_listar_cotizaciones` y `staff_app_adjudicar`.

*Probado contra producción, adentro de una transacción con `ROLLBACK`, y la base
quedó en cero:* se creó el pedido, se invitó a tres (con un mail repetido en otra
capitalización y uno sin arroba: **1 repetido y 1 inválido, reportados, y salieron
2 links, no 4**), dos cotizaron sin cuenta, uno corrigió su precio (**la misma
fila, no una segunda**), se comparó, se adjudicó y **no se pudo adjudicar dos
veces**. Después de adjudicar, cotizar devuelve `cerrado` y el que perdió ve su
propia cotización marcada `no_elegida`.

*Y lo ciego se probó de los dos lados:* un pedido en una organización de la que no
sos miembro devuelve `forbidden`; `anon` llamando a `staff_app_listar_cotizaciones`
recibe **permission denied** de Postgres, y `anon` leyendo `quote_requests` a mano
también, porque ni siquiera tiene el `GRANT`. El que cotiza nunca recibe cuántos
más fueron invitados.

⚠️ **De paso apareció que HITO ya tenía un esbozo de esto**: `public.rfqs`,
`public.rfq_vendors`, `get_rfq_request` y `submit_rfq_quote`, en el mismo
proyecto de Supabase. Están **en cero filas** y les falta casi todo (sin fecha de
cierre, sin qué incluye, sin dedupe, sin adjudicación, y **el token guardado en
claro**). No se reusó ni se tocó. Y ojo: `public.quotes` de HITO es el
presupuesto AL CLIENTE, no la cotización de un proveedor.

**Etapa 2 — Crear e invitar.** ✅ **HECHA el 5/9.** `/cotizaciones`,
`/cotizaciones/nuevo` y `/cotizaciones/[id]`. El desglose se precarga con una
plantilla por rubro (8 rubros más una genérica, en `lib/cotizaciones.ts`) y se
edita o se borra; si ya tocaste el desglose, cambiar de rubro no te pisa nada. La
fecha de cierre viene puesta en una semana. Los mails se pegan de una planilla o
de un correo: acepta `Nombre <mail@x.com>`, coma, punto y coma o salto de línea,
y deduplica antes de mandar para poder decirte "de los 40 que pegaste, 3 estaban
repetidos".

⚠️ **El orden es guardar → mandar → marcar.** `enviado_at` se estampa DESPUÉS del
envío y solo en los que salieron. La pantalla muestra "el mail no salió" cuando
no salió, en vez de un "listo" que miente.

**Etapa 3 — La pantalla del que cotiza.** ✅ **HECHA el 5/9.**
`/cotizar/[token]`, sin sesión, en la lista de rutas públicas del middleware. El
precio va primero y en 28px; después qué incluye (obligatorio); después lo
opcional. Dice que se puede corregir hasta el cierre, que es lo que hace que
alguien cargue un número estimado en vez de no cargar nada. Y no muestra una sola
señal de competencia.

⚠️ Cargar el precio es POST, nunca GET: ningún preview de link de WhatsApp o
Gmail puede dejar un presupuesto cargado.

**Etapa 4 — La comparación.** ✅ **HECHA el 5/9.** Tabla ordenada por precio con
qué incluye y qué NO incluye al lado, el desglose de cada uno abajo, y un botón
"elegir este" por fila con confirmación. **No hay adjudicación automática al más
barato.** Y los tres mails: al que ganó, al que cotizó y no quedó, y al que fue
invitado y no llegó a cotizar. Al que perdió **no** se le dice por cuánto ganó el
otro.

**Etapa 5 — Los recordatorios.** ✅ **HECHA el 5/9.**
`/api/cron/recordatorio-cotizacion`, adentro del despachador diario. Le escribe a
los invitados que no cotizaron de pedidos que cierran en 48 horas, **solo si la
invitación les salió**, y **uno solo por invitación** (`recordado_at`).

⚠️ El recordatorio trae **otro token**: el original no se puede reconstruir
porque de él solo queda el sha256, y un recordatorio sin botón pierde a la mitad.
Los dos links valen a la vez, así que el mail viejo tampoco se rompe. Mismo
patrón que el recordatorio de las ofertas de staff (migración 0030).

⚠️ Esta tanda **no tiene interruptor de encendido**, a diferencia de la
bienvenida y la pregunta de visibilidad. Esas le escriben a cientos de personas
que no esperan nada; esta le escribe a alguien que recibió una invitación
explícita y todavía puede responderla.

---

## Lo que NO va a tener, y es a propósito

- **Contrapropuestas y regateo.** Se cotiza una vez y se corrige hasta el
  cierre. Un ida y vuelta de precios adentro de la app es otro producto.
- **Pliegos, garantías, sobres sellados.** Esto no es una licitación pública. Se
  llama "pedido de cotización" en toda la interfaz, no "licitación", justamente
  para que nadie espere eso.
- **Adjudicación automática por precio.** El más barato no es el que gana: gana
  el que incluye lo que hay que incluir. La tabla ordena por precio; **elegir lo
  hace una persona.**
- **Pago adentro.** Fuera de alcance mientras el cobro siga apagado.

---

## Lo que falta, y no es código

**Correrlo con un caso real.** Todo lo de arriba se probó contra producción
adentro de transacciones con `ROLLBACK`, y los mails se revisaron renderizados,
pero nunca salió uno a una empresa de verdad. El primer pedido real es la prueba
que falta, y la que va a decir si el copy de la invitación funciona.

**Decidir si se cobra.** Hoy LABURO es gratis y el cobro está apagado por
bandera. Este módulo es el que hace posible cobrar sin discutir, porque por
primera vez queda registrado **quién ganó y por cuánto**. Prenderlo es otra
decisión.

## Las preguntas que quedan abiertas

1. **¿Puede crear un pedido alguien sin cuenta?** Hoy no: el pedido cuelga de
   una organización. Abrirlo a un independiente sin cuenta es la Fase 4 que
   `provider_contacts` ya dejó preparada al hacer `organization_id` nullable.
2. **¿Se puede partir un pedido en dos?** La regla 2 dice que partir la carga
   destrabó una cotización. Hoy sería crear dos pedidos a mano. Ver si vale un
   "duplicar este pedido".
3. **¿Qué pasa si nadie cotiza?** Hay que decidir qué muestra la pantalla y si
   avisa. Un pedido vencido y vacío no puede quedar en silencio.
