-- ============================================================
-- Migration  : 20260806_007
-- Description: ONE-TIME data migration — extract existing JSONB/text data
--              from masterlist and staging into the 6 new relational tables.
-- Safety     : All INSERTs are append-only. Parent tables are NOT modified.
--              Idempotent: if re-run, duplicate rows will be inserted.
--              If re-running, execute the ROLLBACK block first to clear
--              previously migrated rows, then re-run this script.
-- Requires   : Migrations 001–006 must be applied before this script.
-- Author     : Antigravity (Senior DB Architect)
-- Date       : 2026-08-06
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EDUCATION RECORDS
-- Source: education_degrees JSONB (both masterlist and staging)
-- JSONB shape: [{ highest_education, specific_degree, education_program,
--                 education_year_graduated }]
-- ============================================================

-- 1a. From masterlist
INSERT INTO tlo_education_records
    (source_table, tlo_id, level, degree, year_graduated, created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    CASE
        WHEN UPPER(ed->>'highest_education') LIKE '%BACHELOR%'
          OR UPPER(ed->>'highest_education') LIKE '%BACCALAUREATE%' THEN 'Bachelor'
        WHEN UPPER(ed->>'highest_education') LIKE '%MASTER%'        THEN 'Master'
        WHEN UPPER(ed->>'highest_education') LIKE '%DOCTOR%'        THEN 'Doctorate'
        ELSE 'Bachelor'
    END                                                                         AS level,
    COALESCE(
        NULLIF(TRIM(ed->>'specific_degree'), ''),
        NULLIF(TRIM(ed->>'education_program'), ''),
        ''
    )                                                                           AS degree,
    CASE
        WHEN ed->>'education_year_graduated' ~ '^\d{4}$'
        THEN (ed->>'education_year_graduated')::INT
        ELSE NULL
    END                                                                         AS year_graduated,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.education_degrees) = 'array'
         THEN m.education_degrees ELSE '[]'::jsonb END
) AS ed
WHERE m.education_degrees IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.education_degrees) = 'array'
           THEN m.education_degrees ELSE '[]'::jsonb END
  ) > 0;

-- 1b. From staging
INSERT INTO tlo_education_records
    (source_table, tlo_id, level, degree, year_graduated, created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    CASE
        WHEN UPPER(ed->>'highest_education') LIKE '%BACHELOR%'
          OR UPPER(ed->>'highest_education') LIKE '%BACCALAUREATE%' THEN 'Bachelor'
        WHEN UPPER(ed->>'highest_education') LIKE '%MASTER%'        THEN 'Master'
        WHEN UPPER(ed->>'highest_education') LIKE '%DOCTOR%'        THEN 'Doctorate'
        ELSE 'Bachelor'
    END                                                                         AS level,
    COALESCE(
        NULLIF(TRIM(ed->>'specific_degree'), ''),
        NULLIF(TRIM(ed->>'education_program'), ''),
        ''
    )                                                                           AS degree,
    CASE
        WHEN ed->>'education_year_graduated' ~ '^\d{4}$'
        THEN (ed->>'education_year_graduated')::INT
        ELSE NULL
    END                                                                         AS year_graduated,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.education_degrees) = 'array'
         THEN a.education_degrees ELSE '[]'::jsonb END
) AS ed
WHERE a.education_degrees IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.education_degrees) = 'array'
           THEN a.education_degrees ELSE '[]'::jsonb END
  ) > 0;

-- ============================================================
-- 2. ELIGIBILITY RECORDS
-- Source: eligibilities JSONB (both masterlist and staging)
-- JSONB shape: [{ eligibility, title, date, rating, place_of_assignment }]
-- NOTE: backend normalizes eligibility/title to UPPERCASE on write (L484–L492)
-- ============================================================

