-- =========================================================================================
-- Migration: 20260915_036_add_location_columns_to_tlo_positions_and_plantilla_fk.sql
-- Description: 
--   1. Expands tlo_positions table to include region, division, and bureau location columns.
--   2. Drops the unique constraint on position_title to allow multiple available position slots.
--   3. Adds position_id foreign key column to tlo_plantilla table referencing tlo_positions(id).
--   4. Creates supporting indexes for high-performance location and relationship queries.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs with IF NOT EXISTS / IF EXISTS.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Drop the legacy unique constraint on position_title in tlo_positions
ALTER TABLE tlo_positions
DROP CONSTRAINT IF EXISTS tlo_positions_position_title_key;

DROP INDEX IF EXISTS idx_tlo_positions_title_unique;

-- 2. Add location columns to tlo_positions
ALTER TABLE tlo_positions
ADD COLUMN IF NOT EXISTS region VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS division VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS bureau VARCHAR(255) NULL;

-- 3. Create indexes on tlo_positions location columns
CREATE INDEX IF NOT EXISTS idx_tlo_positions_region ON tlo_positions (region);
CREATE INDEX IF NOT EXISTS idx_tlo_positions_division ON tlo_positions (division);
CREATE INDEX IF NOT EXISTS idx_tlo_positions_bureau ON tlo_positions (bureau);

-- 4. Add position_id foreign key column to tlo_plantilla to directly link personnel to their available position slot
ALTER TABLE tlo_plantilla
ADD COLUMN IF NOT EXISTS position_id INTEGER NULL;

-- 5. Add foreign key constraint on tlo_plantilla referencing tlo_positions(id)
ALTER TABLE tlo_plantilla
DROP CONSTRAINT IF EXISTS fk_plantilla_position;

ALTER TABLE tlo_plantilla
ADD CONSTRAINT fk_plantilla_position
FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_position_id ON tlo_plantilla (position_id);

COMMIT;

-- =========================================================================================
-- ROLLBACK SCRIPT:
-- -----------------------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE tlo_plantilla DROP CONSTRAINT IF EXISTS fk_plantilla_position;
-- DROP INDEX IF EXISTS idx_tlo_plantilla_position_id;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS position_id;
-- DROP INDEX IF EXISTS idx_tlo_positions_bureau;
-- DROP INDEX IF EXISTS idx_tlo_positions_division;
-- DROP INDEX IF EXISTS idx_tlo_positions_region;
-- ALTER TABLE tlo_positions DROP COLUMN IF EXISTS bureau;
-- ALTER TABLE tlo_positions DROP COLUMN IF EXISTS division;
-- ALTER TABLE tlo_positions DROP COLUMN IF EXISTS region;
-- COMMIT;
-- =========================================================================================
