import pool from '../config/db.js';
import { upsertBinary } from '../utils/binaryPipeline.js';
import { uploadToAzure, copyBlobToTloid } from '../utils/azureBlobService.js';

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
          SELECT GREATEST(
            COALESCE((SELECT MAX(CAST(SUBSTRING(uid FROM 10) AS INTEGER)) FROM tlo_users WHERE uid ~ '^VAC-2026-[0-9]{4}$'), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0),
            COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applications WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0)
          ) AS max_num
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
        values.push(contact_number ? String(contact_number).replace(/\D/g, '').slice(0, 11) : null);
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

    let applicationId = req.body.application_id || req.query.application_id;
    const docType = req.body.doc_type || req.query.doc_type || req.params.docType || 'document';
    let vacancyId = req.body.vacancy_id || req.query.vacancy_id || req.params.vacancy_id;

    // Validation: ID Picture allows image only; other document attachments require PDF only
    if (docType === 'id_picture') {
      const isImg = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(originalName);
      if (!isImg) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type: ID Picture must be an image file (JPG, PNG, or WebP) only'
        });
      }
    } else {
      const isPdf = mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type: Document attachments must be in PDF format (.pdf) only'
        });
      }
    }

    // 1. Initial registration in unified_binaries to get unique binary_id
    const { binary_id } = await upsertBinary(client, rawBuffer, mimeType, rawBuffer.length);

    const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
    const uid = req.user?.uid || '';

    let appRow = null;
    if (applicationId) {
      const resApp = await client.query('SELECT id, vacancy_applicant_id FROM vacancy_applications WHERE id = $1', [applicationId]);
      if (resApp.rows.length > 0) {
        appRow = resApp.rows[0];
      }
    }

    if (!appRow && (email || uid)) {
      const draftRes = await client.query(
        `SELECT id, vacancy_applicant_id FROM vacancy_applications 
         WHERE (LOWER(email) = $1 OR applicant_uid = $2)
           AND status = 'Draft'
           AND (target_vacancy_id = $3 OR $3 IS NULL)
         ORDER BY id DESC LIMIT 1`,
        [email, uid, vacancyId || null]
      );
      if (draftRes.rows.length > 0) {
        appRow = draftRes.rows[0];
      }
    }

    if (!appRow) {
      let applicantUid = uid || `VAC-${Date.now()}`;
      let applicantId = null;
      let firstName = 'APPLICANT';
      let lastName = 'USER';
      if (email || uid) {
        const applicantRes = await client.query(
          `SELECT id, applicant_uid, first_name, last_name FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 LIMIT 1`,
          [email, uid]
        );
        if (applicantRes.rows.length > 0) {
          applicantId = applicantRes.rows[0].id;
          applicantUid = applicantRes.rows[0].applicant_uid || applicantUid;
          firstName = applicantRes.rows[0].first_name || firstName;
          lastName = applicantRes.rows[0].last_name || lastName;
        }
      }

      const tempAppNo = `APP-DRAFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const insDraft = await client.query(
        `INSERT INTO vacancy_applications (
          application_no, applicant_uid, vacancy_applicant_id, email,
          position_applying_for, target_vacancy_id,
          surname, first_name, current_position, plantilla_office, current_designation,
          ces_eligibility_stage, status, is_testaccount, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6,
          $7, $8, 'N/A', 'Department of Education', 'N/A',
          'Stage 1 (CES Written Examination)', 'Draft', $9, NOW(), NOW()
        ) RETURNING id, vacancy_applicant_id`,
        [
          tempAppNo,
          applicantUid,
          applicantId,
          email || 'applicant@deped.gov.ph',
          req.body.position_title || 'Plantilla Position',
          vacancyId || null,
          lastName,
          firstName,
          Boolean(req.user?.is_testaccount)
        ]
      );
      appRow = insDraft.rows[0];
    }

    applicationId = appRow.id;

    // Resolve vacancy_applicants.id for Azure Blob storage folder path: APP-vacancy_applicants.id
    let vacancyApplicantId = appRow.vacancy_applicant_id;
    if (!vacancyApplicantId && (email || uid)) {
      const applicantRes = await client.query(
        `SELECT id FROM vacancy_applicants WHERE LOWER(email) = $1 OR applicant_uid = $2 LIMIT 1`,
        [email, uid]
      );
      if (applicantRes.rows.length > 0) {
        vacancyApplicantId = applicantRes.rows[0].id;
        await client.query(
          `UPDATE vacancy_applications SET vacancy_applicant_id = $1 WHERE id = $2`,
          [vacancyApplicantId, applicationId]
        );
      }
    }

    // Folder name in Azure Blob Storage format: APP-vacancy_applicants.id
    const cleanFolder = `APP-${vacancyApplicantId || applicationId}`;
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
        application_id: applicationId,
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

  // Contact number clean (11 digits without dash)
  const cleanContactNumber = contact_number ? String(contact_number).replace(/\D/g, '').slice(0, 11) : null;

  // Date of birth validation: not allow future dates
  if (date_of_birth) {
    const dob = new Date(date_of_birth);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dob > today) {
      return res.status(400).json({ success: false, error: 'Date of Birth cannot be in the future' });
    }
  }

  // CES stage date validation: not allow future dates
  if (ces_stage_date) {
    const stageDate = new Date(ces_stage_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (stageDate > today) {
      return res.status(400).json({ success: false, error: 'Date Appointed/Conferred/Passed CESO/CES eligibility cannot be in the future' });
    }
  }

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
        SELECT GREATEST(
          COALESCE((SELECT MAX(CAST(SUBSTRING(uid FROM 10) AS INTEGER)) FROM tlo_users WHERE uid ~ '^VAC-2026-[0-9]{4}$'), 0),
          COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applicants WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0),
          COALESCE((SELECT MAX(CAST(SUBSTRING(applicant_uid FROM 10) AS INTEGER)) FROM vacancy_applications WHERE applicant_uid ~ '^VAC-2026-[0-9]{4}$'), 0)
        ) AS max_num
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

    let finalAppRow = null;
    const existingAppId = req.body.application_id;

    if (existingAppId) {
      const checkDraft = await client.query('SELECT id FROM vacancy_applications WHERE id = $1', [existingAppId]);
      if (checkDraft.rows.length > 0) {
        const updateAppQuery = `
          UPDATE vacancy_applications SET
            application_no = $1,
            applicant_uid = $2,
            vacancy_applicant_id = $3,
            email = $4,
            contact_number = $5,
            position_applying_for = $6,
            target_vacancy_id = $7,
            surname = $8,
            first_name = $9,
            middle_name = $10,
            date_of_birth = $11,
            current_position = $12,
            plantilla_office = $13,
            current_designation = $14,
            assigned_oic_office = $15,
            is_let_passer = $16,
            is_emt_passer = $17,
            ces_eligibility_stage = $18,
            ces_stage_date = $19,
            letter_of_intent_binary_id = $20,
            letter_of_intent_filename = $21,
            pds_binary_id = $22,
            pds_filename = $23,
            work_experience_sheet_binary_id = $24,
            work_experience_sheet_filename = $25,
            cv_binary_id = $26,
            cv_filename = $27,
            outstanding_accomplishments_binary_id = $28,
            outstanding_accomplishments_filename = $29,
            service_records_binary_id = $30,
            service_records_filename = $31,
            transcript_of_records_binary_id = $32,
            transcript_of_records_filename = $33,
            performance_eval_binary_id = $34,
            performance_eval_filename = $35,
            self_certification_binary_id = $36,
            self_certification_filename = $37,
            id_picture_binary_id = $38,
            id_picture_filename = $39,
            applicant_profile_doc_binary_id = $40,
            applicant_profile_doc_filename = $41,
            other_documents_binary_id = $42,
            other_documents_filename = $43,
            status = 'Submitted',
            is_testaccount = $44,
            updated_at = NOW()
          WHERE id = $45
          RETURNING *;
        `;
        const updatedAppRes = await client.query(updateAppQuery, [...appValues, existingAppId]);
        finalAppRow = updatedAppRes.rows[0];
      }
    }

    if (!finalAppRow) {
      const insertedAppRes = await client.query(insertAppQuery, appValues);
      finalAppRow = insertedAppRes.rows[0];
    }

    // 4. Update target vacancy and contact number in vacancy_applicants
    await client.query(
      `UPDATE vacancy_applicants
       SET target_vacancy_id = COALESCE($1, target_vacancy_id),
           target_position_title = COALESCE($2, target_position_title),
           contact_number = COALESCE($3, contact_number),
           updated_at = NOW()
       WHERE id = $4`,
      [target_vacancy_id || null, position_applying_for.trim(), cleanContactNumber, applicantRow.id]
    );

    // Also sync contact_number to tlo_users if available
    if (email && cleanContactNumber) {
      await client.query(
        `UPDATE tlo_users SET contact_number = $1 WHERE LOWER(email) = $2`,
        [cleanContactNumber, email]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Application successfully submitted!',
      data: finalAppRow
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
 * Fetch the latest application or draft data and uploaded documents for prefilling upon re-applying.
 */
export const getLatestVacancyApplication = async (req, res) => {
  const email = req.user?.email ? req.user.email.toLowerCase().trim() : '';
  const uid = req.user?.uid || '';
  const { vacancy_id } = req.query;

  if (!email && !uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User identity not found' });
  }

  try {
    // 1. Find the best matching application:
    // Prioritize: 
    //   a) A draft for this specific vacancy_id (if supplied)
    //   b) Any draft
    //   c) Most recent submitted application
    const query = `
      SELECT * FROM vacancy_applications
      WHERE (LOWER(email) = $1 OR applicant_uid = $2)
      ORDER BY 
        CASE 
          WHEN status = 'Draft' AND target_vacancy_id = $3 THEN 0
          WHEN status = 'Draft' THEN 1
          ELSE 2
        END,
        created_at DESC,
        id DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [email, uid, vacancy_id || null]);
    let app = result.rows[0] || null;

    // 2. If an application is found, check if any of the 12 document attachments are missing.
    // If so, look in other applications by this user to backfill any previously uploaded documents!
    if (app) {
      const docPairs = [
        ['letter_of_intent_binary_id', 'letter_of_intent_filename'],
        ['pds_binary_id', 'pds_filename'],
        ['work_experience_sheet_binary_id', 'work_experience_sheet_filename'],
        ['cv_binary_id', 'cv_filename'],
        ['outstanding_accomplishments_binary_id', 'outstanding_accomplishments_filename'],
        ['service_records_binary_id', 'service_records_filename'],
        ['transcript_of_records_binary_id', 'transcript_of_records_filename'],
        ['performance_eval_binary_id', 'performance_eval_filename'],
        ['self_certification_binary_id', 'self_certification_filename'],
        ['id_picture_binary_id', 'id_picture_filename'],
        ['applicant_profile_doc_binary_id', 'applicant_profile_doc_filename'],
        ['other_documents_binary_id', 'other_documents_filename']
      ];

      const missingPairs = docPairs.filter(([bKey]) => !app[bKey]);
      if (missingPairs.length > 0) {
        const otherAppsRes = await pool.query(
          `SELECT * FROM vacancy_applications 
           WHERE (LOWER(email) = $1 OR applicant_uid = $2) AND id != $3
           ORDER BY created_at DESC`,
          [email, uid, app.id]
        );
        for (const prevApp of otherAppsRes.rows) {
          for (const [bKey, fKey] of missingPairs) {
            if (!app[bKey] && prevApp[bKey]) {
              app[bKey] = prevApp[bKey];
              app[fKey] = prevApp[fKey];
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      data: app
    });
  } catch (err) {
    console.error('[getLatestVacancyApplication Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching latest application' });
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
      SELECT 
        va.*, 
        m."TLOid" AS appointed_tlo_id,
        m.position_title AS masterlist_position_title,
        m.plantilla_item_no AS masterlist_plantilla_item_no,
        (m."TLOid" IS NOT NULL) AS is_applicant_in_masterlist,
        (m."TLOid" IS NOT NULL AND va.status != 'Appointed') AS is_already_appointed_elsewhere
      FROM vacancy_applications va
      LEFT JOIN LATERAL (
        SELECT "TLOid", position_title, plantilla_item_no
        FROM third_level_official_masterlist
        WHERE (vacancy_applicant_id = va.vacancy_applicant_id OR (va.vacancy_applicant_id IS NULL AND LOWER(email) = LOWER(va.email)))
          AND status != 'Inactive'
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      ) m ON true
      WHERE (LOWER(va.email) = $1 OR va.applicant_uid = $2)
        AND va.status != 'Draft'
      ORDER BY va.created_at DESC
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
      ? `SELECT 
           va.*, 
           m."TLOid" AS appointed_tlo_id,
           m.position_title AS masterlist_position_title,
           m.plantilla_item_no AS masterlist_plantilla_item_no,
           (m."TLOid" IS NOT NULL) AS is_applicant_in_masterlist,
           (m."TLOid" IS NOT NULL AND va.status != 'Appointed') AS is_already_appointed_elsewhere
         FROM vacancy_applications va
         LEFT JOIN LATERAL (
           SELECT "TLOid", position_title, plantilla_item_no
           FROM third_level_official_masterlist
           WHERE (vacancy_applicant_id = va.vacancy_applicant_id OR (va.vacancy_applicant_id IS NULL AND LOWER(email) = LOWER(va.email)))
             AND status != 'Inactive'
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1
         ) m ON true
         WHERE va.id = $1 LIMIT 1`
      : `SELECT 
           va.*, 
           m."TLOid" AS appointed_tlo_id,
           m.position_title AS masterlist_position_title,
           m.plantilla_item_no AS masterlist_plantilla_item_no,
           (m."TLOid" IS NOT NULL) AS is_applicant_in_masterlist,
           (m."TLOid" IS NOT NULL AND va.status != 'Appointed') AS is_already_appointed_elsewhere
         FROM vacancy_applications va
         LEFT JOIN LATERAL (
           SELECT "TLOid", position_title, plantilla_item_no
           FROM third_level_official_masterlist
           WHERE (vacancy_applicant_id = va.vacancy_applicant_id OR (va.vacancy_applicant_id IS NULL AND LOWER(email) = LOWER(va.email)))
             AND status != 'Inactive'
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1
         ) m ON true
         WHERE va.application_no = $1 LIMIT 1`;
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

/**
 * Fetch all vacancy applications for Central Office / Admin review.
 * Can filter by status, search (name, email, position, application_no, plantilla_office).
 */
export const getAllVacancyApplications = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT 
        va.*, 
        m."TLOid" AS appointed_tlo_id,
        m.position_title AS masterlist_position_title,
        m.plantilla_item_no AS masterlist_plantilla_item_no,
        (m."TLOid" IS NOT NULL) AS is_applicant_in_masterlist,
        (m."TLOid" IS NOT NULL AND va.status != 'Appointed') AS is_already_appointed_elsewhere
      FROM vacancy_applications va
      LEFT JOIN LATERAL (
        SELECT "TLOid", position_title, plantilla_item_no
        FROM third_level_official_masterlist
        WHERE (vacancy_applicant_id = va.vacancy_applicant_id OR (va.vacancy_applicant_id IS NULL AND LOWER(email) = LOWER(va.email)))
          AND status != 'Inactive'
        ORDER BY created_at DESC NULLS LAST
        LIMIT 1
      ) m ON true
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND va.status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(va.surname) LIKE $${params.length} OR 
        LOWER(va.first_name) LIKE $${params.length} OR 
        LOWER(COALESCE(va.middle_name, '')) LIKE $${params.length} OR
        LOWER(va.application_no) LIKE $${params.length} OR 
        LOWER(va.position_applying_for) LIKE $${params.length} OR 
        LOWER(va.email) LIKE $${params.length} OR
        LOWER(COALESCE(va.plantilla_office, '')) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY va.created_at DESC`;

    const result = await pool.query(query, params);

    // Also get KPI counts for all applications across statuses
    const kpiRes = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Submitted') AS submitted,
        COUNT(*) FILTER (WHERE status = 'Under Review') AS under_review,
        COUNT(*) FILTER (WHERE status = 'Shortlisted') AS shortlisted,
        COUNT(*) FILTER (WHERE status IN ('Appointed', 'Approved')) AS appointed,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected
      FROM vacancy_applications
    `);

    return res.json({
      success: true,
      data: result.rows,
      kpis: kpiRes.rows[0] || {
        total: result.rowCount,
        submitted: 0,
        under_review: 0,
        shortlisted: 0,
        appointed: 0,
        approved: 0,
        rejected: 0
      }
    });
  } catch (err) {
    console.error('[getAllVacancyApplications Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while fetching all vacancy applications' });
  }
};

