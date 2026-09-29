-- =========================================================================================
-- Migration  : 20260929_051_add_wes_cv_and_deped_clearance_documents.sql
-- Description: Adds binary reference columns for new required and optional documents:
--              1. Documents Portal:
--                 - Accomplished Work Experience Sheet (WES) notarized (wes_binary_id UUID)
--                 - Comprehensive Curriculum Vitae (cv_binary_id UUID)
--              2. Legal Portal:
--                 - Certificate of No Pending Case issued by the DepEd Regional Office (deped_clearance_binary_id UUID)
-- Tables     : third_level_official_masterlist (MODIFY)
--              third_level_officials_profiling_application (MODIFY)
--              tlo_personnel (MODIFY IF EXISTS)
--              tlo_profile (MODIFY IF EXISTS)
-- Safety     : All statements use ADD COLUMN IF NOT EXISTS. Fully safe for multiple runs.
-- Author     : Antigravity
-- Date       : 2026-09-29
-- =========================================================================================

BEGIN;

-- 1. third_level_official_masterlist
ALTER TABLE third_level_official_masterlist
  ADD COLUMN IF NOT EXISTS wes_binary_id UUID,
  ADD COLUMN IF NOT EXISTS cv_binary_id UUID,
  ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;

COMMENT ON COLUMN third_level_official_masterlist.wes_binary_id IS
  'UUID reference to unified_binaries for the Accomplished Work Experience Sheet (WES) notarized.';

COMMENT ON COLUMN third_level_official_masterlist.cv_binary_id IS
  'UUID reference to unified_binaries for the Comprehensive Curriculum Vitae.';

COMMENT ON COLUMN third_level_official_masterlist.deped_clearance_binary_id IS
  'UUID reference to unified_binaries for the Certificate of No Pending Case issued by the DepEd Regional Office.';

-- 2. third_level_officials_profiling_application
ALTER TABLE third_level_officials_profiling_application
  ADD COLUMN IF NOT EXISTS wes_binary_id UUID,
  ADD COLUMN IF NOT EXISTS cv_binary_id UUID,
  ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;

COMMENT ON COLUMN third_level_officials_profiling_application.wes_binary_id IS
  'UUID reference to unified_binaries for the Accomplished Work Experience Sheet (WES) notarized.';

COMMENT ON COLUMN third_level_officials_profiling_application.cv_binary_id IS
  'UUID reference to unified_binaries for the Comprehensive Curriculum Vitae.';

COMMENT ON COLUMN third_level_officials_profiling_application.deped_clearance_binary_id IS
  'UUID reference to unified_binaries for the Certificate of No Pending Case issued by the DepEd Regional Office.';

-- 3. Compatibility update for secondary / auxiliary personnel tables if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_personnel') THEN
        ALTER TABLE tlo_personnel
          ADD COLUMN IF NOT EXISTS wes_binary_id UUID,
          ADD COLUMN IF NOT EXISTS cv_binary_id UUID,
          ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_profile') THEN
        ALTER TABLE tlo_profile
          ADD COLUMN IF NOT EXISTS wes_binary_id UUID,
          ADD COLUMN IF NOT EXISTS cv_binary_id UUID,
          ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;
    END IF;
END $$;

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, execute the following SQL:
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist
--   DROP COLUMN IF EXISTS wes_binary_id,
--   DROP COLUMN IF EXISTS cv_binary_id,
--   DROP COLUMN IF EXISTS deped_clearance_binary_id;
-- ALTER TABLE third_level_officials_profiling_application
--   DROP COLUMN IF EXISTS wes_binary_id,
--   DROP COLUMN IF EXISTS cv_binary_id,
--   DROP COLUMN IF EXISTS deped_clearance_binary_id;
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_personnel') THEN
--         ALTER TABLE tlo_personnel
--           DROP COLUMN IF EXISTS wes_binary_id,
--           DROP COLUMN IF EXISTS cv_binary_id,
--           DROP COLUMN IF EXISTS deped_clearance_binary_id;
--     END IF;
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tlo_profile') THEN
--         ALTER TABLE tlo_profile
--           DROP COLUMN IF EXISTS wes_binary_id,
--           DROP COLUMN IF EXISTS cv_binary_id,
--           DROP COLUMN IF EXISTS deped_clearance_binary_id;
--     END IF;
-- END $$;
-- COMMIT;
-- =========================================================================================
