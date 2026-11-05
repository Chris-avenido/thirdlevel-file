/**
 * tloAccomplishmentRepository.js
 *
 * Repository for tlo_accomplishment_records table.
 * Provides: findByTloId, syncForTloId, cloneToNewTloId
 *
 * Soft-delete pattern: delete_flg = 'No' (active) | 'Yes' (deleted)
 * Physical DELETE is never performed; the Sentinel prohibition is avoided.
 */

const TABLE = 'tlo_accomplishment_records';

/**
 * Fetch all ACTIVE accomplishment records for a person (delete_flg = 'No').
 */
export async function findByTloId(client, sourceTable, tloId) {
  const result = await client.query(
    `SELECT id, source_table, tlo_id, description, award_year,
            delete_flg, created_at, updated_at, created_by, updated_by
     FROM ${TABLE}
     WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2)
       AND delete_flg = 'No'
     ORDER BY award_year DESC NULLS LAST, id ASC`,
    [sourceTable, tloId]
  );
  return result.rows;
}

/**
 * Sync accomplishment records using INSERT / UPDATE / soft-DELETE.
 * Rows omitted from incomingArray are soft-deleted (delete_flg = 'Yes').
 */
export async function syncForTloId(client, sourceTable, tloId, incomingArray, updatedBy = null) {
  const existingRes = await client.query(
    `SELECT id FROM ${TABLE} WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2) AND delete_flg = 'No'`,
    [sourceTable, tloId]
  );
  const existingIds = new Set(existingRes.rows.map(r => r.id));
  const incomingIds = new Set();

  for (const rawItem of incomingArray) {
    const item = typeof rawItem === 'string'
      ? { description: rawItem }
      : rawItem;

    const description = (item.description || '').trim();
    if (!description) continue; // skip blank entries

    const awardYear = item.award_year ? parseInt(item.award_year, 10) : null;

    if (item.id && existingIds.has(item.id)) {
      // UPDATE existing active row
      await client.query(
        `UPDATE ${TABLE}
         SET description = $1, award_year = $2, delete_flg = 'No',
             updated_at = NOW(), updated_by = $3
         WHERE id = $4 AND source_table = $5 AND LOWER(tlo_id) = LOWER($6)`,
        [description, isNaN(awardYear) ? null : awardYear, updatedBy,
         item.id, sourceTable, tloId]
      );
      incomingIds.add(item.id);
    } else {
      // Check if there's already a soft-deleted row with the same description we can resurrect
      const existing = await client.query(
        `SELECT id FROM ${TABLE}
         WHERE source_table = $1 AND LOWER(tlo_id) = LOWER($2)
           AND LOWER(description) = LOWER($3) AND delete_flg = 'Yes'
         LIMIT 1`,
        [sourceTable, tloId, description]
      );
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE ${TABLE}
           SET description = $1, award_year = $2, delete_flg = 'No',
               updated_at = NOW(), updated_by = $3
           WHERE id = $4`,
          [description, isNaN(awardYear) ? null : awardYear, updatedBy, existing.rows[0].id]
        );
        incomingIds.add(existing.rows[0].id);
      } else {
        const inserted = await client.query(
          `INSERT INTO ${TABLE}
             (source_table, tlo_id, description, award_year, delete_flg,
              created_at, updated_at, created_by, updated_by)
           VALUES ($1, $2, $3, $4, 'No', NOW(), NOW(), $5, $5)
           RETURNING id`,
          [sourceTable, tloId, description, isNaN(awardYear) ? null : awardYear, updatedBy]
        );
        incomingIds.add(inserted.rows[0].id);
      }
    }
  }

  // Soft-delete rows that were omitted from the incoming array
  const idsToSoftDelete = [...existingIds].filter(id => !incomingIds.has(id));
  if (idsToSoftDelete.length > 0) {
    await client.query(
      `UPDATE ${TABLE}
       SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
       WHERE id = ANY($2) AND source_table = $3 AND LOWER(tlo_id) = LOWER($4)`,
      [updatedBy, idsToSoftDelete, sourceTable, tloId]
    );
    console.log(`[tloAccomplishmentRepository] Soft-deleted ${idsToSoftDelete.length} record(s) for ${tloId}`);
  }
}

/**
 * Clone all ACTIVE accomplishment records from one person to another.
 */
export async function cloneToNewTloId(client, fromSourceTable, fromTloId, toSourceTable, toTloId, updatedBy = null) {
  // Soft-delete existing destination records first
  await client.query(
    `UPDATE ${TABLE} SET delete_flg = 'Yes', updated_at = NOW(), updated_by = $1
     WHERE source_table = $2 AND LOWER(tlo_id) = LOWER($3)`,
    [updatedBy, toSourceTable, toTloId]
  );
  await client.query(
    `INSERT INTO ${TABLE}
       (source_table, tlo_id, description, award_year, delete_flg,
        created_at, updated_at, created_by, updated_by)
     SELECT $1, $2, description, award_year, 'No', NOW(), NOW(), $3, $3
     FROM ${TABLE}
     WHERE source_table = $4 AND LOWER(tlo_id) = LOWER($5) AND delete_flg = 'No'`,
    [toSourceTable, toTloId, updatedBy, fromSourceTable, fromTloId]
  );
}
