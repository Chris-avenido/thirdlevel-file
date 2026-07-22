
import pool from '../config/db.js';
import { upsertBinary } from '../utils/binaryPipeline.js';

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

const displayPositionTitle = (positionTitle) => (
  POSITION_TITLE_DISPLAY[positionTitle] || positionTitle
);

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

    const checkRes = await client.query(
      'SELECT application_id, app_TLOid FROM third_level_officials_profiling_application WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'Record already initialized', TLOid: checkRes.rows[0].app_TLOid });
    }

    const countRes = await client.query('SELECT COUNT(*) FROM third_level_officials_profiling_application');
    const count = parseInt(countRes.rows[0].count) + 1;
    const appTloId = `APP-2026-${String(count).padStart(4, '0')}`;
    const normalizedEmailInit = email.toLowerCase().trim();

    let finalFirstName = first_name;
    let finalLastName = last_name;

    if (!finalFirstName || !finalLastName) {
      const masterCheck = await client.query('SELECT first_name, last_name FROM third_level_official_masterlist WHERE LOWER(email) = $1', [normalizedEmailInit]);
      if (masterCheck.rows.length > 0) {
        finalFirstName = finalFirstName || masterCheck.rows[0].first_name;
        finalLastName = finalLastName || masterCheck.rows[0].last_name;
      }
    }

    await client.query(`
      INSERT INTO third_level_officials_profiling_application (
          application_id, app_TLOid, first_name, last_name, email, application_status, created_at, updated_at
      ) VALUES (DEFAULT, $1, $2, $3, $4, NULL, NOW(), NOW())
    `, [appTloId, finalFirstName || '', finalLastName || '', normalizedEmailInit]);

    await client.query('COMMIT');
    res.json({ success: true, TLOid: appTloId });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Initialization failed: ' + err.message });
  } finally {
    if (client) client.release();
  }
};

