-- =========================================================================================
-- Migration: 20260916_042_sync_and_clean_tlo_masterlist.sql
-- Description:
--   1. Deletes the 16 verified vacant/empty records from tlo_masterlist based on the
--      canonical server database (specifically targets TLO-0091; preserves legitimate
--      personnel TLO-0093 [RED SAINT], TLO-0724 [MARC VOLTAIRE A. PADILLA], and
--      TLO-0725 [RUSTICA R. LORENZO]).
--   2. Synchronizes all valid personnel records from third_level_official_masterlist,
--      preserving existing tlo_masterlist.id primary keys.
--   3. Explicitly resolves 4 anomaly records (TLO-0098, TLO-0100, TLO-0415, TLO-0586).
--   4. Inserts any missing valid personnel from third_level_official_masterlist.
--   5. Leaves third_level_official_masterlist completely untouched.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for multiple runs.
--   Rollback script provided at the end of this file.
-- =========================================================================================

BEGIN;

-- Step 1: Remove the 16 verified vacant/empty records based on server database
DELETE FROM tlo_masterlist
WHERE tloid IN (
  'TLO-0090', 'TLO-0091', 'TLO-0092', 'TLO-0094', 'TLO-0095',
  'TLO-0168', 'TLO-0174', 'TLO-0190', 'TLO-0256', 'TLO-0300',
  'TLO-0489', 'TLO-0499', 'TLO-0529', 'TLO-0555', 'TLO-0567', 'TLO-0624'
);

-- Step 2: Synchronize valid personnel records, preserving existing id values
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

-- Step 3: Ensure any missing valid personnel from third_level_official_masterlist exist in tlo_masterlist
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
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'DONATO'
      WHEN o."TLOid" = 'TLO-0100' THEN 'JOEL B.'
      WHEN o."TLOid" = 'TLO-0415' THEN 'MARIZA S.'
      WHEN o."TLOid" = 'TLO-0586' THEN 'IRENE S.'
      ELSE NULLIF(TRIM(o.first_name), '')
    END,
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'BALDERAS'
      WHEN o."TLOid" = 'TLO-0100' THEN 'LOPEZ'
      WHEN o."TLOid" = 'TLO-0415' THEN 'MAGAN'
      WHEN o."TLOid" = 'TLO-0586' THEN 'ANGWAY'
      ELSE NULLIF(TRIM(o.last_name), '')
    END,
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'DULCE'
      WHEN o."TLOid" IN ('TLO-0100', 'TLO-0415', 'TLO-0586') THEN NULL
      ELSE NULLIF(TRIM(o.middle_name), '')
    END,
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'JR'
      WHEN o."TLOid" IN ('TLO-0100', 'TLO-0415', 'TLO-0586') THEN NULL
      ELSE NULLIF(TRIM(o.suffix), '')
    END,
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'MALE'
      WHEN o."TLOid" = 'TLO-0415' THEN 'FEMALE'
      WHEN o."TLOid" IN ('TLO-0100', 'TLO-0586') THEN NULL
      ELSE NULLIF(TRIM(o.gender), '')
    END,
    CASE
      WHEN o."TLOid" = 'TLO-0098' THEN 'OSEC-DECSB-SDS-60011-1998'
      WHEN o."TLOid" = 'TLO-0415' THEN 'OSEC-DECSB-SDS-540001-2008'
      WHEN o."TLOid" IN ('TLO-0100', 'TLO-0586') THEN NULL
      ELSE NULLIF(TRIM(o.plantilla_item_no), '')
    END,
    COALESCE(o.created_at, NOW()),
    COALESCE(o.updated_at, NOW())
FROM third_level_official_masterlist o
WHERE NOT (
    UPPER(TRIM(COALESCE(o.first_name, ''))) LIKE '%VACANT%'
    OR UPPER(TRIM(COALESCE(o.last_name, ''))) LIKE '%VACANT%'
    OR ((o.first_name IS NULL OR TRIM(o.first_name) = '') AND (o.last_name IS NULL OR TRIM(o.last_name) = ''))
)
ON CONFLICT (tloid) DO NOTHING;

COMMIT;

-- =========================================================================================
-- ROLLBACK SCRIPT:
-- In case of emergency rollback, the 16 vacant records can be restored with:
-- BEGIN;
-- INSERT INTO tlo_masterlist (tloid, first_name, last_name, created_at, updated_at) VALUES
--   ('TLO-0090', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0091', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0092', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0094', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0095', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0168', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0174', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0190', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0256', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0300', NULL, NULL, NOW(), NOW()),
--   ('TLO-0489', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0499', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0529', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0555', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0567', 'VACANT', '', NOW(), NOW()),
--   ('TLO-0624', NULL, NULL, NOW(), NOW())
-- ON CONFLICT (tloid) DO NOTHING;
-- COMMIT;
-- =========================================================================================