-- 2a. From masterlist
INSERT INTO tlo_eligibility_records
    (source_table, tlo_id, eligibility_type, rating, conferment_date,
     place_of_assignment, created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    UPPER(COALESCE(
        NULLIF(TRIM(el->>'eligibility'), ''),
        NULLIF(TRIM(el->>'title'), ''),
        'UNKNOWN'
    ))                                                                          AS eligibility_type,
    NULLIF(TRIM(el->>'rating'), '')                                             AS rating,
    CASE
        WHEN el->>'date' IS NOT NULL
         AND el->>'date' != ''
         AND (el->>'date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (el->>'date')::DATE
        ELSE NULL
    END                                                                         AS conferment_date,
    NULLIF(UPPER(TRIM(el->>'place_of_assignment')), '')                         AS place_of_assignment,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.eligibilities) = 'array'
         THEN m.eligibilities ELSE '[]'::jsonb END
) AS el
WHERE m.eligibilities IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.eligibilities) = 'array'
           THEN m.eligibilities ELSE '[]'::jsonb END
  ) > 0;

-- 2b. From staging
INSERT INTO tlo_eligibility_records
    (source_table, tlo_id, eligibility_type, rating, conferment_date,
     place_of_assignment, created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    UPPER(COALESCE(
        NULLIF(TRIM(el->>'eligibility'), ''),
        NULLIF(TRIM(el->>'title'), ''),
        'UNKNOWN'
    ))                                                                          AS eligibility_type,
    NULLIF(TRIM(el->>'rating'), '')                                             AS rating,
    CASE
        WHEN el->>'date' IS NOT NULL
         AND el->>'date' != ''
         AND (el->>'date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (el->>'date')::DATE
        ELSE NULL
    END                                                                         AS conferment_date,
    NULLIF(UPPER(TRIM(el->>'place_of_assignment')), '')                         AS place_of_assignment,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.eligibilities) = 'array'
         THEN a.eligibilities ELSE '[]'::jsonb END
) AS el
WHERE a.eligibilities IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.eligibilities) = 'array'
           THEN a.eligibilities ELSE '[]'::jsonb END
  ) > 0;

-- ============================================================
-- 3. POSITION HISTORY
-- Source: previous_positions JSONB (both masterlist and staging)
-- JSONB shape: [{ position_name, office, strand, start_date, end_date,
--                 oic_positions[] }]
-- NOTE: position_name stored UPPERCASE per backend normalization (L500–L504)
-- ============================================================

-- 3a. From masterlist
INSERT INTO tlo_position_history
    (source_table, tlo_id, position_name, office, strand,
     inclusive_date_start, inclusive_date_end, oic_positions, created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    UPPER(COALESCE(NULLIF(TRIM(pos->>'position_name'), ''), ''))                AS position_name,
    NULLIF(TRIM(pos->>'office'), '')                                            AS office,
    NULLIF(TRIM(pos->>'strand'), '')                                            AS strand,
    CASE
        WHEN pos->>'start_date' IS NOT NULL
         AND pos->>'start_date' != ''
         AND (pos->>'start_date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (pos->>'start_date')::DATE ELSE NULL
    END                                                                         AS inclusive_date_start,
    CASE
        WHEN pos->>'end_date' IS NOT NULL
         AND pos->>'end_date' != ''
         AND (pos->>'end_date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (pos->>'end_date')::DATE ELSE NULL
    END                                                                         AS inclusive_date_end,
    CASE
        WHEN jsonb_typeof(pos->'oic_positions') = 'array'
         AND jsonb_array_length(pos->'oic_positions') > 0
        THEN pos->'oic_positions'
        ELSE NULL
    END                                                                         AS oic_positions,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.previous_positions) = 'array'
         THEN m.previous_positions ELSE '[]'::jsonb END
) AS pos
WHERE m.previous_positions IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.previous_positions) = 'array'
           THEN m.previous_positions ELSE '[]'::jsonb END
  ) > 0;

