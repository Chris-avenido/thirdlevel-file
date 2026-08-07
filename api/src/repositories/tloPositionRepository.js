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
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, delete_flg,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2)
       AND delete_flg = 'No'
     ORDER BY inclusive_date_start DESC NULLS LAST, id DESC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync position history using INSERT / UPDATE / soft-DELETE.
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2) AND delete_flg = 'No'`,
    [sourceTable, tloId]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const incomingIds = new Set();

  for (const item of incomingArray) {
    const positionName = ((item.position_name || '')).toUpperCase().trim();
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

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET position_name = $1, office = $2, strand = $3, division = $4, region = $5,
             inclusive_date_start = $6, inclusive_date_end = $7, oic_positions = $8,
             delete_flg = 'No', updated_at = NOW(), updated_by = $9
         WHERE id = $10 AND source_table = $11 AND LOWER(tlo_id) = LOWER($12)`,
        [positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions,
         updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, delete_flg,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'No', NOW(), NOW(), $11, $11)
         RETURNING id`,
        [sourceTable, tloId, positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions, updatedBy]
      );
      incomingIds.add(inserted.rows[0].id);
    }
  }

  // Soft-delete omitted rows
  const idsToSoftDelete = [...existingIds].filter(id => !incomingIds.has(id));
  if (idsToSoftDelete.length > 0) {
    await client.query(
      `UPDATE ${TABLE}
       SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
       WHERE id = ANY($2) AND source_table = $3 AND LOWER(tlo_id) = LOWER($4)`,
      [updatedBy, idsToSoftDelete, sourceTable, tloId]
    );
    console.log(`[tloPositionRepository] Soft-deleted ${idsToSoftDelete.length} record(s) for ${tloId}`);
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
        inclusive_date_start, inclusive_date_end, oic_positions, delete_flg,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions, 'No', NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND LOWER(tlo_id) = LOWER($5) AND delete_flg = 'No'`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
