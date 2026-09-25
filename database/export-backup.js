const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Resolve pg package from root or api/node_modules
let pg;
try {
  pg = require('pg');
} catch (e) {
  try {
    pg = require(path.join(__dirname, '../api/node_modules/pg'));
  } catch (err) {
    throw new Error('Could not find pg module. Please run npm install.');
  }
}
const { Pool } = pg;

// Base directory is the staging root
const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env') });

// Target database connection string (insightEd production database)
const sourceUrl = process.env.BACKUP_SOURCE_URL || 
  process.argv[2] || 
  'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

// Determine backup folder per current day and year (backups/YYYY/YYYY-MM-DD)
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const yearStr = String(now.getFullYear());
const dayStr = `${yearStr}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const backupDir = path.join(__dirname, 'backups', yearStr, dayStr);

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const pool = new Pool({
  connectionString: sourceUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

// Escape value safely for PostgreSQL INSERT statements
function escapeSqlValue(val, colType) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  
  if (colType === 'ARRAY' || (Array.isArray(val) && colType !== 'jsonb')) {
    if (!val || (Array.isArray(val) && val.length === 0)) return "'{}'::text[]";
    const arr = Array.isArray(val) ? val : [val];
    const items = arr.map(x => `'${String(x).replace(/'/g, "''").replace(/\0/g, '')}'`).join(', ');
    return `ARRAY[${items}]::text[]`;
  }

  if (typeof val === 'object') {
    if (Buffer.isBuffer(val)) {
      return `'\\x${val.toString('hex')}'`;
    }
    const jsonStr = JSON.stringify(val).replace(/'/g, "''").replace(/\0/g, '');
    return `'${jsonStr}'::jsonb`;
  }
  
  const str = String(val).replace(/'/g, "''").replace(/\0/g, '');
  return `'${str}'`;
}

// Map PostgreSQL data types to SQLite column types
function pgToSqliteType(dataType, udtName) {
  if (['smallint', 'integer', 'bigint', 'boolean'].includes(dataType)) return 'INTEGER';
  if (['numeric', 'double precision', 'real'].includes(dataType)) return 'REAL';
  if (dataType === 'bytea') return 'BLOB';
  return 'TEXT';
}

// Format value for SQLite insertion
function formatSqliteValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val;
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

async function runBackup() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log(`🚀 Starting InsightEd TLO Database Backup`);
  console.log(`   Source: stride-posgre-prod-01.postgres.database.azure.com / insightEd`);
  console.log(`   Target Output: ${backupDir}`);
  console.log(`   Mode: READ-ONLY SAFE TRANSACTION (Zero writes to server)`);
  console.log('================================================================');

  const client = await pool.connect();
  const manifest = {
    backupDate: new Date().toISOString(),
    databaseName: 'insightEd',
    host: 'stride-posgre-prod-01.postgres.database.azure.com',
    tables: {},
    totalRows: 0,
    files: {
      db: 'tlo_system_complete_dump.db',
      sql: 'tlo_system_complete_dump.sql',
      manifest: 'manifest.json'
    }
  };

  // SQLite .db target
  const dbOutPath = path.join(backupDir, 'tlo_system_complete_dump.db');
  if (fs.existsSync(dbOutPath)) {
    fs.unlinkSync(dbOutPath);
  }
  const sqliteDb = new DatabaseSync(dbOutPath);

  // PostgreSQL .sql target
  const sqlOutPath = path.join(backupDir, 'tlo_system_complete_dump.sql');
  const sqlStream = fs.createWriteStream(sqlOutPath, { encoding: 'utf8' });

  sqlStream.write(`-- ====================================================================\n`);
  sqlStream.write(`-- InsightEd Third Level Officials (TLO) System Database Backup\n`);
  sqlStream.write(`-- Extracted from Server: stride-posgre-prod-01.postgres.database.azure.com / insightEd\n`);
  sqlStream.write(`-- Timestamp: ${manifest.backupDate}\n`);
  sqlStream.write(`-- Mode: READ-ONLY SAFE EXTRACTION (Zero writes performed on server)\n`);
  sqlStream.write(`-- ====================================================================\n\n`);
  sqlStream.write(`BEGIN;\n\n`);

  try {
    await client.query('BEGIN READ ONLY;');
    console.log('[Backup] Safe read-only transaction started on server.');

    const targetTables = [
      'authorization_codes',
      'notable_achievements',
      'verification_codes',
      'tlo_users',
      'third_level_official_masterlist',
      'third_level_officials_profiling_application',
      'third_level_officials_updates',
      'tlo_education_records',
      'tlo_eligibility_records',
      'tlo_position_history',
      'tlo_training_records',
      'tlo_accomplishment_records',
      'tlo_other_courses',
      'third_level_officials_masterlist',
      'third_level_officials_profiles',
      'tlo_personnel',
      'tlo_items',
      'tlo_assignments',
      'ces_plantilla_report'
    ];

    for (const table of targetTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [table]);

      if (colRes.rows.length === 0) {
        // Table not present in source database schema, skip cleanly
        continue;
      }

      console.log(`[Backup] Processing table: ${table}...`);

      const colTypeMap = {};
      colRes.rows.forEach(c => { colTypeMap[c.column_name] = c.data_type; });

      const pkRes = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY';
      `, [table]);
      const pkCols = pkRes.rows.map(r => r.column_name);

      // --- 1. Generate PostgreSQL CREATE TABLE in SQL dump ---
      sqlStream.write(`-- ------------------------------------------------------------\n`);
      sqlStream.write(`-- Table: ${table}\n`);
      sqlStream.write(`-- ------------------------------------------------------------\n`);
      sqlStream.write(`CREATE TABLE IF NOT EXISTS "${table}" (\n`);
      const pgColDefs = colRes.rows.map(c => {
        let typeStr = c.udt_name;
        if (c.data_type === 'character varying') typeStr = 'VARCHAR';
        else if (c.data_type === 'timestamp with time zone') typeStr = 'TIMESTAMPTZ';
        else if (c.data_type === 'timestamp without time zone') typeStr = 'TIMESTAMP';
        else if (c.data_type === 'boolean') typeStr = 'BOOLEAN';
        else if (c.data_type === 'text') typeStr = 'TEXT';
        else if (c.data_type === 'smallint') typeStr = 'SMALLINT';
        else if (c.data_type === 'integer') typeStr = 'INTEGER';
        else if (c.data_type === 'bigint') typeStr = 'BIGINT';
        else if (c.data_type === 'numeric') typeStr = 'NUMERIC';
        else if (c.data_type === 'date') typeStr = 'DATE';
        else if (c.data_type === 'jsonb') typeStr = 'JSONB';
        else if (c.data_type === 'uuid') typeStr = 'UUID';
        else if (c.data_type === 'ARRAY' && c.udt_name === '_text') typeStr = 'TEXT[]';

        let line = `  "${c.column_name}" ${typeStr}`;
        if (c.is_nullable === 'NO') line += ' NOT NULL';
        if (c.column_default && !c.column_default.startsWith('nextval')) {
          line += ` DEFAULT ${c.column_default}`;
        }
        return line;
      });

      if (pkCols.length > 0) {
        pgColDefs.push(`  PRIMARY KEY (${pkCols.map(p => `"${p}"`).join(', ')})`);
      }
      sqlStream.write(pgColDefs.join(',\n') + '\n);\n\n');

      // --- 2. Generate SQLite CREATE TABLE in .db file ---
      const seenLowerCols = new Map();
      const sqliteCols = [];

      for (const col of colRes.rows) {
        const lower = col.column_name.toLowerCase();
        let finalColName = col.column_name;
        if (seenLowerCols.has(lower)) {
          const count = seenLowerCols.get(lower) + 1;
          seenLowerCols.set(lower, count);
          finalColName = `${col.column_name}_case_${count}`;
        } else {
          seenLowerCols.set(lower, 1);
        }
        sqliteCols.push({
          originalCol: col.column_name,
          sqliteCol: finalColName,
          dataType: col.data_type,
          udtName: col.udt_name,
          isNullable: col.is_nullable
        });
      }

      const sqliteColDefs = sqliteCols.map(c => {
        const typeStr = pgToSqliteType(c.dataType, c.udtName);
        let line = `  "${c.sqliteCol}" ${typeStr}`;
        return line;
      });

      if (pkCols.length > 0) {
        const mappedPkCols = pkCols.map(pk => {
          const matched = sqliteCols.find(sc => sc.originalCol === pk);
          return `"${matched ? matched.sqliteCol : pk}"`;
        });
        sqliteColDefs.push(`  PRIMARY KEY (${mappedPkCols.join(', ')})`);
      }

      sqliteDb.exec(`CREATE TABLE IF NOT EXISTS "${table}" (\n${sqliteColDefs.join(',\n')}\n);`);

      // --- 3. Fetch Rows and Insert into both .sql and .db ---
      const dataRes = await client.query(`SELECT * FROM "${table}";`);
      const rows = dataRes.rows;
      manifest.tables[table] = rows.length;
      manifest.totalRows += rows.length;

      if (rows.length > 0) {
        // SQL File insert chunks
        const columns = colRes.rows.map(c => c.column_name);
        const colListStr = columns.map(c => `"${c}"`).join(', ');

        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          sqlStream.write(`INSERT INTO "${table}" (${colListStr}) VALUES\n`);
          const valueRows = chunk.map(row => {
            const valList = columns.map(col => escapeSqlValue(row[col], colTypeMap[col]));
            return `  (${valList.join(', ')})`;
          });
          sqlStream.write(valueRows.join(',\n') + ';\n');
        }
        sqlStream.write('\n');

        // SQLite .db insert statement
        const sqliteColNames = sqliteCols.map(c => `"${c.sqliteCol}"`).join(', ');
        const placeholders = sqliteCols.map(() => '?').join(', ');
        const insertStmt = sqliteDb.prepare(`INSERT OR REPLACE INTO "${table}" (${sqliteColNames}) VALUES (${placeholders})`);

        sqliteDb.exec('BEGIN TRANSACTION;');
        for (const row of rows) {
          const values = sqliteCols.map(col => formatSqliteValue(row[col.originalCol]));
          insertStmt.run(...values);
        }
        sqliteDb.exec('COMMIT;');
      }
      console.log(`         -> Exported ${rows.length} rows to .db and .sql.`);
    }

    // Extract TLO subset of unified_binaries (with Azure Blob URLs and metadata, without raw bytea)
    console.log('[Backup] Extracting TLO referenced unified_binaries metadata...');
    const binCols = [
      'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id',
      'service_records_binary_id', 'sandiganbayan_clearance_binary_id', 'nbi_clearance_binary_id',
      'csc_clearance_binary_id', 'ombudsman_clearance_binary_id', 'executive_summary_binary_id',
      'reassignment_order_binary_id'
    ];
    const mlSelects = binCols.map(c => `SELECT "${c}"::text AS bid FROM third_level_official_masterlist WHERE "${c}" IS NOT NULL`);
    const appCols = binCols.filter(c => c !== 'reassignment_order_binary_id');
    const appSelects = appCols.map(c => `SELECT "${c}"::text AS bid FROM third_level_officials_profiling_application WHERE "${c}" IS NOT NULL`);
    const updCols = ['photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id'];
    const updSelects = updCols.map(c => `SELECT "${c}"::text AS bid FROM third_level_officials_updates WHERE "${c}" IS NOT NULL`);

    const binaryMetaRes = await client.query(`
      WITH all_bids AS (
        ${[...mlSelects, ...appSelects, ...updSelects].join(' UNION ')}
      )
      SELECT 
        u.id, 
        u.hash, 
        u.mime_type, 
        u.size_bytes, 
        u.azure_blob_url, 
        u.created_at
      FROM all_bids b
      JOIN unified_binaries u ON u.id::text = b.bid;
    `);

    const tloBinaries = binaryMetaRes.rows;
    manifest.tables['unified_binaries'] = tloBinaries.length;
    manifest.totalRows += tloBinaries.length;

    // PostgreSQL schema for unified_binaries
    sqlStream.write(`-- ------------------------------------------------------------\n`);
    sqlStream.write(`-- Table: unified_binaries (TLO System Metadata & Azure URLs)\n`);
    sqlStream.write(`-- ------------------------------------------------------------\n`);
    sqlStream.write(`CREATE TABLE IF NOT EXISTS "unified_binaries" (\n`);
    sqlStream.write(`  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`);
    sqlStream.write(`  "hash" TEXT,\n`);
    sqlStream.write(`  "content" BYTEA,\n`);
    sqlStream.write(`  "mime_type" TEXT,\n`);
    sqlStream.write(`  "size_bytes" INTEGER,\n`);
    sqlStream.write(`  "azure_blob_url" TEXT,\n`);
    sqlStream.write(`  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT now()\n`);
    sqlStream.write(`);\n\n`);

    // SQLite schema for unified_binaries
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS "unified_binaries" (
        "id" TEXT PRIMARY KEY,
        "hash" TEXT,
        "mime_type" TEXT,
        "size_bytes" INTEGER,
        "azure_blob_url" TEXT,
        "created_at" TEXT
      );
    `);

    if (tloBinaries.length > 0) {
      // PostgreSQL insert
      const bCols = ['id', 'hash', 'mime_type', 'size_bytes', 'azure_blob_url', 'created_at'];
      const colListStr = bCols.map(c => `"${c}"`).join(', ');
      for (let i = 0; i < tloBinaries.length; i += 100) {
        const chunk = tloBinaries.slice(i, i + 100);
        sqlStream.write(`INSERT INTO "unified_binaries" (${colListStr}) VALUES\n`);
        const valRows = chunk.map(row => {
          const vals = bCols.map(col => escapeSqlValue(row[col], 'text'));
          return `  (${vals.join(', ')})`;
        });
        sqlStream.write(valRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n');
      }
      sqlStream.write('\n');

      // SQLite insert
      const insertBinStmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO "unified_binaries" ("id", "hash", "mime_type", "size_bytes", "azure_blob_url", "created_at")
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      sqliteDb.exec('BEGIN TRANSACTION;');
      for (const row of tloBinaries) {
        insertBinStmt.run(
          row.id,
          row.hash,
          row.mime_type,
          row.size_bytes,
          row.azure_blob_url,
          row.created_at ? new Date(row.created_at).toISOString() : null
        );
      }
      sqliteDb.exec('COMMIT;');
    }
    console.log(`         -> Exported ${tloBinaries.length} binary metadata records.`);

    sqlStream.write(`COMMIT;\n`);
    sqlStream.end();

    // Close SQLite database cleanly
    sqliteDb.close();

    // End read-only transaction cleanly
    await client.query('ROLLBACK;');
    console.log('[Backup] Safe read-only transaction closed. ZERO changes made to server database.');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const dbStats = fs.statSync(dbOutPath);
    const dbSizeMb = (dbStats.size / (1024 * 1024)).toFixed(2);

    const sqlStats = fs.statSync(sqlOutPath);
    const sqlSizeMb = (sqlStats.size / (1024 * 1024)).toFixed(2);

    // Write manifest JSON alongside SQL and DB dump
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log('\n================================================================');
    console.log(`✅ DATABASE BACKUP COMPLETED SUCCESSFULLY!`);
    console.log(`   Destination Folder: ${backupDir}`);
    console.log(`   📦 SQLite Database:  ${path.basename(dbOutPath)} (${dbSizeMb} MB)`);
    console.log(`   📄 SQL Dump File:    ${path.basename(sqlOutPath)} (${sqlSizeMb} MB)`);
    console.log(`   📋 Manifest:         manifest.json`);
    console.log(`   📊 Total Tables:     ${Object.keys(manifest.tables).length}`);
    console.log(`   🔢 Total Records:    ${manifest.totalRows.toLocaleString()}`);
    console.log(`   ⏱️ Duration:         ${elapsed}s`);
    console.log('================================================================\n');

  } catch (err) {
    try { await client.query('ROLLBACK;'); } catch (e) {}
    try { sqliteDb.close(); } catch (e) {}
    console.error('❌ [Backup] Error during backup:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Export runBackup for programmatic usage or run directly
module.exports = { runBackup };

if (require.main === module) {
  runBackup();
}
