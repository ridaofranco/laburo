---
slug: 260803-prv-alta-abierta-de-proveedores
fecha: 2026-08-03
tipo: quick
status: ejecutado 2026-08-05
---

# Alta abierta de proveedores (que se carguen solos)

**Decisión de Franco (3/8):** *"No voy a cargar proveedores, tiene que estar
listo para que proveedores se carguen solos"*.

## ⚠️ LO PRIMERO: casi todo YA ESTÁ CONSTRUIDO

Verificado contra la base y contra la pantalla el 3/8. En
`/acceso-proveedor/[token]`, **sin cuenta**, el proveedor YA puede:

| | RPC (todas `anon` + `authenticated`) |
|---|---|
| Leer su perfil | `staff_app_proveedor_perfil(token)` |
| Guardar sus datos | `staff_app_proveedor_guardar_perfil(token, …)` |
| Cargar y editar servicios | `staff_app_proveedor_guardar_servicio(token, …)` |
| Borrar un servicio | `staff_app_proveedor_borrar_servicio(token, …)` |
| Armar su formulario de consulta | `staff_app_proveedor_guardar_formulario(token, …)` |
| **Publicarse y despublicarse solo** | `staff_app_proveedor_publicar(token, bool)` |

`staff_app_proveedor_publicar` ya valida completitud (nombre + ≥1 servicio activo
+ ≥1 servicio con provincias) y devuelve **qué falta**, así que no se puede
publicar un perfil vacío.

**Falta UNA sola cosa: la puerta de entrada.** Hoy el token lo genera
`staff_app_generar_link_proveedor`, que es `authenticated` y exige ser writer de
una productora. Y peor: **ningún archivo del repo la llama**, así que hoy no hay
forma de que un proveedor empiece, ni solo ni a mano.

## Las 3 decisiones de Franco (3/8)

1. **Moderación:** aparece en la vidriera **al toque**, sin esperar OK, **pero
   con aviso a Franco** (mail + Telegram) con el link a su perfil, para
   despublicar en un clic si algo no va.
2. **Puertas:** en la vidriera `/servicios` **y** en la landing de LABURO.
3. **Formulario:** ⚠️ **COMPLETO, no la versión corta.** Textual: *"completo,
   todo lo que hace, dónde está, qué servicios, todo junto, como corresponde"*.
   Se le pide todo en el alta y el perfil nace listo para publicarse.

## Tareas

### 1. Migración `staff_app_0060_alta_abierta_de_proveedor.sql`

`public.staff_app_registrar_proveedor(p_nombre, p_email, p_servicios jsonb,
p_telefono, p_headline, p_bio, p_ciudad, p_provincia, p_website, p_instagram)`,
`SECURITY DEFINER`, **granteada SOLO a service_role** (mismo criterio que
`staff_app_crear_productora`: si fuera llamable desde el browser, cualquiera crea
perfiles en loop).

- Valida: nombre, email, **al menos un servicio** con categoría y título, y **al
  menos un servicio con provincias** (sin eso la búsqueda no lo encuentra, o sea
  que se publicaría invisible).
- Normaliza `provincias` igual que `staff_app_proveedor_guardar_servicio`:
  recorta, saca vacíos, dedupe, tope 40.
- Token: `encode(extensions.gen_random_bytes(32),'hex')`, se persiste **solo el
  sha256**, y se devuelve el crudo UNA vez. Copiar el patrón exacto de
  `staff_app_generar_link_proveedor`.
- Si ya existe un perfil `tipo='proveedor'` con ese mail: **regenerar el token y
  devolverlo**, sin pisarle los datos. El caso normal de volver a registrarse es
  "no me llegó el mail". Devolver `ya_existia:true`.
- `is_public = true` al crear (Franco: aparece al toque), porque con el
  formulario completo la completitud está garantizada. `activo = true`.
- **NO crear `profile_org_links`**: el proveedor que se anota solo no cuelga de
  ninguna productora. ✅ Verificado que `staff_app_vidriera_buscar` **no** exige
  vínculo con organización: filtra por `tipo='proveedor' AND activo AND is_public
  AND slug IS NOT NULL` + tener un servicio activo. Aparece igual.
- El `slug` lo pone solo el trigger `marketplace_profiles_slug`.
- Devuelve `{ok, profile_id, slug, token, expires_at, ya_existia}`.
- Reasons: `falta_nombre`, `falta_email`, `falta_servicios`, `falta_provincias`.

**Datos del schema, ya verificados:**
- Clave única: `(lower(email), tipo)` → un mismo mail puede ser `persona` y
  `proveedor` a la vez. No colisiona con el pool de staff.
- `provider_services`: `profile_id, categoria, titulo, descripcion,
  precio_desde, moneda ('ARS'), unidad, provincias text[], activo`.

### 2. Ruta pública `/registrar-proveedor`

Molde exacto: `app/registrar-productora/` (page.tsx + registro-client.tsx +
actions.ts). El server action:

- rate limit por IP y por mail (copiar los tres de `registrar-productora`),
- llama la RPC con `createServiceRoleClient()`,
- manda el **mail de bienvenida con el link mágico**
  (`/acceso-proveedor/<token>`), y
- dispara el **aviso a Franco** con `lib/alerta.ts` (ya existe, lo usa la baja).

⚠️ **Sumar `/registrar-proveedor` a `publicPrefixes`** en
`lib/supabase/middleware.ts` o sale un 307 mudo a `/login`. Es la trampa que ya
mordió a la Fase 4 entera.

### 3. Mail de bienvenida al proveedor

`components/emails/bienvenida-proveedor.tsx`, molde
`bienvenida-productora.tsx`. ⚠️ **Que no prometa nada que la app no haga**: el
proveedor NO tiene cuenta ni contraseña, entra por el link. Es exactamente el
error que costó el 3/8 del lado de la productora.

### 4. Las dos puertas

- **`/servicios`**: un "¿Sos proveedor? Sumate gratis" arriba. Hoy esa pantalla
  dice "estamos armando el directorio", así que el que llega es justo el público.
- **Landing** (`app/page.tsx`): sumarlo a "¿De qué lado del evento estás?", que
  pasa de dos caminos a tres. El link viejo de `/servicios` en el pie puede
  quedarse hasta que haya volumen.

## Cómo se verifica

1. Registrar un proveedor de prueba de punta a punta y **ver que aparece en
   `/servicios`** (hoy hay 0 publicados, así que se nota).
2. Que llegue el mail con el link y que el link abra su panel.
3. Que a Franco le llegue el aviso.
4. Sacar el `noindex` de `/servicios` y meterla en el sitemap **recién cuando
   haya proveedores de verdad**.

## Riesgo a cubrir, ya pasó una vez

Con alta abierta cualquiera se publica. **Ya pasó:** el único proveedor de prueba
tenía una obscenidad en la bio y era el 100% del directorio, visible para
cualquier productora. Por eso el aviso a Franco no es opcional: es el control.
