-- =============================================================================
-- Migration: 20260915_040_connect_tlo_assignment_to_masterlist_and_detach_plantilla.sql
-- Description:
--   1. Connects tlo_assignment (singular) directly to canonical tlo_masterlist(id)
--      via foreign key tlo_masterlist_id INT REFERENCES tlo_masterlist(id).
--   2. Backfills tlo_masterlist_id across all assignment records from tlo_assignments
--      and tlo_masterlist with strict zero-orphan assertion.
--   3. Detaches tlo_plantilla from tlo_assignment completely by dropping all
--      inbound foreign key constraints (tlo_assignment_plantilla_id_fkey and
--      fk_assignment_plantilla) and associated indexes.
--   4. Updates the check constraint chk_tlo_assignment_vacant_null to check
--      tlo_masterlist_id IS NULL for VACANT positions.
--   5. Creates performance index on tlo_assignment(tlo_masterlist_id).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Safety Backup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignment_backup_schema_refactor AS
SELECT * FROM tlo_assignment;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add tlo_masterlist_id to tlo_assignment
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment 
    ADD COLUMN IF NOT EXISTS tlo_masterlist_id INTEGER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill tlo_masterlist_id from verified tlo_assignments ledger
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE tlo_assignment a
SET tlo_masterlist_id = asg.tlo_masterlist_id
FROM tlo_assignments asg
WHERE a.id = asg.id;

-- Fallback backfill matching by item_number / masterlist if any still null and not vacant
UPDATE tlo_assignment a
SET tlo_masterlist_id = m.id
FROM third_level_official_masterlist tlm, tlo_masterlist m
WHERE a.plantilla_item_no = tlm.plantilla_item_no
  AND tlm."TLOid" = m.tloid
  AND a.tlo_masterlist_id IS NULL
  AND a.status <> 'VACANT';

-- Fallback backfill matching by name from tlo_plantilla if any still null and not vacant
UPDATE tlo_assignment a
SET tlo_masterlist_id = m.id
FROM tlo_plantilla p, tlo_masterlist m
WHERE a.plantilla_id = p.id
  AND a.tlo_masterlist_id IS NULL
  AND a.status <> 'VACANT'
  AND LOWER(TRIM(COALESCE(p.last_name, ''))) = LOWER(TRIM(COALESCE(m.last_name, '')))
  AND LOWER(TRIM(COALESCE(p.first_name, ''))) = LOWER(TRIM(COALESCE(m.first_name, '')));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Integrity Assertion: Verify 0 Non-Vacant Assignments Without Masterlist
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    unmapped_count INT;
BEGIN
    SELECT COUNT(*) INTO unmapped_count 
    FROM tlo_assignment 
    WHERE tlo_masterlist_id IS NULL 
      AND status <> 'VACANT';

    IF unmapped_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % non-vacant tlo_assignment records without a matching masterlist row.', unmapped_count;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Establish Foreign Key from tlo_assignment to tlo_masterlist
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS tlo_assignment_tlo_masterlist_id_fkey;

ALTER TABLE tlo_assignment
    ADD CONSTRAINT tlo_assignment_tlo_masterlist_id_fkey
    FOREIGN KEY (tlo_masterlist_id) REFERENCES tlo_masterlist(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Detach tlo_plantilla: Drop Foreign Keys to tlo_plantilla
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS tlo_assignment_plantilla_id_fkey;
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS fk_assignment_plantilla;
DROP INDEX IF EXISTS idx_tlo_assignment_plantilla;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Update Check Constraint for Vacancy
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS chk_tlo_assignment_vacant_null;

ALTER TABLE tlo_assignment
    ADD CONSTRAINT chk_tlo_assignment_vacant_null
    CHECK ((status <> 'VACANT') OR (tlo_masterlist_id IS NULL));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Performance Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_masterlist ON tlo_assignment(tlo_masterlist_id);

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- In the event of a rollback, execute the following SQL block:
-- BEGIN;
-- ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS tlo_assignment_tlo_masterlist_id_fkey;
-- ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS chk_tlo_assignment_vacant_null;
-- DROP INDEX IF EXISTS idx_tlo_assignment_masterlist;
-- ALTER TABLE tlo_assignment DROP COLUMN IF EXISTS tlo_masterlist_id;
-- ALTER TABLE tlo_assignment ADD CONSTRAINT tlo_assignment_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES tlo_plantilla(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignment ADD CONSTRAINT fk_assignment_plantilla FOREIGN KEY (plantilla_id) REFERENCES tlo_plantilla(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignment ADD CONSTRAINT chk_tlo_assignment_vacant_null CHECK (((status <> 'VACANT') OR (plantilla_id IS NULL)));
-- CREATE INDEX IF NOT EXISTS idx_tlo_assignment_plantilla ON tlo_assignment(plantilla_id);
-- COMMIT;
-- =============================================================================
