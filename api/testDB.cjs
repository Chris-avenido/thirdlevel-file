const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function test() {
  try {
    const res = await pool.query('SELECT DISTINCT "TLOid" FROM third_level_official_masterlist');
    console.log(`Found ${res.rowCount} unique TLOids in masterlist:`);
    const formats = {};
    res.rows.forEach(r => {
      const match = r.TLOid.match(/^TLO-\d+$/);
      const key = match ? 'standard (TLO-XXXX)' : 'other: ' + r.TLOid;
      formats[key] = (formats[key] || 0) + 1;
    });
    console.log(formats);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
