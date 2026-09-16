-- =========================================================================================
-- Migration: 20260916_042_sync_and_clean_tlo_masterlist.sql
-- Description:
--   1. Deletes 18 records from tlo_masterlist:
--      - 16 vacant/empty records
--      - 2 records present in tlo_masterlist but not present in the valid source masterlist
--   2. Synchronizes the 707 valid personnel records from third_level_official_masterlist,
--      preserving existing tlo_masterlist.id primary keys.
--   3. Explicitly resolves 4 anomaly records (TLO-0098, TLO-0100, TLO-0415, TLO-0586).
--   4. Leaves third_level_official_masterlist completely untouched.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- Step 1: Remove the 18 records
DELETE FROM tlo_masterlist
WHERE tloid IN (
  -- 16 vacant/empty records
  'TLO-0090', 'TLO-0092', 'TLO-0093', 'TLO-0094', 'TLO-0095',
  'TLO-0168', 'TLO-0174', 'TLO-0190', 'TLO-0256', 'TLO-0300',
  'TLO-0489', 'TLO-0499', 'TLO-0529', 'TLO-0555', 'TLO-0567', 'TLO-0624',
  -- 2 records present in tlo_masterlist but not present in the valid source masterlist
  'TLO-0724', 'TLO-0725'
);

-- Step 2: Synchronize the 707 valid personnel records, preserving existing id values
UPDATE tlo_masterlist m
SET
  first_name = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'DONATO'
    WHEN o."TLOid" = 'TLO-0100' THEN 'JOEL B.'
    WHEN o."TLOid" = 'TLO-0415' THEN 'MARIZA S.'
    WHEN o."TLOid" = 'TLO-0586' THEN 'IRENE S.'
    ELSE NULLIF(TRIM(o.first_name), '')
  END,
  last_name = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'BALDERAS'
    WHEN o."TLOid" = 'TLO-0100' THEN 'LOPEZ'
    WHEN o."TLOid" = 'TLO-0415' THEN 'MAGAN'
    WHEN o."TLOid" = 'TLO-0586' THEN 'ANGWAY'
    ELSE NULLIF(TRIM(o.last_name), '')
  END,
  middle_name = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'DULCE'
    WHEN o."TLOid" = 'TLO-0100' THEN NULL
    WHEN o."TLOid" = 'TLO-0415' THEN NULL
    WHEN o."TLOid" = 'TLO-0586' THEN NULL
    ELSE NULLIF(TRIM(o.middle_name), '')
  END,
  suffix = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'JR'
    WHEN o."TLOid" = 'TLO-0100' THEN NULL
    WHEN o."TLOid" = 'TLO-0415' THEN NULL
    WHEN o."TLOid" = 'TLO-0586' THEN NULL
    ELSE NULLIF(TRIM(o.suffix), '')
  END,
  gender = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'MALE'
    WHEN o."TLOid" = 'TLO-0100' THEN NULL
    WHEN o."TLOid" = 'TLO-0415' THEN 'FEMALE'
    WHEN o."TLOid" = 'TLO-0586' THEN NULL
    ELSE NULLIF(TRIM(o.gender), '')
  END,
  plantilla_item_no = CASE
    WHEN o."TLOid" = 'TLO-0098' THEN 'OSEC-DECSB-SDS-60011-1998'
    WHEN o."TLOid" = 'TLO-0100' THEN NULL
    WHEN o."TLOid" = 'TLO-0415' THEN 'OSEC-DECSB-SDS-540001-2008'
    WHEN o."TLOid" = 'TLO-0586' THEN NULL
    ELSE NULLIF(TRIM(o.plantilla_item_no), '')
  END,
  updated_at = NOW()
FROM third_level_official_masterlist o
WHERE LOWER(TRIM(m.tloid)) = LOWER(TRIM(o."TLOid"))
  AND NOT (
    UPPER(TRIM(COALESCE(o.first_name, ''))) LIKE '%VACANT%'
    OR UPPER(TRIM(COALESCE(o.last_name, ''))) LIKE '%VACANT%'
    OR ((o.first_name IS NULL OR TRIM(o.first_name) = '') AND (o.last_name IS NULL OR TRIM(o.last_name) = ''))
  );

COMMIT;

-- =========================================================================================
-- ROLLBACK SCRIPT:
-- In case of emergency rollback, the 18 deleted records can be restored with:
-- INSERT INTO tlo_masterlist (tloid, first_name, last_name, created_at, updated_at) VALUES
--   ('TLO-0090', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0092', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0093', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0094', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0095', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0168', 'VACANT', NULL, NOW(), NOW()),
--   ('TLO-0174', NULL, NULL, NOW(), NOW()),
--   ('TLO-0190', NULL, NULL, NOW(), NOW()),
--   ('TLO-0256', NULL, NULL, NOW(), NOW()),
--   ('TLO-0300', NULL, NULL, NOW(), NOW()),
--   ('TLO-0489', NULL, NULL, NOW(), NOW()),
--   ('TLO-0499', NULL, NULL, NOW(), NOW()),
--   ('TLO-0529', NULL, NULL, NOW(), NOW()),
--   ('TLO-0555', NULL, NULL, NOW(), NOW()),
--   ('TLO-0567', NULL, NULL, NOW(), NOW()),
--   ('TLO-0624', NULL, NULL, NOW(), NOW()),
--   ('TLO-0724', 'NICASIO S.', 'FRIO', NOW(), NOW()),
--   ('TLO-0725', 'MARINA S.', 'SALAMANCA', NOW(), NOW())
-- ON CONFLICT (tloid) DO NOTHING;
-- =========================================================================================
