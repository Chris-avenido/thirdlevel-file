const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function test() {
  try {
    const TLOid = 'TLO-2026-0010';
    const isMasterlist = !TLOid.startsWith('APP-') && !(TLOid.startsWith('TLO-') && TLOid.split('-').length > 2);
    console.log(`For ${TLOid}, isMasterlist = ${isMasterlist}`);

    const table = isMasterlist ? 'third_level_official_masterlist' : 'third_level_officials_profiling_application';
    const idCol = isMasterlist ? '"TLOid"' : 'app_TLOid';

    console.log(`Target Table: ${table}`);
    console.log(`Target ID Column: ${idCol}`);

    // Try to retrieve the row before
    const beforeRes = await pool.query(`SELECT app_TLOid, civil_status, updated_at FROM third_level_officials_profiling_application WHERE app_TLOid = $1`, [TLOid]);
    console.log('Before:', beforeRes.rows[0]);

    // Try to update civil_status to 'Married'
    await pool.query(`UPDATE ${table} SET civil_status = $1, updated_at = NOW() WHERE ${idCol} = $2`, ['Married', TLOid]);
    console.log('Update query executed.');

    // Try to retrieve the row after
    const afterRes = await pool.query(`SELECT app_TLOid, civil_status, updated_at FROM third_level_officials_profiling_application WHERE app_TLOid = $1`, [TLOid]);
    console.log('After:', afterRes.rows[0]);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
