-- ============================================================
-- Migration  : 20260814_016
-- Description: Add reassignment_order_binary_id to third_level_official_masterlist
-- Purpose    : Stores the binary ID for the Reassignment Order PDF uploaded during
--              the Reassign Official workflow. Follows the same pattern as existing
--              binary columns (photo_binary_id, pds_binary_id, etc.) — plain UUID,
--              no FK constraint (unified_binaries uses UUID primary key).
-- Tables     : third_level_official_masterlist (MODIFY)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-14
-- ============================================================

BEGIN;

ALTER TABLE third_level_official_masterlist
  ADD COLUMN IF NOT EXISTS reassignment_order_binary_id UUID;

COMMENT ON COLUMN third_level_official_masterlist.reassignment_order_binary_id IS
  'UUID reference to unified_binaries. Stores the Reassignment Order PDF uploaded during an official reassignment.';

COMMIT;


-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE third_level_official_masterlist
--   DROP COLUMN IF EXISTS reassignment_order_binary_id;
-- COMMIT;
