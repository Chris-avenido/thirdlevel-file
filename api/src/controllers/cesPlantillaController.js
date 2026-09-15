import pool from '../config/db.js';
import xlsx from 'xlsx';
import { findOrCreatePosition } from '../repositories/tloPositionRepository.js';

const ALLOWED_WRITE_ROLES = [
  'Central Office',
  'CO_PD',
  'Super User',
  'Personnel Admin'
];

/**
 * GET /api/third-level/ces-plantilla
 * Fetches paginated, searchable, and filterable CES Plantilla positions
 * joined relationally across tlo_assignments, tlo_plantilla, and tlo_positions.
 */
export const getPlantillaItems = async (req, res) => {
  try {
    const {
      search,
      region,
      office_bureau_division,
      position_title,
      incumbent_name,
      salary_grade,
      status_of_appointment,
      is_vacant,
      is_active,
      source,
      page = 1,
      limit = 20,
      sortColumn = 'id',
      sortDirection = 'asc'
    } = req.query;

    // Optional legacy fallback if explicitly requested
    if (source === 'legacy') {
      return getPlantillaItemsLegacy(req, res);
    }

    const params = [];
    const conditions = [];

    // Base condition: exclude placeholders
    conditions.push("UPPER(TRIM(COALESCE(p.permanent_item_no, a.tlo_position_id, ''))) NOT IN ('NEW ITEM', 'N/A (DETAILED)')");

    if (search && search.trim()) {
      const idx = params.length + 1;
      params.push(`%${search.trim()}%`);
      conditions.push(`(
        COALESCE(p.permanent_item_no, a.tlo_position_id) ILIKE $${idx} OR 
        COALESCE(pos.position_title, i.position_title) ILIKE $${idx} OR 
        m.last_name ILIKE $${idx} OR 
        m.first_name ILIKE $${idx} OR 
        p.last_name ILIKE $${idx} OR 
        p.first_name ILIKE $${idx} OR 
        pos.bureau ILIKE $${idx} OR
        pos.region ILIKE $${idx}
      )`);
    }

    if (region && region !== 'All') {
      params.push(region);
      conditions.push(`pos.region = $${params.length}`);
    }

    if (office_bureau_division && office_bureau_division !== 'All') {
      params.push(office_bureau_division);
      conditions.push(`(pos.bureau = $${params.length} OR pos.division = $${params.length})`);
    }

    if (position_title && position_title !== 'All') {
      params.push(position_title);
      conditions.push(`COALESCE(pos.position_title, i.position_title) = $${params.length}`);
    }

    if (incumbent_name && incumbent_name !== 'All') {
      if (incumbent_name === 'VACANT POSITION' || incumbent_name.toUpperCase() === 'VACANT') {
        conditions.push(`(a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL))`);
      } else {
        params.push(`%${incumbent_name.trim()}%`);
        conditions.push(`(m.last_name ILIKE $${params.length} OR CONCAT(m.last_name, ', ', m.first_name) ILIKE $${params.length} OR p.last_name ILIKE $${params.length} OR CONCAT(p.last_name, ', ', p.first_name) ILIKE $${params.length})`);
      }
    }

    if (salary_grade && salary_grade !== 'All') {
      params.push(salary_grade);
      conditions.push(`COALESCE(pos.salary_grade, i.salary_grade) = $${params.length}`);
    }

    if (status_of_appointment && status_of_appointment !== 'All') {
      params.push(status_of_appointment);
      conditions.push(`(COALESCE(p.employment_type, a.capacity, 'Permanent') = $${params.length})`);
    }

    if (is_vacant !== undefined && is_vacant !== 'All' && is_vacant !== '') {
      const isVacantBool = is_vacant === 'true';
      if (isVacantBool) {
        conditions.push(`(a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL))`);
      } else {
        conditions.push(`(a.tlo_masterlist_id IS NOT NULL OR (p.last_name IS NOT NULL OR p.first_name IS NOT NULL))`);
      }
    }

    if (is_active !== undefined && is_active !== 'All' && is_active !== '') {
      params.push(is_active === 'true' ? 'Active' : 'Inactive');
      conditions.push(`a.status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortColumns = {
      id: 'a.id',
      dbm_item_no: 'COALESCE(p.permanent_item_no, a.tlo_position_id)',
      position_title: 'COALESCE(pos.position_title, i.position_title)',
      office_bureau_division: 'COALESCE(pos.bureau, pos.division)',
      region: 'pos.region',
      salary_grade: 'COALESCE(pos.salary_grade, i.salary_grade)',
      incumbent_name: 'COALESCE(m.last_name, p.last_name)',
      status_of_appointment: 'COALESCE(p.employment_type, a.capacity)',
      is_vacant: "CASE WHEN a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL) THEN TRUE ELSE FALSE END",
      is_active: "(a.status = 'Active')",
      created_at: 'a.created_at'
    };

    const activeSortCol = validSortColumns[sortColumn] || 'a.id';
    const activeSortDir = sortDirection?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // 1. KPI Counts dynamically from normalized architecture
    const kpiQuery = `
      SELECT 
        COUNT(*) AS total_plantilla,
        COUNT(*) FILTER (WHERE a.tlo_masterlist_id IS NOT NULL OR (p.last_name IS NOT NULL OR p.first_name IS NOT NULL)) AS total_filled,
        COUNT(*) FILTER (WHERE a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL)) AS total_vacant,
        COUNT(DISTINCT pos.region) FILTER (WHERE pos.region IS NOT NULL AND pos.region != '') AS total_regions
      FROM tlo_assignments a
      LEFT JOIN tlo_positions pos ON pos.id = a.position_id
      LEFT JOIN tlo_masterlist m ON m.id = a.tlo_masterlist_id
      LEFT JOIN tlo_items i ON i.item_number = a.tlo_position_id
      LEFT JOIN tlo_plantilla p ON p.permanent_item_no = a.tlo_position_id
      ${whereClause};
    `;
    const kpiResult = await pool.query(kpiQuery, params);
    const totalCount = parseInt(kpiResult.rows[0]?.total_plantilla || '0', 10);

    // 2. Paged Data
    let dataQuery = `
      SELECT 
        a.id,
        p.id AS plantilla_id,
        a.id AS source_row_number,
        COALESCE(p.permanent_item_no, a.tlo_position_id) AS dbm_item_no,
        COALESCE(pos.position_title, i.position_title) AS position_title,
        COALESCE(pos.salary_grade, i.salary_grade) AS salary_grade,
        COALESCE(pos.bureau, pos.division) AS office_bureau_division,
        pos.region,
        pos.division,
        CASE 
          WHEN a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL) THEN 'VACANT'
          WHEN m.last_name IS NOT NULL THEN TRIM(CONCAT(m.last_name, ', ', COALESCE(m.first_name, ''), ' ', COALESCE(m.middle_name, '')))
          ELSE TRIM(CONCAT(p.last_name, ', ', COALESCE(p.first_name, ''), ' ', COALESCE(p.middle_name, '')))
        END AS incumbent_name,
        COALESCE(p.employment_type, a.capacity, 'Permanent') AS status_of_appointment,
        CASE WHEN a.tlo_masterlist_id IS NULL AND (p.last_name IS NULL AND p.first_name IS NULL) THEN TRUE ELSE FALSE END AS is_vacant,
        (a.status = 'Active') AS is_active,
        p.salary,
        a.created_at,
        a.updated_at
      FROM tlo_assignments a
      LEFT JOIN tlo_positions pos ON pos.id = a.position_id
      LEFT JOIN tlo_masterlist m ON m.id = a.tlo_masterlist_id
      LEFT JOIN tlo_items i ON i.item_number = a.tlo_position_id
      LEFT JOIN tlo_plantilla p ON p.permanent_item_no = a.tlo_position_id
      ${whereClause}
      ORDER BY ${activeSortCol} ${activeSortDir}
    `;

    if (limit !== 'all') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      const offset = (pageNum - 1) * limitNum;
      params.push(limitNum);
      dataQuery += ` LIMIT $${params.length}`;
      params.push(offset);
      dataQuery += ` OFFSET $${params.length}`;
    }

    const dataResult = await pool.query(dataQuery, params);

    // 3. Distinct Filter Options
    const optionsQuery = `
      SELECT 
        ARRAY_AGG(DISTINCT pos.region) FILTER (WHERE pos.region IS NOT NULL AND pos.region != '') AS regions,
        ARRAY_AGG(DISTINCT COALESCE(pos.bureau, pos.division)) FILTER (WHERE COALESCE(pos.bureau, pos.division) IS NOT NULL AND COALESCE(pos.bureau, pos.division) != '') AS offices,
        ARRAY_AGG(DISTINCT COALESCE(pos.position_title, i.position_title)) FILTER (WHERE COALESCE(pos.position_title, i.position_title) IS NOT NULL AND COALESCE(pos.position_title, i.position_title) != '') AS positions,
        ARRAY_AGG(DISTINCT COALESCE(pos.salary_grade, i.salary_grade)) FILTER (WHERE COALESCE(pos.salary_grade, i.salary_grade) IS NOT NULL AND COALESCE(pos.salary_grade, i.salary_grade) != '') AS salary_grades,
        ARRAY_AGG(DISTINCT COALESCE(p.employment_type, a.capacity)) FILTER (WHERE COALESCE(p.employment_type, a.capacity) IS NOT NULL AND COALESCE(p.employment_type, a.capacity) != '') AS appointment_statuses,
        (
          SELECT json_object_agg(sub.region, sub.offices) FROM (
            SELECT pos2.region, array_agg(DISTINCT COALESCE(pos2.bureau, pos2.division) ORDER BY COALESCE(pos2.bureau, pos2.division)) as offices
            FROM tlo_assignments a2
            JOIN tlo_positions pos2 ON pos2.id = a2.position_id
            WHERE pos2.region IS NOT NULL AND pos2.region != ''
              AND COALESCE(pos2.bureau, pos2.division) IS NOT NULL AND COALESCE(pos2.bureau, pos2.division) != ''
            GROUP BY pos2.region
          ) sub
        ) AS region_offices
      FROM tlo_assignments a
      LEFT JOIN tlo_positions pos ON pos.id = a.position_id
      LEFT JOIN tlo_items i ON i.item_number = a.tlo_position_id
      LEFT JOIN tlo_plantilla p ON p.permanent_item_no = a.tlo_position_id;
    `;
    const optionsResult = await pool.query(optionsQuery);

    const pageSize = limit === 'all' ? totalCount : parseInt(limit, 10) || 20;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10) || 1,
        limit: limit === 'all' ? totalCount : pageSize,
        totalPages
      },
      kpis: {
        totalPlantilla: parseInt(kpiResult.rows[0]?.total_plantilla || '0', 10),
        totalFilled: parseInt(kpiResult.rows[0]?.total_filled || '0', 10),
        totalVacant: parseInt(kpiResult.rows[0]?.total_vacant || '0', 10),
        totalRegions: parseInt(kpiResult.rows[0]?.total_regions || '0', 10)
      },
      filterOptions: {
        regions: (optionsResult.rows[0]?.regions || []).sort(),
        offices: (optionsResult.rows[0]?.offices || []).sort((a, b) => a.localeCompare(b)),
        positions: (optionsResult.rows[0]?.positions || []).sort((a, b) => a.localeCompare(b)),
        incumbents: [],
        salaryGrades: (optionsResult.rows[0]?.salary_grades || []).sort((a, b) => Number(a) - Number(b)),
        appointmentStatuses: (optionsResult.rows[0]?.appointment_statuses || []).sort(),
        regionOffices: optionsResult.rows[0]?.region_offices || {}
      }
    });
  } catch (err) {
    console.error('Error fetching CES Plantilla positions:', err);
    res.status(500).json({ error: 'Failed to fetch plantilla positions: ' + err.message });
  }
};

/**
 * Fallback to legacy ces_plantilla report table if explicitly requested via ?source=legacy
 */
const getPlantillaItemsLegacy = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ces_plantilla LIMIT 50');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/third-level/ces-plantilla
 * Creates a new CES Plantilla position.
 * Concurrency-safe source_row_number generation via transaction and advisory lock.
 */
export const createPlantillaItem = async (req, res) => {
  if (!ALLOWED_WRITE_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges.' });
  }

  const {
    office_bureau_division,
    region,
    position_title,
    dbm_item_no,
    salary_grade,
    incumbent_name,
    status_of_appointment,
    is_vacant
  } = req.body;

  if (!position_title || !position_title.trim()) {
    return res.status(400).json({ error: 'Position title is required.' });
  }

  if (!dbm_item_no || !dbm_item_no.trim()) {
    return res.status(400).json({ error: 'DBM Item No is required.' });
  }

  const cleanItemNo = dbm_item_no.trim();
  const upperItemNo = cleanItemNo.toUpperCase();
  if (upperItemNo === 'NEW ITEM' || upperItemNo === 'N/A (DETAILED)') {
    return res.status(400).json({ error: 'Cannot create a placeholder item ("New item" or "N/A (Detailed)").' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Concurrency guard: transactional advisory lock for source_row_number serialization
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ces_plantilla_source_row_number'))");

    const rowNumRes = await client.query('SELECT COALESCE(MAX(source_row_number), 0) + 1 AS next_row FROM ces_plantilla');
    const nextRowNumber = parseInt(rowNumRes.rows[0].next_row, 10);

    const isVacantVal = is_vacant === true || is_vacant === 'true' || (incumbent_name && incumbent_name.trim().toUpperCase() === 'VACANT');

    const insertQuery = `
      INSERT INTO ces_plantilla (
        source_row_number,
        office_bureau_division,
        region,
        position_title,
        dbm_item_no,
        salary_grade,
        incumbent_name,
        status_of_appointment,
        is_vacant,
        is_section_header,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW(), NOW())
      RETURNING *;
    `;

    const insertRes = await client.query(insertQuery, [
      nextRowNumber,
      office_bureau_division ? office_bureau_division.trim() : null,
      region ? region.trim() : null,
      position_title.trim(),
      cleanItemNo,
      salary_grade ? String(salary_grade).trim() : null,
      incumbent_name ? incumbent_name.trim() : (isVacantVal ? 'VACANT' : null),
      status_of_appointment ? status_of_appointment.trim() : null,
      Boolean(isVacantVal)
    ]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating CES Plantilla position:', err);
    res.status(500).json({ error: 'Failed to create plantilla position: ' + err.message });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/third-level/ces-plantilla/:id
 * Updates an existing CES Plantilla position.
 */
export const updatePlantillaItem = async (req, res) => {
  if (!ALLOWED_WRITE_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges.' });
  }

  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return res.status(400).json({ error: 'Invalid plantilla ID.' });
  }

  const {
    office_bureau_division,
    region,
    position_title,
    dbm_item_no,
    salary_grade,
    incumbent_name,
    status_of_appointment,
    is_vacant
  } = req.body;

  if (!position_title || !position_title.trim()) {
    return res.status(400).json({ error: 'Position title is required.' });
  }

  if (!dbm_item_no || !dbm_item_no.trim()) {
    return res.status(400).json({ error: 'DBM Item No is required.' });
  }

  const cleanItemNo = dbm_item_no.trim();
  const upperItemNo = cleanItemNo.toUpperCase();
  if (upperItemNo === 'NEW ITEM' || upperItemNo === 'N/A (DETAILED)') {
    return res.status(400).json({ error: 'Cannot set DBM Item No to a placeholder ("New item" or "N/A (Detailed)").' });
  }

  try {
    const isVacantVal = is_vacant === true || is_vacant === 'true' || (incumbent_name && incumbent_name.trim().toUpperCase() === 'VACANT');

    const updateQuery = `
      UPDATE ces_plantilla
      SET 
        office_bureau_division = $1,
        region = $2,
        position_title = $3,
        dbm_item_no = $4,
        salary_grade = $5,
        incumbent_name = $6,
        status_of_appointment = $7,
        is_vacant = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      office_bureau_division ? office_bureau_division.trim() : null,
      region ? region.trim() : null,
      position_title.trim(),
      cleanItemNo,
      salary_grade ? String(salary_grade).trim() : null,
      incumbent_name ? incumbent_name.trim() : (isVacantVal ? 'VACANT' : null),
      status_of_appointment ? status_of_appointment.trim() : null,
      Boolean(isVacantVal),
      numId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plantilla record not found.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating CES Plantilla position:', err);
    res.status(500).json({ error: 'Failed to update plantilla position: ' + err.message });
  }
};

