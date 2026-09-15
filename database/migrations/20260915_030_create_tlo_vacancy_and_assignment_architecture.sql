-- Migration: 20260915_030_create_tlo_vacancy_and_assignment_architecture.sql
-- Description: Establish official 3-table DepED architecture (tlo_plantilla, tlo_profile, tlo_assignment)
--              with explicit vacancy support (plantilla_id IS NULL AND status = 'VACANT').
-- Author: Antigravity
-- Date: 2026-09-15

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create tlo_plantilla (Master Personnel Table)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_plantilla (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permanent_item_no VARCHAR(100),
    first_name VARCHAR(150) NOT NULL,
    middle_name VARCHAR(150),
    last_name VARCHAR(150) NOT NULL,
    suffix VARCHAR(50),
    prefix VARCHAR(50),
    gender VARCHAR(50),
    employment_type VARCHAR(50) NOT NULL DEFAULT 'PLANTILLA'
        CONSTRAINT chk_tlo_plantilla_employment_type CHECK (employment_type IN ('PLANTILLA', 'NON_PLANTILLA', 'CONTRACTUAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_names ON tlo_plantilla(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_item ON tlo_plantilla(permanent_item_no);
CREATE INDEX IF NOT EXISTS idx_tlo_plantilla_employment ON tlo_plantilla(employment_type);

-- Populate tlo_plantilla from existing tlo_personnel if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_personnel') THEN
        INSERT INTO tlo_plantilla (
            id, permanent_item_no, first_name, middle_name, last_name,
            suffix, prefix, gender, employment_type, created_at, updated_at
        )
        SELECT 
            p.id,
            p.legacy_tlo_id AS permanent_item_no,
            p.first_name,
            p.middle_name,
            p.last_name,
            p.suffix,
            p.prefix,
            p.gender,
            'PLANTILLA' AS employment_type,
            COALESCE(p.created_at, NOW()),
            COALESCE(p.updated_at, NOW())
        FROM tlo_personnel p
        ON CONFLICT (id) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            middle_name = EXCLUDED.middle_name,
            permanent_item_no = COALESCE(tlo_plantilla.permanent_item_no, EXCLUDED.permanent_item_no),
            updated_at = NOW();
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create tlo_profile (Demographic & Background Profile 1:1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_profile (
    id SERIAL PRIMARY KEY,
    plantilla_id UUID NOT NULL UNIQUE REFERENCES tlo_plantilla(id) ON DELETE CASCADE,
    date_of_birth DATE,
    civil_status VARCHAR(50),
    tin VARCHAR(50),
    gsis VARCHAR(50),
    pagibig VARCHAR(50),
    philhealth VARCHAR(50),
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

CREATE INDEX IF NOT EXISTS idx_tlo_profile_plantilla ON tlo_profile(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_tlo_profile_email ON tlo_profile(email);

-- Populate tlo_profile from existing tlo_personnel if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_personnel') THEN
        INSERT INTO tlo_profile (
            plantilla_id, date_of_birth, civil_status, email, alt_email_1, alt_email_2,
            contact_details, alt_contact_details_1, alt_contact_details_2,
            permanent_address, temporary_address, nationality, religion, blood_type,
            dependents, height, weight, age, dpa_consented_at, emt_passer, emt_date,
            ces_stage, ces_conferment_date, total_years_third_level, managerial_experience_total,
            performance_rating_1, performance_rating_1_period, performance_rating_2, performance_rating_2_period,
            performance_rating_3, performance_rating_3_period, cespes_1_rating, cespes_2_rating,
            cespes_rating_1_period, cespes_rating_2_period, performance_rating_ipcrf, performance_rating_cespes,
            pending_admin_case, ombudsman_case, guilty_admin_details, criminally_charged_details, convicted_crime_details,
            sandiganbayan_clearance_binary_id, nbi_clearance_binary_id, csc_clearance_binary_id, ombudsman_clearance_binary_id,
            photo_binary_id, pds_binary_id, profile_word_binary_id, profile_ppt_binary_id,
            service_records_binary_id, executive_summary_binary_id, notable_achievements, total_training_hours,
            is_testaccount, created_at, updated_at
        )
        SELECT 
            p.id AS plantilla_id, p.date_of_birth, p.civil_status, p.email, p.alt_email_1, p.alt_email_2,
            p.contact_details, p.alt_contact_details_1, p.alt_contact_details_2,
            p.permanent_address, p.temporary_address, p.nationality, p.religion, p.blood_type,
            p.dependents, p.height, p.weight, p.age, p.dpa_consented_at, p.emt_passer, p.emt_date,
            p.ces_stage, p.ces_conferment_date, p.total_years_third_level, p.managerial_experience_total,
            p.performance_rating_1, p.performance_rating_1_period, p.performance_rating_2, p.performance_rating_2_period,
            p.performance_rating_3, p.performance_rating_3_period, p.cespes_1_rating, p.cespes_2_rating,
            p.cespes_rating_1_period, p.cespes_rating_2_period, p.performance_rating_ipcrf, p.performance_rating_cespes,
            p.pending_admin_case, p.ombudsman_case, p.guilty_admin_details, p.criminally_charged_details, p.convicted_crime_details,
            p.sandiganbayan_clearance_binary_id, p.nbi_clearance_binary_id, p.csc_clearance_binary_id, p.ombudsman_clearance_binary_id,
            p.photo_binary_id, p.pds_binary_id, p.profile_word_binary_id, p.profile_ppt_binary_id,
            p.service_records_binary_id, p.executive_summary_binary_id, p.notable_achievements, p.total_training_hours,
            COALESCE(p.is_testaccount, FALSE), COALESCE(p.created_at, NOW()), COALESCE(p.updated_at, NOW())
        FROM tlo_personnel p
        ON CONFLICT (plantilla_id) DO NOTHING;
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create tlo_assignment (Position Occupancy & Vacancy Master)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tlo_assignment (
    id SERIAL PRIMARY KEY,
    plantilla_id UUID REFERENCES tlo_plantilla(id) ON DELETE SET NULL,
    plantilla_item_no VARCHAR(100),
    position_title VARCHAR(255) NOT NULL,
    designation TEXT,
    region VARCHAR(150),
    division VARCHAR(150),
    office VARCHAR(150),
    strand VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'REGULAR'
        CONSTRAINT chk_tlo_assignment_status CHECK (status IN ('REGULAR', 'OIC', 'VACANT', 'CONTRACTUAL', 'REASSIGNED')),
    is_oic BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    reassignment_order_binary_id UUID,
    remarks TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_tlo_assignment_vacant_null CHECK (status != 'VACANT' OR plantilla_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_tlo_assignment_plantilla ON tlo_assignment(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_item ON tlo_assignment(plantilla_item_no);
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_status ON tlo_assignment(status, is_oic);
CREATE INDEX IF NOT EXISTS idx_tlo_assignment_office ON tlo_assignment(office, region, division);

-- Migrate active and prior assignments from tlo_assignments into tlo_assignment if tlo_assignment is empty
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_assignments') 
       AND (SELECT COUNT(*) FROM tlo_assignment) = 0 THEN
        
        INSERT INTO tlo_assignment (
            id, plantilla_id, plantilla_item_no, position_title, designation,
            region, division, office, strand, status, is_oic,
            start_date, end_date, reassignment_order_binary_id, remarks,
            created_by, updated_by, created_at, updated_at
        )
        SELECT 
            a.id,
            a.personnel_id AS plantilla_id,
            a.item_number AS plantilla_item_no,
            COALESCE(NULLIF(a.position_title, ''), NULLIF(i.position_title, ''), 'Unspecified Position') AS position_title,
            a.designation,
            a.region,
            a.division,
            a.office,
            a.strand,
            CASE 
                WHEN a.status = 'Active' AND COALESCE(a.oic, FALSE) = TRUE THEN 'OIC'
                WHEN a.status = 'Active' THEN 'REGULAR'
                WHEN a.status = 'Vacant' OR a.status = 'VACANT' THEN 'VACANT'
                ELSE 'REASSIGNED'
            END AS status,
            COALESCE(a.oic, FALSE) AS is_oic,
            a.start_date,
            a.end_date,
            a.reassignment_order_binary_id,
            a.remarks,
            a.created_by,
            a.updated_by,
            COALESCE(a.created_at, NOW()),
            COALESCE(a.updated_at, NOW())
        FROM tlo_assignments a
        LEFT JOIN tlo_items i ON i.item_number = a.item_number
        ON CONFLICT (id) DO NOTHING;

        -- Synchronize the sequence with the maximum id migrated
        PERFORM setval('tlo_assignment_id_seq', COALESCE((SELECT MAX(id) FROM tlo_assignment), 1), true);
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed initial VACANT rows for unassigned plantilla items
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tlo_items') THEN
        INSERT INTO tlo_assignment (
            plantilla_id, plantilla_item_no, position_title, designation,
            region, division, office, strand, status, is_oic,
            created_at, updated_at
        )
        SELECT 
            NULL AS plantilla_id,
            i.item_number AS plantilla_item_no,
            i.position_title,
            NULL AS designation,
            m.region,
            m.division,
            m.office,
            m.strand,
            'VACANT' AS status,
            FALSE AS is_oic,
            NOW(),
            NOW()
        FROM tlo_items i
        LEFT JOIN (
            SELECT DISTINCT ON (plantilla_item_no) *
            FROM tlo_assignment
            ORDER BY plantilla_item_no, id DESC
        ) a ON a.plantilla_item_no = i.item_number
        LEFT JOIN third_level_official_masterlist m ON m."TLOid" = i.item_number
        WHERE a.plantilla_item_no IS NULL
           OR (a.status = 'REASSIGNED' AND NOT EXISTS (
               SELECT 1 FROM tlo_assignment a_active 
               WHERE a_active.plantilla_item_no = i.item_number 
                 AND a_active.status IN ('REGULAR', 'OIC')
           ));
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration:
-- BEGIN;
-- DROP TABLE IF EXISTS tlo_assignment CASCADE;
-- DROP TABLE IF EXISTS tlo_profile CASCADE;
-- DROP TABLE IF EXISTS tlo_plantilla CASCADE;
-- COMMIT;
-- =============================================================================
