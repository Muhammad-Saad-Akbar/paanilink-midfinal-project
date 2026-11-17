# PaaniLink Phase 1 → Phase 2 API contract

**Version:** 1.0 · **Base URL (mock):** `../../mock-api/` · **Real API example:** `https://api.example.com/api/`

Only `js/api/api.js` is allowed to know the transport. To replace the JSON/localStorage demo, change its `API_BASE_URL` constant. The backend implements four stable endpoints; UI and action payloads remain unchanged. The real server is responsible for authentication, record visibility, input validation and atomic transactions.

## 1. Transport and common behavior

Requests/responses are JSON (`Content-Type: application/json`); login uses an HTTPS `HttpOnly`, `Secure`, `SameSite` session cookie in production, and all requests use `credentials: 'include'`. Frontend stores a *display-only* user ID/role in `sessionStorage`; **never trust the submitted role** as authorization. Reject missing/expired backend sessions with 401. Enable cross-origin credential CORS only for the frontend origin if API is on another origin; add CSRF protection for cookie-authenticated state-changing requests. On same origin, prefer serving API under `/api/`.

### Standard errors

```json
{
  "message": "This tanker is already assigned in this time slot.",
  "fields": {"tankerId": "Choose an available tanker."}
}
```

| Code | Meaning |
| --- | --- |
| 200 | Successfully read or updated a record |
| 201 | Created booking, registration, application or dispute (action response may use 200 or 201) |
| 400 | Malformed JSON, missing action type, unsupported enum |
| 401 | Not authenticated / invalid credentials |
| 403 | Authenticated but wrong role or record scope |
| 404 | Record/resource not found |
| 409 | Illegal status transition, resource overlap, quota conflict, referenced delete |
| 422 | Input validation error (include `fields` where applicable) |
| 429 | Rate limited |
| 500 | Server failure; transaction rolled back |

The mock engine raises equivalent error messages/status properties, but does not perform network POST or issue HTTP response codes.

## 2. GET `/bootstrap`

**Authentication:** public-safe response for the login/registration page; full scoped response only for a signed-in user. **Action:** return a fully prepared snapshot used by dashboard/view modules. The real backend must **scope** each collection to the signed-in user. Never leak passwords, CNICs or unrelated records. The mock returns all fabricated fixture records because it is publicly hosted JSON; views perform additional filtering.

**Unauthenticated 200 response:** provide `config`, `zones`, and `users: []` only (no private bookings or identities). The login/register UI needs these public data fields before authentication. Authenticated responses include a full but role-scoped snapshot.

**Authenticated 200 example** (shortened; real response includes arrays for all collections):

```json
{
  "config": {
    "appName": "PaaniLink", "city": "Karachi", "sizes": [1000,3000,6000],
    "slotMinutes": 90, "defaultMonthlySubsidyLimit": 2,
    "roles": ["Customer","Zone Officer","Hydrant Operator","Driver","Administrator"],
    "proofTypes": ["Income certificate"], "failureReasons": ["House locked"],
    "statusOrder": ["Pending","Approved","Assigned","Filled","Arrived","Delivered","Confirmed"],
    "statuses": ["Pending","Approved","Assigned","Filled","Arrived","Delivered","Failed","Confirmed","Disputed","Cancelled","Rejected"],
    "currency": "PKR"
  },
  "zones": [{"id":"z1","name":"North Karachi","description":"Sector 5 through 11"}],
  "hydrants": [{"id":"h1","name":"North Hub Hydrant","zoneIds":["z1"],"openTime":"06:00","closeTime":"22:00","quotaDaily":24000,"status":"Available","location":"North Karachi"}],
  "tankers": [{"id":"t1","plate":"KHI-1042","size":1000,"hydrantId":"h1","status":"Available"}],
  "rates": [{"size":1000,"commercial":2000,"subsidised":550}],
  "users": [{"id":"u1","name":"Example","email":"example@demo.test","role":"Customer","customerType":"Household","zoneId":"z1","subsidyStatus":"Approved","monthlyLimit":2,"address":"Example address","status":"Active"}],
  "bookings": [{"id":"PL-1001","customerId":"u1","zoneId":"z1","hydrantId":"h1","type":"subsidised","size":1000,"date":"2026-11-17","slotTime":"08:00","address":"Example address","status":"Pending","amount":550,"tankerId":null,"driverId":null,"history":[{"status":"Pending","at":"2026-11-15T08:00:00Z","by":"u1","note":"Pending approval"}]}],
  "applications": [],
  "disputes": []
}
```

