-- ============================================================
-- Migration  : 20260806_001
-- Description: Create tlo_education_records table
-- Purpose    : Normalized replacement for education_degrees JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              Backward compatibility is preserved via dual-write.
-- Tables     : tlo_education_records (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_education_records (
    id              SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table    VARCHAR(60)     NOT NULL
                        CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id          VARCHAR(50)     NOT NULL,
    -- Domain columns
    level           VARCHAR(30)     NOT NULL
                        CHECK (level IN ('Bachelor', 'Master', 'Doctorate')),
    degree          TEXT            NOT NULL DEFAULT '',
    institution     TEXT,
    year_graduated  INT
                        CHECK (
                            year_graduated IS NULL
                            OR (year_graduated >= 1900 AND year_graduated <= 2100)
                        ),
    -- Audit fields
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      TEXT,
    updated_by      TEXT
);

-- Primary lookup index: fetch all education rows for a person
CREATE INDEX IF NOT EXISTS idx_tlo_edu_source_tloid
    ON tlo_education_records (source_table, tlo_id);

-- Secondary index: aggregate/filter by degree level
CREATE INDEX IF NOT EXISTS idx_tlo_edu_level
    ON tlo_education_records (level);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_education_records;
-- COMMIT;
