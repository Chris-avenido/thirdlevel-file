-- Migration: 20261028_057_add_tloid_link_to_vacancy_applicants.sql
-- Description: Add vacancy_applicant_id to third_level_official_masterlist to store
--              the reference ID of the appointed vacancy applicant without modifying
--              the schemas of vacancy_applicants or vacancy_applications.
-- Author: Master Backend Engineer
-- Date: 2026-10-28

BEGIN;

-- Add vacancy_applicant_id to third_level_official_masterlist
ALTER TABLE third_level_official_masterlist 
    ADD COLUMN IF NOT EXISTS vacancy_applicant_id INTEGER REFERENCES vacancy_applicants(id) ON DELETE SET NULL;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_vacancy_applicant_id 
    ON third_level_official_masterlist(vacancy_applicant_id);

-- Documentation
COMMENT ON COLUMN third_level_official_masterlist.vacancy_applicant_id IS 'ID of the vacancy_applicants record from which this official was appointed';

COMMIT;

-- Rollback Script:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_tlo_masterlist_vacancy_applicant_id;
-- ALTER TABLE third_level_official_masterlist DROP COLUMN IF EXISTS vacancy_applicant_id;
-- COMMIT;
