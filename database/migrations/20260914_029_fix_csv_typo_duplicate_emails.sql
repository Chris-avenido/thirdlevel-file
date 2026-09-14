-- ============================================================
-- Migration  : 20260914_029
-- Description: Correct CSV data-entry typo email addresses for Adonis Mosquera and Romela Cruz
-- Purpose    : In the source CSV "TLO Masterlist as of September 8, 2026(FINAL).csv",
--              two email addresses were offset during data entry:
--              1. TLO-0690 (Adonis A. Mosquera) was incorrectly assigned renato.ballesteros@deped.gov.ph
--                 (correct DepEd address: adonis.mosquera@deped.gov.ph)
--              2. TLO-0721 (Romela M. Cruz) was incorrectly assigned rita.riddle@deped.gov.ph
--                 (correct DepEd address: romela.cruz@deped.gov.ph)
--              This data cleanup is completely decoupled from multi-role identity architecture.
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
  AND email = 'renato.ballesteros@deped.gov.ph';

-- ─────────────────────────────────────────────────────────────
-- 2. Correct email for Romela M. Cruz (TLO-0721)
-- ─────────────────────────────────────────────────────────────
UPDATE third_level_official_masterlist
SET email = 'romela.cruz@deped.gov.ph',
    updated_at = NOW()
WHERE "TLOid" = 'TLO-0721'
  AND email = 'rita.riddle@deped.gov.ph';

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
-- COMMIT;
