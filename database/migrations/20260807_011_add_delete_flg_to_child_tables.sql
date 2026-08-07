-- ============================================================
-- Migration: 20260807_011_add_delete_flg_to_child_tables.sql
-- Purpose  : Add soft-delete flag (delete_flg) to all 5 child
--            relational tables that have user-facing delete buttons.
--            Records are never physically deleted; they are hidden
--            by setting delete_flg = 'Yes'.
-- Tables   : tlo_accomplishment_records
--            tlo_eligibility_records
--            tlo_position_history
--            tlo_training_records
--            tlo_other_courses
-- Rollback : See bottom of file
-- ============================================================

BEGIN;

-- ── tlo_accomplishment_records ──────────────────────────────
ALTER TABLE tlo_accomplishment_records
  ADD COLUMN IF NOT EXISTS delete_flg VARCHAR(3) NOT NULL DEFAULT 'No'
    CHECK (delete_flg IN ('Yes', 'No'));

COMMENT ON COLUMN tlo_accomplishment_records.delete_flg IS
  'Soft-delete flag. No = active record. Yes = logically deleted.';

CREATE INDEX IF NOT EXISTS idx_accomplishment_delete_flg
  ON tlo_accomplishment_records (delete_flg);

-- ── tlo_eligibility_records ─────────────────────────────────
ALTER TABLE tlo_eligibility_records
  ADD COLUMN IF NOT EXISTS delete_flg VARCHAR(3) NOT NULL DEFAULT 'No'
    CHECK (delete_flg IN ('Yes', 'No'));

COMMENT ON COLUMN tlo_eligibility_records.delete_flg IS
  'Soft-delete flag. No = active record. Yes = logically deleted.';

CREATE INDEX IF NOT EXISTS idx_eligibility_delete_flg
  ON tlo_eligibility_records (delete_flg);

-- ── tlo_position_history ────────────────────────────────────
ALTER TABLE tlo_position_history
  ADD COLUMN IF NOT EXISTS delete_flg VARCHAR(3) NOT NULL DEFAULT 'No'
    CHECK (delete_flg IN ('Yes', 'No'));

COMMENT ON COLUMN tlo_position_history.delete_flg IS
  'Soft-delete flag. No = active record. Yes = logically deleted.';

CREATE INDEX IF NOT EXISTS idx_position_history_delete_flg
  ON tlo_position_history (delete_flg);

-- ── tlo_training_records ────────────────────────────────────
ALTER TABLE tlo_training_records
  ADD COLUMN IF NOT EXISTS delete_flg VARCHAR(3) NOT NULL DEFAULT 'No'
    CHECK (delete_flg IN ('Yes', 'No'));

COMMENT ON COLUMN tlo_training_records.delete_flg IS
  'Soft-delete flag. No = active record. Yes = logically deleted.';

CREATE INDEX IF NOT EXISTS idx_training_delete_flg
  ON tlo_training_records (delete_flg);

-- ── tlo_other_courses ───────────────────────────────────────
ALTER TABLE tlo_other_courses
  ADD COLUMN IF NOT EXISTS delete_flg VARCHAR(3) NOT NULL DEFAULT 'No'
    CHECK (delete_flg IN ('Yes', 'No'));

COMMENT ON COLUMN tlo_other_courses.delete_flg IS
  'Soft-delete flag. No = active record. Yes = logically deleted.';

CREATE INDEX IF NOT EXISTS idx_other_courses_delete_flg
  ON tlo_other_courses (delete_flg);

COMMIT;

-- ============================================================
-- ROLLBACK SCRIPT (run only if you need to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE tlo_accomplishment_records DROP COLUMN IF EXISTS delete_flg;
-- ALTER TABLE tlo_eligibility_records    DROP COLUMN IF EXISTS delete_flg;
-- ALTER TABLE tlo_position_history       DROP COLUMN IF EXISTS delete_flg;
-- ALTER TABLE tlo_training_records       DROP COLUMN IF EXISTS delete_flg;
-- ALTER TABLE tlo_other_courses          DROP COLUMN IF EXISTS delete_flg;
-- COMMIT;
