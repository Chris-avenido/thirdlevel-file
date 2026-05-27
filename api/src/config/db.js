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
  console.log('🔗 [Verbose Logging] Database connection established successfully.');
});

pool.on('error', (err) => {
  console.error('🔥 [Verbose Logging] Database connection error:', err);
});

export const initDB = async () => {
  try {
    await pool.query(`ALTER TABLE third_level_officials_updates ADD COLUMN IF NOT EXISTS remarks TEXT;`);
    console.log('✅ Database schema verified.');
  } catch (err) {
    console.warn('⚠️ Database initialization warning:', err.message);
  }
};

export default pool;
