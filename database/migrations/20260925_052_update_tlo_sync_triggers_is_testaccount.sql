-- Migration: 20260925_052_update_tlo_sync_triggers_is_testaccount.sql
-- Description: Update database triggers fn_sync_third_level_to_tlo_masterlist and fn_tlo_append_ledger to propagate is_testaccount from third_level_official_masterlist
-- Author: Antigravity AI
-- Date: 2026-09-25

BEGIN;

-- 1. Update fn_sync_third_level_to_tlo_masterlist to propagate is_testaccount
CREATE OR REPLACE FUNCTION fn_sync_third_level_to_tlo_masterlist()
RETURNS TRIGGER AS $$
BEGIN
    -- Guard: Only sync non-vacant, valid records with a non-empty TLOid
    IF NEW."TLOid" IS NOT NULL AND TRIM(NEW."TLOid") != '' THEN
        IF NOT (
            UPPER(TRIM(COALESCE(NEW.first_name, ''))) LIKE '%VACANT%'
            OR UPPER(TRIM(COALESCE(NEW.last_name, ''))) LIKE '%VACANT%'
            OR ((NEW.first_name IS NULL OR TRIM(NEW.first_name) = '') AND (NEW.last_name IS NULL OR TRIM(NEW.last_name) = ''))
        ) THEN
            INSERT INTO tlo_masterlist (
                tloid,
                first_name,
                last_name,
                middle_name,
                suffix,
                gender,
                plantilla_item_no,
                is_testaccount,
                created_at,
                updated_at
            ) VALUES (
                TRIM(NEW."TLOid"),
                NULLIF(TRIM(NEW.first_name), ''),
                NULLIF(TRIM(NEW.last_name), ''),
                NULLIF(TRIM(NEW.middle_name), ''),
                NULLIF(TRIM(NEW.suffix), ''),
                NULLIF(TRIM(NEW.gender), ''),
                NULLIF(TRIM(NEW.plantilla_item_no), ''),
                COALESCE(NEW.is_testaccount, FALSE),
                COALESCE(NEW.created_at, NOW()),
                COALESCE(NEW.updated_at, NOW())
            )
            ON CONFLICT (tloid) DO UPDATE SET
                first_name = COALESCE(NULLIF(TRIM(EXCLUDED.first_name), ''), tlo_masterlist.first_name),
                last_name = COALESCE(NULLIF(TRIM(EXCLUDED.last_name), ''), tlo_masterlist.last_name),
                middle_name = COALESCE(NULLIF(TRIM(EXCLUDED.middle_name), ''), tlo_masterlist.middle_name),
                suffix = COALESCE(NULLIF(TRIM(EXCLUDED.suffix), ''), tlo_masterlist.suffix),
                gender = COALESCE(NULLIF(TRIM(EXCLUDED.gender), ''), tlo_masterlist.gender),
                plantilla_item_no = COALESCE(NULLIF(TRIM(EXCLUDED.plantilla_item_no), ''), tlo_masterlist.plantilla_item_no),
                is_testaccount = COALESCE(EXCLUDED.is_testaccount, tlo_masterlist.is_testaccount, FALSE),
                updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update fn_tlo_append_ledger to propagate is_testaccount
CREATE OR REPLACE FUNCTION fn_tlo_append_ledger()
RETURNS TRIGGER AS $$
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
        pending_admin_case, ombudsman_case, is_testaccount, created_at, updated_at
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
        NULL,
        NEW.total_years_third_level,
        NULL, NULL, NULL, NULL,
        NEW.notable_achievements, NEW.performance_rating_ipcrf, NEW.performance_rating_cespes,
        NEW.photo_binary_id, NEW.pds_binary_id, NEW.profile_word_binary_id,
        NEW.profile_ppt_binary_id, NEW.service_records_binary_id,
        NEW.pending_admin_case, NEW.ombudsman_case, COALESCE(NEW.is_testaccount, FALSE), NOW(), NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill is_testaccount on tlo_masterlist and third_level_officials_updates from third_level_official_masterlist
UPDATE tlo_masterlist m
SET is_testaccount = tlo.is_testaccount
FROM third_level_official_masterlist tlo
WHERE LOWER(TRIM(m.tloid)) = LOWER(TRIM(tlo."TLOid"))
  AND m.is_testaccount IS DISTINCT FROM tlo.is_testaccount;

UPDATE third_level_officials_updates u
SET is_testaccount = tlo.is_testaccount
FROM third_level_official_masterlist tlo
WHERE LOWER(TRIM(u."TLOid")) = LOWER(TRIM(tlo."TLOid"))
  AND u.is_testaccount IS DISTINCT FROM tlo.is_testaccount;

COMMIT;

-- Rollback instructions:
-- In case of rollback:
-- Restore previous functions without is_testaccount column in INSERT statements.
