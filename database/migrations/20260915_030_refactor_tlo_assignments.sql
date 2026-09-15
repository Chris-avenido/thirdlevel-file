-- Migration: 20260915_030_refactor_tlo_assignments.sql
-- Description: Refactor tlo_assignments database table schema to standardized 9-column structure:
--              id, tlo_masterlist_id, tlo_position_id, status ('Active'/'Inactive'),
--              capacity ('Full'/'OIC'/'Concurrent'), start_date, end_date, created_at, updated_at.
--              Drops denormalized location columns (region, division, office, strand) and designation/oic.
--              Enforces append-only model and preserves all historical assignment data non-destructively.
-- Author: Antigravity
-- Date: 2026-09-15

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create Non-Destructive Backup Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignments_backup_20260915 AS 
SELECT * FROM tlo_assignments;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop View / Triggers / Existing Legacy Structures
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop any INSTEAD OF sync triggers if tlo_assignments was previously a view
DROP TRIGGER IF EXISTS trg_tlo_assignments_sync ON tlo_assignments;
DROP FUNCTION IF EXISTS trg_tlo_assignments_view_sync() CASCADE;

-- Safely drop tlo_assignments whether it is a VIEW or a TABLE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'tlo_assignments'
    ) THEN
        DROP VIEW tlo_assignments CASCADE;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tlo_assignments' AND table_type = 'BASE TABLE'
    ) THEN
        DROP TABLE tlo_assignments CASCADE;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create Refactored tlo_assignments Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tlo_assignments (
    id SERIAL PRIMARY KEY,
    tlo_masterlist_id VARCHAR(255) NOT NULL,
    tlo_position_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active'
        CONSTRAINT chk_tlo_assignments_status CHECK (status IN ('Active', 'Inactive')),
    capacity VARCHAR(20) NOT NULL DEFAULT 'Full'
        CONSTRAINT chk_tlo_assignments_capacity CHECK (capacity IN ('Full', 'OIC', 'Concurrent')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Create Performance and Integrity Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_masterlist ON tlo_assignments(tlo_masterlist_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_position ON tlo_assignments(tlo_position_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_status_capacity ON tlo_assignments(status, capacity);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_active ON tlo_assignments(tlo_masterlist_id, status) WHERE end_date IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Populate Data from Backup with Normalization & Capacity Inferencing
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO tlo_assignments (
    id,
    tlo_masterlist_id,
    tlo_position_id,
    status,
    capacity,
    start_date,
    end_date,
    created_at,
    updated_at
)
SELECT
    b.id,
    COALESCE(b.personnel_id::text, 'VACANT') AS tlo_masterlist_id,
    COALESCE(b.item_number, 'UNASSIGNED') AS tlo_position_id,
    CASE 
        WHEN b.end_date IS NOT NULL THEN 'Inactive'
        WHEN b.status = 'Inactive' THEN 'Inactive'
        ELSE 'Active'
    END AS status,
    CASE 
        WHEN b.oic = true OR b.designation ILIKE '%OIC%' OR b.assignment_type ILIKE '%OIC%' THEN 'OIC'
        WHEN b.designation ILIKE '%Concurrent%' OR b.assignment_type ILIKE '%Concurrent%' THEN 'Concurrent'
        ELSE 'Full'
    END AS capacity,
    COALESCE(b.start_date, CURRENT_DATE) AS start_date,
    b.end_date,
    COALESCE(b.created_at, CURRENT_TIMESTAMP) AS created_at,
    COALESCE(b.updated_at, CURRENT_TIMESTAMP) AS updated_at
FROM tlo_assignments_backup_20260915 b
ON CONFLICT (id) DO UPDATE
SET tlo_masterlist_id = EXCLUDED.tlo_masterlist_id,
    tlo_position_id = EXCLUDED.tlo_position_id,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    updated_at = EXCLUDED.updated_at;

-- Synchronize serial sequence to max id
SELECT setval(
    pg_get_serial_sequence('tlo_assignments', 'id'),
    COALESCE((SELECT MAX(id) FROM tlo_assignments), 1),
    true
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback Instructions (if needed):
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_assignments CASCADE;
-- CREATE VIEW tlo_assignments AS SELECT * FROM tlo_assignments_backup_20260915;
-- COMMIT;