**Note on authorization:** current view helpers refer to associated people by ID; for real per-user scoped snapshots, include only permitted related records (e.g. customer sees their assigned driver/tanker names, but no driver trip list). The client must never be considered a security boundary.

### Mock-only fetching

When `API_BASE_URL === '../../mock-api'`, `api.js` calls `GET /config.json`, `/users.json`, `/zones.json`, `/hydrants.json`, `/tankers.json`, `/rates.json`, `/bookings.json`, `/applications.json`, and `/disputes.json`, normalizes `offsetDays` seed dates, and overlays browser `localStorage` changes. No other JS module fetches JSON or writes to the fixtures.

## 3. POST `/auth/login`

**Public.** Request:

```json
{"email":"ayesha@demo.test","password":"demo123"}
```

**200 response:**

```json
{"user":{"id":"u1","name":"Ayesha Khan","role":"Customer"}}
```

**401:** `{"message":"Invalid login or inactive account."}`. In production, verify hashed password and establish the secure server session. The Phase 1 demo checks a fictional static account and stores role + user ID in sessionStorage.

## 4. POST `/auth/logout`

**Authenticated.** Clears the secure server session cookie and returns `200 {"ok":true}`. Demo mode only clears `sessionStorage`.

## 5. POST `/actions`

This is a **command endpoint**, intentionally stable across mock and real APIs to allow the one-URL migration. All commands have request shape:

```json
{"type":"booking.create","payload":{"hydrantId":"h1","size":1000,"date":"2026-11-17","slotTime":"08:00","type":"commercial","address":"House 17"}}
```

Successful response is the updated or newly created record (or `{ "deleted":"id" }`). New records receive IDs from the backend, never from client input. The authenticated user comes from the backend session, not any client role field. Example response:

```json
{"id":"PL-82319","status":"Approved"}
```

### Commands, access and request bodies

| `type` | Who may use it? | Required `payload` keys | On success | Key rejection |
| --- | --- | --- | --- | --- |
| `customer.register` | Public | `name,email,password,cnic,phone,address,zoneId,customerType` | Creates customer; returns `{id,name,role}` | 409/422 duplicate email/CNIC, bad inputs |
| `booking.create` | Customer | `hydrantId,size,date,slotTime,address,type` | `Pending` subsidised or `Approved` commercial | 422 hours, subsidy/month; 409 quota unavailable |
| `booking.cancel` | Owning customer | `bookingId` | `Cancelled` | 409 already filled, delivered, etc. |
| `booking.confirm` | Owning customer | `bookingId` | `Confirmed` | 409 unless Delivered |
| `booking.dispute` | Owning customer | `bookingId,reason` | Creates `Open` dispute; booking `Disputed` | 422 empty reason; 409 unless Delivered |
| `subsidy.apply` | Customer | `proofType,proofReference` (`proofName,proofDataUrl` optional) | Creates `Pending` application | 409 already pending/approved; 422 bad proof |
| `subsidy.review` | Officer in applicant's zone | `applicationId,decision` (optional `note`) | Application/customer `Approved` or `Rejected` | 403 other zone; 409 already reviewed |
| `booking.review` | Officer in booking's zone | `bookingId,decision` (`note` optional) | Booking `Approved` or `Rejected` | 409 not subsidised Pending, quota/month conflict |
| `dispute.resolve` | Officer in booking's zone | `disputeId,resolution` | Dispute `Resolved` with booking audit event | 403 other zone; 409 case closed; 422 empty resolution |
| `dispatch.assign` | Operator of booking's hydrant | `bookingId,tankerId,driverId` | `Assigned` | 409 wrong size, unavailable or occupied tanker/driver, wrong status, quota |
| `dispatch.fill` | Operator of booking's hydrant | `bookingId` | `Filled`, departure event | 409 not assigned, hydrant/tanker unavailable |
| `dispatch.tankerAvailability` | Operator of tanker home hydrant | `tankerId,status` | `Available` or `Unavailable` | 409 active trips |
| `dispatch.hydrantAvailability` | Operator of their hydrant | `status` | `Available` or `Unavailable` | 422 unknown status |
| `trip.arrive` | Assigned driver | `bookingId` | `Arrived` | 403 other driver; 409 unless Filled |
| `trip.deliver` | Assigned driver | `bookingId` | `Delivered` | 409 unless Arrived |
| `trip.fail` | Assigned driver | `bookingId,reason` | `Failed` | 409 unless Filled/Arrived; 422 empty reason |
| `admin.upsert` | Administrator | `kind,data` | Creates or updates zone/hydrant/tanker/rate/user | 409 references/duplicate values, 422 invalid fields |
| `admin.delete` | Administrator | `kind,id` | `{ "deleted":"id" }` | 409 referenced record or self-deletion |

