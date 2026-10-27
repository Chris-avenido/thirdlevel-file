-- Migration: 20261027_056_create_vacancy_applications_table.sql
-- Description: Create dedicated vacancy_applications table for storing complete application
--              submissions for Third Level vacant positions (SDS & ASDS), capturing all form
--              fields and document binary attachments corresponding to the DepEd Application Form.
-- Author: Antigravity Assistant
-- Date: 2026-10-27

BEGIN;

CREATE TABLE IF NOT EXISTS vacancy_applications (
    id SERIAL PRIMARY KEY,
    application_no VARCHAR(64) UNIQUE NOT NULL,
    applicant_uid VARCHAR(64) NOT NULL,
    vacancy_applicant_id INTEGER REFERENCES vacancy_applicants(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    contact_number VARCHAR(50),
    
    -- Position Applied For & Target Item
    position_applying_for VARCHAR(255) NOT NULL,
    target_vacancy_id VARCHAR(100),
    
    -- Personal & Current Employment Information (ALL CAPS per DepEd standard)
    surname VARCHAR(150) NOT NULL,
    first_name VARCHAR(150) NOT NULL,
    middle_name VARCHAR(150),
    date_of_birth DATE,
    current_position VARCHAR(255) NOT NULL,
    plantilla_office VARCHAR(255) NOT NULL,
    
    -- Current Third Level Designation & OIC Assignment
    current_designation VARCHAR(255) NOT NULL,
    assigned_oic_office VARCHAR(255),
    
    -- Examination & CES Eligibility Information
    is_let_passer BOOLEAN NOT NULL DEFAULT FALSE,
    is_emt_passer BOOLEAN NOT NULL DEFAULT FALSE,
    ces_eligibility_stage VARCHAR(100) NOT NULL,
    ces_stage_date DATE,
    
    -- Documentary Requirements (Binary IDs referencing unified_binaries)
    letter_of_intent_binary_id UUID,
    letter_of_intent_filename VARCHAR(255),
    
    pds_binary_id UUID,
    pds_filename VARCHAR(255),
    
    work_experience_sheet_binary_id UUID,
    work_experience_sheet_filename VARCHAR(255),
    
    cv_binary_id UUID,
    cv_filename VARCHAR(255),
    
    outstanding_accomplishments_binary_id UUID,
    outstanding_accomplishments_filename VARCHAR(255),
    
    service_records_binary_id UUID,
    service_records_filename VARCHAR(255),
    
    transcript_of_records_binary_id UUID,
    transcript_of_records_filename VARCHAR(255),
    
    performance_eval_binary_id UUID,
    performance_eval_filename VARCHAR(255),
    
    self_certification_binary_id UUID,
    self_certification_filename VARCHAR(255),
    
    id_picture_binary_id UUID,
    id_picture_filename VARCHAR(255),
    
    applicant_profile_doc_binary_id UUID,
    applicant_profile_doc_filename VARCHAR(255),
    
    other_documents_binary_id UUID,
    other_documents_filename VARCHAR(255),
    
    -- Status & Workflow Tracking
    status VARCHAR(50) DEFAULT 'Submitted' NOT NULL,
    remarks TEXT,
    is_testaccount BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indices for lookup, applicant tracking, and status filtering
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_app_no ON vacancy_applications (application_no);
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_applicant_uid ON vacancy_applications (applicant_uid);
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_applicant_id ON vacancy_applications (vacancy_applicant_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_email ON vacancy_applications (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_position ON vacancy_applications (position_applying_for);
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_status ON vacancy_applications (status);
CREATE INDEX IF NOT EXISTS idx_vacancy_applications_is_testaccount ON vacancy_applications (is_testaccount);

COMMIT;

-- Rollback Script:
-- BEGIN;
-- DROP TABLE IF EXISTS vacancy_applications CASCADE;
-- COMMIT;
