-- ============================================================================
-- Migration: 20260904_024_enforce_not_null_is_testaccount.sql
-- Description: Enforces strict NOT NULL DEFAULT FALSE on is_testaccount columns
--              across tlo_users, third_level_official_masterlist,
--              third_level_officials_profiling_application, and tlo_personnel.
--              Synchronizes user test accounts and creates missing indexes.
--
-- Rollback Instructions:
--   ALTER TABLE public.tlo_users ALTER COLUMN is_testaccount DROP NOT NULL;
--   ALTER TABLE public.third_level_official_masterlist ALTER COLUMN is_testaccount DROP NOT NULL;
--   ALTER TABLE public.third_level_officials_profiling_application ALTER COLUMN is_testaccount DROP NOT NULL;
--   ALTER TABLE public.tlo_personnel ALTER COLUMN is_testaccount DROP NOT NULL;
--   DROP INDEX IF EXISTS idx_tlo_users_is_testaccount;
--   DROP INDEX IF EXISTS idx_tlo_personnel_is_testaccount;
-- ============================================================================

BEGIN;

-- 1. Synchronize tlo_users is_testaccount based on matching masterlist test officials
UPDATE public.tlo_users u
SET is_testaccount = TRUE
FROM public.third_level_official_masterlist m
WHERE LOWER(u.email) = LOWER(m.email) AND m.is_testaccount = TRUE;

-- 2. Synchronize tlo_personnel is_testaccount based on matching masterlist test officials
UPDATE public.tlo_personnel p
SET is_testaccount = TRUE
FROM public.third_level_official_masterlist m
WHERE LOWER(p.email) = LOWER(m.email) AND m.is_testaccount = TRUE;

-- 3. Safety coalesce: ensure any future or residual NULLs are set to FALSE before adding NOT NULL
UPDATE public.tlo_users SET is_testaccount = FALSE WHERE is_testaccount IS NULL;
UPDATE public.third_level_official_masterlist SET is_testaccount = FALSE WHERE is_testaccount IS NULL;
UPDATE public.third_level_officials_profiling_application SET is_testaccount = FALSE WHERE is_testaccount IS NULL;
UPDATE public.tlo_personnel SET is_testaccount = FALSE WHERE is_testaccount IS NULL;

-- 4. Set DEFAULT FALSE and NOT NULL constraints
ALTER TABLE public.tlo_users 
  ALTER COLUMN is_testaccount SET DEFAULT FALSE,
  ALTER COLUMN is_testaccount SET NOT NULL;

ALTER TABLE public.third_level_official_masterlist 
  ALTER COLUMN is_testaccount SET DEFAULT FALSE,
  ALTER COLUMN is_testaccount SET NOT NULL;

ALTER TABLE public.third_level_officials_profiling_application 
  ALTER COLUMN is_testaccount SET DEFAULT FALSE,
  ALTER COLUMN is_testaccount SET NOT NULL;

ALTER TABLE public.tlo_personnel 
  ALTER COLUMN is_testaccount SET DEFAULT FALSE,
  ALTER COLUMN is_testaccount SET NOT NULL;

-- 5. Create missing indexes for optimal partition querying
CREATE INDEX IF NOT EXISTS idx_tlo_users_is_testaccount 
  ON public.tlo_users USING btree (is_testaccount);

CREATE INDEX IF NOT EXISTS idx_tlo_personnel_is_testaccount 
  ON public.tlo_personnel USING btree (is_testaccount);

CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_is_testaccount 
  ON public.third_level_official_masterlist USING btree (is_testaccount);

CREATE INDEX IF NOT EXISTS idx_tlo_app_is_testaccount 
  ON public.third_level_officials_profiling_application USING btree (is_testaccount);

COMMIT;
