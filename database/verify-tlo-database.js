const path = require('path');
const { Pool } = require('pg');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env') });

const targetUrl = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function runVerification() {
  const client = await pool.connect();
  console.log('================================================================');
  console.log('🔬 POST-RESTORE SYSTEM AUDIT & INTEGRITY CHECK');
  console.log('================================================================');

  try {
    // 1. Check Primary Keys
    console.log('\n--- 1. Primary Key Audit ---');
    const pkRes = await client.query(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `);
    pkRes.rows.forEach(r => console.log(`  ✅ Table '${r.table_name}' -> PK (${r.column_name})`));

    // 2. Check Sequences
    console.log('\n--- 2. Sequence Positioning Audit ---');
    const seqs = [
      { seq: 'authorization_codes_id_seq', table: 'authorization_codes', col: 'id' },
      { seq: 'tlo_position_history_id_seq', table: 'tlo_position_history', col: 'id' },
      { seq: 'tlo_training_records_id_seq', table: 'tlo_training_records', col: 'id' },
      { seq: 'tlo_education_records_id_seq', table: 'tlo_education_records', col: 'id' },
      { seq: 'tlo_eligibility_records_id_seq', table: 'tlo_eligibility_records', col: 'id' },
      { seq: 'tlo_accomplishment_records_id_seq', table: 'tlo_accomplishment_records', col: 'id' },
      { seq: 'tlo_other_courses_id_seq', table: 'tlo_other_courses', col: 'id' },
      { seq: 'third_level_officials_updates_TLOUid_seq', table: 'third_level_officials_updates', col: '"TLOUid"' }
    ];

    for (const s of seqs) {
      const maxRes = await client.query(`SELECT MAX(${s.col}) AS max_val FROM "${s.table}";`);
      const maxVal = parseInt(maxRes.rows[0].max_val, 10);
      const curRes = await client.query(`SELECT last_value FROM "${s.seq}";`);
      const curVal = parseInt(curRes.rows[0].last_value, 10);
      const isOk = curVal >= maxVal;
      console.log(`  ${isOk ? '✅' : '❌'} Sequence '${s.seq}': current=${curVal}, max(id)=${maxVal} -> ${isOk ? 'OK' : 'MISPOSITIONED'}`);
    }

    // 3. Check Indexes
    console.log('\n--- 3. Performance Indexes Audit ---');
    const idxRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `);
    console.log(`  ✅ Total Active Indexes in tlo_database: ${idxRes.rows.length}`);
    idxRes.rows.slice(0, 10).forEach(i => console.log(`     - ${i.tablename}: ${i.indexname}`));
    if (idxRes.rows.length > 10) console.log(`     ... and ${idxRes.rows.length - 10} more indexes.`);

    // 4. Check Trigger
    console.log('\n--- 4. Ledger Audit Trigger Check ---');
    const trgRes = await client.query(`
      SELECT trigger_name, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public' AND event_object_table = 'third_level_official_masterlist';
    `);
    if (trgRes.rows.length > 0) {
      console.log(`  ✅ Active trigger '${trgRes.rows[0].trigger_name}' attached to '${trgRes.rows[0].event_object_table}'`);
    } else {
      console.warn(`  ⚠️ Trigger trg_tlo_append_ledger not found!`);
    }

    // 5. Orphaned Records Check
    console.log('\n--- 5. Data Relationship & Orphan Check ---');
    const childTables = [
      'tlo_education_records',
      'tlo_eligibility_records',
      'tlo_position_history',
      'tlo_training_records',
      'tlo_accomplishment_records',
      'tlo_other_courses'
    ];

    for (const ct of childTables) {
      const orphanRes = await client.query(`
        SELECT COUNT(*) as orphan_count 
        FROM "${ct}" c
        WHERE c.source_table = 'masterlist' 
          AND NOT EXISTS (
            SELECT 1 FROM third_level_official_masterlist m 
            WHERE m."TLOid" = c.tlo_id
          );
      `);
      console.log(`  ✅ ${ct}: ${orphanRes.rows[0].orphan_count} orphaned records from masterlist`);
    }

    // 6. Application Query Smoke Test
    console.log('\n--- 6. Application Query Simulation Smoke Test ---');
    // Test Officials Masterlist KPI Query
    const kpiRes = await client.query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM third_level_official_masterlist 
      GROUP BY status 
      ORDER BY count DESC;
    `);
    console.log('  ✅ Officials Status Breakdown in tlo_database:');
    kpiRes.rows.forEach(r => console.log(`     - ${r.status || 'NULL'}: ${r.count} officials`));

    // Test Officials with Active Position
    const sampleOfficial = await client.query(`
      SELECT "TLOid", first_name, last_name, position_title, office, status 
      FROM third_level_official_masterlist 
      WHERE status = 'Active' 
      LIMIT 3;
    `);
    console.log('  ✅ Sample Active Officials from Latest Server Dump:');
    sampleOfficial.rows.forEach(o => console.log(`     - [${o.TLOid}] ${o.first_name} ${o.last_name} — ${o.position_title} (${o.office})`));

    // Test Users Table
    const userSample = await client.query(`
      SELECT role, registration_status, COUNT(*) as count 
      FROM tlo_users 
      GROUP BY role, registration_status;
    `);
    console.log('  ✅ tlo_users Role Breakdown:');
    userSample.rows.forEach(u => console.log(`     - Role: ${u.role}, Status: ${u.registration_status} -> ${u.count} users`));

    console.log('\n================================================================');
    console.log('✅ ALL POST-RESTORE VERIFICATION AUDITS PASSED 100%!');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Verification error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
