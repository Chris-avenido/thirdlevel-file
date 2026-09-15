import pool from '../config/db.js';

const ALLOWED_WRITE_ROLES = [
  'Central Office',
  'CO_PD',
  'Super User',
  'Personnel Admin'
];

/**
 * GET /api/third-level/ces-plantilla
 * Fetches paginated, searchable, and filterable CES Plantilla positions.
 * Excludes only records where dbm_item_no is 'New item' or 'N/A (Detailed)'.
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
      page = 1,
      limit = 20,
      sortColumn = 'id',
      sortDirection = 'asc'
    } = req.query;

    const params = [];
    const conditions = [];

    // Base condition: exclude ONLY records where dbm_item_no is 'New item' or 'N/A (Detailed)'
    conditions.push("UPPER(TRIM(COALESCE(dbm_item_no, ''))) NOT IN ('NEW ITEM', 'N/A (DETAILED)')");

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      conditions.push(`(
        dbm_item_no ILIKE $${idx} OR 
        position_title ILIKE $${idx} OR 
        incumbent_name ILIKE $${idx} OR 
        office_bureau_division ILIKE $${idx} OR
        region ILIKE $${idx}
      )`);
    }

    if (region && region !== 'All') {
      params.push(region);
      conditions.push(`region = $${params.length}`);
    }

    if (office_bureau_division && office_bureau_division !== 'All') {
      params.push(office_bureau_division);
      conditions.push(`office_bureau_division = $${params.length}`);
    }

    if (position_title && position_title !== 'All') {
      params.push(position_title);
      conditions.push(`position_title = $${params.length}`);
    }

    if (incumbent_name && incumbent_name !== 'All') {
      if (incumbent_name === 'VACANT POSITION' || incumbent_name.toUpperCase() === 'VACANT') {
        conditions.push(`(is_vacant = TRUE OR UPPER(TRIM(COALESCE(incumbent_name, ''))) = 'VACANT')`);
      } else {
        params.push(incumbent_name.trim());
        conditions.push(`TRIM(incumbent_name) = $${params.length}`);
      }
    }

    if (salary_grade && salary_grade !== 'All') {
      params.push(salary_grade);
      conditions.push(`salary_grade = $${params.length}`);
    }

    if (status_of_appointment && status_of_appointment !== 'All') {
      params.push(status_of_appointment);
      conditions.push(`status_of_appointment = $${params.length}`);
    }

    if (is_vacant !== undefined && is_vacant !== 'All' && is_vacant !== '') {
      params.push(is_vacant === 'true');
      conditions.push(`is_vacant = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Allowed sort columns to prevent SQL injection
    const validSortColumns = {
      id: 'id',
      source_row_number: 'source_row_number',
      dbm_item_no: 'dbm_item_no',
      position_title: 'position_title',
      office_bureau_division: 'office_bureau_division',
      region: 'region',
      salary_grade: 'salary_grade',
      incumbent_name: 'incumbent_name',
      status_of_appointment: 'status_of_appointment',
      is_vacant: 'is_vacant',
      created_at: 'created_at'
    };

    const activeSortCol = validSortColumns[sortColumn] || 'id';
    const activeSortDir = sortDirection?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // 1. KPI Counts dynamically from the database
    const kpiQuery = `
      SELECT 
        COUNT(*) AS total_plantilla,
        COUNT(*) FILTER (WHERE is_vacant = FALSE) AS total_filled,
        COUNT(*) FILTER (WHERE is_vacant = TRUE) AS total_vacant,
        COUNT(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region != '') AS total_regions
      FROM ces_plantilla
      ${whereClause};
    `;
    const kpiResult = await pool.query(kpiQuery, params);

    // 2. Total records for pagination
    const totalCount = parseInt(kpiResult.rows[0]?.total_plantilla || '0', 10);

    // 3. Paged Data
    let dataQuery = `
      SELECT 
        id,
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
      FROM ces_plantilla
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

    // 4. Distinct Filter Options (from all non-excluded records)
    const optionsQuery = `
      SELECT 
        ARRAY_AGG(DISTINCT region) FILTER (WHERE region IS NOT NULL AND region != '') AS regions,
        ARRAY_AGG(DISTINCT office_bureau_division) FILTER (WHERE office_bureau_division IS NOT NULL AND office_bureau_division != '') AS offices,
        ARRAY_AGG(DISTINCT position_title) FILTER (WHERE position_title IS NOT NULL AND position_title != '') AS positions,
        ARRAY_AGG(DISTINCT incumbent_name) FILTER (WHERE incumbent_name IS NOT NULL AND incumbent_name != '' AND UPPER(TRIM(incumbent_name)) != 'VACANT') AS incumbents,
        ARRAY_AGG(DISTINCT salary_grade) FILTER (WHERE salary_grade IS NOT NULL AND salary_grade != '') AS salary_grades,
        ARRAY_AGG(DISTINCT status_of_appointment) FILTER (WHERE status_of_appointment IS NOT NULL AND status_of_appointment != '') AS appointment_statuses,
        (
          SELECT json_object_agg(region, offices) FROM (
            SELECT region, array_agg(DISTINCT office_bureau_division ORDER BY office_bureau_division) as offices
            FROM ces_plantilla
            WHERE UPPER(TRIM(COALESCE(dbm_item_no, ''))) NOT IN ('NEW ITEM', 'N/A (DETAILED)')
              AND region IS NOT NULL AND region != ''
              AND office_bureau_division IS NOT NULL AND office_bureau_division != ''
            GROUP BY region
          ) sub
        ) AS region_offices
      FROM ces_plantilla
      WHERE UPPER(TRIM(COALESCE(dbm_item_no, ''))) NOT IN ('NEW ITEM', 'N/A (DETAILED)');
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
        incumbents: (optionsResult.rows[0]?.incumbents || []).sort((a, b) => a.localeCompare(b)),
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
