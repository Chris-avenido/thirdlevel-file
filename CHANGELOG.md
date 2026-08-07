# CHANGELOG

## 2026-08-07 — Soft-Delete Pattern for Child Tables

### Context
The `MASTER TINKERER SENTINEL` database trigger prohibits physical `DELETE` operations on all child relational tables. Previously, orphaned rows (caused by id-less payloads) triggered `DELETE` attempts that the Sentinel blocked, producing console warnings on every save.

### Change: `delete_flg` Soft-Delete Column

**Migration:** `20260807_011_add_delete_flg_to_child_tables.sql`

Added `delete_flg VARCHAR(3) NOT NULL DEFAULT 'No' CHECK (delete_flg IN ('Yes', 'No'))` to:
- `tlo_accomplishment_records`
- `tlo_eligibility_records`
- `tlo_position_history`
- `tlo_training_records`
- `tlo_other_courses`

### Behavior Rules
- **Active records:** `delete_flg = 'No'` (default for all new inserts)
- **Deleted records:** `delete_flg = 'Yes'` (set on sync when row is omitted from incoming payload)
- **Fetch queries:** always filter `AND delete_flg = 'No'`
- **Sync queries:** orphaned IDs receive `UPDATE ... SET delete_flg = 'Yes'` instead of `DELETE`
- **Clone queries:** destination rows are soft-deleted before inserting copies from source
- **Physical DELETE:** never used in any repository (Sentinel-safe)

### Repositories Updated
- `tloAccomplishmentRepository.js` — also added resurrection logic (re-activates soft-deleted row if same description re-added)
- `tloEligibilityRepository.js`
- `tloPositionRepository.js`
- `tloTrainingRepository.js`
- `tloOtherCoursesRepository.js`

### Frontend (OfficialProfiling.jsx)
- `individual_accomplishments` — now loaded as `{ id, description, award_year }` objects (preserving DB row id)
- Render logic updated to handle both legacy plain strings and new `{ id, description }` objects
- id is preserved through edits so save round-trips use `UPDATE`, not `INSERT` + soft-delete

---

## Previous Changes (2026-08-07 earlier sessions)
- Fixed `getByEmail` to call `fetchAllChildRecords` for both masterlist and staging sources
- Removed "Record Not Found" blocking modal; auto-initializes profile
- Added `formatDateStr` helper for safe date parsing
- Fixed nested `<button>` hydration error in `NexusGate.jsx`
- Fixed React unique `key` props across all mapped lists in `OfficialProfiling.jsx`
- Fixed Documents tab checkmark (requires both PDS + Service Records, excludes `photo_binary_id`)
- Fixed Education tab checkmark (recognizes any degree data, not just all 3 fields)