/**
 * Update vacancy application status and remarks (Central Office Review).
 * When status is set to 'Appointed', atomically promotes the applicant to
 * third_level_official_masterlist and tlo_masterlist, links IDs, escalates
 * user role, and schedules cloud blob relocation to the new TLO prefix.
 */
export const updateVacancyApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const isIdNum = !isNaN(parseInt(id));
  const client = await pool.connect();

  try {
    // 1. Fetch the application
    const appQuery = isIdNum
      ? `SELECT * FROM vacancy_applications WHERE id = $1`
      : `SELECT * FROM vacancy_applications WHERE application_no = $1`;
    const appRes = await client.query(appQuery, [isIdNum ? parseInt(id) : id]);
    if (appRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const application = appRes.rows[0];
    const previousStatus = application.status;
    const targetVacId = application.target_vacancy_id ? application.target_vacancy_id.trim() : null;

    // If status is NOT 'Appointed', perform standard status update (or revert if was previously Appointed)
    if (status !== 'Appointed') {
      await client.query('BEGIN');
      const updateQuery = isIdNum
        ? `UPDATE vacancy_applications SET status = COALESCE($1, status), remarks = COALESCE($2, remarks), updated_at = NOW() WHERE id = $3 RETURNING *`
        : `UPDATE vacancy_applications SET status = COALESCE($1, status), remarks = COALESCE($2, remarks), updated_at = NOW() WHERE application_no = $3 RETURNING *`;
      const updateRes = await client.query(updateQuery, [status, remarks, isIdNum ? parseInt(id) : id]);

      // If application was previously Appointed and is now being reverted:
      if (previousStatus === 'Appointed' && targetVacId) {
        // Revert ces_plantilla position to vacant
        await client.query(`
          UPDATE ces_plantilla
          SET 
            is_vacant = true,
            incumbent_name = 'VACANT',
            status_of_appointment = NULL,
            updated_at = NOW()
          WHERE (dbm_item_no = $1 OR id::text = $1)
        `, [targetVacId]);

        // Revert tlo_assignments if applicable
        await client.query(`
          UPDATE tlo_assignments
          SET 
            tlo_masterlist_id = NULL,
            status = 'Inactive',
            updated_at = NOW()
          WHERE (tlo_position_id = $1 OR id::text = $1)
        `, [targetVacId]);

        // Revert vacancy_applicants registration_status
        if (application.vacancy_applicant_id) {
          await client.query(`
            UPDATE vacancy_applicants
            SET registration_status = 'Active', updated_at = NOW()
            WHERE id = $1
          `, [application.vacancy_applicant_id]);
        }
      }

      await client.query('COMMIT');
      return res.json({ success: true, data: updateRes.rows[0] });
    }

    // --- APPOINTMENT WORKFLOW ---
    await client.query('BEGIN');

    // Check applicant profile in vacancy_applicants
    let applicantRow = null;
    if (application.vacancy_applicant_id) {
      const vAppRes = await client.query('SELECT * FROM vacancy_applicants WHERE id = $1', [application.vacancy_applicant_id]);
      if (vAppRes.rows.length > 0) applicantRow = vAppRes.rows[0];
    }
    if (!applicantRow && (application.email || application.applicant_uid)) {
      const vAppRes = await client.query(
        'SELECT * FROM vacancy_applicants WHERE LOWER(email) = LOWER($1) OR applicant_uid = $2 ORDER BY id DESC LIMIT 1',
        [application.email, application.applicant_uid]
      );
      if (vAppRes.rows.length > 0) applicantRow = vAppRes.rows[0];
    }

    const vacancyApplicantId = applicantRow?.id || application.vacancy_applicant_id || null;

    // Check if official is already recorded in third_level_official_masterlist by vacancy_applicant_id or email
    let assignedTloId = null;
    let existingMasterRecord = null;
    if (vacancyApplicantId) {
      const existingMasterById = await client.query(
        `SELECT "TLOid", position_title, plantilla_item_no FROM third_level_official_masterlist WHERE vacancy_applicant_id = $1 AND status != 'Inactive' LIMIT 1`,
        [vacancyApplicantId]
      );
      if (existingMasterById.rows.length > 0) {
        assignedTloId = existingMasterById.rows[0].TLOid;
        existingMasterRecord = existingMasterById.rows[0];
      }
    }

    if (!assignedTloId && application.email) {
      const existingMasterByEmail = await client.query(
        `SELECT "TLOid", position_title, plantilla_item_no FROM third_level_official_masterlist WHERE LOWER(email) = LOWER($1) AND status != 'Inactive' LIMIT 1`,
        [application.email]
      );
      if (existingMasterByEmail.rows.length > 0) {
        assignedTloId = existingMasterByEmail.rows[0].TLOid;
        existingMasterRecord = existingMasterByEmail.rows[0];
      }
    }

    // STRICT POLICY: Do NOT allow reappointing applicant to other positions if already in masterlist
    if (existingMasterRecord) {
      const isSamePlantilla = existingMasterRecord.plantilla_item_no && targetVacId && String(existingMasterRecord.plantilla_item_no).trim() === String(targetVacId).trim();
      if (!isSamePlantilla && previousStatus !== 'Appointed') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Cannot reappoint to other position. This applicant is already appointed as ${assignedTloId} for position "${existingMasterRecord.position_title || existingMasterRecord.plantilla_item_no}" in the Official Masterlist.`
        });
      }
    }

    // Generate new TLOid if none exists
    if (!assignedTloId) {
      const mlUidRes = await client.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING("TLOid" FROM 5) AS INTEGER)), 0) AS max_num
        FROM third_level_official_masterlist WHERE "TLOid" ~ '^TLO-[0-9]{4}$'
      `);
      const nextNum = parseInt(mlUidRes.rows[0].max_num) + 1;
      assignedTloId = `TLO-${String(nextNum).padStart(4, '0')}`;
    }

    const isTest = Boolean(application.is_testaccount || applicantRow?.is_testaccount || req.user?.is_testaccount);
    const firstName = application.first_name || applicantRow?.first_name || 'OFFICIAL';
    const lastName = application.surname || applicantRow?.last_name || 'USER';
    const middleName = application.middle_name || applicantRow?.middle_name || null;
    const suffix = applicantRow?.suffix || null;
    const email = (application.email || applicantRow?.email || '').toLowerCase().trim();
    const contact = application.contact_number || applicantRow?.contact_number || null;
    const positionTitle = application.position_applying_for || applicantRow?.target_position_title || 'Third Level Official';
    const office = application.assigned_oic_office || application.plantilla_office || 'Department of Education';

    // Format full incumbent name for plantilla assignment
    const middleInitial = middleName && middleName.trim() ? ` ${middleName.trim().charAt(0).toUpperCase()}.` : '';
    const incumbentName = `${lastName.toUpperCase().trim()}, ${firstName.toUpperCase().trim()}${middleInitial}`.trim();

    // Insert or update third_level_official_masterlist (stores vacancy_applicant_id and plantilla_item_no)
    const existingCheck = await client.query(
      'SELECT "TLOid" FROM third_level_official_masterlist WHERE "TLOid" = $1',
      [assignedTloId]
    );

    if (existingCheck.rows.length > 0) {
      await client.query(`
        UPDATE third_level_official_masterlist SET
          vacancy_applicant_id = COALESCE($1, vacancy_applicant_id),
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          middle_name = COALESCE($4, middle_name),
          suffix = COALESCE($5, suffix),
          date_of_birth = COALESCE($6, date_of_birth),
          position_title = COALESCE($7, position_title),
          office = COALESCE($8, office),
          status = 'Active',
          appointment_status = 'Appointed',
          appointment_date = COALESCE(appointment_date, CURRENT_DATE),
          plantilla_item_no = COALESCE($9, plantilla_item_no),
          email = COALESCE($10, email),
          contact_details = COALESCE($11, contact_details),
          emt_passer = COALESCE($12, emt_passer),
          ces_stage = COALESCE($13, ces_stage),
          ces_conferment_date = COALESCE($14, ces_conferment_date),
          photo_binary_id = COALESCE($15, photo_binary_id),
          pds_binary_id = COALESCE($16, pds_binary_id),
          wes_binary_id = COALESCE($17, wes_binary_id),
          cv_binary_id = COALESCE($18, cv_binary_id),
          service_records_binary_id = COALESCE($19, service_records_binary_id),
          profile_word_binary_id = COALESCE($20, profile_word_binary_id),
          updated_at = NOW()
        WHERE "TLOid" = $21
      `, [
        vacancyApplicantId,
        firstName, lastName, middleName, suffix,
        application.date_of_birth || null,
        positionTitle, office,
        targetVacId,
        email, contact,
        Boolean(application.is_emt_passer),
        application.ces_eligibility_stage || null,
        application.ces_stage_date || null,
        application.id_picture_binary_id || null,
        application.pds_binary_id || null,
        application.work_experience_sheet_binary_id || null,
        application.cv_binary_id || null,
        application.service_records_binary_id || null,
        application.applicant_profile_doc_binary_id || null,
        assignedTloId
      ]);
    } else {
      await client.query(`
        INSERT INTO third_level_official_masterlist (
          "TLOid", vacancy_applicant_id, first_name, last_name, middle_name, suffix,
          date_of_birth, position_title, office,
          status, appointment_status, appointment_date, plantilla_item_no,
          email, contact_details,
          emt_passer, ces_stage, ces_conferment_date,
          photo_binary_id, pds_binary_id, wes_binary_id, cv_binary_id,
          service_records_binary_id, profile_word_binary_id,
          is_testaccount, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          'Active', 'Appointed', CURRENT_DATE, $10,
          $11, $12,
          $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21,
          $22, NOW(), NOW()
        )
      `, [
        assignedTloId, vacancyApplicantId, firstName, lastName, middleName, suffix,
        application.date_of_birth || null,
        positionTitle, office,
        targetVacId,
        email, contact,
        Boolean(application.is_emt_passer),
        application.ces_eligibility_stage || null,
        application.ces_stage_date || null,
        application.id_picture_binary_id || null,
        application.pds_binary_id || null,
        application.work_experience_sheet_binary_id || null,
        application.cv_binary_id || null,
        application.service_records_binary_id || null,
        application.applicant_profile_doc_binary_id || null,
        isTest
      ]);
    }

    // Insert or update tlo_masterlist demographic sync table
    const tmInsertRes = await client.query(`
      INSERT INTO tlo_masterlist (
        tloid, first_name, last_name, middle_name, suffix, plantilla_item_no, is_testaccount, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
      )
      ON CONFLICT (tloid) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        middle_name = EXCLUDED.middle_name,
        suffix = EXCLUDED.suffix,
        plantilla_item_no = COALESCE(EXCLUDED.plantilla_item_no, tlo_masterlist.plantilla_item_no),
        updated_at = NOW()
      RETURNING id
    `, [assignedTloId, firstName, lastName, middleName, suffix, targetVacId, isTest]);

    const numericMasterlistId = tmInsertRes.rows[0]?.id || null;

    // Update target vacancy status in plantilla / assignments
    if (targetVacId) {
      // 1. Mark position as occupied in ces_plantilla
      await client.query(`
        UPDATE ces_plantilla
        SET 
          is_vacant = false,
          incumbent_name = $1,
          status_of_appointment = 'Appointed',
          updated_at = NOW()
        WHERE (dbm_item_no = $2 OR id::text = $2)
      `, [incumbentName, targetVacId]);

      // 2. Occupy vacant position in tlo_assignments if present
      if (numericMasterlistId) {
        await client.query(`
          UPDATE tlo_assignments
          SET 
            tlo_masterlist_id = $1,
            status = 'Active',
            capacity = 'Full',
            start_date = CURRENT_DATE,
            end_date = NULL,
            remarks = 'Appointed via Vacancy Application',
            updated_at = NOW()
          WHERE (tlo_position_id = $2 OR id::text = $2) AND tlo_masterlist_id IS NULL
        `, [numericMasterlistId, targetVacId]);
      }
    }

    // Update registration_status on vacancy_applicants
    if (applicantRow?.id) {
      await client.query(`
        UPDATE vacancy_applicants SET
          registration_status = 'Appointed',
          updated_at = NOW()
        WHERE id = $1
      `, [applicantRow.id]);
    }

    // Update vacancy_applications (clean update with no extra columns)
    const updatedAppRes = await client.query(`
      UPDATE vacancy_applications SET
        status = 'Appointed',
        remarks = COALESCE($1, remarks),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [remarks, application.id]);

    // Escalate user role or provision account in tlo_users as TLO Applicant so appointed official can access the TLO portal
    if (email) {
      const existingUserRes = await client.query(
        `SELECT uid FROM tlo_users WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      if (existingUserRes.rows.length > 0) {
        await client.query(`
          UPDATE tlo_users 
          SET role = 'TLO Applicant', 
              registration_status = 'Active',
              passcode = COALESCE(tlo_users.passcode, $2)
          WHERE LOWER(email) = LOWER($1)
        `, [email, applicantRow?.passcode || null]);
      } else {
        await client.query(`
          INSERT INTO tlo_users (
            uid, email, password_hash, hash_version, first_name, last_name, contact_number, passcode,
            role, registration_status, is_testaccount, created_at
          ) VALUES ($1, $2, $3, 'bcrypt', $4, $5, $6, $7, 'TLO Applicant', 'Active', $8, NOW())
        `, [
          assignedTloId,
          email.toLowerCase().trim(),
          applicantRow?.password_hash || null,
          applicantRow?.first_name || application.first_name || '',
          applicantRow?.last_name || application.surname || '',
          applicantRow?.contact_number || application.contact_number || null,
          applicantRow?.passcode || null,
          Boolean(application.is_testaccount)
        ]);
      }
    }

    await client.query('COMMIT');

    // 4. Background cloud document relocation (Non-blocking async)
    const docsToRelocate = [
      { docType: 'id_picture', binaryId: application.id_picture_binary_id },
      { docType: 'pds', binaryId: application.pds_binary_id },
      { docType: 'work_experience_sheet', binaryId: application.work_experience_sheet_binary_id },
      { docType: 'cv', binaryId: application.cv_binary_id },
      { docType: 'service_records', binaryId: application.service_records_binary_id },
      { docType: 'applicant_profile_doc', binaryId: application.applicant_profile_doc_binary_id },
      { docType: 'letter_of_intent', binaryId: application.letter_of_intent_binary_id },
      { docType: 'outstanding_accomplishments', binaryId: application.outstanding_accomplishments_binary_id },
      { docType: 'transcript_of_records', binaryId: application.transcript_of_records_binary_id },
      { docType: 'performance_eval', binaryId: application.performance_eval_binary_id },
      { docType: 'self_certification', binaryId: application.self_certification_binary_id },
      { docType: 'other_documents', binaryId: application.other_documents_binary_id }
    ].filter(d => d.binaryId);

    (async () => {
      try {
        for (const doc of docsToRelocate) {
          const binRes = await pool.query('SELECT id, azure_blob_url FROM unified_binaries WHERE id = $1', [doc.binaryId]);
          if (binRes.rows.length > 0 && binRes.rows[0].azure_blob_url) {
            const oldUrl = binRes.rows[0].azure_blob_url;
            const copyRes = await copyBlobToTloid(oldUrl, assignedTloId, doc.docType);
            if (copyRes && copyRes.blobUrl) {
              await pool.query('UPDATE unified_binaries SET azure_blob_url = $1 WHERE id = $2', [copyRes.blobUrl, doc.binaryId]);
              console.log(`[Appointed Relocate] Updated binary ${doc.binaryId} to ${copyRes.blobUrl}`);
            }
          }
        }
      } catch (bgErr) {
        console.error('[Background Blob Relocation Error]:', bgErr.message);
      }
    })();

    return res.json({
      success: true,
      message: `Applicant successfully appointed as ${assignedTloId} and promoted to Masterlist`,
      data: {
        ...updatedAppRes.rows[0],
        appointed_tlo_id: assignedTloId
      },
      tlo_id: assignedTloId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[updateVacancyApplicationStatus Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while updating application status: ' + err.message });
  } finally {
    client.release();
  }
};


