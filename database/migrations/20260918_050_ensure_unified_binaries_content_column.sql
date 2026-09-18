-- Migration : 20260918_050_ensure_unified_binaries_content_column.sql
-- Author    : Antigravity Assistant
-- Date      : 2026-09-18
-- Purpose   : Ensure nullable content BYTEA column exists in public.unified_binaries for permanent schema stability
-- Safety    : Uses IF NOT EXISTS, non-destructive, wrapped in transaction, preserves existing rows and data

BEGIN;

-- 1. Ensure table unified_binaries has content BYTEA column
ALTER TABLE public.unified_binaries
ADD COLUMN IF NOT EXISTS content BYTEA;

COMMENT ON COLUMN public.unified_binaries.content IS
  'Raw binary byte content (BYTEA) for unified binaries and documents.';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (For reference only - DO NOT EXECUTE):
-- ============================================================================
-- BEGIN;
-- ALTER TABLE public.unified_binaries DROP COLUMN IF EXISTS content;
-- COMMIT;
