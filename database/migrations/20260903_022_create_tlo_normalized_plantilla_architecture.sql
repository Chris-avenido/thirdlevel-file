-- Migration: 20260903_022_create_tlo_normalized_plantilla_architecture.sql
-- Description: Implement true 3-table normalized DepEd plantilla architecture:
--              1. tlo_personnel (Human / Physical Person)
--              2. tlo_items (Budget Shell / Plantilla Position)
--              3. tlo_assignments (Deployment / Assignment History Glue)

BEGIN;

-- ── 1. Create tlo_personnel (Human) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_tlo_id VARCHAR(50),
    prefix VARCHAR(50),
    first_name VARCHAR(150) NOT NULL,
    middle_name VARCHAR(150),
    last_name VARCHAR(150) NOT NULL,
    suffix VARCHAR(50),
    gender VARCHAR(20),
    date_of_birth DATE,
    civil_status VARCHAR(50),
    email VARCHAR(255),
    alt_email_1 VARCHAR(255),
    alt_email_2 VARCHAR(255),
    contact_details VARCHAR(255),
    alt_contact_details_1 VARCHAR(255),
    alt_contact_details_2 VARCHAR(255),
    permanent_address TEXT,
    temporary_address TEXT,
    nationality TEXT,
    religion TEXT,
    blood_type TEXT,
    dependents TEXT,
    height TEXT,
    weight TEXT,
    age SMALLINT,
    dpa_consented_at TIMESTAMP WITH TIME ZONE,
    emt_passer BOOLEAN,
    emt_date DATE,
    ces_stage TEXT,
    ces_conferment_date DATE,
    total_years_third_level NUMERIC,
    managerial_experience_total TEXT,
    performance_rating_1 TEXT,
    performance_rating_1_period TEXT,
    performance_rating_2 TEXT,
    performance_rating_2_period TEXT,
    performance_rating_3 TEXT,
    performance_rating_3_period TEXT,
    cespes_1_rating TEXT,
    cespes_2_rating TEXT,
    cespes_rating_1_period TEXT,
    cespes_rating_2_period TEXT,
    performance_rating_ipcrf TEXT,
    performance_rating_cespes TEXT,
    pending_admin_case TEXT,
    ombudsman_case TEXT,
    guilty_admin_details TEXT,
    criminally_charged_details TEXT,
    convicted_crime_details TEXT,
    sandiganbayan_clearance_binary_id VARCHAR(255),
    nbi_clearance_binary_id VARCHAR(255),
    csc_clearance_binary_id VARCHAR(255),
    ombudsman_clearance_binary_id VARCHAR(255),
    photo_binary_id UUID,
    pds_binary_id UUID,
    profile_word_binary_id UUID,
    profile_ppt_binary_id UUID,
    service_records_binary_id UUID,
    executive_summary_binary_id TEXT,
    notable_achievements JSONB DEFAULT '[]'::jsonb,
    total_training_hours NUMERIC,
    is_testaccount BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. Create tlo_items (Budget Shell) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_items (
    item_number VARCHAR(100) PRIMARY KEY,
    position_title VARCHAR(255) NOT NULL,
    salary_grade VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. Create tlo_assignments (Deployment & Assignment History) ───────────────
CREATE TABLE IF NOT EXISTS tlo_assignments (
    id SERIAL PRIMARY KEY,
    personnel_id UUID NOT NULL REFERENCES tlo_personnel(id) ON DELETE RESTRICT,
    item_number VARCHAR(100) REFERENCES tlo_items(item_number) ON DELETE RESTRICT,
    region VARCHAR(255),
    division VARCHAR(255),
    office VARCHAR(255),
    strand VARCHAR(255),
    designation TEXT,
    assignment_type VARCHAR(50) NOT NULL DEFAULT 'Permanent', -- 'Permanent', 'Concurrent', 'OIC'
    status VARCHAR(50) NOT NULL DEFAULT 'Active',             -- 'Active', 'Ended'
    start_date DATE,
    end_date DATE,
    reassignment_order_binary_id UUID,
    remarks TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tlo_assignments_personnel ON tlo_assignments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_item ON tlo_assignments(item_number);
CREATE INDEX IF NOT EXISTS idx_tlo_assignments_status ON tlo_assignments(status, assignment_type);

-- ── 4. Migrate Data from masterlist to tlo_items (All 625 items) ─────────────
INSERT INTO tlo_items (item_number, position_title, salary_grade, created_at, updated_at)
SELECT 
    "TLOid" AS item_number,
    COALESCE(position_title, 'Unspecified Position') AS position_title,
    NULL AS salary_grade,
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
FROM third_level_official_masterlist
ON CONFLICT (item_number) DO UPDATE
SET position_title = EXCLUDED.position_title,
    updated_at = EXCLUDED.updated_at;

-- ── 5. Migrate Data from masterlist to tlo_personnel (Distinct humans) ───────
INSERT INTO tlo_personnel (
    legacy_tlo_id, prefix, first_name, middle_name, last_name, suffix,
    gender, date_of_birth, civil_status, email, alt_email_1, alt_email_2,
    contact_details, alt_contact_details_1, alt_contact_details_2,
    permanent_address, temporary_address,
    nationality, religion, blood_type, dependents, height, weight, age,
    dpa_consented_at,
    emt_passer, emt_date, ces_stage, ces_conferment_date,
    total_years_third_level, managerial_experience_total,
    performance_rating_1, performance_rating_1_period,
    performance_rating_2, performance_rating_2_period,
    performance_rating_3, performance_rating_3_period,
    cespes_1_rating, cespes_2_rating,
    cespes_rating_1_period, cespes_rating_2_period,
    performance_rating_ipcrf, performance_rating_cespes,
    pending_admin_case, ombudsman_case,
    guilty_admin_details, criminally_charged_details, convicted_crime_details,
    sandiganbayan_clearance_binary_id, nbi_clearance_binary_id,
    csc_clearance_binary_id, ombudsman_clearance_binary_id,
    photo_binary_id, pds_binary_id, profile_word_binary_id, profile_ppt_binary_id,
    service_records_binary_id, executive_summary_binary_id,
    notable_achievements, total_training_hours,
    is_testaccount, created_at, updated_at
)
SELECT DISTINCT ON (LOWER(TRIM(COALESCE(email, ''))), LOWER(TRIM(first_name)), LOWER(TRIM(last_name)))
    "TLOid", NULL AS prefix, first_name, middle_name, last_name, suffix,
    gender, date_of_birth, civil_status, email, alt_email_1, alt_email_2,
    contact_details, alt_contact_details_1, alt_contact_details_2,
    permanent_address, temporary_address,
    nationality, religion, blood_type, dependents, height, weight, age,
    dpa_consented_at,
    emt_passer, emt_date, ces_stage, ces_conferment_date,
    total_years_third_level, managerial_experience_total,
    performance_rating_1, performance_rating_1_period,
    performance_rating_2, performance_rating_2_period,
    performance_rating_3, performance_rating_3_period,
    cespes_1_rating, cespes_2_rating,
    cespes_rating_1_period, cespes_rating_2_period,
    performance_rating_ipcrf, performance_rating_cespes,
    pending_admin_case, ombudsman_case,
    guilty_admin_details, criminally_charged_details, convicted_crime_details,
    sandiganbayan_clearance_binary_id, nbi_clearance_binary_id,
    csc_clearance_binary_id, ombudsman_clearance_binary_id,
    photo_binary_id, pds_binary_id, profile_word_binary_id, profile_ppt_binary_id,
    service_records_binary_id, executive_summary_binary_id,
    notable_achievements, total_training_hours,
    is_testaccount, COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
FROM third_level_official_masterlist
WHERE first_name IS NOT NULL 
  AND TRIM(first_name) != '' 
  AND first_name NOT ILIKE '%VACANT%'
ORDER BY LOWER(TRIM(COALESCE(email, ''))), LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), "TLOid" ASC;

-- ── 6. Migrate Active Assignments to tlo_assignments ─────────────────────────
INSERT INTO tlo_assignments (
    personnel_id, item_number, region, division, office, strand, designation,
    assignment_type, status, start_date, end_date, reassignment_order_binary_id,
    created_at, updated_at
)
SELECT 
    p.id AS personnel_id,
    m."TLOid" AS item_number,
    m.region,
    m.division,
    m.office,
    m.strand,
    COALESCE(m.designation, m.position_title) AS designation,
    CASE 
        WHEN m.is_oic = TRUE THEN 'OIC'
        ELSE 'Permanent'
    END AS assignment_type,
    'Active' AS status,
    COALESCE(m.appointment_date, m.effectivity_date::date, NOW()::date) AS start_date,
    NULL AS end_date,
    m.reassignment_order_binary_id,
    COALESCE(m.created_at, NOW()),
    COALESCE(m.updated_at, NOW())
FROM third_level_official_masterlist m
JOIN tlo_personnel p ON (
    (m.email IS NOT NULL AND LOWER(TRIM(m.email)) = LOWER(TRIM(p.email)))
    OR (LOWER(TRIM(m.first_name)) = LOWER(TRIM(p.first_name)) AND LOWER(TRIM(m.last_name)) = LOWER(TRIM(p.last_name)))
)
WHERE m.status = 'Active'
  AND m.first_name IS NOT NULL 
  AND TRIM(m.first_name) != '' 
  AND m.first_name NOT ILIKE '%VACANT%';

-- ── 7. Migrate Historical Assignments from tlo_position_history ──────────────
INSERT INTO tlo_assignments (
    personnel_id, item_number, region, division, office, strand, designation,
    assignment_type, status, start_date, end_date, reassignment_order_binary_id,
    remarks, created_by, updated_by, created_at, updated_at
)
SELECT 
    p.id AS personnel_id,
    h.tlo_id AS item_number,
    h.region,
    h.division,
    h.office,
    h.strand,
    h.position_name AS designation,
    'Permanent' AS assignment_type,
    'Ended' AS status,
    h.inclusive_date_start AS start_date,
    COALESCE(h.inclusive_date_end, NOW()::date) AS end_date,
    h.reassignment_order_binary_id,
    NULL AS remarks,
    h.created_by,
    h.updated_by,
    h.created_at,
    h.updated_at
FROM tlo_position_history h
JOIN tlo_personnel p ON p.legacy_tlo_id = h.tlo_id
WHERE h.delete_flg = 'No';

COMMIT;
