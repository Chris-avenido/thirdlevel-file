-- ============================================================
-- Migration  : 20260806_002
-- Description: Create tlo_eligibility_records table
-- Purpose    : Normalized replacement for eligibilities JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              Backward compatibility is preserved via dual-write.
-- Tables     : tlo_eligibility_records (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_eligibility_records (
    id                  SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table        VARCHAR(60)     NOT NULL
                            CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id              VARCHAR(50)     NOT NULL,
    -- Domain columns
    -- Maps to: eligibility_type (e.g. 'CAREER SERVICE PROFESSIONAL', 'BAR EXAM')
    eligibility_type    TEXT            NOT NULL DEFAULT '',
    rating              VARCHAR(20),
    conferment_date     DATE,
    place_of_assignment TEXT,
    details             TEXT,
    -- Audit fields
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by          TEXT,
    updated_by          TEXT
);

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_tlo_elig_source_tloid
    ON tlo_eligibility_records (source_table, tlo_id);

-- Secondary: filter by eligibility type across cohort
CREATE INDEX IF NOT EXISTS idx_tlo_elig_type
    ON tlo_eligibility_records (eligibility_type);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_eligibility_records;
-- COMMIT;
