-- ============================================================
-- Migration  : 20260806_008
-- Description: VALIDATION ONLY — compare JSONB source counts against
--              the new relational tables after migration 007.
-- Action     : READ-ONLY — no INSERT, UPDATE, or DELETE.
-- Run after  : 20260806_007_migrate_jsonb_to_relational.sql
-- Expected   : All "Expected >= Actual" comparisons should pass.
--              Relational row counts will be >= parent record counts
--              because one parent may have multiple child rows.
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

-- ============================================================
-- SECTION A: Parent record counts with data (for reference)
-- ============================================================

SELECT 'SECTION A: Source parent counts' AS info;

SELECT
    'masterlist' AS source,
    (SELECT COUNT(*) FROM third_level_official_masterlist)                                           AS total_records,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE education_degrees    IS NOT NULL AND jsonb_typeof(education_degrees)    = 'array' AND jsonb_array_length(education_degrees)    > 0) AS has_education,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE eligibilities        IS NOT NULL AND jsonb_typeof(eligibilities)        = 'array' AND jsonb_array_length(eligibilities)        > 0) AS has_eligibility,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE previous_positions   IS NOT NULL AND jsonb_typeof(previous_positions)   = 'array' AND jsonb_array_length(previous_positions)   > 0) AS has_positions,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE relevant_trainings   IS NOT NULL AND jsonb_typeof(relevant_trainings)   = 'array' AND jsonb_array_length(relevant_trainings)   > 0) AS has_trainings,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE individual_accomplishments IS NOT NULL AND jsonb_typeof(individual_accomplishments) = 'array' AND jsonb_array_length(individual_accomplishments) > 0) AS has_accomplishments,
    (SELECT COUNT(*) FROM third_level_official_masterlist WHERE other_courses        IS NOT NULL AND jsonb_typeof(other_courses)        = 'array' AND jsonb_array_length(other_courses)        > 0) AS has_other_courses;

SELECT
    'staging' AS source,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application)                               AS total_records,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE education_degrees    IS NOT NULL AND jsonb_typeof(education_degrees)    = 'array' AND jsonb_array_length(education_degrees)    > 0) AS has_education,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE eligibilities        IS NOT NULL AND jsonb_typeof(eligibilities)        = 'array' AND jsonb_array_length(eligibilities)        > 0) AS has_eligibility,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE previous_positions   IS NOT NULL AND jsonb_typeof(previous_positions)   = 'array' AND jsonb_array_length(previous_positions)   > 0) AS has_positions,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE relevant_trainings   IS NOT NULL AND jsonb_typeof(relevant_trainings)   = 'array' AND jsonb_array_length(relevant_trainings)   > 0) AS has_trainings,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE individual_accomplishments IS NOT NULL AND jsonb_typeof(individual_accomplishments) = 'array' AND jsonb_array_length(individual_accomplishments) > 0) AS has_accomplishments,
    (SELECT COUNT(*) FROM third_level_officials_profiling_application WHERE other_courses        IS NOT NULL AND jsonb_typeof(other_courses)        = 'array' AND jsonb_array_length(other_courses)        > 0) AS has_other_courses;

-- ============================================================
-- SECTION B: Relational table row counts (migrated data)
-- ============================================================

SELECT 'SECTION B: Relational table row counts after migration' AS info;

SELECT
    'tlo_education_records'      AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_education_records;

SELECT
    'tlo_eligibility_records'    AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_eligibility_records;

SELECT
    'tlo_position_history'       AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_position_history;

SELECT
    'tlo_training_records'       AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_training_records;

SELECT
    'tlo_accomplishment_records' AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_accomplishment_records;

SELECT
    'tlo_other_courses'          AS table_name,
    COUNT(*) FILTER (WHERE source_table = 'masterlist') AS masterlist_rows,
    COUNT(*) FILTER (WHERE source_table = 'staging')    AS staging_rows,
    COUNT(*)                                            AS total_rows
FROM tlo_other_courses;

-- ============================================================
-- SECTION C: Per-person spot-check — verify a sample of records
-- Compares JSONB array element count vs relational row count per TLOid
-- ============================================================

SELECT 'SECTION C: Education spot-check (masterlist top 10 by degree count)' AS info;

SELECT
    m."TLOid",
    jsonb_array_length(m.education_degrees)                                     AS jsonb_count,
    COUNT(e.id)                                                                 AS relational_count,
    CASE
        WHEN jsonb_array_length(m.education_degrees) = COUNT(e.id) THEN 'OK'
        ELSE 'MISMATCH'
    END                                                                         AS status
