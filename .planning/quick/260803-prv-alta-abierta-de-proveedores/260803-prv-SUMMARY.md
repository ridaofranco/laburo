---
slug: 260803-prv-alta-abierta-de-proveedores
fecha_plan: 2026-08-03
fecha_ejecucion: 2026-08-05
tipo: quick
status: ejecutado
---

# Alta abierta de proveedores, y de paso la puerta de entrada de todos

Lo que arrancó como "que los proveedores se carguen solos" terminó tocando la
forma en que se ingresa a LABURO, porque Franco lo pidió en el medio.

## 1. El proveedor se anota solo (el plan del 3/8)

**Casi todo estaba construido.** Desde la `0042` el proveedor ya podía, sin
cuenta y por token, completar su perfil, cargar servicios, armar su formulario de
consulta y publicarse o despublicarse. Faltaba UNA cosa: cómo conseguía el token.
`staff_app_generar_link_proveedor` exige ser writer de una productora y **ningún
archivo del repo la llamaba**, así que no había forma de empezar, ni solo ni a
mano.

- **`0060`** · `staff_app_registrar_proveedor`: crea el perfil COMPLETO con sus
  servicios en un solo paso, lo publica al toque (decisión 1 de Franco) y
  devuelve el token crudo una vez. Solo `service_role`.
  - Valida que haya al menos un servicio **con provincias**: sin zona el perfil
    se publicaría **invisible**, porque la vidriera filtra por provincia. Dejar
    publicar algo que nadie puede encontrar es peor que rechazar el alta.
  - Reinscribirse regenera el token y **no pisa los datos**. El caso normal de
    volver a anotarse es "no me llegó el mail".
- **`/registrar-proveedor`** con el formulario COMPLETO que pidió Franco
  (rechazó la versión corta), en `publicPrefixes` para no comerse el 307 mudo.
- **Las dos puertas**: tercera tarjeta en la landing ("Dos caminos" pasó a "Tres
  caminos") y CTA en `/servicios`, incluido el estado vacío.

## 2. El agujero que el plan no había visto

El plan decía que el aviso a Franco era "el control" de la alta abierta. Pero
**`staff_app_plataforma_moderar` solo modera `gig_openings`**: sobre un proveedor
publicado no había ninguna forma de intervenir. O sea que el aviso hubiera sido
un aviso sin botón, con el antecedente de que el único proveedor cargado a mano
tenía una obscenidad en la bio y era el 100% del directorio.

- **`0061`** · `staff_app_plataforma_proveedores` + `staff_app_plataforma_moderar_proveedor`,
  con motivo obligatorio para bajar, y pantalla `/plataforma/proveedores`.

## 3. La puerta de entrada de todos (pedido de Franco en el medio)

*"Yo necesito que ingresar sea facil, me parece que la complicamos un monton"*.
Era cierto: **nueve puertas y tres mecanismos**. `/login` y `/acceso-staff` eran
dos pantallas idénticas para dos públicos, y el proveedor no podía ingresar.

- **`/entrar`**: pregunta primero qué sos (tres botones, la opción que eligió
  Franco) y después pide mail y contraseña. El rol viaja como **hint** a
  `/auth/callback`, que sigue siendo el único que decide identidad.
- **El callback suma la rama del proveedor** con `staff_app_vincular_proveedor`.
  Va **último** en el orden natural porque esa función ESCRIBE (estampa
  `user_id`) y las otras dos solo leen: así, quien es productora y además
  proveedora entra a su panel de productora sin que el login le toque un perfil
  que no venía a usar.
- **Otra vez estaba construido y enterrado**: la `0045` dejó la puerta por sesión
  entera y nunca se conectó a una pantalla. Al conectarla apareció el único hueco
  real: faltaba el lector del formulario por sesión → **`0062`**.
- El panel del proveedor pasa a ser **uno solo** (`components/proveedor/panel-proveedor`)
  para las dos puertas. Las acciones reciben un `Acceso` en vez de un token.
- **Nada se retiró.** El link mágico sigue andando y `/login` y `/acceso-staff`
  también: esto se suma. Si algo falla, nadie queda afuera.

## 4. El logo del footer

Se dibujaba a **474×22** cuando por su proporción real (716×128) le tocaban
**123×22**: casi 4 veces más ancho, aplastado. Causa: en una columna flex el
`align-items` por defecto es `stretch` y el wordmark no tiene ancho fijo, así que
se estiraba al ancho de la línea de copyright. Pasaba también en `/plataforma`.

## Cómo se verificó

Llamando las funciones reales contra producción, no leyendo el código:

- Las 6 validaciones del alta, la normalización de provincias (recorta, dedupea,
  saca vacíos), y que la reinscripción no pise datos.
- **Permisos**: `anon` y `authenticated` NO pueden ejecutar el alta; el gate
  `is_platform_admin` falla cerrado.
- **El ciclo de moderación**: vidriera 1 → bajar → 0 → resubir → 1.
- **La cadena del proveedor por sesión**: sin perfil → vincular → idempotente la
  segunda vez → el formulario por sesión responde. Todo dentro de una
  transacción revertida.
- **Tres pantallas** (375, 768, 1440): cero desborde, medido, no a ojo.
- El formulario y `/entrar` se sirven **desde el servidor con cero `opacity:0`**:
  no dependen de que corra la animación.

## Trampas que aparecieron

- ⚠️ **El deploy quedó BLOCKED por el AUTOR del commit.** El clon nuevo no tenía
  `user.email` configurado y git usó el de la máquina
  (`fridao@somosder-macbookpro.local`). Vercel bloquea los deploys cuyo autor no
  reconoce, y **ni siquiera llega a compilar**. Las dos únicas veces que pasó en
  toda la historia del repo fueron con ese mail. Se arregla configurando
  `user.email` en el repo, no reescribiendo historia.
- `staff_app_vidriera_buscar` es `STABLE`: dentro de un mismo `SELECT` no ve lo
  que escribió una función volátil de esa misma sentencia. Para probar un ciclo
  hay que ir en sentencias separadas o el test miente.

## Lo que queda

- El **human-check**: que Franco se anote como proveedor de prueba, le llegue el
  mail, y entre por `/entrar` con sus tres cuentas.
- El **selector de perfil adentro** de la app. Hoy "cambiar de perfil" vuelve a
  `/entrar`, que alcanza porque todavía no hay nadie con dos perfiles.
- Borrar el proveedor de prueba **"Proveedor de Prueba (borrar)"**, que está
  despublicado pero sigue en la base. Ahora se puede desde `/plataforma/proveedores`.
