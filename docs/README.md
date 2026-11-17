# PaaniLink · Water Tanker Booking and Dispatch

**Web Engineering, Phase 1 (frontend only)** · HTML5, CSS3, vanilla ES6 JavaScript. No npm packages, frameworks, CSS libraries or CDNs.

PaaniLink demonstrates the Water Board's booking, subsidy verification, hydrant dispatch, driver tracking, and customer confirmation process. It follows the supplied 3-page `WE Project.pdf` requirements, particularly the **Mid Evaluation / Frontend (15 marks)** rubric on page 2. The original requirements are included at `WE_Project_Requirements.pdf`.

## Run it

1. Extract the **entire** ZIP folder, keeping the nested folders unchanged.
2. Open a terminal **inside** the extracted `PaaniLink` folder.
3. Start a local HTTP server:

   ```bash
   python -m http.server 8000
   ```

   Or use `py -m http.server 8000` on Windows. With Node 22+, `npx` is **not required**.
4. Open `http://localhost:8000/` in your browser. **Do not** open `index.html` by double-clicking (`file://` blocks Fetch). A server is required only to serve the static files. There is **no backend** in Phase 1.
5. Pick a demo role, or register a new customer account. All demonstration accounts use password **`demo123`**.

| Demo role | Email |
| --- | --- |
| Customer | ayesha@demo.test |
| Zone Officer (North Karachi) | officer@demo.test |
| Hydrant Operator (North Hub) | operator@demo.test |
| Driver (North Hub) | driver@demo.test |
| Administrator | admin@demo.test |

A second zone officer, operator and driver exist in the demo data for scoping tests. All names and CNICs are fictional; please do not enter real personal information.

## Folder guide

```text
PaaniLink/
├── index.html                 # Login and customer registration
├── pages/
│   ├── customer.html
│   ├── officer.html
│   ├── operator.html
│   ├── driver.html
│   └── admin.html
├── css/styles.css             # Mobile responsive, accessible UI
├── js/
│   ├── app.js                 # Route guards, click/submit, loading/error/render
│   ├── api/
│   │   ├── api.js             # THE ONLY fetch() MODULE and API base URL
│   │   └── mock-engine.js     # Phase 1 local action simulation
│   ├── ui/
│   │   ├── common.js          # Escaped HTML builders, shared table/timeline
│   │   ├── customer.js
│   │   ├── officer.js
│   │   ├── operator.js
│   │   ├── driver.js
│   │   ├── admin.js
│   │   └── modals.js          # Role & state-dependent action forms
│   └── utils/
│       ├── auth.js            # sessionStorage access and role routes
│       ├── rules.js           # Shared form/business validators
│       └── time.js            # Local date and 90-minute overlap logic
├── mock-api/                  # JSON data, all read via fetch in api.js
│   ├── config.json
│   ├── users.json
│   ├── zones.json
│   ├── hydrants.json
│   ├── tankers.json
│   ├── rates.json
│   ├── bookings.json
│   ├── applications.json
│   └── disputes.json
├── docs/
│   ├── README.md
│   ├── API_CONTRACT.md
│   ├── ASSUMPTIONS.md
│   ├── SYSTEM_FLOW.md
│   ├── VIVA_GUIDE.md
│   ├── use-case.puml
│   ├── use-case.svg
│   └── WE_Project_Requirements.pdf
└── tests/
    └── rules.test.js
```

## What you can demonstrate

**Customer:** Register, sign in, apply for subsidised status with proof reference and optional small attachment, book commercial or eligible subsidised tanker, view bill/assigned tanker/trace, cancel before filling, confirm delivery or file dispute.

**Zone Officer:** Review applications for their zone; approve/reject pending subsidised bookings; resolve local disputes; view their entire zone without dispatch controls.

**Hydrant Operator:** View bookings for one hydrant; choose an available, matching-size tanker and unoccupied driver; record fill and departure; change hydrant or tanker availability.

**Driver:** Phone-first list of **only their assigned trips**; mark arrived, delivered or failed with a reason.

**Administrator:** Manage zones, hydrants and quotas, tankers, commercial/subsidised prices, user roles and assignments; view city-wide statistics and records.

Every action checks role and record status. Forms give field-level errors. All role pages re-render from the response state, rather than hardcoded records. Timeline events show who performed each transition and when.

## How the mock API works (important viva answer)

1. A view calls `getBootstrap()` in `js/api/api.js`.
2. `api.js` uses `fetch()` to load the JSON fixtures (async/await) and returns the combined data.
3. Clicking a button opens the correct form in `app.js`/`ui/modals.js`. Submission calls `action(type, payload, session)`.
4. For Phase 1, `mock-engine.js` enforces action rules and `api.js` persists the result to **localStorage**. JSON fixtures are **read-only** (a browser cannot write to static files).
5. The controller re-fetches the snapshot via `getBootstrap()` and dynamically updates the visible tables/cards/timeline. Loading and errors are shown clearly.
6. **Authentication simulation:** role and user ID are held in **sessionStorage**, and each HTML role page checks the session on load.

### Migrate to the real backend

In `js/api/api.js`, change **only**:

```js
const API_BASE_URL = '../../mock-api';
```

to, for example:

```js
const API_BASE_URL = 'https://your-backend.example/api/';
```

`api.js` automatically switches to real HTTP calls: `GET /bootstrap`, `POST /auth/login`, `POST /auth/logout` and `POST /actions`. Keep those endpoint contracts unchanged as specified in `API_CONTRACT.md`. Do not change the UI modules. **Important:** replacing the base URL makes the transport work, but the actual backend must implement secure sessions, role checks and transactional booking guarantees. Those are **not** provided by static HTML or localStorage.

## Demo reset and tests

To reset demo data, open browser DevTools → Storage/Application → Local Storage and delete the key `paanilink:demo:v1`, then refresh. `sessionStorage` controls the currently logged-in role. Registering or changing records persists only in **this browser**.

Run validation and workflow tests if Node.js is installed:

```bash
node --test tests/rules.test.js
```

Node is used **only for optional local tests**, not by the frontend.

## Evaluation alignment

- **Implementation (5):** All five roles + registration linked; Fetch JSON fixture access; dynamic DOM; validations; status/role actions.
- **Responsive (2):** 360px layout, Grid/Flexbox, media queries, large Driver controls, labels and keyboard focus.
- **Viva (5):** Trace: click → form → `action()` → mock rule validation → local state → `getBootstrap()` → render. See `VIVA_GUIDE.md`.
- **Documentation (3):** `API_CONTRACT.md`, `use-case.puml` / `use-case.svg`, and `ASSUMPTIONS.md`.

**Group variation is not supplied yet.** Add it to `js/utils/rules.js` and the matching mock action and document it before evaluation, rather than pretending it was implemented.

## Phase 1 limitations

This is a functional **single-browser UI prototype**, not a production reservation or security system. All mock records (including fabricated credentials) are public JSON. Storage changes are local to the browser and cannot be shared reliably across devices. Simultaneous real users **can** race; only a transactional backend with atomic quota/resource locks can guarantee no double booking. Payments, GPS, file storage, server authentication, database and backend reporting are deferred.
