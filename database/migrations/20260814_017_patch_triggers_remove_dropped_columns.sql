-- =============================================================================
-- Migration  : 20260814_017_patch_triggers_remove_dropped_columns.sql
-- Description: Permanent, idempotent re-patch of ALL audit trigger functions that
--              reference columns dropped by migration 20260807_010:
--                  previous_positions, highest_education, education_program,
--                  education_year_graduated, relevant_trainings
-- Root Cause : Migration 20260813_015 fixed these triggers but was not applied to
--              all database environments. When those environments execute any
--              INSERT/UPDATE on third_level_official_masterlist the trigger fires,
--              reads NEW.previous_positions, finds no such column, and raises:
--                  ERROR: record "new" has no field "previous_positions"
-- Safety     : CREATE OR REPLACE is idempotent. This migration may be re-run safely
--              on any environment any number of times with zero data impact.
-- Scope      : fn_tlo_append_ledger, log_masterlist_changes
-- Author     : Antigravity (Master Debugger)
-- Date       : 2026-08-14
-- =============================================================================

BEGIN;

-- ─── 1. Patch fn_tlo_append_ledger ──────────────────────────────────────────
-- All references to NEW.previous_positions, NEW.highest_education,
-- NEW.education_program, NEW.education_year_graduated, NEW.relevant_trainings
-- are replaced with NULL because those columns were dropped in migration 010.
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
        -- Columns dropped in migration 20260807_010 — permanently hardcoded to NULL:
        NULL,                       -- previous_positions (dropped)
        NEW.total_years_third_level,
        NULL,                       -- highest_education (dropped)
        NULL,                       -- education_program (dropped)
        NULL,                       -- education_year_graduated (dropped)
        NULL,                       -- relevant_trainings (dropped)
        NEW.notable_achievements, NEW.performance_rating_ipcrf, NEW.performance_rating_cespes,
        NEW.photo_binary_id, NEW.pds_binary_id, NEW.profile_word_binary_id,
        NEW.profile_ppt_binary_id, NEW.service_records_binary_id,
        NEW.pending_admin_case, NEW.ombudsman_case, NOW(), NOW()
    );
    RETURN NEW;
END;
$function$;

-- ─── 2. Patch log_masterlist_changes ────────────────────────────────────────
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
        -- Columns dropped in migration 20260807_010 — permanently hardcoded to NULL:
        NULL,                       -- previous_positions (dropped)
        NEW.total_years_third_level,
        NULL,                       -- highest_education (dropped)
        NULL,                       -- education_program (dropped)
        NULL,                       -- education_year_graduated (dropped)
        NULL,                       -- relevant_trainings (dropped)
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
-- VERIFICATION QUERY (run after applying to confirm triggers are patched):
-- =============================================================================
-- SELECT routine_name, routine_definition
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('fn_tlo_append_ledger', 'log_masterlist_changes')
-- ORDER BY routine_name;
--
-- The output should NOT contain the string 'NEW.previous_positions'.
-- =============================================================================
--
-- ROLLBACK: This migration is a function replacement only — no schema changes.
-- To roll back, re-apply migration 20260813_015 (which is functionally identical
-- and also safe to re-run idempotently).
-- =============================================================================
