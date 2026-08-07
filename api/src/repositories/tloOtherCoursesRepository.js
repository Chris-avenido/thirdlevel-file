/**
 * tloOtherCoursesRepository.js
 *
 * Repository for tlo_other_courses table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Soft-delete pattern: delete_flg = 'No' (active) | 'Yes' (deleted)
 * Physical DELETE is never performed; the Sentinel prohibition is avoided.
 */

const TABLE = 'tlo_other_courses';

/**
 * Fetch all ACTIVE other course records for a person (delete_flg = 'No').
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, course_title, institution, details,
            date_from, date_to, delete_flg, created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2)
       AND delete_flg = 'No'
     ORDER BY date_from DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync other course records using INSERT / UPDATE / soft-DELETE.
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2) AND delete_flg = 'No'`,
    [sourceTable, tloId]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const incomingIds = new Set();

  for (const item of incomingArray) {
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
             date_from = $4, date_to = $5, delete_flg = 'No',
             updated_at = NOW(), updated_by = $6
         WHERE id = $7 AND source_table = $8 AND LOWER(tlo_id) = LOWER($9)`,
        [courseTitle, institution, details, dateFrom || null, dateTo || null,
         updatedBy, item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      const inserted = await client.query(
        `INSERT INTO ${TABLE}
           (source_table, tlo_id, course_title, institution, details,
            date_from, date_to, delete_flg, created_at, updated_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'No', NOW(), NOW(), $8, $8)
         RETURNING id`,
        [sourceTable, tloId, courseTitle, institution, details,
         dateFrom || null, dateTo || null, updatedBy]
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
    console.log(`[tloOtherCoursesRepository] Soft-deleted ${idsToSoftDelete.length} record(s) for ${tloId}`);
  }
}

/**
 * Clone all ACTIVE other course records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  await client.query(
    `UPDATE ${TABLE} SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
     WHERE source_table = $2 AND LOWER(tlo_id) = LOWER($3)`,
    [updatedBy, toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, course_title, institution, details,
        date_from, date_to, delete_flg,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, course_title, institution, details,
            date_from, date_to, 'No', NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND LOWER(tlo_id) = LOWER($5) AND delete_flg = 'No'`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
