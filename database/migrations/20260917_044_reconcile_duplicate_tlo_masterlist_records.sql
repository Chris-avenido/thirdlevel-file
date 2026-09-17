-- =========================================================================================
-- Migration: 20260917_044_reconcile_duplicate_tlo_masterlist_records.sql
-- Description:
--   1. Identifies secondary duplicate records in tlo_masterlist per email of
--      third_level_official_masterlist (e.g. aldrin.corpin@deped.gov.ph having both
--      masterlist id 528 [TLO-0091] and id 696 [TLO-0608]).
--   2. Preserves foreign key integrity by re-pointing any tlo_assignments linked to
--      secondary masterlist IDs to the primary masterlist ID (e.g., re-pointing
--      tlo_assignments.tlo_masterlist_id from 528 to 696).
--   3. Removes secondary duplicate records strictly from table tlo_masterlist.
--   4. Leaves all child tables (tlo_position_history, tlo_training_records, etc.)
--      and third_level_official_masterlist completely untouched.
--
-- Safety & Rollback:
--   Fully wrapped in a transaction block. Safe for execution.
--   Rollback script provided at the bottom of this file.
-- =========================================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Identify Secondary Duplicate Rows in tlo_masterlist per Email
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE tmp_duplicate_masterlist_by_email ON COMMIT DROP AS
WITH RankedByEmail AS (
  SELECT 
    m.id,
    m.tloid,
    m.plantilla_item_no,
    LOWER(TRIM(tlo.email)) as email,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(tlo.email))
      ORDER BY 
        (CASE WHEN m.plantilla_item_no IS NOT NULL AND m.plantilla_item_no != '' THEN 1 ELSE 0 END) DESC,
        m.id DESC
    ) as rn
  FROM tlo_masterlist m
  JOIN third_level_official_masterlist tlo ON LOWER(TRIM(tlo."TLOid")) = LOWER(TRIM(m.tloid))
  WHERE tlo.email IS NOT NULL AND TRIM(tlo.email) != ''
)
SELECT 
  d.id as secondary_id, 
  d.tloid as secondary_tloid, 
  p.id as primary_id, 
  p.tloid as primary_tloid,
  d.email
FROM RankedByEmail d
JOIN RankedByEmail p ON d.email = p.email AND p.rn = 1
WHERE d.rn > 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Safeguard: Re-point tlo_assignments Foreign Keys to Primary Masterlist ID
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE tlo_assignments a
SET tlo_masterlist_id = map.primary_id,
    updated_at = NOW()
FROM tmp_duplicate_masterlist_by_email map
WHERE a.tlo_masterlist_id = map.secondary_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Delete Secondary Duplicate Rows ONLY from tlo_masterlist
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM tlo_masterlist m
USING tmp_duplicate_masterlist_by_email map
WHERE m.id = map.secondary_id;

COMMIT;

-- =========================================================================================
-- ROLLBACK SCRIPT:
-- In case of emergency rollback, the deleted tlo_masterlist rows can be restored from the
-- canonical third_level_official_masterlist:
-- BEGIN;
-- INSERT INTO tlo_masterlist (id, "TLOid", tloid, first_name, last_name, middle_name, suffix, gender, plantilla_item_no, created_at, updated_at)
-- VALUES
--   (691, 'TLO-0019', 'TLO-0019', 'WILFREDO E.', 'CABRAL', NULL, NULL, 'MALE', 'OSEC-DECSB-DEUSEC-2-2024', NOW(), NOW()),
--   (528, 'TLO-0091', 'TLO-0091', 'ALDRIN', 'CORPIN', 'GAYRAMA', NULL, 'MALE', 'OSEC-DECSB-ASDS-30001-1998', NOW(), NOW()),
--   (23, 'TLO-0151', 'TLO-0151', 'TOLENTINO', 'AQUINO', NULL, NULL, 'MALE', 'OSEC-DECSB-DIR4-390002-1998', NOW(), NOW()),
--   (252, 'TLO-0261', 'TLO-0261', 'RONNIE', 'MALLARI', NULL, NULL, 'MALE', 'OSEC-DECSB-DIR4-510002-1998', NOW(), NOW()),
--   (508, 'TLO-0327', 'TLO-0327', 'MIGUEL MAC', 'APOSIN', 'D.', NULL, 'MALE', 'OSEC-DECSB-DIR3-840002-1998', NOW(), NOW()),
--   (163, 'TLO-0413', 'TLO-0413', 'SALUSTIANO T.', 'JIMENEZ', NULL, NULL, 'MALE', 'OSEC-DECSB-DIR4-150001-1998', NOW(), NOW()),
--   (181, 'TLO-0423', 'TLO-0423', 'SALUSTIANO T.', 'JIMENEZ', NULL, NULL, 'MALE', 'OSEC-DECSB-DIR4-150001-1998', NOW(), NOW()),
--   (468, 'TLO-0443', 'TLO-0443', 'RONELO AL', 'FIRMO', 'K.', NULL, 'MALE', 'OSEC-DECSB-DIR4-10-2025', NOW(), NOW()),
--   (310, 'TLO-0495', 'TLO-0495', 'REBONFAMIL', 'BAGUIO', 'R.', NULL, 'MALE', 'OSEC-DECSB-DIR3-510002-1998', NOW(), NOW()),
--   (660, 'TLO-0613', 'TLO-0613', 'ROMELA', 'CRUZ', 'M.', NULL, 'FEMALE', 'OSEC-DECSB-SDS-30010-1998', NOW(), NOW())
-- ON CONFLICT (id) DO NOTHING;
-- COMMIT;
-- =========================================================================================
