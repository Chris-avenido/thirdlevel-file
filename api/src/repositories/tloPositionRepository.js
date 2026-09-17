/**
 * tloPositionRepository.js
 *
 * Repository for tlo_position_history table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Soft-delete pattern: delete_flg = 'No' (active) | 'Yes' (deleted)
 * Physical DELETE is never performed; the Sentinel prohibition is avoided.
 */

const TABLE = 'tlo_position_history';

/**
 * Fetch all ACTIVE position history records for a person (delete_flg = 'No').
 */
export async function findByTloId(client, sourceTable, tloId, altTloId = null) {
  const params = [sourceTable, tloId];
  let idClause = 'LOWER(tlo_id) = LOWER($2)';
  if (altTloId && String(altTloId).toLowerCase() !== String(tloId).toLowerCase()) {
    params.push(altTloId);
    idClause = '(LOWER(tlo_id) = LOWER($2) OR LOWER(tlo_id) = LOWER($3))';
  }

  const result = await client.query(
    `SELECT id, source_table, tlo_id, position_name, 
            COALESCE(NULLIF(office, ''), division) AS office,
            strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, delete_flg,
            status, oic, designation,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND ${idClause}
       AND delete_flg = 'No'
     ORDER BY inclusive_date_start DESC NULLS LAST, id DESC`,
    params
  );
  return result.rows;
}

/**
 * Sync position history using INSERT / UPDATE / soft-DELETE.
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id, position_name, inclusive_date_start, status FROM ${TABLE} WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2) AND delete_flg = 'No'`,
    [sourceTable, tloId]
  );
  const existingRows = existingRes.rows;
  const existingIds = new Set(existingRows.map(r => r.id));
  const incomingIds = new Set();

  for (const item of incomingArray) {
    const positionName = ((item.position_name || '')).toUpperCase().trim();
    const designation = item.designation ? item.designation.trim() : null;
    const office = item.office ? item.office.trim() : null;
    const strand = item.strand ? item.strand.trim() : null;
    const division = item.division ? item.division.trim() : null;
    const region = item.region ? item.region.trim() : null;
    const cleanDate = (d) => {
      if (!d || typeof d !== 'string') return null;
      const t = d.trim();
      return (t && t.toUpperCase() !== 'N/A' && t.toUpperCase() !== 'NONE') ? t : null;
    };
    const dateStart = cleanDate(item.start_date || item.inclusive_date_start);
    const dateEnd = cleanDate(item.end_date || item.inclusive_date_end);
    const oicPositions = item.oic_positions && Array.isArray(item.oic_positions) && item.oic_positions.length > 0
      ? JSON.stringify(item.oic_positions)
      : null;

    const status = item.status && ['Active', 'Inactive'].includes(item.status)
      ? item.status
      : (dateEnd && new Date(dateEnd) < new Date() ? 'Inactive' : (item.status === 'Active' ? 'Active' : 'Inactive'));
    const oic = Boolean(item.oic ?? item.is_oic ?? (positionName && positionName.includes('OIC')));

    // Resolve target existing ID: by item.id, or candidate match by name + start_date
    let targetId = item.id && existingIds.has(item.id) ? item.id : null;
    if (!targetId && positionName) {
      const candidate = existingRows.find(r =>
        !incomingIds.has(r.id) &&
        r.position_name.toUpperCase() === positionName &&
        String(r.inclusive_date_start ? new Date(r.inclusive_date_start).toISOString().split('T')[0] : '') === String(dateStart || '')
      );
      if (candidate) {
        targetId = candidate.id;
      }
    }

    if (targetId) {
      await client.query(
        `UPDATE ${TABLE}
         SET position_name = $1, office = $2, strand = $3, division = $4, region = $5,
             inclusive_date_start = $6, inclusive_date_end = $7, oic_positions = $8,
             status = $9, oic = $10, designation = $11,
             delete_flg = 'No', updated_at = NOW(), updated_by = $12
         WHERE id = $13 AND source_table = $14 AND LOWER(tlo_id) = LOWER($15)`,
        [positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions,
         status, oic, designation,
         updatedBy, targetId, sourceTable, tloId]
      );
      incomingIds.add(targetId);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, status, oic, designation, delete_flg,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'No', NOW(), NOW(), $14, $14)
         RETURNING id`,
        [sourceTable, tloId, positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions, status, oic, designation, updatedBy]
      );
      incomingIds.add(inserted.rows[0].id);
    }
  }

  // Soft-delete omitted rows
  const idsToSoftDelete = existingRows
    .filter(r => !incomingIds.has(r.id))
    .map(r => r.id);

  if (idsToSoftDelete.length > 0) {
    await client.query(
      `UPDATE ${TABLE}
       SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
       WHERE id = ANY($2) AND source_table = $3 AND LOWER(tlo_id) = LOWER($4)`,
      [updatedBy, idsToSoftDelete, sourceTable, tloId]
    );
    console.log(`[tloPositionRepository] Soft-deleted ${idsToSoftDelete.length} user-removed record(s) for ${tloId}`);
  }
}

/**
 * Clone all ACTIVE position history records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `UPDATE ${TABLE} SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
     WHERE source_table = $2 AND LOWER(tlo_id) = LOWER($3)`,
    [updatedBy, toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, position_name, office, strand, division, region,
        inclusive_date_start, inclusive_date_end, oic_positions, status, oic, designation, delete_flg,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, status, oic, designation, 'No', NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND LOWER(tlo_id) = LOWER($5) AND delete_flg = 'No'`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}

/**
 * Find or create a position in tlo_positions master inventory table.
 */
