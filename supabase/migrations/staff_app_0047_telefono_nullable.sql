-- staff_app_0047_telefono_nullable
-- LA 0046 SOLA NO ALCANZABA: la columna tambien exigia el telefono.
--
-- ── POR QUE EXISTE ESTA MIGRACION ────────────────────────────────────────────
--
-- La 0046 saco el check `telefono es obligatorio` de adentro del RPC, y con eso
-- se dio por cerrado el bug que reporto Alexandra el 1/8/2026. No estaba
-- cerrado: la columna staff_app.staff_profiles.telefono sigue siendo NOT NULL
-- desde la 0001, asi que el alta sin telefono seguia muriendo, ahora con un
-- 23502 (not-null violation) en vez del check_violation.
--
-- Para la persona el resultado era IDENTICO: "No se pudo enviar el registro.
-- Proba de nuevo." O sea el fix parecia aplicado y el producto seguia roto.
--
-- Verificado llamando al RPC real contra produccion, no leyendo el codigo:
--   select public.staff_app_register_applicant(p_nombre => 'x', p_email => 'y');
-- Antes de esta migracion: ERROR 23502 en la columna telefono.
-- Despues: {"ok": true, "id": ...}.
--
-- LECCION: una regla de "obligatorio" puede vivir en TRES capas (la UI, el RPC
-- y la constraint de la tabla). Sacarla de una sola no cambia nada de cara a la
-- persona. Cuando se relaja un obligatorio, hay que probar el alta de verdad.
--
-- ── EL CAMBIO ────────────────────────────────────────────────────────────────
--
-- El telefono pasa a ser opcional tambien en la tabla. Las fichas que ya lo
-- tienen no se tocan (DROP NOT NULL no reescribe filas). La app ya lo lee como
-- `string | null` (lib/staff.ts), asi que no hay lectura que asuma lo
-- contrario. El camino para conseguir el dato que falta es el recordatorio de
-- perfil de la 0034, no reventar el alta.

ALTER TABLE staff_app.staff_profiles ALTER COLUMN telefono DROP NOT NULL;

COMMENT ON COLUMN staff_app.staff_profiles.telefono IS
  'Telefono de contacto. OPCIONAL desde la 0047: el registro corto con CV no lo puede garantizar (una foto sin telefono) y el NOT NULL volteaba altas reales. Se pide despues con el recordatorio de perfil.';
