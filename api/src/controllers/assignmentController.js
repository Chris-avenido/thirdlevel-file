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
        m.first_name,
        m.middle_name,
        m.last_name,
        m.suffix,
        CONCAT_WS(' ', m.first_name, NULLIF(m.middle_name, ''), m.last_name, NULLIF(m.suffix, '')) AS official_name,
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
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      query += ` AND (
        m.tloid ILIKE $${pIdx} OR
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
        m.first_name,
        m.middle_name,
        m.last_name,
        m.suffix,
        CONCAT_WS(' ', m.first_name, NULLIF(m.middle_name, ''), m.last_name, NULLIF(m.suffix, '')) AS official_name,
        (
          SELECT json_agg(json_build_object(
            'assignment_id', a.id,
            'position_title', pos.position_title,
            'capacity', a.capacity,
            'start_date', a.start_date
          ))
          FROM tlo_assignments a
          JOIN tlo_positions pos ON a.position_id = pos.id
          WHERE a.tlo_masterlist_id = m.id AND a.status = 'Active' AND a.end_date IS NULL
        ) AS active_assignments
      FROM tlo_masterlist m
      ORDER BY m.last_name ASC, m.first_name ASC
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (error) {
    console.error('Error in getOfficialsForAssignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve officials for assignment.'
    });
  }
};

// 4. Create Assignment (Strict Transactional Vacancy Validation)
export const createAssignment = async (req, res) => {
  const {
    tlo_masterlist_id,
    position_id,
    capacity = 'Full',
    start_date,
    designation,
    remarks
  } = req.body;

  // Basic Validation
  if (!tlo_masterlist_id || !position_id) {
    return res.status(400).json({
      success: false,
      error: 'Both Official (tlo_masterlist_id) and Position (position_id) are required.'
    });
  }

  const validCapacities = ['Full', 'OIC', 'Concurrent'];
  if (!validCapacities.includes(capacity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid capacity '${capacity}'. Must be one of: ${validCapacities.join(', ')}.`
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock the position row to prevent concurrent assignment race conditions
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

    // 2. Strict Vacancy Check: Verify if an active assignment already occupies this position
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

    // 3. Verify Official exists in tlo_masterlist
    const officialCheck = await client.query(
      `SELECT id, tloid, first_name, last_name FROM tlo_masterlist WHERE id = $1`,
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

    // 4. Insert the new active assignment record
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

    const createdBy = req.user?.username || req.user?.name || 'admin';
    const insertRes = await client.query(insertQuery, [
      tlo_masterlist_id,
      position_id,
      capacity,
      start_date || null,
      designation || null,
      remarks || null,
      createdBy
    ]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: `Successfully assigned ${officialRecord.first_name} ${officialRecord.last_name} (${officialRecord.tloid}) to ${positionRecord.position_title} as ${capacity}.`,
      data: insertRes.rows[0]
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
    status
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

    // 3. If official changed, verify official exists
    if (targetMasterlistId !== current.tlo_masterlist_id) {
      const offCheck = await client.query(
        `SELECT id FROM tlo_masterlist WHERE id = $1`,
        [targetMasterlistId]
      );
      if (offCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Selected official does not exist in masterlist.' });
      }
    }

    // Validate capacity if provided
    const targetCapacity = capacity || current.capacity;
    const validCapacities = ['Full', 'OIC', 'Concurrent'];
    if (capacity && !validCapacities.includes(capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Invalid capacity '${capacity}'.` });
    }

    // Validate status if provided
    const targetStatus = status || current.status;
    const validStatuses = ['Active', 'Inactive'];
    if (status && !validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: `Invalid status '${status}'.` });
    }

    const updatedBy = req.user?.username || req.user?.name || 'admin';

    const updateQuery = `
      UPDATE tlo_assignments
      SET 
        tlo_masterlist_id = $1,
        position_id = $2,
        capacity = $3,
        status = $4,
        start_date = COALESCE($5, start_date),
        end_date = $6,
        designation = $7,
        remarks = $8,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $9
      WHERE id = $10
      RETURNING *
    `;

    const updateRes = await client.query(updateQuery, [
      targetMasterlistId,
      targetPosId,
      targetCapacity,
      targetStatus,
      start_date || current.start_date,
      end_date !== undefined ? (end_date || null) : current.end_date,
      designation !== undefined ? (designation || null) : current.designation,
      remarks !== undefined ? (remarks || null) : current.remarks,
      updatedBy,
      id
    ]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Assignment successfully updated.',
      data: updateRes.rows[0]
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
