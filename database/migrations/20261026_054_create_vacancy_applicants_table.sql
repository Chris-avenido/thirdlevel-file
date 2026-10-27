-- Migration: 20261026_054_create_vacancy_applicants_table.sql
-- Description: Create dedicated vacancy_applicants table for candidate users
--              registering through the Vacancies (Open Positions & Opportunities) portal.
-- Author: Antigravity Assistant
-- Date: 2026-10-26

BEGIN;

CREATE TABLE IF NOT EXISTS vacancy_applicants (
    id SERIAL PRIMARY KEY,
    applicant_uid VARCHAR(64) UNIQUE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    middle_name VARCHAR(150),
    suffix VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    contact_number VARCHAR(50),
    registration_status VARCHAR(50) DEFAULT 'Active' NOT NULL,
    target_vacancy_id VARCHAR(100),
    target_position_title VARCHAR(255),
    notes TEXT,
    is_testaccount BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indices for performance and lookup
CREATE INDEX IF NOT EXISTS idx_vacancy_applicants_email ON vacancy_applicants (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_vacancy_applicants_uid ON vacancy_applicants (applicant_uid);
CREATE INDEX IF NOT EXISTS idx_vacancy_applicants_is_testaccount ON vacancy_applicants (is_testaccount);

COMMIT;

-- Rollback Script:
-- BEGIN;
-- DROP TABLE IF EXISTS vacancy_applicants CASCADE;
-- COMMIT;
