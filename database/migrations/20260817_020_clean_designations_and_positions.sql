-- Migration: 20260817_020_clean_designations_and_positions.sql
-- Description: Cleans dirty designations and position titles in third_level_official_masterlist
--              Removes footnote symbols (¹), spreadsheet artifacts ((excess), (concurrent)),
--              normalizes OIC- hyphenation, and standardizes ALL-CAPS titles to Title Case.
-- Safety: Idempotent data normalization, non-destructive to official records.
--
-- Rollback Instructions:
-- Manual rollback script available in comments at bottom of this file.

BEGIN;

-- 1. Clean footnote symbols, parenthetical annotations, and inconsistent hyphens in designations
UPDATE third_level_official_masterlist
SET designation = 'OIC Assistant Schools Division Superintendent',
    updated_at = NOW()
WHERE designation IN (
    'OIC Assistant Schools Division Superintendent¹',
    'OIC Assistant Schools Division Superintendent (excess)',
    'OIC ASSISTANT SCHOOLS DIVISION SUPERINTENDENT'
);

UPDATE third_level_official_masterlist
SET designation = 'OIC Schools Division Superintendent',
    updated_at = NOW()
WHERE designation IN (
    'OIC-Schools Division Superintendent',
    'OIC Schools Division Superintendent (concurrent)'
);

UPDATE third_level_official_masterlist
SET designation = 'OIC Director IV',
    updated_at = NOW()
WHERE designation = 'OIC Director IV (concurrent)';

UPDATE third_level_official_masterlist
SET designation = 'OIC Assistant Regional Director',
    updated_at = NOW()
WHERE designation = 'OIC ASSISTANT REGIONAL DIRECTOR';

UPDATE third_level_official_masterlist
SET designation = 'Director III',
    updated_at = NOW()
WHERE designation = 'DIRECTOR III';

-- 2. Clean ALL-CAPS position titles in masterlist to proper Title Case
UPDATE third_level_official_masterlist
SET position_title = 'Director III',
    updated_at = NOW()
WHERE position_title = 'DIRECTOR III';

UPDATE third_level_official_masterlist
SET position_title = 'Attorney III',
    updated_at = NOW()
WHERE position_title = 'ATTORNEY III';

UPDATE third_level_official_masterlist
SET position_title = 'Project Development Officer V',
    updated_at = NOW()
WHERE position_title = 'PROJECT DEVELOPMENT OFFICER V';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Run only if you need to revert the changes)
-- ============================================================================
-- BEGIN;
-- UPDATE third_level_official_masterlist SET designation = 'OIC Director IV (concurrent)' WHERE "TLOid" = 'TLO-0076';
-- UPDATE third_level_official_masterlist SET designation = 'OIC-Schools Division Superintendent' WHERE "TLOid" = 'TLO-0122';
-- UPDATE third_level_official_masterlist SET designation = 'OIC Schools Division Superintendent (concurrent)' WHERE "TLOid" IN ('TLO-0166', 'TLO-0413', 'TLO-0423', 'TLO-0498');
-- UPDATE third_level_official_masterlist SET designation = 'OIC Assistant Schools Division Superintendent¹' WHERE "TLOid" = 'TLO-0416';
-- UPDATE third_level_official_masterlist SET designation = 'OIC Assistant Schools Division Superintendent (excess)' WHERE "TLOid" = 'TLO-0439';
-- UPDATE third_level_official_masterlist SET designation = 'DIRECTOR III' WHERE "TLOid" = 'TLO-0624';
-- UPDATE third_level_official_masterlist SET designation = 'OIC ASSISTANT SCHOOLS DIVISION SUPERINTENDENT' WHERE "TLOid" = 'TLO-0408';
-- UPDATE third_level_official_masterlist SET designation = 'OIC ASSISTANT REGIONAL DIRECTOR' WHERE "TLOid" = 'TLO-0625';
-- COMMIT;
