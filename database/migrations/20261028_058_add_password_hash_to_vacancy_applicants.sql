-- Migration: 20261028_058_add_password_hash_to_vacancy_applicants.sql
-- Description: Add password_hash column to vacancy_applicants table so vacancy applicants
--              are fully isolated from tlo_users during registration and portal authentication.
-- Author: Antigravity Assistant
-- Date: 2026-10-28

BEGIN;

-- 1. Add password_hash column to vacancy_applicants
ALTER TABLE vacancy_applicants 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 2. Populate password_hash from tlo_users for any existing vacancy applicants
UPDATE vacancy_applicants va
SET password_hash = u.password_hash
FROM tlo_users u
WHERE LOWER(u.email) = LOWER(va.email)
  AND va.password_hash IS NULL
  AND u.password_hash IS NOT NULL;

COMMIT;

-- Rollback Script:
-- BEGIN;
-- ALTER TABLE vacancy_applicants DROP COLUMN IF EXISTS password_hash;
-- COMMIT;
