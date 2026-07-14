-- staff_app_0005_staging_sheet
-- Transient staging table for the Source-B (Google-Sheet legacy applicants) load.
-- Holds the raw CSV columns PLUS the deterministically-normalized columns produced
-- by supabase/backfills/staff_app_0005_source_b_gen.py (location/oficios/dates/booleans/
-- name-split), before the normalized INSERT...SELECT into staff_app.staff_profiles.
-- DROPPED after a clean import (see staff_app_0005_source_b_import.sql) so no un-RLS'd
-- copy of applicant PII persists (threat T-01-16).
CREATE TABLE staff_app.staging_sheet (
  row_id                int PRIMARY KEY,
  nombre                text,
  apellido              text,
  fecha_nac             date,
  documento             text,
  email                 text,
  telefono              text,
  provincia             text,
  ciudad                text,
  oficios               text[],
  experiencia           boolean,
  disponibilidad_finde  boolean,
  movilidad_propia      boolean,
  cv_url                text,
  portfolio_url         text,
  linkedin_url          text,
  motivacion            text,
  notas_internas        text,
  email_lower           text,
  row_ts                timestamptz
);

-- Deny-all RLS while the raw PII sits in the table (defense-in-depth; the table is
-- not PostgREST-exposed and is dropped right after import).
ALTER TABLE staff_app.staging_sheet ENABLE ROW LEVEL SECURITY;
