-- ============================================================
-- Migration  : 20260806_006
-- Description: Create tlo_other_courses table
-- Purpose    : Normalized replacement for other_courses JSONB column.
--              The source JSONB column is NOT dropped in this migration.
--              Current other_courses object shape: { course, date_from, date_to, details }
--              Backward compatibility is preserved via dual-write.
-- Tables     : tlo_other_courses (NEW)
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tlo_other_courses (
    id           SERIAL          PRIMARY KEY,
    -- Polymorphic FK discriminator: 'masterlist' | 'staging'
    source_table VARCHAR(60)     NOT NULL
                     CHECK (source_table IN ('masterlist', 'staging')),
    -- Logical FK to "TLOid" (masterlist) or app_TLOid (staging)
    tlo_id       VARCHAR(50)     NOT NULL,
    -- Domain columns
    -- Maps to: other_courses[].course
    course_title TEXT            NOT NULL DEFAULT '',
    -- Maps to: other_courses[].details
    details      TEXT,
    institution  TEXT,
    -- Maps to: other_courses[].date_from and .date_to
    date_from    DATE,
    date_to      DATE,
    -- Audit fields
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by   TEXT,
    updated_by   TEXT,
    -- Date integrity guard (mirrors existing backend validation in updateProfile L432–L436)
    CONSTRAINT chk_tlo_course_dates CHECK (
        date_to IS NULL
        OR date_from IS NULL
        OR date_to > date_from
    )
);

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_tlo_courses_source_tloid
    ON tlo_other_courses (source_table, tlo_id);

COMMIT;

-- ============================================================
-- ROLLBACK (run this block to undo this migration)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_other_courses;
-- COMMIT;
