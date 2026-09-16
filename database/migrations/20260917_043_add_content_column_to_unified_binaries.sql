-- Migration : 20260917_043_add_content_column_to_unified_binaries.sql
-- Author    : Antigravity Assistant
-- Date      : 2026-09-17
-- Purpose   : Adds nullable content BYTEA column to public.unified_binaries
-- Safety    : Uses IF NOT EXISTS, non-destructive, wrapped in transaction

BEGIN;

-- 1. Apply schema change: add nullable BYTEA column without default
ALTER TABLE public.unified_binaries
ADD COLUMN IF NOT EXISTS content BYTEA;

COMMENT ON COLUMN public.unified_binaries.content IS
  'Raw binary byte content (BYTEA) for unified binaries.';

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (For reference only - DO NOT EXECUTE):
-- ============================================================================
-- BEGIN;
-- ALTER TABLE public.unified_binaries DROP COLUMN IF EXISTS content;
-- COMMIT;