FROM third_level_official_masterlist m
LEFT JOIN tlo_education_records e
    ON e.source_table = 'masterlist' AND e.tlo_id = m."TLOid"
WHERE m.education_degrees IS NOT NULL
  AND jsonb_typeof(m.education_degrees) = 'array'
  AND jsonb_array_length(m.education_degrees) > 0
GROUP BY m."TLOid", m.education_degrees
ORDER BY jsonb_array_length(m.education_degrees) DESC
LIMIT 10;

SELECT 'SECTION C: Position history spot-check (masterlist top 10 by position count)' AS info;

SELECT
    m."TLOid",
    jsonb_array_length(m.previous_positions)                                    AS jsonb_count,
    COUNT(p.id)                                                                 AS relational_count,
    CASE
        WHEN jsonb_array_length(m.previous_positions) = COUNT(p.id) THEN 'OK'
        ELSE 'MISMATCH'
    END                                                                         AS status
FROM third_level_official_masterlist m
LEFT JOIN tlo_position_history p
    ON p.source_table = 'masterlist' AND p.tlo_id = m."TLOid"
WHERE m.previous_positions IS NOT NULL
  AND jsonb_typeof(m.previous_positions) = 'array'
  AND jsonb_array_length(m.previous_positions) > 0
GROUP BY m."TLOid", m.previous_positions
ORDER BY jsonb_array_length(m.previous_positions) DESC
LIMIT 10;

SELECT 'SECTION C: Training spot-check (masterlist top 10 by training count)' AS info;

SELECT
    m."TLOid",
    jsonb_array_length(m.relevant_trainings)                                    AS jsonb_count,
    COUNT(t.id)                                                                 AS relational_count,
    CASE
        WHEN jsonb_array_length(m.relevant_trainings) = COUNT(t.id) THEN 'OK'
        ELSE 'MISMATCH'
    END                                                                         AS status
FROM third_level_official_masterlist m
LEFT JOIN tlo_training_records t
    ON t.source_table = 'masterlist' AND t.tlo_id = m."TLOid"
WHERE m.relevant_trainings IS NOT NULL
  AND jsonb_typeof(m.relevant_trainings) = 'array'
  AND jsonb_array_length(m.relevant_trainings) > 0
GROUP BY m."TLOid", m.relevant_trainings
ORDER BY jsonb_array_length(m.relevant_trainings) DESC
LIMIT 10;

-- ============================================================
-- SECTION D: Detect any MISMATCH rows (full scan)
-- All rows in the output of these queries indicate a problem.
-- Expected output: 0 rows per query.
-- ============================================================

SELECT 'SECTION D: Full mismatch scan — all 0-row results = PASS' AS info;

-- Education mismatches
SELECT m."TLOid", 'education' AS domain,
    jsonb_array_length(m.education_degrees) AS expected,
    COUNT(e.id)                             AS actual
FROM third_level_official_masterlist m
LEFT JOIN tlo_education_records e
    ON e.source_table = 'masterlist' AND e.tlo_id = m."TLOid"
WHERE m.education_degrees IS NOT NULL
  AND jsonb_typeof(m.education_degrees) = 'array'
  AND jsonb_array_length(m.education_degrees) > 0
GROUP BY m."TLOid", m.education_degrees
HAVING jsonb_array_length(m.education_degrees) != COUNT(e.id);

-- Position history mismatches
SELECT m."TLOid", 'positions' AS domain,
    jsonb_array_length(m.previous_positions) AS expected,
    COUNT(p.id)                              AS actual
FROM third_level_official_masterlist m
LEFT JOIN tlo_position_history p
    ON p.source_table = 'masterlist' AND p.tlo_id = m."TLOid"
WHERE m.previous_positions IS NOT NULL
  AND jsonb_typeof(m.previous_positions) = 'array'
  AND jsonb_array_length(m.previous_positions) > 0
GROUP BY m."TLOid", m.previous_positions
HAVING jsonb_array_length(m.previous_positions) != COUNT(p.id);

-- Training mismatches
SELECT m."TLOid", 'trainings' AS domain,
    jsonb_array_length(m.relevant_trainings) AS expected,
    COUNT(t.id)                              AS actual
FROM third_level_official_masterlist m
LEFT JOIN tlo_training_records t
    ON t.source_table = 'masterlist' AND t.tlo_id = m."TLOid"
WHERE m.relevant_trainings IS NOT NULL
  AND jsonb_typeof(m.relevant_trainings) = 'array'
  AND jsonb_array_length(m.relevant_trainings) > 0
GROUP BY m."TLOid", m.relevant_trainings
HAVING jsonb_array_length(m.relevant_trainings) != COUNT(t.id);
