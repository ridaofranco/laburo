# Lo que sigue en LABURO

**Escrito el 8/9/2026**, con el producto ya andando y dos cosas marcadas por Franco
usándolo. No es una lista de deseos: son los dos agujeros que aparecieron con uso
real, con el diseño ya pensado para que la próxima sesión ejecute y no vuelva a
discutirlo.

---

# 1. La cotización por ítems

## El problema, en las palabras de Franco

> *"tampoco es que se puede poner precios, es decir, si quieren desglosarlo o pueden
> solo ofertar por alguna de todas las cosas"*

Hoy una cotización es **un monto y nada más**. Y eso choca de frente con el producto:
en el pedido de catering que él mismo escribió, la primera pregunta es *"precio por
persona de cada servicio, por separado, no un paquete cerrado"*.

**Preguntamos por el desglose y no tenemos dónde recibirlo.** El proveedor lo contesta
escribiendo en un campo de texto, y el que compara vuelve a tener que leer párrafos
en vez de mirar una tabla. Es exactamente el problema que este módulo vino a matar.

Y falta la otra mitad: **ofertar por una parte**. Si pedís sonido + luces + tarima y
alguien solo hace sonido, hoy tiene que inventar un total o no cotizar. En el caso del
pallet, partir la carga en dos fue lo que destrabó a una empresa que ya había dicho
que no.

## El modelo

Dos tablas nuevas. Nada de lo que existe se rompe.

### `quote_request_items` — lo que se pide, renglón por renglón

| Campo | Qué es |
|---|---|
| `request_id` | El pedido |
| `orden` | Para mostrarlos como los escribió el que pide |
| `titulo` | "Cena de recepción, lunes 5" |
| `detalle` | Opcional |
| `cantidad`, `unidad` | 100 / "personas". Opcionales: hay ítems que no se cuentan |
| `obligatorio` | boolean. **Default false**, y esa decisión es la regla 2: si todo es obligatorio, volvimos al requisito excluyente que espantó a 37 empresas |

### `quote_lines` — lo que contesta cada uno

| Campo | Qué es |
|---|---|
| `quote_id` | La cotización |
| `item_id` | El renglón que está cotizando |
| `monto` | Su precio para ESE ítem |
| `no_cotiza` | boolean: "esto no lo hago". **Es un dato, no un vacío** |
| `comentario` | "Solo si son más de 80 personas" |

⚠️ **UNIQUE (quote_id, item_id).** Una línea por ítem y por cotización, igual que hay
una cotización por invitación.

⚠️ **`quotes.monto` NO se borra: pasa a ser el total.** Si hay líneas, se calcula
sumándolas; si no hay, es lo que cargó a mano. Así las cotizaciones que ya existen
siguen siendo válidas y la comparación no tiene dos caminos.

⚠️ **`no_cotiza` tiene que ser explícito y distinto de "no lo cargó todavía".** Es la
diferencia entre "no lo hago" y "me faltó completarlo", y si se confunden, el que
compara cree que tiene una oferta parcial cuando en realidad tiene una incompleta.

## Lo que cambia en cada pantalla

**Al armar el pedido** (`/cotizaciones/nuevo`): abajo del desglose de preguntas, una
lista de ítems. Se pueden dejar en cero: **un pedido de una sola cosa no debería
obligar a cargar un ítem**, si no el formulario se vuelve pesado para el caso simple.

**Al cotizar** (`/cotizar/[token]`): si el pedido tiene ítems, en vez del campo único
de precio va la lista, cada uno con su monto y su casilla *"esto no lo hago"*. El total
se calcula solo y se muestra grande arriba, que es la regla 1: el número sigue siendo
lo primero que se ve.

**Al comparar** (`/cotizaciones/[id]`): la tabla pasa a tener una fila por ítem y una
columna por proveedor. Ahí es donde esto se paga solo: se ve de un vistazo quién es
más barato en qué, y que la suma más conveniente puede ser de dos proveedores
distintos.

⚠️ **Y ahí aparece la decisión que hay que tomar antes de escribir la pantalla:
¿se puede adjudicar por ítem?** O sea, darle la cena a uno y los coffee breaks a otro.
El modelo lo aguanta (la ganadora sería por línea y no por cotización), pero cambia
los mails: hoy hay un ganador y varios que no. **Recomendación: la primera versión
adjudica entera, como hoy.** Partir un trabajo entre dos proveedores es una decisión
de producción, no de planilla, y conviene ver si Franco de verdad la quiere antes de
construirla.

## Por dónde empezar

1. Las dos tablas + su RLS (copiar la de `quotes`: se lee por `is_org_member` de la
   organización del pedido).
2. `staff_app_cotizar` acepta un array de líneas y calcula el total.
3. `staff_app_ver_invitacion` devuelve los ítems.
4. `staff_app_listar_cotizaciones` devuelve la matriz ítem × proveedor.
5. Recién ahí, las tres pantallas.

**Se prueba con SQL antes de tocar una pantalla**, igual que la etapa 1.

---

# 2. La cuenta del proveedor

## El problema, en las palabras de Franco

> *"el tema del proveedor es raro, todavía no puede crearse una contraseña, manejar,
> ver todo como un cliente, es rarísimo eso"*

Tiene razón, y **la causa es chica**: la función que manda el link para elegir
contraseña (`linkParaElegirContrasena`, en `lib/auth-link.ts`) la usan el alta de
staff (`/sumate`), el alta de productora (`/registrar-productora`), el acceso de staff
y la bienvenida. **`/registrar-proveedor` es la única que no la llama.**

Por eso el proveedor solo entra por el link mágico de un mail. Si lo pierde, no tiene
forma de volver. Y no puede hacer lo que hace cualquier otro actor del producto: entrar
cuando quiere, con su mail y su contraseña.

## Lo que hay que hacer

1. **Que el alta de proveedor cree la cuenta y mande el link de contraseña**, igual que
   el alta de productora. La infraestructura ya existe y está probada: es conectarla.
2. **Que `/entrar` reconozca al proveedor** y lo lleve a `/mi-proveedor`, que YA EXISTE
   y ya sabe resolver por sesión (`getUser()`), no solo por token.
3. **Que el link por token siga funcionando.** No se reemplaza: se suma. Hay
   proveedores que ya están adentro y solo tienen su link, y romperlo sería sacarlos
   del producto sin avisar. Los dos caminos conviven, como en el staff.

⚠️ **Ojo con la puerta única.** El producto ya pasó por esto: hubo un momento en que
la pantalla mandaba a un lado y el mail a otro, y se arregló dejando **una sola
puerta**. La cuenta del proveedor tiene que entrar por `/entrar` como todos, no
estrenar una pantalla de login propia.

⚠️ **Y una cuenta por mail, no una por perfil.** Ya existe *"una misma cuenta puede ser
productora, staff y proveedor a la vez"* (commit `d8a0e68`): esto tiene que apoyarse
ahí y no crear un usuario paralelo, o la misma persona termina con dos cuentas y
ninguna completa.

---

# 3. Lo chico que quedó anotado

- **Editar un pedido.** Hoy solo se puede correr la fecha, cerrar o cancelar. Si te
  equivocaste en el título o en una pregunta, hay que rehacerlo perdiendo las
  invitaciones.
- **Un brief con dos trabajos distintos debería dar dos pedidos.** Probado con el de
  H&S: metió las dos activaciones en uno. Hoy hay que partirlo a mano.
- **Avisar cuando tenés pedidos en otra cuenta**, en vez de una pantalla vacía.
