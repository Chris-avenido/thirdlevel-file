import pool from '../config/db.js';

/**
 * Controller: Position Assignments Management
 * Manages official deployments into vacant plantilla positions using tlo_assignments.
 */

// 1. Fetch Assignments (Joined with tlo_masterlist and tlo_positions)
export const getAssignments = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT 
        a.id,
        a.status,
        a.capacity,
        a.start_date,
        a.end_date,
        a.designation,
        a.remarks,
        a.created_at,
        a.updated_at,
        -- Official details
        m.id AS tlo_masterlist_id,
        m.tloid,
        m.plantilla_item_no,
        m.plantilla_item_no AS item_number,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.suffix,
        CONCAT_WS(' ', m.first_name, NULLIF(m.middle_name, ''), m.last_name, NULLIF(m.suffix, '')) AS official_name,
        tlo.email,
        (
          CASE WHEN m.first_name IS NULL OR m.first_name = '' OR m.first_name ILIKE '%VACANT%' THEN NULL
          ELSE (
            (CASE WHEN 
              tlo.first_name IS NOT NULL AND tlo.first_name != '' AND
              tlo.last_name IS NOT NULL AND tlo.last_name != '' AND
              tlo.gender IS NOT NULL AND tlo.gender != '' AND
              tlo.date_of_birth IS NOT NULL AND
              tlo.civil_status IS NOT NULL AND tlo.civil_status != '' AND
              tlo.photo_binary_id IS NOT NULL AND
              tlo.employment_status IS NOT NULL AND tlo.employment_status != '' AND
              tlo.region IS NOT NULL AND tlo.region != '' AND
              tlo.position_title IS NOT NULL AND tlo.position_title != '' AND
              tlo.appointment_date IS NOT NULL AND
              (COALESCE(tlo.is_oic, false) = false OR (tlo.designation IS NOT NULL AND tlo.designation != '')) AND
              tlo.permanent_address IS NOT NULL AND tlo.permanent_address != '' AND
              ((tlo.contact_details IS NOT NULL AND tlo.contact_details != '') OR (tlo.alt_contact_details_1 IS NOT NULL AND tlo.alt_contact_details_1 != ''))
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (tlo.ces_stage IS NOT NULL AND tlo.ces_stage != '' AND tlo.ces_stage != 'NOT APPLICABLE') OR
              tlo.emt_passer IS NOT NULL OR
              EXISTS (SELECT 1 FROM tlo_eligibility_records el WHERE el.source_table = 'masterlist' AND el.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_position_history ph WHERE ph.source_table = 'masterlist' AND ph.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_education_records ed WHERE ed.source_table = 'masterlist' AND ed.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.performance_rating_1 IS NOT NULL AND tlo.performance_rating_1 != '' AND
              tlo.performance_rating_1_period IS NOT NULL AND tlo.performance_rating_1_period != ''
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_training_records tr WHERE tr.source_table = 'masterlist' AND tr.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (tlo.notable_achievements IS NOT NULL AND jsonb_array_length(CASE WHEN jsonb_typeof(tlo.notable_achievements) = 'array' THEN tlo.notable_achievements ELSE '[]'::jsonb END) > 0) OR
              EXISTS (SELECT 1 FROM tlo_accomplishment_records ac WHERE ac.source_table = 'masterlist' AND ac.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.pds_binary_id IS NOT NULL AND tlo.service_records_binary_id IS NOT NULL
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.pending_admin_case IS NOT NULL AND tlo.pending_admin_case != '' AND (
                (tlo.guilty_admin_details IS NOT NULL AND tlo.criminally_charged_details IS NOT NULL AND tlo.convicted_crime_details IS NOT NULL) OR
                (UPPER(tlo.pending_admin_case) IN ('NO', 'NONE', 'N/A'))
              )
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.dpa_consented_at IS NOT NULL
            THEN 10 ELSE 0 END)
          ) END
        ) AS profile_completion,
        -- Position details
        p.id AS position_id,
        p.position_code,
        p.position_title,
        p.salary_grade,
        p.region,
        p.division,
        p.bureau
      FROM tlo_assignments a
      INNER JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
      INNER JOIN tlo_positions p ON a.position_id = p.id
      LEFT JOIN third_level_official_masterlist tlo ON LOWER(tlo."TLOid") = LOWER(m.tloid)
      WHERE 1=1 AND (tlo.status IS NULL OR (tlo.status != 'For Approval' AND tlo.status != 'Rejected'))
    `;

    const params = [];

    if (status && status.toLowerCase() !== 'all') {
      params.push(status);
      query += ` AND a.status ILIKE $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      query += ` AND (
        m.tloid ILIKE $${pIdx} OR
        m.plantilla_item_no ILIKE $${pIdx} OR
        m.first_name ILIKE $${pIdx} OR
        m.last_name ILIKE $${pIdx} OR
        p.position_title ILIKE $${pIdx} OR
        p.position_code ILIKE $${pIdx} OR
        p.region ILIKE $${pIdx} OR
        p.division ILIKE $${pIdx} OR
        p.bureau ILIKE $${pIdx}
      )`;
    }

    query += ` ORDER BY a.created_at DESC, a.id DESC`;

    const result = await pool.query(query, params);

    // Also fetch dynamic summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total_assignments,
        COUNT(*) FILTER (WHERE status = 'Active' AND end_date IS NULL)::int AS active_assignments,
        COUNT(*) FILTER (WHERE status = 'Inactive' OR end_date IS NOT NULL)::int AS inactive_assignments
      FROM tlo_assignments
    `;
    const statsRes = await pool.query(statsQuery);

    const vacantPosRes = await pool.query(`
      SELECT COUNT(*)::int AS vacant_positions_count
      FROM tlo_positions p
      WHERE NOT EXISTS (
        SELECT 1 FROM tlo_assignments a 
        WHERE (a.position_id = p.id OR (a.position_id IS NULL AND a.tlo_position_id = p.id::text))
          AND a.status <> 'Inactive'
      )
    `);

    const totalPosRes = await pool.query(`SELECT COUNT(*)::int AS total_positions FROM tlo_positions`);
    const totalOfficialsRes = await pool.query(`SELECT COUNT(*)::int AS total_officials FROM tlo_masterlist`);

    return res.status(200).json({
      success: true,
      data: result.rows,
      stats: {
        totalAssignments: statsRes.rows[0]?.total_assignments || 0,
        activeAssignments: statsRes.rows[0]?.active_assignments || 0,
        inactiveAssignments: statsRes.rows[0]?.inactive_assignments || 0,
        vacantPositionsCount: vacantPosRes.rows[0]?.vacant_positions_count || 0,
        totalPositionsCount: totalPosRes.rows[0]?.total_positions || 0,
        totalOfficialsCount: totalOfficialsRes.rows[0]?.total_officials || 0
      }
    });
  } catch (error) {
    console.error('Error in getAssignments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve position assignments.'
    });
  }
};

// 2. Fetch Vacant Positions (Positions without any active assignment)
export const getVacantPositions = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { include_position_id } = req.query;

    let query = `
      SELECT 
        p.id,
        p.position_code,
        p.position_title,
        p.salary_grade,
        p.region,
        p.division,
        p.bureau
      FROM tlo_positions p
      WHERE (
        NOT EXISTS (
          SELECT 1 
          FROM tlo_assignments a 
          WHERE (a.position_id = p.id OR (a.position_id IS NULL AND a.tlo_position_id = p.id::text))
            AND a.status <> 'Inactive'
        )
    `;

    const params = [];
    if (include_position_id && !isNaN(parseInt(include_position_id, 10))) {
      params.push(parseInt(include_position_id, 10));
      query += ` OR p.id = $${params.length}`;
    }

    query += `
      )
      ORDER BY p.position_title ASC, p.position_code ASC, p.id ASC
    `;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getVacantPositions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve vacant positions.'
    });
  }
};

// 3. Fetch Officials for Assignment Dropdown (From tlo_masterlist)
export const getOfficialsForAssignment = async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id,
        m.tloid,
        m.plantilla_item_no,
        m.first_name,
        m.middle_name,
        m.last_name,
        m.suffix,
        CONCAT_WS(' ', m.first_name, NULLIF(m.middle_name, ''), m.last_name, NULLIF(m.suffix, '')) AS official_name,
        CONCAT_WS(' ', m.first_name, NULLIF(m.middle_name, ''), m.last_name, NULLIF(m.suffix, '')) AS full_name,
        tlo.email,
        tlo.status,
        (
          CASE WHEN m.first_name IS NULL OR m.first_name = '' OR m.first_name ILIKE '%VACANT%' THEN NULL
          ELSE (
            (CASE WHEN 
              tlo.first_name IS NOT NULL AND tlo.first_name != '' AND
              tlo.last_name IS NOT NULL AND tlo.last_name != '' AND
              tlo.gender IS NOT NULL AND tlo.gender != '' AND
              tlo.date_of_birth IS NOT NULL AND
              tlo.civil_status IS NOT NULL AND tlo.civil_status != '' AND
              tlo.photo_binary_id IS NOT NULL AND
              tlo.employment_status IS NOT NULL AND tlo.employment_status != '' AND
              tlo.region IS NOT NULL AND tlo.region != '' AND
              tlo.position_title IS NOT NULL AND tlo.position_title != '' AND
              tlo.appointment_date IS NOT NULL AND
              (COALESCE(tlo.is_oic, false) = false OR (tlo.designation IS NOT NULL AND tlo.designation != '')) AND
              tlo.permanent_address IS NOT NULL AND tlo.permanent_address != '' AND
              ((tlo.contact_details IS NOT NULL AND tlo.contact_details != '') OR (tlo.alt_contact_details_1 IS NOT NULL AND tlo.alt_contact_details_1 != ''))
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (tlo.ces_stage IS NOT NULL AND tlo.ces_stage != '' AND tlo.ces_stage != 'NOT APPLICABLE') OR
              tlo.emt_passer IS NOT NULL OR
              EXISTS (SELECT 1 FROM tlo_eligibility_records el WHERE el.source_table = 'masterlist' AND el.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_position_history ph WHERE ph.source_table = 'masterlist' AND ph.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_education_records ed WHERE ed.source_table = 'masterlist' AND ed.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.performance_rating_1 IS NOT NULL AND tlo.performance_rating_1 != '' AND
              tlo.performance_rating_1_period IS NOT NULL AND tlo.performance_rating_1_period != ''
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              EXISTS (SELECT 1 FROM tlo_training_records tr WHERE tr.source_table = 'masterlist' AND tr.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              (tlo.notable_achievements IS NOT NULL AND jsonb_array_length(CASE WHEN jsonb_typeof(tlo.notable_achievements) = 'array' THEN tlo.notable_achievements ELSE '[]'::jsonb END) > 0) OR
              EXISTS (SELECT 1 FROM tlo_accomplishment_records ac WHERE ac.source_table = 'masterlist' AND ac.tlo_id = tlo."TLOid")
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.pds_binary_id IS NOT NULL AND tlo.service_records_binary_id IS NOT NULL
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.pending_admin_case IS NOT NULL AND tlo.pending_admin_case != '' AND (
                (tlo.guilty_admin_details IS NOT NULL AND tlo.criminally_charged_details IS NOT NULL AND tlo.convicted_crime_details IS NOT NULL) OR
                (UPPER(tlo.pending_admin_case) IN ('NO', 'NONE', 'N/A'))
              )
            THEN 10 ELSE 0 END) +
            (CASE WHEN 
              tlo.dpa_consented_at IS NOT NULL
            THEN 10 ELSE 0 END)
          ) END
        ) AS profile_completion,
        COALESCE(
          (
            SELECT json_agg(
              COALESCE(
                NULLIF(a.designation, ''),
                CASE 
                  WHEN a.capacity = 'OIC' THEN CONCAT('OIC - ', pos.position_title)
                  ELSE pos.position_title
                END,
                'Active Assignment'
              )
              ORDER BY a.created_at DESC, a.id DESC
            )
            FROM tlo_assignments a
            LEFT JOIN tlo_positions pos ON a.position_id = pos.id
            WHERE a.tlo_masterlist_id = m.id AND a.status ILIKE 'Active' AND a.end_date IS NULL
          ),
          '[]'::json
        ) AS active_designations,
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'assignment_id', a.id,
            'position_id', a.position_id,
            'position_title', pos.position_title,
            'position_code', pos.position_code,
            'salary_grade', pos.salary_grade,
            'region', pos.region,
            'division', pos.division,
            'bureau', pos.bureau,
            'capacity', a.capacity,
            'status', a.status,
            'designation', a.designation,
            'start_date', a.start_date,
            'end_date', a.end_date,
            'remarks', a.remarks
          ) ORDER BY a.created_at DESC, a.id DESC)
          FROM tlo_assignments a
          JOIN tlo_positions pos ON a.position_id = pos.id
          WHERE a.tlo_masterlist_id = m.id
        ) AS existing_assignments,
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'assignment_id', a.id,
            'position_id', a.position_id,
            'position_title', pos.position_title,
            'position_code', pos.position_code,
            'salary_grade', pos.salary_grade,
            'region', pos.region,
            'division', pos.division,
            'bureau', pos.bureau,
            'capacity', a.capacity,
            'status', a.status,
            'designation', a.designation,
            'start_date', a.start_date,
            'end_date', a.end_date,
            'remarks', a.remarks
          ) ORDER BY a.created_at DESC, a.id DESC)
          FROM tlo_assignments a
          JOIN tlo_positions pos ON a.position_id = pos.id
          WHERE a.tlo_masterlist_id = m.id AND a.status ILIKE 'Active' AND a.end_date IS NULL
        ) AS active_assignments
      FROM tlo_masterlist m
      INNER JOIN third_level_official_masterlist tlo ON LOWER(TRIM(tlo."TLOid")) = LOWER(TRIM(m.tloid))
      WHERE TRIM(tlo.status) = 'Active'
      ORDER BY m.last_name ASC, m.first_name ASC
    `;

    const result = await pool.query(query);

    // Deduplicate officials by canonical normalized full name / identity
    // Consolidates multiple masterlist records for the same individual, merging existing & active assignments
    const deduplicatedMap = new Map();
    for (const row of result.rows) {
      const normalizedName = [row.first_name, row.middle_name, row.last_name, row.suffix]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      const key = normalizedName || `id_${row.id}`;

      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, {
          ...row,
          other_masterlist_ids: [row.id],
          existing_assignments: Array.isArray(row.existing_assignments) ? [...row.existing_assignments] : [],
          active_assignments: Array.isArray(row.active_assignments) ? [...row.active_assignments] : [],
          active_designations: Array.isArray(row.active_designations) ? [...row.active_designations] : []
        });
      } else {
        const existing = deduplicatedMap.get(key);
        existing.other_masterlist_ids.push(row.id);

        // Merge existing_assignments without duplicating
        if (Array.isArray(row.existing_assignments)) {
          for (const a of row.existing_assignments) {
            if (!existing.existing_assignments.some(ea => ea.id === a.id)) {
              existing.existing_assignments.push(a);
            }
          }
        }

        // Merge active_assignments without duplicating
        if (Array.isArray(row.active_assignments)) {
          for (const a of row.active_assignments) {
            if (!existing.active_assignments.some(ea => ea.id === a.id)) {
              existing.active_assignments.push(a);
            }
          }
        }

        // Merge active_designations without duplicating
        if (Array.isArray(row.active_designations)) {
          for (const d of row.active_designations) {
            if (!existing.active_designations.includes(d)) {
              existing.active_designations.push(d);
            }
          }
        }

        // Favor the canonical record that has plantilla_item_no and higher profile completion
        const currentScore = (row.plantilla_item_no ? 100 : 0) + (row.profile_completion || 0);
        const existingScore = (existing.plantilla_item_no ? 100 : 0) + (existing.profile_completion || 0);

        if (currentScore > existingScore) {
          existing.id = row.id;
          existing.tloid = row.tloid;
          existing.plantilla_item_no = row.plantilla_item_no || existing.plantilla_item_no;
          existing.email = row.email || existing.email;
          existing.profile_completion = row.profile_completion;
        }
      }
    }

    const officialsData = Array.from(deduplicatedMap.values());

    return res.status(200).json({
      success: true,
      count: officialsData.length,
      data: officialsData
    });
  } catch (error) {
    console.error('Error in getOfficialsForAssignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve officials for assignment.'
    });
  }
};

