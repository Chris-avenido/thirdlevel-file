# CHANGELOG

## 2026-09-17 — Reconciled Duplicate Personnel Display & Masterlist Consolidation Migration

### Root Cause & Forensic Findings
- Investigation of modal duplicate display (e.g., `ALDRIN GAYRAMA CORPIN` displayed twice with `2 FOUND`):
  - Database table `tlo_masterlist` contained duplicate rows for identical individuals (e.g. `id = 528` with `tloid = 'TLO-0091'` and `id = 696` with `tloid = 'TLO-0608'`) resulting from historical multi-file personnel imports.
  - Endpoint `GET /api/third-level/assignments/officials` directly queried `tlo_masterlist`, causing 2 rows to be emitted to the frontend combobox.

### API & Frontend Deduplication Defense
- **Backend Controller (`api/src/controllers/assignmentController.js`)**:
  - Enhanced `getOfficialsForAssignment` to consolidate duplicate masterlist records by canonical normalized full name and email.
  - Automatically merges `existing_assignments`, `active_assignments`, and `active_designations` across duplicate masterlist IDs.
  - Selects the primary record with verified `plantilla_item_no` and highest profile completion while recording all merged IDs in `other_masterlist_ids`.
- **Frontend Dropdown (`OfficialCombobox` in `ReassignOfficialModal.jsx` and `PositionAssignments.jsx`)**:
  - Deduplicated `officials` list by canonical official identity before calculating `filtered` results, ensuring exact `1 found` display and single-entry selection.
  - Updated selection resolution to match either primary `id` or any ID within `other_masterlist_ids`.

### Database Schema Migration
- Created migration `database/migrations/20260917_044_reconcile_duplicate_tlo_masterlist_records.sql`:
  - Scoped **exclusively to `tlo_masterlist`** based on email from `third_level_official_masterlist`.
  - Re-points foreign key references in `tlo_assignments` from secondary masterlist IDs to canonical primary IDs (e.g. 528 -> 696).
  - Removes secondary duplicate rows strictly from `tlo_masterlist`.
  - Leaves child tables and `third_level_official_masterlist` completely untouched.
  - Fully transactional (`BEGIN ... COMMIT`) with complete rollback instructions.

---

## 2026-09-17 — Unified "Staffing Action: New Position Assignment" Modal & Elimination of Legacy `reassignOfficial`

### Architectural Change & Controller Refactoring
- **Replaced Legacy "Executive Dashboard Reassign Official" Modal**:
  - Replaced `ui/src/components/ReassignOfficialModal.jsx` with the canonical **Staffing Action: New Position Assignment** modal ("Deploy an official into a verified vacant plantilla position").
  - Unified `Home.jsx` ("Reassign Official" button) and `OfficialsRegistry.jsx` to trigger the standardized New Position Assignment workflow with official pre-selection and vacancy validation.
- **Eliminated Legacy Backend Endpoint & Handler**:
  - Removed `POST /api/third-level/reassign-official` route from `api/src/routes/officialsRegistryRoutes.js`.
  - Removed deprecated `reassignOfficial` controller from `api/src/controllers/thirdLevelController.js`.
  - Standardized all staffing deployments exclusively on `POST /api/third-level/assignments` (`assignmentController.js`), ensuring concurrent vacancy verification, automatic position archiving into `tlo_position_history`, and multi-position retention/vacating support.

---

### Architectural Change & Database Migrations
- **Eliminated Singular `tlo_assignment` Table**:
  - Dropped legacy `tlo_assignment` table in PostgreSQL via migration `20260915_041_delete_tlo_assignment_and_link_positions_to_assignments.sql`.
  - Standardized all assignment records exclusively on `tlo_assignments` (plural).
  - Preserved historical backup table `tlo_assignment_backup_schema_refactor`.
- **Direct Relational Link between `tlo_positions` and `tlo_assignments`**:
  - Extended `tlo_assignments` with `position_id INT` referencing `tlo_positions(id) ON DELETE SET NULL`.
  - Added metadata columns: `designation TEXT`, `remarks TEXT`, `reassignment_order_binary_id UUID`, `created_by TEXT`, `updated_by TEXT`.
  - Backfilled all 1,792 existing assignment records (100% match) with valid `position_id` foreign keys.
- **Detached Plantilla Architecture**:
  - `tlo_plantilla` and `ces_plantilla` detached as standalone flat reference tables with 0 foreign keys.
  - Canonical personnel identity is centered on `tlo_masterlist(id)`.
  - Canonical position definitions are centered on `tlo_positions(id)` and `tlo_items(item_number)`.