export async function findOrCreatePosition(client, positionTitle, salaryGrade = null, description = null, region = null, division = null, bureau = null) {
  if (!positionTitle || !String(positionTitle).trim()) return null;
  const cleanTitle = String(positionTitle).trim();
  const cleanGrade = salaryGrade ? String(salaryGrade).trim() : null;

  let query = 'SELECT id, position_title, position_code, salary_grade, description, region, division, bureau FROM tlo_positions WHERE LOWER(TRIM(position_title)) = LOWER(TRIM($1))';
  const params = [cleanTitle];
  if (region) {
    params.push(region);
    query += ` AND LOWER(TRIM(region)) = LOWER(TRIM($${params.length}))`;
  }
  if (division) {
    params.push(division);
    query += ` AND LOWER(TRIM(division)) = LOWER(TRIM($${params.length}))`;
  }
  query += ' LIMIT 1';

  const existing = await client.query(query, params);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const res = await client.query(
    `INSERT INTO tlo_positions (position_title, salary_grade, description, region, division, bureau, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, position_title, position_code, salary_grade, description, region, division, bureau`,
    [cleanTitle, cleanGrade, description, region, division, bureau]
  );
  return res.rows[0];
}

/**
 * Fetch all recognized positions from tlo_positions master inventory.
 */
export async function getAllPositions(client) {
  const res = await client.query(
    `SELECT id, position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at
     FROM tlo_positions
     ORDER BY id ASC`
  );
  return res.rows;
}

/**
 * Fetch all assignment records for a personnel by canonical masterlist ID or TLOid.
 * Joins canonical tlo_positions, tlo_items, and tlo_masterlist.
 */
export async function findAssignmentsByMasterlistId(client, masterlistIdOrTloId) {
  if (!masterlistIdOrTloId) return [];
  const isNumeric = /^\d+$/.test(String(masterlistIdOrTloId));
  const query = `
    SELECT a.id, a.tlo_masterlist_id, a.tlo_position_id, a.position_id, a.status, a.capacity,
           a.designation, a.remarks, a.reassignment_order_binary_id,
           a.start_date, a.end_date, a.created_at, a.updated_at,
           COALESCE(pos.position_title, i.position_title) AS position_title,
           COALESCE(pos.salary_grade, i.salary_grade) AS salary_grade,
           pos.region, pos.division, pos.bureau,
           m.tloid, m.first_name, m.last_name
    FROM tlo_assignments a
    LEFT JOIN tlo_positions pos ON a.position_id = pos.id
    LEFT JOIN tlo_items i ON a.tlo_position_id = i.item_number
    LEFT JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
    WHERE ${isNumeric ? 'a.tlo_masterlist_id = $1' : 'm.tloid = $1'}
    ORDER BY a.start_date DESC NULLS LAST, a.id DESC
  `;
  const res = await client.query(query, [masterlistIdOrTloId]);
  return res.rows;
}

/**
 * Fetch all assignment records for a canonical position item_number or position_id.
 */
