/**
 * tloOtherCoursesRepository.js
 *
 * Repository for tlo_other_courses table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Current other_courses object shape (from OfficialProfiling.jsx L2342):
 * { course, date_from, date_to, details }
 * Mapped to DB columns: course_title, date_from, date_to, details
 */

const TABLE = 'tlo_other_courses';

/**
 * Fetch all other course records for a person.
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @returns {Promise<Array>}
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, course_title, institution, details,
            date_from, date_to, created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND tlo_id = $2
     ORDER BY date_from DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync other course records for a person using INSERT/UPDATE/DELETE.
 * Maps frontend field: course → course_title.
 *
 * @param {import('pg').PoolClient} client
 * @param {'masterlist'|'staging'} sourceTable
 * @param {string} tloId
 * @param {Array<{id?, course, date_from?, date_to?, details?, institution?}>} incomingArray
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
    // Map frontend 'course' field to DB 'course_title'
    const courseTitle = (item.course || item.course_title || '').trim();
    const details = item.details ? item.details.trim() : null;
    const institution = item.institution ? item.institution.trim() : null;
    const cleanDate = (d) => {
      if (!d || typeof d !== 'string') return null;
      const t = d.trim();
      return (t && t.toUpperCase() !== 'N/A' && t.toUpperCase() !== 'NONE') ? t : null;
    };
    const dateFrom = cleanDate(item.date_from);
    const dateTo = cleanDate(item.date_to);

    if (item.id && existingIds.has(item.id)) {
      await client.query(
        `UPDATE ${TABLE}
         SET course_title = $1, institution = $2, details = $3,
             date_from = $4, date_to = $5,
             updated_at = NOW(), updated_by = $6
         WHERE id = $7 AND source_table = $8 AND tlo_id = $9`,
        [courseTitle, institution, details, dateFrom || null, dateTo || null,
         updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, course_title, institution, details,
            date_from, date_to, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $8)
         RETURNING id`,
        [sourceTable, tloId, courseTitle, institution, details,
         dateFrom || null, dateTo || null, updatedBy]
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
 * Clone all other course records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `DELETE FROM ${TABLE} WHERE source_table = $1 AND tlo_id = $2`,
    [toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, course_title, institution, details,
        date_from, date_to, created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, course_title, institution, details,
            date_from, date_to, NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND tlo_id = $5`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
