-- ============================================================
-- Migration  : 20260810_013
-- Description: Add is_testaccount boolean column to masterlist and profiling tables
-- Purpose    : Allow filtering out test accounts (is_testaccount = false) on dashboards
--              without needing to hard-delete test data. Also seeds sample test accounts.
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-10
-- ============================================================

BEGIN;

-- 1. Add is_testaccount column to masterlist
ALTER TABLE third_level_official_masterlist
    ADD COLUMN IF NOT EXISTS is_testaccount BOOLEAN DEFAULT FALSE;

-- 2. Add is_testaccount column to profiling application table
ALTER TABLE third_level_officials_profiling_application
    ADD COLUMN IF NOT EXISTS is_testaccount BOOLEAN DEFAULT FALSE;

-- 3. Create index for fast filtering on dashboards
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_is_testaccount
    ON third_level_official_masterlist (is_testaccount);

CREATE INDEX IF NOT EXISTS idx_tlo_app_is_testaccount
    ON third_level_officials_profiling_application (is_testaccount);

-- 4. Mark existing test accounts based on email / name patterns
UPDATE third_level_official_masterlist
SET is_testaccount = TRUE
WHERE LOWER(email) LIKE '%test%'
   OR LOWER(email) LIKE '%sample%'
   OR LOWER(email) LIKE '%demo%'
   OR LOWER(first_name) LIKE '%test%'
   OR LOWER(last_name) LIKE '%test%';

UPDATE third_level_officials_profiling_application
SET is_testaccount = TRUE
WHERE LOWER(email) LIKE '%test%'
   OR LOWER(email) LIKE '%sample%'
   OR LOWER(email) LIKE '%demo%'
   OR LOWER(first_name) LIKE '%test%'
   OR LOWER(last_name) LIKE '%test%';

-- 5. Seed default test accounts for testing dashboard filtering and features
INSERT INTO third_level_official_masterlist (
    "TLOid", first_name, last_name, email, position_title, office, strand, region, status, is_testaccount, created_at, updated_at
) VALUES 
('TLO-TEST-0001', 'TEST_OFFICIAL', 'ONE', 'test.official1@deped.gov.ph', 'Director IV', 'Central Office', 'Office of the Secretary', 'NCR', 'Active', TRUE, NOW(), NOW()),
('TLO-TEST-0002', 'TEST_OFFICIAL', 'TWO', 'test.official2@deped.gov.ph', 'Schools Division Superintendent', 'SDO Pasig', 'Operations', 'Region IV-A', 'Active', TRUE, NOW(), NOW()),
('TLO-TEST-0003', 'TEST_APPLICANT', 'THREE', 'test.applicant3@deped.gov.ph', 'Assistant Schools Division Superintendent', 'SDO Quezon', 'Governance', 'Region IV-A', 'For Approval', TRUE, NOW(), NOW())
ON CONFLICT ("TLOid") DO UPDATE SET 
    is_testaccount = EXCLUDED.is_testaccount,
    updated_at = NOW();

COMMIT;

-- ============================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================
-- BEGIN;
-- DELETE FROM third_level_official_masterlist WHERE "TLOid" LIKE 'TLO-TEST-%';
-- DROP INDEX IF EXISTS idx_tlo_masterlist_is_testaccount;
-- DROP INDEX IF EXISTS idx_tlo_app_is_testaccount;
-- ALTER TABLE third_level_official_masterlist DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE third_level_officials_profiling_application DROP COLUMN IF EXISTS is_testaccount;
-- COMMIT;
