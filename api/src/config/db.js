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
    await pool.query('ALTER TABLE third_level_officials_profiling_application ADD COLUMN IF NOT EXISTS deped_clearance_binary_id UUID;');
    await pool.query('ALTER TABLE unified_binaries ADD COLUMN IF NOT EXISTS content BYTEA;');
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
        registration_status VARCHAR(50) DEFAULT 'Active' NOT NULL,
        target_vacancy_id VARCHAR(100),
        target_position_title VARCHAR(255),
        notes TEXT,
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
