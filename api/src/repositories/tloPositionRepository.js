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

  // Soft-delete omitted rows ONLY if they are not system-archived inactive assignment records
  const idsToSoftDelete = existingRows
    .filter(r => !incomingIds.has(r.id) && r.status !== 'Inactive')
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
