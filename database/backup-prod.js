const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

// Target production server
const REMOTE_USER = 'Administrator1';
const REMOTE_HOST = '20.24.58.49';
const REMOTE_SCRIPT = '/mnt/insighted-third-level-officials/scripts/backup_tlo_daily.sh';
const SSH_OPTS = '-n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=30';
const SCP_OPTS = '-o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=30';

function runSsh(cmd) {
  const fullCmd = `ssh ${SSH_OPTS} ${REMOTE_USER}@${REMOTE_HOST} "${cmd}"`;
  return execSync(fullCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function runScp(remotePath, localPath) {
  const scpCmd = `scp ${SCP_OPTS} ${REMOTE_USER}@${REMOTE_HOST}:${remotePath} "${localPath}"`;
  execSync(scpCmd, { stdio: 'inherit' });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 InsightEd Production Database Backup (On-Demand)');
  console.log('   Target Host: ' + REMOTE_HOST);
  console.log('   Mechanism: Official PostgreSQL pg_dump 17 (via Server)');
  console.log('================================================================\n');

  // Step 1: Trigger remote backup script
  console.log('[1/4] Triggering production backup on server...');
  let stdout;
  try {
    stdout = runSsh(REMOTE_SCRIPT);
    console.log(stdout);
  } catch (err) {
    console.error('❌ Remote backup execution failed:');
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  // Step 2: Extract generated backup filename from output
  const match = stdout.match(/tlo_prod_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql\.gz/);
  if (!match) {
    console.error('❌ Could not parse generated backup archive name from server output.');
    process.exit(1);
  }
  const archiveName = match[0];
  const remotePath = `/mnt/insighted-third-level-officials/backups/daily/${archiveName}`;

  // Prepare local destination by year and day
  const dateFolder = archiveName.replace('tlo_prod_backup_', '').replace('.sql.gz', '');
  const year = archiveName.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const localDestDir = path.join(__dirname, 'backups', year, `daily_prod_${dateFolder}`);
  if (!fs.existsSync(localDestDir)) {
    fs.mkdirSync(localDestDir, { recursive: true });
  }
  const localArchive = path.join(localDestDir, archiveName);

  // Step 3: Download verified archive to local staging
  console.log(`\n[2/4] Downloading verified archive to local staging...`);
  console.log(`      From: ${remotePath}`);
  console.log(`      To:   ${localArchive}`);
  try {
    runScp(remotePath, localArchive);
  } catch (err) {
    console.error('❌ Failed to download backup archive via SCP:', err.message);
    process.exit(1);
  }

  // Step 4: Verify local archive
  console.log(`\n[3/4] Validating local archive integrity...`);
  const stats = fs.statSync(localArchive);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`      Local Archive Size: ${sizeMb} MB (${stats.size.toLocaleString()} bytes)`);

  // Step 5: Decompress archive to plain SQL file
  console.log(`\n[4/4] Extracting SQL dump to tlo_system_complete_dump.sql...`);
  const localSqlFile = path.join(localDestDir, 'tlo_system_complete_dump.sql');
  console.log(`      Extracting to: ${localSqlFile}`);
  try {
    await pipeline(
      fs.createReadStream(localArchive),
      zlib.createGunzip(),
      fs.createWriteStream(localSqlFile)
    );
    const sqlStats = fs.statSync(localSqlFile);
    const sqlSizeMb = (sqlStats.size / (1024 * 1024)).toFixed(2);
    console.log(`      SQL Dump Size: ${sqlSizeMb} MB (${sqlStats.size.toLocaleString()} bytes)`);

    // Remove temporary .gz archive
    fs.unlinkSync(localArchive);
    console.log(`      Cleaned up: ${path.basename(localArchive)}`);
  } catch (err) {
    console.error('❌ Failed to decompress SQL file:', err.message);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('✅ PRODUCTION BACKUP & LOCAL SYNC COMPLETED SUCCESSFULLY!');
  console.log(`   Destination Folder: ${localDestDir}`);
  console.log(`   SQL File:           ${localSqlFile}`);
  console.log('================================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
