---
slug: 260803-idq-identidad-al-salir-y-contrasena-en-login
fecha: 2026-08-03
status: complete
commit: 04d565e
---

# Identidad al salir, y contraseña en el login del productor

## Qué se arregló

Una productora se registraba, elegía su contraseña, y la app le decía **"esta
cuenta no tiene acceso"**. Cuatro defectos encadenados, todos la misma regla
rota.

| # | Archivo | Antes | Ahora |
|---|---|---|---|
| 1 | `app/definir-contrasena/form.tsx` | `/panel-staff` escrito a mano | `/auth/callback?from=clave` |
| 2 | `app/login/page.tsx` | `/dashboard` para cualquiera con sesión | `/auth/callback?from=login` |
| 3 | `app/login/login-form.tsx` | sin campo de contraseña | entra con clave, o link si la deja vacía |
| 4 | `components/emails/bienvenida-productora.tsx` | mandaba al botón del staff | manda a `/login` con este mail |

Y `signInWithPassword` se mudó de `app/acceso-staff/actions.ts` a
`lib/auth-password.ts`: no tenía una línea específica del staff y ahora la usan
las dos puertas. `acceso-staff` la re-exporta, así que su login no cambia.

## El diagnóstico, medido y no supuesto

`staff_app_provision_member()` **no estaba rota**. Se la llamó simulando la
sesión de la productora y devolvió lo correcto:

```
{"role":"owner","organization_id":"9e2289d1-4f94-431c-837d-fd5e271615e4"}
```

El problema era que **esa función solo corre en `/auth/callback`** y los dos
caminos que usa una productora recién registrada se lo salteaban.

## La regla, para que no vuelva

**Toda pantalla compartida por dos actores tiene que terminar en
`/auth/callback`, nunca en un panel escrito a mano.**

El repo ya la aplicaba bien un archivo al lado, en
`app/acceso-staff/staff-login-form.tsx`, con el comentario *"el ruteo por
identidad lo hace /auth/callback, así que se pasa por ahí en vez de adivinar
acá"*. La pantalla compartida adivinaba.

Es **la tercera vez** que aparece el mismo patrón. La primera quedó escrita en
`lib/auth-link.ts` el 1/8: *"el botón de Google se arregló del lado del staff y
el del productor quedó roto"*. Franco, textual: *"lo que hacés para empleados no
lo hacés para productores"*.

## Verificación

- `npx tsc --noEmit` limpio · `npm run build` limpio.
- `/login` pasó de **0 a 3** menciones de contraseña.
- No queda ningún panel escrito a mano en las pantallas compartidas (la única
  aparición de `/panel-staff` es adentro del comentario que explica el arreglo).

## Lo que queda abierto

- 🔴 **Human-check:** que Franco entre a `laburo.somosder.ar/login` y confirme
  que `somos-der-2` pasa de 0 a 1 miembro. Se repara sola al entrar, no hace
  falta tocar datos.
- 🟡 **`hola@laburo.somosder.ar`**, que aparece en la pantalla de "sin acceso":
  falta confirmar que la casilla exista. Si no existe, el último cartel también
  es una pared.
- 🟡 El mismo barrido en **PASE, ENTRÁ y HITO**, que no se tocaron.

## Lo que se descartó barriendo la app

Para que no se vuelva a barrer lo mismo:

| Chequeo | Resultado |
|---|---|
| Las 63 RPC que llama la app contra las que existen en la base | 0 faltantes |
| RPC llamadas desde el navegador sin permiso de ejecución | 0 (las sin grant van con service-role) |
| Links internos a rutas que no existen | 0 |
| Rutas públicas fuera de `publicPrefixes` (307 mudo) | 0 |