### Example: approve subsidised booking

```http
POST /api/actions
Content-Type: application/json

{"type":"booking.review","payload":{"bookingId":"PL-1001","decision":"Approved","note":"Eligible household"}}
```

**200 response:**

```json
{
  "id":"PL-1001", "customerId":"u1", "zoneId":"z1", "hydrantId":"h1",
  "type":"subsidised", "size":1000, "date":"2026-11-17", "slotTime":"08:00",
  "address":"House 17", "amount":550, "status":"Approved", "tankerId":null,
  "driverId":null,
  "history":[{"status":"Pending","at":"2026-11-15T08:00:00Z","by":"u1","note":"Requested"},{"status":"Approved","at":"2026-11-15T09:00:00Z","by":"u3","note":"Eligible household"}]
}
```

**409 response** when current reservation would exceed hydrant quota:

```json
{"message":"Daily quota exceeded.","fields":{"hydrantId":"Select another date or hydrant."}}
```

### Example: assign driver and tanker

```json
{"type":"dispatch.assign","payload":{"bookingId":"PL-1001","tankerId":"t1","driverId":"u8"}}
```

**200 response (abbreviated):**

```json
{"id":"PL-1001","status":"Assigned","tankerId":"t1","driverId":"u8","history":[{"status":"Assigned","at":"2026-11-15T10:00:00Z","by":"u4","note":"KHI-1042 / Naveed Malik"}]}
```

**409 response** on overlapping assignment:

```json
{"message":"Driver unavailable or already booked at this time.","fields":{"driverId":"Select an available driver."}}
```

### Admin create/update shapes

```json
{"type":"admin.upsert","payload":{"kind":"zone","data":{"name":"East District","description":"New zone"}}}
```

```json
{"type":"admin.upsert","payload":{"kind":"hydrant","data":{"id":"h1","name":"North Hub Hydrant","location":"North Karachi","zoneIds":["z1","z2"],"openTime":"06:00","closeTime":"22:00","quotaDaily":25000,"status":"Available"}}}
```

```json
{"type":"admin.upsert","payload":{"kind":"tanker","data":{"plate":"KHI-4099","size":3000,"hydrantId":"h1","status":"Available"}}}
```

```json
{"type":"admin.upsert","payload":{"kind":"rate","data":{"size":1000,"commercial":2200,"subsidised":600}}}
```

```json
{"type":"admin.upsert","payload":{"kind":"user","data":{"name":"Test Driver","email":"testdriver@demo.test","role":"Driver","hydrantId":"h1","status":"Active","phone":"03001234567","password":"demo123"}}}
```

**Read-only related fields:** existing booking amount stays unchanged after rate edits; `history` is an append-only audit list in a real backend, never accepted from arbitrary client input.

## 6. Status and authorization rules

- `Pending` → `Approved` or `Rejected`: only zone officer, subsidised.
- Commercial `booking.create` → `Approved` directly, no officer needed.
- `Approved` → `Assigned` → `Filled`: correct hydrant operator.
- `Filled` → `Arrived` → `Delivered`: assigned driver. `Filled`/`Arrived` → `Failed` with reason.
- `Delivered` → `Confirmed`/`Disputed`: owning customer.
- `Pending`/`Approved`/`Assigned` → `Cancelled`: owning customer.
- Zone officer may resolve Disputed case, but cannot dispatch.
- Admin configures resources but cannot arbitrarily forge customer confirmation events.

For all database writes, verify that the record still has the required current status. Do not trust what UI showed one second ago.

## 7. Crucial backend transaction invariant

**When approving or assigning, use one database transaction**, ideally with row locks (`SELECT ... FOR UPDATE`) or equivalent conflict-safe constraints. Check and update in **one atomic unit**:

1. Lock booking and check current status / actor's role and scope.
2. Lock hydrant-day quota ledger and confirm `reservedGallons + requestedGallons <= quotaDaily` before reserving water.
3. Lock chosen tanker and driver availability schedule; reject overlapping active assignments (same date, intersecting slot) using exclusion constraints or other transactional resource reservation.
4. Insert assignments + event history; commit. If any check fails, **rollback everything**.
5. Releasing reservations on pre-fill cancellations should also be transactional; filled/failed water consumption must remain recorded.
6. Use server time, actual session identity, password hashing, rate limiting, file storage validation and selective response fields.

A front-end check or browser localStorage **cannot** prove prevention of concurrent double booking. This is reserved for Phase 2. Backend rubric also asks for database-level filtering/pagination/aggregation, SQL efficiency, ER diagram, Swagger/Postman, tests and report.