-- 3b. From staging
INSERT INTO tlo_position_history
    (source_table, tlo_id, position_name, office, strand,
     inclusive_date_start, inclusive_date_end, oic_positions, created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    UPPER(COALESCE(NULLIF(TRIM(pos->>'position_name'), ''), ''))                AS position_name,
    NULLIF(TRIM(pos->>'office'), '')                                            AS office,
    NULLIF(TRIM(pos->>'strand'), '')                                            AS strand,
    CASE
        WHEN pos->>'start_date' IS NOT NULL
         AND pos->>'start_date' != ''
         AND (pos->>'start_date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (pos->>'start_date')::DATE ELSE NULL
    END                                                                         AS inclusive_date_start,
    CASE
        WHEN pos->>'end_date' IS NOT NULL
         AND pos->>'end_date' != ''
         AND (pos->>'end_date') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (pos->>'end_date')::DATE ELSE NULL
    END                                                                         AS inclusive_date_end,
    CASE
        WHEN jsonb_typeof(pos->'oic_positions') = 'array'
         AND jsonb_array_length(pos->'oic_positions') > 0
        THEN pos->'oic_positions'
        ELSE NULL
    END                                                                         AS oic_positions,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.previous_positions) = 'array'
         THEN a.previous_positions ELSE '[]'::jsonb END
) AS pos
WHERE a.previous_positions IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.previous_positions) = 'array'
           THEN a.previous_positions ELSE '[]'::jsonb END
  ) > 0;

-- ============================================================
-- 4. TRAINING RECORDS
-- Source: relevant_trainings JSONB (both masterlist and staging)
-- JSONB shape: [{ training_name, date_from, date_to, conducted_by }]
-- NOTE: training_name stored UPPERCASE per backend normalization (L395–L401)
-- ============================================================

-- 4a. From masterlist
INSERT INTO tlo_training_records
    (source_table, tlo_id, training_name, inclusive_date_start,
     inclusive_date_end, conducted_by, created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    UPPER(COALESCE(NULLIF(TRIM(t->>'training_name'), ''), ''))                  AS training_name,
    CASE
        WHEN t->>'date_from' IS NOT NULL
         AND t->>'date_from' != ''
         AND (t->>'date_from') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (t->>'date_from')::DATE ELSE NULL
    END                                                                         AS inclusive_date_start,
    CASE
        WHEN t->>'date_to' IS NOT NULL
         AND t->>'date_to' != ''
         AND (t->>'date_to') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (t->>'date_to')::DATE ELSE NULL
    END                                                                         AS inclusive_date_end,
    NULLIF(TRIM(t->>'conducted_by'), '')                                        AS conducted_by,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.relevant_trainings) = 'array'
         THEN m.relevant_trainings ELSE '[]'::jsonb END
) AS t
WHERE m.relevant_trainings IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.relevant_trainings) = 'array'
           THEN m.relevant_trainings ELSE '[]'::jsonb END
  ) > 0;

-- 4b. From staging
INSERT INTO tlo_training_records
    (source_table, tlo_id, training_name, inclusive_date_start,
     inclusive_date_end, conducted_by, created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    UPPER(COALESCE(NULLIF(TRIM(t->>'training_name'), ''), ''))                  AS training_name,
    CASE
        WHEN t->>'date_from' IS NOT NULL
         AND t->>'date_from' != ''
         AND (t->>'date_from') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (t->>'date_from')::DATE ELSE NULL
    END                                                                         AS inclusive_date_start,
    CASE
        WHEN t->>'date_to' IS NOT NULL
         AND t->>'date_to' != ''
         AND (t->>'date_to') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (t->>'date_to')::DATE ELSE NULL
    END                                                                         AS inclusive_date_end,
    NULLIF(TRIM(t->>'conducted_by'), '')                                        AS conducted_by,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.relevant_trainings) = 'array'
         THEN a.relevant_trainings ELSE '[]'::jsonb END
) AS t
WHERE a.relevant_trainings IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.relevant_trainings) = 'array'
           THEN a.relevant_trainings ELSE '[]'::jsonb END
  ) > 0;

-- ============================================================
-- 5. ACCOMPLISHMENT RECORDS
-- Source: individual_accomplishments JSONB (both masterlist and staging)
-- JSONB shape: array of plain strings (NOT objects)
-- Empty strings and JSON quote artifacts are filtered out.
-- ============================================================

-- 5a. From masterlist
INSERT INTO tlo_accomplishment_records
    (source_table, tlo_id, description, created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    -- Strip surrounding JSON quotes from plain string elements
    TRIM(BOTH '"' FROM acc::TEXT)                                               AS description,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.individual_accomplishments) = 'array'
         THEN m.individual_accomplishments ELSE '[]'::jsonb END
) AS acc
WHERE m.individual_accomplishments IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.individual_accomplishments) = 'array'
           THEN m.individual_accomplishments ELSE '[]'::jsonb END
  ) > 0
  AND TRIM(BOTH '"' FROM acc::TEXT) != '';

