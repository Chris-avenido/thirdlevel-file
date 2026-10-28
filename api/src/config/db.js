import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const pool = new pg.Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('azure') ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
} : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'insighted_standalone',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 5432,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('[Database] Connection established successfully.');
});

pool.on('error', (err) => {
  console.error('[Database] Connection error:', err);
});

export const initDB = async () => {
  try {
    await pool.query('ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS remarks TEXT;');
    await pool.query('ALTER TABLE tlo_users ADD COLUMN IF NOT EXISTS assigned_region TEXT;');
    await pool.query('ALTER TABLE tlo_users ADD COLUMN IF NOT EXISTS assigned_division TEXT;');
    await pool.query('ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS designation TEXT;');
    await pool.query('ALTER TABLE third_level_officials_profiling_application ADD COLUMN IF NOT EXISTS designation TEXT;');
    await pool.query('ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS wes_binary_id UUID;');
    await pool.query('ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS cv_binary_id UUID;');
    await pool.query('ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;');
    await pool.query('ALTER TABLE third_level_officials_profiling_application ADD COLUMN IF NOT EXISTS wes_binary_id UUID;');
    await pool.query('ALTER TABLE third_level_officials_profiling_application ADD COLUMN IF NOT EXISTS cv_binary_id UUID;');
    await pool.query('ALTER TABLE unified_binaries ADD COLUMN IF NOT EXISTS content BYTEA;');
    await pool.query('ALTER TABLE third_level_official_masterlist ADD COLUMN IF NOT EXISTS vacancy_applicant_id INTEGER;');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS authorization_codes (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      
      INSERT INTO authorization_codes (code, role, is_active)
      VALUES 
        ($1, $2, TRUE),
        ($3, $4, TRUE)
      ON CONFLICT (code) DO UPDATE
      SET role = EXCLUDED.role,
          is_active = TRUE,
          updated_at = NOW();
    `, [
      (process.env.CO_AUTH_CODE || 'nVxCpLrTqWmK').toUpperCase().trim(),
      'Central Office',
      (process.env.APP_AUTH_CODE || 'mXqWpLsKdJfN').toUpperCase().trim(),
      'Third Level Applicant'
    ]);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacancy_applicants (
        id SERIAL PRIMARY KEY,
        applicant_uid VARCHAR(64) UNIQUE,
        first_name VARCHAR(150) NOT NULL,
        last_name VARCHAR(150) NOT NULL,
        middle_name VARCHAR(150),
        suffix VARCHAR(50),
        email VARCHAR(255) NOT NULL UNIQUE,
        contact_number VARCHAR(50),
        password_hash VARCHAR(255),
        passcode VARCHAR(255),
        registration_status VARCHAR(50) DEFAULT 'Active' NOT NULL,
        target_vacancy_id VARCHAR(100),
        target_position_title VARCHAR(255),
        notes TEXT,
        is_testaccount BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      ALTER TABLE vacancy_applicants ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE vacancy_applicants ADD COLUMN IF NOT EXISTS passcode VARCHAR(255);

      CREATE TABLE IF NOT EXISTS vacancy_applications (
        id SERIAL PRIMARY KEY,
        application_no VARCHAR(64) UNIQUE NOT NULL,
        applicant_uid VARCHAR(64) NOT NULL,
        vacancy_applicant_id INTEGER REFERENCES vacancy_applicants(id) ON DELETE SET NULL,
        email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(50),
        position_applying_for VARCHAR(255) NOT NULL,
        target_vacancy_id VARCHAR(100),
        surname VARCHAR(150) NOT NULL,
        first_name VARCHAR(150) NOT NULL,
        middle_name VARCHAR(150),
        date_of_birth DATE,
        current_position VARCHAR(255) NOT NULL,
        plantilla_office VARCHAR(255) NOT NULL,
        current_designation VARCHAR(255) NOT NULL,
        assigned_oic_office VARCHAR(255),
        is_let_passer BOOLEAN NOT NULL DEFAULT FALSE,
        is_emt_passer BOOLEAN NOT NULL DEFAULT FALSE,
        ces_eligibility_stage VARCHAR(100) NOT NULL,
        ces_stage_date DATE,
        letter_of_intent_binary_id UUID,
        letter_of_intent_filename VARCHAR(255),
        pds_binary_id UUID,
        pds_filename VARCHAR(255),
        work_experience_sheet_binary_id UUID,
        work_experience_sheet_filename VARCHAR(255),
        cv_binary_id UUID,
        cv_filename VARCHAR(255),
        outstanding_accomplishments_binary_id UUID,
        outstanding_accomplishments_filename VARCHAR(255),
        service_records_binary_id UUID,
        service_records_filename VARCHAR(255),
        transcript_of_records_binary_id UUID,
        transcript_of_records_filename VARCHAR(255),
        performance_eval_binary_id UUID,
        performance_eval_filename VARCHAR(255),
        self_certification_binary_id UUID,
        self_certification_filename VARCHAR(255),
        id_picture_binary_id UUID,
        id_picture_filename VARCHAR(255),
        applicant_profile_doc_binary_id UUID,
        applicant_profile_doc_filename VARCHAR(255),
        other_documents_binary_id UUID,
        other_documents_filename VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Submitted' NOT NULL,
        remarks TEXT,
        is_testaccount BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('[Database] Schema verified.');
  } catch (err) {
    console.warn('[Database] Initialization warning:', err.message);
  }
};

export default pool;
