import pool from '../config/db.js';

/**
 * Get vacancy applicant profile data for the authenticated user.
 */
export const getVacancyApplicantProfile = async (req, res) => {
  try {
    const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
    const uid = req.user?.uid || '';

    if (!email && !uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
    }

    // 1. Look in vacancy_applicants
    const applicantRes = await pool.query(
      `SELECT * FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 ORDER BY id DESC LIMIT 1`,
      [email, uid]
    );

    if (applicantRes.rows.length > 0) {
      return res.json({
        success: true,
        data: applicantRes.rows[0]
      });
    }

    // 2. If not found in vacancy_applicants, fallback to tlo_users
    const userRes = await pool.query(
      `SELECT uid, first_name, last_name, contact_number, email, role, registration_status, is_testaccount 
       FROM tlo_users WHERE LOWER(email) = $1 OR uid = $2 LIMIT 1`,
      [email, uid]
    );

    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      let vacUid = u.uid && u.uid.startsWith('VAC-') ? u.uid : null;
      if (!vacUid) {
        const uidRes = await pool.query(`
          SELECT COALESCE(MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)), 0) AS max_num
          FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'
        `);
        const nextNum = parseInt(uidRes.rows[0]?.max_num || 0) + 1;
        vacUid = `VAC-2026-${String(nextNum).padStart(4, '0')}`;
      }

      // Seed record in vacancy_applicants so future updates persist seamlessly
      const insertRes = await pool.query(
        `INSERT INTO vacancy_applicants (
          applicant_uid, first_name, last_name, email, contact_number, registration_status, is_testaccount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'Active', $6, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
        RETURNING *`,
        [vacUid, u.first_name || '', u.last_name || '', email, u.contact_number || '', Boolean(u.is_testaccount)]
      );

      return res.json({
        success: true,
        data: insertRes.rows[0]
      });
    }

    return res.status(404).json({ success: false, error: 'Applicant profile not found' });
  } catch (err) {
    console.error('[getVacancyApplicantProfile Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching profile' });
  }
};

/**
 * Update vacancy applicant profile data (personal data, contact info, notes, target vacancy).
 */
