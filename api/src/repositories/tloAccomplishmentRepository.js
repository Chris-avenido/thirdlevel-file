/**
 * tloAccomplishmentRepository.js
 *
 * Repository for tlo_accomplishment_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Current accomplishments shape (from OfficialProfiling.jsx L750):
 * individual_accomplishments: [] — array of plain strings
 * Incoming items may be plain strings or objects { description, award_year? }
 */

const TABLE = 'tlo_accomplishment_records';

/**
 * Fetch all accomplishment records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, description, award_year,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY award_year DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync accomplishment records for a person using INSERT/UPDATE/DELETE.
 * Handles both plain-string array items and object items.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<string|{id?, description, award_year?}>} incomingArray
 * @param {string|null} updatedBy
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [sourceTable, tloId]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const incomingIds = new Set();

  for (const rawItem of incomingArray) {
    // Normalize: support both plain string and object
    const item = typeof rawItem === 'string'
      ? { description: rawItem }
      : rawItem;

    const description = (item.description || '').trim();
    if (!description) continue; // skip blank entries

    const awardYear = item.award_year ? parseInt(item.award_year, 10) : null;

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET description = $1, award_year = $2, updated_at = NOW(), updated_by = $3
         WHERE id = $4 AND source_table = $5 AND tlo_id = $6`,
        [description, isNaN(awardYear) ? null : awardYear, updatedBy,
         item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, description, award_year,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $5)
         RETURNING id`,
        [sourceTable, tloId, description, isNaN(awardYear) ? null : awardYear, updatedBy]
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
 * Clone all accomplishment records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, description, award_year,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, description, award_year, NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
