-- =============================================================================
-- Migration: 20260915_041_delete_tlo_assignment_and_link_positions_to_assignments.sql
-- Description:
--   1. Adds position_id to canonical tlo_assignments and establishes foreign key
--      constraint referencing tlo_positions(id).
--   2. Transfers assignment metadata (designation, remarks, reassignment_order_binary_id,
--      created_by, updated_by) from tlo_assignment to tlo_assignments.
--   3. Creates performance index on tlo_assignments(position_id).
--   4. Safely drops foreign key constraints on tlo_assignment and permanently drops
--      the legacy tlo_assignment table.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Safety Backup Verification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignment_backup_schema_refactor AS
SELECT * FROM tlo_assignment;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extend tlo_assignments with Position FK and Metadata Columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments 
    ADD COLUMN IF NOT EXISTS position_id INTEGER,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS reassignment_order_binary_id UUID,
    ADD COLUMN IF NOT EXISTS created_by TEXT,
    ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill position_id and Metadata from tlo_assignment
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE tlo_assignments asg
SET position_id = a.position_id,
    designation = a.designation,
    remarks = a.remarks,
    reassignment_order_binary_id = a.reassignment_order_binary_id,
    created_by = a.created_by,
    updated_by = a.updated_by
FROM tlo_assignment a
WHERE asg.id = a.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Establish Foreign Key & Indexes on tlo_assignments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_position_id_fkey;

ALTER TABLE tlo_assignments
    ADD CONSTRAINT tlo_assignments_position_id_fkey
    FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_position_id ON tlo_assignments(position_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop Legacy tlo_assignment Constraints and Table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS fk_assignment_position;
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS tlo_assignment_tlo_masterlist_id_fkey;
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS chk_tlo_assignment_vacant_null;
ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS chk_tlo_assignment_status;

DROP TABLE IF EXISTS tlo_assignment CASCADE;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- In the event of a rollback, execute the following SQL block:
-- BEGIN;
-- CREATE TABLE tlo_assignment AS SELECT * FROM tlo_assignment_backup_schema_refactor;
-- ALTER TABLE tlo_assignment ADD PRIMARY KEY (id);
-- ALTER TABLE tlo_assignment ADD CONSTRAINT tlo_assignment_tlo_masterlist_id_fkey FOREIGN KEY (tlo_masterlist_id) REFERENCES tlo_masterlist(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignment ADD CONSTRAINT fk_assignment_position FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_position_id_fkey;
-- DROP INDEX IF EXISTS idx_tlo_assignments_position_id;
-- ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS position_id;
-- COMMIT;
-- =============================================================================
