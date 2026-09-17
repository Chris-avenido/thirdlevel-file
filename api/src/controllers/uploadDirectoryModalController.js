import pool from '../config/db.js';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const ensureColumns = async (client) => {
  const masterRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='third_level_official_masterlist'`);
  const masterCols = masterRes.rows.map(r => r.column_name);
  if (!masterCols.includes('designation')) await client.query('ALTER TABLE third_level_official_masterlist ADD COLUMN designation VARCHAR(255);');
  if (!masterCols.includes('region')) await client.query('ALTER TABLE third_level_official_masterlist ADD COLUMN region VARCHAR(255);');
  if (!masterCols.includes('division')) await client.query('ALTER TABLE third_level_official_masterlist ADD COLUMN division VARCHAR(255);');

  const updatesRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='third_level_officials_updates'`);
  const updatesCols = updatesRes.rows.map(r => r.column_name);
  if (!updatesCols.includes('designation')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN designation VARCHAR(255);');
  if (!updatesCols.includes('contact_details')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN contact_details VARCHAR(255);');
  if (!updatesCols.includes('region')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN region VARCHAR(255);');
  if (!updatesCols.includes('division')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN division VARCHAR(255);');
};

export const bulkProcessDirectory = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { records } = req.body;
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid records payload' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureColumns(client);

    const isTest = Boolean(req.user?.is_testaccount);
    const allMasterRes = await client.query('SELECT * FROM third_level_official_masterlist WHERE is_testaccount = $1', [isTest]);
    const allMaster = allMasterRes.rows;

    const maxTloRes = await client.query(`
      SELECT "TLOid" FROM third_level_official_masterlist 
      WHERE "TLOid" LIKE 'TLO-%' 
      ORDER BY CAST(SUBSTRING("TLOid" FROM 5) AS INTEGER) DESC LIMIT 1
    `);
    
    let nextTloIdNum = 1;
    if (maxTloRes.rows.length > 0) {
      const match = maxTloRes.rows[0].TLOid.match(/TLO-(\d+)/);
      if (match) {
        nextTloIdNum = parseInt(match[1]) + 1;
      }
    }

    const results = {
      newInserts: [],
      updates: [],
      skipped: [],
      failed: [],
      summary: { total: records.length, new: 0, updated: 0, skipped: 0, failed: 0 }
    };

    const emptyEmails = [null, '', 'n/a', 'na'];
    const toUpdate = [];
    const toInsert = [];
    const toHistory = [];

    for (const record of records) {
      try {
        const emailStrRaw = record.email !== undefined && record.email !== null ? String(record.email).trim().toLowerCase() : '';
        const isNoEmail = emptyEmails.includes(emailStrRaw);
        const emailToInsert = isNoEmail ? null : record.email;

        if (record.TLOid === 'VACANT-TEST-1') {
          results.skipped.push({ rowNum: record.rowNum, full_name: record.full_name, email: record.email, reason: 'Skipped VACANT-TEST-1' });
          results.summary.skipped++;
          continue;
        }

        let match = null;

        if (record.TLOid) {
          match = allMaster.find(m => m.TLOid === record.TLOid);
        } else if (isNoEmail) {
          match = allMaster.find(m => 
            ((m.first_name || '').toLowerCase() === (record.first_name || '').toLowerCase() &&
             (m.last_name || '').toLowerCase() === (record.last_name || '').toLowerCase() && record.first_name)
            ||
            ((m.strand || '') === (record.strand || '') &&
             (m.office || '') === (record.office || '') &&
             (m.position_title || '') === (record.position_title || '') && record.position_title)
          );
        } else {
          match = allMaster.find(m => (m.email || '').toLowerCase() === emailStrRaw);
        }

        if (match) {
          // DO NOT update records. Instead, just count them as existing.
          results.updates.push(record);
          results.summary.updated++;
        } else {
          const newTloId = record.TLOid || `TLO-${String(nextTloIdNum++).padStart(4, '0')}`;
          toInsert.push({
            TLOid: newTloId,
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            position_title: record.position_title || '',
            office: record.office || '',
            division: record.division || '',
            strand: record.strand || '',
            region: record.region || '',
            designation: record.designation || '',
            email: emailToInsert,
            contact_details: record.contact_details || '',
          });

          toHistory.push({
            TLOid: newTloId,
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            position_title: record.position_title || '',
            office: record.office || '',
            division: record.division || '',
            strand: record.strand || '',
            region: record.region || '',
            designation: record.designation || '',
            email: emailToInsert,
            contact_details: record.contact_details || '',
            change_type: 'Initial',
            remarks: isNoEmail ? 'New Record Inserted (No Email)' : 'New Record Inserted'
          });

          results.newInserts.push(record);
          results.summary.new++;
        }
      } catch (err) {
        results.failed.push({ record, error: err.message });
        results.summary.failed++;
      }
    }

    if (toUpdate.length > 0) {
      await client.query(`
        UPDATE third_level_official_masterlist AS m
        SET 
          first_name = c.first_name,
          last_name = c.last_name,
          position_title = c.position_title,
          office = c.office,
          division = c.division,
          strand = c.strand,
          region = c.region,
          designation = c.designation,
          contact_details = c.contact_details,
          updated_at = NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, division text, strand text, region text, designation text, contact_details text
        )
        WHERE m."TLOid" = c."TLOid" AND m.is_testaccount = $2
      `, [JSON.stringify(toUpdate), isTest]);
    }

    if (toInsert.length > 0) {
      await client.query(`
        INSERT INTO third_level_official_masterlist (
          "TLOid", first_name, last_name, position_title, office, division, strand, region, designation, email, contact_details, status, is_testaccount, created_at, updated_at
        )
        SELECT 
          "TLOid", first_name, last_name, position_title, office, division, strand, region, designation, email, contact_details, 'Active', $2, NOW(), NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, division text, strand text, region text, designation text, email text, contact_details text
        )
      `, [JSON.stringify(toInsert), isTest]);

      await client.query(`
        INSERT INTO tlo_masterlist (
          tloid, first_name, last_name, created_at, updated_at
        )
        SELECT 
          "TLOid", first_name, last_name, NOW(), NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text
        )
        WHERE NOT (
          UPPER(TRIM(COALESCE(c.first_name, ''))) LIKE '%VACANT%'
          OR UPPER(TRIM(COALESCE(c.last_name, ''))) LIKE '%VACANT%'
          OR ((c.first_name IS NULL OR TRIM(c.first_name) = '') AND (c.last_name IS NULL OR TRIM(c.last_name) = ''))
        )
        ON CONFLICT (tloid) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = NOW()
      `, [JSON.stringify(toInsert)]);
    }

    if (toHistory.length > 0) {
      await client.query(`
        INSERT INTO third_level_officials_updates (
          "TLOid", first_name, last_name, position_title, office, division, strand, region, designation, email, contact_details, status, change_type, remarks, updated_at
        )
        SELECT 
          "TLOid", first_name, last_name, position_title, office, division, strand, region, designation, email, contact_details, 'Active', change_type, remarks, NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, division text, strand text, region text, designation text, email text, contact_details text,
          change_type text, remarks text
        )
      `, [JSON.stringify(toHistory)]);
    }

    await client.query('COMMIT');
    
    console.log(`\n--- BULK UPLOAD SUMMARY ---`);
    console.log(`Total Uploaded Records: ${results.summary.total}`);
    console.log(`Total Inserted Records: ${results.summary.new}`);
    console.log(`Total Updated Records: ${results.summary.updated}`);
    console.log(`Total Skipped Records: ${results.summary.skipped}`);
    console.log(`Total Failed Records: ${results.summary.failed}`);
    
    if (results.skipped.length > 0) {
      console.log(`\nSkipped Records:`);
      results.skipped.forEach(r => console.log(`- Row ${r.rowNum || '?'}: ${r.full_name || ''} [${r.email || ''}] (Reason: Already Exists/Skipped)`));
    }
    
    if (results.failed.length > 0) {
      console.log(`\nFailed Records:`);
      results.failed.forEach(r => console.log(`- Row ${r.record.rowNum || '?'}: ${r.record.full_name || ''} [${r.record.email || ''}] (Reason: ${r.error})`));
    }
    console.log(`---------------------------\n`);

    res.json({ success: true, results });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

export const bulkProcessAchievements = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office'];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { records } = req.body;
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid records payload' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const results = {
      summary: { total: records.length, inserted: 0, updated: 0, failed: 0 }
    };

    for (const record of records) {
      try {
        const index_number = parseInt(record.index_number, 10);
        const achievement = record.achievements || record.achievement;

        if (isNaN(index_number) || !achievement) {
          throw new Error('Missing index_number or achievement');
        }

        const existingRes = await client.query('SELECT index_number FROM notable_achievements WHERE index_number = $1', [index_number]);
        
        if (existingRes.rows.length > 0) {
          await client.query('UPDATE notable_achievements SET achievement = $1, delete_flg = 0, edit_date = CURRENT_TIMESTAMP WHERE index_number = $2', [achievement, index_number]);
          results.summary.updated++;
        } else {
          await client.query('INSERT INTO notable_achievements (index_number, achievement, delete_flg, create_date, edit_date) VALUES ($1, $2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [index_number, achievement]);
          results.summary.inserted++;
        }
      } catch (err) {
        results.summary.failed++;
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, results });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * POST /api/third-level/import-positions-and-assignments
 * POST /api/third-level/import-plantilla-positions
 * 
 * 1. Truncates tlo_positions (TRUNCATE TABLE tlo_positions RESTART IDENTITY CASCADE;)
 * 2. Populates distinct position catalog records into tlo_positions
 * 3. Upserts plantilla personnel records into tlo_plantilla
 * 4. Deactivates pre-existing active assignments for matching items (status = 'Inactive', end_date = CURRENT_DATE)
 * 5. Appends active assignment records in tlo_assignments with FKs to tlo_positions and tlo_masterlist
 */
export const importPositionsAndBuildAssignments = async (req, res) => {
  const adminRoles = ['Personnel Admin', 'Admin', 'Super User', 'Central Office', 'CO_PD', 'Regional Office', 'School Division Office'];
  if (!adminRoles.includes(req.user?.role) && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Insufficient administrative privileges.' });
  }

  let plantillaRows = [];
  let positionsRows = [];

  // 1. Check if files were uploaded via Multer
  if (req.files) {
    const pFile = req.files['plantilla_file']?.[0] || req.files['plantilla']?.[0];
    const posFile = req.files['positions_file']?.[0] || req.files['positions']?.[0];

    if (pFile) {
      const wb1 = xlsx.read(pFile.buffer, { type: 'buffer' });
      plantillaRows = xlsx.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { defval: '' });
    }
    if (posFile) {
      const wb2 = xlsx.read(posFile.buffer, { type: 'buffer' });
      positionsRows = xlsx.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { defval: '' });
    }
  }

  // 2. If JSON body was provided instead
  if (!plantillaRows.length && req.body.plantilla_records) {
    plantillaRows = req.body.plantilla_records;
  }
  if (!positionsRows.length && req.body.position_records) {
    positionsRows = req.body.position_records;
  }
  if (!plantillaRows.length && !positionsRows.length && Array.isArray(req.body.records)) {
    // If a single combined records array was provided
    plantillaRows = req.body.records;
    positionsRows = req.body.records;
  }

  // 3. Fallback to default CSV files in database/data/ if available and not supplied
  if (!positionsRows.length) {
    try {
      const defaultPosPath = path.resolve(process.cwd(), 'database/data/tlo_positions.csv');
      if (fs.existsSync(defaultPosPath)) {
        const fileBuf = fs.readFileSync(defaultPosPath);
        const wb = xlsx.read(fileBuf, { type: 'buffer' });
        positionsRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
    } catch (e) {
      console.warn('Could not read default tlo_positions.csv:', e.message);
    }
  }

  if (!plantillaRows.length) {
    try {
      const defaultPlantillaPath = path.resolve(process.cwd(), 'database/data/tlo_plantilla_positions.csv');
      if (fs.existsSync(defaultPlantillaPath)) {
        const fileBuf = fs.readFileSync(defaultPlantillaPath);
        const wb = xlsx.read(fileBuf, { type: 'buffer' });
        plantillaRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
    } catch (e) {
      console.warn('Could not read default tlo_plantilla_positions.csv:', e.message);
    }
  }

  const maxLen = Math.max(plantillaRows.length, positionsRows.length);
  if (maxLen === 0) {
    return res.status(400).json({ error: 'No plantilla or position records provided for import.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // STEP 1: Safely drop FK constraints before truncating tlo_positions to avoid cascading deletion of assignments
    await client.query('ALTER TABLE tlo_assignments DROP CONSTRAINT IF EXISTS tlo_assignments_position_id_fkey;');
    await client.query('ALTER TABLE tlo_plantilla DROP CONSTRAINT IF EXISTS fk_plantilla_position;');
    await client.query('TRUNCATE TABLE tlo_positions RESTART IDENTITY;');

    const cleanStr = (val) => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      if (!s || s === 'null' || s === 'undefined' || s === '#VALUE!' || s === '#N/A' || s === '#REF!' || s === '—') return null;
      return s;
    };

    const cleanSalary = (val) => {
      if (!val) return null;
      const s = String(val).replace(/[^0-9.]/g, '').trim();
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // Helper to determine standard salary grade
    const getStandardSG = (title) => {
      if (!title) return null;
      const upper = title.toUpperCase();
      if (upper === 'SECRETARY') return '31';
      if (upper === 'UNDERSECRETARY') return '30';
      if (upper === 'ASSISTANT SECRETARY') return '29';
      if (upper === 'DIRECTOR IV' || upper === 'REGIONAL DIRECTOR') return '28';
      if (upper === 'DIRECTOR III' || upper === 'ASSISTANT REGIONAL DIRECTOR') return '27';
      if (upper === 'SCHOOLS DIVISION SUPERINTENDENT') return '26';
      if (upper === 'ASSISTANT SCHOOLS DIVISION SUPERINTENDENT') return '25';
      return null;
    };

    // Helper to determine position code
    const getPosCode = (title) => {
      if (!title) return null;
      const upper = title.toUpperCase();
      if (upper.includes('SECRETARY') && !upper.includes('UNDER') && !upper.includes('ASSISTANT')) return 'SEC';
      if (upper.includes('UNDERSECRETARY')) return 'USEC';
      if (upper.includes('ASSISTANT SECRETARY')) return 'ASEC';
      if (upper.includes('DIRECTOR IV')) return 'DIR4';
      if (upper.includes('DIRECTOR III')) return 'DIR3';
      if (upper.includes('REGIONAL DIRECTOR') && !upper.includes('ASSISTANT')) return 'RD';
      if (upper.includes('ASSISTANT REGIONAL DIRECTOR')) return 'ARD';
      if (upper.includes('SCHOOLS DIVISION SUPERINTENDENT') && !upper.includes('ASSISTANT')) return 'SDS';
      if (upper.includes('ASSISTANT SCHOOLS DIVISION SUPERINTENDENT')) return 'ASDS';
      return null;
    };

    // Standard position title mapping to ensure consistent casing
    const normalizeTitle = (title) => {
      if (!title) return 'Unassigned Position';
      const upper = title.toUpperCase();
      if (upper === 'SECRETARY') return 'Secretary';
      if (upper === 'UNDERSECRETARY') return 'Undersecretary';
      if (upper === 'ASSISTANT SECRETARY') return 'Assistant Secretary';
      if (upper === 'DIRECTOR IV') return 'Director IV';
      if (upper === 'DIRECTOR III') return 'Director III';
      if (upper === 'REGIONAL DIRECTOR') return 'Regional Director';
      if (upper === 'ASSISTANT REGIONAL DIRECTOR') return 'Assistant Regional Director';
      if (upper === 'SCHOOLS DIVISION SUPERINTENDENT') return 'Schools Division Superintendent';
      if (upper === 'ASSISTANT SCHOOLS DIVISION SUPERINTENDENT') return 'Assistant Schools Division Superintendent';
      return title;
    };

    // STEP 2: Ingest ALL available positions with region, division, bureau, position_title, position_code, salary_grade
    const insertedPositionIds = [];
    for (let i = 0; i < maxLen; i++) {
      const posRow = positionsRows[i] || {};
      const pRow = plantillaRows[i] || {};

      const region = cleanStr(posRow.region || pRow.region);
      const division = cleanStr(posRow.division || pRow.division);
      const bureau = cleanStr(posRow.bureau || posRow.office || pRow.bureau || pRow.office);
      const rawTitle = cleanStr(posRow.position_title || posRow.position || pRow.position_title || pRow.position) || 'Unassigned Position';
      const positionTitle = normalizeTitle(rawTitle);
      const posCode = getPosCode(positionTitle);
      const salaryGrade = cleanStr(posRow.salary_grade || pRow.salary_grade || pRow.sg) || getStandardSG(positionTitle);

      const insPos = await client.query(
        `INSERT INTO tlo_positions (position_title, position_code, salary_grade, region, division, bureau, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
        [positionTitle, posCode, salaryGrade, region, division, bureau]
      );
      insertedPositionIds.push(insPos.rows[0].id);
    }

    let processedCount = 0;
    let insertedPlantilla = 0;
    let updatedPlantilla = 0;
    let assignmentsCreated = 0;
    let deactivatedAssignments = 0;

    const actor = req.user?.email || req.user?.username || 'SYSTEM_BULK_IMPORT';

    for (let i = 0; i < maxLen; i++) {
      const pRow = plantillaRows[i] || {};
      const posRow = positionsRows[i] || {};

      const permanentItemNo = cleanStr(
        pRow.permanent_item_no || pRow.item_number || pRow.dbm_item_no || pRow.item_no || posRow.permanent_item_no || posRow.item_number
      );
      const salaryGrade = cleanStr(pRow.salary_grade || pRow.sg || posRow.salary_grade || posRow.sg);
      const employmentType = cleanStr(pRow.employment_type || pRow.status_of_appointment) || 'PLANTILLA';
      const lastName = cleanStr(pRow.last_name || pRow.surname);
      const firstName = cleanStr(pRow.first_name || pRow.given_name);
      const middleName = cleanStr(pRow.middle_name || pRow.mi);
      const suffix = cleanStr(pRow.suffix);
      const prefix = cleanStr(pRow.prefix);
      const gender = cleanStr(pRow.gender || pRow.sex);
      const salary = cleanSalary(pRow.salary);

      const region = cleanStr(posRow.region || pRow.region);
      const division = cleanStr(posRow.division || pRow.division);
      const bureau = cleanStr(posRow.bureau || posRow.office || pRow.bureau || pRow.office);
      const rawTitle = cleanStr(posRow.position_title || posRow.position || pRow.position_title || pRow.position) || 'Unassigned Position';
      const positionTitle = normalizeTitle(rawTitle);

      // Skip row if completely empty
      if (!permanentItemNo && !positionTitle && !lastName && !firstName && !region) {
        continue;
      }

      // 1. Resolve Position ID from the matched position slot
      const positionId = insertedPositionIds[i] || null;

      // 2. Upsert tlo_plantilla (linking position_id directly)
      let plantillaId = null;
      const isPlaceholder = !permanentItemNo || ['NEW ITEM', 'DETAILED', 'N/A', 'N/A (DETAILED)'].includes(permanentItemNo.toUpperCase());
      const isVacant = !lastName || lastName.toUpperCase() === 'VACANT' || lastName.toUpperCase() === 'VACANT POSITION';

      if (permanentItemNo && !isPlaceholder) {
        const plantRes = await client.query(
          `INSERT INTO tlo_plantilla (
             permanent_item_no, first_name, middle_name, last_name,
             suffix, prefix, gender, employment_type, salary_grade, salary, position_id,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
           ON CONFLICT (permanent_item_no) WHERE permanent_item_no IS NOT NULL 
             AND permanent_item_no != '' 
             AND UPPER(permanent_item_no) NOT IN ('NEW ITEM', 'DETAILED', 'N/A', 'N/A (DETAILED)')
           DO UPDATE SET
             first_name = COALESCE(EXCLUDED.first_name, tlo_plantilla.first_name),
             middle_name = COALESCE(EXCLUDED.middle_name, tlo_plantilla.middle_name),
             last_name = COALESCE(EXCLUDED.last_name, tlo_plantilla.last_name),
             suffix = COALESCE(EXCLUDED.suffix, tlo_plantilla.suffix),
             prefix = COALESCE(EXCLUDED.prefix, tlo_plantilla.prefix),
             gender = COALESCE(EXCLUDED.gender, tlo_plantilla.gender),
             employment_type = COALESCE(EXCLUDED.employment_type, tlo_plantilla.employment_type),
             salary_grade = COALESCE(EXCLUDED.salary_grade, tlo_plantilla.salary_grade),
             salary = COALESCE(EXCLUDED.salary, tlo_plantilla.salary),
             position_id = COALESCE(EXCLUDED.position_id, tlo_plantilla.position_id),
             updated_at = NOW()
           RETURNING id`,
          [permanentItemNo, isVacant ? null : firstName, isVacant ? null : middleName, isVacant ? null : lastName, suffix, prefix, gender, employmentType, salaryGrade, salary, isVacant ? null : positionId]
        );
        plantillaId = plantRes.rows[0].id;
        insertedPlantilla++;
      } else if (!isVacant || isPlaceholder) {
        // Placeholder item number (e.g. 'NEW ITEM', 'DETAILED')
        let existingByName = null;
        if (!isVacant && lastName && firstName) {
          const byNameRes = await client.query(
            'SELECT id FROM tlo_plantilla WHERE LOWER(last_name) = LOWER($1) AND LOWER(first_name) = LOWER($2)',
            [lastName, firstName]
          );
          if (byNameRes.rows.length > 0) existingByName = byNameRes.rows[0].id;
        }

        if (existingByName) {
          plantillaId = existingByName;
          await client.query(
            `UPDATE tlo_plantilla
             SET middle_name = COALESCE($1, middle_name),
                 suffix = COALESCE($2, suffix),
                 prefix = COALESCE($3, prefix),
                 gender = COALESCE($4, gender),
                 employment_type = COALESCE($5, employment_type),
                 salary_grade = COALESCE($6, salary_grade),
                 salary = COALESCE($7, salary),
                 permanent_item_no = COALESCE($8, permanent_item_no),
                 position_id = COALESCE($9, position_id),
                 updated_at = NOW()
             WHERE id = $10`,
            [middleName, suffix, prefix, gender, employmentType, salaryGrade, salary, permanentItemNo, isVacant ? null : positionId, plantillaId]
          );
          updatedPlantilla++;
        } else {
          const newPlantilla = await client.query(
            `INSERT INTO tlo_plantilla (
               permanent_item_no, first_name, middle_name, last_name,
               suffix, prefix, gender, employment_type, salary_grade, salary, position_id,
               created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
             RETURNING id`,
            [permanentItemNo, isVacant ? null : firstName, isVacant ? null : middleName, isVacant ? null : lastName, suffix, prefix, gender, employmentType, salaryGrade, salary, isVacant ? null : positionId]
          );
          plantillaId = newPlantilla.rows[0].id;
          insertedPlantilla++;
        }
      }

      // 3. Deactivate pre-existing active assignments for matching item
      if (permanentItemNo && !isPlaceholder) {
        const deactRes = await client.query(
          `UPDATE tlo_assignments
           SET status = 'Inactive',
               end_date = COALESCE(end_date, CURRENT_DATE),
               updated_at = NOW(),
               updated_by = $1
           WHERE status = 'Active'
             AND tlo_position_id = $2`,
          [actor, permanentItemNo]
        );
        deactivatedAssignments += deactRes.rowCount;
      }

      // 4. Resolve masterlist identity and append new assignment ledger record
      let masterlistId = null;
      if (!isVacant && (lastName || firstName)) {
        const mRes = await client.query(
          `SELECT id FROM tlo_masterlist 
           WHERE tloid = $1 OR (LOWER(TRIM(last_name)) = LOWER(TRIM($2)) AND LOWER(TRIM(first_name)) = LOWER(TRIM($3)))
           LIMIT 1`,
          [permanentItemNo, lastName, firstName]
        );
        if (mRes.rows.length > 0) {
          masterlistId = mRes.rows[0].id;
        }
      }

      const assignmentStatus = isVacant ? 'Inactive' : 'Active';

      await client.query(
        `INSERT INTO tlo_assignments (
           tlo_position_id,
           position_id,
           tlo_masterlist_id,
           status,
           capacity,
           start_date,
           remarks,
           created_by,
           updated_by,
           created_at,
           updated_at
         ) VALUES ($1, $2, $3, $4, 'Full', CURRENT_DATE, $5, $6, $6, NOW(), NOW())`,
        [
          permanentItemNo,
          positionId,
          masterlistId,
          assignmentStatus,
          isVacant ? 'Official Plantilla Vacancy' : `Official Assignment for ${lastName || 'Personnel'}`,
          actor
        ]
      );
      assignmentsCreated++;
      processedCount++;
    }

    // Re-link tlo_masterlist_id across all assignments where tlo_position_id matches tloid
    await client.query(`
      UPDATE tlo_assignments a
      SET tlo_masterlist_id = m.id
      FROM tlo_masterlist m
      WHERE a.tlo_position_id = m.tloid
        AND a.tlo_masterlist_id IS NULL;
    `);

    // Safely re-add FK constraint to tlo_positions
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tlo_assignments_position_id_fkey'
        ) THEN
          ALTER TABLE tlo_assignments
          ADD CONSTRAINT tlo_assignments_position_id_fkey
          FOREIGN KEY (position_id) REFERENCES tlo_positions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'All available positions imported with regional structure, and personnel FKs linked successfully.',
      summary: {
        totalRows: maxLen,
        processed: processedCount,
        positionsImported: insertedPositionIds.length,
        insertedPlantilla,
        updatedPlantilla,
        deactivatedAssignments,
        assignmentsCreated
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during importPositionsAndBuildAssignments:', err);
    res.status(500).json({ error: 'Failed to import positions and assignments: ' + err.message });
  } finally {
    client.release();
  }
};

export const bulkImportPlantillaAndPositions = importPositionsAndBuildAssignments;



