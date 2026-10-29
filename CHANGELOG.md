# CHANGELOG

## 2026-10-29 — Vacancy Application: Azure Blob Storage Folder & Re-application Data Retrieval with N/A Toggle Buttons

### Requirement & User Directive
> "in the modal of "Third Level Position Application" i was sucessfull input and upload all documents but when i tried to re-apply can retrieve the documents and details that i am input 
> add n/a button in the input fields so user can't manually type the word of n/a"
> "in the storing file in in the Blob change APP-vacancy_applicants.id"

### Root Cause
1. **Azure Blob Folder Naming**: In [`api/src/controllers/vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js), document uploads previously created Azure Blob virtual folders using `APP-${applicationId}` (referencing `vacancy_applications.id`). This caused an applicant's uploaded documents across drafts or subsequent applications to be split across different folders rather than unified under the applicant's account.
2. **Missing Re-application Data & Document Pre-fill**: In [`ui/src/components/ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx), opening the modal to re-apply reset all 12 document slots to `null` and cleared form fields (dates, current position, plantilla office, eligibilities), forcing applicants to re-enter all details and re-upload all documents from scratch.
3. **Manual "N/A" Input Vulnerabilities**: Applicants frequently typed irregular text variants (`na`, `n/a`, `none`, `N/A`) in text inputs (`middle_name`, `target_vacancy_id`, `current_position`, `plantilla_office`, `assigned_oic_office`), causing inconsistency in reports and databases.

### Architectural & UI Fixes
1. **Azure Blob Virtual Folder Pathing ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - Updated Azure upload target prefix to `APP-${vacancyApplicantId}` (referencing `vacancy_applicants.id`), with fallback to `applicationId`.
   - Updated `vacancy_applications` queries and inserts to resolve and persist `vacancy_applicant_id`.
2. **Latest Application & Document Retrieval ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js), [`officialProfilingRoutes.js`](file:///e:/christop/staging/api/src/routes/officialProfilingRoutes.js))**:
   - Added `GET /api/third-level/vacancy-applicant/latest-application` endpoint. It finds the applicant's latest draft or submitted application and backfills any document attachments from previous submissions.
3. **Automatic Pre-fill & Retrieval Notice ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx))**:
   - When the modal opens, it automatically retrieves the applicant's previously entered details and all 12 uploaded document attachments.
   - Displays a green banner confirming data retrieval with document count and a "Start Fresh" option.
4. **Dedicated N/A Toggle Buttons & Normalization ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx))**:
   - Added one-click `[N/A]` toggle buttons to `target_vacancy_id`, `middle_name`, `current_position`, `plantilla_office`, `assigned_oic_office`, and custom designation.
   - Added automatic normalization in `handleChange` so any manual variants of `n/a`, `na`, `none` are automatically standardized to `'N/A'`.

## 2026-10-29 — Admin Sidebar: Rename "Vacancies" Navigation Item to "Applications"

### Requirement & User Directive
> "in the side bar replace vacancies with application"

