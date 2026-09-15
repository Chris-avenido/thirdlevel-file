-- Migration: 20260915_032_extend_tlo_plantilla_schema.sql
-- Description: Extend tlo_plantilla to store the full set of CFS Plantilla Report fields:
--              region, division, bureau, position_title, permanent_item_no, salary,
--              employment_type, last_name, first_name, middle_name, suffix, prefix, gender.
-- Author: Antigravity
-- Date: 2026-09-15

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add missing report columns to tlo_plantilla
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_plantilla
    ADD COLUMN IF NOT EXISTS region VARCHAR(150),
    ADD COLUMN IF NOT EXISTS division VARCHAR(150),
    ADD COLUMN IF NOT EXISTS bureau VARCHAR(255),
    ADD COLUMN IF NOT EXISTS position_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS salary NUMERIC(12, 2);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Relax NOT NULL constraints on first_name and last_name for vacant items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_plantilla
    ALTER COLUMN first_name DROP NOT NULL,
    ALTER COLUMN last_name DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Relax employment_type constraint for flexible report values
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_plantilla
    DROP CONSTRAINT IF EXISTS chk_tlo_plantilla_employment_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Deduplicate existing permanent_item_no before creating unique index
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY permanent_item_no 
        ORDER BY 
            (SELECT COUNT(*) FROM tlo_assignment a WHERE a.plantilla_id = tlo_plantilla.id) DESC, 
            id ASC
    ) as rn
    FROM tlo_plantilla
    WHERE permanent_item_no IS NOT NULL AND permanent_item_no != ''
)
UPDATE tlo_plantilla
SET permanent_item_no = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Create conditional unique index on permanent_item_no
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_tlo_plantilla_item;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tlo_plantilla_permanent_item_no 
ON tlo_plantilla (permanent_item_no) 
WHERE permanent_item_no IS NOT NULL AND permanent_item_no != '';

-- Additional performance indexes for querying
CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_region_div ON tlo_plantilla (region, division);
CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_bureau ON tlo_plantilla (bureau);
CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_position ON tlo_plantilla (position_title);

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_tlo_plantilla_position;
-- DROP INDEX IF EXISTS idx_tlo_plantilla_bureau;
-- DROP INDEX IF EXISTS idx_tlo_plantilla_region_div;
-- DROP INDEX IF EXISTS idx_tlo_plantilla_permanent_item_no;
-- CREATE INDEX idx_tlo_plantilla_item ON tlo_plantilla(permanent_item_no);
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS salary;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS position_title;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS bureau;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS division;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS region;
-- COMMIT;
-- =============================================================================
