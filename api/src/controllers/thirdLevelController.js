
import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { upsertBinary } from '../utils/binaryPipeline.js';
import { uploadToAzure } from '../utils/azureBlobService.js';
// Service layer for normalized child tables (Phase 3 — dual-write)
import {
  fetchAllChildRecords,
  syncAllChildTables,
  cloneChildTablesOnApproval,
  resolveSourceTable
} from '../services/tloProfileService.js';
import { sendOfficialApprovalEmail, sendOfficialRejectionEmail } from '../services/emailService.js';

let oicSchemaReady = false;
const optionalColumnExpressionCache = new Map();

const ensureOicColumn = async (client = pool) => {
  // Schema has already been permanently migrated in the database.
  // We stub this out to prevent massive schema locks on API cold starts.
  if (client === pool) oicSchemaReady = true;
  return;
};

const sanitizeOicPosition = (positionTitle, existingIsOic = false) => {
  if (typeof positionTitle !== 'string') return { position_title: positionTitle, is_oic: !!existingIsOic };
  let cleaned = positionTitle.trim();
  let isOic = !!existingIsOic;

  const oicPrefixRegex = /^(OIC\s*-\s*|OIC\s+)/i;
  if (oicPrefixRegex.test(cleaned)) {
    isOic = true;
    cleaned = cleaned.replace(oicPrefixRegex, '').trim();
  }
  const oicSuffixRegex = /\s*\(?OIC\)?\s*$/i;
  if (oicSuffixRegex.test(cleaned)) {
    isOic = true;
    cleaned = cleaned.replace(oicSuffixRegex, '').trim();
  }

  const abbreviationMap = {
    'RD': 'Regional Director',
    'ARD': 'Assistant Regional Director',
    'SDS': 'Schools Division Superintendent',
    'ASDS': 'Assistant Schools Division Superintendent'
  };

  const upperCleaned = cleaned.toUpperCase();
  if (abbreviationMap[upperCleaned]) {
    cleaned = abbreviationMap[upperCleaned];
  } else if (abbreviationMap[cleaned]) {
    cleaned = abbreviationMap[cleaned];
  }

  return { position_title: cleaned, is_oic: isOic };
};

const getPositionTitleVariants = (title) => {
  if (!title) return [];
  const map = {
    'RD': 'Regional Director',
    'Regional Director': 'RD',
    'ARD': 'Assistant Regional Director',
    'Assistant Regional Director': 'ARD',
    'SDS': 'Schools Division Superintendent',
    'Schools Division Superintendent': 'SDS',
    'ASDS': 'Assistant Schools Division Superintendent',
    'Assistant Schools Division Superintendent': 'ASDS'
  };
  const other = map[title] || map[title.trim()];
  return other ? [title, other] : [title];
};

const POSITION_TITLE_DISPLAY = {
  RD: 'Regional Director',
  ARD: 'Assistant Regional Director',
  SDS: 'Schools Division Superintendent',
  ASDS: 'Assistant Schools Division Superintendent'
};

const THIRD_LEVEL_POSITIONS = [
  'Secretary',
  'Undersecretary',
  'Assistant Secretary',
  'Director IV',
  'Director III',
  'Regional Director',
  'Assistant Regional Director',
  'Schools Division Superintendent',
  'Assistant Schools Division Superintendent',
  'RD',
  'ARD',
  'SDS',
  'ASDS'
];
const THIRD_LEVEL_POSITIONS_UPPER = THIRD_LEVEL_POSITIONS.map(p => p.toUpperCase());

const displayPositionTitle = (positionTitle) => (
  POSITION_TITLE_DISPLAY[positionTitle] || positionTitle
);

export const cleanDesignationOrPosition = (str) => {
  if (!str || typeof str !== 'string') return '';
  let cleaned = str.trim();
  if (!cleaned || cleaned.toUpperCase() === 'N/A' || cleaned.toUpperCase() === 'NONE' || cleaned === '-') {
    return '';
  }

  // 1. Remove footnotes / superscripts / special trailing symbols (¹, ², ³, *, #, etc.)
  cleaned = cleaned.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰*#†‡]/g, '');

  // 2. Remove parenthetical status notes like (excess), (concurrent), etc.
  cleaned = cleaned.replace(/\s*\(\s*excess\s*\)/gi, '');
  cleaned = cleaned.replace(/\s*\(\s*concurrent\s*\)/gi, '');

  // 3. Normalize OIC prefixes
  cleaned = cleaned.replace(/^OIC\s*-\s*/i, 'OIC ');
  cleaned = cleaned.replace(/^OIC\s+/i, 'OIC ');

  // 4. Clean multiple whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 5. Proper Title Casing while preserving Acronyms & Roman Numerals
  const words = cleaned.split(' ');
  const romanOrAcronym = new Set([
    'OIC', 'RD', 'ARD', 'SDS', 'ASDS', 'CESO', 'DEPED', 'RO', 'SDO', 'CO',
    'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
  ]);
  const lowerWords = new Set(['of', 'the', 'in', 'and', 'for', 'to', 'a', 'an']);

  const casedWords = words.map((w, idx) => {
    const hasParen = w.startsWith('(') && w.endsWith(')');
    const inner = hasParen ? w.slice(1, -1) : w;
    const innerUpper = inner.toUpperCase();

    if (romanOrAcronym.has(innerUpper)) {
      return hasParen ? `(${innerUpper})` : innerUpper;
    }
    if (idx > 0 && lowerWords.has(inner.toLowerCase()) && !hasParen) {
      return inner.toLowerCase();
    }
    const capitalized = inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase();
    return hasParen ? `(${capitalized})` : capitalized;
  });

  return casedWords.join(' ').trim();
};

export const STANDARD_DESIGNATIONS = [
  'Secretary',
  'Undersecretary',
  'Assistant Secretary',
  'Director IV',
  'Director III',
  'Regional Director',
  'Assistant Regional Director',
  'Schools Division Superintendent',
  'Assistant Schools Division Superintendent',
  'OIC Secretary',
  'OIC Undersecretary',
  'OIC Assistant Secretary',
  'OIC Director IV',
  'OIC Director III',
  'OIC Regional Director',
  'OIC Assistant Regional Director',
  'OIC Schools Division Superintendent',
  'OIC Assistant Schools Division Superintendent'
];