// 4. Create Assignment (Strict Transactional Vacancy Validation & Optional Previous Post Vacating)
export const createAssignment = async (req, res) => {
  const {
    tlo_masterlist_id,
    position_id,
    capacity = 'Full',
    start_date,
    designation,
    remarks,
    vacate_previous_position = false,
    vacate_assignment_ids = null,
    vacate_position_ids = null
  } = req.body;

  // Basic Validation
  if (!tlo_masterlist_id || !position_id) {
    return res.status(400).json({
      success: false,
      error: 'Both Official (tlo_masterlist_id) and Position (position_id) are required.'
    });
  }

  let normalizedCapacity = capacity;
  if (normalizedCapacity === 'Full-fledged') normalizedCapacity = 'Full';
  if (normalizedCapacity === 'Officer-in-Charge (OIC)') normalizedCapacity = 'OIC';

  const validCapacities = ['Full', 'OIC', 'Concurrent', 'Full-fledged', 'Officer-in-Charge (OIC)'];
  if (!validCapacities.includes(capacity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid capacity '${capacity}'. Must be one of: Full-fledged, Officer-in-Charge (OIC).`
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the target position row to prevent concurrent assignment race conditions
    const posCheck = await client.query(
      `SELECT id, position_title, position_code FROM tlo_positions WHERE id = $1 FOR UPDATE`,
      [position_id]
    );

    if (posCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: `Selected position (ID ${position_id}) does not exist in tlo_positions.`
      });
    }

    const positionRecord = posCheck.rows[0];

    // 2. Strict Vacancy Check: Verify if an active assignment already occupies this target position
    const activeAssignCheck = await client.query(
      `SELECT a.id, a.tlo_masterlist_id, a.capacity, a.start_date, a.status,
              m.tloid, CONCAT_WS(' ', m.first_name, m.last_name) AS incumbent_name
       FROM tlo_assignments a
       LEFT JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
       WHERE (a.position_id = $1 OR (a.position_id IS NULL AND a.tlo_position_id = $1::text))
         AND a.status <> 'Inactive'
       LIMIT 1`,
      [position_id]
    );

    if (activeAssignCheck.rowCount > 0) {
      await client.query('ROLLBACK');
      const conflict = activeAssignCheck.rows[0];
      return res.status(409).json({
        success: false,
        error: `Position '${positionRecord.position_title}' (${positionRecord.position_code}) is no longer vacant. It is currently assigned to ${conflict.incumbent_name || 'an active incumbent'} (${conflict.tloid || 'TLO'}) as ${conflict.capacity}.`
      });
    }

    // 3. Verify Official exists in tlo_masterlist and is Active
    const officialCheck = await client.query(
      `SELECT m.id, m.tloid, m.first_name, m.last_name, tlo.status
       FROM tlo_masterlist m
       LEFT JOIN third_level_official_masterlist tlo ON LOWER(TRIM(tlo."TLOid")) = LOWER(TRIM(m.tloid))
       WHERE m.id = $1`,
      [tlo_masterlist_id]
    );

    if (officialCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: `Selected official (ID ${tlo_masterlist_id}) does not exist in tlo_masterlist.`
      });
    }

    const officialRecord = officialCheck.rows[0];
    if (officialRecord.status && officialRecord.status.toLowerCase() !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Cannot assign position: Official status is '${officialRecord.status}'. Only active officials can be assigned.`
      });
    }

    const createdBy = req.user?.username || req.user?.name || 'admin';

    // 4. Inactivate specific selected positions (per position) or all active positions if requested
    let vacatedPositions = [];

    const specificAssignIds = Array.isArray(vacate_assignment_ids)
      ? vacate_assignment_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];

    const specificPosIds = Array.isArray(vacate_position_ids)
      ? vacate_position_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : [];

    const hasSpecificVacates = specificAssignIds.length > 0 || specificPosIds.length > 0;
    const shouldVacateAll = (vacate_previous_position === true || vacate_previous_position === 'true') && !hasSpecificVacates;

    if (hasSpecificVacates || shouldVacateAll) {
      let selectSql = `
        SELECT a.id, a.position_id, p.position_title, p.position_code
        FROM tlo_assignments a
        LEFT JOIN tlo_positions p ON (a.position_id = p.id OR (a.position_id IS NULL AND a.tlo_position_id = p.id::text))
        WHERE a.tlo_masterlist_id = $1 
          AND a.status = 'Active' 
          AND a.end_date IS NULL
      `;
      const selectParams = [tlo_masterlist_id];

      if (hasSpecificVacates) {
        if (specificAssignIds.length > 0 && specificPosIds.length > 0) {
          selectParams.push(specificAssignIds, specificPosIds);
          selectSql += ` AND (a.id = ANY($2::int[]) OR a.position_id = ANY($3::int[]))`;
        } else if (specificAssignIds.length > 0) {
          selectParams.push(specificAssignIds);
          selectSql += ` AND a.id = ANY($2::int[])`;
        } else {
          selectParams.push(specificPosIds);
          selectSql += ` AND a.position_id = ANY($2::int[])`;
        }
      }

      selectSql += ` FOR UPDATE OF a`;

      const prevActiveRes = await client.query(selectSql, selectParams);

      if (prevActiveRes.rowCount > 0) {
        vacatedPositions = prevActiveRes.rows;
        const effectiveEndDate = start_date || new Date().toISOString().split('T')[0];
        const vacatedIds = prevActiveRes.rows.map(r => r.id);

        await client.query(
          `UPDATE tlo_assignments
           SET 
             status = 'Inactive',
             end_date = COALESCE($2, CURRENT_DATE),
             remarks = CASE 
               WHEN remarks IS NOT NULL AND remarks <> '' 
               THEN CONCAT_WS(' | ', remarks, 'Vacated upon reassignment to ' || $3)
               ELSE 'Vacated upon reassignment to ' || $3
             END,
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $4
           WHERE id = ANY($1::int[])`,
          [vacatedIds, effectiveEndDate, positionRecord.position_title, createdBy]
        );
      }
    }

    // 5. Insert the new active assignment record
    const insertQuery = `
      INSERT INTO tlo_assignments (
        tlo_masterlist_id,
        position_id,
        tlo_position_id,
        status,
        capacity,
        start_date,
        end_date,
        designation,
        remarks,
        created_by
      ) VALUES (
        $1,
        $2,
        NULL,
        'Active',
        $3,
        COALESCE($4, CURRENT_DATE),
        NULL,
        $5,
        $6,
        $7
      )
      RETURNING id, status, capacity, start_date, created_at
    `;

    const insertRes = await client.query(insertQuery, [
      tlo_masterlist_id,
      position_id,
      normalizedCapacity,
      start_date || null,
      designation || null,
      remarks || null,
      createdBy
    ]);

    await client.query('COMMIT');

    const displayCapacity = capacity === 'Full' ? 'Full-fledged' : capacity === 'OIC' ? 'Officer-in-Charge (OIC)' : capacity;
    let successMessage = `Successfully assigned ${officialRecord.first_name} ${officialRecord.last_name} (${officialRecord.tloid}) to ${positionRecord.position_title} as ${displayCapacity}.`;
    if (vacatedPositions.length > 0) {
      const titles = vacatedPositions.map(vp => vp.position_title || vp.position_code || 'Previous Position').join(', ');
      successMessage += ` Previous position (${titles}) was set to Inactive and is now vacant.`;
    }

    return res.status(201).json({
      success: true,
      message: successMessage,
      data: insertRes.rows[0],
      vacatedPositions
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating assignment in transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Transaction failed while creating position assignment.'
    });
  } finally {
    client.release();
  }
};

