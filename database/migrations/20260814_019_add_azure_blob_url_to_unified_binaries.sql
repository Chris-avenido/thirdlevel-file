-- Migration : 20260814_019_add_azure_blob_url_to_unified_binaries.sql
-- Author    : Antigravity Assistant
-- Date      : 2026-08-14
-- Purpose   : Adds azure_blob_url column to unified_binaries table to support Azure Blob Storage URL/path storage
-- Safety    : Uses IF NOT EXISTS check, non-destructive, wrapped in transaction

BEGIN;

-- 1. Add azure_blob_url column to unified_binaries if it doesn't already exist
ALTER TABLE unified_binaries
  ADD COLUMN IF NOT EXISTS azure_blob_url TEXT DEFAULT NULL;

COMMENT ON COLUMN unified_binaries.azure_blob_url IS
  'Optional cloud storage URL or local relative path for the binary object in Azure Blob Storage or storage system.';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Run manually if needed):
-- ============================================================================
-- BEGIN;
-- ALTER TABLE unified_binaries DROP COLUMN IF EXISTS azure_blob_url;
-- COMMIT;
