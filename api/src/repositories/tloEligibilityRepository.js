/**
 * tloEligibilityRepository.js
 *
 * Repository for tlo_eligibility_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Current eligibility object shape (from OfficialProfiling.jsx L2026):
 * { eligibility, date, rating, place_of_assignment }
 * Backend normalizes eligibility → UPPERCASE (thirdLevelController.js L484–L492)
 */

const TABLE = 'tlo_eligibility_records';

/**
 * Fetch all eligibility records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, eligibility_type, rating,
            conferment_date, place_of_assignment, details,
            created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY conferment_date ASC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync eligibility records for a person using INSERT/UPDATE/DELETE.
 * Maps frontend field names: eligibility → eligibility_type, date → conferment_date.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<{id?, eligibility, date?, rating?, place_of_assignment?, details?}>} incomingArray
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
    // Map frontend fields to DB columns
    const eligibilityType = ((item.eligibility || item.eligibility_type || item.title || '')).toUpperCase().trim();
    const rating = item.rating ? String(item.rating).trim() : null;
    const cleanDate = (d) => {
      if (!d || typeof d !== 'string') return null;
      const t = d.trim();
      return (t && t.toUpperCase() !== 'N/A' && t.toUpperCase() !== 'NONE') ? t : null;
    };
    const confermentDate = cleanDate(item.date || item.conferment_date);
    const placeOfAssignment = item.place_of_assignment ? item.place_of_assignment.toUpperCase().trim() : null;
    const details = item.details ? item.details.trim() : null;

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET eligibility_type = $1, rating = $2, conferment_date = $3,
             place_of_assignment = $4, details = $5,
             updated_at = NOW(), updated_by = $6
         WHERE id = $7 AND source_table = $8 AND tlo_id = $9`,
        [eligibilityType, rating, confermentDate || null, placeOfAssignment, details,
         updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, eligibility_type, rating, conferment_date,
            place_of_assignment, details, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $8)
         RETURNING id`,
        [sourceTable, tloId, eligibilityType, rating, confermentDate || null,
         placeOfAssignment, details, updatedBy]
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
 * Clone all eligibility records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, eligibility_type, rating, conferment_date,
        place_of_assignment, details, created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, eligibility_type, rating, conferment_date,
            place_of_assignment, details, NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
