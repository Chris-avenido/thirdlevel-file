import pg from 'pg';
import jwt from 'jsonwebtoken';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(process.cwd(), '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
const API_PORT = process.env.PORT || 3008;

function apiRequest(method, endpoint, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://127.0.0.1:${API_PORT}${endpoint}`);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 STRICT TEST ACCOUNT ISOLATION VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ── 1. Database Schema & Counts ──────────────────────────────────────────
    console.log('--- 1. DATABASE SCHEMA & INTEGRITY AUDIT ---');
    const tables = [
      'tlo_users',
      'third_level_official_masterlist',
      'third_level_officials_profiling_application',
      'tlo_personnel'
    ];

    for (const tbl of tables) {
      const res = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_testaccount = TRUE) AS true_count,
          COUNT(*) FILTER (WHERE is_testaccount = FALSE) AS false_count,
          COUNT(*) FILTER (WHERE is_testaccount IS NULL) AS null_count,
          COUNT(*) AS total_count
        FROM ${tbl}
      `);
      const row = res.rows[0];
      console.log(`Table: ${tbl} -> TRUE: ${row.true_count}, FALSE: ${row.false_count}, NULL: ${row.null_count}, TOTAL: ${row.total_count}`);
      assert(parseInt(row.null_count) === 0, `${tbl} has 0 NULL records for is_testaccount`);
    }

    // Get an actual test TLOid and prod TLOid for cross-environment testing
    const testMaster = await pool.query(`SELECT "TLOid", email FROM third_level_official_masterlist WHERE is_testaccount = TRUE LIMIT 1`);
    const prodMaster = await pool.query(`SELECT "TLOid", email FROM third_level_official_masterlist WHERE is_testaccount = FALSE LIMIT 1`);
    
    assert(testMaster.rows.length > 0, `Test masterlist official found: ${testMaster.rows[0]?.TLOid}`);
    assert(prodMaster.rows.length > 0, `Prod masterlist official found: ${prodMaster.rows[0]?.TLOid}`);

    const testTLOid = testMaster.rows[0]?.TLOid;
    const prodTLOid = prodMaster.rows[0]?.TLOid;

    // ── 2. JWT Generation & Environment Binding ─────────────────────────────
    console.log('\n--- 2. AUTHENTICATION & JWT ENVIRONMENT ISOLATION ---');
    const testUserToken = jwt.sign(
      { uid: 'TEST-ADMIN', email: 'test.admin@deped.gov.ph', role: 'Central Office', is_testaccount: true },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const prodUserToken = jwt.sign(
      { uid: 'PROD-ADMIN', email: 'prod.admin@deped.gov.ph', role: 'Central Office', is_testaccount: false },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ── 3. Officials Listing API (/officials) ────────────────────────────────
    console.log('\n--- 3. /api/third-level/officials ISOLATION ---');
    const testOfficialsRes = await apiRequest('GET', '/api/third-level/officials', testUserToken);
    assert(testOfficialsRes.status === 200, 'Test user can access /officials (status 200)');
    const testList = testOfficialsRes.data?.data || [];
    assert(testList.length === 1, `Test user receives exactly 1 test official (got ${testList.length})`);
    assert(testList.every(o => o.is_testaccount === true), 'All officials returned to test user have is_testaccount === true');

    const prodOfficialsRes = await apiRequest('GET', '/api/third-level/officials', prodUserToken);
    assert(prodOfficialsRes.status === 200, 'Prod user can access /officials (status 200)');
    const prodList = prodOfficialsRes.data?.data || [];
    assert(prodList.length > 100, `Prod user receives production officials list (got ${prodList.length})`);
    assert(prodList.every(o => o.is_testaccount === false), 'All officials returned to prod user have is_testaccount === false');

    // Bypass attempt: include_test_accounts=true with prod token
    const prodBypassRes = await apiRequest('GET', '/api/third-level/officials?include_test_accounts=true', prodUserToken);
    const bypassList = prodBypassRes.data?.data || [];
    assert(bypassList.every(o => o.is_testaccount === false), 'Prod user CANNOT bypass isolation via ?include_test_accounts=true');

    // ── 4. Cross-Environment Profile Direct Lookups (/profile) ──────────────
    console.log('\n--- 4. CROSS-ENVIRONMENT DIRECT ID LOOKUPS (/profile) ---');
    // Test user accessing prod official -> MUST return 404
    const testAccessProd = await apiRequest('GET', `/api/third-level/${prodTLOid}/profile`, testUserToken);
    assert(testAccessProd.status === 404, `Test user accessing prod official '${prodTLOid}' returns HTTP 404 (got ${testAccessProd.status})`);

    // Prod user accessing test official -> MUST return 404
    const prodAccessTest = await apiRequest('GET', `/api/third-level/${testTLOid}/profile`, prodUserToken);
    assert(prodAccessTest.status === 404, `Prod user accessing test official '${testTLOid}' returns HTTP 404 (got ${prodAccessTest.status})`);

    // In-environment lookups -> MUST succeed (200)
    const testAccessSelf = await apiRequest('GET', `/api/third-level/${testTLOid}/profile`, testUserToken);
    assert(testAccessSelf.status === 200, `Test user accessing test official '${testTLOid}' returns HTTP 200`);

    const prodAccessSelf = await apiRequest('GET', `/api/third-level/${prodTLOid}/profile`, prodUserToken);
    assert(prodAccessSelf.status === 200, `Prod user accessing prod official '${prodTLOid}' returns HTTP 200`);

    // ── 5. Cross-Environment Profile Mutations (PUT /profile) ────────────────
    console.log('\n--- 5. CROSS-ENVIRONMENT MUTATION TAMPERING (PUT /profile) ---');
    // Test user attempting to modify prod official -> MUST return 404
    const testMutateProd = await apiRequest('PUT', `/api/third-level/${prodTLOid}/profile`, testUserToken, {
      position_title: 'HACKED_TEST_TITLE'
    });
    assert(testMutateProd.status === 404, `Test user modifying prod official '${prodTLOid}' returns HTTP 404`);

    // Prod user attempting to modify test official -> MUST return 404
    const prodMutateTest = await apiRequest('PUT', `/api/third-level/${testTLOid}/profile`, prodUserToken, {
      position_title: 'HACKED_PROD_TITLE'
    });
    assert(prodMutateTest.status === 404, `Prod user modifying test official '${testTLOid}' returns HTTP 404`);

    // ── 6. KPI Summary Isolation (/officials-kpi-summary) ───────────────────
    console.log('\n--- 6. KPI SUMMARY DATA ISOLATION ---');
    const testKpiRes = await apiRequest('GET', '/api/third-level/officials-kpi-summary', testUserToken);
    assert(testKpiRes.status === 200, 'Test user gets KPI summary');
    const testKpiData = testKpiRes.data?.data || [];
    assert(testKpiData.every(o => o.is_testaccount === true), 'Test user KPI data contains ZERO prod records');

    const prodKpiRes = await apiRequest('GET', '/api/third-level/officials-kpi-summary', prodUserToken);
    assert(prodKpiRes.status === 200, 'Prod user gets KPI summary');
    const prodKpiData = prodKpiRes.data?.data || [];
    assert(prodKpiData.every(o => o.is_testaccount === false), 'Prod user KPI data contains ZERO test records');

    // ── 7. Career Path History Isolation ────────────────────────────────────
    console.log('\n--- 7. CAREER PATH HISTORY ISOLATION ---');
    const testCareerProd = await apiRequest('GET', `/api/third-level/${prodTLOid}/career-path`, testUserToken);
    assert(testCareerProd.status === 404, `Test user accessing career path of prod official '${prodTLOid}' returns HTTP 404`);

    const prodCareerTest = await apiRequest('GET', `/api/third-level/${testTLOid}/career-path`, prodUserToken);
    assert(prodCareerTest.status === 404, `Prod user accessing career path of test official '${testTLOid}' returns HTTP 404`);

    // ── 8. Positions & Dropdowns Isolation ──────────────────────────────────
    console.log('\n--- 8. POSITIONS & FILTER OPTIONS ISOLATION ---');
    const testPosRes = await apiRequest('GET', '/api/third-level/positions', testUserToken);
    assert(testPosRes.status === 200, 'Test user gets position dropdown options');

    const prodPosRes = await apiRequest('GET', '/api/third-level/positions', prodUserToken);
    assert(prodPosRes.status === 200, 'Prod user gets position dropdown options');

    // ── 9. Final Results ────────────────────────────────────────────────────
    console.log('\n================================================================');
    console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal Verification Suite Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runVerification();
