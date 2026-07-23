# Agent & Developer Guidelines: Current Foldering Structure

**Objective**: Ensure that all new features, components, endpoints, and utility functions strictly adhere to the existing folder structure for both the `api/` (backend) and `ui/` (frontend).

---

## 🏗️ 1. Backend Foldering (`api/`)

The backend is built as a Node.js/Express service and strictly follows the MVC (Model-View-Controller) separation.

**Root Path:** `api/src/`

- 📁 **`config/`**
  - **Purpose:** Configuration files, database connection setups, environment initializations.
  - **Example Files:** `db.js`, `firebase.js`
  - **Rule:** Do not put business logic here.

- 📁 **`controllers/`**
  - **Purpose:** Handles the core business logic, database queries (SQL/pg), and formats the JSON responses.
  - **Example Files:** `thirdLevelController.js`, `loginController.js`
  - **Rule:** **1:1 File Mapping Rule:** For every frontend `.jsx` file that introduces new backend logic, you MUST create a matching controller file. For example, if the frontend file is `Login.jsx`, the backend file must be `loginController.js`. If the frontend file is `UploadDirectoryModal.jsx`, the backend file must be `uploadDirectoryModalController.js`. All database operations and data manipulation MUST happen here.

- 📁 **`middleware/`**
  - **Purpose:** Interceptors that run before the controller. Handlers for authentication, validation, and file uploading.
  - **Example Files:** `authMiddleware.js`, `uploadMiddleware.js`

- 📁 **`routes/`**
  - **Purpose:** Express router definitions. Maps HTTP methods (GET, POST, etc.) and paths to the specific controllers.
  - **Example Files:** `officialsRegistryRoutes.js`, `authRoutes.js`
  - **Rule:** Do NOT write queries or business logic in route files. Only map the routes.

- 📁 **`utils/`**
  - **Purpose:** Reusable helper functions, formatters, and external service connectors.
  - **Example Files:** `binaryPipeline.js`, `pdfUtils.js`
  - **Rule:** If a logic block is shared across multiple controllers, move it here.

- 📄 **`index.js`**
  - **Purpose:** The main entry point. Only used to bootstrap the Express server, configure CORS/JSON parsing, and mount the route files (`app.use()`).

---

## 🎨 2. Frontend Foldering (`ui/`)

The frontend is a React application built with Vite. It enforces strict separation between high-level pages, reusable components, and global state.

**Root Path:** `ui/src/`

- 📁 **`assets/`**
  - **Purpose:** Static media files (images, icons) and global CSS files if not in root.

- 📁 **`components/`**
  - **Purpose:** Reusable UI elements that are used across multiple pages.
  - **Example Files:** `UploadDirectoryModal.jsx`, `AdminSidebar.jsx`, `ModernDatePicker.jsx`
  - **Rule:** Keep these components stateless where possible. Break down massive page components into smaller pieces here.

- 📁 **`context/`**
  - **Purpose:** React Context providers for global state management.
  - **Example Files:** `AuthContext.jsx`
  - **Rule:** Avoid deep prop drilling by housing global states (user session, theme) here.

- 📁 **`pages/`**
  - **Purpose:** Top-level view components that represent an entire route/screen.
  - **Example Files:** `Home.jsx`, `Login.jsx`, `OfficialProfiling.jsx`
  - **Rule:** Pages should act as coordinators. They fetch data, hold local state, and pass data down to smaller `components/`.

- 📁 **`utils/`**
  - **Purpose:** Helper scripts and non-UI logic.
  - **Example Files:** `api.js` (for base URLs/fetch wrappers).
  - **Rule:** Move complex data manipulation, formatting, and repeated API callers out of `.jsx` files and into this folder.

- 📄 **`App.jsx` & `main.jsx`**
  - **Purpose:** React DOM mounting and React Router setups.

---

## 🛑 Strict Adherence Rules for Agents

1. **Never dump everything in one file:** Do not create massive React components or giant Express route files.
2. **Follow the 1:1 Naming Pattern:** When creating a new UI component or page that requires backend logic (e.g., `MyFeature.jsx`), create a matching backend controller (`myFeatureController.js`).
3. **Follow the MVC pattern:** When adding a new API endpoint, you MUST create/update a file in `routes/` and place the logic in `controllers/`.
4. **Refactor proactively:** If you notice utility logic inside a UI component or a DB query inside a route file, you are instructed to immediately extract it to `utils/` or `controllers/` respectively.
