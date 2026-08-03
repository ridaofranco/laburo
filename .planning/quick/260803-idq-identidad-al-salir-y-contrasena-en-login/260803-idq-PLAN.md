---
slug: 260803-idq-identidad-al-salir-y-contrasena-en-login
fecha: 2026-08-03
tipo: quick
---

# Identidad al salir, y contraseña en el login del productor

## El problema, en una frase

**Tres pantallas adivinan a dónde mandar a la persona en vez de preguntarle a
`/auth/callback` quién es**, y una cuarta le promete por mail algo que la app no
sabe hacer. El resultado es que una productora que se registra queda afuera de su
propia cuenta.

## Cómo se descubrió

Franco registró una productora el 3/8 a las 8:47 y no pudo entrar. Medido contra
producción:

| Organización | Creada | Miembros | Invitación |
|---|---|---|---|
| `somos-der-2` | 2026-08-03 11:47 UTC | **0** | fraannqiitoo@gmail.com, rol `owner` |

`staff_app_provision_member()` **funciona**: se la llamó simulando esa sesión y
devuelve `{"role":"owner","organization_id":"9e2289d1..."}`. El problema no es la
función, es que **nadie la llama** en ese camino.

## Los cuatro defectos

1. **`app/definir-contrasena/form.tsx:44`** manda a `/panel-staff` escrito a
   mano. Esa pantalla la comparten el staff (`/sumate`) y la productora
   (`/registrar-productora`), pero la salida está escrita para uno solo. La
   productora cae en el panel de los empleados y, como `provision_member` solo
   corre en `/auth/callback`, nunca se vuelve dueña de su productora.

2. **`app/login/page.tsx:12`** manda a `/dashboard` a cualquiera con sesión, sin
   mirar identidad. Un empleado logueado que entra a `/login` termina en
   "Esta cuenta no tiene acceso".

3. **`/login` no tiene campo de contraseña.** Cero menciones de "contraseña" en
   la pantalla: solo Google y magic link. `signInWithPassword` existe únicamente
   del lado del staff.

4. **El mail de bienvenida promete lo que no existe:** *"después entrás siempre
   con este mismo mail y esa clave"* y *"creá tu contraseña con el botón que dice
   que es tu primera vez"*. Ese botón vive en `/acceso-staff`, la puerta del
   staff.

## La regla que quedó rota

El propio repo ya la aplica bien en `app/acceso-staff/staff-login-form.tsx:180`:

```js
// El ruteo por identidad lo hace /auth/callback,
// así que se pasa por ahí en vez de adivinar acá.
window.location.href = "/auth/callback?from=password";
```

**Toda pantalla compartida por dos actores tiene que terminar en
`/auth/callback`, nunca en un panel escrito a mano.** Los cuatro defectos son la
misma regla rota, y es la tercera vez que aparece el mismo patrón (ver el
comentario del 1/8 en `lib/auth-link.ts`: *"lo que hacés para empleados no lo
hacés para productores"*).

## Tareas

1. `lib/auth-password.ts` (nuevo): mover ahí `signInWithPassword`, que hoy vive
   en `app/acceso-staff/actions.ts` y no tiene nada de específico del staff.
   `acceso-staff` pasa a re-exportarla. **Se comparte en vez de copiarse**, que
   es justo la lección que dejó escrita `auth-link.ts`.
2. `app/login/login-form.tsx`: sumar el campo de contraseña. Con contraseña
   escrita entra con ella; vacío, sigue mandando el magic link como hasta hoy.
   La salida es `/auth/callback?from=password`.
3. `app/login/page.tsx`: `/dashboard` → `/auth/callback`.
4. `app/definir-contrasena/form.tsx`: `/panel-staff` → `/auth/callback`.
5. `components/emails/bienvenida-productora.tsx`: que el texto alternativo
   apunte a la puerta correcta.

## Cómo se verifica

- `npx tsc --noEmit` y `npm run build` limpios.
- Contra producción: que `somos-der-2` pase de 0 a 1 miembro cuando Franco entre.
- Que `/login` tenga campo de contraseña (hoy: 0 menciones).

## Lo que NO entra acá

- La productora huérfana se repara sola cuando Franco entre por `/login` con el
  arreglo puesto (`/auth/callback` corre `provision_member`). No hace falta tocar
  datos a mano.
- `hola@laburo.somosder.ar`, que aparece en la pantalla de "sin acceso": falta
  confirmar que la casilla exista. Es de Franco.
- El barrido equivalente en PASE, ENTRÁ y HITO.
