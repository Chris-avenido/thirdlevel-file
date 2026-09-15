-- =========================================================================================
-- Migration: 20260915_037_create_tlo_masterlist_view.sql
-- Description:
--   Creates a transparent, updatable view 'tlo_masterlist' aliasing the core
--   'third_level_official_masterlist' table. This ensures full backward and
--   forward compatibility for endpoints, reports, and scripts referencing either name.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Create or replace the view tlo_masterlist aliasing third_level_official_masterlist
CREATE OR REPLACE VIEW tlo_masterlist AS
SELECT * FROM third_level_official_masterlist;

COMMENT ON VIEW tlo_masterlist IS 'Compatibility view aliasing third_level_official_masterlist for TLO masterlist access';

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL command:
-- DROP VIEW IF EXISTS tlo_masterlist;
-- =========================================================================================
