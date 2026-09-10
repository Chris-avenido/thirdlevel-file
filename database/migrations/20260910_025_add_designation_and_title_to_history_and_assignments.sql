-- ============================================================
-- Migration  : 20260910_025
-- Description: Add position_title to tlo_assignments, and
--              designation to tlo_position_history.
-- Purpose    : Enable tracking of positional changes from
--              Official Profiling by storing:
--              1. position_title on tlo_assignments
--              2. designation on tlo_position_history
-- Tables     : tlo_assignments, tlo_position_history
-- Author     : Antigravity
-- Date       : 2026-09-10
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. tlo_assignments: Add position_title column
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tlo_assignments
    ADD COLUMN IF NOT EXISTS position_title VARCHAR(255);

-- Backfill from tlo_items (plantilla items) where item_number matches
UPDATE tlo_assignments a
SET position_title = i.position_title
FROM tlo_items i
WHERE a.item_number = i.item_number
  AND a.position_title IS NULL;

-- Index for position_title lookups
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_title
    ON tlo_assignments (position_title);


-- ─────────────────────────────────────────────────────────────
-- 2. tlo_position_history: Add designation column
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tlo_position_history
    ADD COLUMN IF NOT EXISTS designation TEXT;

COMMIT;


-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE tlo_position_history DROP COLUMN IF EXISTS designation;
-- DROP INDEX IF EXISTS idx_tlo_assignments_title;
-- ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS position_title;
-- COMMIT;
