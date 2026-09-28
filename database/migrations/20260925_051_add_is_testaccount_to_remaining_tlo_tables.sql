-- ====================================================================
-- Migration: 20260925_051_add_is_testaccount_to_remaining_tlo_tables.sql
-- Description: Add is_testaccount column with default FALSE and btree indexes
--              to all remaining TLO domain, child, plantilla, assignment, 
--              and audit tables to guarantee complete test environment isolation.
-- ====================================================================

BEGIN;

-- Helper function to safely add is_testaccount column and index only if table exists
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'ces_plantilla',
        'tlo_assignments',
        'tlo_masterlist',
        'tlo_plantilla',
        'third_level_officials_updates',
        'tlo_education_records',
        'tlo_eligibility_records',
        'tlo_position_history',
        'tlo_training_records',
        'tlo_accomplishment_records',
        'tlo_other_courses',
        'notable_achievements'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_testaccount BOOLEAN NOT NULL DEFAULT FALSE;', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (is_testaccount);', 'idx_' || tbl || '_is_testaccount', tbl);
        END IF;
    END LOOP;
END $$;

-- Backfill: Synchronize is_testaccount for existing child and audit records
-- belonging to test officials in third_level_official_masterlist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'third_level_officials_updates') THEN
        UPDATE third_level_officials_updates u
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE u."TLOid" = m."TLOid" AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_education_records') THEN
        UPDATE tlo_education_records ed
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(ed.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_eligibility_records') THEN
        UPDATE tlo_eligibility_records el
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(el.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_position_history') THEN
        UPDATE tlo_position_history ph
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(ph.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_training_records') THEN
        UPDATE tlo_training_records tr
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(tr.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_accomplishment_records') THEN
        UPDATE tlo_accomplishment_records ar
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(ar.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_other_courses') THEN
        UPDATE tlo_other_courses oc
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(oc.tlo_id) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_masterlist') THEN
        UPDATE tlo_masterlist tm
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE LOWER(tm.tloid) = LOWER(m."TLOid") AND m.is_testaccount = TRUE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_assignments') THEN
        UPDATE tlo_assignments a
        SET is_testaccount = TRUE
        FROM third_level_official_masterlist m
        WHERE a.tlo_masterlist_id::text = m."TLOid" AND m.is_testaccount = TRUE;
    END IF;
END $$;

COMMIT;

-- ====================================================================
-- Rollback Instructions:
-- ====================================================================
-- BEGIN;
-- ALTER TABLE IF EXISTS ces_plantilla DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_assignments DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_masterlist DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_plantilla DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS third_level_officials_updates DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_education_records DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_eligibility_records DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_position_history DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_training_records DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_accomplishment_records DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS tlo_other_courses DROP COLUMN IF EXISTS is_testaccount;
-- ALTER TABLE IF EXISTS notable_achievements DROP COLUMN IF EXISTS is_testaccount;
-- COMMIT;

