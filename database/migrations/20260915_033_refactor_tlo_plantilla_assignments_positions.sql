-- Migration: 20260915_033_refactor_tlo_plantilla_assignments_positions.sql
-- Description: Decouple location and position details from tlo_plantilla,
--              introduce tlo_positions master inventory table, and
--              enhance tlo_assignment with position_id and is_active.
-- Author: Antigravity
-- Date: 2026-09-15

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create tlo_positions master table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_positions (
    id SERIAL PRIMARY KEY,
    position_title VARCHAR(150) UNIQUE NOT NULL,
    salary_grade VARCHAR(20),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Enhance tlo_assignment with position_id and is_active
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tlo_assignment
    ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES tlo_positions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Populate tlo_positions and migrate existing position/location data
-- ─────────────────────────────────────────────────────────────────────────────
-- Insert distinct recognized position titles into tlo_positions
INSERT INTO tlo_positions (position_title, created_at, updated_at)
SELECT DISTINCT TRIM(pos), NOW(), NOW()
FROM (
    SELECT position_title AS pos FROM tlo_plantilla WHERE position_title IS NOT NULL AND TRIM(position_title) != ''
    UNION
    SELECT position_title AS pos FROM tlo_assignment WHERE position_title IS NOT NULL AND TRIM(position_title) != ''
) all_pos
ON CONFLICT (position_title) DO NOTHING;

-- Link tlo_assignment.position_id to tlo_positions.id
UPDATE tlo_assignment a
SET position_id = p.id
FROM tlo_positions p
WHERE TRIM(a.position_title) = p.position_title
  AND a.position_id IS NULL;

-- Synchronize is_active flag in tlo_assignment according to status
UPDATE tlo_assignment
SET is_active = (status NOT IN ('INACTIVE', 'REASSIGNED', 'ENDED', 'VACANT'));

-- Backfill any tlo_plantilla records that have location/position attributes but no assignment record
INSERT INTO tlo_assignment (
    plantilla_id,
    plantilla_item_no,
    position_title,
    position_id,
    region,
    division,
    office,
    status,
    is_active,
    created_at,
    updated_at
)
SELECT 
    tp.id,
    tp.permanent_item_no,
    COALESCE(tp.position_title, 'Unspecified Position'),
    pos.id,
    tp.region,
    tp.division,
    tp.bureau,
    'REGULAR',
    TRUE,
    NOW(),
    NOW()
FROM tlo_plantilla tp
LEFT JOIN tlo_assignment ta ON ta.plantilla_id = tp.id
LEFT JOIN tlo_positions pos ON pos.position_title = TRIM(tp.position_title)
WHERE ta.id IS NULL 
  AND (tp.region IS NOT NULL OR tp.division IS NOT NULL OR tp.bureau IS NOT NULL OR tp.position_title IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop location columns and obsolete indexes from tlo_plantilla
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_tlo_plantilla_region_div;
DROP INDEX IF EXISTS idx_tlo_plantilla_bureau;
DROP INDEX IF EXISTS idx_tlo_plantilla_position;

ALTER TABLE tlo_plantilla
    DROP COLUMN IF EXISTS region,
    DROP COLUMN IF EXISTS division,
    DROP COLUMN IF EXISTS bureau,
    DROP COLUMN IF EXISTS position_title;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update tlo_assignments backward-compatibility view and INSTEAD OF trigger
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS tlo_assignments CASCADE;

CREATE OR REPLACE VIEW tlo_assignments AS
SELECT 
    a.id,
    a.plantilla_id AS personnel_id,
    a.plantilla_item_no AS item_number,
    a.position_id,
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
    a.start_date,
    a.end_date,
    a.reassignment_order_binary_id,
    a.remarks,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at,
    a.is_oic AS oic
FROM tlo_assignment a;

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

CREATE TRIGGER trg_tlo_assignments_view_sync_trigger
INSTEAD OF INSERT OR UPDATE OR DELETE ON tlo_assignments
FOR EACH ROW
EXECUTE FUNCTION trg_tlo_assignments_view_sync();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Create indexes for performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_is_active ON tlo_assignment (is_active);
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_position_id ON tlo_assignment (position_id);
CREATE INDEX IF NOT EXISTS idx_tlo_positions_title ON tlo_positions (position_title);

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_positions CASCADE;
-- ALTER TABLE tlo_assignment DROP COLUMN IF EXISTS position_id;
-- ALTER TABLE tlo_assignment DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE tlo_plantilla ADD COLUMN IF NOT EXISTS region VARCHAR(150);
-- ALTER TABLE tlo_plantilla ADD COLUMN IF NOT EXISTS division VARCHAR(150);
-- ALTER TABLE tlo_plantilla ADD COLUMN IF NOT EXISTS bureau VARCHAR(255);
-- ALTER TABLE tlo_plantilla ADD COLUMN IF NOT EXISTS position_title VARCHAR(255);
-- COMMIT;
-- =============================================================================
