-- =========================================================================================
-- Migration  : 20260930_052_add_is_applying_for_position_column.sql
-- Description: Adds is_applying_for_position boolean toggle column:
--              1. Legal Portal:
--                 - When TRUE (Applying for a Position): Clearance documents (Ombudsman, Sandiganbayan, CSC, NBI, DepEd RO, and conditional Executive Summary) are enabled.
--                 - When FALSE (Not Applying for a Position): Other clearance documents are removed for profile maintenance.
-- Tables     : third_level_official_masterlist (MODIFY)
--              third_level_officials_profiling_application (MODIFY)
--              tlo_personnel (MODIFY IF EXISTS)
--              tlo_profile (MODIFY IF EXISTS)
-- Safety     : All statements use ADD COLUMN IF NOT EXISTS. Fully safe for multiple runs.
-- Author     : Antigravity
-- Date       : 2026-09-30
-- =========================================================================================

BEGIN;

-- 1. third_level_official_masterlist
ALTER TABLE third_level_official_masterlist
  ADD COLUMN IF NOT EXISTS is_applying_for_position BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN third_level_official_masterlist.is_applying_for_position IS
  'Indicates whether the official is currently applying for a position (TRUE) or undergoing general profile maintenance (FALSE).';

-- 2. third_level_officials_profiling_application
ALTER TABLE third_level_officials_profiling_application
  ADD COLUMN IF NOT EXISTS is_applying_for_position BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN third_level_officials_profiling_application.is_applying_for_position IS
  'Indicates whether the applicant is applying for a position (TRUE) or undergoing general profiling (FALSE).';

-- 3. Compatibility update for secondary / auxiliary personnel tables if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_personnel') THEN
        ALTER TABLE tlo_personnel
          ADD COLUMN IF NOT EXISTS is_applying_for_position BOOLEAN DEFAULT FALSE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_profile') THEN
        ALTER TABLE tlo_profile
          ADD COLUMN IF NOT EXISTS is_applying_for_position BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, execute the following SQL:
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist
--   DROP COLUMN IF EXISTS is_applying_for_position;
-- ALTER TABLE third_level_officials_profiling_application
--   DROP COLUMN IF EXISTS is_applying_for_position;
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_personnel') THEN
--         ALTER TABLE tlo_personnel
--           DROP COLUMN IF EXISTS is_applying_for_position;
--     END IF;
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_profile') THEN
--         ALTER TABLE tlo_profile
--           DROP COLUMN IF EXISTS is_applying_for_position;
--     END IF;
-- END $$;
-- COMMIT;
-- =========================================================================================
