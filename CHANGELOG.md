# CHANGELOG

## 2026-10-27 — Feature: Dedicated Vacancy Applicant Dashboard (`VacancyDashboard.jsx`) & Full-Height Workspace Sidebar (`VacancySidebar.jsx`)

### Overview & Architecture
- **Dedicated Vacancy Applicant Workspace & Dashboard**:
  - Implemented [VacancyDashboard.jsx](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx) at `/vacancy-dashboard`.
  - Gives Vacancy Applicants their own executive dashboard and full-height application sidebar matching the system's design language.
  - Features KPI metric cards: Registration Status (`Active`, UID), Target Position (`target_position_title`, item code), Total Available Vacancies, and Profile Completeness progress indicator.
  - Multi-tab view system:
    - **Dashboard & Data**: Displays comprehensive registered applicant data based on `vacancy_applicants` alongside featured open positions preview.
    - **List of Vacancies**: Complete interactive catalog with live search, bureau/office filtering, salary grade badges, item numbers, and instant "Select Target" position application.
    - **Applicant Profile**: Full profile overview of `vacancy_applicants` database fields with direct modal editing.
- **Dedicated Full-Height Application Sidebar ([`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx))**:
  - Styled after the Central Office role's executive navigation bar in Deep Navy `#08315F`.
  - Added collapsible/minimizing functionality matching the Central Office role (`AdminSidebar.jsx`):
    - Desktop collapsed state: defaults to `lg:w-[96px]` with a `w-[96px]` desktop spacer, maximizing main workspace area.
    - Hover expand state: smoothly expands to `w-[320px]` on mouse hover (`onMouseEnter`/`onMouseLeave`) with `shadow-2xl` and `z-[100]`.
    - Compact collapsed state: shows centered DepEd logo, centered applicant avatar with live emerald pulse indicator, and centered icon buttons.
    - Expanded state: displays InsightED portal branding, full applicant card based on `vacancy_applicants` (Full Name, Applicant UID with copy button, email, target vacancy, and "Edit Applicant Data" button), nav labels, badges, and Department of Education footer caption.
  - Prominently showcases applicant data based on `vacancy_applicants`: Full Name, Applicant UID (`VAC-2026-####` with copy button), official email, active status badge, target vacancy pill, and quick "Edit Applicant Data" button.
  - Navigation items: "Applicant Dashboard", "List of Vacancies" (with live badge counter), and "My Applicant Data".
- **Applicant Data Edit Modal ([`EditVacancyApplicantModal.jsx`](file:///e:/christop/staging/ui/src/components/EditVacancyApplicantModal.jsx))**:
  - Modal allowing applicant updates for First Name, Middle Name, Last Name, Suffix, Contact Number, Target Vacancy dropdown, and Notes/Qualifications.
  - Real-time persistence to `vacancy_applicants` table in PostgreSQL with state synchronization across the dashboard and sidebar.
- **Dedicated Vacancies Recruitment Login Page ([`VacancyLogin.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyLogin.jsx))**:
  - Implemented a standalone, distinctively designed login page at `/vacancy-login` dedicated exclusively to the Vacancies Recruitment portal.
  - Added dual authentication method support:
    - **Password Mode**: Sign in with registered email and account password.
    - **6-Digit Passcode Mode**: Sign in with registered email and secure 6-digit numeric passcode.
    - **Interactive On-Screen Dialpad Modal**: Includes a phone keypad modal with 6 dot progress indicators and physical keyboard support (numeric keys, backspace, delete).
  - Automatically initializes session with `sessionStorage.setItem('active_portal', 'vacancies')` upon successful login.
- **Strict Post-Login Redirection & Pure `vacancy_applicants` Isolation**:
  - Completely decoupled the Vacancy Recruitment Portal from `third_level_official_masterlist` and `third_level_officials_profiling_application`.
  - In [`loginController.js`](file:///e:/christop/staging/api/src/controllers/loginController.js), requests with `portal: 'vacancies'` isolate execution to query and return data **strictly and exclusively from `vacancy_applicants`**, bypassing any matching against `third_level_official_masterlist` or other tables.
  - Applied migration [`20261027_055_sanitize_vacancy_applicants_uids.sql`](file:///e:/christop/staging/database/migrations/20261027_055_sanitize_vacancy_applicants_uids.sql) standardizing all applicant identifiers in `vacancy_applicants` to `VAC-2026-####`, eliminating any legacy `TLO-` ID display.
  - In [`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js), profile fetching and seeding only generate `VAC-2026-####` UIDs and read strictly from `vacancy_applicants`.
  - In [`App.jsx`](file:///e:/christop/staging/ui/src/App.jsx) `PublicRoute`, authenticated users from the vacancies portal (`active_portal === 'vacancies'` or `roleLower === 'vacancy applicant'`) are strictly routed to `/vacancy-dashboard`, preventing any redirection to `/official-profiling`.
  - Updated [`NexusGate.jsx`](file:///e:/christop/staging/ui/src/pages/NexusGate.jsx) to route the "Vacancies: OPEN POSITIONS & OPPORTUNITIES" portal card directly to `/vacancy-login`.

---

## 2026-10-26 — Feature: Vacancy Applicants Table & Registration Flow (`vacancy_applicants`)

### Overview & Architecture
- **New Table for Vacancy Applicants**:
  - Implemented migration [20261026_054_create_vacancy_applicants_table.sql](file:///e:/christop/staging/database/migrations/20261026_054_create_vacancy_applicants_table.sql) creating the `vacancy_applicants` table in PostgreSQL.
  - Dedicated storage for external and internal applicants applying through the "Vacancies: OPEN POSITIONS & OPPORTUNITIES" portal, decoupling job applicants from the Third Level Officials profiling and registry approval pipeline (`third_level_officials_profiling_application` and `third_level_official_masterlist`).
  - Stores applicant contact information (`first_name`, `last_name`, `email`, `contact_number`), target vacancy details (`target_vacancy_id`, `target_position_title`), active `registration_status = 'Active'`, and system audit metadata.
  - Added indexes on `LOWER(email)`, `applicant_uid`, and `is_testaccount`.

### Database & ORM Definitions
- **Migration Execution**:
  - Migration script executed safely with `BEGIN; ... COMMIT;` transaction and rollback instructions.
- **Drizzle ORM & Database Init**:
  - Registered `vacancyApplicants` in [schema.js](file:///e:/christop/staging/api/src/db/schema.js) and [schema.ts](file:///e:/christop/staging/api/src/db/schema.ts).
  - Added table creation DDL with indexes to `initDB` in [db.js](file:///e:/christop/staging/api/src/config/db.js).

### Backend Authentication & Registration (`registerController.js` & `loginController.js`)
- **Role Assignment & Identification**:
  - Added `'Vacancy Applicant'` role to `THIRD_LEVEL_ROLES`.
  - Added UID generator formatting for vacancy accounts: `VAC-2026-####`.
  - Allowed personal emails (Gmail, Yahoo, Outlook, etc.) and DepEd emails for Vacancy Applicant registrations while preserving the strict `@deped.gov.ph` requirement for Central Office and Third Level Official accounts.
  - Vacancy registrations insert into `tlo_users` and `vacancy_applicants` directly, leaving masterlist tables untouched and avoiding unneeded 'For Approval' pending masterlist rows.
- **Login Verification**:
  - Updated `loginStandalone` and `loginByPasscode` in [loginController.js](file:///e:/christop/staging/api/src/controllers/loginController.js) to resolve accounts from `vacancy_applicants` when not found in TLO masterlist, preserving login access and passcode authentication.

### Frontend Portal Integration (`NexusGate.jsx`, `Register.jsx`, `Login.jsx`, `App.jsx`)
- **NexusGate Access Gate**:
  - Card 2 ("Vacancies") now displays an access modal with two clear paths: "Sign In" (redirecting to `/all-vacancies`) and "Register New Account" (navigating to `/register` with `portal: 'vacancies'`).
- **Registration Form**:
  - [Register.jsx](file:///e:/christop/staging/ui/src/pages/Register.jsx) dynamically configures validation rules and role assignment for `portal: 'vacancies'`, allowing any valid email format, skipping masterlist pre-approval warnings, and redirecting authenticated applicants to `/all-vacancies`.
- **Login & Route Guards**:
  - [Login.jsx](file:///e:/christop/staging/ui/src/pages/Login.jsx) and [App.jsx](file:///e:/christop/staging/ui/src/App.jsx) allow the `'Vacancy Applicant'` role and automatically route vacancy applicants to `/all-vacancies`.

### Registration Verification Rules (Updated)
- **Removed Email Verification for "Vacancy Applicant" (Explicitly Requested)**:
  - In [registerController.js](file:///e:/christop/staging/api/src/controllers/registerController.js), bypassed `checkOtpCode` and OTP consumption for `isVacancyApplicant` accounts.
  - In [Register.jsx](file:///e:/christop/staging/ui/src/pages/Register.jsx), clicking "Continue to Security" immediately advances Vacancy Applicants to Step 3 (Security/Password setup), bypassing the OTP email verification step completely.
  - Mandatory Email OTP verification remains strictly enforced for Central Office and Third Level Official registrations.

---

## 2026-10-22 — Registration: Removed "Existing Email in Masterlist" Suggestion & Added Mandatory Email OTP Verification

### Removed (explicitly requested by user)
- **"Existing Email in Masterlist" popup / banner** in [Register.jsx](file:///e:/christop/staging/ui/src/pages/Register.jsx) ("Use This Email" / "Modify Manually"), plus `existingMasterlistEmail` state and the `has_existing_email` status.
- **Backend detection** in [registerController.js](file:///e:/christop/staging/api/src/controllers/registerController.js):
  - `checkMasterlistEmail` no longer does the numeric-suffix base-email lookup or first/last-name lookup, and no longer returns `hasExistingMasterlistEmail` / `existingEmail`. It still returns `alreadyRegistered` and `inMasterlist` (still used by `RegisterPersonnelModal.jsx`).
  - `registerUser` no longer blocks registration with "You already have an existing email in the Masterlist (...)".

### Added — Email OTP Verification (core registration rule)
- **New routes** ([registerRoutes.js](file:///e:/christop/staging/api/src/routes/registerRoutes.js)): `POST /api/auth/send-otp`, `POST /api/auth/verify-otp` (these wire up the existing `sendOtp` / `verifyOtp` handlers).
- **`registerUser` now REQUIRES `otpCode`**: a valid, unexpired code in `verification_codes` for the exact email being registered. If it fails, the response is `400 { code: 'OTP_INVALID' }`. On success the code is used up inside the registration transaction (`expires_at = NOW()`).
- **Hardening**: codes are generated with `crypto.randomInt`. Resend has a 60s cooldown (`429` + `retryAfter`). After 5 wrong attempts the code is invalidated (in-memory counter). The plaintext OTP console log only runs when `NODE_ENV !== 'production'`.
- **Codes are never deleted.** They are only expired (`UPDATE ... SET expires_at = NOW()`), per the AGENTS.md no-delete rule.
- **No schema change**: uses the existing `verification_codes (email PK, code, expires_at)` table.
- **UI flow** is now 4 steps: Identity → Contact → **Verify Email (OTP)** → Security. If the code expires before submit, the user is sent back to the OTP step.

> [!IMPORTANT]
> Do not remove the OTP check from `registerUser`. If you only check on the frontend, anyone can register an email they don't own by calling `/register-user` directly.

---

## 2026-10-20 — Bugfix: Database Backup Source Alignment (`tlo_database`) & Complete Table Export (`export-backup.js`)

### Database Backup System (`export-backup.js`, `.env`, `backup.bat`, `package.json`)
- **Resolved Stale Database Source**:
  - Configured [export-backup.js](file:///e:/christop/staging/database/export-backup.js) to read `DATABASE_URL` directly from [.env_server](file:///e:/christop/staging/.env_server) (`tlo_database`), resolving the production database configuration dynamically.
- **Dynamic Table Discovery**:
  - Replaced hardcoded static table list with dynamic query against `information_schema.tables` in `public` schema.
  - Automatically captures previously missing tables: `tlo_positions`, `tlo_masterlist`, `ces_plantilla`, `tlo_assignments`, `tlo_items`, and `tlo_personnel`.
- **Complete Binary Metadata Extraction**:
  - Extracted 100% of binary metadata (1,701 records) from `unified_binaries` without raw bytea content, ensuring zero missing document links.
- **100% Read-Only Safety**:
  - Maintained `BEGIN READ ONLY;` transaction with terminating `ROLLBACK;`, guaranteeing zero server mutations.

---


### Profile Resolution (`loginController.js` & `thirdLevelController.js`)
- **Resolved Duplicate Records by Latest Timestamp**:
  - Configured [loginController.js](file:///e:/christop/staging/api/src/controllers/loginController.js) and [thirdLevelController.js](file:///e:/christop/staging/api/src/controllers/thirdLevelController.js) (`getByEmail`) to order masterlist candidate records using:
    ```sql
    ORDER BY created_at DESC NULLS LAST, "TLOid" DESC
    ```
  - Where duplicate records exist for the same email address with `status != 'Inactive'`, the system deterministically resolves and displays the most recently created record (e.g. the latest registration / submission) without mutating or merging data in-flight.

---

## 2026-10-07 — Bugfix: Identity Reconciliation UUID Syntax Error (`thirdLevelController.js`)

### Process Registration (`thirdLevelController.js`)
- **Fixed `invalid input syntax for type uuid: ""` on Identity Reconciliation**:
  - **Root Cause**: In `processRegistration` under `action === 'reconcile'`, the dynamic SQL `UPDATE` statement that copies data from the duplicate candidate official into the activated registration record was wrapping UUID and Date columns (`deped_clearance_binary_id`, `executive_summary_binary_id`, `sandiganbayan_clearance_binary_id`, `nbi_clearance_binary_id`, `csc_clearance_binary_id`, `ombudsman_clearance_binary_id`, and `date_of_assignment`) with `NULLIF(cand.col, '')`.
  - In PostgreSQL, evaluating `NULLIF(uuid_col, '')` causes an implicit cast `''::uuid`, triggering `ERROR: invalid input syntax for type uuid: ""` whenever the candidate column is evaluated.
  - **Fix**: Replaced `COALESCE(NULLIF(cand.col, ''), target.col)` with direct `COALESCE(cand.col, target.col)` for all UUID clearance/binary columns and date fields (matching the safe implementation used for `photo_binary_id`, `pds_binary_id`, `wes_binary_id`, `cv_binary_id`, `service_records_binary_id`, and `reassignment_order_binary_id`).

---

## 2026-10-07 — Profile Summary: Retain Only Table View (`OfficialProfiling.jsx`)

### Profile Summary Tab (`OfficialProfiling.jsx`)
- **Retained Only Table View**:
  - Removed the Card View / Table View toggle buttons from the Profile Summary header.
  - Removed all legacy Card View JSX structures and state conditionals across all Profile Summary sections.
  - Profile Summary now permanently renders the comprehensive and structured **Table View** across all 7 summary sections:
    1. *Personal Information Table* (with 2x2 Photo preview and biographical data)
    2. *Designation & Appointment Table* (Position, item number, office/strand/division, OIC flags, CES/EMT statuses)
    3. *Eligibility & Qualifications Table* (CES eligibility stages, EMT examination records, other eligibilities)
    4. *Education & Academic Background Table* (Degrees, courses, graduation years, other certifications)
    5. *Performance History & Experience Table* (OPCRF rating history, 3rd level and managerial service durations)
    6. *Uploaded Documents Table* (PDS, WES, CV, Service Records, clearances with quick view/preview triggers)
    7. *Legal Disclosures Table* (Administrative, criminal, and conviction disclosure status badges)
  - Followed by the standard Data Privacy Notice & Certification card.

---

## 2026-10-07 — Anticipated Vacancies & Future Scheduled Vacates (`tlo_assignments.end_date`)

### Anticipated Vacancies Logic & Modal (`Home.jsx` & `RetireesModal.jsx`)
- **Connected Vacate Logic to `tlo_assignments.end_date`**:
  - Replaced legacy calculations with dynamic anticipated vacancy detection combining:
    1. **Scheduled Vacancies / Declared End Dates**: Officials with declared future `tlo_assignments.end_date`, future `effectivity_date`, or pending `Vacating` / `Resigning` statuses.
    2. **Anticipated Mandatory Retirements**: Officials reaching age 65 within the 5-year anticipation window based on their `date_of_birth`.
  - Display dynamic separation reasons (e.g. *Resignation*, *Retirement*, *Vacated - Promotion*, *Scheduled Vacate*, *Anticipated Retirement*) and exact effectivity / separation dates with status tags (*Upcoming* vs *Completed*).
  - Enhanced badge color palettes according to reason type in [RetireesModal.jsx](file:///e:/christop/staging/ui/src/components/RetireesModal.jsx).
  - Integrated remarks and justification loader with automatic fallback to `assignment_remarks` or mandatory retirement justification.
  - Added a "View Modal" trigger directly on the Anticipated Vacancies KPI card in [Home.jsx](file:///e:/christop/staging/ui/src/pages/Home.jsx).

### Backend Controllers (`thirdLevelController.js` & `assignmentController.js`)
- **Future-Dated Vacate Synchronization**:
  - When `action === 'vacate'` is performed with a future effectivity date, the official's active assignment in `tlo_assignments` has `end_date` set to the declared future effectivity timestamp.
  - When `action === 'cancel-vacate'` is triggered for pending scheduled vacates, `tlo_assignments.end_date` is reset to `NULL`.
- **API Endpoints Exposing `assignment_end_date`**:
  - Updated `/api/third-level/officials-kpi-summary` (`getKpiSummary`) and `/api/third-level/officials` (`getOfficials`) to include `assignment_end_date` and `assignment_remarks` subqueries from `tlo_assignments`.
  - Updated `processScheduledVacancies` to properly match and inactivate mature scheduled assignments that reached their declared `end_date`.
- **Assignment Controller Update**:
  - Updated `updateAssignment` in [assignmentController.js](file:///e:/christop/staging/api/src/controllers/assignmentController.js) to preserve and set `end_date` if supplied during assignment edits.

---


### Legal Portal (`OfficialProfiling.jsx`)
- **"Applying for a Position" Toggle**:
  - Added a stylized toggle switch card labeled **"Applying for a Position"** in the **Legal** tab.
  - **When Toggle is OFF (Not Applying / Profile Maintenance)**: Legal clearance documents (Ombudsman Clearance, Sandiganbayan Clearance, CSC Clearance, NBI Clearance, DepEd RO Clearance, and Executive Summary) are hidden / removed for third level officials who are not applying for a position.
  - **When Toggle is ON (Applying for a Position)**: Legal clearance upload cards are displayed.
  - Linked to the Summary & Certify tab document checklist to dynamically display legal clearance requirements only when Applying for a Position is active.
- **Conditional Executive Summary Upload & Progress Calculation**:
  - The Executive Summary upload card (`executive_summary_binary_id`) is **hidden by default** and only rendered if at least one of the pending / legal case disclosure questions is answered **YES** (`pending_admin_case`, `guilty_admin_details`, `criminally_charged_details`, or `convicted_crime_details`).
  - In the Legal tab completion check (`isTabCompleted`), if any question is answered **YES**, the Legal tab is marked complete only after the Executive Summary is uploaded.
  - If questions are answered **YES** but the Executive Summary has not yet been uploaded, the Legal tab remains incomplete, keeping total profile progress at **90%** (9/10 tabs completed). Once uploaded, progress reaches **100%**.
  - In the Summary & Certify tab, Executive Summary is similarly hidden from the document checklist when no pending or legal cases are declared.

### Documents Portal (`OfficialProfiling.jsx`)
- Maintains the standard 201 profile documents (PDS, WES, CV, and Service Records) intact.

### Backend & Database Schema
- **Database Migration**:
  - Created migration `20260930_052_add_is_applying_for_position_column.sql` adding `is_applying_for_position BOOLEAN DEFAULT FALSE` across `third_level_official_masterlist`, `third_level_officials_profiling_application`, `tlo_personnel`, and `tlo_profile`.
- **API & Schema Updates**:
  - Updated `thirdLevelController.js` whitelist and case-sensitivity sets.
  - Updated `schema.ts` and `schema.js` definitions.

---

## 2026-09-29 — Documents Portal & Legal Portal: Additional Document Requirements

### Documents Portal (`OfficialProfiling.jsx`)
- **Accomplished Work Experience Sheet (WES) notarized**:
  - Added document checklist card for uploading, viewing, and replacing the notarized Work Experience Sheet (`wes_binary_id`).
  - Accepts PDF and Word document formats (`.pdf, .doc, .docx`).
- **Comprehensive Curriculum Vitae**:
  - Added document checklist card for uploading, viewing, and replacing the Comprehensive Curriculum Vitae (`cv_binary_id`).
  - Accepts PDF and Word document formats (`.pdf, .doc, .docx`).

### Legal Portal (`OfficialProfiling.jsx`)
- **Certificate of No Pending Case issued by the DepEd Regional Office**:
  - Added dedicated upload component in the Legal Portal section (`deped_clearance_binary_id`).
  - Includes document state indicators, instant preview/view in new tab, and file download support (`.pdf, .doc, .docx`).
- **Executive Summary of Pending Cases**:
  - Maintained full support for optional confidential case executive summaries and counter-affidavit uploads (`executive_summary_binary_id`).

### Summary Tab & System Updates
- **Summary Overview Grid**:
  - Updated the Document Checklist card grid in the Summary & Certify tab to render 2x2 Photo, PDS, WES, CV, Service Records, DepEd RO Clearance, and Executive Summary.
- **Backend & Database Schema**:
  - Created migration `20260929_051_add_wes_cv_and_deped_clearance_documents.sql` adding `wes_binary_id UUID`, `cv_binary_id UUID`, and `deped_clearance_binary_id UUID` across masterlist, applications, and auxiliary tables.
  - Updated controller upload routing in `thirdLevelController.js`, profile persistence handling, and data backup metadata definitions in `export-backup.js`.

---

## 2026-09-24 — Achievements Tab: Not Applicable (N/A) Toggle Button

### Official Profiling (`OfficialProfiling.jsx`)
- **N/A Toggle Button in Achievements Tab**:
  - Added an interactive `N/A` button adjacent to the *Notable Achievements (If Any)* section header.
  - When active (`isAchievementsNA = true`), the Achievements tab inputs are gracefully marked as Not Applicable, disabling manual entries and displaying clear informational status banners for both *Notable Achievements* and *Additional Accomplishments*.
  - Toggling off re-enables full multi-layer achievement entry and award additions.
- **Profile Completeness & Tab Satisfaction**:
  - Updated `isTabCompleted('achievements')` to recognize the `isAchievementsNA` state as a completed section, allowing officials without external awards or recognitions to achieve 100% profile completeness and proceed to submission without blocking.
- **Data Persistence & Round-trip Loading**:
  - Enhanced `lookupByEmail` to automatically detect N/A state from loaded profile achievements via helper `isAchievementsPlaceholder`.
  - Configured `handleSave` payload to cleanly record `[{ title: 'N/A', year: '' }]` when N/A is selected and clear additional accomplishment records.
  - Updated Profile Summary and CSV exports to cleanly render `Not Applicable (N/A)` when marked.

---

## 2026-09-24 — Identity Reconciliation Update: Retain & Activate Registration Record

### System Behavior Update ("Yes, This Is the Same Person — Proceed")
- **Registration Record Activation**:
  - When an administrator confirms identity reconciliation on a pending registration (e.g. `TLO-0742`) against an existing official record (e.g. `TLO-0349`), the **Registration Record (`TLO-0742`)** is retained and set to `status = 'Active'`.
  - The Registration Record inherits all official profile details from the duplicate existing official record: `position_title`, `plantilla_item_no`, `office`, `strand`, `division`, `region`, `designation`, `is_oic`, `appointment_date`, `appointment_status`, `employment_status`, `ces_stage`, `ces_conferment_date`, `emt_passer`, `emt_date`, `total_years_third_level`, `managerial_experience_total`, ratings, clearances, document binary IDs, and bio/address data.
  - Preserves the existing official's email as an alternate login email (`alt_email_1` / `alt_email_2`) on the newly activated registration record so no historical email access is lost.
- **Existing Official Record Deactivation**:
  - The duplicate **Existing Official Record (`TLO-0349`)** is transitioned to `status = 'Inactive'`.
- **Relational Tables & Assignments Transfer**:
  - Clones all child table records (education, eligibilities, positions, trainings, accomplishments, other courses) from `TLO-0349` to `TLO-0742` via `cloneMasterlistChildTables`.
  - Upserts `tlo_masterlist` entry for `TLO-0742` and transfers active assignments in `tlo_assignments` from `TLO-0349`'s masterlist ID to `TLO-0742`'s masterlist ID.
- **User Account & Staging Application Alignment**:
  - Activates the registrant's account in `tlo_users` (`registration_status = 'Approved'`, `role = 'Third Level Official'`).
  - Points profiling staging application targets in `third_level_officials_profiling_application` to `TLO-0742`.
  - Records distinct audit trail entries in `third_level_officials_updates` for the activation of `TLO-0742` and the deactivation of `TLO-0349`.
  - Dispatches official approval email to the registrant.
- **Frontend UI (`OfficialsRegistry.jsx`)**:
  - Updated reconciliation modal copy, declaration disclaimer, and SweetAlert success feedback to reflect activation of the registration record with inherited official details and deactivation of the candidate record.

---


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
