import pool from '../config/db.js';
import { upsertBinary } from '../utils/binaryPipeline.js';
import { uploadToAzure } from '../utils/azureBlobService.js';

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

/**
 * Upload a document for vacancy application (stores to Azure Blob Storage under AZURE_FOLDER_NAME with folder vacancy_id).
 */
export const uploadVacancyDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const client = await pool.connect();
  try {
    const rawBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname || 'document.pdf';

    // 1. Initial registration in unified_binaries to get unique binary_id
    const { binary_id } = await upsertBinary(client, rawBuffer, mimeType, rawBuffer.length);

    // 2. Resolve vacancy_id for Azure folder naming
    let vacancyId = req.body.vacancy_id || req.query.vacancy_id || req.params.vacancy_id;
    const docType = req.body.doc_type || req.query.doc_type || req.params.docType || 'document';

    if (!vacancyId || !String(vacancyId).trim()) {
      const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
      const uid = req.user?.uid || '';
      if (email || uid) {
        const applicantRes = await client.query(
          `SELECT target_vacancy_id, applicant_uid FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 LIMIT 1`,
          [email, uid]
        );
        if (applicantRes.rows.length > 0 && applicantRes.rows[0].target_vacancy_id) {
          vacancyId = applicantRes.rows[0].target_vacancy_id;
        } else if (applicantRes.rows.length > 0 && applicantRes.rows[0].applicant_uid) {
          vacancyId = applicantRes.rows[0].applicant_uid;
        }
      }
    }

    if (!vacancyId || !String(vacancyId).trim()) {
      vacancyId = req.user?.uid || 'general-vacancy';
    }

    // Clean vacancy_id so it is a safe folder name (replace path separators or illegal characters)
    const cleanFolder = String(vacancyId).trim().replace(/[/\\?%*:|"<>]/g, '_');
    const targetAzureContainer = process.env.AZURE_FOLDER_NAME || 'staging-tlo';

    console.log(`[VacancyUpload] Uploading ${docType} for vacancy folder '${cleanFolder}' to Azure Blob Storage container (${targetAzureContainer})...`);

    // 3. Upload directly to Azure Blob Storage under AZURE_FOLDER_NAME
    const azureData = await uploadToAzure(
      rawBuffer,
      originalName,
      mimeType,
      cleanFolder,
      docType
    );

    if (!azureData || (!azureData.blobUrl && !azureData.url)) {
      throw new Error(`Failed to upload ${docType} to Azure Blob Storage container '${targetAzureContainer}'`);
    }

    const finalBlobUrl = azureData.blobUrl || azureData.url;
    console.log(`[VacancyUpload] Azure upload successful: ${azureData.filename} -> ${finalBlobUrl}`);

    // 4. Update database record in unified_binaries with Azure Blob URL
    // Clear raw BYTEA content so the VM database stores 0 bytes for this binary (in blob only!)
    await client.query(
      'UPDATE unified_binaries SET azure_blob_url = $1, content = NULL WHERE id = $2',
      [finalBlobUrl, binary_id]
    );

    return res.json({
      success: true,
      message: `${docType} uploaded successfully to Azure Storage (${targetAzureContainer})`,
      data: {
        binary_id,
        filename: originalName,
        blobUrl: finalBlobUrl,
        azure_blob_url: finalBlobUrl,
        mime_type: mimeType,
        size: rawBuffer.length,
        folder: `${targetAzureContainer}/${cleanFolder}/${docType}`
      }
    });
  } catch (err) {
    console.error('[uploadVacancyDocument Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to upload document: ' + err.message });
  } finally {
    client.release();
  }
};

/**
 * Submit full application for vacant third level position (matching DepEd Google Form).
 */
