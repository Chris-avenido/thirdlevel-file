-- =============================================================================
-- Migration: 20260917_049_align_tlo_assignments_to_local_schema.sql
-- Description:
--   Aligns public.tlo_assignments table schema on server (tlo_database) with local (tlo_database_test):
--   1. Non-destructively backs up existing data into tlo_assignments_backup_20260917.
--   2. Backfills tlo_position_id from legacy item_number if unpopulated.
--   3. Drops legacy denormalized columns: personnel_id, item_number, region, division,
--      office, strand, assignment_type, oic, position_title.
--   4. Drops legacy constraints & indexes associated with dropped columns.
--   5. Enforces 15 canonical columns, NOT NULL defaults, and check constraints:
--      - status IN ('Active', 'Inactive')
--      - capacity IN ('Full', 'OIC', 'Concurrent')
--   6. Enforces canonical foreign keys:
--      - tlo_masterlist_id -> tlo_masterlist(id) ON DELETE CASCADE
--      - tlo_position_id   -> tlo_items(item_number) ON DELETE SET NULL
--      - position_id       -> tlo_positions(id) ON DELETE SET NULL
--   7. Recreates canonical performance indexes.
-- Author: Antigravity
-- Date: 2026-09-17
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Safety Non-Destructive Backup
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignments_backup_20260917 AS 
SELECT * FROM tlo_assignments;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill tlo_position_id from item_number if present
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tlo_assignments' AND column_name = 'item_number'
    ) THEN
        UPDATE tlo_assignments 
        SET tlo_position_id = item_number 
        WHERE tlo_position_id IS NULL AND item_number IS NOT NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Pre-fill null values before setting NOT NULL constraints
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE tlo_assignments SET status = 'Active' WHERE status IS NULL;
UPDATE tlo_assignments SET capacity = 'Full' WHERE capacity IS NULL;
UPDATE tlo_assignments SET start_date = CURRENT_DATE WHERE start_date IS NULL;
UPDATE tlo_assignments SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
UPDATE tlo_assignments SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop Legacy Constraints and Indexes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_personnel_id_fkey;
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_item_number_fkey;

DROP INDEX IF EXISTS idx_tlo_assignments_status_oic;
DROP INDEX IF EXISTS idx_tlo_assignments_title;
DROP INDEX IF EXISTS idx_tlo_assignments_personnel;
DROP INDEX IF EXISTS idx_tlo_assignments_item;
DROP INDEX IF EXISTS idx_tlo_assignments_status;
DROP INDEX IF EXISTS idx_tlo_assignments_capacity;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop Legacy Columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments
    DROP COLUMN IF EXISTS personnel_id,
    DROP COLUMN IF EXISTS item_number,
    DROP COLUMN IF EXISTS region,
    DROP COLUMN IF EXISTS division,
    DROP COLUMN IF EXISTS office,
    DROP COLUMN IF EXISTS strand,
    DROP COLUMN IF EXISTS assignment_type,
    DROP COLUMN IF EXISTS oic,
    DROP COLUMN IF EXISTS position_title;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Enforce Canonical Column Types, Lengths, Defaults and Not Null Constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments ALTER COLUMN status TYPE varchar(20);
ALTER TABLE tlo_assignments ALTER COLUMN status SET DEFAULT 'Active';
ALTER TABLE tlo_assignments ALTER COLUMN status SET NOT NULL;

ALTER TABLE tlo_assignments ALTER COLUMN capacity TYPE varchar(20);
ALTER TABLE tlo_assignments ALTER COLUMN capacity SET DEFAULT 'Full';
ALTER TABLE tlo_assignments ALTER COLUMN capacity SET NOT NULL;

ALTER TABLE tlo_assignments ALTER COLUMN start_date SET DEFAULT CURRENT_DATE;
ALTER TABLE tlo_assignments ALTER COLUMN start_date SET NOT NULL;

ALTER TABLE tlo_assignments ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tlo_assignments ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE tlo_assignments ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tlo_assignments ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE tlo_assignments ALTER COLUMN tlo_position_id TYPE varchar(100);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Realign Check Constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS chk_tlo_assignments_status;
ALTER TABLE tlo_assignments ADD CONSTRAINT chk_tlo_assignments_status 
    CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])));

ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS chk_tlo_assignments_capacity;
ALTER TABLE tlo_assignments ADD CONSTRAINT chk_tlo_assignments_capacity 
    CHECK (((capacity)::text = ANY ((ARRAY['Full'::character varying, 'OIC'::character varying, 'Concurrent'::character varying])::text[])));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Realign Foreign Key Constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_tlo_masterlist_id_fkey;
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_tlo_masterlist_id_new_fkey;
ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_tlo_masterlist_id_new_fkey 
    FOREIGN KEY (tlo_masterlist_id) REFERENCES tlo_masterlist(id) ON DELETE CASCADE;

ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_tlo_position_id_new_fkey;
ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_tlo_position_id_fkey;
ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_tlo_position_id_new_fkey 
    FOREIGN KEY (tlo_position_id) REFERENCES tlo_items(item_number) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tlo_assignments_position_id_fkey'
    ) THEN
        ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_position_id_fkey
            FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Recreate Canonical Performance Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_active 
    ON public.tlo_assignments USING btree (tlo_masterlist_id, status) WHERE (end_date IS NULL);

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_masterlist 
    ON public.tlo_assignments USING btree (tlo_masterlist_id);

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_position 
    ON public.tlo_assignments USING btree (tlo_position_id);

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_position_id 
    ON public.tlo_assignments USING btree (position_id);

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_status_capacity 
    ON public.tlo_assignments USING btree (status, capacity);

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT:
-- Execute the following SQL block if rollback is required:
-- =============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_assignments CASCADE;
-- CREATE TABLE tlo_assignments AS SELECT * FROM tlo_assignments_backup_20260917;
-- ALTER TABLE tlo_assignments ADD PRIMARY KEY (id);
-- ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_position_id_fkey FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_tlo_masterlist_id_fkey FOREIGN KEY (tlo_masterlist_id) REFERENCES tlo_masterlist(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_item_number_fkey FOREIGN KEY (item_number) REFERENCES tlo_items(item_number) ON DELETE RESTRICT;
-- ALTER TABLE tlo_assignments ADD CONSTRAINT tlo_assignments_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES tlo_personnel(id) ON DELETE RESTRICT;
-- CREATE INDEX idx_tlo_assignments_status_oic ON public.tlo_assignments(status, oic);
-- CREATE INDEX idx_tlo_assignments_title ON public.tlo_assignments(position_title);
-- CREATE INDEX idx_tlo_assignments_masterlist ON public.tlo_assignments(tlo_masterlist_id);
-- CREATE INDEX idx_tlo_assignments_position_id ON public.tlo_assignments(position_id);
-- CREATE INDEX idx_tlo_assignments_capacity ON public.tlo_assignments(capacity);
-- CREATE INDEX idx_tlo_assignments_personnel ON public.tlo_assignments(personnel_id);
-- CREATE INDEX idx_tlo_assignments_item ON public.tlo_assignments(item_number);
-- CREATE INDEX idx_tlo_assignments_status ON public.tlo_assignments(status, assignment_type);
-- COMMIT;
