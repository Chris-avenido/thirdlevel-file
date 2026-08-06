-- ============================================================
-- Migration  : 20260806_005
-- Description: Create tlo_accomplishment_records table
-- Purpose    : Normalized replacement for individual_accomplishments JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              NOTE: individual_accomplishments is currently stored as an array
--              of plain strings (not objects), so description is the primary field.
--              Backward compatibility is preserved via dual-write.
-- Tables     : tlo_accomplishment_records (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_accomplishment_records (
    id           SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table VARCHAR(60)     NOT NULL
                     CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id       VARCHAR(50)     NOT NULL,
    -- Domain columns
    -- Maps to: individual_accomplishments[] (plain string entries)
    description  TEXT            NOT NULL DEFAULT '',
    -- Optional year metadata (not in current schema, added for future enrichment)
    award_year   INT
                     CHECK (
                         award_year IS NULL
                         OR (award_year >= 1900 AND award_year <= 2100)
                     ),
    -- Audit fields
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by   TEXT,
    updated_by   TEXT
);

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_tlo_accomp_source_tloid
    ON tlo_accomplishment_records (source_table, tlo_id);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_accomplishment_records;
-- COMMIT;