export const updateVacancyApplicantProfile = async (req, res) => {
  const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
  const uid = req.user?.uid || '';

  if (!email && !uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
  }

  const {
    first_name,
    last_name,
    middle_name,
    suffix,
    contact_number,
    target_vacancy_id,
    target_position_title,
    notes
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if record exists in vacancy_applicants
    const checkRes = await client.query(
      `SELECT id, applicant_uid, email FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 LIMIT 1`,
      [email, uid]
    );

    let updatedRow = null;

    if (checkRes.rows.length > 0) {
      const updates = [];
      const values = [];
      let idx = 1;

      if (first_name !== undefined) {
        updates.push(`first_name = $${idx++}`);
        values.push(first_name ? first_name.trim() : '');
      }
      if (last_name !== undefined) {
        updates.push(`last_name = $${idx++}`);
        values.push(last_name ? last_name.trim() : '');
      }
      if (middle_name !== undefined) {
        updates.push(`middle_name = $${idx++}`);
        values.push(middle_name ? middle_name.trim() : null);
      }
      if (suffix !== undefined) {
        updates.push(`suffix = $${idx++}`);
        values.push(suffix ? suffix.trim() : null);
      }
      if (contact_number !== undefined) {
        updates.push(`contact_number = $${idx++}`);
        values.push(contact_number ? contact_number.trim() : null);
      }
      if (target_vacancy_id !== undefined) {
        updates.push(`target_vacancy_id = $${idx++}`);
        values.push(target_vacancy_id ? target_vacancy_id.trim() : null);
      }
      if (target_position_title !== undefined) {
        updates.push(`target_position_title = $${idx++}`);
        values.push(target_position_title ? target_position_title.trim() : null);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(notes ? notes.trim() : null);
      }

      updates.push(`updated_at = NOW()`);
      values.push(checkRes.rows[0].id);

      const updateQuery = `
        UPDATE vacancy_applicants
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *;
      `;
      const resUpdate = await client.query(updateQuery, values);
      updatedRow = resUpdate.rows[0];
    } else {
      // Insert new row
      const insRes = await client.query(
        `INSERT INTO vacancy_applicants (
          applicant_uid, first_name, last_name, middle_name, suffix, email, contact_number,
          registration_status, target_vacancy_id, target_position_title, notes, is_testaccount, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'Active', $8, $9, $10, $11, NOW(), NOW()
        ) RETURNING *`,
        [
          uid || `VAC-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
          first_name ? first_name.trim() : '',
          last_name ? last_name.trim() : '',
          middle_name ? middle_name.trim() : null,
          suffix ? suffix.trim() : null,
          email,
          contact_number ? contact_number.trim() : null,
          target_vacancy_id ? target_vacancy_id.trim() : null,
          target_position_title ? target_position_title.trim() : null,
          notes ? notes.trim() : null,
          Boolean(req.user?.is_testaccount)
        ]
      );
      updatedRow = insRes.rows[0];
    }

    // Also update tlo_users if first_name, last_name, contact_number changed
    const userUpdates = [];
    const userValues = [];
    let uIdx = 1;

    if (first_name !== undefined && first_name !== '') {
      userUpdates.push(`first_name = $${uIdx++}`);
      userValues.push(first_name.trim());
    }
    if (last_name !== undefined && last_name !== '') {
      userUpdates.push(`last_name = $${uIdx++}`);
      userValues.push(last_name.trim());
    }
    if (contact_number !== undefined && contact_number !== '') {
      userUpdates.push(`contact_number = $${uIdx++}`);
      userValues.push(contact_number.trim());
    }

    if (userUpdates.length > 0) {
      userValues.push(email);
      await client.query(
        `UPDATE tlo_users SET ${userUpdates.join(', ')} WHERE LOWER(email) = $${uIdx}`,
        userValues
      );
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Applicant profile updated successfully',
      data: updatedRow
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[updateVacancyApplicantProfile Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while updating profile' });
  } finally {
    client.release();
  }
};

/**
 * Apply for a specific vacancy position.
 */
export const applyVacancy = async (req, res) => {
  const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
  const uid = req.user?.uid || '';
  const { vacancy_id, position_title, notes } = req.body;

  if (!email && !uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
  }

  if (!vacancy_id && !position_title) {
    return res.status(400).json({ success: false, error: 'Vacancy identifier or position title is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query(
      `SELECT id FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 LIMIT 1`,
      [email, uid]
    );

    let resultRow = null;
    if (checkRes.rows.length > 0) {
      const updateRes = await client.query(
        `UPDATE vacancy_applicants
         SET target_vacancy_id = $1, target_position_title = $2, notes = COALESCE($3, notes), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [vacancy_id, position_title, notes || null, checkRes.rows[0].id]
      );
      resultRow = updateRes.rows[0];
    } else {
      const insRes = await client.query(
        `INSERT INTO vacancy_applicants (
          applicant_uid, first_name, last_name, email, registration_status, target_vacancy_id, target_position_title, notes, is_testaccount, created_at, updated_at
        ) VALUES (
          $1, COALESCE($2, ''), COALESCE($3, ''), $4, 'Active', $5, $6, $7, $8, NOW(), NOW()
        ) RETURNING *`,
        [
          uid || `VAC-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
          req.user?.first_name || '',
          req.user?.last_name || '',
          email,
          vacancy_id,
          position_title,
          notes || null,
          Boolean(req.user?.is_testaccount)
        ]
      );
      resultRow = insRes.rows[0];
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Position successfully selected as target vacancy',
      data: resultRow
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[applyVacancy Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while applying for vacancy' });
  } finally {
    client.release();
  }
};
