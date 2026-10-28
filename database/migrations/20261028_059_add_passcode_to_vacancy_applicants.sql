-- Migration: Add passcode column to vacancy_applicants table
-- Description: Adds passcode column to vacancy_applicants and synchronizes existing passcodes from tlo_users so Vacancy Applicants can authenticate using 6-digit passcode.
-- Date: 2026-10-28

BEGIN;

-- 1. Add passcode column to vacancy_applicants
ALTER TABLE vacancy_applicants 
ADD COLUMN IF NOT EXISTS passcode VARCHAR(255);

-- 2. Populate passcode from tlo_users for any existing vacancy applicants
UPDATE vacancy_applicants va
SET passcode = u.passcode
FROM tlo_users u
WHERE LOWER(u.email) = LOWER(va.email)
  AND va.passcode IS NULL
  AND u.passcode IS NOT NULL;

COMMIT;

-- Rollback Script:
-- BEGIN;
-- ALTER TABLE vacancy_applicants DROP COLUMN IF EXISTS passcode;
-- COMMIT;