export const getByEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });
  try {
    const masterRes = await pool.query(`
      SELECT * FROM third_level_official_masterlist
      WHERE LOWER(email) = LOWER($1) AND status != 'Inactive'
      LIMIT 1
    `, [email]);

    if (masterRes.rows.length > 0) {
      const row = masterRes.rows[0];
      const normalized = sanitizeOicPosition(row.position_title, row.is_oic);
      row.position_title = normalized.position_title;
      row.is_oic = normalized.is_oic;
      if (Array.isArray(row.eligibilities)) {
        row.eligibilities = row.eligibilities.map(e => {
          if (typeof e === 'string') return { eligibility: e.toUpperCase(), date: null, rating: null, place_of_assignment: null };
          return e;
        });
      }
      return res.json({ success: true, data: row, source: 'masterlist' });
    }

    const stagingRes = await pool.query(`
      SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application
      WHERE LOWER(email) = LOWER($1) AND application_status IS DISTINCT FROM 'approved'
      ORDER BY created_at DESC LIMIT 1
    `, [email]);

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
      return res.json({ success: true, data: row, source: 'staging' });
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
      'executive_summary': 'executive_summary_binary_id'
    };

    const columnName = docMap[docType];
    if (!columnName) throw new Error('Invalid document type');

    if (isMasterlist) {
      await client.query(
        `UPDATE third_level_official_masterlist SET ${columnName} = $1, updated_at = NOW() WHERE "TLOid" = $2`,
        [binary_id, TLOid]
      );
    } else {
      await client.query(
        `UPDATE third_level_officials_profiling_application SET ${columnName} = $1, updated_at = NOW() WHERE app_TLOid = $2`,
        [binary_id, TLOid]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, binary_id, message: `${docType} uploaded successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const getProfile = async (req, res) => {
  const { TLOid } = req.params;
  const isMasterlist = !TLOid.startsWith('APP-') && !(TLOid.startsWith('TLO-') && TLOid.split('-').length > 2);
  try {
    await ensureOicColumn();
    let result;
    if (isMasterlist) {
      result = await pool.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [TLOid]);
    } else {
      result = await pool.query('SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application WHERE app_TLOid = $1', [TLOid]);
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const row = result.rows[0];
    const normalized = sanitizeOicPosition(row.position_title, row.is_oic);
    row.position_title = normalized.position_title;
    row.is_oic = normalized.is_oic;
    res.json({ success: true, data: row });
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
    validateYear(req.body.notable_achievements_year, currentYear);
    validateYear(req.body.bachelor_year, currentYear);
    validateYear(req.body.master_year, currentYear);
    validateYear(req.body.doctorate_year, currentYear);

    if (req.body.bachelor_year && req.body.master_year && parseInt(req.body.master_year) <= parseInt(req.body.bachelor_year)) {
      throw new Error("Master's year must be greater than Bachelor's year");
    }
    if (req.body.master_year && req.body.doctorate_year && parseInt(req.body.doctorate_year) <= parseInt(req.body.master_year)) {
      throw new Error("Doctorate year must be greater than Master's year");
    }

    if (req.body.performance_rating_3_period && req.body.performance_rating_2_period && parseInt(req.body.performance_rating_2_period) < parseInt(req.body.performance_rating_3_period)) {
       throw new Error("Previous rating period must be >= Oldest rating period");
    }
    if (req.body.performance_rating_2_period && req.body.performance_rating_1_period && parseInt(req.body.performance_rating_1_period) < parseInt(req.body.performance_rating_2_period)) {
       throw new Error("Latest rating period must be >= Previous rating period");
    }
    if (req.body.cespes_rating_1_period && req.body.cespes_rating_2_period && parseInt(req.body.cespes_rating_2_period) < parseInt(req.body.cespes_rating_1_period)) {
       throw new Error("CESPES 2nd sem year must be >= 1st sem year");
    }

    if (req.body.previous_positions && Array.isArray(req.body.previous_positions)) {
      req.body.previous_positions.forEach(p => {
        if (p.start_date && p.end_date && new Date(p.end_date) <= new Date(p.start_date)) {
           throw new Error("End date must be after start date for previous positions");
        }
      });
    }
    if (req.body.relevant_trainings && Array.isArray(req.body.relevant_trainings)) {
      req.body.relevant_trainings.forEach(t => {
        if (t.date_from && t.date_to && new Date(t.date_to) <= new Date(t.date_from)) {
           throw new Error("End date must be after start date for trainings");
        }
      });
    }

    // Validate date ranges
    const validateDateRange = (from, to, context) => {
      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (toDate <= fromDate) {
          throw new Error(`Invalid date range in ${context}: TO date must be strictly after FROM date.`);
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
      'strand', 'division', 'office', 'email', 'alt_email_1', 'alt_email_2', 'contact_details', 'alt_contact_details_1', 'alt_contact_details_2',
      'last_name', 'first_name', 'middle_name', 'suffix', 'gender', 'date_of_birth', 'civil_status',
      'position_title', 'designation', 'appointment_date', 'emt_passer', 'emt_date', 'ces_stage', 'ces_conferment_date', 'age',
      'total_years_third_level', 'managerial_experience_total', 'permanent_address', 'temporary_address', 'highest_education', 'specific_degree', 'education_program', 'education_year_graduated',
      'bachelor_degree', 'bachelor_year', 'master_degree', 'master_year', 'doctorate_degree', 'doctorate_year',
      'relevant_trainings', 'notable_achievements', 'notable_achievements_year', 'eligibilities', 'individual_accomplishments', 'total_training_hours',
      'performance_rating_1', 'performance_rating_1_period', 'performance_rating_2', 'performance_rating_2_period', 'performance_rating_3', 'performance_rating_3_period',
      'cespes_1_rating', 'cespes_2_rating', 'cespes_rating_1_period', 'cespes_rating_2_period',
      'performance_rating_ipcrf', 'performance_rating_cespes',
      'previous_positions', 'is_oic', 'unique_number', 'employment_status',
      'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
      'sandiganbayan_clearance_binary_id', 'nbi_clearance_binary_id', 'csc_clearance_binary_id', 'ombudsman_clearance_binary_id', 'executive_summary_binary_id',
      'pending_admin_case', 'guilty_admin_details', 'criminally_charged_details', 'convicted_crime_details', 'dpa_consented_at', 'profiling_status', 'target_TLOid', 'application_status', 'position_applied_for',
      'other_courses'
    ];

    const JSONB_FIELDS = new Set(['previous_positions', 'relevant_trainings', 'individual_accomplishments', 'eligibilities', 'other_courses']);
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
      'target_tloid', 'application_status', 'profiling_status'
    ]);

    const toUpper = (val) => {
      if (typeof val === 'string') return val.toUpperCase();
      return val;
    };

    allFields.forEach(f => {
      if (req.body[f] !== undefined && validCols.has(f.toLowerCase())) {
        let val = req.body[f] === '' ? null : req.body[f];
        
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
      values.push(new Date(), TLOid);

      if (isMasterlist && req.user?.email) {
        await client.query(`SET LOCAL "app.current_user" = '${req.user.email.replace(/'/g, "''")}'`);
      }

      await client.query(
        `UPDATE ${table} SET ${updates.join(', ')}, updated_at = $${values.length - 1} WHERE ${idCol} = $${values.length}`,
        values
      );
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