export async function findAssignmentsByPositionId(client, positionItemOrId) {
  if (!positionItemOrId) return [];
  const isNumeric = /^\d+$/.test(String(positionItemOrId));
  const query = `
    SELECT a.id, a.tlo_masterlist_id, a.tlo_position_id, a.position_id, a.status, a.capacity,
           a.designation, a.remarks, a.reassignment_order_binary_id,
           a.start_date, a.end_date, a.created_at, a.updated_at,
           COALESCE(pos.position_title, i.position_title) AS position_title,
           COALESCE(pos.salary_grade, i.salary_grade) AS salary_grade,
           pos.region, pos.division, pos.bureau,
           m.tloid, m.first_name, m.last_name
    FROM tlo_assignments a
    LEFT JOIN tlo_positions pos ON a.position_id = pos.id
    LEFT JOIN tlo_items i ON a.tlo_position_id = i.item_number
    LEFT JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
    WHERE ${isNumeric ? '(a.position_id = $1 OR a.tlo_position_id = $1)' : 'a.tlo_position_id = $1'}
    ORDER BY a.start_date DESC NULLS LAST, a.id DESC
  `;
  const res = await client.query(query, [String(positionItemOrId).trim()]);
  return res.rows;
}

/**
 * Query positions with search, filter, pagination, and sorting.
 * Note: Base ordering is strictly ORDER BY id ASC by default as required.
 */
export async function queryPositions(client, {
  search = '',
  region = '',
  salary_grade = '',
  page = 1,
  limit = 20,
  sortBy = 'id',
  sortOrder = 'ASC'
} = {}) {
  const conditions = [];
  const params = [];

  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    const pIdx = params.length;
    conditions.push(`(
      position_title ILIKE $${pIdx} OR
      position_code ILIKE $${pIdx} OR
      salary_grade ILIKE $${pIdx} OR
      region ILIKE $${pIdx} OR
      division ILIKE $${pIdx} OR
      bureau ILIKE $${pIdx} OR
      description ILIKE $${pIdx}
    )`);
  }

  if (region && String(region).trim() && String(region).trim().toUpperCase() !== 'ALL') {
    params.push(String(region).trim());
    conditions.push(`region = $${params.length}`);
  }

  if (salary_grade && String(salary_grade).trim() && String(salary_grade).trim().toUpperCase() !== 'ALL') {
    params.push(String(salary_grade).trim());
    conditions.push(`salary_grade = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching records
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS total FROM tlo_positions ${whereClause}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  // Sorting: strictly validate allowed sort columns; default to id ASC
  const allowedSortKeys = ['id', 'position_title', 'position_code', 'salary_grade', 'region', 'division', 'bureau', 'created_at', 'updated_at'];
  const safeSortBy = allowedSortKeys.includes(sortBy) ? sortBy : 'id';
  const safeSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const orderClause = `ORDER BY ${safeSortBy} ${safeSortOrder}`;

  let paginationClause = '';
  const parsedLimit = parseInt(limit, 10);
  const parsedPage = parseInt(page, 10) || 1;

  if (parsedLimit > 0) {
    const offset = (parsedPage - 1) * parsedLimit;
    params.push(parsedLimit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;
    paginationClause = `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  }

  const query = `
    SELECT id, position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at
    FROM tlo_positions
    ${whereClause}
    ${orderClause}
    ${paginationClause}
  `;

  const result = await client.query(query, params);
  return {
    rows: result.rows,
    total,
    page: parsedPage,
    limit: parsedLimit || total,
    totalPages: parsedLimit > 0 ? Math.ceil(total / parsedLimit) : 1
  };
}

/**
 * Fetch Position KPI statistics dynamically from tlo_positions.
 */
export async function getPositionKpis(client) {
  const result = await client.query(`
    SELECT
      COUNT(*)::int AS total_positions,
      COUNT(DISTINCT position_title)::int AS unique_titles,
      COUNT(DISTINCT NULLIF(TRIM(region), ''))::int AS total_regions,
      MAX(NULLIF(regexp_replace(salary_grade, '[^0-9]', '', 'g'), '')::int) AS highest_salary_grade
    FROM tlo_positions
  `);
  return result.rows[0] || {
    total_positions: 0,
    unique_titles: 0,
    total_regions: 0,
    highest_salary_grade: null
  };
}

