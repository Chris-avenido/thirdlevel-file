-- =============================================================================
-- Migration: 20260915_034_create_tlo_plantilla_and_positions_integration.sql
-- Description: Establishes CSV ingestion integration for tlo_plantilla, tlo_positions,
--              and tlo_assignment. Adds position_code to tlo_positions, salary_grade
--              to tlo_plantilla, assigned_at to tlo_assignment, and updates view/sync trigger.
-- Date: 2026-09-15
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend tlo_positions with position_code
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_positions
    ADD COLUMN IF NOT EXISTS position_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_tlo_positions_code ON tlo_positions(position_code);

-- Populate common DepED position codes
UPDATE tlo_positions SET position_code = 'SEC' WHERE position_title ILIKE 'Secretary' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'USEC' WHERE position_title ILIKE 'Undersecretary' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'ASEC' WHERE position_title ILIKE 'Assistant Secretary' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'DIR4' WHERE position_title ILIKE 'Director IV' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'DIR3' WHERE position_title ILIKE 'Director III' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'RD' WHERE position_title ILIKE 'Regional Director' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'ARD' WHERE position_title ILIKE 'Assistant Regional Director' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'SDS' WHERE position_title ILIKE 'Schools Division Superintendent' AND position_code IS NULL;
UPDATE tlo_positions SET position_code = 'ASDS' WHERE position_title ILIKE 'Assistant Schools Division Superintendent' AND position_code IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extend tlo_plantilla with salary_grade
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_plantilla
    ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_salary_grade ON tlo_plantilla(salary_grade);

-- Recreate idx_tlo_plantilla_permanent_item_no to exclude placeholder item numbers
DROP INDEX IF EXISTS idx_tlo_plantilla_permanent_item_no;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tlo_plantilla_permanent_item_no 
ON tlo_plantilla (permanent_item_no) 
WHERE permanent_item_no IS NOT NULL 
  AND permanent_item_no != '' 
  AND UPPER(permanent_item_no) NOT IN ('NEW ITEM', 'DETAILED', 'N/A', 'N/A (DETAILED)');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Extend tlo_assignment with assigned_at
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tlo_assignment_assigned_at ON tlo_assignment(assigned_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update tlo_assignments View and INSTEAD OF Trigger
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS tlo_assignments CASCADE;

CREATE OR REPLACE VIEW tlo_assignments AS
SELECT 
    a.id,
    a.plantilla_id AS personnel_id,
    a.plantilla_item_no AS item_number,
    a.position_id,
    pos.position_code,
    COALESCE(pos.salary_grade, p.salary_grade) AS salary_grade,
    a.position_title,
    a.region,
    a.division,
    a.office,
    a.strand,
    a.designation,
    CASE 
        WHEN a.is_oic THEN 'OIC' 
        ELSE 'Permanent' 
    END AS assignment_type,
    CASE 
        WHEN a.status = 'VACANT' THEN 'Inactive'
        WHEN a.status = 'REASSIGNED' THEN 'Inactive'
        ELSE 'Active'
    END AS status,
    a.is_active,
    a.assigned_at,
    a.start_date,
    a.end_date,
    a.reassignment_order_binary_id,
    a.remarks,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at,
    a.is_oic AS oic
FROM tlo_assignment a
LEFT JOIN tlo_positions pos ON a.position_id = pos.id
LEFT JOIN tlo_plantilla p ON a.plantilla_id = p.id;

CREATE OR REPLACE FUNCTION trg_tlo_assignments_view_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO tlo_assignment (
            plantilla_id,
            plantilla_item_no,
            position_id,
            position_title,
            region,
            division,
            office,
            strand,
            designation,
            status,
            is_active,
            assigned_at,
            is_oic,
            start_date,
            end_date,
            reassignment_order_binary_id,
            remarks,
            created_by,
            updated_by,
            created_at,
            updated_at
        ) VALUES (
            NEW.personnel_id,
            NEW.item_number,
            NEW.position_id,
            COALESCE(NEW.position_title, 'Unspecified Position'),
            NEW.region,
            NEW.division,
            NEW.office,
            NEW.strand,
            NEW.designation,
            CASE 
                WHEN NEW.status = 'Active' AND COALESCE(NEW.oic, FALSE) = TRUE THEN 'OIC'
                WHEN NEW.status = 'Active' THEN 'REGULAR'
                WHEN NEW.status = 'Vacant' OR NEW.status = 'VACANT' THEN 'VACANT'
                ELSE 'REASSIGNED'
            END,
            COALESCE(NEW.is_active, CASE WHEN NEW.status IN ('Inactive', 'VACANT', 'REASSIGNED') THEN FALSE ELSE TRUE END),
            COALESCE(NEW.assigned_at, NOW()),
            COALESCE(NEW.oic, FALSE),
            NEW.start_date,
            NEW.end_date,
            NEW.reassignment_order_binary_id,
            NEW.remarks,
            NEW.created_by,
            NEW.updated_by,
            COALESCE(NEW.created_at, NOW()),
            COALESCE(NEW.updated_at, NOW())
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE tlo_assignment
        SET plantilla_id = NEW.personnel_id,
            plantilla_item_no = NEW.item_number,
            position_id = NEW.position_id,
            position_title = COALESCE(NEW.position_title, tlo_assignment.position_title),
            region = NEW.region,
            division = NEW.division,
            office = NEW.office,
            strand = NEW.strand,
            designation = NEW.designation,
            status = CASE 
                WHEN NEW.status = 'Active' AND COALESCE(NEW.oic, FALSE) = TRUE THEN 'OIC'
                WHEN NEW.status = 'Active' THEN 'REGULAR'
                WHEN NEW.status = 'Vacant' OR NEW.status = 'VACANT' THEN 'VACANT'
                ELSE 'REASSIGNED'
            END,
            is_active = COALESCE(NEW.is_active, CASE WHEN NEW.status IN ('Inactive', 'VACANT', 'REASSIGNED') THEN FALSE ELSE TRUE END),
            assigned_at = COALESCE(NEW.assigned_at, tlo_assignment.assigned_at),
            is_oic = COALESCE(NEW.oic, tlo_assignment.is_oic),
            start_date = NEW.start_date,
            end_date = NEW.end_date,
            reassignment_order_binary_id = NEW.reassignment_order_binary_id,
            remarks = NEW.remarks,
            updated_by = NEW.updated_by,
            updated_at = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM tlo_assignment WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tlo_assignments_sync ON tlo_assignments;
CREATE TRIGGER trg_tlo_assignments_sync
    INSTEAD OF INSERT OR UPDATE OR DELETE ON tlo_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trg_tlo_assignments_view_sync();

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS:
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_tlo_assignments_sync ON tlo_assignments;
-- DROP FUNCTION IF EXISTS trg_tlo_assignments_view_sync();
-- DROP VIEW IF EXISTS tlo_assignments CASCADE;
-- ALTER TABLE tlo_positions DROP COLUMN IF EXISTS position_code;
-- ALTER TABLE tlo_plantilla DROP COLUMN IF EXISTS salary_grade;
-- ALTER TABLE tlo_assignment DROP COLUMN IF EXISTS assigned_at;
-- COMMIT;
