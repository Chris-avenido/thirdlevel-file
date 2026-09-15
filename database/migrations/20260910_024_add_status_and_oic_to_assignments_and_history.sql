-- ============================================================
-- Migration  : 20260910_024
-- Description: Add status ('Active' | 'Inactive') and oic boolean flag to tlo_assignments and tlo_position_history
-- Purpose    : Standardize active/inactive status tracking and Officer-in-Charge (oic)
--              boolean flag across deployment assignments and historical position records.
-- Tables     : tlo_assignments, tlo_position_history
-- Author     : Antigravity
-- Date       : 2026-09-10
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Modify tlo_assignments
-- ─────────────────────────────────────────────────────────────

-- Clean up any prior alias columns if present
ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS oci CASCADE;
ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS is_oic CASCADE;

-- Add single oic boolean flag
ALTER TABLE tlo_assignments
    ADD COLUMN IF NOT EXISTS oic BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill oic flag from assignment_type and designation
UPDATE tlo_assignments
SET oic = TRUE
WHERE (assignment_type ILIKE '%OIC%' OR designation ILIKE '%OIC%')
  AND oic = FALSE;

-- Normalize existing 'Ended' status to 'Inactive'
UPDATE tlo_assignments
SET status = 'Inactive'
WHERE status = 'Ended';

-- Add check constraint to enforce status values (allowing 'Ended' for backward compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_tlo_assignments_status'
    ) THEN
        ALTER TABLE tlo_assignments
            ADD CONSTRAINT chk_tlo_assignments_status
            CHECK (status IN ('Active', 'Inactive', 'Ended'));
    END IF;
END $$;

-- Drop old index if exists and recreate with (status, oic)
DROP INDEX IF EXISTS idx_tlo_assignments_status_oic;
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_status_oic
    ON tlo_assignments (status, oic);


-- ─────────────────────────────────────────────────────────────
-- 2. Modify tlo_position_history
-- ─────────────────────────────────────────────────────────────

-- Add status column (Active or Inactive)
ALTER TABLE tlo_position_history
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Inactive';

-- Add check constraint to enforce 'Active' or 'Inactive'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_tlo_position_history_status'
    ) THEN
        ALTER TABLE tlo_position_history
            ADD CONSTRAINT chk_tlo_position_history_status
            CHECK (status IN ('Active', 'Inactive'));
    END IF;
END $$;

-- Clean up any prior alias columns if present
ALTER TABLE tlo_position_history DROP COLUMN IF EXISTS oci CASCADE;
ALTER TABLE tlo_position_history DROP COLUMN IF EXISTS is_oic CASCADE;

-- Add single oic boolean flag
ALTER TABLE tlo_position_history
    ADD COLUMN IF NOT EXISTS oic BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill oic flag from position_name or oic_positions array
UPDATE tlo_position_history
SET oic = TRUE
WHERE (
    position_name ILIKE '%OIC%' 
    OR (oic_positions IS NOT NULL AND jsonb_typeof(oic_positions) = 'array' AND jsonb_array_length(oic_positions) > 0)
) AND oic = FALSE;

-- Backfill status: if inclusive_date_end is null or >= today, mark Active; otherwise Inactive
UPDATE tlo_position_history
SET status = CASE 
    WHEN inclusive_date_end IS NULL OR inclusive_date_end >= CURRENT_DATE THEN 'Active'
    ELSE 'Inactive'
END;

-- Drop old index if exists and recreate with (status, oic)
DROP INDEX IF EXISTS idx_tlo_pos_status_oic;
CREATE INDEX IF NOT EXISTS idx_tlo_pos_status_oic
    ON tlo_position_history (status, oic);

COMMIT;

-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE tlo_position_history DROP CONSTRAINT IF EXISTS chk_tlo_position_history_status;
-- DROP INDEX IF EXISTS idx_tlo_pos_status_oic;
-- ALTER TABLE tlo_position_history DROP COLUMN IF EXISTS oic;
-- ALTER TABLE tlo_position_history DROP COLUMN IF EXISTS status;
--
-- ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS chk_tlo_assignments_status;
-- DROP INDEX IF EXISTS idx_tlo_assignments_status_oic;
-- ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS oic;
-- COMMIT;
