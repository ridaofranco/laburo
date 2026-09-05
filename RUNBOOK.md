# Runbook

Qué hacer cuando algo falla. Una página, sin teoría.

**Antes que nada:** casi todo lo que se rompe en LABURO es una de tres cosas —
un mail que no salió, alguien que no puede entrar, o algo publicado que no
debería estar. En ese orden de frecuencia.

---

## 1. "No me llegó el mail"

Pasa seguido y **casi nunca es la app**.

**Primero, separá dos cosas:** que la acción se haya guardado y que el mail haya
salido son **independientes**. La cuenta, la oferta o el alta existen aunque el
mail falle, y las pantallas están escritas para decirlo así.

**Cómo saber si salió:**

```sql
-- Altas de staff: bienvenida_enviada_at se estampa DESPUES de confirmar el envio.
SELECT nombre, email, created_at, bienvenida_enviada_at
FROM staff_app.staff_profiles
ORDER BY created_at DESC LIMIT 20;

-- Consultas a proveedores: email_enviado_at, misma logica.
SELECT id, email_contacto, created_at, email_enviado_at
FROM staff_app.provider_contacts
ORDER BY created_at DESC LIMIT 20;
```

- **Tiene fecha** → el mail salió de acá. Que la persona mire **spam y
  papelera**, en ese orden. Si igual no está, el problema es del lado del
  destinatario.
- **Está en `NULL`** → no salió. Casi siempre es el SMTP: revisá las variables
  `SMTP_*` en Vercel, y que la casilla no esté bloqueada por el proveedor.

⚠️ **Lo que NO hay que hacer:** volver a crear el registro para "reintentar el
mail". Duplica el dato y no arregla el correo.

⚠️ Para las ofertas de staff, `delivered_at` **no sirve**: en este ecosistema esa
columna queda siempre en `NULL`. La verdad de qué se entregó está en el
proveedor de correo, no en la base.

---

## 2. "No puedo entrar"

Preguntá **quién** es, porque hay tres puertas distintas:

| Quién | Entra por | Qué revisar |
|---|---|---|
| **Productora** | `/entrar` con contraseña | Que sea miembro de una organización (ver abajo) |
| **Staff** | `/acceso-staff`, con su mail | ⚠️ **El mail tiene que ser el MISMO de su ficha** |
| **Proveedor o salón** | Link mágico, nunca contraseña | Que el token no haya vencido |

**El caso más común y el más confuso:** alguien entra y ve *"Esta cuenta no
tiene acceso"* o un panel vacío.

```sql
-- ¿Es miembro de alguna organizacion?
SELECT u.email, o.name AS organizacion, m.role
FROM auth.users u
LEFT JOIN staff_app.members m ON m.user_id = u.id
LEFT JOIN staff_app.organizations o ON o.id = m.organization_id
WHERE lower(u.email) = lower('EL_MAIL');
```

- **Sin filas de `members`** → la cuenta existe pero no pertenece a ninguna
  organización. Se arregla con un `INSERT` en `staff_app.members`, o dándole una
  invitación en `member_invites` para que se auto-provisione al entrar.
- ⚠️ **Un mail no puede estar invitado a dos organizaciones**: el índice único es
  sobre el mail en toda la tabla. Si ya tiene invitación en otra, va `INSERT`
  directo en `members`.

**Si es staff y "no ve nada suyo":** casi seguro se anotó con un mail y entra con
otro. La ficha existe, la cuenta existe, y nada las une porque se unen **por
mail**. Se arregla **corrigiendo el mail de la ficha**, no relajando el gate:

```sql
UPDATE staff_app.staff_profiles
   SET email = lower('EL_MAIL_CON_EL_QUE_ENTRA')
 WHERE id = 'ID_DE_LA_FICHA';   -- ⚠️ por id, nunca por patron
```

---

## 3. "Hay que bajar algo publicado"

Un proveedor, un salón o una búsqueda que no debería estar a la vista.