### Root Cause
In [`ui/src/components/AdminSidebar.jsx`](file:///e:/christop/staging/ui/src/components/AdminSidebar.jsx), the navigation item pointing to `/admin-vacancies` was labeled `'Vacancies'` with `id: 'vacancies'`. Since the page displays and evaluates vacancy applicant submissions ("Vacancy Applications"), renaming the sidebar item to `'Applications'` clarifies the destination while keeping routing and active page indicators intact.

### UI & Navigation Changes
1. **Sidebar Item Update ([`AdminSidebar.jsx`](file:///e:/christop/staging/ui/src/components/AdminSidebar.jsx))**:
   - Updated navigation item `id` from `'vacancies'` to `'applications'`.
   - Updated navigation item `label` from `'Vacancies'` to `'Applications'`.
   - Maintained target path `'/admin-vacancies'` and active status condition `(pathname, search) => pathname === '/admin-vacancies' || pathname === '/vacancies'`.
   - Preserved document icon (`FiFileText`) and tooltip behavior.

## 2026-10-29 — Admin Vacancies: UI & Layout Design Enhancement

### Requirement & User Directive
> "attached image fix my design in the page of "admin-vacancies""

### Root Cause
In [`ui/src/pages/AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx):
1. **Missing Sticky Top Navigation Bar**: Unlike other admin modules (`OfficialsRegistry`, `Home`, `TloPositions`), `AdminVacancies` lacked the standard top sticky header. As a result, scrolling on the window caused the KPI stat cards at the top to be sliced off and shoved awkwardly against the browser address bar.
2. **Incorrect Scroll Container**: The main content wrapper was set to `overflow-hidden` rather than `h-screen overflow-y-auto relative`, preventing smooth container scrolling.
3. **Table & Typography Defects**:
   - `Application No` rendered in jagged monospace within a tight pill.
   - `Applicant Name` cell had `flex-wrap` which forced the appointed TLO badge onto line 2, pushing the email and phone number down and cutting off the phone number at the bottom of the row.
   - Avatar placeholder rendered a broken/corrupted image thumbnail whenever binary picture was missing or invalid.
   - `Designation / OIC` rendered `OIC: N/A` in orange even when no OIC was assigned.
   - Plantilla office and position capitalization was inconsistent (`n/a` vs `N/A`).
   - Dates in `font-mono text-slate-400` rendered blurry/pixelated.
   - Table container used cyan `border-2 border-[#BAE6FD]` instead of brand `#08315F` navy border.

### Architectural & UI Fixes
1. **Standard Sticky Top Navigation Header ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx))**:
   - Added sticky top navigation header bar (`h-screen overflow-y-auto relative` container + `<header className="sticky top-0 z-50 bg-[#08315F] ...">`) with the official `TIMON (Third Level Incumbent and Management Operations Network)` subtitle and admin credentials display.
2. **Table Design & Typography Polish ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx))**:
   - Upgraded table container to `border-2 border-[#08315F]` matching the rest of the application.
   - Redesigned `Applicant Name` into a strictly aligned 3-line layout (Line 1: Name + inline Appointed badge, Line 2: Email with mail icon, Line 3: Phone with phone icon), eliminating vertical overflow and line clipping.
   - Replaced fragile avatar placeholder with a gradient avatar container displaying crisp applicant initials if picture fails or is absent.
   - Cleaned up `OIC` rendering to filter out `'N/A'`, `'na'`, and `'none'`, eliminating the confusing `OIC: N/A` display.
   - Standardized `Current Position` and `Plantilla Office` capitalization to clean uppercase `N/A`.
   - Replaced blurry monospace dates and codes with crisp, readable sans-serif typography.

## 2026-10-29 — Nexus Gate: Embed User Guide Button Directly Inside TIMON Portal Card

### Requirement & User Directive
> "i don't like it i want inside the "nexus-card nexus-card-thirdlevel" of this button"

### Architectural & UI Fixes
1. **Direct Card Embedding ([`NexusGate.jsx`](file:///e:/christop/staging/ui/src/pages/NexusGate.jsx))**:
   - Removed external `.nexus-top-actions` wrapper entirely.
   - Positioned `<button className="nexus-guide-btn">` directly inside `<div className="nexus-card-header">` within `.nexus-card.nexus-card-thirdlevel`.
   - `.nexus-card-header` utilizes `display: flex; justify-content: space-between; align-items: center;`, placing the yellow icon badge on the left and the dark blue `USER GUIDE` pill button on the right inside the card.
   - Retained `e.stopPropagation()` on the button click handler so opening the User Guide modal does not trigger the card's portal navigation.
2. **CSS Optimization ([`NexusGate.css`](file:///e:/christop/staging/ui/src/pages/NexusGate.css))**:
   - Cleaned up obsolete absolute/flex `.nexus-top-actions` container rules.
   - Refined `.nexus-guide-btn` with `z-index: 5` and `padding: 8px 18px` to seamlessly integrate inside the card header.

## 2026-10-29 — Asset Update: Replace "modern_logo.png" with "tlo_logo.png"

### Requirement & User Directive
> "replace "modern_logo.png" with "tlo_logo.png""

### Summary of Changes
Replaced all imports and references to `modern_logo.png` with `tlo_logo.png` across the application frontend and asset directories:
1. **Public Favicon & Static Assets**:
   - Copied `ui/src/assets/tlo_logo.png` to [`ui/public/tlo_logo.png`](file:///e:/christop/staging/ui/public/tlo_logo.png).
   - Updated favicon link in [`ui/index.html`](file:///e:/christop/staging/ui/index.html) to `<link rel="icon" type="image/png" href="/tlo_logo.png" />`.
2. **Components**:
   - [`AdminSidebar.jsx`](file:///e:/christop/staging/ui/src/components/AdminSidebar.jsx): Updated import to `tlo_logo.png`.
   - [`LoadingScreen.jsx`](file:///e:/christop/staging/ui/src/components/LoadingScreen.jsx): Updated import to `tlo_logo.png`.
   - [`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx): Updated import to `tlo_logo.png`.
3. **Pages**:
   - [`Login.jsx`](file:///e:/christop/staging/ui/src/pages/Login.jsx): Updated import to `tlo_logo.png`.
   - [`NexusGate.jsx`](file:///e:/christop/staging/ui/src/pages/NexusGate.jsx): Updated import to `tlo_logo.png`.
   - [`OfficialProfiling.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialProfiling.jsx): Updated import to `tlo_logo.png`.
   - [`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx): Updated import to `tlo_logo.png`.
   - [`Register.jsx`](file:///e:/christop/staging/ui/src/pages/Register.jsx): Updated import to `tlo_logo.png`.
   - [`ResetPassword.jsx`](file:///e:/christop/staging/ui/src/pages/ResetPassword.jsx): Updated import to `tlo_logo.png`.
   - [`VacancyLogin.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyLogin.jsx): Updated import to `tlo_logo.png`.

## 2026-10-29 — System Branding Update: Rename TLO Dashboard to TIMON

### Requirement & User Directive
> "Change TLO Dashboard to TIMON (Third Level Incumbent and Management Operations Network)"

### Architectural & Branding Changes
1. **Document & Meta Titles**:
   - Updated [`ui/index.html`](file:///e:/christop/staging/ui/index.html) title to `TIMON | Third Level Incumbent and Management Operations Network`.
   - Updated [`ui/public/briefing.html`](file:///e:/christop/staging/ui/public/briefing.html) title to include `TIMON (Third Level Incumbent and Management Operations Network)`.

2. **Navigation & Dashboard Headers**:
   - **Admin Sidebar ([`AdminSidebar.jsx`](file:///e:/christop/staging/ui/src/components/AdminSidebar.jsx))**:
     - Updated top brand name to `TIMON` with subtitle `Admin Workspace`.
     - Renamed primary navigation dashboard label to `TIMON Dashboard`.
     - Updated footer watermark to `TIMON • Department of Education`.
   - **Executive Dashboard ([`Home.jsx`](file:///e:/christop/staging/ui/src/pages/Home.jsx))**:
     - Updated top header to `TIMON Dashboard` with subtitle `Third Level Incumbent and Management Operations Network`.
   - **Main Dashboard ([`DashboardHeader.jsx`](file:///e:/christop/staging/ui/src/pages/MainDashboard/components/DashboardHeader.jsx))**:
     - Updated header to `TIMON Dashboard` with subtitle `Third Level Incumbent and Management Operations Network • {recordCount} Records Loaded`.
   - **Personnel Registry ([`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx))**:
     - Updated subtitle to `Official Leadership Management • TIMON (Third Level Incumbent and Management Operations Network)`.
   - **Position Assignments ([`PositionAssignments.jsx`](file:///e:/christop/staging/ui/src/pages/PositionAssignments.jsx))**:
     - Updated subtitle to `Plantilla Deployment & Staffing • TIMON (Third Level Incumbent and Management Operations Network)`.
   - **Positions Library ([`TloPositions.jsx`](file:///e:/christop/staging/ui/src/pages/TloPositions.jsx))**:
     - Updated subtitle to `Plantilla Inventory & Catalog • TIMON (Third Level Incumbent and Management Operations Network)`.
   - **CES Plantilla ([`CesPlantilla.jsx`](file:///e:/christop/staging/ui/src/pages/CesPlantilla.jsx))**:
     - Updated subtitle to `Plantilla Management • TIMON (Third Level Incumbent and Management Operations Network)`.

3. **Portal Gates & Authentication**:
   - **Nexus Gate ([`NexusGate.jsx`](file:///e:/christop/staging/ui/src/pages/NexusGate.jsx))**:
     - Updated admin access capsule hover text to `TIMON Records Management`.
     - Updated Third Level card to `TIMON Portal` with description emphasizing `Third Level Incumbent and Management Operations Network`.
     - Updated Central Office Administrative Portal gate modal to `TIMON • Third Level Incumbent & Management Operations Network`.
   - **Gate ([`Gate.jsx`](file:///e:/christop/staging/ui/src/pages/Gate.jsx))**:
     - Updated portal headline to `TIMON Portal` and subtitle to `Third Level Incumbent and Management Operations Network`.

## 2026-10-29 — Officials Registry: Remove Scrollable in Table for "For Approval" Status

### Requirement & User Directive
> "remove scrollable in the table of 'officials-registry?status=For%20Approval'"

### Root Cause
When accessing `officials-registry?status=For%20Approval`, the table wrapper was applying `overflow-x-auto scrollbar-thin` with `min-w-[1190px]` on the `<table>` element and `min-w-[...]` bounds across all table columns. This forced horizontal scrolling on the page when viewing records pending approval.

### Architectural & UI Fixes
1. **Conditional Scrollable Wrapper & Table Sizing ([`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx))**:
   - Detects `isForApproval = statusTab === 'For Approval'`.
   - When `statusTab === 'For Approval'`:
     - Sets the container wrapper to `overflow-hidden` instead of `overflow-x-auto scrollbar-thin`, removing the horizontal scrollbar completely.
     - Removes `min-w-[1190px]` from `<table className="hidden md:table w-full text-left border-collapse table-fixed">` so the table naturally fits 100% of the container width without scrolling.
   - For all other status tabs, preserves `min-w-[1190px]` and `overflow-x-auto` to prevent data squishing when rendering full records.

2. **Proportional Column Widths & Compact Controls for "For Approval"**:
   - Removed `min-w-[...]` restrictions from `tableColumns` when `isForApproval` is true.
   - Distributed clean proportional widths totaling exactly 100%:
     - `region`: `w-[8%]`
     - `division`: `w-[11%]`
     - `name`: `w-[27%]`
     - `profile_completion`: `w-[13%]`
     - `position_title`: `w-[13%]`
     - `designation`: `w-[11%]`
     - `is_oic`: `w-[5%]`
     - `status`: `w-[12%]`
   - Adjusted `<th>` padding (`px-2 py-3`) and inline `<select>` filter dropdowns to compact height (`h-[30px] px-1 text-[12px]`) when in "For Approval" view to eliminate overlapping controls.
   - Adjusted official name typography to `text-[16px] xl:text-[18px]` to ensure optimal legibility.

## 2026-10-29 — Responsiveness Fix: Personnel Registry Table Horizontal Scroll & Responsive Layout

### Requirement & User Directive
> "not responsive attached iamge make it responsive"

### Root Cause
In [`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx), the desktop `<table>` utilized `table-fixed w-full` inside an outer card container with `overflow-hidden` without an `overflow-x-auto` wrapper or column minimum widths (`min-w-[...]`). When the viewport width was restricted (e.g. tablet screens, laptops, or browser half-screen with DevTools open), the 8 columns were compressed proportionally into narrow widths (under 40-75px each), causing header text, dropdown filters, badges, and action buttons to collide, overlap, and clip off the right edge under the floating action button.

### Architectural & UI Fixes
1. **Horizontal Scroll Wrapper ([`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx))**:
   - Wrapped the table element in `<div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">`.
   - Set `min-w-[1190px]` on `<table className="hidden md:table w-full min-w-[1190px] text-left border-collapse table-fixed">` ensuring columns preserve their readable layout and never crush.
2. **Column Width & Padding Optimization**:
   - Enhanced `tableColumns` to include explicit minimum widths (`min-w-[105px]` for Region, `min-w-[135px]` for Division, `min-w-[260px]` for Official Profile, `min-w-[140px]` for Profile Completion, `min-w-[160px]` for Position, `min-w-[130px]` for Designation, `min-w-[70px]` for OIC, `min-w-[160px]` for Status).
   - Streamlined `<th>` inline filter dropdowns with responsive font size (`text-[12.5px] - text-[13.5px]`), height (`h-[34px]`), and padding (`px-2`) so select controls no longer overlap adjacent headers.
   - Removed conflicting artificial `max-w-[...]` bounds from `<td>` elements that forced premature truncation.
3. **Adaptive Page Container**:
   - Updated main content padding from fixed `px-8` to responsive `px-3 sm:px-6 lg:px-8`.
   - Updated navigation header padding to `px-4 sm:px-8`.
   - Updated top filter grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`.

## 2026-10-29 — Identity Reconciliation Decision: Selectable Approval Target (Registration vs Existing Official)

### Requirement & User Directive
> "in the modal of 'Reconcile & Link Registration Identity' add function where i can select who is approve"

### Architectural & Business Logic Changes
1. **Interactive Decision Selection UI ([`OfficialsRegistry.jsx`](file:///e:/christop/staging/ui/src/pages/OfficialsRegistry.jsx))**:
   - Added `reconcileApprovedTarget` state (`'registration'` or `'candidate'`, default `'registration'`).
   - Integrated a dedicated **"Select Who to Approve & Retain as Active Official"** decision selector directly in the reconciliation modal:
     - **Option 1: Approve Registration Record (`reconcileTargetItem.TLOid`)**: Retains and activates the newly submitted registration identity as `Active`, inherits canonical masterlist profile details, and deactivates the existing canonical candidate record.
     - **Option 2: Approve Existing Official Record (`selectedCandidate.TLOid`)**: Retains the existing official masterlist record as `Active`, links the registrant's login credentials (`reconcileTargetItem.email`) to the active canonical record, and deactivates the duplicate registration record.
   - Enhanced the side-by-side comparison cards to be interactive and clickable, showing dynamic visual focus rings (`ring-emerald-500`) and badges (`SELECTED TO APPROVE (ACTIVE)` vs `WILL BE SET TO INACTIVE`).
   - Dynamically formatted the verification declaration banner, checkbox confirmation label, and action submit button to explicitly state which record is being approved and which is being deactivated.

2. **Backend Reconciliation Handler Enhancement ([`thirdLevelController.js`](file:///e:/christop/staging/api/src/controllers/thirdLevelController.js))**:
   - Enhanced `action === 'reconcile'` in `processRegistration`:
     - Reads `approved_record` and `approved_TLOid` from `req.body`.
     - When `recordToApprove === 'candidate'`:
       - Updates existing official record (`candidateTLOid`) with any newly submitted contact/bio/photo data from registration record, preserves/links `regEmail` via `alt_email_1` / `alt_email_2`, and retains `status = 'Active'`.
       - Transitions registration record (`registrationTLOid`) to `status = 'Inactive'`.
       - Clones any newly submitted registration child tables to `candidateTLOid` via `cloneMasterlistChildTables`.
       - Approves `tlo_users` account for `regEmail` (`role = 'Third Level Official'`, `registration_status = 'Approved'`).
       - Repoints profiling staging application target to `candidateTLOid`.
       - Records non-sequence-dependent audit logs in `third_level_officials_updates` for both records.
       - Dispatches approval email with the retained `candidateTLOid`.
     - When `recordToApprove === 'registration'`:
       - Preserves the existing retain-and-activate flow for backward compatibility.

## 2026-10-28 — Policy & UI Enforcement: Prohibit Reappointment to Other Positions When Applicant is in Masterlist

### Requirement & User Directive
> "do not to reappoint to other position 
> you can check in the materlist table if the id of vacancy_applicant is already there so disable in the page of admin-vacancies table"

### Architectural & Business Logic Changes
1. **Lateral Masterlist Link Check in Application Queries ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - Updated `getAllVacancyApplications`, `getVacancyApplicationById`, and `getMyVacancyApplications` to join `third_level_official_masterlist` via `LEFT JOIN LATERAL` using `vacancy_applicant_id` (with fallback to `email`).
   - Computes:
     - `appointed_tlo_id`: Official TLO ID in the masterlist (e.g. `TLO-0627`).
     - `masterlist_position_title`: Position title assigned in the masterlist.
     - `masterlist_plantilla_item_no`: Plantilla item number assigned in the masterlist.
     - `is_applicant_in_masterlist`: `true` if applicant has an active record in `third_level_official_masterlist`.
     - `is_already_appointed_elsewhere`: `true` if applicant is in masterlist and this specific application is not the appointed one.

2. **Backend Appointment Validation ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - In `updateVacancyApplicationStatus`: When evaluating an application for appointment (`status = 'Appointed'`), queries `third_level_official_masterlist` for `vacancy_applicant_id`.
   - If an existing masterlist record is found and its assigned plantilla item differs from the target vacancy ID (or is already appointed), rejects with HTTP 400:
     `Cannot reappoint to other position. This applicant is already appointed as ${assignedTloId} for position "${existingMasterRecord.position_title || existingMasterRecord.plantilla_item_no}" in the Official Masterlist.`

3. **Admin Vacancies Table UI ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx))**:
   - In the Table:
     - Table rows for applicants already appointed elsewhere are styled as disabled (`bg-slate-100/60 opacity-60 cursor-not-allowed select-none`).
     - Clicking the row does NOT open the application details modal (`if (app.is_already_appointed_elsewhere) return;`).
     - The Action button renders as an explicitly disabled button (`<button disabled>` with `cursor-not-allowed opacity-60 bg-slate-100 text-slate-400` and label `Disabled`) with clear tooltip explaining why reappointment is disabled.
     - Applicant Name column displays a distinct amber badge: `In Masterlist (TLO-####)` when appointed elsewhere, or emerald badge when this record is the appointed one.
     - Status column displays an additional indicator: `Reappoint Disabled` with warning icon when `app.is_already_appointed_elsewhere` is true.

4. **Application Details Modal ([`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx))**:
   - Displays an alert banner at the top of Central Office evaluation when the applicant is already in the masterlist.
   - Completely omits the `"Appointed"` option from the status dropdown when `application.is_already_appointed_elsewhere` is true so it cannot be selected.
   - Blocks save attempts with a SweetAlert2 warning dialog if reappointment is attempted.

## 2026-10-28 — Adjustment: Set Appointed User Role in `tlo_users` to "TLO Applicant"

### Requirement
The user explicitly requested that upon successful appointment of a vacancy applicant, their account role created/updated in `tlo_users` should be `"TLO Applicant"` instead of `"Third Level Official"`.

### Changes Applied ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))
- In `updateVacancyApplicationStatus`: Updated the `tlo_users` `INSERT` and `UPDATE` queries to assign `role = 'TLO Applicant'`.
- Updated existing appointed test record (`james@gmail.com`) in `tlo_users` to have `role = 'TLO Applicant'`.

## 2026-10-28 — Feature & Schema Migration: Add `passcode` Column to `vacancy_applicants` Table

### Objective
Enable Vacancy Applicants to register and sign in using their 6-digit passcode in addition to their password on the Vacancies portal.

### Changes Applied
1. **Database Schema Migration ([`20261028_059_add_passcode_to_vacancy_applicants.sql`](file:///e:/christop/staging/database/migrations/20261028_059_add_passcode_to_vacancy_applicants.sql))**:
   - Added `passcode VARCHAR(255)` column to table `vacancy_applicants`.
   - Synchronized existing passcodes from `tlo_users` for existing vacancy applicant accounts.
   - Updated idempotent startup check in [`db.js`](file:///e:/christop/staging/api/src/config/db.js).
2. **Registration Controller ([`registerController.js`](file:///e:/christop/staging/api/src/controllers/registerController.js))**:
   - Stored clean `passcode` in `vacancy_applicants` during Vacancy Applicant registration.
   - Returned `has_passcode: Boolean(cleanPasscode)` in auth response.
3. **Login Controller ([`loginController.js`](file:///e:/christop/staging/api/src/controllers/loginController.js))**:
   - In `login` (`/api/auth/login`): Verified submitted secret against `vacancy_applicants.passcode` (both plain and bcrypt formats).
   - In `pinLogin` (`/api/auth/login-passcode`): Added isolated vacancy applicant lookup and validation against `vacancy_applicants.passcode`.
   - Returned `has_passcode: Boolean(vacancyApplicant.passcode || legacyUser?.passcode)`.
4. **User Settings Controller ([`userController.js`](file:///e:/christop/staging/api/src/controllers/userController.js))**:
   - Updated `updateSettings` to target `vacancy_applicants` when `req.user.role === 'Vacancy Applicant'`.
5. **Official Appointment Workflow ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - Preserved and synced applicant's `passcode` into `tlo_users` upon appointment.

## 2026-10-28 — Bugfix: Column `id` Does Not Exist on `tlo_users` During Application Appointment

### Root Cause
When an application status was updated to "Appointed" in `admin-vacancies`, [`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js) attempted to verify if an existing user record existed in table `tlo_users` using:
```sql
SELECT id FROM tlo_users WHERE LOWER(email) = LOWER($1)
```
In PostgreSQL, `tlo_users` does not have a column named `id` (its primary key is `uid`). Consequently, PostgreSQL aborted the transaction and returned:
`Internal server error while updating application status: column "id" does not exist`.

Additionally, the subsequent update/insert queries on `tlo_users` referenced columns that do not exist on `tlo_users` (`updated_at`, `middle_name`) as well as an invalid `ON CONFLICT (email)` clause (`tlo_users` does not have a unique constraint on `email`).

### Resolution & Changes Applied ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))
1. Changed `SELECT id FROM tlo_users` to `SELECT uid FROM tlo_users`.
2. Removed references to `updated_at` and `middle_name` on `tlo_users`, aligning columns to actual schema: `uid, email, password_hash, hash_version, first_name, last_name, contact_number, role, registration_status, is_testaccount, created_at`.
3. Removed the invalid `ON CONFLICT (email)` clause from `INSERT INTO tlo_users`, relying on the prior `SELECT uid` existence check.

### User Requirement & Architectural Objective
The user explicitly specified:
> "do not insert data in the table of 'tlo_users' registration of vacancies. only inserted in the 'vacancy_applicants'"

Under this updated architecture:
1. Vacancy Applicant registration exclusively inserts into `vacancy_applicants`. No records are inserted into `tlo_users` during registration.
2. Vacancy portal authentication verifies credentials directly against `vacancy_applicants` (using `vacancy_applicants.password_hash` with bcrypt, with legacy fallback to `tlo_users`).
3. Vacancy applicants cannot access the Central Office or Third Level Official portals until and unless they are officially appointed.
4. When an applicant is officially appointed (promoted to the Masterlist), an account is provisioned in `tlo_users` with role `'Third Level Official'` carrying over their password hash.

### Key Changes
1. **Database Schema Migration ([`20261028_058_add_password_hash_to_vacancy_applicants.sql`](file:///e:/christop/staging/database/migrations/20261028_058_add_password_hash_to_vacancy_applicants.sql))**:
   - Added `password_hash VARCHAR(255)` column to `vacancy_applicants`.
   - Backfilled password hashes from `tlo_users` for existing vacancy applicant accounts.
   - Updated startup initialization in [`db.js`](file:///e:/christop/staging/api/src/config/db.js).
2. **Registration Controller ([`registerController.js`](file:///e:/christop/staging/api/src/controllers/registerController.js))**:
   - When registering as a Vacancy Applicant (`isVacancyApplicant`), the controller checks email uniqueness against `vacancy_applicants`.
   - Generates sequential UID (`VAC-2026-####`) across `vacancy_applicants` and `vacancy_applications`.
   - Hashes password using bcrypt.
   - Inserts **ONLY** into `vacancy_applicants`.
   - Completely omits any insert into `tlo_users`.
   - Issues a 30-day JWT token with role `'Vacancy Applicant'`.
3. **Login Controller ([`loginController.js`](file:///e:/christop/staging/api/src/controllers/loginController.js))**:
   - For Vacancies portal logins (`portal === 'vacancies'` or `role === 'Vacancy Applicant'`), directly queries `vacancy_applicants` first.
   - Verifies submitted password against `vacancy_applicants.password_hash`.
   - Fallback checks `tlo_users` only for legacy compatibility.
   - Issues session JWT token and profile data purely from `vacancy_applicants`.
4. **Official Appointment Provisioning ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - When an application status is set to `'Appointed'`, if the user does not exist in `tlo_users`, provisions an account in `tlo_users` with role `'Third Level Official'` and `registration_status = 'Active'`, copying their `password_hash` from `vacancy_applicants`.

## 2026-10-28 — Bugfix: Vacancy Applicant Registration Unique Constraint Violation on `applicant_uid`

### Root Cause
During Vacancy Applicant registration in `registerController.js`, the sequential identifier generator calculated the next `uid` by selecting `MAX` from `tlo_users WHERE uid ~ '^VAC-2026-[0-9]{4}$'`. Because some users registered with different roles or had their role promoted, `tlo_users` only contained `VAC-2026-0001`, causing the generator to calculate `max_num = 1` and produce `VAC-2026-0002`. However, table `vacancy_applicants` already contained `VAC-2026-0002` (which has a strict `UNIQUE` constraint on `applicant_uid`). Attempting to insert into `vacancy_applicants` triggered a PostgreSQL unique constraint violation: `duplicate key value violates unique constraint "vacancy_applicants_applicant_uid_key"`.

### Resolution & Changes Applied
1. **Multi-Table `GREATEST` UID Generation ([`registerController.js`](file:///e:/christop/staging/api/src/controllers/registerController.js))**:
   - Querying the true maximum sequential number across all relevant tables: `tlo_users`, `vacancy_applicants`, and `vacancy_applications`.
   - Checks if a profile already exists for the email in `vacancy_applicants` to reuse the existing canonical `applicant_uid`.
   - Added `ON CONFLICT (email) DO UPDATE` fallback on `vacancy_applicants` to maintain idempotent user profile linking.
2. **Alignment Across Controllers ([`loginController.js`](file:///e:/christop/staging/api/src/controllers/loginController.js), [`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - Standardized UID calculation in `loginController.js` and `vacancyApplicantController.js` to also query `GREATEST` across `tlo_users`, `vacancy_applicants`, and `vacancy_applications`.
   - Verified that subsequent registrations produce guaranteed sequential UIDs (`VAC-2026-0003`, `VAC-2026-0004`, etc.) without collision.

## 2026-10-28 — Bugfix: Auto-Vacate/Occupy Plantilla Vacancy Positions Upon Appointment & Query Protection

### Root Cause
When a vacancy application was marked as "Appointed" in `admin-vacancies`, the appointment transaction promoted the candidate into `third_level_official_masterlist` and synced `tlo_masterlist`, but did not update the underlying target vacancy record (`ces_plantilla` or `tlo_assignments`). In `ces_plantilla`, `is_vacant` remained `true` and `incumbent_name` remained `'VACANT'`. Consequently, `getVacancies` (which queries `ces_plantilla WHERE is_vacant = true AND is_section_header = false`) continued to include the filled position in the list displayed on the `/all-vacancies` page.

### Resolution & Changes Applied
1. **Target Vacancy Status Synchronization in `vacancyApplicantController.js`**:
   - Inside `updateVacancyApplicationStatus`, when an applicant is set to `'Appointed'`:
     - Updates `ces_plantilla`: sets `is_vacant = false`, `incumbent_name = '<LASTNAME>, <FIRSTNAME> <M.>'`, and `status_of_appointment = 'Appointed'` for `dbm_item_no = target_vacancy_id`.
     - Updates `tlo_assignments`: sets `tlo_masterlist_id` to the newly appointed official's numeric ID, `status = 'Active'`, `capacity = 'Full'`, and `start_date = CURRENT_DATE` for `tlo_position_id = target_vacancy_id`.
     - Links `plantilla_item_no` in `third_level_official_masterlist` and `tlo_masterlist`.
   - If an application was previously `'Appointed'` and is transitioned away to another status (e.g., reverted or rejected), it automatically restores the position in `ces_plantilla` (`is_vacant = true`, `incumbent_name = 'VACANT'`), unlinks `tlo_assignments`, and resets the applicant's registration status.
2. **Defensive Vacancy Query in `thirdLevelController.js`**:
   - Updated `getVacancies` (`CombinedVacancies` CTE):
     - Added `AND NOT EXISTS` subqueries to explicitly exclude any position whose item number or ID is currently held by an application with `status = 'Appointed'`, or is assigned in `third_level_official_masterlist` (`status != 'Inactive'`).
     - Added check `AND UPPER(TRIM(COALESCE(incumbent_name, ''))) IN ('', 'VACANT')` in `ces_plantilla`.
3. **Database Data Alignment**:
   - Reconciled existing appointed application (`APP-VAC-2026-0003`, target item `OSEC-DECSB-DASEC-3-1998`) in `ces_plantilla` and `third_level_official_masterlist`. The position is immediately removed from the open vacancies list.

## 2026-10-28 — Feature: Vacancy Applicant "Appointed" Workflow & Masterlist Promotion Pipeline

### Overview & User Objective
Updated the Central Office evaluation workflow for Third Level vacant positions (`admin-vacancies`). Replaced the status option "Approved" with "Appointed" to conform with official DepEd and Civil Service Commission (CSC) executive appointment protocols. When an applicant is marked as "Appointed", the system atomically promotes their application and profile into the official TLO Masterlist (`third_level_official_masterlist` and `tlo_masterlist`), generates a canonical `TLO-####` identifier, establishes foreign-key cross-references, escalates their `tlo_users` account role to `Third Level Official`, and asynchronously relocates their documentary attachments in Azure Blob Storage under the new TLO ID folder.

### Key Additions & Features
1. **Database Schema Migration ([`20261028_057_add_tloid_link_to_vacancy_applicants.sql`](file:///e:/christop/staging/database/migrations/20261028_057_add_tloid_link_to_vacancy_applicants.sql))**:
   - Added `vacancy_applicant_id INTEGER REFERENCES vacancy_applicants(id) ON DELETE SET NULL` to table `third_level_official_masterlist` exclusively.
   - Preserved original, untouched schemas for `vacancy_applicants` and `vacancy_applications` (no extra columns added).
   - Added B-tree index `idx_tlo_masterlist_vacancy_applicant_id` on `third_level_official_masterlist(vacancy_applicant_id)`.
   - Updated startup initialization in [`db.js`](file:///e:/christop/staging/api/src/config/db.js) with idempotent `ADD COLUMN IF NOT EXISTS vacancy_applicant_id INTEGER` check on `third_level_official_masterlist`.

2. **Backend Transaction-Safe Promotion Pipeline ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js))**:
   - Upgraded `updateVacancyApplicationStatus`: Wrapped appointment execution in a strict ACID transaction (`BEGIN` / `COMMIT` / `ROLLBACK`).
   - Automatically checks for existing masterlist associations using `vacancy_applicant_id` and email to guarantee idempotency and avoid duplicate appointments.
   - Calculates the next sequential canonical `TLO-####` identifier from `third_level_official_masterlist`.
   - Inserts/updates `third_level_official_masterlist` storing `vacancy_applicant_id`, official names, birth date, appointment date, position title, office, and binary attachment UUIDs (`photo_binary_id`, `pds_binary_id`, `wes_binary_id`, `cv_binary_id`, `service_records_binary_id`, `profile_word_binary_id`).
   - Synchronizes demographic records in `tlo_masterlist` with `ON CONFLICT (tloid) DO UPDATE`.
   - Dynamically exposes `appointed_tlo_id` to the frontend across `getAllVacancyApplications`, `getMyVacancyApplications`, and `getVacancyApplicationById` via `LEFT JOIN third_level_official_masterlist m ON m.vacancy_applicant_id = va.vacancy_applicant_id`.
   - Escalates the user's role in `tlo_users` from applicant tiers (`Third Level Applicant`, `Vacancy Applicant`, `TLO Applicant`) to `Third Level Official` and sets `registration_status = 'Active'` keyed by `email`.
   - Updated `getAllVacancyApplications` KPI query to count both `Appointed` and legacy `Approved` under `appointed`.

3. **Cloud Document Relocation Service ([`azureBlobService.js`](file:///e:/christop/staging/api/src/utils/azureBlobService.js))**:
   - Added `copyBlobToTloid(sourceBlobUrlOrPath, targetTloId, docType)` leveraging Azure Blob Storage SDK.
   - Asynchronously copies uploaded application files (`APP-<id>/...`) to the canonical official folder structure (`<TLOid>/<docType>/<docType>_<TLOid>_<timestamp>.<ext>`) in the background, updating `unified_binaries.azure_blob_url` without blocking or slowing down HTTP responses.

4. **UI Modal & Evaluation Panel Updates ([`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx))**:
   - Replaced `<option value="Approved">` with `<option value="Appointed">`.
   - Added `Appointed` badge color mapping (`bg-emerald-50 text-emerald-700 border-emerald-200`).
   - Added header badge showing official Masterlist ID (`Official: TLO-####`) once appointed.
   - Custom success confirmation displaying the generated TLO ID upon appointment.

5. **Admin Vacancies Dashboard & Filters ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx))**:
   - Updated Card 5 from "Approved" to "Appointed" with live count of appointed applicants.
   - Updated Status Filter dropdown option from "Approved" to "Appointed".
   - Supported backward compatibility in filter predicates (`status IN ('Appointed', 'Approved')`).

6. **Candidate Dashboard Tracking ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
   - Updated application status badge renderer to display `Appointed` styling and prominently display the official assigned `TLO ID` on the card.

---

## 2026-10-27 — Central Office: Vacancy Applications Management & Registry Page

### Overview & User Objective
Added a dedicated Central Office "Vacancies" navigation item and page ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx)) allowing Central Office, Super User, and Personnel Admin roles to view, search, filter, export, and evaluate all data in the `vacancy_applications` database table.

### Key Additions & Features
1. **Central Office Sidebar Navigation ([`AdminSidebar.jsx`](file:///e:/christop/staging/ui/src/components/AdminSidebar.jsx))**:
   - Added `Vacancies` nav item (`path: '/admin-vacancies'`) with `FiFileText` icon, placed in the main operational section alongside Positions Library and Pending Approvals.
2. **Central Office Vacancies Page ([`AdminVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AdminVacancies.jsx))**:
   - Displays all records from `vacancy_applications` in a responsive table with DepEd brand styling (`#08315F`, `#BAE6FD`).
   - Includes real-time search across Application No, Applicant Name, Email, Contact, Position Applying For, Plantilla Office, and Target Vacancy Item.
   - Interactive KPI metric cards (Total Applications, Submitted, Under Review, Shortlisted, Approved) with click-to-filter capability.
   - Status filters, CES Eligibility Stage dropdown, and quick-filter pills for LET and EMT passers.
   - Full CSV export button that extracts all 22+ columns from `vacancy_applications`.
   - Pagination controls with customizable page size (10, 20, 50, 100).
3. **Application Review & Modal Enhancements ([`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx))**:
   - Added passport ID picture display thumbnail.
   - Added Central Office evaluation panel permitting evaluator status updates (`Submitted`, `Under Review`, `Shortlisted`, `Approved`, `Rejected`) and remarks recording with instant local and server synchronization.
4. **Backend API Endpoints ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js) & [`officialProfilingRoutes.js`](file:///e:/christop/staging/api/src/routes/officialProfilingRoutes.js))**:
   - `GET /api/third-level/vacancy-applications/all`: Returns all records from `vacancy_applications` sorted by `created_at DESC` along with status breakdown KPIs.
   - `PATCH /api/third-level/vacancy-applications/:id/status`: Updates application status and remarks with timestamp tracking.
5. **Route Configuration ([`App.jsx`](file:///e:/christop/staging/ui/src/App.jsx))**:
   - Registered `/admin-vacancies` protected route.
   - Updated `/vacancies` route with role-aware dispatching to route Central Office / Admin users to `AdminVacancies` while preserving applicant access to `VacancyDashboard`.

### Overview & User Adjustments
Adjusted the Third Level Position Application modal ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx)) and backend controllers according to updated specifications:
1. **CES Eligibility Stage Date**: Prevent future dates from being selected or submitted for "Date Appointed/Conferred/Passed the CESO/CES eligibility process [Highest Stage]" (`ces_stage_date`) via HTML `max`, real-time `handleChange` checks, step 4 validation, and backend API validation.
2. **Account Passcode Removed**: Completely removed the "Account Passcode" input field and associated state/validation from the modal and review summary. Step 2 (Personal Details) restored to a clean 2-column layout.
3. **ID Picture (Passport Size) — Image Only**: Updated document item 10 (`id_picture`) to allow image files only (`accept: 'image/jpeg,image/png,image/webp'`, `isImage: true`). All other 11 documents remain in PDF format.
4. **Date of Birth & Telephone**: Retained Date of Birth future date prevention and 11-digit auto-dash telephone number formatting (`0917-123-4567`) saved as 11 digits without dashes in the database.

### Files Updated
1. [`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx):
   - Added `max={today}` to `ces_stage_date` with validation preventing future date input in `handleChange` and `validateStep(4)`.
   - Removed `passcode` state, toggle visibility, validation, and JSX inputs.
   - Restored `id_picture` to `accept: 'image/jpeg,image/png,image/webp'` and `isImage: true`.
   - Updated `handleFileUpload` to validate images for ID picture and PDFs for all other documents.
2. [`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js):
   - In `uploadVacancyDocument`: validates image type for `id_picture` and PDF type for all other documents.
   - In `submitVacancyApplication`: validates both `date_of_birth` and `ces_stage_date` are not in the future.
   - Fixed `tlo_users` sync by removing non-existent `updated_at` column from `UPDATE tlo_users SET contact_number = $1 WHERE LOWER(email) = $2`.
3. [`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx):
   - Formats 11-digit contact numbers as `XXXX-XXX-XXXX`.
4. [`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx):
   - Fixed `ReferenceError: logout is not defined` by destructuring `logout` from `useAuth()`.

---

## 2026-10-27 — UI/UX: High-Contrast Input Readability & Theme Contrast Fix Across All Vacancy Pages

### Root Cause Analysis
- In [`ui/src/index.css`](file:///e:/christop/staging/ui/src/index.css), `:root` had `color-scheme: light dark;`.
- On client workstations running Windows with OS-level or browser Dark Mode enabled, Chromium/Edge forced native form controls (`<input>`, `<select>`, `<textarea>`) to adopt browser default dark backgrounds (`#242424`/`#333333`).
- Because input elements in modals and forms lacked explicit `bg-white`, they displayed dark slate text (`text-slate-800`) directly against dark gray backgrounds, resulting in unreadable near-zero contrast text (as reported by user screenshot in `ApplyVacancyModal.jsx` for "Target Vacancy Item Number / Identifier").

### Changes & Standardizations
- **Global Color Scheme Enforcement ([`ui/src/index.css`](file:///e:/christop/staging/ui/src/index.css))**:
  - Replaced `:root` `color-scheme: light dark;` with `color-scheme: light;`.
  - Added global stylesheet rules forcing `color-scheme: light !important; background-color: #ffffff; color: #0f172a;` for all `input`, `select`, and `textarea` elements, and crisp `#f1f5f9` / `#334155` for disabled form controls.
- **Vacancy Application Modal ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx))**:
  - Added explicit `bg-white text-slate-900 shadow-sm` across all inputs in all steps:
    - Step 1: `target_vacancy_id`
    - Step 2: `surname`, `first_name`, `middle_name`, `date_of_birth`, `contact_number`, `current_position`, `plantilla_office`
    - Step 3: `current_designation_custom`, `assigned_oic_office`
    - Step 4: `ces_stage_date`
- **Edit Applicant Profile Modal ([`EditVacancyApplicantModal.jsx`](file:///e:/christop/staging/ui/src/components/EditVacancyApplicantModal.jsx))**:
  - Added explicit `bg-white text-slate-900 shadow-sm` to `first_name`, `middle_name`, `last_name`, `suffix`, `contact_number`, and `notes` textarea.
  - Upgraded disabled email styling to `bg-slate-100 border-slate-300 text-slate-700` for clear readability.
- **View Application Details Modal ([`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx))**:
  - Upgraded all metadata labels from muted `text-slate-400` to high-contrast `text-slate-500 font-bold text-[10px] uppercase tracking-wider`.
  - Upgraded all applicant profile and position values to bold `text-slate-900`.
  - Improved contrast of unattached and attached document status tags.
- **List of Vacancies Page ([`AllVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AllVacancies.jsx))**:
  - Updated search bar container to `bg-white border-slate-300 shadow-xs` with `text-slate-900 font-bold`.
  - Updated office filter dropdown to `bg-white border-slate-300 text-slate-800 shadow-xs`.
- **Applicant Dashboard ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Updated top search input and filter dropdowns (Position, Region) to `bg-white border-slate-300 text-slate-800/900 shadow-xs`.
  - Updated catalog table filter bar inputs and selects (Position, Region, Office, Salary Grade, Items Per Page) to high-contrast `bg-white border-slate-300 text-slate-800/900 shadow-xs`.
- **Sidebar & Login ([`VacancyApplicantSidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancyApplicantSidebar.jsx), [`VacancyLogin.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyLogin.jsx))**:
  - Added explicit `bg-white text-slate-900 shadow-sm` to all profile edit inputs, quick vacancy search filter, and login/passcode input fields.

---

## 2026-10-27 — UI/UX: Streamlined Header Actions and Removed Redundant Apply Buttons

### Overview & Changes
- **Modal Step Navigation Cleaned Up ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx))**:
  - Removed `overflow-x-auto` and native horizontal scrollbar from the 5-step application navigation bar (`[1 POSITION & ITEM] [2 PERSONAL DETAILS] [3 DESIGNATION & OIC] [4 ELIGIBILITIES] [5 DOCUMENTS (12)]`).
  - Added `overflow-x-hidden` and `no-scrollbar` with responsive spacing, eliminating the dark native browser scrollbar track while maintaining clean step pill layout across all devices.
- **Header Actions Streamlined ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Removed "Apply Now" and "Edit Profile" buttons from the top executive sticky header to eliminate visual clutter and ensure full focus on the applicant user pill (`fullName` and `applicant_uid`).
  - Removed redundant "Apply for Vacancy" button from the top of the "List of Vacancies" (`/all-vacancies`) page header. Applicants apply directly for specific vacancies using the contextual "Apply Now" buttons on each individual vacancy card or table row.

---

## 2026-10-27 — UI/UX: Full Responsive Design & Layout Optimization for Vacancy Portal

### Overview & Architecture
- **Complete Responsiveness Across All Viewports (320px Mobile to 4K Ultrawide)**:
  - Adhered strictly to [`.agents/master-designer.md`](file:///e:/christop/staging/.agents/master-designer.md) and [`.agents/AGENTS.md`](file:///e:/christop/staging/.agents/AGENTS.md) to ensure readable typography, spatial harmony, zero clipping, zero awkward word wrapping, and zero overlapping elements.
  - Enhanced all vacancy views, tables, grids, cards, action bars, pagination, and modals.
- **Vacancy Sidebar Navigation ([`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx))**:
  - Replaced hardcoded `320px` width on mobile with responsive fluid width `w-[85vw] max-w-[320px] sm:w-[320px]`, preventing overflow on 320px-360px small screens.
  - Added `overflow-y-auto scrollbar-thin` to guarantee full scrollability in mobile landscape viewports.
- **Top Executive Header & Navigation ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Implemented responsive padding `px-4 sm:px-6 lg:px-10 py-3 sm:py-4`, flex-gap `gap-3`, title truncation with `min-w-0`, and adaptive user identity pill so header controls never wrap or push items out of view.
- **Main Container & Welcome Banner ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Scaled outer workspace padding from hardcoded values to responsive `p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8`.
  - Welcome Banner updated with responsive padding `p-5 sm:p-7 lg:p-9`, fluid typography `text-xl sm:text-2xl lg:text-3xl`, and mobile-stacked action buttons (`flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3`).
  - KPI summary metric cards configured with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5` and `min-w-0` to guarantee zero card clipping.
- **Section A (Profile Overview) & Tab 4 (Applicant Profile) ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Grid layouts converted to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5`.
  - Implemented `break-words` on all candidate labels, titles, and remarks, and `break-all` on Email addresses and UIDs to avoid horizontal overflow.
  - Target vacancy banner formatted with responsive stacking on small viewports.
- **Catalog View (List of Vacancies, [`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Search and filter controls adapted for mobile (`flex-col sm:flex-row`, `w-full sm:w-auto`).
  - Table View wrapped in horizontal touch-scrolling container with `<table className="w-full text-left border-collapse min-w-[700px]">` and `whitespace-nowrap` on badges and buttons, ensuring columns remain legible and never overlap on small screens.
  - Grid View cards updated with `min-w-0`, `break-words`, and responsive footer action buttons (`flex-col sm:flex-row items-start sm:items-center justify-between gap-3`).
  - Pagination controls equipped with responsive stacking (`flex-col sm:flex-row items-center justify-between gap-3`).
- **Tab 3: My Submitted Applications ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Container padding upgraded to `p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6`.
  - Application cards fitted with `min-w-0`, `break-words` on position and office titles, 2-column responsive meta details, and responsive footer buttons (`flex-col sm:flex-row`).
- **Modal Dialogs ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx), [`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx), [`EditVacancyApplicantModal.jsx`](file:///e:/christop/staging/ui/src/components/EditVacancyApplicantModal.jsx))**:
  - Backdrop and container padding optimized to `p-2 sm:p-4` with `max-h-[94vh]`.
  - Step navigation in `ApplyVacancyModal.jsx` enabled with touch horizontal scrolling and compact badges.
  - Modal body padding standardized to `p-4 sm:p-6 lg:p-8`.
  - Action footer buttons configured with `flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3` and `w-full sm:w-auto`, preventing button overlap or squeezed touch targets on smartphones.

---

## 2026-10-27 — Feature: Dedicated Per-Page Routing for Applicant Portal

### Overview & Architecture
- **Per-Page Routing Architecture**:
  - Transformed the single-page tabbed Applicant Portal into distinct, standalone page routes:
    - **Applicant Dashboard (`FiGrid`)**: `/vacancy-dashboard` (alias: `/applicant-dashboard`). Renders the applicant overview, welcome banner, live KPI summary cards, registered profile data (`vacancy_applicants`), and top target vacancy.
    - **List of Vacancies (`FiBriefcase`)**: `/all-vacancies` (alias: `/vacancies`). Renders the complete catalog of third level executive plantilla positions with search, regional filters, rank chips, and application modals.
    - **My Applications (`FiFileText`)**: `/my-applications` (alias: `/vacancy-applications`). Renders the applicant's submitted applications, tracking statuses, and submitted 12 mandatory documents.
    - **My Applicant Data (`FiUser`)**: `/my-applicant-data` (alias: `/applicant-profile`). Renders the applicant's official registered personal details, contact credentials, and qualifications/notes.
- **Router Configuration ([`App.jsx`](file:///e:/christop/staging/ui/src/App.jsx))**:
  - Registered dedicated protected routes for `/vacancy-dashboard`, `/applicant-dashboard`, `/all-vacancies`, `/vacancies`, `/my-applications`, `/vacancy-applications`, `/my-applicant-data`, and `/applicant-profile`.
- **Sidebar Navigation & URL Synchronization ([`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx))**:
  - Updated sidebar navigation items with path definitions.
  - Bound navigation clicks directly to `navigate(item.path)` and route-aware active state highlighting with `useLocation()`, matching the user's active sidebar styling.
- **Page Header & View Rendering ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
  - Header title dynamically adapts per route (e.g. *Applicant Dashboard*, *List of Vacancies*, *My Applications*, *My Applicant Data*).
  - Welcome Banner and KPI metric cards are scoped exclusively to `/vacancy-dashboard`.
  - Added dedicated per-page headers for `/all-vacancies`, `/my-applications`, and `/my-applicant-data` with contextual titles, subtitles, and primary action buttons.
  - Updated all internal links (e.g. "Browse Vacancies", "Change Position", "Full Catalog", "Browse Catalog") to call `handleNavigateTab`, synchronizing both browser history and URL routes.
  - Converted the horizontal scrolling category buttons and scrollbar into a clean **Position Dropdown** (`<select>`) inside the Multi-Filter Controls Bar, displaying `All Positions (${vacancies.length})` along with each position title and its respective vacancy count (e.g. `Schools Division Superintendent (28)`, `Assistant Secretary (4)`).
  - Added real-time active filter tag indicators with one-click removal and "Clear All" reset buttons.

---

## 2026-10-27 — Feature: Full Vacancy Application System Matching DepEd Application Form (`vacancy_applications`)

### Overview & Architecture
- **Dedicated Application System for Vacant Third Level Positions (SDS & ASDS)**:
  - Built full application submission pipeline based on the official DepEd Application Form (`https://docs.google.com/forms/d/1JewT5sKZssgGtnaPIxZBoz1YIaX3E9OcJ3fy-SOqVHo/edit?ts=6adef10f`, *"Applications for Third Level Positions (SDS & ASDS)"*).
  - Candidates can now officially apply for any vacant executive position with full personal/employment background, examination/CES eligibilities, and 12 mandatory document attachments.
- **Database Schema Migration ([`20261027_056_create_vacancy_applications_table.sql`](file:///e:/christop/staging/database/migrations/20261027_056_create_vacancy_applications_table.sql))**:
  - Created dedicated table `vacancy_applications` with 49 columns:
    - Application Reference: `application_no` (format `APP-VAC-2026-####`), `applicant_uid` (`VAC-2026-####`), `vacancy_applicant_id`, `email`, `contact_number`.
    - Position Info: `position_applying_for` (e.g. SDS, ASDS), `target_vacancy_id`.
    - Personal & Plantilla Info: `surname`, `first_name`, `middle_name` (ALL CAPS per DepEd standard), `date_of_birth`, `current_position` (unabbreviated), `plantilla_office` (SDO/RO or agency assignment).
    - Third Level Designation: `current_designation` (OIC-SDS, OIC-ASDS, N/A, or full unabbreviated designation), `assigned_oic_office`.
    - Examination & CES Status: `is_let_passer` (BOOLEAN), `is_emt_passer` (BOOLEAN), `ces_eligibility_stage` (CESO Rank, Conferred CES Eligibility, Stage 1-4, None), `ces_stage_date`.
    - 12 Document Attachments (UUIDs referencing `unified_binaries` + original filenames):
      1. `letter_of_intent_binary_id` & `letter_of_intent_filename` (addressed to Sec. Sonny Angara, PDF)
      2. `pds_binary_id` & `pds_filename` (CSC Form 212 notarized, PDF)
      3. `work_experience_sheet_binary_id` & `work_experience_sheet_filename` (PDF)
      4. `cv_binary_id` & `cv_filename` (Comprehensive CV, PDF)
      5. `outstanding_accomplishments_binary_id` & `outstanding_accomplishments_filename` (PDF)
      6. `service_records_binary_id` & `service_records_filename` (PDF)
      7. `transcript_of_records_binary_id` & `transcript_of_records_filename` (PDF)
      8. `performance_eval_binary_id` & `performance_eval_filename` (CESPES, OPCRF, IPCRF, PDF)
      9. `self_certification_binary_id` & `self_certification_filename` (notarized, PDF)
      10. `id_picture_binary_id` & `id_picture_filename` (Passport size image)
      11. `applicant_profile_doc_binary_id` & `applicant_profile_doc_filename` (Template from tinyurl.com/3rdLevelForms, PDF/Word)
      12. `other_documents_binary_id` & `other_documents_filename` (PDF)
    - Workflow & Audit: `status` (default `'Submitted'`), `remarks`, `is_testaccount`, `created_at`, `updated_at`.
  - Added indexes on `application_no`, `applicant_uid`, `vacancy_applicant_id`, `LOWER(email)`, `position_applying_for`, `status`, and `is_testaccount`.
  - Updated Drizzle ORM schemas in both [`api/src/db/schema.js`](file:///e:/christop/staging/api/src/db/schema.js) and [`api/src/db/schema.ts`](file:///e:/christop/staging/api/src/db/schema.ts).
  - Updated `initDB` in [`api/src/config/db.js`](file:///e:/christop/staging/api/src/config/db.js) to ensure table existence on startup.
- **Backend API Endpoints ([`vacancyApplicantController.js`](file:///e:/christop/staging/api/src/controllers/vacancyApplicantController.js) & [`officialProfilingRoutes.js`](file:///e:/christop/staging/api/src/routes/officialProfilingRoutes.js))**:
  - `POST /api/third-level/vacancy-applicant/upload-document`: Uploads individual application files directly to Azure Blob Storage under the container specified by `AZURE_FOLDER_NAME` (`staging-tlo`), using `vacancy_id` as the virtual folder path (`${vacancy_id}/${doc_type}/${filename}`). Populates `azure_blob_url` and sets `content = NULL` in `unified_binaries` (storing 0 bytes of raw binary payload in the PostgreSQL database). Downloads and views stream seamlessly via authenticated SDK at `/api/binary/:id`.
  - `POST /api/third-level/vacancy-applicant/application`: Validates form fields, auto-generates sequential `APP-VAC-2026-####` reference number, inserts into `vacancy_applications`, synchronizes target vacancy in `vacancy_applicants`, and returns full submitted record.
  - `GET /api/third-level/vacancy-applicant/applications`: Retrieves all submitted applications for the authenticated applicant sorted by `created_at DESC`.
  - `GET /api/third-level/vacancy-applicant/application/:id`: Fetches a single application by ID or application reference number.
- **Frontend Components & Pages**:
  - **Apply Vacancy Modal ([`ApplyVacancyModal.jsx`](file:///e:/christop/staging/ui/src/components/ApplyVacancyModal.jsx))**:
    - 6-step multi-step application workflow:
      1. Position & Plantilla Item
      2. Personal Details (SURNAME, FIRST NAME, MIDDLE NAME [ALL CAPS auto-formatting], Date of Birth, Current Position, Plantilla Office)
      3. Third Level Designation & Assigned SDO as OIC
      4. Examination (LET, EMT) & Highest CES Eligibility Stage
      5. 12 Mandatory Document Uploads with individual progress indicators, size validation, and preview/remove controls
      6. Review & Final Submission summary
  - **View Application Details Modal ([`ViewApplicationDetailsModal.jsx`](file:///e:/christop/staging/ui/src/components/ViewApplicationDetailsModal.jsx))**:
    - Modal for inspecting submitted applications with status badges, applicant details, designation information, and direct download/preview links for all 12 attached files via `/api/binary/:id`.
  - **Updated Vacancy Dashboard ([`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx))**:
    - Added "Apply Now" buttons in the Header, Welcome Banner, Tab 1 Vacancy Cards, Tab 2 Table View, and Tab 2 Grid View.
    - Updated KPI cards: Card 3 now shows real-time count of filed applications (`My Applications: X Filed`), linking directly to the applications tab.
    - Cleaned up redundant horizontal tab strip in main content, leaving primary navigation exclusively to [`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx).
    - Added "My Applications" tab rendering all submitted applications with application reference number, position title, office, date, status, attached document count, and "View Details" action.
  - **Updated Sidebar ([`VacancySidebar.jsx`](file:///e:/christop/staging/ui/src/components/VacancySidebar.jsx))**:
    - Added "My Applications" navigation item with live application counter badge.
  - **Updated Catalog ([`AllVacancies.jsx`](file:///e:/christop/staging/ui/src/pages/AllVacancies.jsx))**:
    - Added "Apply Now" action button on every vacancy card opening the application workflow.

---

### Overview & Architecture
- **Complete Vacancy Positions Catalog on `vacancy-dashboard`**:
  - Enhanced [`VacancyDashboard.jsx`](file:///e:/christop/staging/ui/src/pages/VacancyDashboard.jsx) at `/vacancy-dashboard` to display all 85 vacant positions from the official DepEd Career Executive Service (CES) plantilla.
  - **Overview Tab ("Dashboard & Data")**:
    - Replaced the previous 4-item static preview with a full, interactive "DepEd Vacant Plantilla Positions" explorer displaying all matching vacant positions.
    - Added quick category rank filter pills: All Positions (85), Undersecretary (1), Assistant Secretary (4), Assistant Regional Director (1), Schools Division Superintendent (28), and Assistant Schools Division Superintendent (51).
    - Added instant search and Region filter dropdown directly in the Overview tab.
    - Each position card displays position title, salary grade badge (`SG 25` to `SG 30`), bureau/office, region with map pin, DBM plantilla item number, green `VACANT` badge, and 1-click `Select Target Position` action.
  - **List of Vacancies Tab ("Dedicated Catalog View")**:
    - Complete full-page catalog with dual view modes:
      - **Card Grid View**: 2-column executive cards with rank-specific salary grade colorization (Gold for SG 30, Indigo for SG 29, Purple for SG 27, Blue for SG 26, Emerald for SG 25), item code copy, active target indicator, and single-click target selection.
      - **Compact Table View**: High-density executive table with DBM Item Code, Position Title, SG, Bureau/Division, Region, Status, and Action.
    - Configurable items per page: defaults to `Show All (85)` so all positions are immediately visible on one scrollable page without pagination hurdles, with optional `12`, `24`, and `48` per page pagination options.
    - Comprehensive multi-filter bar: Search input, Region filter (Central Office and Regions I to XIII, CAR, NCR, NIR), Office/Bureau filter, Salary Grade filter, and a single-click "Clear All Filters" button.
- **Backend Plantilla Query ([`thirdLevelController.js`](file:///e:/christop/staging/api/src/controllers/thirdLevelController.js))**:
  - `getVacancies` queries `ces_plantilla WHERE is_vacant = true AND is_section_header = false` combined with any unassigned positions from `tlo_assignments`.
  - Accurately returns all 85 official DepEd executive vacancies with item numbers, positions, salary grades, bureaus, and regions.

---

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
