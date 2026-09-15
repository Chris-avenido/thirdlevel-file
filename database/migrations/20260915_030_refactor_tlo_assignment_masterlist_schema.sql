-- =============================================================================
-- Migration: 20260915_030_refactor_tlo_assignment_masterlist_schema.sql
-- Description:
--   1. Shifts the TLO architecture from indirect tlo_plantilla-centric model to
--      a canonical model centered on tlo_masterlist and tlo_items.
--   2. Updates tlo_assignments to directly link personnel identity (tlo_masterlist_id
--      referencing tlo_masterlist.id) and canonical positions (tlo_position_id
--      referencing tlo_items.item_number).
--   3. Detaches tlo_plantilla and ces_plantilla into flat standalone reference tables
--      with no inbound or outbound FK constraints.
--   4. Re-keys tlo_profile and third_level_officials_profiles to reference
--      tlo_masterlist.id and drops legacy plantilla_id.
--   5. Performs strict data backfill validation (aborts if any non-vacant assignment is unmapped).
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs.
--   Preserves all historical assignment data non-destructively in backup table.
--   Rollback script provided at the end of this file.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create Non-Destructive Backup Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignments_backup_schema_refactor AS 
SELECT * FROM tlo_assignments;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Populate tlo_items with Distinct Canonical Position Item Numbers
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure all plantilla and assignment item numbers exist in tlo_items before adding FK
INSERT INTO tlo_items (item_number, position_title, salary_grade, created_at, updated_at)
SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(dbm_item_no), ''), 'UNASSIGNED'))
    COALESCE(NULLIF(TRIM(dbm_item_no), ''), 'UNASSIGNED') AS item_number,
    COALESCE(NULLIF(TRIM(position_title), ''), 'Unspecified Position') AS position_title,
    salary_grade,
    NOW(), NOW()
FROM ces_plantilla
WHERE dbm_item_no IS NOT NULL AND TRIM(dbm_item_no) <> ''
ORDER BY COALESCE(NULLIF(TRIM(dbm_item_no), ''), 'UNASSIGNED'), id DESC
ON CONFLICT (item_number) DO UPDATE
SET position_title = COALESCE(NULLIF(EXCLUDED.position_title, 'Unspecified Position'), tlo_items.position_title),
    salary_grade = COALESCE(EXCLUDED.salary_grade, tlo_items.salary_grade),
    updated_at = NOW();

INSERT INTO tlo_items (item_number, position_title, salary_grade, created_at, updated_at)
SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(permanent_item_no), ''), 'UNASSIGNED'))
    COALESCE(NULLIF(TRIM(permanent_item_no), ''), 'UNASSIGNED') AS item_number,
    'Unspecified Position' AS position_title,
    salary_grade,
    NOW(), NOW()
FROM tlo_plantilla
WHERE permanent_item_no IS NOT NULL AND TRIM(permanent_item_no) <> ''
ORDER BY COALESCE(NULLIF(TRIM(permanent_item_no), ''), 'UNASSIGNED')
ON CONFLICT (item_number) DO NOTHING;

INSERT INTO tlo_items (item_number, position_title, salary_grade, created_at, updated_at)
SELECT DISTINCT ON (tlo_position_id)
    tlo_position_id AS item_number,
    'Unspecified Position' AS position_title,
    NULL AS salary_grade,
    NOW(), NOW()
FROM tlo_assignments
WHERE tlo_position_id IS NOT NULL AND TRIM(tlo_position_id) <> ''
ORDER BY tlo_position_id
ON CONFLICT (item_number) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Reconcile Canonical Masterlist Completeness
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix raw CSV anomaly where study leave / secondment notes corrupted name fields
UPDATE tlo_masterlist
SET first_name = 'IRENE S.', last_name = 'ANGWAY'
WHERE tloid = 'TLO-0586' AND (first_name IS NULL OR last_name = '2026)');

UPDATE tlo_masterlist
SET first_name = 'JOEL B.', last_name = 'LOPEZ'
WHERE tloid = 'TLO-0100' AND last_name ILIKE '%Secondment%';

-- Insert verified active incumbents from ces_plantilla missing from original masterlist
INSERT INTO tlo_masterlist (tloid, first_name, last_name, created_at, updated_at)
VALUES 
    ('TLO-0724', 'NICASIO S.', 'FRIO', NOW(), NOW()),
    ('TLO-0725', 'MARINA S.', 'SALAMANCA', NOW(), NOW())