**Se hace desde `/plataforma`**, no por SQL: el motivo es obligatorio y queda
registrado, y esa es la diferencia entre bajar algo y una pelea dos días
después.

1. Entrar a `/plataforma`.
2. Buscar la publicación en la sección que corresponda (los proveedores se
   moderan en `/plataforma/proveedores`, aparte).
3. Bajar, **con motivo**. Sin motivo la función lo rechaza a propósito.

Se puede volver a subir desde la misma pantalla.

---

## 4. "Entré a la cuenta de una productora y quiero ver el registro"

No hay pantalla, a propósito. Se lee así:

```sql
SELECT l.iniciada_at, l.terminada_at, o.name AS organizacion, l.motivo, u.email AS quien
FROM staff_app.impersonation_log l
JOIN staff_app.organizations o ON o.id = l.organization_id
LEFT JOIN auth.users u ON u.id = l.actor_user_id
ORDER BY l.iniciada_at DESC;
```

⚠️ Una sesión **vence sola a los 60 minutos**, aunque quede con `terminada_at` en
`NULL`. Una fila abierta y vieja no significa que alguien siga adentro.

---

## 5. "La app no carga" / "todo tira error"

En orden, y sin saltear pasos:

1. **¿Es solo tuyo o es de todos?** Probá en otro dispositivo o en incógnito.
2. **Mirá el deploy en Vercel.** Si el último falló, la versión anterior sigue
   sirviendo: el problema es otro.
3. **Mirá si Supabase está arriba.** Si la base no responde, no hay nada que
   tocar del lado de la app.
4. **¿Salió una migración recién?** El orden correcto es **migración primero,
   deploy después**. Si se hizo al revés, aplicar la migración que falta
   normalmente arregla todo.

⚠️ **No hagas rollback del deploy si el problema es la base.** Vas a tener la
versión vieja contra una base nueva, que es peor.

---

## 6. Los interruptores, y qué apagan

| Variable | Si falta o está apagada |
|---|---|
| `SMTP_*` | No sale ningún mail. Todo lo demás anda |
| `BIENVENIDA_BATCH` | No se manda la bienvenida a las fichas del pool |
| `TELEGRAM_CHAT_ID` / `MAIL_ADMIN_TO` | No llegan los avisos internos de altas nuevas |
| `MP_ACCESS_TOKEN` | El cobro corta antes de empezar — **hoy da igual: el cobro está apagado por bandera** |
| `LABURO_DEV_BYPASS` | Solo local. En producción `/dev-login` devuelve 404 siempre |

El cobro se prende y se apaga en **`lib/cobros.ts`**, en un solo lugar. Para
prenderlo de verdad hace falta además lo que dice `COBROS.md`.

---

## 7. Antes de tocar la base, siempre

1. **`SELECT` antes del `UPDATE` o el `DELETE`**, para ver exactamente qué filas
   van a cambiar.
2. **`WHERE` acotado.** Por `id` o por `slug`, nunca por patrón.
3. **Si dudás, `BEGIN; … ROLLBACK;`** y mirá los conteos.
4. ⚠️ **Borrar una organización se lleva en cascada** sus miembros,
   invitaciones, eventos, ofertas y su registro de auditoría. Lo único que **no**
   cascadea son las fichas de staff, y por eso el borrado falla si quedó alguna
   vinculada. El orden correcto está en [`PRUEBAS.md`](./PRUEBAS.md), sección 4.

---

## 8. A quién avisar

Este producto lo mantiene una sola persona. Si algo se rompe y no está acá, el
camino es: mirar los logs de Vercel, mirar los de Supabase, y revisar el último
deploy y la última migración aplicada.

**Documentación relacionada:** [`ACTORES.md`](./ACTORES.md) (quién es quién),
[`PRUEBAS.md`](./PRUEBAS.md) (cómo probar sin romper), `COBROS.md` (el cobro).