/**
 * DELETE /api/third-level/ces-plantilla/:id
 * Deletes a CES Plantilla position.
 */
export const deletePlantillaItem = async (req, res) => {
  if (!ALLOWED_WRITE_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges.' });
  }

  const { id } = req.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return res.status(400).json({ error: 'Invalid plantilla ID.' });
  }

  try {
    const result = await pool.query('DELETE FROM ces_plantilla WHERE id = $1 RETURNING id, dbm_item_no', [numId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plantilla record not found.' });
    }

    res.json({
      success: true,
      message: `Plantilla position ${result.rows[0].dbm_item_no} deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting CES Plantilla position:', err);
    res.status(500).json({ error: 'Failed to delete plantilla position: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CFS Plantilla Report Sanitization & Ingestion Logic (tlo_plantilla)
// ─────────────────────────────────────────────────────────────────────────────

const EXCEL_ERROR_REGEX = /^#(VALUE|N\/A|REF|NAME|NULL|DIV\/0|NUM)[!?]?$/i;
const PLACEHOLDER_STRINGS = new Set(['N/A', 'NONE', 'NULL', '-', '--', 'N/A (DETAILED)', 'NEW ITEM']);

/**
 * Strips whitespace and returns null if value is undefined, null, blank,
 * or an Excel formula error (#VALUE!, #N/A, #REF!, etc.).
 */
export const sanitizePlantillaValue = (val) => {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (EXCEL_ERROR_REGEX.test(str)) return null;
  return str;
};

/**
 * Sanitizes permanent_item_no: returns trimmed string or null if empty/placeholder/error.
 */
export const sanitizeItemNo = (val) => {
  const sanitized = sanitizePlantillaValue(val);
  if (!sanitized) return null;
  if (PLACEHOLDER_STRINGS.has(sanitized.toUpperCase())) return null;
  return sanitized;
};

/**
 * Sanitizes salary: handles Excel errors, currency symbols (₱, $), commas, and blanks.
 * Returns numeric float with 2 decimal places, or null.
 */
export const sanitizeSalary = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? null : parseFloat(val.toFixed(2));
  }
  const str = String(val).trim();
  if (!str) return null;
  if (EXCEL_ERROR_REGEX.test(str)) return null;
  if (PLACEHOLDER_STRINGS.has(str.toUpperCase())) return null;

  // Remove currency signs (₱, $), commas, and whitespace
  const cleanStr = str.replace(/[₱$,\s]/g, '');
  const num = parseFloat(cleanStr);
  if (isNaN(num) || !isFinite(num)) return null;
  return parseFloat(num.toFixed(2));
};

/**
 * Maps raw spreadsheet/JSON row to normalized 13-field tlo_plantilla record:
 * region, division, bureau, position_title, permanent_item_no, salary,
 * employment_type, last_name, first_name, middle_name, suffix, prefix, gender.
 */
export const normalizePlantillaRow = (rawRow) => {
  if (!rawRow || typeof rawRow !== 'object') return null;

  const getField = (...keys) => {
    for (const key of keys) {
      if (rawRow[key] !== undefined && rawRow[key] !== null) return rawRow[key];
    }
    // Case-insensitive fallback
    const lowerKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const [k, v] of Object.entries(rawRow)) {
      const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lowerKeys.includes(normalizedK) && v !== undefined && v !== null) {
        return v;
      }
    }
    return null;
  };

  const permanentItemNo = sanitizeItemNo(
    getField('permanent_item_no', 'permanent_item_number', 'item_no', 'item_number', 'dbm_item_no', 'plantilla_item_no')
  );
  const salary = sanitizeSalary(
    getField('salary', 'monthly_salary', 'annual_salary', 'rate', 'basic_salary')
  );
  const region = sanitizePlantillaValue(getField('region'));
  const division = sanitizePlantillaValue(getField('division'));
  const bureau = sanitizePlantillaValue(getField('bureau', 'office', 'office_bureau_division', 'bureau_office'));
  const positionTitle = sanitizePlantillaValue(getField('position_title', 'position'));
  const salaryGrade = sanitizePlantillaValue(getField('salary_grade', 'sg', 'salarygrade'));

  let employmentType = sanitizePlantillaValue(
    getField('employment_type', 'status_of_appointment', 'appointment_status')
  ) || 'PLANTILLA';

  let lastName = sanitizePlantillaValue(getField('last_name', 'surname'));
  let firstName = sanitizePlantillaValue(getField('first_name', 'given_name'));
  let middleName = sanitizePlantillaValue(getField('middle_name', 'mi', 'middle_initial'));
  let suffix = sanitizePlantillaValue(getField('suffix', 'ext'));
  let prefix = sanitizePlantillaValue(getField('prefix', 'title'));
  let gender = sanitizePlantillaValue(getField('gender', 'sex'));

  // Fallback parsing if full name is provided as single column (e.g. "incumbent_name")
  if (!lastName && !firstName) {
    const incumbentName = sanitizePlantillaValue(
      getField('incumbent_name', 'name', 'full_name', 'employee_name')
    );
    if (incumbentName && incumbentName.toUpperCase() !== 'VACANT' && incumbentName.toUpperCase() !== 'VACANT POSITION') {
      if (incumbentName.includes(',')) {
        const parts = incumbentName.split(',');
        lastName = sanitizePlantillaValue(parts[0]);
        firstName = sanitizePlantillaValue(parts.slice(1).join(','));
      } else {
        const parts = incumbentName.trim().split(/\s+/);
        if (parts.length === 1) {
          lastName = parts[0];
        } else {
          lastName = parts.pop();
          firstName = parts.join(' ');
        }
      }
    }
  }

  // Filter out empty rows or section headers without any meaningful identifiers
  const hasIdentifier = Boolean(permanentItemNo || positionTitle || lastName || firstName);
  if (!hasIdentifier) return null;

  return {
    region,
    division,
    bureau,
    position_title: positionTitle,
    salary_grade: salaryGrade,
    permanent_item_no: permanentItemNo,
    salary,
    employment_type: employmentType,
    last_name: lastName,
    first_name: firstName,
    middle_name: middleName,
    suffix,
    prefix,
    gender
  };
};

/**
 * POST /api/third-level/ces-plantilla/import
 * Ingests CFS Plantilla Report workbook or JSON payload into decoupled architecture:
 * 1. Resolves/creates position in tlo_positions
 * 2. Ingests item & demographics into tlo_plantilla
 * 3. Ingests location, position link, and active status into tlo_assignments
 */
export const importCfsPlantillaReport = async (req, res) => {
  if (!ALLOWED_WRITE_ROLES.includes(req.user?.role) && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Insufficient administrative privileges.' });
  }

  try {
    let rawRows = [];

    if (req.file) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ error: 'Uploaded workbook contains no worksheets.' });
      }
      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: null });
    } else if (Array.isArray(req.body?.items)) {
      rawRows = req.body.items;
    } else if (Array.isArray(req.body?.rows)) {
      rawRows = req.body.rows;
    } else {
      return res.status(400).json({
        error: 'No file or data provided. Upload an Excel/CSV file with key "file" or provide JSON body with "items".'
      });
    }

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'No data rows found to import.' });
    }

    const client = await pool.connect();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      const upsertPlantillaQuery = `
        INSERT INTO tlo_plantilla (
          permanent_item_no, salary, employment_type,
          last_name, first_name, middle_name, suffix, prefix, gender,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (permanent_item_no) WHERE permanent_item_no IS NOT NULL AND permanent_item_no != ''
        DO UPDATE SET
          salary = COALESCE(EXCLUDED.salary, tlo_plantilla.salary),
          employment_type = COALESCE(EXCLUDED.employment_type, tlo_plantilla.employment_type),
          last_name = COALESCE(EXCLUDED.last_name, tlo_plantilla.last_name),
          first_name = COALESCE(EXCLUDED.first_name, tlo_plantilla.first_name),
          middle_name = COALESCE(EXCLUDED.middle_name, tlo_plantilla.middle_name),
          suffix = COALESCE(EXCLUDED.suffix, tlo_plantilla.suffix),
          prefix = COALESCE(EXCLUDED.prefix, tlo_plantilla.prefix),
          gender = COALESCE(EXCLUDED.gender, tlo_plantilla.gender),
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_inserted;
      `;

      const insertPlantillaNoItemQuery = `
        INSERT INTO tlo_plantilla (
          permanent_item_no, salary, employment_type,
          last_name, first_name, middle_name, suffix, prefix, gender,
          created_at, updated_at
        )
        VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, true AS is_inserted;
      `;

      for (const raw of rawRows) {
        const item = normalizePlantillaRow(raw);
        if (!item) {
          skipped++;
          continue;
        }

        // 1. Resolve position in tlo_positions
        let positionId = null;
        if (item.position_title) {
          const posRecord = await findOrCreatePosition(client, item.position_title, item.salary_grade);
          if (posRecord) positionId = posRecord.id;
        }

        // 2. Ingest item & personnel demographics into tlo_plantilla
        let plantillaId = null;
        if (item.permanent_item_no) {
          const resPlantilla = await client.query(upsertPlantillaQuery, [
            item.permanent_item_no,
            item.salary,
            item.employment_type,
            item.last_name,
            item.first_name,
            item.middle_name,
            item.suffix,
            item.prefix,
            item.gender
          ]);
          plantillaId = resPlantilla.rows[0]?.id;
          if (resPlantilla.rows[0]?.is_inserted) {
            inserted++;
          } else {
            updated++;
          }
        } else {
          const resInsert = await client.query(insertPlantillaNoItemQuery, [
            item.salary,
            item.employment_type,
            item.last_name,
            item.first_name,
            item.middle_name,
            item.suffix,
            item.prefix,
            item.gender
          ]);
          plantillaId = resInsert.rows[0]?.id;
          inserted++;
        }

        // 3. Ingest location & post occupancy into tlo_assignments
        const isVacant = !item.last_name && !item.first_name;
        const assignStatus = isVacant ? 'Inactive' : 'Active';

        let masterlistId = null;
        if (!isVacant && (item.last_name || item.first_name)) {
          const mRes = await client.query(
            `SELECT id FROM tlo_masterlist 
             WHERE tloid = $1 OR (LOWER(TRIM(last_name)) = LOWER(TRIM($2)) AND LOWER(TRIM(first_name)) = LOWER(TRIM($3)))
             LIMIT 1`,
            [item.permanent_item_no, item.last_name, item.first_name]
          );
          if (mRes.rows.length > 0) {
            masterlistId = mRes.rows[0].id;
          }
        }

        const existingAssign = await client.query(
          `SELECT id FROM tlo_assignments 
           WHERE (tlo_position_id = $1 AND tlo_position_id IS NOT NULL AND tlo_position_id != '')
             AND status = 'Active'
             AND end_date IS NULL
           LIMIT 1`,
          [item.permanent_item_no]
        );

        if (existingAssign.rows.length > 0) {
          await client.query(
            `UPDATE tlo_assignments
             SET position_id = COALESCE($1, position_id),
                 tlo_masterlist_id = COALESCE($2, tlo_masterlist_id),
                 status = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [positionId, masterlistId, assignStatus, existingAssign.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO tlo_assignments (
               tlo_position_id, position_id, tlo_masterlist_id,
               status, capacity, start_date, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 'Full', CURRENT_DATE, NOW(), NOW())`,
            [
              item.permanent_item_no,
              positionId,
              masterlistId,
              assignStatus
            ]
          );
        }
      }

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `CFS Plantilla Report imported successfully into normalized architecture.`,
        summary: {
          totalRows: rawRows.length,
          processed: inserted + updated,
          inserted,
          updated,
          skipped
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error importing CFS Plantilla Report:', err);
    res.status(500).json({ error: 'Failed to import CFS Plantilla Report: ' + err.message });
  }
};

/**
 * GET /api/third-level/ces-plantilla/tlo-plantilla
 * Fetches paginated, searchable records from tlo_plantilla joined with location & position.
 */
export const getTloPlantillaRecords = async (req, res) => {
  try {
    const {
      search,
      region,
      division,
      bureau,
      position_title,
      employment_type,
      page = 1,
      limit = 20,
      sortColumn = 'created_at',
      sortDirection = 'desc'
    } = req.query;

    const params = [];
    const conditions = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      conditions.push(`(
        p.permanent_item_no ILIKE $${idx} OR 
        COALESCE(pos.position_title, i.position_title) ILIKE $${idx} OR 
        p.last_name ILIKE $${idx} OR 
        p.first_name ILIKE $${idx} OR
        pos.bureau ILIKE $${idx} OR
        pos.region ILIKE $${idx}
      )`);
    }

    if (region && region !== 'All') {
      params.push(region);
      conditions.push(`pos.region = $${params.length}`);
    }

    if (division && division !== 'All') {
      params.push(division);
      conditions.push(`pos.division = $${params.length}`);
    }

    if (bureau && bureau !== 'All') {
      params.push(bureau);
      conditions.push(`(pos.bureau = $${params.length} OR pos.division = $${params.length})`);
    }

    if (position_title && position_title !== 'All') {
      params.push(position_title);
      conditions.push(`COALESCE(pos.position_title, i.position_title) = $${params.length}`);
    }

    if (employment_type && employment_type !== 'All') {
      params.push(employment_type);
      conditions.push(`p.employment_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const validSortColumns = {
      id: 'p.id',
      permanent_item_no: 'p.permanent_item_no',
      position_title: 'COALESCE(pos.position_title, i.position_title)',
      salary: 'p.salary',
      employment_type: 'p.employment_type',
      last_name: 'p.last_name',
      first_name: 'p.first_name',
      region: 'pos.region',
      division: 'pos.division',
      bureau: 'COALESCE(pos.bureau, pos.division)',
      created_at: 'p.created_at'
    };

    const activeSortCol = validSortColumns[sortColumn] || 'p.created_at';
    const activeSortDir = sortDirection?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countRes = await pool.query(
      `SELECT COUNT(*) as total 
       FROM tlo_plantilla p
       LEFT JOIN tlo_assignments a ON (a.tlo_position_id = p.permanent_item_no AND a.status = 'Active' AND a.end_date IS NULL)
       LEFT JOIN tlo_positions pos ON pos.id = a.position_id
       LEFT JOIN tlo_items i ON i.item_number = p.permanent_item_no
       ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    let query = `
      SELECT 
        p.id, p.permanent_item_no, p.salary, p.employment_type,
        p.first_name, p.middle_name, p.last_name, p.suffix, p.prefix, p.gender,
        COALESCE(pos.position_title, i.position_title) AS position_title,
        COALESCE(pos.salary_grade, i.salary_grade) AS salary_grade,
        pos.region, pos.division, COALESCE(pos.bureau, pos.division) AS bureau,
        (a.id IS NOT NULL AND a.status = 'Active') AS is_active,
        p.created_at, p.updated_at
      FROM tlo_plantilla p
      LEFT JOIN tlo_assignments a ON (a.tlo_position_id = p.permanent_item_no AND a.status = 'Active' AND a.end_date IS NULL)
      LEFT JOIN tlo_positions pos ON pos.id = a.position_id
      LEFT JOIN tlo_items i ON i.item_number = p.permanent_item_no
      ${whereClause}
      ORDER BY ${activeSortCol} ${activeSortDir}
    `;

    if (limit !== 'all') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      const offset = (pageNum - 1) * limitNum;
      params.push(limitNum);
      query += ` LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const dataRes = await pool.query(query, params);
    const pageSize = limit === 'all' ? total : parseInt(limit, 10) || 20;

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page: parseInt(page, 10) || 1,
        limit: limit === 'all' ? total : pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (err) {
    console.error('Error fetching tlo_plantilla records:', err);
    res.status(500).json({ error: 'Failed to fetch tlo_plantilla records: ' + err.message });
  }
};

