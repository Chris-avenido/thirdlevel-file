/**
 * tloPositionRepository.js
 *
 * Repository for tlo_position_history table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Current position object shape (from OfficialProfiling.jsx L1001–L1004):
 * { position_name, office, strand, start_date, end_date, oic_positions[] }
 * Backend normalizes position_name → UPPERCASE (thirdLevelController.js L500–L504)
 * oic_positions sub-array is preserved as JSONB in this phase.
 */

const TABLE = 'tlo_position_history';

/**
 * Fetch all position history records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY inclusive_date_start DESC NULLS LAST, id DESC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync position history for a person using INSERT/UPDATE/DELETE.
 * Maps frontend fields: position_name, start_date → inclusive_date_start, end_date → inclusive_date_end.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<{id?, position_name, office?, strand?, start_date?, end_date?, oic_positions?}>} incomingArray
 * @param {string|null} updatedBy
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
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
    const dateStart = item.start_date || item.inclusive_date_start || null;
    const dateEnd = item.end_date || item.inclusive_date_end || null;
    const oicPositions = item.oic_positions && Array.isArray(item.oic_positions) && item.oic_positions.length > 0
      ? JSON.stringify(item.oic_positions)
      : null;

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET position_name = $1, office = $2, strand = $3, division = $4, region = $5,
             inclusive_date_start = $6, inclusive_date_end = $7, oic_positions = $8,
             updated_at = NOW(), updated_by = $9
         WHERE id = $10 AND source_table = $11 AND tlo_id = $12`,
        [positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions,
         updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $11)
         RETURNING id`,
        [sourceTable, tloId, positionName, office, strand, division, region,
         dateStart || null, dateEnd || null, oicPositions, updatedBy]
      );
      incomingIds.add(inserted.rows[0].id);
    }
  }

  const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));
  if (idsToDelete.length > 0) {
    await client.query(
      `DELETE FROM ${TABLE} WHERE id = ANY($1) AND source_table = $2 AND tlo_id = $3`,
      [idsToDelete, sourceTable, tloId]
    );
  }
}

/**
 * Clone all position history records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, position_name, office, strand, division, region,
        inclusive_date_start, inclusive_date_end, oic_positions,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, position_name, office, strand, division, region,
            inclusive_date_start, inclusive_date_end, oic_positions,
            NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
