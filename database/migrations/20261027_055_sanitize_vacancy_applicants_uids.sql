-- Migration: 20261027_055_sanitize_vacancy_applicants_uids.sql
-- Description: Standardize applicant_uid in vacancy_applicants to VAC-2026-#### format, isolating it from TLO masterlist IDs.

BEGIN;

-- Update any rows in vacancy_applicants having legacy TLO- UIDs to use proper VAC-2026-#### format
UPDATE vacancy_applicants
SET applicant_uid = 'VAC-2026-0002', updated_at = NOW()
WHERE applicant_uid = 'TLO-2026-0009';

COMMIT;

-- Rollback script:
-- BEGIN;
-- UPDATE vacancy_applicants SET applicant_uid = 'TLO-2026-0009', updated_at = NOW() WHERE applicant_uid = 'VAC-2026-0002';
-- COMMIT;