export const submitApplication = async (req, res) => {
  const { target_TLOid } = req.body;
  const userEmail = req.user.email;

  if (!userEmail) return res.status(401).json({ error: 'Authentication error' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE third_level_officials_profiling_application
      SET application_status = 'applied', "target_TLOid" = $1, submitted_at = NOW(), updated_at = NOW()
      WHERE LOWER(email) = LOWER($2) AND application_status IS DISTINCT FROM 'approved'
    `, [target_TLOid || null, userEmail]);

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
  try {
    const posResult = await pool.query(`
      SELECT DISTINCT position_title 
      FROM third_level_official_masterlist 
      WHERE position_title IS NOT NULL 
        AND position_title != '' 
        AND position_title NOT ILIKE 'N/A'
      ORDER BY position_title
    `);
    const desigResult = await pool.query(`
      SELECT DISTINCT designation 
      FROM third_level_official_masterlist 
      WHERE designation IS NOT NULL 
        AND designation != '' 
        AND designation NOT ILIKE 'N/A'
      ORDER BY designation
    `);
    res.json({
      success: true,
      positions: posResult.rows.map(r => displayPositionTitle(r.position_title)),
      designations: desigResult.rows.map(r => displayPositionTitle(r.designation))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVacancies = async (req, res) => {
  try {
    await ensureOicColumn();
    const result = await pool.query(`
      SELECT "TLOid", position_title, office, strand, first_name, last_name, status, is_oic, updated_at
      FROM third_level_official_masterlist 
      WHERE first_name ILIKE '%VACANT%' OR status = 'Vacant'
      ORDER BY strand, office, position_title
    `);
    res.json({ success: true, data: result.rows.map(row => ({ ...row, position_title: displayPositionTitle(row.position_title) })) });
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
    const { search, strand, position } = req.query;
    let query = `
      WITH ActivePositions AS (
        SELECT LOWER(email) as low_email, position_title, office
        FROM third_level_official_masterlist
        WHERE status = 'Active' AND email IS NOT NULL AND email != ''
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
      LEFT JOIN third_level_official_masterlist m ON LOWER(a.email) = LOWER(m.email)
      LEFT JOIN third_level_official_masterlist v ON a."target_TLOid" = v."TLOid"
      WHERE a.application_status = 'applied'
    `;
    const params = [];

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
  try {
    await client.query('BEGIN');
    await ensureOicColumn(client);

    if (action === 'reject') {
      await client.query(`
        UPDATE third_level_officials_profiling_application 
        SET application_status = 'disapproved', denial_reason = $1, updated_at = NOW() 
        WHERE app_TLOid = $2
      `, [denial_reason || 'No reason provided', app_TLOid]);
    } else if (action === 'approve') {
      const appRes = await client.query('SELECT * FROM third_level_officials_profiling_application WHERE app_TLOid = $1', [app_TLOid]);
      const applicant = appRes.rows[0];
      if (!applicant) throw new Error('Applicant not found');
      if (!applicant.target_TLOid) throw new Error('No target vacancy associated with this application');

      const masterlistColsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'third_level_official_masterlist'
      `);
      const masterlistCols = new Set(masterlistColsRes.rows.map(r => r.column_name.toLowerCase()));

      const JSONB_FIELDS = new Set(['previous_positions', 'relevant_trainings']);
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

      values.push('Active', applicant.target_TLOid);

      await client.query(`
        UPDATE third_level_official_masterlist 
        SET ${sets.join(', ')}, status = $${values.length - 1}, updated_at = NOW()
        WHERE "TLOid" = $${values.length}
      `, values);

      await client.query(`
        UPDATE third_level_officials_profiling_application 
        SET application_status = 'approved', updated_at = NOW() 
        WHERE app_TLOid = $1
      `, [app_TLOid]);

      await client.query(`
        UPDATE tlo_users SET role = 'Third Level Official' WHERE LOWER(email) = $1 AND role = 'Third Level Applicant'
      `, [applicant.email.toLowerCase().trim()]);
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
      WHERE "TLOid" = $5
    `, [assignee.first_name, assignee.last_name, assignee.email, assignee.contact_details, TLOid]);

    await client.query(`
      INSERT INTO third_level_officials_updates
        ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), ${effTs}, $9)
    `, [TLOid, assignee.first_name, assignee.last_name, official.position_title,
      official.office, official.strand, assignee.email, justification || 'Assigned through reassignment', null]);
  } else if (target_TLOid) {
    const targetRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [target_TLOid]);
    const targetSlot = targetRes.rows[0];

    if (targetSlot && targetSlot.first_name && targetSlot.first_name !== 'VACANT') {
      await client.query(`
      INSERT INTO third_level_officials_updates
        ("TLOid", first_name, last_name, position_title, office, strand, email, status, updated_at, effectivity_date, vacate_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Vacated', NOW(), ${effTs}, $8)
    `, [target_TLOid, targetSlot.first_name, targetSlot.last_name, targetSlot.position_title,
        targetSlot.office, targetSlot.strand, targetSlot.email, null]);
    }

    await client.query(`
    UPDATE third_level_official_masterlist
    SET first_name = $1, last_name = $2, email = $3, contact_details = $4,
        status = 'Active', updated_at = NOW(), effectivity_date = ${effTs}
    WHERE "TLOid" = $5
  `, [official.first_name, official.last_name, official.email, official.contact_details, target_TLOid]);

    await client.query(`
    INSERT INTO third_level_officials_updates
      ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW(), ${effTs}, $9)
  `, [target_TLOid, official.first_name, official.last_name,
      targetSlot?.position_title || official.position_title,
      targetSlot?.office || official.office,
      targetSlot?.strand || official.strand, official.email, justification || `Reassigned from ${official.position_title}`, null]);

    await client.query(`
    UPDATE third_level_official_masterlist
    SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW(), effectivity_date = ${effTs}
    WHERE "TLOid" = $1
  `, [TLOid]);
  } else {
    await client.query(`
    UPDATE third_level_official_masterlist
    SET updated_at = NOW(), effectivity_date = ${effTs}
    WHERE "TLOid" = $1
  `, [TLOid]);
  }
};

let isProcessingVacancies = false;
let lastProcessTime = 0;

export const processScheduledVacancies = async (client) => {
  const now = Date.now();
  if (isProcessingVacancies || now - lastProcessTime < 60000) return; // Only run once per minute

  isProcessingVacancies = true;
  lastProcessTime = now;

  try {
    await client.query(`
      UPDATE third_level_official_masterlist
      SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW()
      WHERE status = 'Vacating' AND effectivity_date <= NOW()
    `);
    await client.query(`
      UPDATE third_level_official_masterlist
      SET status = 'Inactive', updated_at = NOW()
      WHERE status = 'Resigning' AND effectivity_date <= NOW()
    `);

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

export const getOfficials = async (req, res) => {
  const allowedRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office', 'RO HRMO', 'SDO HRMO'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
  }

  processScheduledVacancies(pool).catch(err => console.error('Background process error:', err));

  const { search, status, strand, category, position, designation, office, page, limit, sortColumn, sortDirection, is_oic, region, division, name, position_title, level } = req.query;
  let query = `
    WITH RankedOfficials AS (
      SELECT 
        m."TLOid", m.first_name, m.last_name, m.email, m.position_title, m.office, m.strand, m.region, m.division, m.status, m.is_oic, m.designation, m.contact_details, m.effectivity_date, m.reassign_assignee_tloid, m.reassign_target_tloid, m.created_at, m.updated_at, m.photo_binary_id, m.pds_binary_id, m.pending_admin_case, m.date_of_birth,
        (SELECT vacate_reason FROM third_level_officials_updates u WHERE u."TLOid" = m."TLOid" AND u.vacate_reason IS NOT NULL ORDER BY updated_at DESC LIMIT 1) as vacate_reason,
        (SELECT CONCAT_WS(' ', u.first_name, u.last_name) FROM third_level_officials_updates u WHERE u."TLOid" = m."TLOid" AND u.first_name IS NOT NULL AND u.first_name != 'VACANT' AND u.status != 'Vacated' ORDER BY updated_at DESC LIMIT 1) as previous_incumbent,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN m.first_name IS NULL OR m.first_name = 'VACANT' THEN m."TLOid" ELSE LOWER(m.email) END 
          ORDER BY m."TLOid" ASC
        ) as rn
      FROM third_level_official_masterlist m
  `;
  const params = [];
  const conditions = [];

  try {
    await ensureOicColumn();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const userRole = req.user.role;
  const isRO = userRole === 'Regional Office' || userRole === 'RO_HRMO' || userRole === 'RO HRMO';
  const isSDO = userRole === 'School Division Office' || userRole === 'SDO_HRMO' || userRole === 'SDO HRMO';

  const targetRegion = req.user.assigned_region || req.user.region;
  const targetDivision = req.user.assigned_division || req.user.division;

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
    conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length} OR position_title ILIKE $${params.length} OR office ILIKE $${params.length} OR strand ILIKE $${params.length})`);
  }

  const filterStatus = Array.isArray(status) ? status[status.length - 1] : status;
  if (filterStatus && filterStatus !== 'All' && filterStatus !== 'Legacy') {
    if (filterStatus === 'Vacant') {
      conditions.push(`(status = 'Vacated' OR status = 'Vacant' OR first_name IS NULL OR first_name = '')`);
    } else {
      params.push(filterStatus);
      conditions.push(`status = $${params.length}`);
    }
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
      conditions.push(`position_title = $${params.length}`);
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

  if (category === 'Third Level') {
    params.push(THIRD_LEVEL_POSITIONS);
    conditions.push(`position_title = ANY($${params.length}) AND NOT (COALESCE(is_oic, FALSE) = TRUE OR designation ILIKE '%OIC%')`);
  } else if (category === 'Third Level (OIC)') {
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
  }

  if (is_oic === 'true') {
    conditions.push(`COALESCE(is_oic, FALSE) = TRUE`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` 
    ), ActivePositions AS (
      SELECT LOWER(email) as low_email, "TLOid", position_title, office
      FROM third_level_official_masterlist
      WHERE status = 'Active' AND email IS NOT NULL AND email != ''
    )
    SELECT 
      f.*,
      COUNT(*) OVER() AS total_count,
      (
         SELECT string_agg(t2.position_title || ' (' || COALESCE(t2.office, '') || ')', ' | ')
         FROM ActivePositions t2 
         WHERE t2.low_email = LOWER(f.email)
           AND t2."TLOid" != f."TLOid" 
      ) as concurrent_positions
    FROM RankedOfficials f 
    WHERE f.rn = 1 
  `;

  // Server-side sorting
  const sortMap = {
    'status': 'f.status',
    'office': 'f.office',
    'position_title': 'f.position_title',
    'first_name': 'f.first_name',
    'name': 'f.last_name',
    'region': 'f.strand',
    'division': 'f.office',
    'designation': 'f.designation'
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
    // DEBUG: Check if payload actually contains the binary IDs
    const sample = result.rows.find(r => r.photo_binary_id);
    console.log('DEBUG getOfficials - Sample row photo:', sample ? sample.photo_binary_id : 'NO PHOTO ID FOUND IN ANY ROW');
    console.log('DEBUG getOfficials - Total rows:', result.rows.length);

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
    const result = await pool.query(`
      WITH RankedOfficials AS (
        SELECT m.status, m.is_oic, m.position_title, m.first_name, m.last_name, m.email, m.office, m.strand, m.region, m.division, m.designation, m.effectivity_date,
          m.date_of_birth, m.created_at, m.updated_at, m."TLOid",
          m.photo_binary_id, m.pds_binary_id, m.contact_details, m.pending_admin_case,
          (SELECT vacate_reason FROM third_level_officials_updates u WHERE u."TLOid" = m."TLOid" AND u.vacate_reason IS NOT NULL ORDER BY updated_at DESC LIMIT 1) as vacate_reason,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN m.first_name IS NULL OR m.first_name = 'VACANT' THEN m."TLOid" ELSE LOWER(m.email) END 
            ORDER BY m."TLOid" ASC
          ) as rn
        FROM third_level_official_masterlist m
      )
      SELECT status, is_oic, position_title, first_name, last_name, email, office, strand, region, division, designation, effectivity_date, date_of_birth, created_at, updated_at, "TLOid", vacate_reason, photo_binary_id, pds_binary_id, contact_details, pending_admin_case
      FROM RankedOfficials 
      WHERE rn = 1
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLastVacateUpdate = async (req, res) => {
  try {
    const { TLOid } = req.params;
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
  try {
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
    const isOfficeProvided = office && office !== 'null' && office !== 'undefined' && office !== '';
    const positionTitleVariants = getPositionTitleVariants(position_title);
    const params = isOfficeProvided ? [positionTitleVariants, office] : [positionTitleVariants];
    const officeCondition = isOfficeProvided ? 'AND (office = $2 OR office IS NULL)' : '';

    const query = `
      WITH AllIncumbents AS (
        SELECT 
          0 as id, "TLOid", first_name, last_name, strand, office, 'Current' as remarks, updated_at as tenure_date,
          1 as is_current
        FROM third_level_official_masterlist
        WHERE position_title = ANY($1) ${officeCondition}
          AND first_name IS NOT NULL AND first_name != 'VACANT'
        
        UNION ALL
        
        SELECT 
          0 as id, u."TLOid", u.first_name, u.last_name, u.strand, u.office, u.remarks, u.updated_at as tenure_date,
          0 as is_current
        FROM third_level_officials_updates u
        WHERE u.position_title = ANY($1) ${officeCondition}
          AND u.first_name IS NOT NULL AND u.first_name != 'VACANT'
      ),
      RankedIncumbents AS (
        SELECT ai.*, m.appointment_date,
          ROW_NUMBER() OVER (PARTITION BY LOWER(ai.first_name), LOWER(ai.last_name) ORDER BY ai.is_current DESC, ai.tenure_date DESC) as rn
        FROM AllIncumbents ai
        LEFT JOIN third_level_official_masterlist m ON ai."TLOid" = m."TLOid"
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
  try {
    await ensureOicColumn();
    const params = [];
    let query = `
      SELECT "TLOid", first_name, last_name, position_title, office, strand, email
      FROM third_level_official_masterlist
      WHERE status = 'Active' AND first_name IS NOT NULL AND first_name NOT IN ('VACANT', 'Test1', 'Test2', 'Test3')
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
    const masterCheck = await client.query('SELECT 1 FROM third_level_official_masterlist WHERE LOWER(email) = LOWER($1)', [email]);
    const appCheck = await client.query('SELECT 1 FROM third_level_officials_profiling_application WHERE LOWER(email) = LOWER($1)', [email]);
    const userCheck = await client.query('SELECT 1 FROM tlo_users WHERE LOWER(email) = LOWER($1)', [email]);

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
            application_id, app_TLOid, first_name, last_name, email, "${empCol}", application_status, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, $5, NULL, NOW(), NOW())
      `, [appTloId, first_name, last_name, normalizedEmailInit, employee_number]);
    } else {
      await client.query(`
        INSERT INTO third_level_officials_profiling_application (
            application_id, app_TLOid, first_name, last_name, email, application_status, created_at, updated_at
        ) VALUES (DEFAULT, $1, $2, $3, $4, NULL, NOW(), NOW())
      `, [appTloId, first_name, last_name, normalizedEmailInit]);
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

export const getUnassignedPersonnel = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { search } = req.query;
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
    const params = [];
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
        ON LOWER(a.email) = LOWER(u.email)
      WHERE COALESCE(a.email, u.email) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM third_level_official_masterlist m
          WHERE LOWER(m.email) = LOWER(COALESCE(a.email, u.email))
            AND m.status = 'Active'
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

    const currentRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [TLOid]);
    const official = currentRes.rows[0];
    if (!official) throw new Error('Official not found');

    if (official.first_name && official.first_name !== 'VACANT' && action !== 'reassign') {
      await client.query(`
        INSERT INTO third_level_officials_updates
          ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date, vacate_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), ${effTs}, $10)
      `, [official.TLOid, official.first_name, official.last_name, official.position_title,
      official.office, official.strand, official.email,
      action === 'vacate' ? 'Vacated' : action === 'succeed' ? 'Succeeded' : action === 'cancel-vacate' ? 'Active' : 'Reassigned',
      justification || 'Administrative action', vacateReason || null]);
    }

    if (action === 'cancel-vacate') {
      await client.query(`
        UPDATE third_level_official_masterlist
        SET status = 'Active', updated_at = NOW(), effectivity_date = NULL, reassign_target_tloid = NULL, reassign_assignee_tloid = NULL
        WHERE "TLOid" = $1
      `, [TLOid]);

    } else if (action === 'vacate') {
      if (isFuture) {
        if (vacateReason === 'Resignation') {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Resigning', updated_at = NOW(), effectivity_date = ${effTs}
            WHERE "TLOid" = $1
          `, [TLOid]);
        } else {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Vacating', updated_at = NOW(), effectivity_date = ${effTs}
            WHERE "TLOid" = $1
          `, [TLOid]);
        }
      } else {
        if (vacateReason === 'Resignation') {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Inactive', updated_at = NOW(), effectivity_date = ${effTs}
            WHERE "TLOid" = $1
          `, [TLOid]);
        } else {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW(), effectivity_date = ${effTs}
            WHERE "TLOid" = $1
          `, [TLOid]);
        }
      }

    } else if (action === 'succeed') {
      if (successor_TLOid) {
        const successorRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [successor_TLOid]);
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
          WHERE "TLOid" = $1
        `, [successor_TLOid]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = $1, last_name = $2, email = $3, status = 'Active', updated_at = NOW(), effectivity_date = ${effTs}
          WHERE "TLOid" = $4
        `, [successor.first_name, successor.last_name, successor.email, TLOid]);

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
          WHERE "TLOid" = $1
        `, [TLOid]);
      }

    } else if (action === 'reassign') {
      if (isFuture) {
        if (assignee_TLOid) {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Pending Assignment', updated_at = NOW(), effectivity_date = ${effTs}, reassign_assignee_tloid = $2
            WHERE "TLOid" = $1
          `, [TLOid, assignee_TLOid]);

          await client.query(`
            INSERT INTO third_level_officials_updates
              ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at, effectivity_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending Assignment', $8, NOW(), ${effTs})
          `, [TLOid, official.first_name, official.last_name, official.position_title, official.office, official.strand, official.email, justification || null]);

        } else if (target_TLOid) {
          await client.query(`
            UPDATE third_level_official_masterlist
            SET status = 'Reassigning', updated_at = NOW(), effectivity_date = ${effTs}, reassign_target_tloid = $2
            WHERE "TLOid" = $1
          `, [TLOid, target_TLOid]);

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

