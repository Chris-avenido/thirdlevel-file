const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function test() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'third_level_official_masterlist'
    `);
    console.log('Columns:');
    res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

    console.log('\nTrying to find TLO-2026-0010:');
    const tloRes = await pool.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', ['TLO-2026-0010']);
    console.log(`Found: ${tloRes.rowCount} rows`);
    if (tloRes.rowCount > 0) {
      console.log('Row details:', JSON.stringify(tloRes.rows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
