-- =========================================================================================
-- Migration: 20260917_045_sync_third_level_official_to_tlo_masterlist.sql
-- Description:
--   1. Automatically synchronizes new personnel registered or inserted into
--      'third_level_official_masterlist' directly into 'tlo_masterlist'.
--   2. Creates a trigger function 'fn_sync_third_level_to_tlo_masterlist' and an AFTER
--      INSERT OR UPDATE trigger on 'third_level_official_masterlist'.
--   3. Automatically ignores vacant placeholder records while guaranteeing that valid
--      registered users/officials immediately exist in 'tlo_masterlist'.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple executions.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Create or replace the synchronization trigger function
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
                updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to third_level_official_masterlist
DROP TRIGGER IF EXISTS trg_sync_third_level_to_tlo_masterlist ON third_level_official_masterlist;
CREATE TRIGGER trg_sync_third_level_to_tlo_masterlist
AFTER INSERT OR UPDATE ON third_level_official_masterlist
FOR EACH ROW
EXECUTE FUNCTION fn_sync_third_level_to_tlo_masterlist();

-- 3. Backfill any existing valid non-vacant records currently missing from tlo_masterlist
INSERT INTO tlo_masterlist (
    tloid,
    first_name,
    last_name,
    middle_name,
    suffix,
    gender,
    plantilla_item_no,
    created_at,
    updated_at
)
SELECT 
    TRIM(o."TLOid"),
    NULLIF(TRIM(o.first_name), ''),
    NULLIF(TRIM(o.last_name), ''),
    NULLIF(TRIM(o.middle_name), ''),
    NULLIF(TRIM(o.suffix), ''),
    NULLIF(TRIM(o.gender), ''),
    NULLIF(TRIM(o.plantilla_item_no), ''),
    COALESCE(o.created_at, NOW()),
    COALESCE(o.updated_at, NOW())
FROM third_level_official_masterlist o
LEFT JOIN tlo_masterlist m ON LOWER(TRIM(m.tloid)) = LOWER(TRIM(o."TLOid"))
WHERE m.id IS NULL
  AND o."TLOid" IS NOT NULL AND TRIM(o."TLOid") != ''
  AND NOT (
    UPPER(TRIM(COALESCE(o.first_name, ''))) LIKE '%VACANT%'
    OR UPPER(TRIM(COALESCE(o.last_name, ''))) LIKE '%VACANT%'
    OR ((o.first_name IS NULL OR TRIM(o.first_name) = '') AND (o.last_name IS NULL OR TRIM(o.last_name) = ''))
  )
ON CONFLICT (tloid) DO NOTHING;

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following SQL:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_sync_third_level_to_tlo_masterlist ON third_level_official_masterlist;
-- DROP FUNCTION IF EXISTS fn_sync_third_level_to_tlo_masterlist CASCADE;
-- COMMIT;
-- =========================================================================================
