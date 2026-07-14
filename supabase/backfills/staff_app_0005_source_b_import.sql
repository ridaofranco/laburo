-- staff_app_0005 Source-B import (plan 01-04, DATA-02)
-- One-time same-project migration: the 711 Google-Sheet legacy applicants
-- (transported into staff_app.staging_line by staff_app_0005_source_b_load.sql)
-- are parsed into staff_app.staging_sheet, then deduped/normalized-INSERTed into
-- staff_app.staff_profiles. Nothing is written to HITO's public.* tables.
--
-- Run order:
--   1. migration staff_app_0005_staging_sheet   (creates staff_app.staging_sheet)
--   2. execute: CREATE TABLE staff_app.staging_line(chunk_id int primary key, payload text);
--              ALTER TABLE staff_app.staging_line ENABLE ROW LEVEL SECURITY;
--   3. execute: staff_app_0005_source_b_load.sql (18 chunk INSERTs into staging_line)
--   4. execute: this file
--
-- Delimiters in staging_line.payload: '$' field, '^' oficios sub, '~' row (all
-- verified absent from every value). replace('~', newline) unifies row-splitting.

-- 4a. Parse staging_line -> typed staging_sheet ------------------------------
INSERT INTO staff_app.staging_sheet
  (row_id,nombre,apellido,fecha_nac,documento,email,telefono,provincia,ciudad,oficios,
   experiencia,disponibilidad_finde,movilidad_propia,cv_url,portfolio_url,linkedin_url,
   motivacion,notas_internas,email_lower,row_ts)
SELECT
  (a)[1]::int, (a)[2], nullif((a)[3],''), nullif((a)[4],'')::date, nullif((a)[5],''),
  (a)[6], (a)[7], nullif((a)[8],''), nullif((a)[9],''),
  CASE WHEN (a)[10]='' THEN '{}'::text[] ELSE string_to_array((a)[10],'^') END,
  (a)[11]='t', (a)[12]='t', (a)[13]='t',
  nullif((a)[14],''), nullif((a)[15],''), nullif((a)[16],''), nullif((a)[17],''),
  (a)[18], (a)[19], nullif((a)[20],'')::timestamptz
FROM (
  SELECT string_to_array(l,'$') AS a
  FROM (
    SELECT unnest(string_to_array(replace(payload,'~',E'\n'),E'\n')) AS l
    FROM staff_app.staging_line
  ) t WHERE l <> ''
) s;

-- 4b. Dedup + normalized import staging_sheet -> staff_profiles ---------------
-- DISTINCT ON (lower(email)) keeps the MOST RECENT submission per email
-- (Marca temporal DESC, row_id DESC tiebreak); WHERE ... NOT IN excludes any
-- email already present from Source A (the 8 web_somosder rows). organization_id
-- stamped, source='google_sheet', estado='pendiente'. cv_url stored as-is.
INSERT INTO staff_app.staff_profiles
  (nombre, apellido, fecha_nacimiento, documento, email, telefono, provincia, ciudad,
   oficios, experiencia, disponibilidad_finde, movilidad_propia, cv_url, portfolio_url,
   linkedin_url, motivacion, notas_internas, organization_id, source, estado)
SELECT DISTINCT ON (lower(s.email))
  s.nombre, s.apellido, s.fecha_nac, s.documento, s.email, s.telefono, s.provincia, s.ciudad,
  s.oficios, s.experiencia, s.disponibilidad_finde, s.movilidad_propia, s.cv_url, s.portfolio_url,
  s.linkedin_url, s.motivacion, s.notas_internas,
  'aa29aa2f-4d34-4e53-b62c-7397e8a4d123'::uuid, 'google_sheet', 'pendiente'
FROM staff_app.staging_sheet s
WHERE lower(s.email) NOT IN (SELECT lower(p.email) FROM staff_app.staff_profiles p)
ORDER BY lower(s.email), s.row_ts DESC NULLS LAST, s.row_id DESC;

-- 4c. Verification (actual results recorded in 01-04-SUMMARY.md) --------------
-- SELECT count(*) FROM staff_app.staff_profiles;                         -> 687 (8 + 679)
-- SELECT count(*) FILTER (WHERE organization_id IS NULL) ...             -> 0
-- SELECT email,count(*) ... GROUP BY lower(email) HAVING count(*)>1;     -> 0 rows
-- SELECT source,count(*) ... GROUP BY source;                           -> web_somosder 8 / google_sheet 679
-- SELECT DISTINCT provincia WHERE source='google_sheet';                -> only official jurisdictions + NULL(1: 'Argentina')

-- 4d. Drop transient staging (threat T-01-16: no un-RLS'd raw PII persists) ---
DROP TABLE IF EXISTS staff_app.staging_sheet;
DROP TABLE IF EXISTS staff_app.staging_line;
-- SELECT to_regclass('staff_app.staging_sheet'), to_regclass('staff_app.staging_line'); -> NULL, NULL
