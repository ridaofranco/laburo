-- staff_app_0004_source_a_backfill  (one-time data migration, run via MCP execute_sql)
--
-- Source A = HITO's existing applicants in public.staff_profiles (the live web-form
-- target BEFORE the 01-03 cutover). Runs AFTER the form cutover (deploy of
-- StaffRegistro.astro's RPC repoint) so public.staff_profiles is FROZEN and
-- "N in = N out" is exact with no delta race (pitfall #5).
--
-- Same-project copy: READS HITO's public.staff_profiles (allowed per D-02/D-03) and
-- writes ONLY into staff_app.staff_profiles. It never writes to HITO's public.* tables.
-- Keeps the original id + cv_url as-is (the CV objects already live in THIS project's
-- staff-cvs bucket — no object copy/move needed), stamps the fixed SOMOS DER
-- organization_id, and preserves source. Dedup key = email (idempotent guard).
--
-- Cutover timestamp (UTC): 2026-07-14T16:50:15Z
-- N captured from public.staff_profiles at cutover: 8
--   (was 7 in the 2026-07-13 research; +1 = the application that arrived 2026-07-14 01:08)
-- Result: 8 rows inserted into staff_app.staff_profiles; N in (8) = N out (8), cv_url intact.

INSERT INTO staff_app.staff_profiles (
  id, created_at, estado, nombre, fecha_nacimiento, documento, email, telefono,
  pais_residencia, provincia, ciudad, donde_trabajar, situacion_legal, oficios,
  oficios_otro, experiencia, anios_experiencia, experiencia_detalle,
  disponibilidad_finde, disponibilidad_viajar, movilidad_propia, cv_url,
  portfolio_url, linkedin_url, motivacion, source, rating, eventos_trabajados,
  notas_internas, disponibilidad_aviso, apellido, organization_id
)
SELECT
  s.id, s.created_at, s.estado, s.nombre, s.fecha_nacimiento, s.documento, s.email, s.telefono,
  s.pais_residencia, s.provincia, s.ciudad, s.donde_trabajar, s.situacion_legal, s.oficios,
  s.oficios_otro, s.experiencia, s.anios_experiencia, s.experiencia_detalle,
  s.disponibilidad_finde, s.disponibilidad_viajar, s.movilidad_propia, s.cv_url,
  s.portfolio_url, s.linkedin_url, s.motivacion, s.source, s.rating, s.eventos_trabajados,
  s.notas_internas, s.disponibilidad_aviso, s.apellido,
  'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'::uuid
FROM public.staff_profiles s
WHERE NOT EXISTS (
  SELECT 1 FROM staff_app.staff_profiles t WHERE t.email = s.email
);

-- Verification (recorded results, all PASS):
--   staffapp_count            = 8   (= N)
--   null_org                  = 0
--   dup_emails                = 0
--   with_cv                   = 8   (= public rows with cv_url)
--   org_stamped               = 8
--   id_email_cv_match         = 8   (every app row matches a source row by id+email+cv_url)
--   source_rows_missing_in_app= 0