-- 5b. From staging
INSERT INTO tlo_accomplishment_records
    (source_table, tlo_id, description, created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    TRIM(BOTH '"' FROM acc::TEXT)                                               AS description,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.individual_accomplishments) = 'array'
         THEN a.individual_accomplishments ELSE '[]'::jsonb END
) AS acc
WHERE a.individual_accomplishments IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.individual_accomplishments) = 'array'
           THEN a.individual_accomplishments ELSE '[]'::jsonb END
  ) > 0
  AND TRIM(BOTH '"' FROM acc::TEXT) != '';

-- ============================================================
-- 6. OTHER COURSES
-- Source: other_courses JSONB (both masterlist and staging)
-- JSONB shape: [{ course, date_from, date_to, details }]
-- ============================================================

-- 6a. From masterlist
INSERT INTO tlo_other_courses
    (source_table, tlo_id, course_title, details, date_from, date_to,
     created_at, updated_at)
SELECT
    'masterlist',
    m."TLOid",
    COALESCE(NULLIF(TRIM(c->>'course'), ''), '')                                AS course_title,
    NULLIF(TRIM(c->>'details'), '')                                             AS details,
    CASE
        WHEN c->>'date_from' IS NOT NULL
         AND c->>'date_from' != ''
         AND (c->>'date_from') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (c->>'date_from')::DATE ELSE NULL
    END                                                                         AS date_from,
    CASE
        WHEN c->>'date_to' IS NOT NULL
         AND c->>'date_to' != ''
         AND (c->>'date_to') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (c->>'date_to')::DATE ELSE NULL
    END                                                                         AS date_to,
    NOW(), NOW()
FROM third_level_official_masterlist m
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(m.other_courses) = 'array'
         THEN m.other_courses ELSE '[]'::jsonb END
) AS c
WHERE m.other_courses IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(m.other_courses) = 'array'
           THEN m.other_courses ELSE '[]'::jsonb END
  ) > 0;

-- 6b. From staging
INSERT INTO tlo_other_courses
    (source_table, tlo_id, course_title, details, date_from, date_to,
     created_at, updated_at)
SELECT
    'staging',
    a.app_TLOid,
    COALESCE(NULLIF(TRIM(c->>'course'), ''), '')                                AS course_title,
    NULLIF(TRIM(c->>'details'), '')                                             AS details,
    CASE
        WHEN c->>'date_from' IS NOT NULL
         AND c->>'date_from' != ''
         AND (c->>'date_from') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (c->>'date_from')::DATE ELSE NULL
    END                                                                         AS date_from,
    CASE
        WHEN c->>'date_to' IS NOT NULL
         AND c->>'date_to' != ''
         AND (c->>'date_to') ~ '^\d{4}-\d{2}-\d{2}'
        THEN (c->>'date_to')::DATE ELSE NULL
    END                                                                         AS date_to,
    NOW(), NOW()
FROM third_level_officials_profiling_application a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a.other_courses) = 'array'
         THEN a.other_courses ELSE '[]'::jsonb END
) AS c
WHERE a.other_courses IS NOT NULL
  AND jsonb_array_length(
      CASE WHEN jsonb_typeof(a.other_courses) = 'array'
           THEN a.other_courses ELSE '[]'::jsonb END
  ) > 0;

COMMIT;

-- ============================================================
-- ROLLBACK — run this if migration 008 validation fails
-- Safe: removes only migrated rows, does not touch parent tables
-- ============================================================
-- BEGIN;
-- DELETE FROM tlo_education_records      WHERE source_table IN ('masterlist', 'staging');
-- DELETE FROM tlo_eligibility_records    WHERE source_table IN ('masterlist', 'staging');
-- DELETE FROM tlo_position_history       WHERE source_table IN ('masterlist', 'staging');
-- DELETE FROM tlo_training_records       WHERE source_table IN ('masterlist', 'staging');
-- DELETE FROM tlo_accomplishment_records WHERE source_table IN ('masterlist', 'staging');
-- DELETE FROM tlo_other_courses          WHERE source_table IN ('masterlist', 'staging');
-- COMMIT;
