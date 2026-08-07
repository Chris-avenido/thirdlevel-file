/**
 * tloTrainingRepository.js
 *
 * Repository for tlo_training_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Soft-delete pattern: delete_flg = 'No' (active) | 'Yes' (deleted)
 * Physical DELETE is never performed; the Sentinel prohibition is avoided.
 */

const TABLE = 'tlo_training_records';

/**
 * Fetch all ACTIVE training records for a person (delete_flg = 'No').
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, training_name, hours,
            inclusive_date_start, inclusive_date_end, conducted_by, delete_flg,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2)
       AND delete_flg = 'No'
     ORDER BY inclusive_date_start DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync training records using INSERT / UPDATE / soft-DELETE.
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2) AND delete_flg = 'No'`,
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
             inclusive_date_end = $4, conducted_by = $5, delete_flg = 'No',
             updated_at = NOW(), updated_by = $6
         WHERE id = $7 AND source_table = $8 AND LOWER(tlo_id) = LOWER($9)`,
        [trainingName, isNaN(hours) ? null : hours, dateStart || null, dateEnd || null,
         conductedBy, updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, training_name, hours, inclusive_date_start,
            inclusive_date_end, conducted_by, delete_flg,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'No', NOW(), NOW(), $8, $8)
         RETURNING id`,
        [sourceTable, tloId, trainingName, isNaN(hours) ? null : hours,
         dateStart || null, dateEnd || null, conductedBy, updatedBy]
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
    console.log(`[tloTrainingRepository] Soft-deleted ${idsToSoftDelete.length} record(s) for ${tloId}`);
  }
}

/**
 * Clone all ACTIVE training records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `UPDATE ${TABLE} SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
     WHERE source_table = $2 AND LOWER(tlo_id) = LOWER($3)`,
    [updatedBy, toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, training_name, hours, inclusive_date_start,
        inclusive_date_end, conducted_by, delete_flg,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, training_name, hours, inclusive_date_start,
            inclusive_date_end, conducted_by, 'No', NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND LOWER(tlo_id) = LOWER($5) AND delete_flg = 'No'`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
