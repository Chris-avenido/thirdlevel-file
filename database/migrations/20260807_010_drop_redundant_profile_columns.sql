-- ============================================================
-- Migration  : 20260807_010
-- Description: Drop redundant JSONB and scalar education columns after relational normalization
-- Purpose    : Remove deprecated columns from masterlist and profiling application tables
--              Data is now maintained strictly in normalized child tables:
--                - tlo_education_records
--                - tlo_eligibility_records
--                - tlo_position_history
--                - tlo_training_records
--                - tlo_accomplishment_records
--                - tlo_other_courses
-- Safety     : All statements use IF EXISTS guards inside a single transaction block.
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-07
-- ============================================================

BEGIN;

-- 1. Drop redundant columns from third_level_official_masterlist
ALTER TABLE third_level_official_masterlist
    DROP COLUMN IF EXISTS education_degrees,
    DROP COLUMN IF EXISTS eligibilities,
    DROP COLUMN IF EXISTS previous_positions,
    DROP COLUMN IF EXISTS relevant_trainings,
    DROP COLUMN IF EXISTS individual_accomplishments,
    DROP COLUMN IF EXISTS other_courses,
    DROP COLUMN IF EXISTS bachelor_degree,
    DROP COLUMN IF EXISTS bachelor_year,
    DROP COLUMN IF EXISTS master_degree,
    DROP COLUMN IF EXISTS master_year,
    DROP COLUMN IF EXISTS doctorate_degree,
    DROP COLUMN IF EXISTS doctorate_year,
    DROP COLUMN IF EXISTS highest_education,
    DROP COLUMN IF EXISTS specific_degree,
    DROP COLUMN IF EXISTS education_program,
    DROP COLUMN IF EXISTS education_year_graduated;

-- 2. Drop redundant columns from third_level_officials_profiling_application
ALTER TABLE third_level_officials_profiling_application
    DROP COLUMN IF EXISTS eligibilities,
    DROP COLUMN IF EXISTS previous_positions,
    DROP COLUMN IF EXISTS relevant_trainings,
    DROP COLUMN IF EXISTS individual_accomplishments,
    DROP COLUMN IF EXISTS other_courses,
    DROP COLUMN IF EXISTS bachelor_degree,
    DROP COLUMN IF EXISTS bachelor_year,
    DROP COLUMN IF EXISTS master_degree,
    DROP COLUMN IF EXISTS master_year,
    DROP COLUMN IF EXISTS doctorate_degree,
    DROP COLUMN IF EXISTS doctorate_year,
    DROP COLUMN IF EXISTS highest_education,
    DROP COLUMN IF EXISTS specific_degree,
    DROP COLUMN IF EXISTS education_program,
    DROP COLUMN IF EXISTS education_year_graduated;

COMMIT;

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================
-- If rollback is required, execute the following script to restore columns:
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist
--     ADD COLUMN IF EXISTS education_degrees JSONB,
--     ADD COLUMN IF EXISTS eligibilities JSONB,
--     ADD COLUMN IF EXISTS previous_positions JSONB,
--     ADD COLUMN IF EXISTS relevant_trainings JSONB,
--     ADD COLUMN IF EXISTS individual_accomplishments JSONB,
--     ADD COLUMN IF EXISTS other_courses JSONB,
--     ADD COLUMN IF EXISTS bachelor_degree TEXT,
--     ADD COLUMN IF EXISTS bachelor_year TEXT,
--     ADD COLUMN IF EXISTS master_degree TEXT,
--     ADD COLUMN IF EXISTS master_year TEXT,
--     ADD COLUMN IF EXISTS doctorate_degree TEXT,
--     ADD COLUMN IF EXISTS doctorate_year TEXT,
--     ADD COLUMN IF EXISTS highest_education TEXT,
--     ADD COLUMN IF EXISTS specific_degree TEXT,
--     ADD COLUMN IF EXISTS education_program TEXT,
--     ADD COLUMN IF EXISTS education_year_graduated INT;
--
-- ALTER TABLE third_level_officials_profiling_application
--     ADD COLUMN IF EXISTS eligibilities JSONB,
--     ADD COLUMN IF EXISTS previous_positions JSONB,
--     ADD COLUMN IF EXISTS relevant_trainings JSONB,
--     ADD COLUMN IF EXISTS individual_accomplishments JSONB,
--     ADD COLUMN IF EXISTS other_courses JSONB,
--     ADD COLUMN IF EXISTS bachelor_degree TEXT,
--     ADD COLUMN IF EXISTS bachelor_year TEXT,
--     ADD COLUMN IF EXISTS master_degree TEXT,
--     ADD COLUMN IF EXISTS master_year TEXT,
--     ADD COLUMN IF EXISTS doctorate_degree TEXT,
--     ADD COLUMN IF EXISTS doctorate_year TEXT,
--     ADD COLUMN IF EXISTS highest_education TEXT,
--     ADD COLUMN IF EXISTS specific_degree TEXT,
--     ADD COLUMN IF EXISTS education_program TEXT,
--     ADD COLUMN IF EXISTS education_year_graduated INT;
-- COMMIT;
