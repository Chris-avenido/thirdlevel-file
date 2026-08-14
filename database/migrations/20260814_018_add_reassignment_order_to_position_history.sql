-- ============================================================
-- Migration  : 20260814_018
-- Description: Add reassignment_order_binary_id to tlo_position_history
-- Purpose    : Stores the binary ID reference to unified_binaries for the Reassignment Order PDF
--              associated with a historical position record in tlo_position_history.
-- Tables     : tlo_position_history (MODIFY)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-14
-- ============================================================

BEGIN;

ALTER TABLE tlo_position_history
  ADD COLUMN IF NOT EXISTS reassignment_order_binary_id UUID;

COMMENT ON COLUMN tlo_position_history.reassignment_order_binary_id IS
  'UUID reference to unified_binaries. Stores the Reassignment Order PDF associated with this historical position.';

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- ALTER TABLE tlo_position_history
--   DROP COLUMN IF EXISTS reassignment_order_binary_id;
-- COMMIT;
