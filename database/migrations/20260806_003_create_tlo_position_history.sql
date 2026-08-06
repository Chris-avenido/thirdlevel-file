-- ============================================================
-- Migration  : 20260806_003
-- Description: Create tlo_position_history table
-- Purpose    : Normalized replacement for previous_positions JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              NOTE: oic_positions sub-array is kept as JSONB in this phase
--              (secondary nesting; Phase 2 normalization target).
--              Backward compatibility is preserved via dual-write.
-- Tables     : tlo_position_history (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_position_history (
    id                    SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table          VARCHAR(60)     NOT NULL
                              CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id                VARCHAR(50)     NOT NULL,
    -- Domain columns
    -- Maps to: previous_positions[].position_name
    position_name         TEXT            NOT NULL DEFAULT '',
    office                TEXT,
    strand                TEXT,
    division              TEXT,
    region                TEXT,
    inclusive_date_start  DATE,
    inclusive_date_end    DATE,
    -- OIC sub-positions kept as JSONB for Phase 2 normalization
    -- Maps to: previous_positions[].oic_positions (array of OIC assignments)
    oic_positions         JSONB,
    -- Audit fields
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by            TEXT,
    updated_by            TEXT,
    -- Date integrity guard (mirrors existing backend validation in updateProfile L389)
    CONSTRAINT chk_tlo_pos_dates CHECK (
        inclusive_date_end IS NULL
        OR inclusive_date_start IS NULL
        OR inclusive_date_end > inclusive_date_start
    )
);

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_tlo_pos_source_tloid
    ON tlo_position_history (source_table, tlo_id);

-- Date range index: supports chronological ordering and overlap queries
CREATE INDEX IF NOT EXISTS idx_tlo_pos_dates
    ON tlo_position_history (tlo_id, inclusive_date_start DESC, inclusive_date_end DESC);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_position_history;
-- COMMIT;