### ORM, Controller & Application Alignment
- **Drizzle ORM (`schema.ts`, `schema.js`, `relations.ts`, `relations.js`)**:
  - Removed `tloAssignment` table definition.
  - Added `positionId` and metadata attributes to `tloAssignments`.
  - Defined relational linkage `tloPositions.assignments` -> `tloAssignments`.
- **Repositories & Controllers**:
  - `tloPositionRepository.js`: Updated assignment lookup methods to join `tlo_positions pos ON pos.id = a.position_id`.
  - `cesPlantillaController.js`: Standardized `importPlantillaPositions` and `getPlantillaReport` to record and query assignments in `tlo_assignments`.
  - `uploadDirectoryModalController.js`: Updated directory parser import to write into `tlo_assignments` and safely re-bind `tlo_assignments_position_id_fkey`.
  - `thirdLevelController.js`: Updated `getVacantPositions`, `executeReassignment`, `deactivateAccountCron`, `cancelVacancy`, and `reassignOfficial` to use `tlo_assignments` ledger without touching dropped table.
- **Frontend**:
  - Updated `CesPlantilla.jsx`, `UploadDirectoryModal.jsx`, and `ReassignOfficialModal.jsx` for directory parsing and vacancy management. Verified clean production build with Vite.

---

### Architectural Change & Database Migration
- **Converted `notable_achievements` Column to `JSONB`**:
  - Applied migration `20260812_014_convert_notable_achievements_to_jsonb.sql` converting `notable_achievements` column in `third_level_official_masterlist` and `third_level_officials_profiling_application` to native PostgreSQL `JSONB` array of objects `[{ title: '...', year: '...' }]`.
  - Dropped redundant `notable_achievements_year` column to eliminate duplicate data and ensure guaranteed atomic binding between award title and year received.
- **Backend Controller (`thirdLevelController.js`)**:
  - Registered `notable_achievements` in `JSONB_FIELDS` set for automatic `JSON.stringify` handling on updates and application approvals.
  - Added object-based year validation inside `validateYear` loop.
- **Frontend Page (`OfficialProfiling.jsx`)**:
  - Updated profile state, `lookupByEmail` parser, Achievements tab multi-layer editor, Summary preview tab renderer, and CSV exporter to seamlessly read and write `notable_achievements` as a `JSONB` array of `{ title, year }` objects.

---

## 2026-08-07 — NexusGate Landing Page Redesign & Records Management Admin Access

### Design & Feature Updates
- **Records Management Admin Access Bar ([`NexusGate.jsx`](file:///e:/christop/staging/ui/src/pages/NexusGate.jsx), [`NexusGate.css`](file:///e:/christop/staging/ui/src/pages/NexusGate.css))**:
  - Implemented the dark navy pill capsule bar with golden border (`#FCD116`), yellow shield circle icon, bold white italic "Records Management" text, "ADMIN ACCESS" gold badge, and hover right arrow (`→`).
  - Positioned directly below the top logos in the hero section to provide clear, elegant, and immediate access to Admin Records Management login.
- **Subtle Soft Watermark Refinement**:
  - Reduced government building watermark opacity to a soft `0.20` (`color: #FBBF24`), using refined `2px`/`1.5px` stroke lines and `fill-opacity="0.1"`.
- **Position Swap Animation Restored**:
  - Re-integrated `isSwapped` state and Framer Motion `AnimatePresence` layout transitions.

---

## 2026-08-07 — Official Approval & Rejection Email Notifications

### Feature
Added automated professional email notifications when an official's registration or application is approved or rejected in the `OfficialsRegistry` page (`/officials-registry?status=For%20Approval`, "Pending Approvals" tab).

### Components Added/Updated
- **`api/src/services/emailService.js`**: Created modular HTML email service using `nodemailer` (GMail SMTP transporter). Provides `sendOfficialApprovalEmail` and `sendOfficialRejectionEmail` with executive Department of Education branding.
- **`api/src/controllers/thirdLevelController.js`**:
  - Updated `processRegistration` and `processApplication` endpoints to fetch applicant/official details.
  - Automatically sends an approval or rejection email to the official's email address upon successful transaction commit.
- **`ui/src/pages/OfficialsRegistry.jsx`**:
  - `handleRegistrationAction` & `handleProcessApplication`: Prompts admin for rejection reason when clicking the Reject (X) button, and displays feedback when an email notification is dispatched.

---

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
