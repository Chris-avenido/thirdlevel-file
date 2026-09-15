-- =========================================================================================
-- Migration: 20260915_038_create_tlo_masterlist_table.sql
-- Description:
--   1. Drops the compatibility view 'tlo_masterlist' created in migration 037.
--   2. Creates a dedicated physical table 'tlo_masterlist' with primary key, identifiers,
--      and demographic columns matching the official TLO masterlist dataset.
--   3. Adds performance indexes on TLOid, last_name, and gender.
--   4. Creates bidirectional identifier synchronization trigger for tloid / "TLOid".
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Drop the compatibility view 'tlo_masterlist'
DROP VIEW IF EXISTS tlo_masterlist CASCADE;

-- 2. Create physical table 'tlo_masterlist'
CREATE TABLE IF NOT EXISTS tlo_masterlist (
    id SERIAL PRIMARY KEY,
    "TLOid" VARCHAR(50) NOT NULL UNIQUE,
    tloid VARCHAR(50) NULL,
    first_name VARCHAR(255) NULL,
    last_name VARCHAR(255) NULL,
    middle_name VARCHAR(255) NULL,
    suffix VARCHAR(50) NULL,
    gender VARCHAR(50) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Trigger to keep "TLOid" and tloid in sync
CREATE OR REPLACE FUNCTION fn_sync_tlo_masterlist_tloid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."TLOid" IS NULL AND NEW.tloid IS NOT NULL THEN
        NEW."TLOid" := NEW.tloid;
    ELSIF NEW.tloid IS NULL AND NEW."TLOid" IS NOT NULL THEN
        NEW.tloid := NEW."TLOid";
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tlo_masterlist_tloid ON tlo_masterlist;
CREATE TRIGGER trg_sync_tlo_masterlist_tloid
BEFORE INSERT OR UPDATE ON tlo_masterlist
FOR EACH ROW
EXECUTE FUNCTION fn_sync_tlo_masterlist_tloid();

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_tloid ON tlo_masterlist ("TLOid");
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_lower_tloid ON tlo_masterlist (tloid);
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_last_name ON tlo_masterlist (last_name);
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_gender ON tlo_masterlist (gender);

COMMENT ON TABLE tlo_masterlist IS 'Physical masterlist table for third level officials demographics';

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
-- DROP TABLE IF EXISTS tlo_masterlist CASCADE;
-- DROP FUNCTION IF EXISTS fn_sync_tlo_masterlist_tloid CASCADE;
-- CREATE OR REPLACE VIEW tlo_masterlist AS SELECT * FROM third_level_official_masterlist;
-- =========================================================================================