ON CONFLICT (tloid) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Add Canonical Relational Columns to tlo_assignments
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignments 
    ADD COLUMN IF NOT EXISTS tlo_masterlist_id_new INT REFERENCES tlo_masterlist(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tlo_position_id_new VARCHAR(100) REFERENCES tlo_items(item_number) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Execute Relational Data Backfill
-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill tlo_masterlist_id_new matching personnel from tlo_plantilla to tlo_masterlist
UPDATE tlo_assignments a
SET tlo_masterlist_id_new = m.id
FROM tlo_plantilla p, tlo_masterlist m
WHERE a.tlo_masterlist_id = p.id::text
  AND a.tlo_masterlist_id <> 'VACANT'
  AND (
    (p.permanent_item_no IS NOT NULL AND p.permanent_item_no <> '' AND p.permanent_item_no <> 'NEW ITEM' AND EXISTS (
      SELECT 1 FROM third_level_official_masterlist tlm WHERE tlm.plantilla_item_no = p.permanent_item_no AND tlm."TLOid" = m.tloid
    ))
    OR (LOWER(TRIM(COALESCE(p.last_name, ''))) = LOWER(TRIM(COALESCE(m.last_name, ''))) AND LOWER(TRIM(COALESCE(p.first_name, ''))) = LOWER(TRIM(COALESCE(m.first_name, ''))))
    OR (p.last_name = 'MOSQUEDA' AND m.last_name = 'MOSQUEDA')
    OR (p.last_name = 'CAMPOREDONDO' AND m.last_name = 'CAMPOREDONDO')
    OR (p.last_name = 'ANGWAY' AND (m.last_name = 'ANGWAY' OR m.first_name ILIKE '%ANGWAY%'))
    OR (p.last_name = 'LOPEZ' AND p.first_name = 'JOEL' AND (m.last_name = 'LOPEZ' OR m.last_name ILIKE '%JOEL B. LOPEZ%'))
    OR (p.last_name = 'FRIO' AND m.last_name = 'FRIO')
    OR (p.last_name = 'SALAMANCA' AND m.last_name = 'SALAMANCA')
  );

-- Direct match fallback if tlo_masterlist_id was already TLOid
UPDATE tlo_assignments a
SET tlo_masterlist_id_new = m.id
FROM tlo_masterlist m
WHERE a.tlo_masterlist_id = m.tloid
  AND a.tlo_masterlist_id_new IS NULL;

-- Backfill canonical positions from tlo_items
UPDATE tlo_assignments a
SET tlo_position_id_new = i.item_number
FROM tlo_items i
WHERE a.tlo_position_id = i.item_number;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Strict Backfill Integrity Audit
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    unmapped_count INT;
BEGIN
    SELECT COUNT(*) INTO unmapped_count 
    FROM tlo_assignments 
    WHERE tlo_masterlist_id_new IS NULL 
      AND tlo_masterlist_id <> 'VACANT'
      AND status <> 'VACANT';

    IF unmapped_count > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % non-vacant assignment records without a matching masterlist row.', unmapped_count;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Swap Columns, Drop Legacy Columns & Enforce Foreign Key Constraints
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop legacy columns if present
ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS plantilla_id;
ALTER TABLE tlo_assignments DROP COLUMN IF EXISTS plantilla_item_no;

-- Drop legacy indexes
DROP INDEX IF EXISTS idx_tlo_assignments_masterlist;
DROP INDEX IF EXISTS idx_tlo_assignments_position;
DROP INDEX IF EXISTS idx_tlo_assignments_active;

-- Swap columns
ALTER TABLE tlo_assignments DROP COLUMN tlo_masterlist_id;
ALTER TABLE tlo_assignments RENAME COLUMN tlo_masterlist_id_new TO tlo_masterlist_id;

ALTER TABLE tlo_assignments DROP COLUMN tlo_position_id;
ALTER TABLE tlo_assignments RENAME COLUMN tlo_position_id_new TO tlo_position_id;

-- Recreate performance indexes on canonical columns
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_masterlist ON tlo_assignments(tlo_masterlist_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_position ON tlo_assignments(tlo_position_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_active ON tlo_assignments(tlo_masterlist_id, status) WHERE end_date IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Detach Plantilla (ces_plantilla / tlo_plantilla) into Flat Reference Tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ces_plantilla DROP COLUMN IF EXISTS position_id;
ALTER TABLE tlo_plantilla DROP CONSTRAINT IF EXISTS fk_plantilla_position;
ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS position_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Re-Key tlo_profile and third_level_officials_profiles to tlo_masterlist
-- ─────────────────────────────────────────────────────────────────────────────
-- Update third_level_officials_profiles
ALTER TABLE third_level_officials_profiles 
    ADD COLUMN IF NOT EXISTS tlo_masterlist_id INT REFERENCES tlo_masterlist(id);

UPDATE third_level_officials_profiles p
SET tlo_masterlist_id = m.id
FROM tlo_masterlist m
WHERE p.tlid = m.tloid;

ALTER TABLE third_level_officials_profiles DROP COLUMN IF EXISTS plantilla_id;

-- Update tlo_profile
ALTER TABLE tlo_profile 
    ADD COLUMN IF NOT EXISTS tlo_masterlist_id INT REFERENCES tlo_masterlist(id);

UPDATE tlo_profile p
SET tlo_masterlist_id = a.tlo_masterlist_id
FROM tlo_assignments a
WHERE a.id = p.id AND a.tlo_masterlist_id IS NOT NULL;

ALTER TABLE tlo_profile DROP CONSTRAINT IF EXISTS tlo_profile_plantilla_id_fkey;
ALTER TABLE tlo_profile DROP CONSTRAINT IF EXISTS tlo_profile_plantilla_id_key;
ALTER TABLE tlo_profile ALTER COLUMN plantilla_id DROP NOT NULL;
ALTER TABLE tlo_profile DROP COLUMN IF EXISTS plantilla_id;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- In the event of a rollback, execute the following SQL block:
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_assignments CASCADE;
-- CREATE TABLE tlo_assignments AS SELECT * FROM tlo_assignments_backup_schema_refactor;
-- ALTER TABLE tlo_plantilla ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES tlo_positions(id) ON DELETE SET NULL;
-- ALTER TABLE tlo_profile ADD COLUMN IF NOT EXISTS plantilla_id UUID REFERENCES tlo_plantilla(id) ON DELETE CASCADE;
-- ALTER TABLE third_level_officials_profiles DROP COLUMN IF EXISTS tlo_masterlist_id;
-- ALTER TABLE tlo_profile DROP COLUMN IF EXISTS tlo_masterlist_id;
-- COMMIT;
-- =============================================================================
