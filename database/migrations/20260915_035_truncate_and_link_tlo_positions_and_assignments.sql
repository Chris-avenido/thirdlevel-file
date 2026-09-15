-- =============================================================================
-- Migration: 20260915_035_truncate_and_link_tlo_positions_and_assignments.sql
-- Description: Adds unassigned_at to tlo_assignment, enforces foreign keys to
--              tlo_positions and tlo_plantilla, and updates tlo_assignments view/trigger.
-- Date: 2026-09-15
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend tlo_assignment with unassigned_at
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment
    ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tlo_assignment_unassigned_at ON tlo_assignment(unassigned_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Foreign Key Constraints (Safe checks)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_assignment_plantilla' AND table_name = 'tlo_assignment'
    ) THEN
        ALTER TABLE tlo_assignment
            ADD CONSTRAINT fk_assignment_plantilla
            FOREIGN KEY (plantilla_id) REFERENCES tlo_plantilla(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_assignment_position' AND table_name = 'tlo_assignment'
    ) THEN
        ALTER TABLE tlo_assignment
            ADD CONSTRAINT fk_assignment_position
            FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update tlo_assignments View & Trigger
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
    a.unassigned_at,
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
            unassigned_at,
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
            NEW.unassigned_at,
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
            unassigned_at = COALESCE(NEW.unassigned_at, tlo_assignment.unassigned_at),
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
-- ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS fk_assignment_plantilla;
-- ALTER TABLE tlo_assignment DROP CONSTRAINT IF EXISTS fk_assignment_position;
-- ALTER TABLE tlo_assignment DROP COLUMN IF EXISTS unassigned_at;
-- COMMIT;