// 5. Deactivate / End Assignment (Preserves History, Frees Position)
export const deactivateAssignment = async (req, res) => {
  const { id } = req.params;
  const { end_date, remarks } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Assignment ID is required.'
    });
  }

  try {
    const updatedBy = req.user?.username || req.user?.name || 'admin';

    const updateQuery = `
      UPDATE tlo_assignments
      SET 
        status = 'Inactive',
        end_date = COALESCE($2, CURRENT_DATE),
        remarks = CASE 
          WHEN $3::text IS NOT NULL AND $3::text <> '' 
          THEN CONCAT_WS(' | ', remarks, $3::text) 
          ELSE remarks 
        END,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $4
      WHERE id = $1 AND status = 'Active'
      RETURNING id, status, capacity, start_date, end_date, position_id, tlo_masterlist_id
    `;

    const result = await pool.query(updateQuery, [
      id,
      end_date || null,
      remarks || null,
      updatedBy
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Active assignment not found or already deactivated.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment successfully deactivated. The position is now available.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deactivating assignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate position assignment.'
    });
  }
};

// 6. Update Assignment (Edit capacity, dates, designation, remarks, or reassign position)
export const updateAssignment = async (req, res) => {
  const { id } = req.params;
  const {
    tlo_masterlist_id,
    position_id,
    capacity,
    start_date,
    end_date,
    designation,
    remarks,
    status,
    vacate_assignment_ids
  } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Assignment ID is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and fetch current assignment
    const currRes = await client.query(
      `SELECT * FROM tlo_assignments WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (currRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Assignment record not found.' });
    }

    const current = currRes.rows[0];
    const targetPosId = position_id ? parseInt(position_id, 10) : current.position_id;
    const targetMasterlistId = tlo_masterlist_id ? parseInt(tlo_masterlist_id, 10) : current.tlo_masterlist_id;

    // 2. If position is being changed, verify new position vacancy
    if (targetPosId !== current.position_id) {
      // Lock target position
      const posCheck = await client.query(
        `SELECT id, position_title, position_code FROM tlo_positions WHERE id = $1 FOR UPDATE`,
        [targetPosId]
      );
      if (posCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: `Position (ID ${targetPosId}) does not exist.` });
      }

      // Check if new position already has an active assignment
      const occCheck = await client.query(
        `SELECT a.id, m.tloid, CONCAT_WS(' ', m.first_name, m.last_name) AS incumbent
         FROM tlo_assignments a
         LEFT JOIN tlo_masterlist m ON a.tlo_masterlist_id = m.id
         WHERE (a.position_id = $1 OR (a.position_id IS NULL AND a.tlo_position_id = $1::text))
           AND a.status <> 'Inactive' 
           AND a.id <> $2
         LIMIT 1`,
        [targetPosId, id]
      );

      if (occCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        const conflict = occCheck.rows[0];
        return res.status(409).json({
          success: false,
          error: `Target position '${posCheck.rows[0].position_title}' is currently assigned to ${conflict.incumbent || 'another official'} (${conflict.tloid || 'TLO'}).`
        });
      }
    }

    // 3. If official changed, verify official exists and is Active
    if (targetMasterlistId !== current.tlo_masterlist_id) {
      const offCheck = await client.query(
        `SELECT m.id, tlo.status
         FROM tlo_masterlist m
         LEFT JOIN third_level_official_masterlist tlo ON LOWER(TRIM(tlo."TLOid")) = LOWER(TRIM(m.tloid))
         WHERE m.id = $1`,
        [targetMasterlistId]
      );
      if (offCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Selected official does not exist in masterlist.' });
      }
      if (offCheck.rows[0].status && offCheck.rows[0].status.toLowerCase() !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Cannot assign position: Official status is '${offCheck.rows[0].status}'. Only active officials can be assigned.`
        });
      }
    }

    // Validate and normalize capacity if provided
    let normalizedCapacity = capacity ? (
      capacity === 'Full-fledged' ? 'Full' :
      capacity === 'Officer-in-Charge (OIC)' ? 'OIC' : capacity
    ) : current.capacity;

    const validCapacities = ['Full', 'OIC', 'Concurrent', 'Full-fledged', 'Officer-in-Charge (OIC)'];
    if (capacity && !validCapacities.includes(capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Invalid capacity '${capacity}'.` });
    }
    const targetCapacity = normalizedCapacity;

    // Validate status if provided
    const targetStatus = status || current.status;
    const validStatuses = ['Active', 'Inactive'];
    if (status && !validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Invalid status '${status}'.` });
    }

    const updatedBy = req.user?.username || req.user?.name || 'admin';

    const positionChanged = targetPosId !== current.position_id;
    const isCurrentVacated = (vacate_assignment_ids && vacate_assignment_ids.map(Number).includes(parseInt(id, 10))) || status === 'Inactive';

    let resultRecord;

    if (positionChanged) {
      // 1. Handle previous assignment record: Retain (keep active) or Vacate (inactive)
      if (isCurrentVacated) {
        // YES — Vacate: previous position is marked Inactive
        await client.query(
          `UPDATE tlo_assignments
           SET 
             status = 'Inactive',
             end_date = COALESCE($2, CURRENT_DATE),
             remarks = CASE 
               WHEN remarks IS NOT NULL AND remarks <> '' 
               THEN CONCAT_WS(' | ', remarks, 'Vacated upon reassignment')
               ELSE 'Vacated upon reassignment'
             END,
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $3
           WHERE id = $1`,
          [id, start_date || current.start_date || null, updatedBy]
        );
      } else {
        // "NO — Retain": retain previous position as Active alongside new deployment
        await client.query(
          `UPDATE tlo_assignments
           SET 
             status = 'Active',
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $2
           WHERE id = $1`,
          [id, updatedBy]
        );
      }

      // 2. Insert new assignment data for the newly selected position
      const insertQuery = `
        INSERT INTO tlo_assignments (
          tlo_masterlist_id,
          position_id,
          tlo_position_id,
          status,
          capacity,
          start_date,
          end_date,
          designation,
          remarks,
          created_by,
          updated_by
        ) VALUES (
          $1,
          $2,
          NULL,
          'Active',
          $3,
          COALESCE($4, CURRENT_DATE),
          NULL,
          $5,
          $6,
          $7,
          $7
        )
        RETURNING *
      `;

      const insertRes = await client.query(insertQuery, [
        targetMasterlistId,
        targetPosId,
        targetCapacity,
        start_date || current.start_date || null,
        designation !== undefined ? (designation || null) : null,
        remarks !== undefined ? (remarks || null) : null,
        updatedBy
      ]);
      resultRecord = insertRes.rows[0];

    } else {
      // Position was NOT changed (standard update in place)
      if (isCurrentVacated) {
        const updateQuery = `
          UPDATE tlo_assignments
          SET 
            status = 'Inactive',
            end_date = COALESCE($1, CURRENT_DATE),
            remarks = CASE 
              WHEN $2::text IS NOT NULL AND $2::text <> '' THEN $2::text
              WHEN remarks IS NOT NULL AND remarks <> '' THEN CONCAT_WS(' | ', remarks, 'Vacated')
              ELSE 'Vacated'
            END,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $3
          WHERE id = $4
          RETURNING *
        `;
        const res = await client.query(updateQuery, [
          start_date || end_date || null,
          remarks || null,
          updatedBy,
          id
        ]);
        resultRecord = res.rows[0];
      } else {
        const updateQuery = `
          UPDATE tlo_assignments
          SET 
            tlo_masterlist_id = $1,
            capacity = $2,
            status = 'Active',
            start_date = COALESCE($3, start_date),
            end_date = NULL,
            designation = $4,
            remarks = $5,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $6
          WHERE id = $7
          RETURNING *
        `;
        const res = await client.query(updateQuery, [
          targetMasterlistId,
          targetCapacity,
          start_date || current.start_date,
          designation !== undefined ? (designation || null) : current.designation,
          remarks !== undefined ? (remarks || null) : current.remarks,
          updatedBy,
          id
        ]);
        resultRecord = res.rows[0];
      }
    }

    // Inactivate any selectively vacated assignments
    if (vacate_assignment_ids && Array.isArray(vacate_assignment_ids) && vacate_assignment_ids.length > 0) {
      const validVacateIds = vacate_assignment_ids
        .map(v => parseInt(v, 10))
        .filter(v => Number.isInteger(v) && v !== parseInt(id, 10));

      if (validVacateIds.length > 0) {
        const effectiveEndDate = start_date || current.start_date || new Date().toISOString().split('T')[0];
        await client.query(
          `UPDATE tlo_assignments
           SET 
             status = 'Inactive',
             end_date = COALESCE($2, CURRENT_DATE),
             remarks = CASE 
               WHEN remarks IS NOT NULL AND remarks <> '' 
               THEN CONCAT_WS(' | ', remarks, 'Vacated during assignment update')
               ELSE 'Vacated during assignment update'
             END,
             updated_at = CURRENT_TIMESTAMP,
             updated_by = $3
           WHERE id = ANY($1::int[]) AND status = 'Active'`,
          [validVacateIds, effectiveEndDate, updatedBy]
        );
      }
    }

    await client.query('COMMIT');

    const msg = positionChanged
      ? (isCurrentVacated
          ? 'New position successfully assigned; previous position vacated.'
          : 'New position successfully assigned; previous position retained alongside.')
      : (isCurrentVacated
          ? 'Assignment successfully vacated.'
          : 'Assignment record successfully updated.');

    return res.status(200).json({
      success: true,
      message: msg,
      data: resultRecord || current
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in updateAssignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update assignment.'
    });
  } finally {
    client.release();
  }
};
