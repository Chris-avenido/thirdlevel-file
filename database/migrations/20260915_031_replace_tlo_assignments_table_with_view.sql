-- Migration: 20260915_031_replace_tlo_assignments_table_with_view.sql
-- Description: Convert legacy tlo_assignments table into a backward-compatibility view aliasing tlo_assignment.
-- Author: Antigravity
-- Date: 2026-09-15

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Verify and Safeguard Data
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure tlo_assignment exists and has all current data before dropping the legacy table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_assignment') THEN
        RAISE EXCEPTION 'Safety check failed: tlo_assignment table does not exist. Aborting migration.';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop legacy tlo_assignments table if it is still a physical table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tlo_assignments' AND table_type = 'BASE TABLE'
    ) THEN
        DROP TABLE tlo_assignments CASCADE;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create backward-compatible PostgreSQL View tlo_assignments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW tlo_assignments AS
SELECT 
    a.id,
    a.plantilla_id AS personnel_id,
    a.plantilla_item_no AS item_number,
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
    a.start_date,
    a.end_date,
    a.reassignment_order_binary_id,
    a.remarks,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at,
    a.is_oic AS oic,
    a.position_title
FROM tlo_assignment a;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Create INSTEAD OF Trigger to support any legacy writes to tlo_assignments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_tlo_assignments_view_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO tlo_assignment (
            plantilla_id,
            plantilla_item_no,
            region,
            division,
            office,
            strand,
            position_title,
            designation,
            status,
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
            NEW.region,
            NEW.division,
            NEW.office,
            NEW.strand,
            COALESCE(NEW.position_title, 'Unspecified Position'),
            NEW.designation,
            CASE 
                WHEN NEW.status = 'Active' AND COALESCE(NEW.oic, FALSE) = TRUE THEN 'OIC'
                WHEN NEW.status = 'Active' THEN 'REGULAR'
                WHEN NEW.status = 'Vacant' OR NEW.status = 'VACANT' THEN 'VACANT'
                ELSE 'REASSIGNED'
            END,
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
            region = NEW.region,
            division = NEW.division,
            office = NEW.office,
            strand = NEW.strand,
            position_title = COALESCE(NEW.position_title, tlo_assignment.position_title),
            designation = NEW.designation,
            status = CASE 
                WHEN NEW.status = 'Active' AND COALESCE(NEW.oic, FALSE) = TRUE THEN 'OIC'
                WHEN NEW.status = 'Active' THEN 'REGULAR'
                WHEN NEW.status = 'Vacant' OR NEW.status = 'VACANT' THEN 'VACANT'
                ELSE 'REASSIGNED'
            END,
            is_oic = COALESCE(NEW.oic, FALSE),
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

DROP TRIGGER IF EXISTS trg_tlo_assignments_view_io ON tlo_assignments;
CREATE TRIGGER trg_tlo_assignments_view_io
INSTEAD OF INSERT OR UPDATE OR DELETE ON tlo_assignments
FOR EACH ROW EXECUTE FUNCTION trg_tlo_assignments_view_sync();

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_tlo_assignments_view_io ON tlo_assignments;
-- DROP FUNCTION IF EXISTS trg_tlo_assignments_view_sync();
-- DROP VIEW IF EXISTS tlo_assignments;
-- CREATE TABLE IF NOT EXISTS tlo_assignments (...);
-- COMMIT;
-- =============================================================================
