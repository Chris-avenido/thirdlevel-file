-- Migration: 20260925_053_add_child_table_is_testaccount_triggers.sql
-- Description: Add triggers to child tables and assignments to automatically inherit is_testaccount from parent official
-- Author: Antigravity AI
-- Date: 2026-09-25

BEGIN;

-- 1. Create function to inherit is_testaccount for child profile tables
CREATE OR REPLACE FUNCTION fn_tlo_child_inherit_testaccount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_testaccount IS NULL OR NEW.is_testaccount = FALSE THEN
        IF NEW.source_table = 'staging' THEN
            SELECT is_testaccount INTO NEW.is_testaccount
            FROM third_level_officials_profiling_application
            WHERE LOWER(app_TLOid) = LOWER(NEW.tlo_id)
            LIMIT 1;
        ELSE
            SELECT is_testaccount INTO NEW.is_testaccount
            FROM third_level_official_masterlist
            WHERE LOWER("TLOid") = LOWER(NEW.tlo_id)
            LIMIT 1;
        END IF;
        NEW.is_testaccount := COALESCE(NEW.is_testaccount, FALSE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to the 6 normalized child tables
DROP TRIGGER IF EXISTS trg_inherit_testaccount_education ON tlo_education_records;
CREATE TRIGGER trg_inherit_testaccount_education
BEFORE INSERT OR UPDATE ON tlo_education_records
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

DROP TRIGGER IF EXISTS trg_inherit_testaccount_eligibility ON tlo_eligibility_records;
CREATE TRIGGER trg_inherit_testaccount_eligibility
BEFORE INSERT OR UPDATE ON tlo_eligibility_records
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

DROP TRIGGER IF EXISTS trg_inherit_testaccount_positions ON tlo_position_history;
CREATE TRIGGER trg_inherit_testaccount_positions
BEFORE INSERT OR UPDATE ON tlo_position_history
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

DROP TRIGGER IF EXISTS trg_inherit_testaccount_trainings ON tlo_training_records;
CREATE TRIGGER trg_inherit_testaccount_trainings
BEFORE INSERT OR UPDATE ON tlo_training_records
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

DROP TRIGGER IF EXISTS trg_inherit_testaccount_accomplishments ON tlo_accomplishment_records;
CREATE TRIGGER trg_inherit_testaccount_accomplishments
BEFORE INSERT OR UPDATE ON tlo_accomplishment_records
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

DROP TRIGGER IF EXISTS trg_inherit_testaccount_courses ON tlo_other_courses;
CREATE TRIGGER trg_inherit_testaccount_courses
BEFORE INSERT OR UPDATE ON tlo_other_courses
FOR EACH ROW EXECUTE FUNCTION fn_tlo_child_inherit_testaccount();

-- 3. Create function for tlo_assignments to inherit is_testaccount
CREATE OR REPLACE FUNCTION fn_tlo_assignments_inherit_testaccount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_testaccount IS NULL OR NEW.is_testaccount = FALSE THEN
        -- Check via tlo_masterlist_id
        IF NEW.tlo_masterlist_id IS NOT NULL THEN
            SELECT is_testaccount INTO NEW.is_testaccount
            FROM tlo_masterlist
            WHERE id = NEW.tlo_masterlist_id
            LIMIT 1;
        END IF;

        -- If still false/null, check via tlo_position_id
        IF (NEW.is_testaccount IS NULL OR NEW.is_testaccount = FALSE) AND NEW.tlo_position_id IS NOT NULL THEN
            SELECT is_testaccount INTO NEW.is_testaccount
            FROM third_level_official_masterlist
            WHERE LOWER("TLOid") = LOWER(NEW.tlo_position_id)
            LIMIT 1;
        END IF;

        NEW.is_testaccount := COALESCE(NEW.is_testaccount, FALSE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_testaccount_assignments ON tlo_assignments;
CREATE TRIGGER trg_inherit_testaccount_assignments
BEFORE INSERT OR UPDATE ON tlo_assignments
FOR EACH ROW EXECUTE FUNCTION fn_tlo_assignments_inherit_testaccount();

COMMIT;

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_education ON tlo_education_records;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_eligibility ON tlo_eligibility_records;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_positions ON tlo_position_history;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_trainings ON tlo_training_records;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_accomplishments ON tlo_accomplishment_records;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_courses ON tlo_other_courses;
-- DROP TRIGGER IF EXISTS trg_inherit_testaccount_assignments ON tlo_assignments;
-- DROP FUNCTION IF EXISTS fn_tlo_child_inherit_testaccount();
-- DROP FUNCTION IF EXISTS fn_tlo_assignments_inherit_testaccount();
