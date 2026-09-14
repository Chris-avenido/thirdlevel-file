-- ============================================================
-- Migration  : 20260914_029
-- Description: Sync masterlist corrections from September 14, 2026 CSV update
-- Source Files:
--   - Previous: "TLO Masterlist as of September 8, 2026(FINAL).csv"
--   - Updated : "TLO Masterlist as of September 14, 2026(FINAL).csv"
--
-- Analysis of Differences (across 626 CSV rows):
--   1. Row 330 (ADONIS A. MOSQUERA, TLO-0690):
--      Email corrected from 'renato.ballesteros@deped.gov.ph' to 'adonis.mosquera@deped.gov.ph'
--   2. Row 616 (ROMELA M. CRUZ, TLO-0721):
--      Email corrected from 'rita.riddle@deped.gov.ph' to 'romela.cruz@deped.gov.ph'
--   3. Row 191 (San Jose City ASDS / VACANT, TLO-0190):
--      Item No. changed from 'OSEC-DECSB-SDS-60010-1998' to 'Not Found'
--      (Ensuring plantilla_item_no is NULL in database)
--
-- Tables     : third_level_official_masterlist (MODIFY ONLY)
-- Author     : Antigravity
-- Date       : 2026-09-14
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Correct email for Adonis A. Mosquera (TLO-0690)
-- ─────────────────────────────────────────────────────────────
UPDATE third_level_official_masterlist
SET email = 'adonis.mosquera@deped.gov.ph',
    updated_at = NOW()
WHERE "TLOid" = 'TLO-0690'
  AND (email = 'renato.ballesteros@deped.gov.ph' OR email IS NULL OR email = '');

-- ─────────────────────────────────────────────────────────────
-- 2. Correct email for Romela M. Cruz (TLO-0721)
-- ─────────────────────────────────────────────────────────────
UPDATE third_level_official_masterlist
SET email = 'romela.cruz@deped.gov.ph',
    updated_at = NOW()
WHERE "TLOid" = 'TLO-0721'
  AND (email = 'rita.riddle@deped.gov.ph' OR email IS NULL OR email = '');

-- ─────────────────────────────────────────────────────────────
-- 3. Ensure plantilla_item_no for San Jose City ASDS (TLO-0190) is NULL
--    (Source CSV Row 191 updated Item No. from OSEC-DECSB-SDS-60010-1998 to 'Not Found')
-- ─────────────────────────────────────────────────────────────
UPDATE third_level_official_masterlist
SET plantilla_item_no = NULL,
    updated_at = NOW()
WHERE "TLOid" = 'TLO-0190'
  AND plantilla_item_no = 'OSEC-DECSB-SDS-60010-1998';

COMMIT;


-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- UPDATE third_level_official_masterlist
-- SET email = 'renato.ballesteros@deped.gov.ph',
--     updated_at = NOW()
-- WHERE "TLOid" = 'TLO-0690'
--   AND email = 'adonis.mosquera@deped.gov.ph';
--
-- UPDATE third_level_official_masterlist
-- SET email = 'rita.riddle@deped.gov.ph',
--     updated_at = NOW()
-- WHERE "TLOid" = 'TLO-0721'
--   AND email = 'romela.cruz@deped.gov.ph';
--
-- UPDATE third_level_official_masterlist
-- SET plantilla_item_no = 'OSEC-DECSB-SDS-60010-1998',
--     updated_at = NOW()
-- WHERE "TLOid" = 'TLO-0190'
--   AND plantilla_item_no IS NULL;
-- COMMIT;
