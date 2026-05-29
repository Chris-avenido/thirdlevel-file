
import pool from '../config/db.js';
import { upsertBinary } from '../utils/binaryPipeline.js';

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
      return res.json({ success: true, data: masterRes.rows[0], source: 'masterlist' });
    }

    const stagingRes = await pool.query(`
      SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application
      WHERE LOWER(email) = LOWER($1) AND application_status IS DISTINCT FROM 'approved'
      ORDER BY created_at DESC LIMIT 1
    `, [email]);

    if (stagingRes.rows.length > 0) {
      return res.json({ success: true, data: stagingRes.rows[0], source: 'staging' });
    }

    return res.json({ success: false, data: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const uploadDocument = async (req, res) => {
  const { TLOid, docType } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const isMasterlist = !TLOid.startsWith('APP-');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let processedBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;

    // Uncomment and implement compressBufferTo96Dpi if needed
    // if (mimeType === 'application/pdf') {
    //   const optimized = await compressBufferTo96Dpi(req.file.buffer);
    //   processedBuffer = optimized.buffer;
    // }

    const { binary_id } = await upsertBinary(client, processedBuffer, mimeType, processedBuffer.length);

    const docMap = {
      'photo': 'photo_binary_id',
      'pds': 'pds_binary_id',
      'profile_word': 'profile_word_binary_id',
      'profile_ppt': 'profile_ppt_binary_id',
      'service_records': 'service_records_binary_id'
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
  const isMasterlist = !TLOid.startsWith('APP-');
  try {
    let result;
    if (isMasterlist) {
      result = await pool.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [TLOid]);
    } else {
      result = await pool.query('SELECT *, app_TLOid AS "TLOid" FROM third_level_officials_profiling_application WHERE app_TLOid = $1', [TLOid]);
    }
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  const { TLOid } = req.params;
  const isMasterlist = !TLOid.startsWith('APP-');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allFields = [
      'strand', 'office', 'email', 'alt_email_1', 'alt_email_2', 'contact_details', 'alt_contact_details_1', 'alt_contact_details_2',
      'last_name', 'first_name', 'middle_name', 'suffix', 'gender', 'date_of_birth', 'civil_status',
      'position_title', 'date_of_assignment', 'emt_passer', 'emt_date', 'ces_stage', 'ces_conferment_date',
      'total_years_third_level', 'managerial_experience_total', 'permanent_address', 'highest_education', 'specific_degree', 'education_program', 'education_year_graduated',
      'relevant_trainings', 'notable_achievements', 'total_training_hours',
      'performance_rating_1', 'performance_rating_1_period', 'performance_rating_2', 'performance_rating_2_period',
      'cespes_1_rating', 'cespes_2_rating', 'cespes_rating_1_period', 'cespes_rating_2_period',
      'performance_rating_ipcrf', 'performance_rating_cespes',
      'previous_positions',
      'photo_binary_id', 'pds_binary_id', 'profile_word_binary_id', 'profile_ppt_binary_id', 'service_records_binary_id',
      'pending_admin_case', 'ombudsman_case', 'dpa_consented_at', 'profiling_status', 'target_TLOid', 'application_status', 'position_applied_for'
    ];

    const JSONB_FIELDS = new Set(['previous_positions', 'relevant_trainings']);
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

    allFields.forEach(f => {
      if (req.body[f] !== undefined && validCols.has(f.toLowerCase())) {
        let val = req.body[f] === '' ? null : req.body[f];
        if (JSONB_FIELDS.has(f) && val !== null && typeof val !== 'string') val = JSON.stringify(val);
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

export const getVacancies = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "TLOid", position_title, office, strand, first_name, last_name, status 
      FROM third_level_official_masterlist 
      WHERE first_name ILIKE '%VACANT%' OR status = 'Vacant'
      ORDER BY strand, office, position_title
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getApplications = async (req, res) => {
  if (req.user.role !== 'Central Office' && req.user.role !== 'Admin' && req.user.role !== 'Super User') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { search, strand, position } = req.query;
    let query = `
      SELECT 
        a.*, 
        COALESCE(NULLIF(a.first_name, ''), m.first_name) as first_name,
        COALESCE(NULLIF(a.last_name, ''), m.last_name) as last_name,
        a.app_TLOid AS "TLOid", 
        v.position_title AS target_position, 
        v.office AS target_office, 
        v.strand AS target_strand,
        (
          SELECT string_agg(position_title || ' (' || office || ')', ' | ') 
          FROM third_level_official_masterlist 
          WHERE LOWER(email) = LOWER(a.email) AND status = 'Active'
        ) as concurrent_positions
      FROM third_level_officials_profiling_application a
      LEFT JOIN third_level_official_masterlist m ON LOWER(a.email) = LOWER(m.email)
      LEFT JOIN third_level_official_masterlist v ON a."target_TLOid" = v."TLOid"
      WHERE a.application_status = 'applied'
    `;
    const params = [];

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
  if (req.user.role !== 'Central Office' && req.user.role !== 'Admin' && req.user.role !== 'Super User') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { app_TLOid, action, denial_reason } = req.body;
  if (!app_TLOid || !action) return res.status(400).json({ error: 'app_TLOid and action are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
        UPDATE users SET role = 'Third Level Official' WHERE LOWER(email) = $1 AND role = 'Third Level Applicant'
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

export const getOfficials = async (req, res) => {
  if (req.user.role !== 'Central Office' && req.user.role !== 'Admin' && req.user.role !== 'Super User') {
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
  }

  const { search, status, strand, category, position } = req.query;
  let query = `
    WITH RankedOfficials AS (
      SELECT 
        m.*,
        (
          SELECT string_agg(position_title || ' (' || COALESCE(office, '') || ')', ' | ') 
          FROM third_level_official_masterlist 
          WHERE LOWER(email) = LOWER(m.email) AND "TLOid" != m."TLOid" AND status = 'Active'
        ) as concurrent_positions,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN first_name IS NULL OR first_name = 'VACANT' THEN "TLOid" ELSE LOWER(email) END 
          ORDER BY "TLOid" ASC
        ) as rn
      FROM third_level_official_masterlist m
  `;
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length} OR position_title ILIKE $${params.length} OR office ILIKE $${params.length} OR strand ILIKE $${params.length})`);
  }

  if (status && status !== 'All' && status !== 'Legacy') {
    if (status === 'Vacant') {
      conditions.push(`(status = 'Vacated' OR status = 'Vacant' OR first_name IS NULL OR first_name = '')`);
    } else {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
  }

  if (strand && strand !== 'All') {
    params.push(strand);
    conditions.push(`strand = $${params.length}`);
  }

  if (position && position !== 'All') {
    params.push(position);
    conditions.push(`position_title = $${params.length}`);
  }

  if (category === 'Third Level') {
    conditions.push(`position_title IN ('Secretary', 'Undersecretary', 'Assistant Secretary', 'Director IV', 'Director III', 'Regional Director', 'Assistant Regional Director')`);
  } else if (category === 'OIC / Chiefs') {
    conditions.push(`position_title NOT IN ('Secretary', 'Undersecretary', 'Assistant Secretary', 'Director IV', 'Director III', 'Regional Director', 'Assistant Regional Director')`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` 
    ) 
    SELECT * FROM RankedOfficials WHERE rn = 1 
    ORDER BY "TLOid" ASC
  `;

  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
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
    res.json({ success: true, data: result.rows });
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
    const params = isOfficeProvided ? [position_title, office] : [position_title];
    const officeCondition = isOfficeProvided ? 'AND (office = $2 OR office IS NULL)' : '';

    const query = `
      WITH AllIncumbents AS (
        SELECT 
          0 as id, "TLOid", first_name, last_name, strand, office, 'Current' as remarks, updated_at as tenure_date,
          1 as is_current
        FROM third_level_official_masterlist
        WHERE position_title = $1 ${officeCondition}
          AND first_name IS NOT NULL AND first_name != 'VACANT'
        
        UNION ALL
        
        SELECT 
          0 as id, "TLOid", first_name, last_name, strand, office, remarks, updated_at as tenure_date,
          0 as is_current
        FROM third_level_officials_updates
        WHERE position_title = $1 ${officeCondition}
          AND first_name IS NOT NULL AND first_name != 'VACANT'
      ),
      RankedIncumbents AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY LOWER(first_name), LOWER(last_name) ORDER BY is_current DESC, tenure_date DESC) as rn
        FROM AllIncumbents
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
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const adminAction = async (req, res) => {
  if (req.user.role !== 'Central Office' && req.user.role !== 'Admin' && req.user.role !== 'Super User') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { TLOid, action, justification, target_TLOid, successor_TLOid } = req.body;
  if (!TLOid || !action) return res.status(400).json({ error: 'TLOid and action are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [TLOid]);
    const official = currentRes.rows[0];
    if (!official) throw new Error('Official not found');

    if (official.first_name && official.first_name !== 'VACANT') {
      await client.query(`
        INSERT INTO third_level_officials_updates
          ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [official.TLOid, official.first_name, official.last_name, official.position_title,
      official.office, official.strand, official.email,
      action === 'vacate' ? 'Vacated' : action === 'succeed' ? 'Succeeded' : 'Reassigned',
      justification || 'Administrative action']);
    }

    if (action === 'vacate') {
      await client.query(`
        UPDATE third_level_official_masterlist
        SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW()
        WHERE "TLOid" = $1
      `, [TLOid]);

    } else if (action === 'succeed') {
      if (successor_TLOid) {
        const successorRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [successor_TLOid]);
        const successor = successorRes.rows[0];
        if (!successor) throw new Error('Successor not found in masterlist');

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Vacated', $8, NOW())
        `, [successor_TLOid, successor.first_name, successor.last_name, successor.position_title,
          successor.office, successor.strand, successor.email, `Succeeding ${official.first_name} ${official.last_name}`]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL,
              updated_at = NOW()
          WHERE "TLOid" = $1
        `, [successor_TLOid]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = $1, last_name = $2, email = $3, status = 'Active', updated_at = NOW()
          WHERE "TLOid" = $4
        `, [successor.first_name, successor.last_name, successor.email, TLOid]);

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW())
        `, [TLOid, successor.first_name, successor.last_name, official.position_title,
          official.office, official.strand, successor.email, `Succession from ${successor.position_title}`]);
      } else {
        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Succeeded', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW()
          WHERE "TLOid" = $1
        `, [TLOid]);
      }

    } else if (action === 'reassign') {
      if (target_TLOid) {
        const targetRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE "TLOid" = $1', [target_TLOid]);
        const targetSlot = targetRes.rows[0];

        if (targetSlot && targetSlot.first_name && targetSlot.first_name !== 'VACANT') {
          await client.query(`
            INSERT INTO third_level_officials_updates
              ("TLOid", first_name, last_name, position_title, office, strand, email, status, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Vacated', NOW())
          `, [target_TLOid, targetSlot.first_name, targetSlot.last_name, targetSlot.position_title,
            targetSlot.office, targetSlot.strand, targetSlot.email]);
        }

        await client.query(`
          UPDATE third_level_official_masterlist
          SET first_name = $1, last_name = $2, email = $3, contact_details = $4,
              status = 'Active', updated_at = NOW()
          WHERE "TLOid" = $5
        `, [official.first_name, official.last_name, official.email, official.contact_details, target_TLOid]);

        await client.query(`
          INSERT INTO third_level_officials_updates
            ("TLOid", first_name, last_name, position_title, office, strand, email, status, remarks, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, NOW())
        `, [target_TLOid, official.first_name, official.last_name,
          targetSlot?.position_title || official.position_title,
          targetSlot?.office || official.office,
          targetSlot?.strand || official.strand, official.email, justification || `Reassigned from ${official.position_title}`]);

        await client.query(`
          UPDATE third_level_official_masterlist
          SET status = 'Vacated', first_name = NULL, last_name = NULL, email = NULL, updated_at = NOW()
          WHERE "TLOid" = $1
        `, [TLOid]);
      } else {
        await client.query(`
          UPDATE third_level_official_masterlist
          SET updated_at = NOW()
          WHERE "TLOid" = $1
        `, [TLOid]);
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
