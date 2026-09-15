-- ============================================================
-- Migration  : 20260913_026
-- Description: Add appointment_status column to third_level_official_masterlist
--              and third_level_officials_profiling_application
-- Purpose    : The CSV "Appointment Status" column (values: Coterminous, Regular)
--              has no existing mapping in the current schema.
--              NOTE: appointment_date (date) already exists and is a separate,
--              distinct field. This new column stores the textual appointment
--              classification (Coterminous vs Regular), NOT a date.
-- Tables     : third_level_official_masterlist (MODIFY)
--              third_level_officials_profiling_application (MODIFY)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-09-13
-- Approved by: User (after READ-ONLY analysis, 2026-09-13)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. third_level_official_masterlist: Add appointment_status column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE third_level_official_masterlist
    ADD COLUMN IF NOT EXISTS appointment_status TEXT;

COMMENT ON COLUMN third_level_official_masterlist.appointment_status IS
    'Classification of the official appointment (e.g., Coterminous, Regular). '
    'Distinct from appointment_date (date field). '
    'Sourced from CSV column "Appointment Status" during bulk import.';

-- ─────────────────────────────────────────────────────────────
-- 2. third_level_officials_profiling_application: mirror column
--    (keeps both tables schema-compatible for profiling workflow)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE third_level_officials_profiling_application
    ADD COLUMN IF NOT EXISTS appointment_status TEXT;

COMMENT ON COLUMN third_level_officials_profiling_application.appointment_status IS
    'Classification of the appointment (e.g., Coterminous, Regular). '
    'Mirrors the column in third_level_official_masterlist.';

COMMIT;


-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE third_level_officials_profiling_application
--     DROP COLUMN IF EXISTS appointment_status;
-- ALTER TABLE third_level_official_masterlist
--     DROP COLUMN IF EXISTS appointment_status;
-- COMMIT;
