-- ============================================================
-- Migration  : 20260806_004
-- Description: Create tlo_training_records table
-- Purpose    : Normalized replacement for relevant_trainings JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              Backward compatibility is preserved via dual-write.
--              Enables SQL-side SUM of training hours across cohorts.
-- Tables     : tlo_training_records (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_training_records (
    id                    SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table          VARCHAR(60)     NOT NULL
                              CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id                VARCHAR(50)     NOT NULL,
    -- Domain columns
    -- Maps to: relevant_trainings[].training_name (stored UPPERCASE per existing normalization)
    training_name         TEXT            NOT NULL DEFAULT '',
    hours                 INT             CHECK (hours IS NULL OR hours >= 0),
    inclusive_date_start  DATE,
    inclusive_date_end    DATE,
    -- Maps to: relevant_trainings[].conducted_by
    conducted_by          TEXT,
    -- Audit fields
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by            TEXT,
    updated_by            TEXT,
    -- Date integrity guard (mirrors existing backend validation in updateProfile L397–L399)
    CONSTRAINT chk_tlo_train_dates CHECK (
        inclusive_date_end IS NULL
        OR inclusive_date_start IS NULL
        OR inclusive_date_end > inclusive_date_start
    )
);

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_tlo_train_source_tloid
    ON tlo_training_records (source_table, tlo_id);

-- Supports: SELECT tlo_id, SUM(hours) FROM tlo_training_records GROUP BY tlo_id
CREATE INDEX IF NOT EXISTS idx_tlo_train_hours
    ON tlo_training_records (tlo_id, hours);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_training_records;
-- COMMIT;
