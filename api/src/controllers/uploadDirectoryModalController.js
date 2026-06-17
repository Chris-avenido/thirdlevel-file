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

    for (const record of records) {
      try {
        const emailStrRaw = record.email !== undefined && record.email !== null ? String(record.email).trim().toLowerCase() : '';
        const isNoEmail = emptyEmails.includes(emailStrRaw);
        const emailToInsert = isNoEmail ? null : record.email;

        const tloid = `TLO-${String(nextTloIdNum).padStart(4, '0')}`;

        if (isNoEmail) {
          const matchRes = await client.query(`
            SELECT "TLOid" FROM third_level_official_masterlist 
            WHERE 
              (LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) AND first_name != '')
              OR
              (COALESCE(strand, '') = COALESCE($3, '') 
               AND COALESCE(office, '') = COALESCE($4, '') 
               AND COALESCE(position_title, '') = COALESCE($5, '')
               AND position_title != '')
            LIMIT 1
          `, [record.first_name, record.last_name, record.strand, record.office, record.position_title]);

          if (matchRes.rows.length > 0) {
            const existingTloId = matchRes.rows[0].TLOid;
            
            await client.query(`
              UPDATE third_level_official_masterlist 
              SET first_name = $1, last_name = $2, position_title = $3, office = $4, strand = $5, designation = $6, contact_details = $7, updated_at = NOW()
              WHERE "TLOid" = $8
            `, [record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', record.contact_details || '', existingTloId]);

            await client.query(`
              INSERT INTO third_level_officials_updates
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, change_type, remarks, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', 'Update', 'Existing Record Updated (No Email)', NOW())
            `, [existingTloId, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', emailToInsert, record.contact_details || '']);

            results.noEmailUpdated.push(record);
            results.summary.noEmailUpdated++;
          } else {
            await client.query(`
              INSERT INTO third_level_official_masterlist
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', NOW(), NOW())
            `, [tloid, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', emailToInsert, record.contact_details || '']);

            await client.query(`
              INSERT INTO third_level_officials_updates
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, change_type, remarks, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', 'Initial', 'New Record Inserted (No Email)', NOW())
            `, [tloid, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', emailToInsert, record.contact_details || '']);

            nextTloIdNum++;
            results.noEmailInserted.push(record);
            results.summary.noEmailInserted++;
          }
        } else {
          const masterCheck = await client.query('SELECT "TLOid" FROM third_level_official_masterlist WHERE LOWER(email) = $1', [emailStrRaw]);
          const existsInMaster = masterCheck.rows.length > 0;

          if (existsInMaster) {
            const existingTloId = masterCheck.rows[0].TLOid;

            await client.query(`
              UPDATE third_level_official_masterlist
              SET first_name = $1, last_name = $2, position_title = $3, office = $4, strand = $5, designation = $6, contact_details = $7, updated_at = NOW()
              WHERE "TLOid" = $8
            `, [record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', record.contact_details || '', existingTloId]);

            await client.query(`
              INSERT INTO third_level_officials_updates
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, change_type, remarks, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', 'Update', 'Update Record Inserted', NOW())
            `, [existingTloId, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', record.email, record.contact_details || '']);

            results.updates.push(record);
            results.summary.updated++;
          } else {
            await client.query(`
              INSERT INTO third_level_official_masterlist
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', NOW(), NOW())
            `, [tloid, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', record.email, record.contact_details || '']);

            await client.query(`
              INSERT INTO third_level_officials_updates
                ("TLOid", first_name, last_name, position_title, office, strand, designation, email, contact_details, status, change_type, remarks, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', 'Initial', 'New Record Inserted', NOW())
            `, [tloid, record.first_name || '', record.last_name || '', record.position_title || '', record.office || '', record.strand || '', record.designation || '', record.email, record.contact_details || '']);

            nextTloIdNum++;
            results.newInserts.push(record);
            results.summary.new++;
          }
        }
      } catch (err) {
        results.failed.push({ record, error: err.message });
        results.summary.failed++;
      }
    }

    await client.query('COMMIT');
    
    // Server-side debugging logs
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
