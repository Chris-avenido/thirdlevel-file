# Agent Architecture Guidelines: Anti-Spaghetti Code & Foldering Principles

**Target Audience:** All AI Coding Agents & Human Developers  
**Core Philosophy:** Strict separation of concerns, modularity, and zero "spaghetti code."

---

## 🏗️ 1. Backend Architecture (Node.js/Express)

**Rule: NEVER dump all endpoints, business logic, and queries into a single `index.js` or `server.js` file.**

### Backend Folder Structure
The backend MUST strictly follow the MVC (Model-View-Controller) pattern with dedicated routing.

```text
api/
├── src/
│   ├── config/          # Database connections and environment setups (e.g., db.js)
│   ├── controllers/     # Business logic, database queries, and response formatting
│   ├── middleware/      # Authentication, validation, and error-handling interceptors
│   ├── routes/          # Express route definitions mapping HTTP methods to controllers
│   ├── utils/           # Reusable helper functions (e.g., hashers, file processors)
│   └── index.js         # Entry point: ONLY used for bootstrapping the app and wiring routes
```

### Backend Guidelines
1. **Routing:** All routes must be separated by domain (e.g., `binaryRoutes.js`, `authRoutes.js`) and imported into `index.js` using `app.use('/api/domain', domainRoutes)`.
2. **Controllers:** Controllers must handle the request/response cycle. Database queries belong here (or in a dedicated services layer), NEVER in the route file.
3. **DRY Principle:** Any logic used in more than two places MUST be extracted into `api/src/utils/`.

---

## 🎨 2. Frontend Architecture (React/Vite)

**Rule: NEVER bloat a single React component with hundreds of lines of utility functions or massive inline styling blocks.**

### Frontend Folder Structure

```text
ui/
├── src/
│   ├── assets/          # Static files, images, and global CSS
│   ├── components/      # Reusable UI elements (Buttons, Modals, Cards)
│   ├── context/         # React Context API providers (State management)
│   ├── pages/           # High-level page components representing complete views
│   ├── utils/           # Helper scripts (e.g., API callers, data formatters, image compressors)
│   ├── App.jsx          # Main application wrapper and router setup
│   └── main.jsx         # React DOM rendering entry point
```

### Frontend Guidelines
1. **Utility Extraction:** Functions that manipulate data (e.g., `compressImageClientSide`, `formatDate`) MUST be extracted to `ui/src/utils/` and imported where needed. Do NOT leave them inside the `.jsx` component file.
2. **Component Granularity:** If a page component (like `OfficialProfiling.jsx`) becomes too large, sub-sections (like `CareerProgressionSidebar.jsx`) should be broken out into `ui/src/components/`.
3. **State Management:** Avoid excessive prop drilling. Use the Context API (`ui/src/context/`) for global state.

---

## 🛑 Strict Anti-Spaghetti Enforcement

When instructed to add a new feature, you must automatically ask yourself:
- *Does this logic belong in a Controller or a Route?*
- *Can this frontend function be moved to `utils/` to keep the component clean?*
- *Am I duplicating code that already exists?*

**Execution Mandate:** Agents must proactively refactor inline, bloated code into their respective folders. Do not wait for the user to tell you to "clean up" the code. Always foldering first!