/**
 * Fetch distinct filter values (regions, salary grades, titles) from tlo_positions.
 */
export async function getPositionFilterOptions(client) {
  const regionsRes = await client.query(`
    SELECT DISTINCT region 
    FROM tlo_positions 
    WHERE region IS NOT NULL AND TRIM(region) <> '' 
    ORDER BY region ASC
  `);
  const gradesRes = await client.query(`
    SELECT DISTINCT salary_grade 
    FROM tlo_positions 
    WHERE salary_grade IS NOT NULL AND TRIM(salary_grade) <> '' 
    ORDER BY salary_grade ASC
  `);
  const titlesRes = await client.query(`
    SELECT DISTINCT position_title
    FROM tlo_positions
    WHERE position_title IS NOT NULL AND TRIM(position_title) <> ''
    ORDER BY position_title ASC
  `);

  return {
    regions: regionsRes.rows.map(r => r.region),
    salaryGrades: gradesRes.rows.map(r => r.salary_grade),
    titles: titlesRes.rows.map(r => r.position_title)
  };
}

/**
 * Get position by ID.
 */
export async function getPositionById(client, id) {
  const res = await client.query(
    `SELECT id, position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at
     FROM tlo_positions
     WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

/**
 * Create a new position record.
 */
export async function createPosition(client, {
  position_title,
  position_code = null,
  salary_grade = null,
  description = null,
  region = null,
  division = null,
  bureau = null
}) {
  const cleanTitle = String(position_title).trim();
  const res = await client.query(
    `INSERT INTO tlo_positions (position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING id, position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at`,
    [
      cleanTitle,
      position_code ? String(position_code).trim() : null,
      salary_grade ? String(salary_grade).trim() : null,
      description ? String(description).trim() : null,
      region ? String(region).trim() : null,
      division ? String(division).trim() : null,
      bureau ? String(bureau).trim() : null
    ]
  );
  return res.rows[0];
}

/**
 * Update an existing position record.
 */
export async function updatePosition(client, id, {
  position_title,
  position_code,
  salary_grade,
  description,
  region,
  division,
  bureau
}) {
  const cleanTitle = position_title ? String(position_title).trim() : null;
  const res = await client.query(
    `UPDATE tlo_positions
     SET position_title = COALESCE($1, position_title),
         position_code = $2,
         salary_grade = $3,
         description = $4,
         region = $5,
         division = $6,
         bureau = $7,
         updated_at = NOW()
     WHERE id = $8
     RETURNING id, position_title, position_code, salary_grade, description, region, division, bureau, created_at, updated_at`,
    [
      cleanTitle,
      position_code !== undefined ? (position_code ? String(position_code).trim() : null) : null,
      salary_grade !== undefined ? (salary_grade ? String(salary_grade).trim() : null) : null,
      description !== undefined ? (description ? String(description).trim() : null) : null,
      region !== undefined ? (region ? String(region).trim() : null) : null,
      division !== undefined ? (division ? String(division).trim() : null) : null,
      bureau !== undefined ? (bureau ? String(bureau).trim() : null) : null,
      id
    ]
  );
  return res.rows[0] || null;
}

/**
 * Count active and total assignment references to a position.
 */
export async function countPositionAssignments(client, id) {
  const res = await client.query(
    `SELECT 
       COUNT(*)::int AS total_assignments,
       COUNT(CASE WHEN a.status <> 'Inactive' THEN 1 END)::int AS active_assignments,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'assignment_id', a.id,
             'status', a.status,
             'capacity', a.capacity,
             'official_name', CONCAT_WS(' ', m.first_name, m.last_name),
             'tloid', m.tloid
           )
         ) FILTER (WHERE a.id IS NOT NULL),
         '[]'::json
       ) AS assignments
     FROM tlo_assignments a
     LEFT JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
     WHERE a.position_id = $1 OR (a.position_id IS NULL AND a.tlo_position_id = $1::text)`,
    [id]
  );
  return res.rows[0] || { total_assignments: 0, active_assignments: 0, assignments: [] };
}

/**
 * Delete a position from tlo_positions by ID.
 */
export async function deletePosition(client, id) {
  const res = await client.query(
    `DELETE FROM tlo_positions WHERE id = $1 RETURNING id`,
    [id]
  );
  return res.rowCount > 0;
}
