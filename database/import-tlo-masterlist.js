const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { Pool } = require('pg');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

function cleanEncoding(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/\u00c3\u0083\u00e2\u0080\u0098/g, 'Ñ')
    .replace(/\u00c3\u00af\u00c2\u00bf\u00c2\u00bd/g, 'Ñ')
    .replace(/\u00c3\u0091/g, 'Ñ')
    .replace(/\u00c3\u00b1/g, 'ñ')
    .replace(/PEï¿½AFLOR|PEAFLOR/g, 'PEÑAFLOR')
    .replace(/TABAï¿½AG|TABAAG/g, 'TABAÑAG')
    .replace(/PIï¿½OL|PIOL/g, 'PIÑOL')
    .replace(/ORDOÑE Z/g, 'ORDOÑEZ')
    .trim();
}

function sanitizeGender(val) {
  if (!val) return null;
  const cleaned = val.trim().toUpperCase();
  if (cleaned === 'MALE' || cleaned === 'FEMALE') return cleaned;
  return null;
}

function isSuffixOrPlaceholder(val) {
  if (!val) return false;
  const s = val.trim().toUpperCase();
  return /^(JR|JR\.|SR|SR\.|II|III|IV|V|NONE|N\/A|NOT APPLICANLE|NOT APPLICATION|\s*APPLICABLE|CESO.*|QWER)$/i.test(s);
}

async function runImport() {
  const csvPath = path.resolve(__dirname, 'data', 'tlo_masterlist.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`================================================================`);
  console.log(`🚀 IMPORTING TLO MASTERLIST FROM CSV INTO PHYSICAL TABLE`);
  console.log(`================================================================`);
  console.log(`Source File: ${csvPath}`);

  const workbook = xlsx.readFile(csvPath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  const records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  console.log(`Parsed ${records.length} records from CSV.`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user', 'CSV_IMPORT', true);");

    // Verify tlo_masterlist is a BASE TABLE
    const tableTypeRes = await client.query(`
      SELECT table_type 
      FROM information_schema.tables 
      WHERE table_name = 'tlo_masterlist';
    `);
    console.log(`Target 'tlo_masterlist' table type:`, tableTypeRes.rows[0]?.table_type);

    let insertedMasterlist = 0;
    let updatedMasterlist = 0;

    for (const r of records) {
      const tloId = (r.TLOid || '').trim();
      if (!tloId) continue;

      const firstName = cleanEncoding(r.first_name);
      const lastName = cleanEncoding(r.last_name);
      const middleName = cleanEncoding(r.middle_name);
      const suffix = cleanEncoding(r.suffix);
      const gender = sanitizeGender(r.gender);

      // Upsert into physical table tlo_masterlist
      const res = await client.query(`
        INSERT INTO tlo_masterlist (
          tloid, first_name, last_name, middle_name, suffix, gender, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (tloid) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          middle_name = EXCLUDED.middle_name,
          suffix = EXCLUDED.suffix,
          gender = EXCLUDED.gender,
          updated_at = NOW();
      `, [tloId, firstName, lastName, middleName, suffix, gender]);

      if (res.rowCount > 0) {
        insertedMasterlist++;
      }
    }

    await client.query('COMMIT');

    console.log(`\n================================================================`);
    console.log(`✅ IMPORT INTO PHYSICAL TABLE 'tlo_masterlist' COMPLETED!`);
    console.log(`================================================================`);
    console.log(`  - Total CSV records processed:    ${records.length}`);
    console.log(`  - Rows in 'tlo_masterlist' table: ${insertedMasterlist}`);

    // Verify row count in tlo_masterlist
    const countRes = await client.query('SELECT count(*) FROM tlo_masterlist;');
    console.log(`  - Verified row count in DB:       ${countRes.rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during import, transaction rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runImport();
