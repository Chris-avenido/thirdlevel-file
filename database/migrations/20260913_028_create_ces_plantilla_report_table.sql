-- ============================================================
-- Migration  : 20260913_028
-- Description: Create dedicated ces_plantilla_report table
-- Purpose    : Ingest and query DepEd Career Executive Service (CES)
--              Plantilla Report from "CES Plantilla Report_10 September 2026(Plantilla Report).csv"
-- Tables     : ces_plantilla_report (CREATE NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-09-13
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ces_plantilla_report (
    id SERIAL PRIMARY KEY,
    source_row_number INTEGER NOT NULL UNIQUE,
    office_bureau_division TEXT,
    region TEXT,
    position_title TEXT,
    dbm_item_no TEXT,
    salary_grade VARCHAR(10),
    incumbent_name TEXT,
    status_of_appointment TEXT,
    is_vacant BOOLEAN DEFAULT FALSE,
    is_section_header BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ces_plantilla_dbm_item_no 
    ON ces_plantilla_report (dbm_item_no);

CREATE INDEX IF NOT EXISTS idx_ces_plantilla_region 
    ON ces_plantilla_report (region);

CREATE INDEX IF NOT EXISTS idx_ces_plantilla_is_vacant 
    ON ces_plantilla_report (is_vacant);

CREATE INDEX IF NOT EXISTS idx_ces_plantilla_position 
    ON ces_plantilla_report (position_title);

CREATE INDEX IF NOT EXISTS idx_ces_plantilla_source_row 
    ON ces_plantilla_report (source_row_number);

-- Comments
COMMENT ON TABLE ces_plantilla_report IS 
    'DepEd Career Executive Service (CES) Plantilla Report sourced from "CES Plantilla Report_10 September 2026(Plantilla Report).csv".';

COMMENT ON COLUMN ces_plantilla_report.source_row_number IS 
    'Original line number in source CSV file (Lines 2 to 615).';

COMMENT ON COLUMN ces_plantilla_report.office_bureau_division IS 
    'Office, Bureau, or Division assignment (e.g. Department of Education, Regional Office, Division).';

COMMENT ON COLUMN ces_plantilla_report.region IS 
    'Administrative Region (Central Office, REGION I through REGION XIII, NIR, CAR, NCR).';

COMMENT ON COLUMN ces_plantilla_report.position_title IS 
    'Position title (e.g. Secretary, Undersecretary, Director IV, Schools Division Superintendent).';

COMMENT ON COLUMN ces_plantilla_report.dbm_item_no IS 
    'DBM Plantilla Item Number (e.g. OSEC-DECSB-DESEC-1-1998, New item). Normalized to uppercase.';

COMMENT ON COLUMN ces_plantilla_report.salary_grade IS 
    'Salary Grade (e.g. 25 through 31).';

COMMENT ON COLUMN ces_plantilla_report.incumbent_name IS 
    'Name of the incumbent official or VACANT.';

COMMENT ON COLUMN ces_plantilla_report.status_of_appointment IS 
    'Status of appointment (e.g. Permanent, Coterminous, Temporary).';

COMMENT ON COLUMN ces_plantilla_report.is_vacant IS 
    'Flag indicating whether position is vacant (incumbent_name is VACANT, empty, or unassigned).';

COMMENT ON COLUMN ces_plantilla_report.is_section_header IS 
    'Flag indicating whether row is a regional section divider row in the report.';

COMMIT;

-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS ces_plantilla_report CASCADE;
-- COMMIT;
