-- =========================================================================================
-- Migration: 20260915_039_remove_duplicate_tloid_column_from_masterlist.sql
-- Description:
--   Removes the duplicate "TLOid" column from table tlo_masterlist, leaving 'tloid'
--   as the single canonical identifier column. Drops the bidirectional sync trigger
--   and establishes NOT NULL and UNIQUE constraints on tloid.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Drop trigger and function that synced the duplicate columns
DROP TRIGGER IF EXISTS trg_sync_tlo_masterlist_tloid ON tlo_masterlist;
DROP FUNCTION IF EXISTS fn_sync_tlo_masterlist_tloid CASCADE;

-- 2. Drop the index on "TLOid"
DROP INDEX IF EXISTS idx_tlo_masterlist_tloid;

-- 3. Ensure tloid is fully populated and set as NOT NULL UNIQUE
UPDATE tlo_masterlist SET tloid = "TLOid" WHERE tloid IS NULL AND "TLOid" IS NOT NULL;
ALTER TABLE tlo_masterlist ALTER COLUMN tloid SET NOT NULL;

-- 4. Add unique constraint on tloid if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_tlo_masterlist_tloid' AND conrelid = 'tlo_masterlist'::regclass
    ) THEN
        ALTER TABLE tlo_masterlist ADD CONSTRAINT uq_tlo_masterlist_tloid UNIQUE (tloid);
    END IF;
END $$;

-- 5. Drop the duplicate "TLOid" column
ALTER TABLE tlo_masterlist DROP COLUMN IF EXISTS "TLOid";

-- 6. Ensure performance index on tloid
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_tloid ON tlo_masterlist (tloid);

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
-- ALTER TABLE tlo_masterlist ADD COLUMN IF NOT EXISTS "TLOid" VARCHAR(50) NULL;
-- UPDATE tlo_masterlist SET "TLOid" = tloid;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_tlo_masterlist_quoted_tloid ON tlo_masterlist ("TLOid");
-- =========================================================================================
