-- =============================================================================
-- Migration: 20260812_014_convert_notable_achievements_to_jsonb.sql
-- Description: Convert notable_achievements column to JSONB and drop redundant 
--              notable_achievements_year column in third_level_official_masterlist 
--              and third_level_officials_profiling_application tables.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Convert notable_achievements column in third_level_official_masterlist to JSONB
-- -----------------------------------------------------------------------------
ALTER TABLE third_level_official_masterlist
  ALTER COLUMN notable_achievements TYPE JSONB 
  USING CASE
    WHEN notable_achievements IS NULL OR TRIM(notable_achievements::text) = '' THEN '[]'::jsonb
    WHEN notable_achievements::text LIKE '[%' THEN notable_achievements::text::jsonb
    ELSE '[]'::jsonb
  END;

ALTER TABLE third_level_official_masterlist 
  ALTER COLUMN notable_achievements SET DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 2. Convert notable_achievements column in third_level_officials_profiling_application to JSONB
-- -----------------------------------------------------------------------------
ALTER TABLE third_level_officials_profiling_application
  ALTER COLUMN notable_achievements TYPE JSONB 
  USING CASE
    WHEN notable_achievements IS NULL OR TRIM(notable_achievements::text) = '' THEN '[]'::jsonb
    WHEN notable_achievements::text LIKE '[%' THEN notable_achievements::text::jsonb
    ELSE '[]'::jsonb
  END;

ALTER TABLE third_level_officials_profiling_application 
  ALTER COLUMN notable_achievements SET DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 3. Drop redundant notable_achievements_year column from both profile tables
-- -----------------------------------------------------------------------------
ALTER TABLE third_level_official_masterlist DROP COLUMN IF EXISTS notable_achievements_year;
ALTER TABLE third_level_officials_profiling_application DROP COLUMN IF EXISTS notable_achievements_year;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (Run manually if rollback is ever required):
-- =============================================================================
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS notable_achievements_year TEXT;
-- ALTER TABLE third_level_officials_profiling_application ADD COLUMN IF NOT EXISTS notable_achievements_year TEXT;
-- ALTER TABLE third_level_official_masterlist ALTER COLUMN notable_achievements TYPE TEXT USING notable_achievements::text;
-- ALTER TABLE third_level_officials_profiling_application ALTER COLUMN notable_achievements TYPE TEXT USING notable_achievements::text;
-- COMMIT;
