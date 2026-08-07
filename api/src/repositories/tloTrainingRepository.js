/**
 * tloTrainingRepository.js
 *
 * Repository for tlo_training_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Current training object shape (from OfficialProfiling.jsx L1006–L1009):
 * { training_name, date_from, date_to, conducted_by }
 * Backend normalizes training_name → UPPERCASE (thirdLevelController.js L494–L499)
 */

const TABLE = 'tlo_training_records';

/**
 * Fetch all training records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, training_name, hours,
            inclusive_date_start, inclusive_date_end, conducted_by,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY inclusive_date_start DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync training records for a person using INSERT/UPDATE/DELETE.
 * Maps frontend fields: training_name, date_from → inclusive_date_start, date_to → inclusive_date_end.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<{id?, training_name, date_from?, date_to?, conducted_by?, hours?}>} incomingArray
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
    const trainingName = ((item.training_name || item.training_title || '')).toUpperCase().trim();
    const hours = item.hours != null ? parseInt(item.hours, 10) : null;
    const cleanDate = (d) => {
      if (!d || typeof d !== 'string') return null;
      const t = d.trim();
      return (t && t.toUpperCase() !== 'N/A' && t.toUpperCase() !== 'NONE') ? t : null;
    };
    const dateStart = cleanDate(item.date_from || item.inclusive_date_start);
    const dateEnd = cleanDate(item.date_to || item.inclusive_date_end);
    const conductedBy = item.conducted_by ? item.conducted_by.trim() : null;

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET training_name = $1, hours = $2, inclusive_date_start = $3,
             inclusive_date_end = $4, conducted_by = $5,
             updated_at = NOW(), updated_by = $6
         WHERE id = $7 AND source_table = $8 AND tlo_id = $9`,
        [trainingName, isNaN(hours) ? null : hours, dateStart || null, dateEnd || null,
         conductedBy, updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, training_name, hours, inclusive_date_start,
            inclusive_date_end, conducted_by, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $8)
         RETURNING id`,
        [sourceTable, tloId, trainingName, isNaN(hours) ? null : hours,
         dateStart || null, dateEnd || null, conductedBy, updatedBy]
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
 * Clone all training records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, training_name, hours, inclusive_date_start,
        inclusive_date_end, conducted_by, created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, training_name, hours, inclusive_date_start,
            inclusive_date_end, conducted_by, NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