const getOptionalColumnExpression = async (table, alias, columns, fallback = 'NULL::TEXT') => {
  const cacheKey = `${table}:${alias}:${columns.join(',')}`;
  if (optionalColumnExpressionCache.has(cacheKey)) {
    return optionalColumnExpressionCache.get(cacheKey);
  }

  const colsRes = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = $1
  `, [table]);
  const available = new Set(colsRes.rows.map(r => r.column_name.toLowerCase()));
  const column = columns.find(col => available.has(col));
  const expression = column ? `${alias}."${column}"::TEXT` : fallback;
  optionalColumnExpressionCache.set(cacheKey, expression);
  return expression;
};

// If compressBufferTo96Dpi is needed, it should be imported here.
// import { compressBufferTo96Dpi } from '../utils/pdfUtils.js'; // Example

export const initializeProfile = async (req, res) => {
  const { email, first_name, last_name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const normalizedEmailInit = email.toLowerCase().trim();

    let isTest = false;
    if (req.user?.is_testaccount !== undefined) {
      isTest = Boolean(req.user.is_testaccount);
    } else {
      const userCheck = await client.query('SELECT is_testaccount FROM tlo_users WHERE LOWER(email) = $1', [normalizedEmailInit]);
      if (userCheck.rows.length > 0) {
        isTest = Boolean(userCheck.rows[0].is_testaccount);
      }
    }

    const checkRes = await client.query(
      'SELECT application_id, app_TLOid FROM third_level_officials_profiling_application WHERE LOWER(email) = LOWER($1) AND is_testaccount = $2 LIMIT 1',
      [normalizedEmailInit, isTest]
    );

    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'Record already initialized', TLOid: checkRes.rows[0].app_TLOid });
    }

    const countRes = await client.query('SELECT COUNT(*) FROM third_level_officials_profiling_application');
    const count = parseInt(countRes.rows[0].count) + 1;
    const appTloId = `APP-2026-${String(count).padStart(4, '0')}`;

    let finalFirstName = first_name;
    let finalLastName = last_name;

    if (!finalFirstName || !finalLastName) {
      const masterCheck = await client.query('SELECT first_name, last_name FROM third_level_official_masterlist WHERE LOWER(email) = $1 AND is_testaccount = $2', [normalizedEmailInit, isTest]);
      if (masterCheck.rows.length > 0) {
        finalFirstName = finalFirstName || masterCheck.rows[0].first_name;
        finalLastName = finalLastName || masterCheck.rows[0].last_name;
      }
    }

    await client.query(`
      INSERT INTO third_level_officials_profiling_application (
          application_id, app_TLOid, first_name, last_name, email, application_status, is_testaccount, created_at, updated_at
      ) VALUES (DEFAULT, $1, $2, $3, $4, NULL, $5, NOW(), NOW())
    `, [appTloId, finalFirstName || '', finalLastName || '', normalizedEmailInit, isTest]);

    await client.query('COMMIT');
    res.json({ success: true, TLOid: appTloId });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Initialization failed: ' + err.message });
  } finally {
    if (client) client.release();
  }
};

export function normalizeIdentityStr(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

export function areFirstNamesMatching(nameA, nameB) {
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;

  // Handle harmless formatting difference: single-letter middle initial appended to first name
  // e.g. "MIGUEL MAC D" vs "MIGUEL MAC", "RONNIE S" vs "RONNIE", "RONELO AL K" vs "RONELO AL"
  // Note: Distinct names like "JUAN" / "JUANITO" or "JOSE" / "JOSEPH" do NOT match
  const regexTrailingInitial = /\s+[A-Z]$/;
  const baseA = nameA.replace(regexTrailingInitial, '').trim();
  const baseB = nameB.replace(regexTrailingInitial, '').trim();

  if (baseA === baseB && baseA.length > 0) {
    return true;
  }
  return false;
}

export function normalizePhone(val) {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits.length >= 7 ? digits : '';
}

export function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.split('T')[0];
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

/**
 * Deterministic Identity Resolution
 * Evaluates multiple masterlist records sharing an email to classify:
 * - STATE_1_SINGLE (exactly 1 record)
 * - STATE_2_VERIFIED_MULTI_ROLE (positive proof: matching normalized full name + same DOB, or matching secondary ID)
 * - STATE_3_CONFIRMED_COLLISION (affirmative contradictory evidence: conflicting DOB)
 * - STATE_4_UNCERTAIN (incomplete, missing, inconsistent, or insufficient evidence)
 */
export function evaluateIdentityResolution(records, baseTloid) {
  if (!Array.isArray(records) || records.length === 0) {
    return { state: 'STATE_1_SINGLE', isMultiRole: false, isCollision: false, isUncertain: false };
  }
  if (records.length === 1) {
    return { state: 'STATE_1_SINGLE', isMultiRole: false, isCollision: false, isUncertain: false };
  }

  const baseIndex = baseTloid ? records.findIndex(r => r.TLOid === baseTloid) : 0;
  const base = baseIndex >= 0 ? records[baseIndex] : records[0];

  const baseLastName = normalizeIdentityStr(base.last_name);
  const baseFirstName = normalizeIdentityStr(base.first_name);
  const baseDob = formatDateOnly(base.date_of_birth);
  const basePhone = normalizePhone(base.contact_details);

  if (!baseLastName || !baseFirstName) {
    return { state: 'STATE_4_UNCERTAIN', isMultiRole: false, isCollision: false, isUncertain: true };
  }

  let hasConfirmedCollision = false;
  let allVerifiedMultiRole = true;

  for (let i = 0; i < records.length; i++) {
    const sib = records[i];
    if (sib.TLOid === base.TLOid) continue;

    const sibLastName = normalizeIdentityStr(sib.last_name);
    const sibFirstName = normalizeIdentityStr(sib.first_name);
    const sibDob = formatDateOnly(sib.date_of_birth);
    const sibPhone = normalizePhone(sib.contact_details);

    if (!sibLastName || !sibFirstName) {
      allVerifiedMultiRole = false;
      continue;
    }

    const sameLastName = baseLastName === sibLastName;
    const sameFirstName = areFirstNamesMatching(baseFirstName, sibFirstName);
    const sameName = sameLastName && sameFirstName;

    const hasBothDobs = Boolean(baseDob && sibDob);
    const sameDob = hasBothDobs && baseDob === sibDob;
    const conflictingDob = hasBothDobs && baseDob !== sibDob;

    const samePhone = Boolean(basePhone && sibPhone && basePhone === sibPhone);

    if (conflictingDob) {
      // Conflicting DOB -> affirmative contradictory evidence -> CONFIRMED_COLLISION
      hasConfirmedCollision = true;
      allVerifiedMultiRole = false;
      break;
    } else if (sameName && sameDob) {
      // Positive proof: Same normalized full name + same DOB -> Verified
      continue;
    } else if (sameName && !hasBothDobs) {
      // Positive proof: Same normalized full name + DOB unavailable on one/both records, and no conflicting DOB -> Verified
      continue;
    } else if (!sameName && conflictingDob) {
      // Different names + conflicting DOB -> affirmative contradictory evidence -> CONFIRMED_COLLISION
      hasConfirmedCollision = true;
      allVerifiedMultiRole = false;
      break;
    } else {
      // Different names + DOB unavailable (e.g. Juan vs Juanito, or distinct people sharing email without DOB) -> UNCERTAIN
      allVerifiedMultiRole = false;
    }
  }

  if (hasConfirmedCollision) {
    return { state: 'STATE_3_CONFIRMED_COLLISION', isMultiRole: false, isCollision: true, isUncertain: false };
  }

  if (allVerifiedMultiRole) {
    return { state: 'STATE_2_VERIFIED_MULTI_ROLE', isMultiRole: true, isCollision: false, isUncertain: false };
  }

  return { state: 'STATE_4_UNCERTAIN', isMultiRole: false, isCollision: false, isUncertain: true };
}

export const getByEmail = async (req, res) => {
  const { email, tloid } = req.query;
  if (!email && !tloid) return res.status(400).json({ error: 'email or tloid query param required' });
  const isTest = Boolean(req.user?.is_testaccount);
  try {
    let masterRes;
    if (tloid) {
      masterRes = await pool.query(
        `SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1 AND status != 'Inactive' AND is_testaccount = $2`,
        [tloid, isTest]
      );
    } else if (email) {
      masterRes = await pool.query(
        `SELECT * FROM third_level_official_masterlist WHERE LOWER(email) = LOWER($1) AND status != 'Inactive' AND is_testaccount = $2 ORDER BY "TLOid" ASC`,
        [email, isTest]
      );
    }

    if (masterRes && masterRes.rows.length > 0) {
      const targetEmail = masterRes.rows[0].email;
      let allSharingRes = masterRes;
      if (tloid && targetEmail) {
        allSharingRes = await pool.query(
          `SELECT * FROM third_level_official_masterlist WHERE LOWER(email) = LOWER($1) AND status != 'Inactive' AND is_testaccount = $2 ORDER BY "TLOid" ASC`,
          [targetEmail, isTest]
        );
      }

      const resolution = evaluateIdentityResolution(allSharingRes.rows, tloid || masterRes.rows[0].TLOid);

      // In STATE_3 or STATE_4: if explicit tloid was NOT passed, enforce strict isolation and require explicit selection
      if ((resolution.state === 'STATE_3_CONFIRMED_COLLISION' || resolution.state === 'STATE_4_UNCERTAIN') && !tloid) {
        const disambiguationRecords = allSharingRes.rows.map(r => ({
          TLOid: r.TLOid,
          first_name: r.first_name,
          last_name: r.last_name,
          middle_name: r.middle_name,
          position_title: r.position_title,
          office: r.office,
          division: r.division,
          region: r.region,
          plantilla_item_no: r.plantilla_item_no,
          email: r.email
        }));
        return res.json({
          success: true,
          state: resolution.state,
          isMultiRole: false,
          isCollision: resolution.isCollision,
          isUncertain: resolution.isUncertain,
          disambiguationRecords,
          data: null
        });
      }

      const activeRecord = tloid 
        ? allSharingRes.rows.find(r => r.TLOid === tloid) || masterRes.rows[0]
        : masterRes.rows[0];

      const normalized = sanitizeOicPosition(activeRecord.position_title, activeRecord.is_oic);
      activeRecord.position_title = normalized.position_title;
      activeRecord.is_oic = normalized.is_oic;
      if (Array.isArray(activeRecord.eligibilities)) {
        activeRecord.eligibilities = activeRecord.eligibilities.map(e => {
          if (typeof e === 'string') return { eligibility: e.toUpperCase(), date: null, rating: null, place_of_assignment: null };
          return e;
        });
      }

      let childRecords = {};
      try {
        if (activeRecord.TLOid) {
          childRecords = await fetchAllChildRecords(pool, 'masterlist', activeRecord.TLOid);
        }
      } catch (childErr) {
        console.warn('[getByEmail] Child records fetch skipped for masterlist:', childErr.message);
      }

      let availableRoles = [];
      if (resolution.state === 'STATE_2_VERIFIED_MULTI_ROLE') {
        availableRoles = allSharingRes.rows.map(r => ({
          TLOid: r.TLOid,
          position_title: r.position_title,
          office: r.office,
          division: r.division,
          region: r.region,
          designation: r.designation,
          plantilla_item_no: r.plantilla_item_no,
          appointment_status: r.appointment_status,
          is_oic: r.is_oic
        }));
      }

      return res.json({
        success: true,
        state: resolution.state,
        isMultiRole: resolution.isMultiRole,
        isCollision: resolution.isCollision,
        isUncertain: resolution.isUncertain,
        activeTloId: activeRecord.TLOid,
        availableRoles,
        data: { ...activeRecord, ...childRecords },
        source: 'masterlist'
      });
    }

    // Staging table check for new applicants
    if (email) {
      const stagingRes = await pool.query(`
        SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application
        WHERE LOWER(email) = LOWER($1) AND application_status IS DISTINCT FROM 'approved' AND is_testaccount = $2
        ORDER BY created_at DESC LIMIT 1
      `, [email, isTest]);

      if (stagingRes.rows.length > 0) {
        const row = stagingRes.rows[0];
        const normalized = sanitizeOicPosition(row.position_title, row.is_oic);
        row.position_title = normalized.position_title;
        row.is_oic = normalized.is_oic;
        if (Array.isArray(row.eligibilities)) {
          row.eligibilities = row.eligibilities.map(e => {
            if (typeof e === 'string') return { eligibility: e.toUpperCase(), date: null, rating: null, place_of_assignment: null };
            return e;
          });
        }

        let childRecords = {};
        try {
          const tloId = row.TLOid || row.app_TLOid;
          if (tloId) {
            childRecords = await fetchAllChildRecords(pool, 'staging', tloId);
          }
        } catch (childErr) {
          console.warn('[getByEmail] Child records fetch skipped for staging:', childErr.message);
        }

        return res.json({
          success: true,
          state: 'STATE_1_SINGLE',
          isMultiRole: false,
          isCollision: false,
          isUncertain: false,
          activeTloId: row.TLOid,
          availableRoles: [],
          data: { ...row, ...childRecords },
          source: 'staging'
        });
      }
    }

    return res.json({ success: false, data: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const uploadDocument = async (req, res) => {
  const { TLOid, docType } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  console.log(`[Upload] Start ${docType} for ${TLOid}`);
  const isMasterlist = !TLOid.startsWith('APP-') && !(TLOid.startsWith('TLO-') && TLOid.split('-').length > 2);
  const client = await pool.connect();
  console.log(`[Upload] DB connected`);
  try {
    await client.query('BEGIN');
    let processedBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    console.log(`[Upload] File received: size=${processedBuffer.length}, type=${mimeType}`);

    console.log(`[Upload] Calling upsertBinary...`);
    const { binary_id } = await upsertBinary(client, processedBuffer, mimeType, processedBuffer.length);
    console.log(`[Upload] upsertBinary finished with ID: ${binary_id}`);

    const docMap = {
      'photo': 'photo_binary_id',
      'pds': 'pds_binary_id',
      'profile_word': 'profile_word_binary_id',
      'profile_ppt': 'profile_ppt_binary_id',
      'service_records': 'service_records_binary_id',
      'sandiganbayan_clearance': 'sandiganbayan_clearance_binary_id',
      'nbi_clearance': 'nbi_clearance_binary_id',
      'csc_clearance': 'csc_clearance_binary_id',
      'ombudsman_clearance': 'ombudsman_clearance_binary_id',
      'executive_summary': 'executive_summary_binary_id',
      'reassignment_order': 'reassignment_order_binary_id'
    };

    const columnName = docMap[docType];
    if (!columnName) throw new Error('Invalid document type');

    const isTest = Boolean(req.user?.is_testaccount);
    let upRes;
    if (isMasterlist) {
      upRes = await client.query(
        `UPDATE third_level_official_masterlist SET ${columnName} = $1, updated_at = NOW() WHERE "TLOid" = $2 AND is_testaccount = $3`,
        [binary_id, TLOid, isTest]
      );
    } else {
      upRes = await client.query(
        `UPDATE third_level_officials_profiling_application SET ${columnName} = $1, updated_at = NOW() WHERE app_TLOid = $2 AND is_testaccount = $3`,
        [binary_id, TLOid, isTest]
      );
    }

    if (upRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profile not found or access denied' });
    }

    await client.query('COMMIT');

    // 1. Save file to local folder path on disk
    let localFolderPath = null;
    try {
      const pad = (n) => n.toString().padStart(2, '0');
      const now = new Date();
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const ext = path.extname(req.file.originalname) || (mimeType === 'application/pdf' ? '.pdf' : '');
      const filename = `${docType}_${TLOid}_${timestamp}${ext}`;

      const folderRelative = path.join('uploads', TLOid, docType);
      const folderAbsolute = path.join(process.cwd(), folderRelative);
      if (!fs.existsSync(folderAbsolute)) {
        fs.mkdirSync(folderAbsolute, { recursive: true });
      }
      const fileAbsolute = path.join(folderAbsolute, filename);
      fs.writeFileSync(fileAbsolute, req.file.buffer);
      localFolderPath = `/uploads/${TLOid}/${docType}/${filename}`;
      console.log(`[Upload] File saved to folder path: ${localFolderPath}`);
    } catch (fsErr) {
      console.warn(`[Upload] Local folder path write skipped/failed: ${fsErr.message}`);
    }

    // 2. Azure Blob Storage Upload
    let azureData = null;
    let finalBlobUrlOrPath = localFolderPath;
    try {
      console.log(`[Upload] Calling uploadToAzure...`);
      azureData = await uploadToAzure(
        req.file.buffer,
        req.file.originalname,
        mimeType,
        TLOid,
        docType
      );
      if (azureData && (azureData.blobUrl || azureData.url)) {
        finalBlobUrlOrPath = azureData.blobUrl || azureData.url;
      }
      console.log(`[Upload] Azure upload successful: ${azureData.filename}`);
    } catch (azureErr) {
      console.error(`[Upload] Azure upload skipped/failed: ${azureErr.message}`);
    }

    // 3. Update database record in unified_binaries with folder path or Azure Blob URL
    if (finalBlobUrlOrPath) {
      await pool.query('UPDATE unified_binaries SET azure_blob_url = $1 WHERE id = $2', [finalBlobUrlOrPath, binary_id]);
    }

    res.json({
      success: true,
      binary_id,
      filePath: localFolderPath,
      blobUrl: azureData?.blobUrl || null,
      message: `${docType} uploaded successfully`,
      ...(azureData || {})
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getProfile = async (req, res) => {
  const { TLOid } = req.params;
  const isTest = Boolean(req.user?.is_testaccount);
  const isMasterlist = !TLOid.startsWith('APP-') && !(TLOid.startsWith('TLO-') && TLOid.split('-').length > 2);
  try {
    await ensureOicColumn();
    let result;
    if (isMasterlist) {
      result = await pool.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2', [TLOid, isTest]);
    } else {
      result = await pool.query('SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application WHERE app_TLOid = $1 AND is_testaccount = $2', [TLOid, isTest]);
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const row = result.rows[0];
    const normalized = sanitizeOicPosition(row.position_title, row.is_oic);
    row.position_title = normalized.position_title;
    row.is_oic = normalized.is_oic;

    // Phase 3: Fetch normalized child table records (additive — existing fields untouched)
    // Frontend fallback chain: relational → JSONB → legacy text
    let childRecords = {};
    try {
      const sourceTable = resolveSourceTable(TLOid);
      childRecords = await fetchAllChildRecords(pool, sourceTable, TLOid);
    } catch (childErr) {
      // Graceful degradation: if relational tables not yet available, return empty arrays
      console.warn('[getProfile] Child records fetch skipped:', childErr.message);
      childRecords = {
        education_records: [],
        eligibility_records: [],
        position_history: [],
        training_records: [],
        accomplishment_records: [],
        other_course_records: []
      };
    }

    res.json({ success: true, data: { ...row, ...childRecords } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  const { TLOid } = req.params;
  const isMasterlist = !TLOid.startsWith('APP-') && !(TLOid.startsWith('TLO-') && TLOid.split('-').length > 2);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureOicColumn(client);

    if (req.body.position_title) {
      const normalizedPosition = sanitizeOicPosition(req.body.position_title, req.body.is_oic);
      req.body.position_title = normalizedPosition.position_title;
      req.body.is_oic = normalizedPosition.is_oic;
    }

    const validateYear = (yr, max) => {
      if (!yr) return;
      const num = parseInt(yr, 10);
      if (isNaN(num) || num > max) throw new Error(`Year ${yr} cannot be greater than ${max}`);
    };
    const currentYear = new Date().getFullYear();

    validateYear(req.body.performance_rating_1_period, currentYear);
    validateYear(req.body.performance_rating_2_period, currentYear);
    validateYear(req.body.performance_rating_3_period, currentYear);
    validateYear(req.body.cespes_rating_1_period, currentYear);
    validateYear(req.body.cespes_rating_2_period, currentYear);
    if (Array.isArray(req.body.notable_achievements)) {
      req.body.notable_achievements.forEach(ach => {
        if (ach && ach.year) validateYear(ach.year, currentYear);
      });
    }
    validateYear(req.body.bachelor_year, currentYear);
    validateYear(req.body.master_year, currentYear);
    validateYear(req.body.doctorate_year, currentYear);

    if (req.body.bachelor_year && req.body.master_year && parseInt(req.body.master_year) <= parseInt(req.body.bachelor_year)) {
      throw new Error("Master's year must be greater than Bachelor's year");
    }
    if (req.body.master_year && req.body.doctorate_year && parseInt(req.body.doctorate_year) <= parseInt(req.body.master_year)) {
      throw new Error("Doctorate year must be greater than Master's year");
    }

    const currentMonth = new Date().toISOString().substring(0, 7);

    if (req.body.performance_rating_1_period && req.body.performance_rating_1_period > currentMonth) throw new Error("Latest Performance Rating period cannot be in the future");
    if (req.body.performance_rating_2_period && req.body.performance_rating_2_period > currentMonth) throw new Error("Previous Performance Rating period cannot be in the future");
    if (req.body.performance_rating_3_period && req.body.performance_rating_3_period > currentMonth) throw new Error("Oldest Performance Rating period cannot be in the future");
    if (req.body.cespes_rating_1_period && req.body.cespes_rating_1_period > currentMonth) throw new Error("CESPES 1st Semester period cannot be in the future");
    if (req.body.cespes_rating_2_period && req.body.cespes_rating_2_period > currentMonth) throw new Error("CESPES 2nd Semester period cannot be in the future");

    if (req.body.performance_rating_3_period && req.body.performance_rating_2_period && req.body.performance_rating_2_period < req.body.performance_rating_3_period) {
      throw new Error("Previous rating period must be >= Oldest rating period");
    }
    if (req.body.performance_rating_2_period && req.body.performance_rating_1_period && req.body.performance_rating_1_period < req.body.performance_rating_2_period) {
      throw new Error("Latest rating period must be >= Previous rating period");
    }
    if (req.body.cespes_rating_1_period && req.body.cespes_rating_2_period && req.body.cespes_rating_2_period < req.body.cespes_rating_1_period) {
      throw new Error("CESPES 2nd sem period must be >= 1st sem period");
    }

    const bacY = (req.body.bachelor_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));
    const masY = (req.body.master_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));
    const docY = (req.body.doctorate_year || '').split('\n').map(y => parseInt(y)).filter(y => !isNaN(y));

    const maxBac = bacY.length > 0 ? Math.max(...bacY) : 0;
    const maxMas = masY.length > 0 ? Math.max(...masY) : 0;

    if (maxBac > 0 && masY.some(m => m <= maxBac)) {
      throw new Error("Master's Degree year must be strictly greater than Bachelor's Degree year.");
    }
    if (maxMas > 0 && docY.some(d => d <= maxMas)) {
      throw new Error("Doctorate year must be strictly greater than Master's Degree year.");
    }

    if (req.body.previous_positions && Array.isArray(req.body.previous_positions)) {
      req.body.previous_positions.forEach(p => {
        if (p.start_date && p.end_date && new Date(p.end_date) <= new Date(p.start_date)) {
          throw new Error("End date must be after start date for previous positions");
        }
      });
    }
    if (req.body.relevant_trainings && Array.isArray(req.body.relevant_trainings)) {
      req.body.relevant_trainings = req.body.relevant_trainings.map(t => {
        if (t.training_name) t.training_name = t.training_name.toUpperCase();
        if (t.date_from && t.date_to && new Date(t.date_to) <= new Date(t.date_from)) {
          throw new Error("End date must be after start date for trainings");
        }
        return t;
      });
    }

    // Validate date ranges
    const validateDateRange = (from, to, context) => {
      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (toDate < fromDate) {
          throw new Error(`Invalid date range in ${context}: TO date cannot be before FROM date.`);
        }
      }
    };

    if (Array.isArray(req.body.previous_positions)) {
      req.body.previous_positions.forEach((p, idx) => {
        validateDateRange(p.start_date, p.end_date, `Previous Position ${idx + 1}`);
        if (Array.isArray(p.oic_positions)) {
          p.oic_positions.forEach((oic, oicIdx) => {
            validateDateRange(oic.oic_start_date, oic.oic_end_date, `Previous Position ${idx + 1} (OIC ${oicIdx + 1})`);
          });
        }
      });
    }

    if (Array.isArray(req.body.relevant_trainings)) {
      req.body.relevant_trainings.forEach((t, idx) => {
        validateDateRange(t.date_from, t.date_to, `Training ${idx + 1}`);
      });
    }

    if (Array.isArray(req.body.other_courses)) {
      req.body.other_courses.forEach((c, idx) => {
        validateDateRange(c.date_from, c.date_to, `Other Course ${idx + 1}`);
      });
    }

    const allFields = [
      'strand', 'region', 'division', 'office', 'email', 'alt_email_1', 'alt_email_2', 'contact_details', 'alt_contact_details_1', 'alt_contact_details_2',
      'last_name', 'first_name', 'middle_name', 'suffix', 'gender', 'date_of_birth', 'civil_status',
      'position_title', 'designation', 'appointment_date', 'emt_passer', 'emt_date', 'ces_stage', 'ces_conferment_date', 'age',
      'total_years_third_level', 'managerial_experience_total', 'permanent_address', 'temporary_address',
      'notable_achievements', 'total_training_hours',
      'performance_rating_1', 'performance_rating_1_period', 'performance_rating_2', 'performance_rating_2_period', 'performance_rating_3', 'performance_rating_3_period',
      'cespes_1_rating', 'cespes_2_rating', 'cespes_rating_1_period', 'cespes_rating_2_period',
      'performance_rating_ipcrf', 'performance_rating_cespes',
      'is_oic', 'unique_number', 'employment_status',
      'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
      'sandiganbayan_clearance_binary_id', 'nbi_clearance_binary_id', 'csc_clearance_binary_id', 'ombudsman_clearance_binary_id', 'executive_summary_binary_id',
      'pending_admin_case', 'guilty_admin_details', 'criminally_charged_details', 'convicted_crime_details', 'dpa_consented_at', 'profiling_status', 'target_TLOid', 'application_status', 'position_applied_for'
    ];

    const JSONB_FIELDS = new Set(['notable_achievements']);
    const updates = [];
    const values = [];

    const table = isMasterlist ? 'third_level_official_masterlist' : 'third_level_officials_profiling_application';
    const idCol = isMasterlist ? '"TLOid"' : 'app_TLOid';

    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    const validCols = new Set(colsRes.rows.map(r => r.column_name.toLowerCase()));

    const DO_NOT_UPPERCASE = new Set([
      'email', 'alt_email_1', 'alt_email_2', 'contact_details', 'alt_contact_details_1', 'alt_contact_details_2',
      'password', 'password_hash', 'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
      'sandiganbayan_clearance_binary_id', 'nbi_clearance_binary_id', 'csc_clearance_binary_id', 'ombudsman_clearance_binary_id', 'executive_summary_binary_id',
      'target_tloid', 'application_status', 'profiling_status', 'designation', 'suffix'
    ]);

    const toUpper = (val) => {
      if (typeof val === 'string') return val.toUpperCase();
      return val;
    };

    allFields.forEach(f => {
      if (req.body[f] !== undefined && validCols.has(f.toLowerCase())) {
        let val = req.body[f] === '' ? null : req.body[f];

        if (f === 'suffix') {
          if (val === null || val === undefined || val === '') {
            val = null;
          } else if (typeof val === 'string') {
            const s = val.trim().toLowerCase();
            if (['not applicable', 'not apllicable', 'na', 'n/a', 'none'].includes(s) || s === '') {
              val = null;
            } else {
              val = val.trim();
            }
          }
        }

        if (f === 'designation' && typeof val === 'string') {
          val = cleanDesignationOrPosition(val);
        }

        if (f === 'eligibilities' && Array.isArray(val)) {
          val = val.map(e => {
            if (typeof e === 'string') return { eligibility: e.toUpperCase(), date: null, rating: null, place_of_assignment: null };
            return {
              ...e,
              eligibility: e.eligibility ? e.eligibility.toUpperCase() : e.title ? e.title.toUpperCase() : null,
              place_of_assignment: e.place_of_assignment ? e.place_of_assignment.toUpperCase() : null
            };
          });
        }
        if (f === 'relevant_trainings' && Array.isArray(val)) {
          val = val.map(t => ({
            ...t,
            training_name: t.training_name ? t.training_name.toUpperCase() : null
          }));
        }
        if (f === 'previous_positions' && Array.isArray(val)) {
          val = val.map(p => ({
            ...p,
            position_name: p.position_name ? p.position_name.toUpperCase() : null
          }));
        }

        if (f === 'education_degrees' && Array.isArray(val)) {
          val = val.map(ed => ({
            ...ed,
            highest_education: ed.highest_education ? ed.highest_education.toUpperCase() : null,
            specific_degree: ed.specific_degree ? ed.specific_degree.toUpperCase() : null,
            education_program: ed.education_program ? ed.education_program.toUpperCase() : null,
            education_year_graduated: ed.education_year_graduated ? ed.education_year_graduated.toUpperCase() : null
          }));
        }

        if (JSONB_FIELDS.has(f) && val !== null && typeof val !== 'string') {
          val = JSON.stringify(val);
        } else if (val !== null && typeof val === 'string' && !DO_NOT_UPPERCASE.has(f.toLowerCase())) {
          val = toUpper(val);
        }
        values.push(val);
        updates.push(`"${f}" = $${values.length}`);
      }
    });

    if (req.body.target_TLOid && !isMasterlist && validCols.has('application_status')) {
      updates.push(`application_status = 'applied'`);
      updates.push(`submitted_at = NOW()`);
    }

    if (updates.length > 0) {
      const isTest = Boolean(req.user?.is_testaccount);
      values.push(new Date(), TLOid, isTest);

      if (isMasterlist && req.user?.email) {
        await client.query(`SET LOCAL "app.current_user" = '${req.user.email.replace(/'/g, "''")}'`);
      }

      console.log('[updateProfile] Running UPDATE query:', {
        table,
        updates,
        education_degrees: req.body.education_degrees,
        valuesCount: values.length
      });

      const updateRes = await client.query(
        `UPDATE ${table} SET ${updates.join(', ')}, updated_at = $${values.length - 2} WHERE ${idCol} = $${values.length - 1} AND is_testaccount = $${values.length}`,
        values
      );

      if (updateRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Profile not found or access denied' });
      }
    }

    // Phase 3: Dual-write to normalized child tables (inside existing transaction)
    // Existing JSONB columns are still written above. This adds relational sync.
    const sourceTable = resolveSourceTable(TLOid);
    const updatedBy = req.user?.email || null;
    await syncAllChildTables(client, sourceTable, TLOid, req.body, updatedBy);

    // ── Phase 4: Assignment & Position History Tracking ──────────────────────
    // When saving profile in Official Profiling, track changes to:
    // Region, Division, Position Title, Designation
    // If changed:
    // 1. Archive previous position into tlo_position_history (status = 'Inactive')
    // 2. Mark previous assignment in tlo_assignments as Inactive (end_date = today)
    // 3. Insert new active assignment in tlo_assignments with updated values (status = 'Active')
    if (isMasterlist) {
      const sp_assign = 'sp_assignment_tracking';
      try {
        await client.query(`SAVEPOINT ${sp_assign}`);

        const norm = (v) => (v === null || v === undefined || v === '') ? '' : String(v).trim().toUpperCase();
        const incomingPosTitle = norm(req.body.position_title);
        const incomingDesig    = norm(req.body.designation);
        const incomingRegion   = norm(req.body.region);
        const incomingDivision = norm(req.body.division);
        const incomingOffice   = req.body.office ? req.body.office.trim() : null;
        const incomingStrand   = req.body.strand ? req.body.strand.trim() : null;
        const incomingIsOic    = Boolean(req.body.is_oic || (req.body.designation && req.body.designation.toUpperCase().includes('OIC')));

        if (incomingPosTitle || incomingDesig || incomingRegion || incomingDivision) {
          // Resolve numeric tlo_masterlist_id for this TLOid
          const mLookupRes = await client.query(
            'SELECT id FROM tlo_masterlist WHERE LOWER(tloid) = LOWER($1) LIMIT 1',
            [TLOid]
          );
          const numericMasterlistId = mLookupRes.rows.length > 0 ? mLookupRes.rows[0].id : null;

          // Identify the single authoritative current active assignment for this item_number
          const curAssignRes = await client.query(
            `SELECT a.id, a.tlo_masterlist_id, a.tlo_position_id,
                    a.status, a.capacity, a.start_date, a.end_date,
                    m.position_title, m.designation, m.region, m.division, m.office, m.strand
             FROM tlo_assignments a
             LEFT JOIN tlo_masterlist tm ON tm.id = a.tlo_masterlist_id
             LEFT JOIN third_level_official_masterlist m ON (m."TLOid" = a.tlo_position_id OR m."TLOid" = tm.tloid)
             WHERE (a.tlo_position_id = $1 OR tm.tloid = $1 OR (a.tlo_masterlist_id = $2 AND $2::int IS NOT NULL))
               AND a.status = 'Active'
               AND a.end_date IS NULL
             ORDER BY CASE WHEN a.capacity = 'Concurrent' THEN 2 ELSE 1 END, a.id DESC
             LIMIT 1`,
            [TLOid, numericMasterlistId]
          );

          if (curAssignRes.rows.length === 0) {
            // No active assignment exists in ledger — insert initial active row
            await client.query(
              `INSERT INTO tlo_assignments (
                 tlo_masterlist_id, tlo_position_id, status, capacity,
                 start_date, end_date, created_at, updated_at
               ) VALUES (
                 $1, $2, 'Active', $3,
                 CURRENT_DATE, NULL, NOW(), NOW()
               )`,
              [
                numericMasterlistId,
                TLOid,
                incomingIsOic ? 'OIC' : 'Full'
              ]
            );
          } else {
            const cur = curAssignRes.rows[0];

            // Change detection: did any of the 4 primary assignment fields change?
            const hasAssignmentChanged = (
              (incomingPosTitle && incomingPosTitle !== norm(cur.position_title)) ||
              (incomingDesig && incomingDesig !== norm(cur.designation)) ||
              (incomingRegion && incomingRegion !== norm(cur.region)) ||
              (incomingDivision && incomingDivision !== norm(cur.division))
            );

            if (hasAssignmentChanged) {
              const nowStr = new Date().toISOString().split('T')[0];
              const oldStartDate = cur.start_date ? new Date(cur.start_date).toISOString().split('T')[0] : null;
              const oldEndDate = nowStr;
              const newStartDate = nowStr;

              // Step 1: Archive previous position into tlo_position_history
              const prevPositionTitle = cur.position_title || req.body.position_title || '';
              const prevDesignation = cur.designation || null;
              const prevRegion = cur.region || null;
              const prevDivision = cur.division || null;
              const prevOffice = cur.office || null;
              const prevStrand = cur.strand || null;
              const prevOic = Boolean(cur.capacity === 'OIC' || (cur.designation && cur.designation.toUpperCase().includes('OIC')));

              await client.query(
                `INSERT INTO tlo_position_history (
                   source_table, tlo_id, position_name, designation,
                   region, division, office, strand,
                   inclusive_date_start, inclusive_date_end,
                   status, oic, delete_flg, created_at, updated_at, created_by, updated_by
                 ) VALUES (
                   'masterlist', $1, $2, $3,
                   $4, $5, $6, $7,
                   $8, $9,
                   'Inactive', $10, 'No', NOW(), NOW(), $11, $11
                 )`,
                [
                  TLOid,
                  prevPositionTitle,
                  prevDesignation,
                  prevRegion,
                  prevDivision,
                  prevOffice,
                  prevStrand,
                  oldStartDate,
                  oldEndDate,
                  prevOic,
                  updatedBy
                ]
              );

              // Step 2: Transition previous assignment in tlo_assignments to Inactive
              await client.query(
                `UPDATE tlo_assignments
                 SET status = 'Inactive', end_date = $1, updated_at = NOW()
                 WHERE id = $2`,
                [oldEndDate, cur.id]
              );

              // Step 3: Insert new current assignment in tlo_assignments with updated values
              const newCapacity = incomingIsOic ? 'OIC' : (cur.capacity === 'Concurrent' ? 'Concurrent' : 'Full');

              await client.query(
                `INSERT INTO tlo_assignments (
                   tlo_masterlist_id, tlo_position_id, status, capacity,
                   start_date, end_date, created_at, updated_at
                 ) VALUES (
                   $1, $2, 'Active', $3,
                   $4, NULL, NOW(), NOW()
                 )`,
                [
                  cur.tlo_masterlist_id || numericMasterlistId,
                  cur.tlo_position_id || TLOid,
                  newCapacity,
                  newStartDate
                ]
              );
            }
          }
        }
        await client.query(`RELEASE SAVEPOINT ${sp_assign}`);
      } catch (assignErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp_assign}`).catch(() => {});
        console.warn(`[updateProfile] Assignment tracking skipped: ${assignErr.message}`);
      }
    }

    // ── Phase 5: Personal Data Sync to Verified Sibling Roles ──
    // Rule: Cross-role personal data sync applies to verified sibling roles (STATE_2_VERIFIED_MULTI_ROLE).
    // Sibling TLO records update personal data by default when identity is verified,
    // while respecting explicit user opt-out (applyToVerifiedRoles === false).
    // Role-specific fields NEVER propagate under any condition. Child records are never cloned.
    const isExplicitlyOptedOut = req.body.applyToVerifiedRoles === false || req.body.applyToVerifiedRoles === 'false';
    const shouldSyncVerifiedSiblings = isMasterlist && !isExplicitlyOptedOut;
    if (shouldSyncVerifiedSiblings) {
      try {
        const curOfficialRes = await client.query(
          `SELECT email, first_name, last_name, date_of_birth, contact_details 
           FROM third_level_official_masterlist 
           WHERE "TLOid" = $1`,
          [TLOid]
        );
        const curOfficial = curOfficialRes.rows[0];
        if (curOfficial && curOfficial.email) {
          const sibRes = await client.query(
            `SELECT * FROM third_level_official_masterlist 
             WHERE LOWER(email) = LOWER($1) AND status != 'Inactive' 
             ORDER BY "TLOid" ASC`,
            [curOfficial.email]
          );

          if (sibRes.rows.length > 1) {
            const resolution = evaluateIdentityResolution(sibRes.rows, TLOid);
            if (resolution.state === 'STATE_2_VERIFIED_MULTI_ROLE') {
              // Role-specific fields that MUST NEVER propagate:
              const ROLE_SPECIFIC_FIELDS = new Set([
                'region', 'division', 'office', 'strand', 'position_title', 'designation',
                'is_oic', 'plantilla_item_no', 'appointment_status', 'appointment_date',
                'effectivity_date', 'employment_status', 'assignment', 'status', 'tloid', 'sort_index'
              ]);

              const personalUpdates = [];
              const personalValues = [];

              allFields.forEach(f => {
                if (!ROLE_SPECIFIC_FIELDS.has(f.toLowerCase()) && req.body[f] !== undefined && validCols.has(f.toLowerCase())) {
                  let val = req.body[f] === '' ? null : req.body[f];
                  if (JSONB_FIELDS.has(f) && val !== null && typeof val !== 'string') {
                    val = JSON.stringify(val);
                  } else if (val !== null && typeof val === 'string' && !DO_NOT_UPPERCASE.has(f.toLowerCase())) {
                    val = toUpper(val);
                  }
                  personalValues.push(val);
                  personalUpdates.push(`"${f}" = $${personalValues.length}`);
                }
              });

              if (personalUpdates.length > 0) {
                const verifiedSiblings = sibRes.rows.filter(r => r.TLOid !== TLOid);
                for (const sib of verifiedSiblings) {
                  const sibValues = [...personalValues, new Date(), sib.TLOid];
                  await client.query(
                    `UPDATE third_level_official_masterlist 
                     SET ${personalUpdates.join(', ')}, updated_at = $${sibValues.length - 1} 
                     WHERE "TLOid" = $${sibValues.length}`,
                    sibValues
                  );
                }
                console.log(`[updateProfile] Propagated personal fields to ${verifiedSiblings.length} verified sibling roles for ${TLOid}`);
              }
            } else {
              console.warn(`[updateProfile] Opt-in sync skipped: records for ${curOfficial.email} are ${resolution.state}`);
            }
          }
        }
      } catch (syncErr) {
        console.warn(`[updateProfile] Sibling personal data sync skipped: ${syncErr.message}`);
      }
    }

    await client.query('COMMIT');

    let childRecords = {};
    try {
      const sourceTable = resolveSourceTable(TLOid);
      childRecords = await fetchAllChildRecords(pool, sourceTable, TLOid);
    } catch (childErr) {
      console.warn('[updateProfile] Child records fetch skipped on response:', childErr.message);
    }

    res.json({ success: true, data: { ...childRecords } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const submitApplication = async (req, res) => {
  const { target_TLOid } = req.body;
  const userEmail = req.user.email;

  if (!userEmail) return res.status(401).json({ error: 'Authentication error' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isTest = Boolean(req.user?.is_testaccount);
    const result = await client.query(`
      UPDATE third_level_officials_profiling_application
      SET application_status = 'applied', "target_TLOid" = $1, submitted_at = NOW(), updated_at = NOW()
      WHERE LOWER(email) = LOWER($2) AND application_status IS DISTINCT FROM 'approved' AND is_testaccount = $3
    `, [target_TLOid || null, userEmail, isTest]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No active profiling record found. Please initialize your profile first.' });
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

export const getPositions = async (req, res) => {
  const isTest = Boolean(req.user?.is_testaccount);
  try {
    const posResult = await pool.query(`
      SELECT DISTINCT position_title 
      FROM third_level_official_masterlist 
      WHERE position_title IS NOT NULL 
        AND position_title != '' 
        AND position_title NOT ILIKE 'N/A'
        AND is_testaccount = $1
      ORDER BY position_title
    `, [isTest]);
    const desigResult = await pool.query(`
      SELECT DISTINCT designation 
      FROM third_level_official_masterlist 
      WHERE designation IS NOT NULL 
        AND designation != '' 
        AND designation NOT ILIKE 'N/A'
        AND is_testaccount = $1
      ORDER BY designation
    `, [isTest]);
    const strandResult = await pool.query(`
      SELECT DISTINCT strand FROM third_level_official_masterlist WHERE strand IS NOT NULL AND strand != '' AND is_testaccount = $1 ORDER BY strand
    `, [isTest]);
    const regionResult = await pool.query(`
      SELECT DISTINCT region FROM third_level_official_masterlist WHERE region IS NOT NULL AND region != '' AND is_testaccount = $1 ORDER BY region
    `, [isTest]);
    const officeResult = await pool.query(`
      SELECT DISTINCT office FROM third_level_official_masterlist WHERE office IS NOT NULL AND office != '' AND is_testaccount = $1 ORDER BY office
    `, [isTest]);
    const divisionResult = await pool.query(`
      SELECT DISTINCT division FROM third_level_official_masterlist WHERE division IS NOT NULL AND division != '' AND is_testaccount = $1 ORDER BY division
    `, [isTest]);
    const regionDivisionResult = await pool.query(`
      SELECT DISTINCT region, division 
      FROM third_level_official_masterlist 
      WHERE division IS NOT NULL AND division != '' 
        AND region IS NOT NULL AND region != ''
        AND is_testaccount = $1
    `, [isTest]);

    const deduplicate = (list) => {
      const map = new Map();
      list.forEach(item => {
        if (!item) return;
        const trimmed = String(item).trim();
        const up = trimmed.toUpperCase();
        const existing = map.get(up);
        if (!existing) {
          map.set(up, trimmed);
        } else if (existing === up && trimmed !== up) {
          map.set(up, trimmed);
        }
      });
      return Array.from(map.values()).sort();
    };

    const deduplicateClean = (list) => {
      const map = new Map();
      list.forEach(item => {
        if (!item) return;
        const cleaned = cleanDesignationOrPosition(displayPositionTitle(item));
        if (cleaned) {
          const up = cleaned.toUpperCase();
          if (!map.has(up)) {
            map.set(up, cleaned);
          }
        }
      });
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    };

    const finalRegions = deduplicate(regionResult.rows.map(r => r.region));

    // Exclude region names and non-division office labels from divisions (except Central Office)
    const regionUpperSet = new Set(finalRegions.filter(r => r.toUpperCase() !== 'CENTRAL OFFICE').map(r => r.toUpperCase()));
    ['REGIONAL OFFICE', 'REGIONAL OFFICES', 'N/A', 'NONE', 'NOT APPLICABLE'].forEach(term => regionUpperSet.add(term));

    const isRegionOrOffice = (str) => {
      if (!str) return true;
      const up = String(str).trim().toUpperCase();
      if (up === 'CENTRAL OFFICE') return false;
      return regionUpperSet.has(up) || /^REGION\s+[0-9IVXLCDM\-\sA-Z]+$/i.test(up);
    };

    const finalDivisions = deduplicate([
      'Central Office',
      ...divisionResult.rows
        .map(r => r.division)
        .filter(d => !isRegionOrOffice(d))
    ]);

    const regionDivisionsMap = {};
    regionDivisionResult.rows.forEach(r => {
      const regionStr = String(r.region || '').trim();
      const divStr = String(r.division || '').trim();
      if (!divStr || isRegionOrOffice(divStr)) return;

      const upReg = regionStr.toUpperCase();
      const upDiv = divStr.toUpperCase();

      const bestReg = finalRegions.find(reg => reg.toUpperCase() === upReg) || regionStr;
      const bestDiv = finalDivisions.find(div => div.toUpperCase() === upDiv) || divStr;

      if (!regionDivisionsMap[bestReg]) {
        regionDivisionsMap[bestReg] = new Set();
      }
      regionDivisionsMap[bestReg].add(bestDiv);
    });

    if (!regionDivisionsMap['Central Office'] || regionDivisionsMap['Central Office'].size === 0) {
      regionDivisionsMap['Central Office'] = new Set(['Central Office']);
    } else {
      regionDivisionsMap['Central Office'].add('Central Office');
    }

    Object.keys(regionDivisionsMap).forEach(k => {
      regionDivisionsMap[k] = Array.from(regionDivisionsMap[k]).sort();
    });

    const rawPositions = [...THIRD_LEVEL_POSITIONS, ...posResult.rows.map(r => r.position_title)];
    const rawDesignations = [...STANDARD_DESIGNATIONS, ...desigResult.rows.map(r => r.designation)];

    res.json({
      success: true,
      positions: deduplicateClean(rawPositions),
      designations: deduplicateClean(rawDesignations),
      strands: deduplicate(strandResult.rows.map(r => r.strand)),
      regions: finalRegions,
      offices: deduplicate(officeResult.rows.map(r => r.office)),
      divisions: finalDivisions,
      regionDivisions: regionDivisionsMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVacancies = async (req, res) => {
  try {
    const { region, division, office, strand, search } = req.query;
    const params = [];

    // Official architecture: query vacant positions from tlo_assignments
    let query = `
      SELECT 
        a.id AS assignment_id,
        a.id,
        COALESCE(a.tlo_position_id, '') AS "TLOid",
        COALESCE(a.tlo_position_id, '') AS item_number,
        COALESCE(pos.position_title, i.position_title, '') AS position_title,
        COALESCE(pos.salary_grade, i.salary_grade, '') AS salary_grade,
        COALESCE(pos.bureau, '') AS office,
        '' AS strand,
        COALESCE(pos.region, '') AS region,
        COALESCE(pos.division, '') AS division,
        'VACANT' AS status
      FROM tlo_assignments a
      LEFT JOIN tlo_positions pos ON pos.id = a.position_id
      LEFT JOIN tlo_items i ON i.item_number = a.tlo_position_id
      WHERE a.tlo_masterlist_id IS NULL
        AND UPPER(TRIM(COALESCE(a.tlo_position_id, ''))) NOT IN ('NEW ITEM', 'N/A (DETAILED)')
    `;

    if (office && office !== 'All') {
      params.push(office);
      query += ` AND (COALESCE(pos.bureau, '') = $${params.length})`;
    }
    if (region && region !== 'All') {
      params.push(region);
      query += ` AND (COALESCE(pos.region, '') = $${params.length})`;
    }
    if (division && division !== 'All') {
      params.push(division);
      query += ` AND (COALESCE(pos.division, '') = $${params.length})`;
    }
    if (strand && strand !== 'All') {
      params.push(strand);
      query += ` AND (1 = 1)`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      query += ` AND (pos.position_title ILIKE $${params.length} OR i.position_title ILIKE $${params.length} OR pos.bureau ILIKE $${params.length} OR a.tlo_position_id ILIKE $${params.length})`;
    }

    query += ` ORDER BY a.tlo_position_id ASC NULLS LAST, a.id ASC`;

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        position_title: displayPositionTitle(row.position_title)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getApplications = async (req, res) => {
  const allowedRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office', 'RO HRMO', 'SDO HRMO'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await ensureOicColumn();
    const isTest = Boolean(req.user?.is_testaccount);
    const { search, strand, position } = req.query;
    let query = `
      WITH ActivePositions AS (
        SELECT LOWER(email) as low_email, position_title, office
        FROM third_level_official_masterlist
        WHERE status = 'Active' AND email IS NOT NULL AND email != '' AND is_testaccount = $1
      )
      SELECT 
        a.*, 
        COALESCE(NULLIF(a.first_name, ''), m.first_name) as first_name,
        COALESCE(NULLIF(a.last_name, ''), m.last_name) as last_name,
        a.app_TLOid AS "TLOid", 
        v.position_title AS target_position, 
        v.office AS target_office, 
        v.strand AS target_strand,
        (
          SELECT string_agg(position_title || ' (' || COALESCE(office, '') || ')', ' | ') 
          FROM ActivePositions ap
          WHERE ap.low_email = LOWER(a.email)
        ) as concurrent_positions
      FROM third_level_officials_profiling_application a
      LEFT JOIN third_level_official_masterlist m ON LOWER(a.email) = LOWER(m.email) AND m.is_testaccount = a.is_testaccount
      LEFT JOIN third_level_official_masterlist v ON a."target_TLOid" = v."TLOid" AND v.is_testaccount = a.is_testaccount
      WHERE a.application_status = 'applied' AND a.is_testaccount = $1
    `;
    const params = [isTest];

    const userRole = req.user.role;
    const isRO = userRole === 'Regional Office' || userRole === 'RO_HRMO' || userRole === 'RO HRMO';
    const isSDO = userRole === 'School Division Office' || userRole === 'SDO_HRMO' || userRole === 'SDO HRMO';

    const targetRegion = req.user.assigned_region || req.user.region;
    const targetDivision = req.user.assigned_division || req.user.division;

    if (isRO && targetRegion) {
      params.push(targetRegion);
      query += ` AND m.strand = $${params.length}`;
    }
    if (isSDO && targetRegion && targetDivision) {
      params.push(targetRegion);
      query += ` AND m.strand = $${params.length}`;
      params.push(targetDivision);
      query += ` AND m.division = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.first_name ILIKE $${params.length} OR a.last_name ILIKE $${params.length} OR a.email ILIKE $${params.length} OR v.position_title ILIKE $${params.length} OR v.office ILIKE $${params.length} OR v.strand ILIKE $${params.length})`;
    }
    if (strand && strand !== 'All') {
      params.push(strand);
      query += ` AND v.strand = $${params.length}`;
    }
    if (position && position !== 'All') {
      params.push(position);
      query += ` AND v.position_title = $${params.length}`;
    }

    query += ` ORDER BY a.submitted_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const processApplication = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { app_TLOid, action, denial_reason } = req.body;
  if (!app_TLOid || !action) return res.status(400).json({ error: 'app_TLOid and action are required' });

  const client = await pool.connect();
  let applicantData = null;
  try {
    await client.query('BEGIN');
    await ensureOicColumn(client);

    const isTest = Boolean(req.user?.is_testaccount);
    const appRes = await client.query('SELECT * FROM third_level_officials_profiling_application WHERE app_TLOid = $1 AND is_testaccount = $2', [app_TLOid, isTest]);
    applicantData = appRes.rows[0];
    if (!applicantData) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found' });
    }

    if (action === 'reject') {
      await client.query(`
        UPDATE third_level_officials_profiling_application 
        SET application_status = 'disapproved', denial_reason = $1, updated_at = NOW() 
        WHERE app_TLOid = $2 AND is_testaccount = $3
      `, [denial_reason || 'No reason provided', app_TLOid, isTest]);
    } else if (action === 'approve') {
      const applicant = applicantData;
      if (!applicant) throw new Error('Applicant not found');
      if (!applicant.target_TLOid) throw new Error('No target vacancy associated with this application');

      const targetCheck = await client.query('SELECT 1 FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2', [applicant.target_TLOid, isTest]);
      if (targetCheck.rows.length === 0) throw new Error('Target vacancy not found in environment');

      const masterlistColsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'third_level_official_masterlist'
      `);
      const masterlistCols = new Set(masterlistColsRes.rows.map(r => r.column_name.toLowerCase()));

      const JSONB_FIELDS = new Set(['previous_positions', 'relevant_trainings', 'notable_achievements']);
      const exclude = ['id', 'TLOid', 'created_at', 'updated_at', 'status', 'strand', 'office', 'position_title'];
      const columns = Object.keys(applicant).filter(k => {
        const lowerK = k.toLowerCase();
        return masterlistCols.has(lowerK) && !exclude.map(e => e.toLowerCase()).includes(lowerK);
      });

      const sets = columns.map((col, idx) => `"${col}" = $${idx + 1}`);
      const values = columns.map(col => {
        let val = applicant[col];
        if (JSONB_FIELDS.has(col.toLowerCase()) && val !== null && typeof val !== 'string') {
          return JSON.stringify(val);
        }
        return val;
      });

      values.push('Active', applicant.target_TLOid, isTest);

      await client.query(`
        UPDATE third_level_official_masterlist 
        SET ${sets.join(', ')}, status = $${values.length - 2}, updated_at = NOW()
        WHERE "TLOid" = $${values.length - 1} AND is_testaccount = $${values.length}
      `, values);

      await client.query(`
        UPDATE third_level_officials_profiling_application 
        SET application_status = 'approved', updated_at = NOW() 
        WHERE app_TLOid = $1 AND is_testaccount = $2
      `, [app_TLOid, isTest]);

      await client.query(`
        UPDATE tlo_users SET role = 'Third Level Official' WHERE LOWER(email) = $1 AND role = 'Third Level Applicant' AND is_testaccount = $2
      `, [applicant.email.toLowerCase().trim(), isTest]);

      // Phase 3: Clone normalized child table rows from staging → masterlist
      const approvalUpdatedBy = req.user?.email || null;
      await cloneChildTablesOnApproval(client, app_TLOid, applicant.target_TLOid, approvalUpdatedBy);
    }

    await client.query('COMMIT');

    // Email notification dispatch
    if (applicantData && applicantData.email) {
      if (action === 'approve') {
        sendOfficialApprovalEmail({
          email: applicantData.email,
          firstName: applicantData.first_name,
          lastName: applicantData.last_name,
          positionTitle: applicantData.position_title,
          office: applicantData.office,
          tloId: applicantData.target_TLOid || app_TLOid
        }).catch(err => console.error('[processApplication] Approval email error:', err));
      } else if (action === 'reject') {
        sendOfficialRejectionEmail({
          email: applicantData.email,
          firstName: applicantData.first_name,
          lastName: applicantData.last_name,
          positionTitle: applicantData.position_title,
          office: applicantData.office,
          reason: denial_reason
        }).catch(err => console.error('[processApplication] Rejection email error:', err));
      }
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const processRegistration = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { TLOid, action, denial_reason } = req.body;
  if (!TLOid || !action) return res.status(400).json({ error: 'TLOid and action are required' });

  const client = await pool.connect();
  let targetOfficial = null;
  try {
    await client.query('BEGIN');

    const isTest = Boolean(req.user?.is_testaccount);
    const mlRes = await client.query('SELECT email, first_name, last_name, position_title, office FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2', [TLOid, isTest]);
    if (mlRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Official not found' });
    }
    targetOfficial = mlRes.rows[0];

    if (action === 'reject') {
      await client.query(`
        UPDATE third_level_official_masterlist 
        SET status = 'Rejected', updated_at = NOW() 
        WHERE "TLOid" = $1 AND status = 'For Approval' AND is_testaccount = $2
      `, [TLOid, isTest]);

      if (targetOfficial && targetOfficial.email) {
        await client.query(`
          UPDATE tlo_users SET registration_status = 'Rejected' WHERE LOWER(email) = $1 AND is_testaccount = $2
        `, [targetOfficial.email.toLowerCase(), isTest]);
      }
    } else if (action === 'approve') {
      await client.query(`
        UPDATE third_level_official_masterlist 
        SET status = 'Active', updated_at = NOW() 
        WHERE "TLOid" = $1 AND status = 'For Approval' AND is_testaccount = $2
      `, [TLOid, isTest]);

      if (targetOfficial && targetOfficial.email) {
        await client.query(`
          UPDATE tlo_users SET registration_status = 'Approved' WHERE LOWER(email) = $1 AND is_testaccount = $2
        `, [targetOfficial.email.toLowerCase(), isTest]);
      }
    } else if (action === 'retrieve') {
      await client.query(`
        UPDATE third_level_official_masterlist 
        SET status = 'For Approval', updated_at = NOW() 
        WHERE "TLOid" = $1 AND status = 'Rejected' AND is_testaccount = $2
      `, [TLOid, isTest]);

      if (targetOfficial && targetOfficial.email) {
        await client.query(`
          UPDATE tlo_users SET registration_status = 'For Approval' WHERE LOWER(email) = $1 AND is_testaccount = $2
        `, [targetOfficial.email.toLowerCase(), isTest]);
      }
    }

    await client.query('COMMIT');

    // Email notification dispatch
    if (targetOfficial && targetOfficial.email) {
      if (action === 'approve') {
        sendOfficialApprovalEmail({
          email: targetOfficial.email,
          firstName: targetOfficial.first_name,
          lastName: targetOfficial.last_name,
          positionTitle: targetOfficial.position_title,
          office: targetOfficial.office,
          tloId: TLOid
        }).catch(err => console.error('[processRegistration] Approval email error:', err));
      } else if (action === 'reject') {
        sendOfficialRejectionEmail({
          email: targetOfficial.email,
          firstName: targetOfficial.first_name,
          lastName: targetOfficial.last_name,
          positionTitle: targetOfficial.position_title,
          office: targetOfficial.office,
          reason: denial_reason || 'Registration rejected by Central Office Administrator.'
        }).catch(err => console.error('[processRegistration] Rejection email error:', err));
      }
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const executeReassignment = async (client, official, effTs, justification, assignee_TLOid, target_TLOid) => {
  const TLOid = official.TLOid;
  if (assignee_TLOid) {
    const assigneeRes = await client.query(`
      SELECT app_TLOid AS "TLOid", first_name, last_name, email, contact_details
      FROM third_level_officials_profiling_application
      WHERE app_TLOid = $1
      UNION ALL
      SELECT uid AS "TLOid", first_name, last_name, email, contact_number AS contact_details
      FROM tlo_users
      WHERE uid = $1
      LIMIT 1
    `, [assignee_TLOid]);
    const assignee = assigneeRes.rows[0];
    if (!assignee) throw new Error('Assignee not found');

    const existingAssignmentRes = await client.query(`
      SELECT 1
      FROM third_level_official_masterlist
      WHERE LOWER(email) = LOWER($1)
        AND status = 'Active'
      LIMIT 1
    `, [assignee.email]);
    if (existingAssignmentRes.rows.length > 0) throw new Error('Selected personnel already has an assigned position');

    if (official.first_name && official.first_name !== 'VACANT') {
      await client.query(`
        INSERT INTO third_level_officials_updates
          ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'Vacated', $8, NOW(), ${effTs}, $9)
      `, [TLOid, official.first_name, official.last_name, official.position_title,
        official.office, official.strand, official.email, justification || 'Reassigned position to another personnel', null]);
    }

    await client.query(`
      UPDATE third_level_official_masterlist
      SET first_name = $1, last_name = $2, email = $3, contact_details = $4,
          status = 'Active', updated_at = NOW(), effectivity_date = ${effTs}
      WHERE "TLOid" = $5 AND is_testaccount = $6
    `, [assignee.first_name, assignee.last_name, assignee.email, assignee.contact_details, TLOid, Boolean(official.is_testaccount)]);

    await client.query(`
      INSERT INTO third_level_officials_updates
        ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), ${effTs}, $9)
    `, [TLOid, assignee.first_name, assignee.last_name, official.position_title,
      official.office, official.strand, assignee.email, justification || 'Assigned through reassignment', null]);
  } else if (target_TLOid) {
    // Resolve target organizational values
    const targetItemRes = await client.query(
      `SELECT i.item_number, i.position_title,
              COALESCE(a.office, m.office) AS office,
              COALESCE(a.strand, m.strand) AS strand,
              COALESCE(a.region, m.region) AS region,
              COALESCE(a.division, m.division) AS division
       FROM tlo_items i
       LEFT JOIN (
         SELECT DISTINCT ON (tlo_position_id) *
         FROM tlo_assignments
         WHERE status = 'Active' AND end_date IS NULL
         ORDER BY tlo_position_id, id DESC
       ) a ON a.tlo_position_id = i.item_number
       LEFT JOIN third_level_official_masterlist m ON m."TLOid" = i.item_number AND m.is_testaccount = $2
       WHERE i.item_number = $1`,
      [target_TLOid, Boolean(official.is_testaccount)]
    );
    const targetSlot = targetItemRes.rows[0];

    // Resolve official's numeric masterlist ID
    const mRes = await client.query('SELECT id FROM tlo_masterlist WHERE LOWER(tloid) = LOWER($1) LIMIT 1', [TLOid]);
    const numericMasterlistId = mRes.rows.length > 0 ? mRes.rows[0].id : null;

    // Resolve official's active assignment
    const activeAssignRes = await client.query(
      `SELECT a.*
       FROM tlo_assignments a
       LEFT JOIN tlo_masterlist tm ON tm.id = a.tlo_masterlist_id
       WHERE (a.tlo_position_id = $1 OR tm.tloid = $1 OR (a.tlo_masterlist_id = $2 AND $2::int IS NOT NULL))
         AND a.status = 'Active'
         AND a.end_date IS NULL
       ORDER BY a.id DESC
       LIMIT 1`,
      [TLOid, numericMasterlistId]
    );

    let itemNumber = activeAssignRes.rows[0]?.tlo_position_id || TLOid;
    const pRes = await client.query('SELECT id FROM tlo_personnel WHERE legacy_tlo_id = $1 LIMIT 1', [TLOid]);
    const personId = pRes.rows[0]?.id;

    const effDateVal = effTs && effTs !== 'NOW()' ? effTs.replace(/'/g, '').replace('::timestamp', '') : new Date().toISOString().split('T')[0];

    // Close out previous active record in tlo_assignments and record new active assignment
    if (personId || numericMasterlistId) {
      if (activeAssignRes.rows.length > 0) {
        await client.query(
          `UPDATE tlo_assignments
           SET status = 'Inactive', end_date = $1, updated_at = NOW()
           WHERE id = $2`,
          [effDateVal, activeAssignRes.rows[0].id]
        );

        // Ensure vacated slot exists as vacant in tlo_assignments
        const oldPositionItemId = activeAssignRes.rows[0]?.tlo_position_id || itemNumber;
        if (oldPositionItemId && oldPositionItemId !== (target_TLOid || itemNumber)) {
          const vCheck = await client.query(
            `SELECT id FROM tlo_assignments WHERE tlo_position_id = $1 AND tlo_masterlist_id IS NULL LIMIT 1`,
            [oldPositionItemId]
          );
          if (vCheck.rowCount === 0) {
            await client.query(
              `INSERT INTO tlo_assignments (
                 tlo_position_id, position_id, tlo_masterlist_id,
                 status, capacity, start_date, created_at, updated_at
               ) VALUES ($1, $2, NULL, 'Inactive', 'Full', $3, NOW(), NOW())`,
              [oldPositionItemId, activeAssignRes.rows[0]?.position_id, effDateVal]
            );
          }
        }
      }

      // Check if target position exists as vacant in tlo_assignments to occupy
      const targetVacantRes = await client.query(
        `UPDATE tlo_assignments
         SET tlo_masterlist_id = $1, status = 'Active', start_date = $2, end_date = NULL,
             remarks = $3, updated_at = NOW()
         WHERE tlo_position_id = $4 AND tlo_masterlist_id IS NULL
         RETURNING id`,
        [numericMasterlistId, effDateVal, justification || `Reassigned from ${official.position_title}`, target_TLOid || itemNumber]
      );

      if (targetVacantRes.rowCount === 0) {
        // Append new active record into tlo_assignments
        await client.query(
          `INSERT INTO tlo_assignments (
             tlo_masterlist_id, tlo_position_id, status, capacity,
             start_date, end_date, remarks, created_at, updated_at
           ) VALUES (
             $1, $2, 'Active', 'Full',
             $3, NULL, $4, NOW(), NOW()
           )`,
          [
            numericMasterlistId,
            target_TLOid || itemNumber,
            effDateVal,
            justification || `Reassigned from ${official.position_title}`
          ]
        );
      }
    }

    // Update masterlist view for backward compatibility
    await client.query(`
      UPDATE third_level_official_masterlist
      SET region = $1, division = $2, office = $3, strand = $4,
          designation = $5, appointment_date = ${effTs}, updated_at = NOW()
      WHERE "TLOid" = $6 AND is_testaccount = $7
    `, [
      targetSlot?.region || official.region,
      targetSlot?.division || official.division,
      targetSlot?.office || official.office,
      targetSlot?.strand || official.strand,
      targetSlot?.position_title || official.position_title,
      TLOid,
      Boolean(official.is_testaccount)
    ]);

    await client.query(`
      INSERT INTO third_level_officials_updates
        ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), ${effTs}, $9)
    `, [TLOid, official.first_name, official.last_name,
      targetSlot?.position_title || official.position_title,
      targetSlot?.office || official.office,
      targetSlot?.strand || official.strand, official.email, justification || `Reassigned from ${official.position_title}`, null]);
  } else {
    await client.query(`
    UPDATE third_level_official_masterlist
    SET updated_at = NOW(), effectivity_date = ${effTs}
    WHERE "TLOid" = $1 AND is_testaccount = $2
  `, [TLOid, Boolean(official.is_testaccount)]);
  }
};

let isProcessingVacancies = false;
let lastProcessTime = 0;

export const processScheduledVacancies = async (client, force = false) => {
  const now = Date.now();
  if (!force && (isProcessingVacancies || now - lastProcessTime < 60000)) return; // Only run once per minute unless forced

  isProcessingVacancies = true;
  lastProcessTime = now;

  try {
    const matureVacancies = await client.query(`
      SELECT * FROM third_level_official_masterlist
      WHERE status IN ('Vacating', 'Resigning') AND effectivity_date <= NOW()
    `);

    for (const official of matureVacancies.rows) {
      const conn = typeof client.connect === 'function' ? await client.connect() : client;
      try {
        await conn.query('BEGIN');
        const mLock = await conn.query(
          'SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1 FOR UPDATE',
          [official.TLOid]
        );
        if (mLock.rows.length === 0 || !['Vacating', 'Resigning'].includes(mLock.rows[0].status)) {
          await conn.query('ROLLBACK');
          continue;
        }

        const lockedOfficial = mLock.rows[0];

        const pRes = await conn.query(
          `SELECT id FROM tlo_personnel
           WHERE legacy_tlo_id = $1
              OR (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND email IS NOT NULL AND email != '')
           ORDER BY CASE WHEN legacy_tlo_id = $1 THEN 0 ELSE 1 END, id ASC
           LIMIT 1`,
          [lockedOfficial.TLOid, lockedOfficial.email]
        );
        const personId = pRes.rows[0]?.id;

        let activeAssignmentId = null;

        if (personId) {
          const aRes = await conn.query(
            `SELECT a.id, a.tlo_position_id, a.status
             FROM tlo_assignments a
             LEFT JOIN tlo_masterlist tm ON tm.id = a.tlo_masterlist_id
             WHERE (tm.tloid = $1 OR a.tlo_position_id = $1)
               AND a.status = 'Active'
               AND a.end_date IS NULL
             ORDER BY a.id DESC
             LIMIT 1
             FOR UPDATE`,
            [lockedOfficial.TLOid]
          );

          if (aRes.rows.length > 0) {
            activeAssignmentId = aRes.rows[0].id;
            const vacatedItemId = aRes.rows[0]?.tlo_position_id;
            const vacatedPosId = aRes.rows[0]?.position_id;

            await conn.query(
              `UPDATE tlo_assignments
               SET status = 'Inactive', end_date = $1, updated_at = NOW()
               WHERE id = $2`,
              [lockedOfficial.effectivity_date, activeAssignmentId]
            );

            if (vacatedItemId) {
              const vCheck = await conn.query(
                `SELECT id FROM tlo_assignments WHERE tlo_position_id = $1 AND tlo_masterlist_id IS NULL LIMIT 1`,
                [vacatedItemId]
              );
              if (vCheck.rowCount === 0) {
                await conn.query(
                  `INSERT INTO tlo_assignments (
                     tlo_position_id, position_id, tlo_masterlist_id,
                     status, capacity, start_date, created_at, updated_at
                   ) VALUES ($1, $2, NULL, 'Inactive', 'Full', $3, NOW(), NOW())`,
                  [vacatedItemId, vacatedPosId, lockedOfficial.effectivity_date]
                );
              }
            }
          }
        }

        const isResignOrRetire = lockedOfficial.status === 'Resigning' || /^(resign|retire)/i.test(lockedOfficial.status || '');
        const targetStatus = isResignOrRetire ? 'Inactive' : 'Vacated';

        await conn.query(
          `UPDATE third_level_official_masterlist
           SET first_name = 'VACANT',
               last_name = '',
               email = NULL,
               status = $1,
               updated_at = NOW()
           WHERE "TLOid" = $2`,
          [targetStatus, lockedOfficial.TLOid]
        );

        await conn.query(
          `INSERT INTO third_level_officials_updates
             ("TLOid", first_name, last_name, middle_name, suffix, email, contact_details, position_title, office, division, region, strand, status, vacate_reason, remarks, assignment, updated_at, effectivity_date, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Scheduled vacancy executed', $15, NOW(), $16, 'SYSTEM_CRON')`,
          [
            lockedOfficial.TLOid,
            lockedOfficial.first_name,
            lockedOfficial.last_name,
            lockedOfficial.middle_name,
            lockedOfficial.suffix,
            lockedOfficial.email,
            lockedOfficial.contact_details,
            lockedOfficial.position_title,
            lockedOfficial.office,
            lockedOfficial.division,
            lockedOfficial.region,
            lockedOfficial.strand,
            targetStatus,
            lockedOfficial.status === 'Resigning' ? 'Resignation' : 'Scheduled Vacate',
            activeAssignmentId ? activeAssignmentId.toString() : null,
            lockedOfficial.effectivity_date
          ]
        );

        await conn.query('COMMIT');
      } catch (err) {
        await conn.query('ROLLBACK');
        console.error('Failed processing scheduled vacancy for', official.TLOid, err);
      } finally {
        if (typeof client.connect === 'function') {
          conn.release();
        }
      }
    }

    const pendingReassignments = await client.query(`
      SELECT * FROM third_level_official_masterlist
      WHERE (status = 'Reassigning' OR status = 'Pending Assignment') AND effectivity_date <= NOW()
    `);

    for (const official of pendingReassignments.rows) {
      try {
        const effTsStr = official.effectivity_date ? `'${official.effectivity_date.toISOString()}'::timestamp` : 'NOW()';
        await executeReassignment(client, official, effTsStr, 'Scheduled reassignment executed', official.reassign_assignee_tloid, official.reassign_target_tloid);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET reassign_target_tloid = NULL, reassign_assignee_tloid = NULL
          WHERE "TLOid" = $1
        `, [official.TLOid]);
      } catch (err) {
        console.error('Failed scheduled reassignment for', official.TLOid, err);
      }
    }
  } catch (err) {
    console.error('Failed to process scheduled vacancies:', err);
  } finally {
    isProcessingVacancies = false;
  }
};

export const processAnticipatedVacancies = async (client) => {
  try {
    // Identify personnel within 5 years of mandatory retirement (age 60 to 65)
    const res = await client.query(`
      SELECT "TLOid", first_name, last_name, position_title, office, date_of_birth 
      FROM third_level_official_masterlist
      WHERE status = 'Active' 
        AND date_of_birth IS NOT NULL
        AND date_of_birth <= NOW() - INTERVAL '60 years'
        AND date_of_birth > NOW() - INTERVAL '65 years'
    `);

    if (res.rows.length > 0) {
      console.log(`\n📌 [Anticipated Vacancies] Identified ${res.rows.length} personnel retiring within 5 years.`);
    }
  } catch (err) {
    console.error('Failed to process anticipated vacancies:', err);
  }
};

// HTTP Endpoint for Vercel Cron
export const triggerCron = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized cron trigger' });
    }

    await processScheduledVacancies(pool);
    res.json({ success: true, message: 'Cron job executed successfully' });
  } catch (err) {
    console.error('Vercel Cron Error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const buildOfficialsFilterConditions = (query, user) => {
  const params = [];
  const conditions = [];

  const isTestUser = Boolean(user?.is_testaccount);
  params.push(isTestUser);
  conditions.push(`m.is_testaccount = $${params.length}`);

  const { search, status, strand, category, position, designation, office, is_oic, region, division, name, position_title, level } = query;

  const userRole = user?.role;
  const isRO = userRole === 'Regional Office' || userRole === 'RO_HRMO' || userRole === 'RO HRMO';
  const isSDO = userRole === 'School Division Office' || userRole === 'SDO_HRMO' || userRole === 'SDO HRMO';

  const targetRegion = user?.assigned_region || user?.region;
  const targetDivision = user?.assigned_division || user?.division;

  if (isRO && targetRegion) {
    params.push(targetRegion);
    conditions.push(`strand = $${params.length}`);
  }
  if (isSDO && targetRegion && targetDivision) {
    params.push(targetRegion);
    conditions.push(`strand = $${params.length}`);
    params.push(targetDivision);
    conditions.push(`division = $${params.length}`);
  }

  let filterLevel = Array.isArray(level) ? level[level.length - 1] : level;
  if (filterLevel && filterLevel !== 'All') {
    if (filterLevel === 'Central Office') {
      conditions.push(`(region = 'Central Office' OR (COALESCE(region, '') = '' AND COALESCE(strand, '') NOT ILIKE 'Region%' AND COALESCE(strand, '') NOT ILIKE 'NCR' AND COALESCE(strand, '') NOT ILIKE 'CAR%' AND COALESCE(strand, '') NOT ILIKE 'NIR' AND COALESCE(strand, '') NOT ILIKE 'BARMM'))`);
    } else if (filterLevel === 'Regional Office') {
      conditions.push(`(region != 'Central Office' OR (COALESCE(region, '') = '' AND (COALESCE(strand, '') ILIKE 'Region%' OR COALESCE(strand, '') ILIKE 'NCR' OR COALESCE(strand, '') ILIKE 'CAR%' OR COALESCE(strand, '') ILIKE 'NIR' OR COALESCE(strand, '') ILIKE 'BARMM'))) AND (office ILIKE '%Regional Office%' OR office ILIKE 'ro' OR office = strand OR position_title ILIKE '%Regional Director%' OR position_title ILIKE '% RD %' OR position_title ILIKE '% ARD %')`);
    } else if (filterLevel === 'Schools Division Office') {
      conditions.push(`(region != 'Central Office' OR (COALESCE(region, '') = '' AND (COALESCE(strand, '') ILIKE 'Region%' OR COALESCE(strand, '') ILIKE 'NCR' OR COALESCE(strand, '') ILIKE 'CAR%' OR COALESCE(strand, '') ILIKE 'NIR' OR COALESCE(strand, '') ILIKE 'BARMM'))) AND NOT (office ILIKE '%Regional Office%' OR office ILIKE 'ro' OR office = strand OR position_title ILIKE '%Regional Director%' OR position_title ILIKE '% RD %' OR position_title ILIKE '% ARD %')`);
    }
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length} OR position_title ILIKE $${params.length} OR office ILIKE $${params.length} OR strand ILIKE $${params.length} OR plantilla_item_no ILIKE $${params.length})`);
  }

  const filterStatus = Array.isArray(status) ? status[status.length - 1] : status;
  if (filterStatus && filterStatus !== 'All' && filterStatus !== 'Legacy') {
    if (filterStatus === 'Vacant' || filterStatus === 'Vacated') {
      conditions.push(`(status = 'Vacated' OR status = 'Vacant' OR first_name IS NULL OR first_name = '' OR first_name ILIKE '%VACANT%')`);
    } else {
      params.push(filterStatus);
      conditions.push(`status = $${params.length}`);
    }
  } else {
    conditions.push(`status != 'For Approval' AND status != 'Rejected'`);
  }

  let filterStrand = Array.isArray(strand) ? strand[strand.length - 1] : strand;
  if (filterStrand && filterStrand !== 'All') {
    params.push(filterStrand);
    conditions.push(`strand = $${params.length}`);
  }

  let filterRegion = Array.isArray(region) ? region[region.length - 1] : region;
  if (filterRegion && filterRegion !== 'All') {
    if (filterRegion === 'Central Office') {
      conditions.push(`(region = 'Central Office' OR (COALESCE(region, '') = '' AND COALESCE(strand, '') NOT ILIKE 'Region%' AND COALESCE(strand, '') NOT ILIKE 'NCR' AND COALESCE(strand, '') NOT ILIKE 'CAR%' AND COALESCE(strand, '') NOT ILIKE 'NIR' AND COALESCE(strand, '') NOT ILIKE 'BARMM'))`);
    } else if (filterRegion === 'CARAGA') {
      conditions.push(`(region = 'CARAGA' OR (COALESCE(region, '') = '' AND (COALESCE(strand, '') ILIKE 'Region XIII%' OR COALESCE(strand, '') ILIKE 'CARAGA%')))`);
    } else {
      params.push(filterRegion + '%');
      conditions.push(`(region ILIKE $${params.length} OR (COALESCE(region, '') = '' AND COALESCE(strand, '') ILIKE $${params.length}))`);
    }
  }

  let filterOffice = Array.isArray(office) ? office[office.length - 1] : office;
  let filterDivision = Array.isArray(division) ? division[division.length - 1] : division;
  let activeOffice = filterOffice || filterDivision;
  if (activeOffice && activeOffice !== 'All') {
    if (activeOffice === 'No Division') {
      conditions.push(`((office IS NULL OR office = '') AND (division IS NULL OR division = ''))`);
    } else {
      params.push(activeOffice);
      conditions.push(`(office = $${params.length} OR strand = $${params.length} OR division = $${params.length})`);
    }
  }

  let filterPos1 = Array.isArray(position) ? position[position.length - 1] : position;
  let filterPos2 = Array.isArray(position_title) ? position_title[position_title.length - 1] : position_title;
  let activePosition = filterPos1 || filterPos2;
  if (activePosition && activePosition !== 'All') {
    if (activePosition === 'Unassigned') {
      conditions.push(`(position_title IS NULL OR position_title = '')`);
    } else {
      params.push(activePosition);
      conditions.push(`position_title ILIKE $${params.length}`);
    }
  }

  let filterDesignation = Array.isArray(designation) ? designation[designation.length - 1] : designation;
  if (filterDesignation && filterDesignation !== 'All') {
    if (filterDesignation === 'No Designation') {
      conditions.push(`(designation IS NULL OR designation = '')`);
    } else {
      params.push(filterDesignation);
      conditions.push(`designation = $${params.length}`);
    }
  }

  let filterName = Array.isArray(name) ? name[name.length - 1] : name;
  if (filterName && filterName !== 'All') {
    if (filterName === 'VACANT POSITION') {
      conditions.push(`(first_name IS NULL OR first_name = 'VACANT')`);
    } else {
      params.push(`%${filterName}%`);
      conditions.push(`CONCAT_WS(' ', first_name, last_name) ILIKE $${params.length}`);
    }
  }

  if (category === 'Third Level' || category === 'Third Level Officials') {
    params.push(THIRD_LEVEL_POSITIONS_UPPER);
    conditions.push(`UPPER(TRIM(COALESCE(position_title, ''))) = ANY($${params.length})`);
  } else if (category === 'Third Level (OIC)' || category === 'Officer in Charge') {
    params.push(THIRD_LEVEL_POSITIONS);
    conditions.push(`(position_title = ANY($${params.length}) OR designation = ANY($${params.length}) OR designation ILIKE '%OIC%') AND (COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
  } else if (category === 'Division Chiefs') {
    params.push(THIRD_LEVEL_POSITIONS);
    conditions.push(`position_title != ALL($${params.length}) AND NOT (COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
  } else if (category === 'Division Chiefs (OIC)') {
    params.push(THIRD_LEVEL_POSITIONS);
    conditions.push(`position_title != ALL($${params.length}) AND designation != ALL($${params.length}) AND (designation NOT ILIKE '%OIC%' OR designation IS NULL) AND (COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
  } else if (category === 'OIC / Chiefs') {
    conditions.push(`(COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
  } else if (category === 'Concurrent Positions' || category === 'Concurrent Roles' || query.concurrent === 'true' || query.is_concurrent === 'true') {
    conditions.push(`m.status = 'Active' AND m.email IS NOT NULL AND m.email != '' AND LOWER(m.email) IN (
      SELECT LOWER(email) 
      FROM third_level_official_masterlist 
      WHERE status = 'Active' AND email IS NOT NULL AND email != '' AND is_testaccount = $1
      GROUP BY LOWER(email) 
      HAVING COUNT(*) > 1
    )`);
  }

  let filterOic = Array.isArray(is_oic) ? is_oic[is_oic.length - 1] : is_oic;
  if (filterOic && filterOic !== 'All') {
    const isYes = ['true', 'yes', '1'].includes(String(filterOic).toLowerCase());
    const isNo = ['false', 'no', '0'].includes(String(filterOic).toLowerCase());
    if (isYes) {
      conditions.push(`(COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
    } else if (isNo) {
      conditions.push(`(COALESCE(is_oic, FALSE) = FALSE AND (designation NOT ILIKE '%OIC%' OR designation IS NULL))`);
    }
  }

  return { params, conditions };
};

export const getOfficials = async (req, res) => {
  const allowedRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office', 'RO HRMO', 'SDO HRMO'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
  }

  processScheduledVacancies(pool).catch(err => console.error('Background process error:', err));

  const { page, limit, sortColumn, sortDirection, include_test_accounts } = req.query;
  const isThirdLevelCategory = req.query.category === 'Third Level' || req.query.category === 'Third Level Officials';
  let query = `
    WITH RankedOfficials AS (
      SELECT 
        m."TLOid", m.first_name, m.last_name, m.email, m.position_title, m.office, m.strand, m.region, m.division, m.status, m.is_oic, m.designation, m.contact_details, m.effectivity_date, m.reassign_assignee_tloid, m.reassign_target_tloid, m.created_at, m.updated_at, m.photo_binary_id, m.pds_binary_id, m.pending_admin_case, m.date_of_birth, m.is_testaccount,
        m.plantilla_item_no, m.appointment_status,
        (SELECT vacate_reason FROM third_level_officials_updates u WHERE u."TLOid" = m."TLOid" AND u.vacate_reason IS NOT NULL ORDER BY updated_at DESC LIMIT 1) as vacate_reason,
        (SELECT CONCAT_WS(' ', u.first_name, u.last_name) FROM third_level_officials_updates u WHERE u."TLOid" = m."TLOid" AND u.first_name IS NOT NULL AND u.first_name != 'VACANT' AND u.status != 'Vacated' ORDER BY updated_at DESC LIMIT 1) as previous_incumbent,
        (
          CASE WHEN m.first_name IS NULL OR m.first_name = '' OR m.first_name ILIKE '%VACANT%' OR m.status = 'Vacated' THEN NULL
          ELSE (
            (CASE WHEN 
              m.first_name IS NOT NULL AND m.first_name != '' AND
              m.last_name IS NOT NULL AND m.last_name != '' AND
              m.gender IS NOT NULL AND m.gender != '' AND
              m.date_of_birth IS NOT NULL AND
              m.civil_status IS NOT NULL AND m.civil_status != '' AND
              m.photo_binary_id IS NOT NULL AND
              m.employment_status IS NOT NULL AND m.employment_status != '' AND
              m.region IS NOT NULL AND m.region != '' AND
              m.position_title IS NOT NULL AND m.position_title != '' AND
              m.appointment_date IS NOT NULL AND
              (COALESCE(m.is_oic, false) = false OR (m.designation IS NOT NULL AND m.designation != '')) AND
              m.permanent_address IS NOT NULL AND m.permanent_address != '' AND
              ((m.contact_details IS NOT NULL AND m.contact_details != '') OR (m.alt_contact_details_1 IS NOT NULL AND m.alt_contact_details_1 != ''))
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (m.ces_stage IS NOT NULL AND m.ces_stage != '' AND m.ces_stage != 'NOT APPLICABLE') OR
              m.emt_passer IS NOT NULL OR
              EXISTS (SELECT 1 FROM tlo_eligibility_records el WHERE el.source_table = 'masterlist' AND el.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_position_history ph WHERE ph.source_table = 'masterlist' AND ph.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_education_records ed WHERE ed.source_table = 'masterlist' AND ed.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.performance_rating_1 IS NOT NULL AND m.performance_rating_1 != '' AND
              m.performance_rating_1_period IS NOT NULL AND m.performance_rating_1_period != ''
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_training_records tr WHERE tr.source_table = 'masterlist' AND tr.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (m.notable_achievements IS NOT NULL AND jsonb_array_length(CASE WHEN jsonb_typeof(m.notable_achievements) = 'array' THEN m.notable_achievements ELSE '[]'::jsonb END) > 0) OR
              EXISTS (SELECT 1 FROM tlo_accomplishment_records ac WHERE ac.source_table = 'masterlist' AND ac.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.pds_binary_id IS NOT NULL AND m.service_records_binary_id IS NOT NULL
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.pending_admin_case IS NOT NULL AND m.pending_admin_case != '' AND (
                (m.guilty_admin_details IS NOT NULL AND m.criminally_charged_details IS NOT NULL AND m.convicted_crime_details IS NOT NULL) OR
                (UPPER(m.pending_admin_case) IN ('NO', 'NONE', 'N/A'))
              )
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.dpa_consented_at IS NOT NULL
            THEN 10 ELSE 0 END)
          ) END
        ) AS profile_completion,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN m.first_name IS NULL OR m.first_name = 'VACANT' THEN m."TLOid" ELSE LOWER(m.email) END 
          ORDER BY m."TLOid" ASC
        ) as rn
      FROM third_level_official_masterlist m
  `;

  try {
    await ensureOicColumn();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { params, conditions } = buildOfficialsFilterConditions(req.query, req.user);

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` 
    ), ActivePositions AS (
      SELECT LOWER(email) as low_email, "TLOid", position_title, office
      FROM third_level_official_masterlist
      WHERE status = 'Active' AND email IS NOT NULL AND email != '' AND is_testaccount = $1
    ), DuplicateEmails AS (
      SELECT LOWER(email) as dup_email,
             COUNT(*)::integer as duplicate_count,
             json_agg(
               json_build_object(
                 'TLOid', "TLOid",
                 'first_name', first_name,
                 'last_name', last_name,
                 'email', email,
                 'position_title', position_title,
                 'designation', designation,
                 'office', office,
                 'division', division,
                 'region', region,
                 'strand', strand,
                 'status', status,
                 'is_oic', is_oic,
                 'plantilla_item_no', plantilla_item_no,
                 'appointment_status', appointment_status,
                 'photo_binary_id', photo_binary_id,
                 'effectivity_date', effectivity_date,
                 'created_at', created_at,
                 'updated_at', updated_at
               ) ORDER BY "TLOid" ASC
             ) as duplicate_records
      FROM third_level_official_masterlist
      WHERE email IS NOT NULL AND TRIM(email) != '' AND is_testaccount = $1
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    )
    SELECT 
      f.*,
      COUNT(*) OVER() AS total_count,
      (
         SELECT string_agg(t2.position_title || ' (' || COALESCE(t2.office, '') || ')', ' | ')
         FROM ActivePositions t2 
         WHERE t2.low_email = LOWER(f.email)
           AND t2."TLOid" != f."TLOid" 
      ) as concurrent_positions,
      COALESCE(d.duplicate_count, 1)::integer as email_duplicate_count,
      d.duplicate_records
    FROM RankedOfficials f 
    LEFT JOIN DuplicateEmails d ON d.dup_email = LOWER(f.email)
  `;

  const { profile_completion } = req.query;
  const outerConditions = [];
  if (profile_completion && profile_completion !== 'All') {
    if (profile_completion === '—' || profile_completion === 'null') {
      outerConditions.push('f.profile_completion IS NULL');
    } else {
      const parsedPct = parseInt(String(profile_completion).replace('%', '').trim(), 10);
      if (!isNaN(parsedPct)) {
        params.push(parsedPct);
        outerConditions.push(`f.profile_completion = $${params.length}`);
      }
    }
  }

  if (outerConditions.length > 0) {
    query += ' WHERE ' + outerConditions.join(' AND ');
  }

  // Server-side sorting
  const sortMap = {
    'status': 'f.status',
    'office': 'f.office',
    'position_title': 'f.position_title',
    'first_name': 'f.first_name',
    'name': 'f.last_name',
    'region': 'f.strand',
    'division': 'f.office',
    'designation': 'f.designation',
    'profile_completion': 'f.profile_completion'
  };
  if (sortColumn && sortMap[sortColumn]) {
    query += ` ORDER BY ${sortMap[sortColumn]} ${sortDirection === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;
  } else {
    query += ` ORDER BY f."TLOid" ASC`;
  }

  // Server-side pagination
  if (page && limit) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    params.push(limitNum);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;
  }

  try {
    const result = await pool.query(query, params);
    res.json({
      success: true,
      total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
      data: result.rows.map(row => ({
        ...row,
        position_title: displayPositionTitle(row.position_title)
      }))
    });
  } catch (err) {
    import('fs').then(fs => fs.writeFileSync('getOfficials_error.log', err.stack || err.message)).catch(() => { });
    res.status(500).json({ error: err.message });
  }
};

export const getKpiSummary = async (req, res) => {
  try {
    await ensureOicColumn();
    const isTest = Boolean(req.user?.is_testaccount);
    const { params, conditions } = buildOfficialsFilterConditions(req.query, req.user);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      WITH ActivePositions AS (
        SELECT LOWER(email) as low_email, "TLOid", position_title, office
        FROM third_level_official_masterlist
        WHERE status = 'Active' AND email IS NOT NULL AND email != '' AND is_testaccount = $1
      ),
      FilteredMasterlist AS (
        SELECT 
          m.*,
          (
             SELECT string_agg(t2.position_title || ' (' || COALESCE(t2.office, '') || ')', ' | ')
             FROM ActivePositions t2 
             WHERE t2.low_email = LOWER(m.email)
               AND t2."TLOid" != m."TLOid" 
          ) as concurrent_positions
        FROM third_level_official_masterlist m
        ${whereClause}
      )
      SELECT 
        COUNT(*) FILTER (
          WHERE status = 'Active' 
            AND UPPER(TRIM(COALESCE(position_title, ''))) = ANY($${params.length + 1})
        ) AS total_third_level,
        COUNT(*) FILTER (
          WHERE status = 'Vacant' 
             OR status = 'Vacated' 
             OR first_name IS NULL 
             OR first_name = '' 
             OR first_name ILIKE '%VACANT%'
        ) AS total_vacant,
        COUNT(*) FILTER (
          WHERE status = 'Active' 
            AND (COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')
        ) AS total_oic,
        COUNT(DISTINCT CASE 
          WHEN status = 'Active' AND concurrent_positions IS NOT NULL AND email IS NOT NULL AND email != '' 
          THEN LOWER(TRIM(email)) 
        END) AS total_concurrent
      FROM FilteredMasterlist;
    `;
    params.push(THIRD_LEVEL_POSITIONS_UPPER);

    const result = await pool.query(query, params);

    // Also fetch all masterlist rows for filter dropdowns / directory compatibility
    const allRowsQuery = `
      SELECT m.status, m.is_oic, m.position_title, m.first_name, m.last_name, m.email, m.office, m.strand, m.region, m.division, m.designation, m.effectivity_date,
        m.date_of_birth, m.created_at, m.updated_at, m."TLOid",
        m.photo_binary_id, m.pds_binary_id, m.contact_details, m.pending_admin_case,
        m.plantilla_item_no, m.appointment_status, m.is_testaccount,
        (
          -- Tab 1: Personal
          (
            m.first_name IS NOT NULL AND m.first_name != '' AND m.first_name != 'VACANT'
            AND m.last_name IS NOT NULL AND m.last_name != ''
            AND m.gender IS NOT NULL AND m.gender != ''
            AND m.date_of_birth IS NOT NULL
            AND m.civil_status IS NOT NULL AND m.civil_status != ''
            AND m.photo_binary_id IS NOT NULL
            AND m.employment_status IS NOT NULL AND m.employment_status != ''
            AND m.region IS NOT NULL AND m.region != ''
            AND m.position_title IS NOT NULL AND m.position_title != ''
            AND m.appointment_date IS NOT NULL
            AND (COALESCE(m.is_oic, FALSE) = FALSE OR (m.designation IS NOT NULL AND m.designation != ''))
            AND m.permanent_address IS NOT NULL AND m.permanent_address != ''
            AND (COALESCE(m.contact_details, '') != '' OR COALESCE(m.alt_contact_details_1, '') != '')
          )
          AND (
            -- Tab 2: Eligibility
            (m.ces_stage IS NOT NULL AND m.ces_stage != '')
            OR m.emt_passer IS NOT NULL
            OR EXISTS (SELECT 1 FROM tlo_eligibility_records er WHERE er.tlo_id = m."TLOid" AND (er.delete_flg != 'Yes' OR er.delete_flg IS NULL))
          )
          AND (
            -- Tab 3: Experience
            EXISTS (SELECT 1 FROM tlo_position_history ph WHERE ph.tlo_id = m."TLOid" AND (ph.delete_flg != 'Yes' OR ph.delete_flg IS NULL))
          )
          AND (
            -- Tab 4: Education
            EXISTS (SELECT 1 FROM tlo_education_records ed WHERE ed.tlo_id = m."TLOid")
          )
          AND (
            -- Tab 5: Performance
            m.performance_rating_1 IS NOT NULL AND m.performance_rating_1 != ''
            AND m.performance_rating_1_period IS NOT NULL AND m.performance_rating_1_period != ''
          )
          AND (
            -- Tab 6: Trainings
            EXISTS (SELECT 1 FROM tlo_training_records tr WHERE tr.tlo_id = m."TLOid" AND (tr.delete_flg != 'Yes' OR tr.delete_flg IS NULL))
          )
          AND (
            -- Tab 7: Achievements
            EXISTS (SELECT 1 FROM tlo_accomplishment_records ar WHERE ar.tlo_id = m."TLOid" AND (ar.delete_flg != 'Yes' OR ar.delete_flg IS NULL))
            OR (m.notable_achievements IS NOT NULL AND m.notable_achievements::text != '[]' AND m.notable_achievements::text != '')
          )
          AND (
            -- Tab 8: Documents
            m.pds_binary_id IS NOT NULL 
            AND m.service_records_binary_id IS NOT NULL
          )
          AND (
            -- Tab 9: Legal
            m.pending_admin_case IS NOT NULL AND m.pending_admin_case != ''
            AND m.guilty_admin_details IS NOT NULL AND m.guilty_admin_details != ''
            AND m.criminally_charged_details IS NOT NULL AND m.criminally_charged_details != ''
            AND m.convicted_crime_details IS NOT NULL AND m.convicted_crime_details != ''
          )
          AND (
            -- Tab 10: Summary
            m.dpa_consented_at IS NOT NULL
          )
        ) AS is_profile_complete,
        (
          CASE WHEN m.first_name IS NULL OR m.first_name = '' OR m.first_name ILIKE '%VACANT%' OR m.status = 'Vacated' THEN NULL
          ELSE (
            (CASE WHEN 
              m.first_name IS NOT NULL AND m.first_name != '' AND
              m.last_name IS NOT NULL AND m.last_name != '' AND
              m.gender IS NOT NULL AND m.gender != '' AND
              m.date_of_birth IS NOT NULL AND
              m.civil_status IS NOT NULL AND m.civil_status != '' AND
              m.photo_binary_id IS NOT NULL AND
              m.employment_status IS NOT NULL AND m.employment_status != '' AND
              m.region IS NOT NULL AND m.region != '' AND
              m.position_title IS NOT NULL AND m.position_title != '' AND
              m.appointment_date IS NOT NULL AND
              (COALESCE(m.is_oic, false) = false OR (m.designation IS NOT NULL AND m.designation != '')) AND
              m.permanent_address IS NOT NULL AND m.permanent_address != '' AND
              ((m.contact_details IS NOT NULL AND m.contact_details != '') OR (m.alt_contact_details_1 IS NOT NULL AND m.alt_contact_details_1 != ''))
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (m.ces_stage IS NOT NULL AND m.ces_stage != '' AND m.ces_stage != 'NOT APPLICABLE') OR
              m.emt_passer IS NOT NULL OR
              EXISTS (SELECT 1 FROM tlo_eligibility_records el WHERE el.source_table = 'masterlist' AND el.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_position_history ph WHERE ph.source_table = 'masterlist' AND ph.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_education_records ed WHERE ed.source_table = 'masterlist' AND ed.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.performance_rating_1 IS NOT NULL AND m.performance_rating_1 != '' AND
              m.performance_rating_1_period IS NOT NULL AND m.performance_rating_1_period != ''
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_training_records tr WHERE tr.source_table = 'masterlist' AND tr.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (m.notable_achievements IS NOT NULL AND jsonb_array_length(CASE WHEN jsonb_typeof(m.notable_achievements) = 'array' THEN m.notable_achievements ELSE '[]'::jsonb END) > 0) OR
              EXISTS (SELECT 1 FROM tlo_accomplishment_records ac WHERE ac.source_table = 'masterlist' AND ac.tlo_id = m."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.pds_binary_id IS NOT NULL AND m.service_records_binary_id IS NOT NULL
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.pending_admin_case IS NOT NULL AND m.pending_admin_case != '' AND (
                (m.guilty_admin_details IS NOT NULL AND m.criminally_charged_details IS NOT NULL AND m.convicted_crime_details IS NOT NULL) OR
                (UPPER(m.pending_admin_case) IN ('NO', 'NONE', 'N/A'))
              )
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              m.dpa_consented_at IS NOT NULL
            THEN 10 ELSE 0 END)
          ) END
        ) AS profile_completion
      FROM third_level_official_masterlist m
      WHERE m.is_testaccount = $1
      ORDER BY m."TLOid" ASC
    `;
    const allRows = await pool.query(allRowsQuery, [isTest]);

    res.json({
      success: true,
      kpis: result.rows[0],
      data: allRows.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLastVacateUpdate = async (req, res) => {
  try {
    const { TLOid } = req.params;
    const isTest = Boolean(req.user?.is_testaccount);
    const officialCheck = await pool.query(
      'SELECT 1 FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2',
      [TLOid, isTest]
    );
    if (officialCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }

    const result = await pool.query(`
      SELECT vacate_reason, remarks 
      FROM third_level_officials_updates 
      WHERE "TLOid" = $1 AND status IN ('Vacating', 'Resigning', 'Inactive', 'Vacated', 'Reassigning', 'Pending Assignment')
      ORDER BY updated_at DESC LIMIT 1
    `, [TLOid]);
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCareerPath = async (req, res) => {
  const { TLOid } = req.params;
  const isTest = Boolean(req.user?.is_testaccount);
  try {
    const officialCheck = await pool.query(
      'SELECT 1 FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2',
      [TLOid, isTest]
    );
    if (officialCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Official not found' });
    }
    const result = await pool.query(`
      SELECT
        u.position_title,
        u.office,
        u.updated_at,
        (
          SELECT CONCAT(prev.first_name, ' ', prev.last_name)
          FROM third_level_officials_updates prev
          WHERE prev.position_title = u.position_title
            AND prev."TLOid" != $1
          ORDER BY prev.updated_at DESC
          LIMIT 1
        ) AS previous_incumbent
      FROM (
        SELECT DISTINCT ON (position_title) position_title, office, updated_at
        FROM third_level_officials_updates
        WHERE "TLOid" = $1 AND position_title IS NOT NULL
        ORDER BY position_title, updated_at DESC
      ) u
      ORDER BY u.updated_at DESC
    `, [TLOid]);
    res.json({ success: true, data: result.rows.map(row => ({ ...row, position_title: displayPositionTitle(row.position_title) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPositionIncumbents = async (req, res) => {
  const { position_title, office } = req.query;

  if (!position_title) {
    return res.status(400).json({ error: 'position_title required' });
  }

  try {
    const isTest = Boolean(req.user?.is_testaccount);
    const isOfficeProvided = office && office !== 'null' && office !== 'undefined' && office !== '';
    const positionTitleVariants = getPositionTitleVariants(position_title);
    const params = isOfficeProvided ? [positionTitleVariants, office, isTest] : [positionTitleVariants, isTest];
    const officeCondition = isOfficeProvided ? 'AND (m_inner.office = $2 OR m_inner.office IS NULL)' : '';
    const officeCondUpdates = isOfficeProvided ? 'AND (u.office = $2 OR u.office IS NULL)' : '';
    const testParamIdx = isOfficeProvided ? '$3' : '$2';

    const query = `
      WITH AllIncumbents AS (
        SELECT 
          0 as id, m_inner."TLOid", m_inner.first_name, m_inner.last_name, m_inner.strand, m_inner.office, 'Current' as remarks, m_inner.updated_at as tenure_date,
          1 as is_current
        FROM third_level_official_masterlist m_inner
        WHERE m_inner.position_title = ANY($1) ${officeCondition}
          AND m_inner.first_name IS NOT NULL AND m_inner.first_name != 'VACANT'
          AND m_inner.is_testaccount = ${testParamIdx}
        
        UNION ALL
        
        SELECT 
          0 as id, u."TLOid", u.first_name, u.last_name, u.strand, u.office, u.remarks, u.updated_at as tenure_date,
          0 as is_current
        FROM third_level_officials_updates u
        JOIN third_level_official_masterlist mu ON mu."TLOid" = u."TLOid" AND mu.is_testaccount = ${testParamIdx}
        WHERE u.position_title = ANY($1) ${officeCondUpdates}
          AND u.first_name IS NOT NULL AND u.first_name != 'VACANT'
      ),
      RankedIncumbents AS (
        SELECT ai.*, m.appointment_date,
          ROW_NUMBER() OVER (PARTITION BY LOWER(ai.first_name), LOWER(ai.last_name) ORDER BY ai.is_current DESC, ai.tenure_date DESC) as rn
        FROM AllIncumbents ai
        LEFT JOIN third_level_official_masterlist m ON ai."TLOid" = m."TLOid" AND m.is_testaccount = ${testParamIdx}
      )
      SELECT * FROM RankedIncumbents
      WHERE rn = 1
      ORDER BY is_current DESC, tenure_date DESC
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getActiveOfficials = async (req, res) => {
  const { exclude_TLOid } = req.query;
  const isTest = Boolean(req.user?.is_testaccount);
  try {
    await ensureOicColumn();
    const params = [isTest];
    let query = `
      SELECT "TLOid", first_name, last_name, position_title, office, strand, email
      FROM third_level_official_masterlist
      WHERE status = 'Active' AND is_testaccount = $1 AND first_name IS NOT NULL AND first_name NOT IN ('VACANT', 'Test1', 'Test2', 'Test3')
    `;
    if (exclude_TLOid) {
      params.push(exclude_TLOid);
      query += ` AND "TLOid" != $${params.length}`;
    }
    query += ` ORDER BY last_name ASC, first_name ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows.map(row => ({ ...row, position_title: displayPositionTitle(row.position_title) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createUnassignedPersonnel = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { first_name, last_name, email, employee_number } = req.body;
  if (!email || !first_name || !last_name) return res.json({ success: false, error: 'Missing required fields' });

  const client = await pool.connect();
  try {
    const isTest = Boolean(req.user?.is_testaccount);
    const masterCheck = await client.query('SELECT 1 FROM third_level_official_masterlist WHERE LOWER(email) = LOWER($1) AND is_testaccount = $2', [email, isTest]);
    const appCheck = await client.query('SELECT 1 FROM third_level_officials_profiling_application WHERE LOWER(email) = LOWER($1) AND is_testaccount = $2', [email, isTest]);
    const userCheck = await client.query('SELECT 1 FROM tlo_users WHERE LOWER(email) = LOWER($1) AND is_testaccount = $2', [email, isTest]);

    if (masterCheck.rows.length > 0 || appCheck.rows.length > 0 || userCheck.rows.length > 0) {
      return res.json({ success: false, error: 'Email already exists. Please use a different email address.' });
    }

    const countRes = await client.query('SELECT COUNT(*) FROM third_level_officials_profiling_application');
    const count = parseInt(countRes.rows[0].count) + 1;
    const appTloId = `APP-2026-${String(count).padStart(4, '0')}`;
    const normalizedEmailInit = email.toLowerCase().trim();

    await client.query('BEGIN');

    // Check if employee_number column exists
    const colsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='third_level_officials_profiling_application'`);
    const cols = colsRes.rows.map(r => r.column_name.toLowerCase());
    const empCol = cols.find(c => c === 'employee_number' || c === 'employee_no' || c === 'emp_no');

    if (empCol && employee_number) {
      await client.query(`
        INSERT INTO third_level_officials_profiling_application (
            application_id, app_TLOid, first_name, last_name, email, "${empCol}", application_status, is_testaccount, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, $5, NULL, $6, NOW(), NOW())
      `, [appTloId, first_name, last_name, normalizedEmailInit, employee_number, isTest]);
    } else {
      await client.query(`
        INSERT INTO third_level_officials_profiling_application (
            application_id, app_TLOid, first_name, last_name, email, application_status, is_testaccount, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, NULL, $5, NOW(), NOW())
      `, [appTloId, first_name, last_name, normalizedEmailInit, isTest]);
    }

    await client.query('COMMIT');
    res.json({ success: true, TLOid: appTloId, message: 'Personnel added successfully', newPersonnel: { TLOid: appTloId, first_name, last_name, email: normalizedEmailInit, employee_number } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
export const registerPersonnel = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const {
    first_name,
    middle_name,
    last_name,
    email,
    position_title,
    strand,
    region,
    office,
    division,
    designation,
    alt_email_1,
    alt_email_2,
    contact_details,
    alt_contact_1,
    alt_contact_2
  } = req.body;

  if (!email || !first_name || !last_name) return res.json({ success: false, error: 'Missing required fields' });

  const client = await pool.connect();
  try {
    const isTest = Boolean(req.user?.is_testaccount);
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@deped.gov.ph')) {
      return res.json({ success: false, error: 'Only @deped.gov.ph emails are allowed for DepEd Email.' });
    }

    const mName = (middle_name || '').trim().toUpperCase();
    const fName = (first_name || '').trim().toUpperCase();
    const upperFirstName = mName ? `${fName} ${mName}` : fName;
    const upperLastName = (last_name || '').trim().toUpperCase();

    const masterCheck = await client.query('SELECT 1 FROM third_level_official_masterlist WHERE LOWER(email) = $1 AND is_testaccount = $2', [normalizedEmail, isTest]);

    if (masterCheck.rows.length > 0) {
      return res.json({ success: false, error: 'Email already exists in the masterlist. Please use a different email address.' });
    }

    await client.query('BEGIN');

    const uidRes = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING("TLOid" FROM 5) AS INTEGER)), 0) AS max_num
      FROM third_level_official_masterlist WHERE "TLOid" ~ '^TLO-[0-9]{4}$'
    `);
    const nextNum = parseInt(uidRes.rows[0].max_num) + 1;
    const tloId = `TLO-${String(nextNum).padStart(4, '0')}`;

    await client.query(`
      INSERT INTO third_level_official_masterlist (
          "TLOid", first_name, last_name, email, position_title, 
          strand, region, office, division, designation, 
          alt_email_1, alt_email_2, contact_details, alt_contact_details_1, alt_contact_details_2,
          status, is_testaccount, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'Active', $16, NOW(), NOW())
    `, [
      tloId, upperFirstName, upperLastName, normalizedEmail, position_title,
      (strand || '').trim(), (region || '').trim(), (office || '').trim(), (division || '').trim(), (designation || '').trim(),
      (alt_email_1 || '').trim(), (alt_email_2 || '').trim(), (contact_details || '').trim(), (alt_contact_1 || '').trim(), (alt_contact_2 || '').trim(),
      isTest
    ]);

    await client.query('COMMIT');
    res.json({ success: true, TLOid: tloId, message: 'Personnel registered successfully', newPersonnel: { TLOid: tloId, first_name: upperFirstName, last_name: upperLastName, email: normalizedEmail, position_title } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getUnassignedPersonnel = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { search } = req.query;
  const isTest = Boolean(req.user?.is_testaccount);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  try {
    await ensureOicColumn();
    const appEmployeeExpr = await getOptionalColumnExpression(
      'third_level_officials_profiling_application',
      'a',
      ['employee_number', 'employee_no', 'emp_no']
    );
    const userEmployeeExpr = await getOptionalColumnExpression(
      'tlo_users',
      'u',
      ['employee_number', 'employee_no', 'emp_no']
    );
    const params = [isTest];
    let query = `
      SELECT DISTINCT ON (LOWER(COALESCE(a.email, u.email)))
        COALESCE(a.app_TLOid, u.uid) AS "TLOid",
        COALESCE(NULLIF(a.first_name, ''), u.first_name) AS first_name,
        COALESCE(NULLIF(a.last_name, ''), u.last_name) AS last_name,
        COALESCE(a.email, u.email) AS email,
        COALESCE(${appEmployeeExpr}, ${userEmployeeExpr}) AS employee_number,
        COALESCE(a.contact_details, u.contact_number) AS contact_details
      FROM tlo_users u
      FULL JOIN third_level_officials_profiling_application a
        ON LOWER(a.email) = LOWER(u.email) AND a.is_testaccount = $1
      WHERE COALESCE(a.email, u.email) IS NOT NULL
        AND (u.is_testaccount = $1 OR u.is_testaccount IS NULL)
        AND (a.is_testaccount = $1 OR a.is_testaccount IS NULL)
        AND NOT EXISTS (
          SELECT 1
          FROM third_level_official_masterlist m
          WHERE LOWER(m.email) = LOWER(COALESCE(a.email, u.email))
            AND m.status = 'Active'
            AND m.is_testaccount = $1
        )
        AND COALESCE(NULLIF(a.first_name, ''), u.first_name) IS NOT NULL
    `;

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        COALESCE(a.first_name, u.first_name) ILIKE $${params.length}
        OR COALESCE(a.last_name, u.last_name) ILIKE $${params.length}
        OR CONCAT_WS(' ', COALESCE(NULLIF(a.first_name, ''), u.first_name), COALESCE(NULLIF(a.last_name, ''), u.last_name)) ILIKE $${params.length}
        OR COALESCE(a.app_TLOid, u.uid) ILIKE $${params.length}
        OR COALESCE(a.email, u.email) ILIKE $${params.length}
        OR COALESCE(${appEmployeeExpr}, ${userEmployeeExpr}) ILIKE $${params.length}
      )`;
    }

    params.push(limit);
    query += ` ORDER BY LOWER(COALESCE(a.email, u.email)), last_name ASC, first_name ASC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const adminAction = async (req, res) => {
  if (req.user.role !== 'Personnel Admin' && req.user.role !== 'Admin' && req.user.role !== 'Super User' && req.user.role !== 'Central Office') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { TLOid, action, justification, effectivityDate, target_TLOid, successor_TLOid, assignee_TLOid, vacateReason } = req.body;
  if (!TLOid || !action) return res.status(400).json({ error: 'TLOid and action are required' });
  const updatedBy = req.user?.email || req.user?.username || req.user?.role || 'SYSTEM_ADMIN';

  let effTs = 'NOW()';
  let isFuture = false;

  if (effectivityDate) {
    const parsedDate = new Date(effectivityDate);
    if (!isNaN(parsedDate.getTime())) {
      effTs = `'${parsedDate.toISOString()}'::timestamp`;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const effDateObj = new Date(parsedDate);
      effDateObj.setHours(0, 0, 0, 0);

      isFuture = effDateObj > today;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureOicColumn(client);

    const isTest = Boolean(req.user?.is_testaccount);
    const currentRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2 FOR UPDATE', [TLOid, isTest]);
    const official = currentRes.rows[0];
    if (!official) throw new Error('Official not found');

    if (action === 'vacate' && (official.first_name === 'VACANT' || official.status === 'Vacated' || official.status === 'Inactive')) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot vacate: Position '${TLOid}' is already vacant.` });
    }

    if (action === 'cancel-vacate') {
      // Path A: Future-dated vacancy cancellation (from 'Resigning' or 'Vacating')
      if (['Vacating', 'Resigning'].includes(official.status)) {
        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Active', updated_at = NOW(), effectivity_date = NULL, reassign_target_tloid = NULL, reassign_assignee_tloid = NULL
          WHERE "TLOid" = $1 AND is_testaccount = $2
        `, [TLOid, isTest]);

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, middle_name, suffix, position_title, office, division, region, strand, email, contact_details, status, remarks, updated_at, effectivity_date, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Active', $13, NOW(), NULL, $14)
        `, [official.TLOid, official.first_name, official.last_name, official.middle_name, official.suffix,
            official.position_title, official.office, official.division, official.region, official.strand,
            official.email, official.contact_details, justification || 'Cancelled scheduled action', updatedBy]);

      } else {
        // Path B: Post-maturity / immediate vacancy cancellation (from 'VACANT' or 'Inactive')
        const explicitActions = await client.query(`
          SELECT "TLOUid", "TLOid", first_name, last_name, middle_name, suffix, email, contact_details, position_title, office, division, region, strand, designation, status, remarks, assignment, effectivity_date, updated_at
          FROM third_level_officials_updates
          WHERE "TLOid" = $1
            AND change_type IS NULL
            AND (status IN ('Vacated', 'Resigning', 'Vacating', 'Inactive') OR remarks ILIKE '%Cancel%')
          ORDER BY "TLOUid" DESC
          LIMIT 2
        `, [TLOid]);

        if (explicitActions.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `No vacancy action found for position '${TLOid}'.` });
        }

        const latestAction = explicitActions.rows[0];

        // Check 1: Must be an uncancelled vacancy
        if (!['Vacated', 'Resigning', 'Vacating', 'Inactive'].includes(latestAction.status)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Position '${TLOid}' does not have an active uncancelled vacancy to cancel.` });
        }

        // Check 2: Must contain recorded assignment ID
        if (!latestAction.assignment || isNaN(parseInt(latestAction.assignment, 10))) {
          await client.query('ROLLBACK');
          return res.status(422).json({ error: `Cannot cancel vacancy: Pre-vacancy assignment reference missing or invalid in audit ledger for '${TLOid}'.` });
        }

        const targetAssignId = parseInt(latestAction.assignment, 10);

        // Check 3: Assignment ID actually exists & lock it
        const targetAssignRes = await client.query(
          `SELECT a.* FROM tlo_assignments a WHERE a.id = $1 FOR UPDATE`,
          [targetAssignId]
        );
        if (targetAssignRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(422).json({ error: `Cannot cancel vacancy: Referenced assignment ID '${targetAssignId}' not found.` });
        }
        const targetAssign = targetAssignRes.rows[0];

        // Check 4: Assignment belongs to canonical human identity set
        const canonicalPersonnelRes = await client.query(`
          SELECT id FROM tlo_masterlist
          WHERE LOWER(tloid) = LOWER($1)
             OR (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND email IS NOT NULL AND email != '')
          UNION
          SELECT id FROM tlo_personnel
          WHERE legacy_tlo_id = $1
             OR (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND email IS NOT NULL AND email != '')
        `, [TLOid, latestAction.email]);
        const allowedPersonnelIds = canonicalPersonnelRes.rows.map(r => r.id);

        if (!allowedPersonnelIds.map(String).includes(String(targetAssign.tlo_masterlist_id)) && String(targetAssign.tlo_masterlist_id) !== String(TLOid)) {
          await client.query('ROLLBACK');
          return res.status(422).json({ error: `Cannot cancel vacancy: Referenced assignment does not belong to the original official.` });
        }

        // Check 5: Assignment item_number matches occupied item
        const occupiedItemNumber = targetAssign.tlo_position_id || targetAssign.item_number;

        // Check 6: Assignment is currently Inactive
        if (targetAssign.status !== 'Inactive') {
          await client.query('ROLLBACK');
          return res.status(422).json({ error: `Cannot cancel vacancy: Referenced assignment '${targetAssignId}' is not currently Inactive.` });
        }

        // Check 7: Masterlist is in an appropriate vacancy state
        const isVacantState = !official.first_name || official.first_name.trim().toUpperCase() === 'VACANT' || ['VACATED', 'INACTIVE', 'VACANT'].includes((official.status || '').toUpperCase());
        if (!isVacantState) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: `Cannot cancel vacancy: Masterlist for '${TLOid}' is not in a vacant state.` });
        }

        // Check 8: Concurrency Guard - verify no genuinely different official occupies occupiedItemNumber
        const externalOccupantAssign = await client.query(`
          SELECT a.id, a.tlo_masterlist_id, a.tlo_position_id
          FROM tlo_assignments a
          LEFT JOIN tlo_masterlist tm ON tm.id = a.tlo_masterlist_id
          WHERE a.tlo_position_id = $1
            AND a.status = 'Active'
            AND a.end_date IS NULL
            AND a.tlo_masterlist_id IS NOT NULL
            AND (tm.tloid IS NULL OR tm.tloid != $2)
        `, [occupiedItemNumber, TLOid]);

        const externalOccupantMasterlist = await client.query(`
          SELECT "TLOid", first_name, last_name, email
          FROM third_level_official_masterlist
          WHERE "TLOid" = $1
            AND is_testaccount = $2
            AND first_name IS NOT NULL
            AND first_name != ''
            AND first_name NOT ILIKE '%VACANT%'
            AND "TLOid" != $3
            AND LOWER(TRIM(COALESCE(email, ''))) != LOWER(TRIM($4))
        `, [occupiedItemNumber, isTest, TLOid, latestAction.email]);

        if (externalOccupantAssign.rows.length > 0 || externalOccupantMasterlist.rows.length > 0) {
          await client.query('ROLLBACK');
          const occName = externalOccupantMasterlist.rows[0] ? `${externalOccupantMasterlist.rows[0].first_name} ${externalOccupantMasterlist.rows[0].last_name}` : 'another official';
          return res.status(409).json({ error: `Cannot cancel vacancy: Position '${occupiedItemNumber}' is currently occupied by ${occName}. The current occupant must be vacated or reassigned before this vacancy can be cancelled.` });
        }

        // All 8 checks passed! Reactivate exact assignment by PK:
        await client.query(`
          UPDATE tlo_assignments
          SET status = 'Active', end_date = NULL, updated_at = NOW()
          WHERE id = $1
        `, [targetAssignId]);

        // Restore masterlist with pre-vacancy snapshot from audit row:
        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = $1,
              last_name = $2,
              middle_name = $3,
              suffix = $4,
              email = $5,
              contact_details = COALESCE($6, contact_details),
              status = 'Active',
              effectivity_date = NULL,
              updated_at = NOW(),
              reassign_target_tloid = NULL,
              reassign_assignee_tloid = NULL
          WHERE "TLOid" = $7 AND is_testaccount = $8
        `, [latestAction.first_name, latestAction.last_name, latestAction.middle_name, latestAction.suffix,
            latestAction.email, latestAction.contact_details, TLOid, isTest]);

        // Insert cancellation audit record:
        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, middle_name, suffix, position_title, office, division, region, strand, email, contact_details, status, remarks, assignment, updated_at, effectivity_date, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Active', $13, $14, NOW(), NULL, $15)
        `, [TLOid, latestAction.first_name, latestAction.last_name, latestAction.middle_name, latestAction.suffix,
            latestAction.position_title, latestAction.office, latestAction.division, latestAction.region, latestAction.strand,
            latestAction.email, latestAction.contact_details, justification || 'Cancelled vacancy / resignation', targetAssignId.toString(), updatedBy]);
      }

    } else if (action === 'vacate') {
      if (isFuture) {
        const futureStatus = vacateReason === 'Resignation' ? 'Resigning' : 'Vacating';
        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = $1, updated_at = NOW(), effectivity_date = ${effTs}
          WHERE "TLOid" = $2 AND is_testaccount = $3
        `, [futureStatus, TLOid, isTest]);

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, middle_name, suffix, position_title, office, strand, email, contact_details, status, remarks, updated_at, effectivity_date, vacate_reason, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), ${effTs}, $13, $14)
        `, [official.TLOid, official.first_name, official.last_name, official.middle_name, official.suffix,
            official.position_title, official.office, official.strand, official.email, official.contact_details,
            futureStatus, justification || (vacateReason || 'Administrative action'), vacateReason || null, updatedBy]);

      } else {
        // Immediate Vacancy / Resignation
        // 1. Resolve canonical personnel_id
        const pRes = await client.query(`
          SELECT id FROM tlo_personnel
          WHERE legacy_tlo_id = $1
             OR (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND email IS NOT NULL AND email != '')
          ORDER BY CASE WHEN legacy_tlo_id = $1 THEN 0 ELSE 1 END, id ASC
          LIMIT 1
        `, [official.TLOid, official.email]);
        const personId = pRes.rows[0]?.id;
        const mRes = await client.query('SELECT id FROM tlo_masterlist WHERE LOWER(tloid) = LOWER($1) LIMIT 1', [official.TLOid]);
        const numericMasterlistId = mRes.rows.length > 0 ? mRes.rows[0].id : null;

        let activeAssignmentId = null;

        // 2. Resolve authoritative active assignment and lock it
        const aRes = await client.query(`
          SELECT a.id, a.tlo_position_id, a.status
          FROM tlo_assignments a
          LEFT JOIN tlo_masterlist tm ON tm.id = a.tlo_masterlist_id
          WHERE (tm.tloid = $1 OR a.tlo_position_id = $1)
            AND a.status = 'Active'
            AND a.end_date IS NULL
          ORDER BY a.id DESC
          LIMIT 1
          FOR UPDATE
        `, [official.TLOid]);

        if (aRes.rows.length > 0) {
          activeAssignmentId = aRes.rows[0].id;

          // Deactivate authoritative assignment strictly by locked PK
          await client.query(`
            UPDATE tlo_assignments
            SET status = 'Inactive', end_date = ${effTs}, updated_at = NOW()
            WHERE id = $1
          `, [activeAssignmentId]);

          const vacatedItemId = aRes.rows[0]?.tlo_position_id;
          const vacatedPosId = aRes.rows[0]?.position_id;
          if (vacatedItemId) {
            const vCheck = await client.query(
              `SELECT id FROM tlo_assignments WHERE tlo_position_id = $1 AND tlo_masterlist_id IS NULL LIMIT 1`,
              [vacatedItemId]
            );
            if (vCheck.rowCount === 0) {
              await client.query(`
                INSERT INTO tlo_assignments (
                  tlo_position_id, position_id, tlo_masterlist_id,
                  status, capacity, start_date, created_at, updated_at
                ) VALUES ($1, $2, NULL, 'Inactive', 'Full', ${effTs}, NOW(), NOW())
              `, [vacatedItemId, vacatedPosId]);
            }
          }
        }

        const isResignOrRetire = /^(resign|retire)/i.test(vacateReason || '');
        const targetStatus = isResignOrRetire ? 'Inactive' : 'Vacated';

        // 3. Update masterlist to established vacancy convention
        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = 'VACANT',
              last_name = '',
              email = NULL,
              status = $1,
              updated_at = NOW(),
              effectivity_date = ${effTs}
          WHERE "TLOid" = $2 AND is_testaccount = $3
        `, [targetStatus, TLOid, isTest]);

        // 4. Record audit ledger with exact assignment ID (keeping "TLOid" = official.TLOid!)
        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, middle_name, suffix, position_title, office, division, region, strand, email, contact_details, status, remarks, assignment, updated_at, effectivity_date, vacate_reason, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), ${effTs}, $16, $17)
        `, [official.TLOid, official.first_name, official.last_name, official.middle_name, official.suffix,
            official.position_title, official.office, official.division, official.region, official.strand,
            official.email, official.contact_details, targetStatus, justification || (vacateReason || 'Administrative action'),
            activeAssignmentId ? activeAssignmentId.toString() : null, vacateReason || null, updatedBy]);
      }

    } else if (action === 'succeed') {
      if (successor_TLOid) {
        const successorRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1 AND is_testaccount = $2', [successor_TLOid, isTest]);
        const successor = successorRes.rows[0];
        if (!successor) throw new Error('Successor not found in masterlist');

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Vacated', $8, NOW(), ${effTs}, $9)
        `, [successor_TLOid, successor.first_name, successor.last_name, successor.position_title,
          successor.office, successor.strand, successor.email, `Succeeding ${official.first_name} ${official.last_name}`, null]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL,
              updated_at = NOW(), effectivity_date = ${effTs}
          WHERE "TLOid" = $1 AND is_testaccount = $2
        `, [successor_TLOid, isTest]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = $1, last_name = $2, email = $3, status = 'Active', updated_at = NOW(), effectivity_date = ${effTs}
          WHERE "TLOid" = $4 AND is_testaccount = $5
        `, [successor.first_name, successor.last_name, successor.email, TLOid, isTest]);

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), ${effTs}, $9)
        `, [TLOid, successor.first_name, successor.last_name, official.position_title,
          official.office, official.strand, successor.email, `Succession from ${successor.position_title}`, null]);
      } else {
        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Succeeded', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW(), effectivity_date = ${effTs}
          WHERE "TLOid" = $1 AND is_testaccount = $2
        `, [TLOid, isTest]);
      }

    } else if (action === 'reassign') {
      if (isFuture) {
        if (assignee_TLOid) {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Pending Assignment', updated_at = NOW(), effectivity_date = ${effTs}, reassign_assignee_tloid = $2
            WHERE "TLOid" = $1 AND is_testaccount = $3
          `, [TLOid, assignee_TLOid, isTest]);

          await client.query(`
            INSERT INTO third_level_officials_updates
              ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending Assignment', $8, NOW(), ${effTs})
          `, [TLOid, official.first_name, official.last_name, official.position_title, official.office, official.strand, official.email, justification || null]);

        } else if (target_TLOid) {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Reassigning', updated_at = NOW(), effectivity_date = ${effTs}, reassign_target_tloid = $2
            WHERE "TLOid" = $1 AND is_testaccount = $3
          `, [TLOid, target_TLOid, isTest]);

          await client.query(`
            INSERT INTO third_level_officials_updates
              ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Reassigning', $8, NOW(), ${effTs})
          `, [TLOid, official.first_name, official.last_name, official.position_title, official.office, official.strand, official.email, justification || null]);
        }
      } else {
        await executeReassignment(client, official, effTs, justification, assignee_TLOid, target_TLOid);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getNotableAchievements = async (req, res) => {
  try {
    const result = await pool.query('SELECT achievement FROM notable_achievements WHERE delete_flg = 0 ORDER BY index_number ASC');
    res.json({ success: true, data: result.rows.map(r => r.achievement) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const toggleTestAccount = async (req, res) => {
  const allowedRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { TLOid, is_testaccount } = req.body;
  if (!TLOid) {
    return res.status(400).json({ error: 'TLOid is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const boolVal = Boolean(is_testaccount);
    const result = await client.query(
      `UPDATE third_level_official_masterlist 
       SET is_testaccount = $1, updated_at = NOW() 
       WHERE "TLOid" = $2 
       RETURNING "TLOid", email, is_testaccount`,
      [boolVal, TLOid]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Official record not found' });
    }

    const official = result.rows[0];
    if (official.email) {
      await client.query(
        'UPDATE tlo_users SET is_testaccount = $1 WHERE LOWER(email) = LOWER($2)',
        [boolVal, official.email]
      );
      await client.query(
        'UPDATE tlo_personnel SET is_testaccount = $1 WHERE LOWER(email) = LOWER($2)',
        [boolVal, official.email]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Official ${TLOid} and linked user accounts updated to is_testaccount = ${boolVal}`,
      data: official
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error toggling test account:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

