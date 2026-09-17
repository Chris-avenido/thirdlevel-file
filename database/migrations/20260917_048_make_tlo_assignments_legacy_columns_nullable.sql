-- =========================================================================================
-- Migration: 20260917_048_make_tlo_assignments_legacy_columns_nullable.sql
-- Description:
--   Removes the legacy NOT NULL constraint on 'personnel_id' in table 'public.tlo_assignments'.
--   Under the modern position assignment architecture, assignments are linked via
--   'tlo_masterlist_id' (INT) and 'position_id' (INT). The legacy 'personnel_id' (UUID) column
--   from earlier schemas prevented new position assignment insertions with error:
--   'null value in column "personnel_id" violates not-null constraint' (SQLSTATE 23502).
--
-- Safety & Rollback:
--   - Wrapped in a transaction block (BEGIN / COMMIT).
--   - Non-destructive: does not delete or alter any existing assignment data.
--   - Rollback instructions provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Drop NOT NULL constraint on legacy personnel_id column
ALTER TABLE public.tlo_assignments 
    ALTER COLUMN personnel_id DROP NOT NULL;

COMMENT ON COLUMN public.tlo_assignments.personnel_id IS 'Legacy UUID personnel reference (optional; modern architecture uses tlo_masterlist_id)';

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- In case of rollback, execute the following SQL block:
-- BEGIN;
-- -- Note: Before setting NOT NULL, ensure all rows have a non-null personnel_id
-- -- ALTER TABLE public.tlo_assignments ALTER COLUMN personnel_id SET NOT NULL;
-- COMMIT;
-- =========================================================================================