export const submitVacancyApplication = async (req, res) => {
  const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
  const uid = req.user?.uid || '';

  if (!email && !uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
  }

  const {
    position_applying_for,
    target_vacancy_id,
    surname,
    first_name,
    middle_name,
    date_of_birth,
    current_position,
    plantilla_office,
    current_designation,
    assigned_oic_office,
    is_let_passer,
    is_emt_passer,
    ces_eligibility_stage,
    ces_stage_date,
    contact_number,
    // 12 document attachments:
    letter_of_intent_binary_id,
    letter_of_intent_filename,
    pds_binary_id,
    pds_filename,
    work_experience_sheet_binary_id,
    work_experience_sheet_filename,
    cv_binary_id,
    cv_filename,
    outstanding_accomplishments_binary_id,
    outstanding_accomplishments_filename,
    service_records_binary_id,
    service_records_filename,
    transcript_of_records_binary_id,
    transcript_of_records_filename,
    performance_eval_binary_id,
    performance_eval_filename,
    self_certification_binary_id,
    self_certification_filename,
    id_picture_binary_id,
    id_picture_filename,
    applicant_profile_doc_binary_id,
    applicant_profile_doc_filename,
    other_documents_binary_id,
    other_documents_filename
  } = req.body;

  // Form Validation
  if (!position_applying_for || !position_applying_for.trim()) {
    return res.status(400).json({ success: false, error: 'Position Applying For is required' });
  }
  if (!surname || !surname.trim()) {
    return res.status(400).json({ success: false, error: 'Surname is required (DepEd standard: ALL CAPS)' });
  }
  if (!first_name || !first_name.trim()) {
    return res.status(400).json({ success: false, error: 'First Name is required (DepEd standard: ALL CAPS)' });
  }
  if (!current_position || !current_position.trim()) {
    return res.status(400).json({ success: false, error: 'Current Position is required' });
  }
  if (!plantilla_office || !plantilla_office.trim()) {
    return res.status(400).json({ success: false, error: 'Plantilla Office assignment is required' });
  }
  if (!current_designation || !current_designation.trim()) {
    return res.status(400).json({ success: false, error: 'Current Designation is required' });
  }
  if (!ces_eligibility_stage || !ces_eligibility_stage.trim()) {
    return res.status(400).json({ success: false, error: 'CES eligibility stage is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch or create applicant in vacancy_applicants
    let applicantRow = null;
    const applicantRes = await client.query(
      `SELECT * FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 ORDER BY id DESC LIMIT 1`,
      [email, uid]
    );

    if (applicantRes.rows.length > 0) {
      applicantRow = applicantRes.rows[0];
    } else {
      // Find next VAC uid
      const uidRes = await client.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)), 0) AS max_num
        FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'
      `);
      const nextNum = parseInt(uidRes.rows[0]?.max_num || 0) + 1;
      const vacUid = `VAC-2026-${String(nextNum).padStart(4, '0')}`;

      const insRes = await client.query(
        `INSERT INTO vacancy_applicants (
          applicant_uid, first_name, last_name, middle_name, email, contact_number, registration_status, is_testaccount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7, NOW(), NOW())
        RETURNING *`,
        [
          vacUid,
          first_name.toUpperCase().trim(),
          surname.toUpperCase().trim(),
          middle_name ? middle_name.toUpperCase().trim() : null,
          email,
          contact_number || null,
          Boolean(req.user?.is_testaccount)
        ]
      );
      applicantRow = insRes.rows[0];
    }

    // 2. Generate sequential application number: APP-VAC-2026-####
    const appNoRes = await client.query(`
      SELECT COALESCE(MAX(CAST(SUBSTRING(application_no FROM 14) AS INTEGER)), 0) AS max_num
      FROM vacancy_applications WHERE application_no ~ '^APP-VAC-2026-[0-9]{4}$'
    `);
    const nextAppNum = parseInt(appNoRes.rows[0]?.max_num || 0) + 1;
    const applicationNo = `APP-VAC-2026-${String(nextAppNum).padStart(4, '0')}`;

    // 3. Insert into vacancy_applications
    const insertAppQuery = `
      INSERT INTO vacancy_applications (
        application_no, applicant_uid, vacancy_applicant_id, email, contact_number,
        position_applying_for, target_vacancy_id,
        surname, first_name, middle_name, date_of_birth,
        current_position, plantilla_office, current_designation, assigned_oic_office,
        is_let_passer, is_emt_passer,
        ces_eligibility_stage, ces_stage_date,
        letter_of_intent_binary_id, letter_of_intent_filename,
        pds_binary_id, pds_filename,
        work_experience_sheet_binary_id, work_experience_sheet_filename,
        cv_binary_id, cv_filename,
        outstanding_accomplishments_binary_id, outstanding_accomplishments_filename,
        service_records_binary_id, service_records_filename,
        transcript_of_records_binary_id, transcript_of_records_filename,
        performance_eval_binary_id, performance_eval_filename,
        self_certification_binary_id, self_certification_filename,
        id_picture_binary_id, id_picture_filename,
        applicant_profile_doc_binary_id, applicant_profile_doc_filename,
        other_documents_binary_id, other_documents_filename,
        status, is_testaccount, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17,
        $18, $19,
        $20, $21,
        $22, $23,
        $24, $25,
        $26, $27,
        $28, $29,
        $30, $31,
        $32, $33,
        $34, $35,
        $36, $37,
        $38, $39,
        $40, $41,
        $42, $43,
        'Submitted', $44, NOW(), NOW()
      ) RETURNING *;
    `;

    const appValues = [
      applicationNo,
      applicantRow.applicant_uid,
      applicantRow.id,
      email,
      contact_number ? contact_number.trim() : (applicantRow.contact_number || null),
      position_applying_for.trim(),
      target_vacancy_id ? target_vacancy_id.trim() : null,
      surname.toUpperCase().trim(),
      first_name.toUpperCase().trim(),
      middle_name ? middle_name.toUpperCase().trim() : null,
      date_of_birth || null,
      current_position.trim(),
      plantilla_office.trim(),
      current_designation.trim(),
      assigned_oic_office ? assigned_oic_office.trim() : null,
      Boolean(is_let_passer),
      Boolean(is_emt_passer),
      ces_eligibility_stage.trim(),
      ces_stage_date || null,
      letter_of_intent_binary_id || null, letter_of_intent_filename || null,
      pds_binary_id || null, pds_filename || null,
      work_experience_sheet_binary_id || null, work_experience_sheet_filename || null,
      cv_binary_id || null, cv_filename || null,
      outstanding_accomplishments_binary_id || null, outstanding_accomplishments_filename || null,
      service_records_binary_id || null, service_records_filename || null,
      transcript_of_records_binary_id || null, transcript_of_records_filename || null,
      performance_eval_binary_id || null, performance_eval_filename || null,
      self_certification_binary_id || null, self_certification_filename || null,
      id_picture_binary_id || null, id_picture_filename || null,
      applicant_profile_doc_binary_id || null, applicant_profile_doc_filename || null,
      other_documents_binary_id || null, other_documents_filename || null,
      Boolean(req.user?.is_testaccount)
    ];

    const insertedAppRes = await client.query(insertAppQuery, appValues);

    // 4. Update target vacancy in vacancy_applicants
    await client.query(
      `UPDATE vacancy_applicants
       SET target_vacancy_id = COALESCE($1, target_vacancy_id),
           target_position_title = COALESCE($2, target_position_title),
           updated_at = NOW()
       WHERE id = $3`,
      [target_vacancy_id || null, position_applying_for.trim(), applicantRow.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Application successfully submitted!',
      data: insertedAppRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[submitVacancyApplication Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while submitting application: ' + err.message });
  } finally {
    client.release();
  }
};

/**
 * Fetch all applications submitted by the current authenticated applicant.
 */
export const getMyVacancyApplications = async (req, res) => {
  const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
  const uid = req.user?.uid || '';

  if (!email && !uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
  }

  try {
    const query = `
      SELECT * FROM vacancy_applications
      WHERE LOWER(email) = $1 OR applicant_uid = $2
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [email, uid]);
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('[getMyVacancyApplications Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching applications' });
  }
};

/**
 * Fetch a specific vacancy application by ID or application number.
 */
export const getVacancyApplicationById = async (req, res) => {
  const { id } = req.params;
  try {
    const isIdNum = !isNaN(parseInt(id));
    const query = isIdNum
      ? `SELECT * FROM vacancy_applications WHERE id = $1 LIMIT 1`
      : `SELECT * FROM vacancy_applications WHERE application_no = $1 LIMIT 1`;
    const result = await pool.query(query, [isIdNum ? parseInt(id) : id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('[getVacancyApplicationById Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching application' });
  }
};
