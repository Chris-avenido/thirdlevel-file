-- ============================================================
-- Migration  : 20260913_027
-- Description: Add plantilla_item_no column to third_level_official_masterlist
-- Purpose    : Store DepEd Plantilla Item Number (e.g. OSEC-DECSB-DESEC-1-1998,
--              DETAILED FROM GPPB) from CSV column "Item No."
--              NOTE: TLOid remains the internal TLO-XXXX primary key.
--              This new column holds the DepEd plantilla code in uppercase
--              without conflicting with TLOid or tlo_items.item_number.
-- Tables     : third_level_official_masterlist (MODIFY ONLY)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-09-13
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. third_level_official_masterlist: Add plantilla_item_no column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE third_level_official_masterlist
    ADD COLUMN IF NOT EXISTS plantilla_item_no TEXT;

COMMENT ON COLUMN third_level_official_masterlist.plantilla_item_no IS
    'DepEd Plantilla Item Number (e.g. OSEC-DECSB-DESEC-1-1998, DETAILED FROM GPPB). '
    'Normalized to uppercase. Sourced from CSV column "Item No.". Distinct from internal TLOid.';

COMMIT;


-- ============================================================
-- ROLLBACK SCRIPT (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist
--     DROP COLUMN IF EXISTS plantilla_item_no;
-- COMMIT;
