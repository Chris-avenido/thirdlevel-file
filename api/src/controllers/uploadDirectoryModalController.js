import pool from '../config/db.js';

const ensureColumns = async (client) => {
  const masterRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='third_level_official_masterlist'`);
  const masterCols = masterRes.rows.map(r => r.column_name);
  if (!masterCols.includes('designation')) await client.query('ALTER TABLE third_level_official_masterlist ADD COLUMN designation VARCHAR(255);');

  const updatesRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='third_level_officials_updates'`);
  const updatesCols = updatesRes.rows.map(r => r.column_name);
  if (!updatesCols.includes('designation')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN designation VARCHAR(255);');
  if (!updatesCols.includes('contact_details')) await client.query('ALTER TABLE third_level_officials_updates ADD COLUMN contact_details VARCHAR(255);');
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

    const allMasterRes = await client.query('SELECT * FROM third_level_official_masterlist');
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
      noEmailInserted: [],
      noEmailUpdated: [],
      skipped: [],
      failed: [],
      summary: { total: records.length, new: 0, updated: 0, noEmailInserted: 0, noEmailUpdated: 0, skipped: 0, failed: 0 }
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

        let match = null;

        if (isNoEmail) {
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
          const existingTloId = match.TLOid;
          toUpdate.push({
            TLOid: existingTloId,
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            position_title: record.position_title || '',
            office: record.office || '',
            strand: record.strand || '',
            designation: record.designation || '',
            contact_details: record.contact_details || '',
          });

          toHistory.push({
            TLOid: existingTloId,
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            position_title: record.position_title || '',
            office: record.office || '',
            strand: record.strand || '',
            designation: record.designation || '',
            email: emailToInsert,
            contact_details: record.contact_details || '',
            change_type: 'Update',
            remarks: isNoEmail ? 'Existing Record Updated (No Email)' : 'Update Record Inserted'
          });

          if (isNoEmail) {
            results.noEmailUpdated.push(record);
            results.summary.noEmailUpdated++;
          } else {
            results.updates.push(record);
            results.summary.updated++;
          }
        } else {
          const newTloId = `TLO-${String(nextTloIdNum++).padStart(4, '0')}`;
          toInsert.push({
            TLOid: newTloId,
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            position_title: record.position_title || '',
            office: record.office || '',
            strand: record.strand || '',
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
            strand: record.strand || '',
            designation: record.designation || '',
            email: emailToInsert,
            contact_details: record.contact_details || '',
            change_type: 'Initial',
            remarks: isNoEmail ? 'New Record Inserted (No Email)' : 'New Record Inserted'
          });

          if (isNoEmail) {
            results.noEmailInserted.push(record);
            results.summary.noEmailInserted++;
          } else {
            results.newInserts.push(record);
            results.summary.new++;
          }
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
          strand = c.strand,
          designation = c.designation,
          contact_details = c.contact_details,
          updated_at = NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, strand text, designation text, contact_details text
        )
        WHERE m."TLOid" = c."TLOid"
      `, [JSON.stringify(toUpdate)]);
    }

    if (toInsert.length > 0) {
      await client.query(`
        INSERT INTO third_level_official_masterlist (
          "TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, created_at, updated_at
        )
        SELECT 
          "TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, 'Active', NOW(), NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, strand text, designation text, email text, contact_details text
        )
      `, [JSON.stringify(toInsert)]);
    }

    if (toHistory.length > 0) {
      await client.query(`
        INSERT INTO third_level_officials_updates (
          "TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, change_type, remarks, updated_at
        )
        SELECT 
          "TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, 'Active', change_type, remarks, NOW()
        FROM json_to_recordset($1::json) AS c(
          "TLOid" text, first_name text, last_name text, position_title text,
          office text, strand text, designation text, email text, contact_details text,
          change_type text, remarks text
        )
      `, [JSON.stringify(toHistory)]);
    }

    await client.query('COMMIT');
    
    console.log(`\n--- BULK UPLOAD SUMMARY ---`);
    console.log(`Total Uploaded Records: ${results.summary.total}`);
    console.log(`Total Inserted Records: ${results.summary.new + results.summary.noEmailInserted}`);
    console.log(`Total Updated Records: ${results.summary.updated + results.summary.noEmailUpdated}`);
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
          await client.query('UPDATE notable_achievements SET achievement = $1 WHERE index_number = $2', [achievement, index_number]);
          results.summary.updated++;
        } else {
          await client.query('INSERT INTO notable_achievements (index_number, achievement) VALUES ($1, $2)', [index_number, achievement]);
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

