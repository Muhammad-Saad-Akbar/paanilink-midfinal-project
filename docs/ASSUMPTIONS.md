# Decisions and assumptions (Phase 1)

These are deliberate decisions for requirements the brief does not specify. Confirm with the instructor and update before backend implementation.

| # | Ambiguity | Explicit Phase 1 assumption / behavior |
| --- | --- | --- |
| 1 | City and zones | Demo uses **Karachi** with three named zones. Zone names and memberships are seeded in JSON. |
| 2 | Which hydrant serves an address | Customer has a saved `zoneId` chosen at registration; hydrant must list that zone in `zoneIds`. A zone may have several hydrants. No geocoding in Phase 1. |
| 3 | New customer zone | Selected by user during signup. No address-to-zone lookup exists yet; future backend should verify. |
| 4 | Service time / clashes | Bookings use **90-minute slots**, starting every 30 minutes. Two slots overlap when their time windows overlap on the same local date. |
| 5 | Hours | A whole 90-minute slot must fall between hydrant opening and closing times; operating overnight is not supported in this demo. |
| 6 | Which dates may be booked | Today or later. There is no advance booking maximum. |
| 7 | Commercial approval | Commercial requests immediately become **Approved**. Subsidised requests start **Pending** until an officer approves. |
| 8 | Water quota reservation | All **Approved or later** bookings except rejected/cancelled count against daily quota. Pending requests do not reserve water; approval checks quota again. |
| 9 | Post-fill failure | Failed trips are treated as having consumed water if already filled; their quota is not released. Future rules may distinguish water returned to hydrant. |
| 10 | Cancelling | Customers can cancel only Pending, Approved or Assigned bookings, before a fill has been recorded. Cancellation releases an unfilled reservation. |
| 11 | Tanker sizing | Tanker assigned must be **exactly** the requested 1,000/3,000/6,000-gallon size (not a larger tanker). |
| 12 | Resource booking | Assignment blocks a tanker/driver at an overlapping slot if already allocated. Availability is also checked at fill. In the mock this is only a simulation. |
| 13 | Hydrant and staff management | An operator and a driver are associated with a **single home hydrant**. Officers are assigned one zone. Admin is city-wide. |
| 14 | Driver timeline | Operator records **Filled** and departure as one status plus a timestamped note, because the supplied workflow does not include a separate Departed status. |
| 15 | Driver fail | Driver can fail a Filled or Arrived trip with a mandatory reason; failed trip remains failed. Rebooking requires a new booking. |
| 16 | Delivery confirmation | Driver marks Delivered, then customer either Confirms or Disputes. No automatic confirmation timeout. |
| 17 | Dispute closure | Officer records a resolution and closes the **dispute case**; booking remains Disputed for traceability, with a `Dispute resolved` audit event. |
| 18 | Eligibility | Customer with an **Approved** subsidy application can request subsidised tankers. Pending or rejected subsidy status does not qualify. |
| 19 | Proof | Customer gives a proof type and document reference, and may attach a JPG/PNG/PDF file up to 600 KB. Mock stores attachment as a data URL in localStorage. Do not use real documents. |
| 20 | Monthly subsidy limit | Default **2 non-cancelled/non-rejected subsidised requests per customer per calendar month** (not gallons). Pending requests count. Limit is configurable per customer. |
| 21 | Hospitals and mosques | Brief mentions them, but detailed institutional registration/limits are not given. Registration records Household / Hospital / Mosque category; all three follow the same eligibility process and configured monthly limit in Phase 1 (a conservative policy decision). Specialized institutional limits and proof rules need instructor confirmation. |
| 22 | Pricing | Prices are in **PKR**, set per gallon capacity and booking type. No distance surcharges, taxes, payment processor or refunds. Historical booking keeps the rate at time of booking. |
| 23 | Invoices | Bills are display-only booked charges, not paid invoices. Print available in browser; PDF/download backend deferred. |
| 24 | Payments | Commercial bookings are *priced* at full rate, but no payment gateway is included. This does not mean payment was received. |
| 25 | Live tanker position | Tracking is status/event tracking, **not GPS tracking**; geolocation integration requires a backend and device location. |
| 26 | Mock persistence | Read fixtures with Fetch once, overlay mutations in browser `localStorage`, re-render UI. Static JSON files cannot be written by frontend code. |
| 27 | Authentication | Sign-in is **demo only**, storing role and user ID in sessionStorage. Passwords are fictional and plain in public mock data; this must never be used in production. |
| 28 | Read visibility | UI enforces role-specific views, but static public JSON contains other data. A real server MUST filter and authorize every response/action. |
| 29 | Timeline seed | Historical/next booking offsets in JSON are converted relative to the browser's date on first load, for always-useful demo screens. Actual user bookings use `YYYY-MM-DD`. |
| 30 | Clock | Dates/times are local browser time, assumed **Asia/Karachi** for the demo. Backend must validate dates and use a defined server time zone. |
| 31 | Administration delete | Zones/hydrants/tankers/users referenced elsewhere cannot be deleted; admin edits them instead. Rates are edited but not removed. |
| 32 | Reporting | City dashboard totals are calculated from fetched data in the UI. Final backend needs database aggregate queries. |
| 33 | Availability change | Marking a hydrant unavailable stops new reservations/assignments/fills; operator cannot mark a tanker unavailable when it has an active dispatch. |
| 34 | Concurrency | **Not guaranteed in Phase 1.** Backend must atomically lock tanker, driver and hydrant-day quota while approving and assigning, with rollback on errors. |
| 35 | Group variation | **Not provided.** No assumptions about it; add later to UI, shared validators, mock engine, API contract and backend tests. |
| 36 | Final-phase requirements | ER diagram, SQL N+1 prevention, Swagger/Postman, real transaction race tests and backend security are intentionally outside the Frontend-15-mark milestone. |
