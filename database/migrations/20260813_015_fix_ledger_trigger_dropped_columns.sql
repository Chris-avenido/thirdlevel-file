-- =============================================================================
-- Migration  : 20260813_015_fix_ledger_trigger_dropped_columns.sql
-- Description: Update audit ledger trigger functions (fn_tlo_append_ledger & log_masterlist_changes)
--              to pass NULL for dropped profile columns (previous_positions, highest_education, 
--              education_program, education_year_graduated, relevant_trainings).
-- Purpose    : Prevents PostgreSQL runtime error 'record "new" has no field "previous_positions"'
--              when inserting or updating records in third_level_official_masterlist.
-- Safety     : Idempotent function replacement within a transaction block.
-- Author     : Antigravity (Master Debugger)
-- Date       : 2026-08-13
-- =============================================================================

BEGIN;

-- 1. Update fn_tlo_append_ledger trigger function
CREATE OR REPLACE FUNCTION public.fn_tlo_append_ledger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO third_level_officials_updates (
        "TLOid", change_type, updated_by,
        sort_index, last_name, first_name, middle_name, suffix,
        gender, date_of_birth, civil_status,
        strand, office, designation, assignment, date_of_assignment,
        position_title, status,
        email, alt_email_1, alt_email_2,
        contact_details, alt_contact_details_1, alt_contact_details_2, permanent_address,
        emt_passer, emt_date, ces_stage, ces_conferment_date,
        previous_positions, total_years_third_level,
        highest_education, education_program, education_year_graduated, relevant_trainings,
        notable_achievements, performance_rating_ipcrf, performance_rating_cespes,
        photo_binary_id, pds_binary_id, profile_word_binary_id,
        profile_ppt_binary_id, service_records_binary_id,
        pending_admin_case, ombudsman_case, created_at, updated_at
    )
    VALUES (
        NEW."TLOid",
        CASE TG_OP WHEN 'INSERT' THEN 'INITIAL_ENTRY' ELSE 'PROFILE_UPDATE' END,
        current_setting('app.current_user', true),
        NEW.sort_index, NEW.last_name, NEW.first_name, NEW.middle_name, NEW.suffix,
        NEW.gender, NEW.date_of_birth, NEW.civil_status,
        NEW.strand, NEW.office, NEW.designation, NEW.assignment, NEW.date_of_assignment,
        NEW.position_title, NEW.status,
        NEW.email, NEW.alt_email_1, NEW.alt_email_2,
        NEW.contact_details, NEW.alt_contact_details_1, NEW.alt_contact_details_2, NEW.permanent_address,
        NEW.emt_passer, NEW.emt_date, NEW.ces_stage, NEW.ces_conferment_date,
        NULL, NEW.total_years_third_level,
        NULL, NULL, NULL, NULL,
        NEW.notable_achievements, NEW.performance_rating_ipcrf, NEW.performance_rating_cespes,
        NEW.photo_binary_id, NEW.pds_binary_id, NEW.profile_word_binary_id,
        NEW.profile_ppt_binary_id, NEW.service_records_binary_id,
        NEW.pending_admin_case, NEW.ombudsman_case, NOW(), NOW()
    );
    RETURN NEW;
END;
$function$;

-- 2. Update log_masterlist_changes trigger function
CREATE OR REPLACE FUNCTION public.log_masterlist_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO third_level_officials_updates (
        "TLOid", change_type, updated_by,
        sort_index, last_name, first_name, middle_name, suffix,
        gender, date_of_birth, civil_status,
        strand, office, designation, assignment, date_of_assignment,
        position_title, status,
        email, alt_email_1, alt_email_2,
        contact_details, alt_contact_details_1, alt_contact_details_2, permanent_address,
        emt_passer, emt_date, ces_stage, ces_conferment_date,
        previous_positions, total_years_third_level,
        highest_education, education_program, education_year_graduated, relevant_trainings,
        notable_achievements, performance_rating_ipcrf, performance_rating_cespes,
        photo_binary_id, pds_binary_id, profile_word_binary_id,
        profile_ppt_binary_id, service_records_binary_id,
        pending_admin_case, ombudsman_case, created_at, updated_at
    )
    VALUES (
        NEW."TLOid",
        CASE TG_OP WHEN 'INSERT' THEN 'INITIAL_ENTRY' ELSE 'PROFILE_UPDATE' END,
        current_setting('app.current_user', true),
        NEW.sort_index, NEW.last_name, NEW.first_name, NEW.middle_name, NEW.suffix,
        NEW.gender, NEW.date_of_birth, NEW.civil_status,
        NEW.strand, NEW.office, NEW.designation, NULL, NULL,
        NEW.position_title, NEW.status,
        NEW.email, NEW.alt_email_1, NEW.alt_email_2,
        NEW.contact_details, NEW.alt_contact_details_1, NEW.alt_contact_details_2, NEW.permanent_address,
        NEW.emt_passer, NEW.emt_date, NEW.ces_stage, NEW.ces_conferment_date,
        NULL, NEW.total_years_third_level,
        NULL, NULL, NULL, NULL,
        NEW.notable_achievements, NEW.performance_rating_ipcrf, NEW.performance_rating_cespes,
        NEW.photo_binary_id, NEW.pds_binary_id, NEW.profile_word_binary_id,
        NEW.profile_ppt_binary_id, NEW.service_records_binary_id,
        NEW.pending_admin_case, NEW.ombudsman_case, NOW(), NOW()
    );
    RETURN NEW;
END;
$function$;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (Run manually if rollback is ever required):
-- =============================================================================
-- Execute `20260807_010_drop_redundant_profile_columns.sql` rollback section first 
-- to re-add columns to third_level_official_masterlist before reverting function definitions.
