-- Migration: staff_app_0029_profiles_cv_data
-- Project: luillpzfqzbpoqkgvjuw (el Supabase compartido con HITO y PASE)
-- APLICAR A MANO en el SQL editor, DESPUÉS de la 0026 (que también reemplaza esta
-- misma vista). Aditiva: una columna más al final de la vista, nada más.
--
-- ══ PARA QUÉ ══
-- En julio se extrajeron 660 CVs con Gemini a la columna `cv_data`, con este
-- objetivo escrito en la 0024: "modelo broker: guardamos formación/experiencia; el
-- contacto NO va acá". La extracción se hizo, los datos están, y **el último paso
-- nunca se construyó**: la app jamás leyó esa columna. Hasta hoy `/staff/[id]`
-- mostraba el PDF que la persona subió a Drive, con su teléfono y su mail a la
-- vista adentro del archivo. O sea: se pagó el trabajo de estructurar 660 CVs y se
-- siguió mostrando el PDF crudo.
--
-- Esta migración es lo único que falta del lado de la base: exponer `cv_data` a la
-- vista de lectura para que la pantalla pueda renderizar la ficha.
--
-- ══ ⚠️ REGLA DE ESTA VISTA (leer antes de tocarla) ══
-- `CREATE OR REPLACE VIEW` NO permite quitar ni reordenar columnas. Cada columna
-- nueva va SIEMPRE AL FINAL y las anteriores se copian tal cual. El orden
-- acumulado hasta acá es: 0007 (26) → 0015 agregó documento y fecha_nacimiento
-- (28) → 0026 agregó el filtro de baja → 0029 agrega cv_data (29).
-- Si alguna vez esta lista se escribe "de memoria" y queda corta, la migración
-- falla con un error y la vista queda sin reemplazar.

CREATE OR REPLACE VIEW public.staff_app_profiles WITH (security_invoker = true) AS
  SELECT id, nombre, apellido, oficios, oficios_otro, provincia, ciudad,
         experiencia, anios_experiencia, eventos_trabajados, experiencia_detalle,
         disponibilidad_finde, disponibilidad_viajar, movilidad_propia, disponibilidad_aviso,
         estado, cv_url, portfolio_url, linkedin_url, telefono, email,
         situacion_legal, donde_trabajar, pais_residencia, motivacion, organization_id,
         documento, fecha_nacimiento,
         cv_data
  FROM staff_app.staff_profiles
  WHERE baja_at IS NULL;

-- WR-05: el REPLACE re-aplica los default privileges del schema public, así que hay
-- que volver a cerrarle la puerta a anon. La vista tiene PII (mail, teléfono, DNI).
GRANT SELECT ON public.staff_app_profiles TO authenticated;
REVOKE ALL ON public.staff_app_profiles FROM anon;

COMMENT ON VIEW public.staff_app_profiles IS
  'Superficie de búsqueda y perfil del pool (security_invoker: RLS de la tabla base scopea por org). Excluye a quien pidió la baja (0026). Desde 0029 incluye cv_data, la ficha estructurada que extrajo Gemini de los 660 CVs: es lo que permite mostrar la experiencia y la formación escritas en la pantalla, en vez del PDF original con el contacto a la vista. authenticated SELECT, anon revocado.';
