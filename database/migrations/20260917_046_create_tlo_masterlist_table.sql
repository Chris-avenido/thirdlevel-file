-- =========================================================================================
-- Migration: 20260917_046_create_tlo_masterlist_table.sql
-- Description:
--   Creates the physical table 'public.tlo_masterlist' matching the verified schema
--   from local development environment, ensuring safe idempotent execution with
--   primary key, unique constraint on tloid, demographic fields, timestamps,
--   and performance indexes.
--
-- Safety & Rollback:
--   - Wrapped in a transaction block (BEGIN / COMMIT).
--   - Uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS on indexes and constraints.
--   - Completely non-destructive: does not delete or overwrite any existing data.
--   - Rollback instructions provided at the end of this file.
-- =========================================================================================

BEGIN;

-- 1. Create table public.tlo_masterlist
CREATE TABLE IF NOT EXISTS public.tlo_masterlist (
    id SERIAL PRIMARY KEY,
    tloid VARCHAR(50) NOT NULL,
    first_name VARCHAR(255) NULL,
    last_name VARCHAR(255) NULL,
    middle_name VARCHAR(255) NULL,
    suffix VARCHAR(50) NULL,
    gender VARCHAR(50) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    plantilla_item_no TEXT NULL,
    CONSTRAINT uq_tlo_masterlist_tloid UNIQUE (tloid)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_tloid ON public.tlo_masterlist USING btree (tloid);
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_last_name ON public.tlo_masterlist USING btree (last_name);
CREATE INDEX IF NOT EXISTS idx_tlo_masterlist_gender ON public.tlo_masterlist USING btree (gender);

-- 3. Table and column documentation
COMMENT ON TABLE public.tlo_masterlist IS 'Authoritative masterlist of Third Level Officials (TLO) with canonical demographic details';
COMMENT ON COLUMN public.tlo_masterlist.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN public.tlo_masterlist.tloid IS 'Unique Third Level Official identifier (e.g. TLO-0001)';
COMMENT ON COLUMN public.tlo_masterlist.first_name IS 'Official first name';
COMMENT ON COLUMN public.tlo_masterlist.last_name IS 'Official last name';
COMMENT ON COLUMN public.tlo_masterlist.middle_name IS 'Official middle name';
COMMENT ON COLUMN public.tlo_masterlist.suffix IS 'Official name suffix';
COMMENT ON COLUMN public.tlo_masterlist.gender IS 'Official gender';
COMMENT ON COLUMN public.tlo_masterlist.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN public.tlo_masterlist.updated_at IS 'Record update timestamp';
COMMENT ON COLUMN public.tlo_masterlist.plantilla_item_no IS 'Associated plantilla item number';

-- 4. Baseline seeding if table is newly created and empty, and source masterlist exists
INSERT INTO public.tlo_masterlist (tloid, first_name, last_name, middle_name, suffix, gender, plantilla_item_no)
SELECT 
    t."TLOid" AS tloid,
    t.first_name,
    t.last_name,
    t.middle_name,
    t.suffix,
    t.gender,
    t.plantilla_item_no
FROM public.third_level_official_masterlist t
WHERE NOT EXISTS (SELECT 1 FROM public.tlo_masterlist)
ON CONFLICT (tloid) DO NOTHING;

COMMIT;

-- =========================================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, execute the following SQL:
-- BEGIN;
-- DROP TABLE IF EXISTS public.tlo_masterlist CASCADE;
-- COMMIT;
-- =========================================================================================
