/**
 * tloEducationRepository.js
 *
 * Repository for tlo_education_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Sync strategy (INSERT/UPDATE/DELETE — no delete-and-reinsert):
 *  1. Fetch existing row IDs for the person.
 *  2. For each incoming item with a matching ID → UPDATE.
 *  3. For each incoming item without an ID → INSERT.
 *  4. DELETE any existing rows whose ID is absent from the incoming array.
 */

const TABLE = 'tlo_education_records';

/**
 * Fetch all education records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, level, degree, institution,
            year_graduated, created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY
       CASE level WHEN 'Bachelor' THEN 1 WHEN 'Master' THEN 2 WHEN 'Doctorate' THEN 3 ELSE 4 END,
       id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync education records for a person using INSERT/UPDATE/DELETE.
 * Preserves existing primary keys.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<{id?, level, degree, institution?, year_graduated?}>} incomingArray
 * @param {string|null} updatedBy  email of the user performing the update
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  // 1. Fetch existing IDs
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [sourceTable, tloId]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const incomingIds = new Set();

  for (const item of incomingArray) {
    const level = item.level || 'Bachelor';
    const degree = (item.degree || '').trim();
    const institution = item.institution ? item.institution.trim() : null;
    const yearGraduated = item.year_graduated ? parseInt(item.year_graduated, 10) : null;

    if (item.id && existingIds.has(item.id)) {
      // UPDATE existing row
      await client.query(
        `UPDATE ${TABLE}
         SET level = $1, degree = $2, institution = $3, year_graduated = $4,
             updated_at = NOW(), updated_by = $5
         WHERE id = $6 AND source_table = $7 AND tlo_id = $8`,
        [level, degree, institution, yearGraduated, updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      // INSERT new row
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, level, degree, institution, year_graduated,
            created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $7)
         RETURNING id`,
        [sourceTable, tloId, level, degree, institution, yearGraduated, updatedBy]
      );
      incomingIds.add(inserted.rows[0].id);
    }
  }

  // 3. DELETE orphaned rows (IDs present in DB but not in incoming array)
  const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));
  if (idsToDelete.length > 0) {
    await client.query(
      `DELETE FROM ${TABLE} WHERE id = ANY($1) AND source_table = $2 AND tlo_id = $3`,
      [idsToDelete, sourceTable, tloId]
    );
  }
}

/**
 * Clone all education records from one person to another.
 * Used during processApplication approve: copies staging → masterlist.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} fromSourceTable
 * @param {string} fromTloId
 * @param {'masterlist'|'staging'} toSourceTable
 * @param {string} toTloId
 * @param {string|null} updatedBy
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  // Remove existing target rows first (clean slate for approval)
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  // Copy from source
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, level, degree, institution, year_graduated,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, level, degree, institution, year_graduated,
            NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
