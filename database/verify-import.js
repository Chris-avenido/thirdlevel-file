const path = require('path');
const { Pool } = require('pg');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('================================================================');
    console.log('🔍 VERIFYING tlo_masterlist COLUMNS AFTER DROPPING DUPLICATE');
    console.log('================================================================');

    // 1. Columns
    const colsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tlo_masterlist'
      ORDER BY ordinal_position;
    `);
    console.log('\nColumns of tlo_masterlist:');
    console.table(colsRes.rows);

    // 2. Count
    const countRes = await pool.query('SELECT count(*) FROM tlo_masterlist;');
    console.log(`\nTotal rows in tlo_masterlist table: ${countRes.rows[0].count}`);

    // 3. Sample records
    console.log('\n--- Sample Records Inspection ---');
    const sample = await pool.query(`
      SELECT id, tloid, first_name, last_name, middle_name, suffix, gender
      FROM tlo_masterlist
      WHERE tloid IN ('TLO-0001', 'TLO-0004', 'TLO-0007', 'TLO-0008', 'TLO-0064', 'TLO-0065', 'TLO-0066', 'TLO-0067')
      ORDER BY tloid;
    `);
    console.table(sample.rows);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
