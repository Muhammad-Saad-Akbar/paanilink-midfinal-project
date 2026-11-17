# System flow and role permissions (viva-friendly)

## End-to-end workflow

1. **Customer signs up** with name, CNIC (13 digits), Pakistani phone, email/password, zone and address. The system saves a demo session. Existing users log in and are redirected to the HTML page matching their role.
2. **Customer selects the requested water** (1,000 / 3,000 / 6,000 gallons), rate type, serving hydrant, delivery date and time slot. Form checks hydrant hours, quota and eligibility. New commercial booking becomes **Approved**. New subsidised booking becomes **Pending**.
3. **Zone Officer** examines subsidy evidence to grant customer eligibility. For subsidised tanker bookings in the officer's own zone, the officer approves/rejects. Approval **rechecks** monthly limit and water quota.
4. **Hydrant Operator** sees approved bookings at their assigned hydrant. They choose an available tanker of the correct size and an available driver for the requested time, then mark it **Assigned**. The action checks overlaps and daily quota.
5. **Hydrant Operator** fills the tanker, records departure, moving the booking to **Filled**.
6. **Driver** sees only their assigned trips, marks **Arrived**, then **Delivered**. If delivery fails, they select a reason and mark **Failed**.
7. **Customer** sees their tanker and events, then confirms delivery (**Confirmed**) or reports a problem (**Disputed**). Their Zone Officer resolves the case with a recorded resolution. Customer history and bill remain accessible.
8. **Administrator** configures the zones, hydrants, quotas, vehicles, prices and accounts. Their city-wide reports read the latest data snapshot.

## Role and permission matrix

| Action / Scope | Customer | Zone Officer | Hydrant Operator | Driver | Administrator |
| --- | --- | --- | --- | --- | --- |
| Register/login | ✓ | Login | Login | Login | Login |
| View bookings | Own | Own zone | Own hydrant | Assigned trips only | City-wide |
| Create booking | ✓ | ✗ | ✗ | ✗ | ✗ |
| Apply for subsidised status | ✓ | ✗ | ✗ | ✗ | ✗ |
| Verify application | ✗ | Own zone | ✗ | ✗ | ✗ |
| Approve/reject subsidised booking | ✗ | Own zone, Pending only | ✗ | ✗ | ✗ |
| Assign tanker and driver | ✗ | ✗ | Own hydrant, Approved only | ✗ | ✗ |
| Record fill/departure | ✗ | ✗ | Own hydrant, Assigned only | ✗ | ✗ |
| Mark arrived/delivered/failed | ✗ | ✗ | ✗ | Assigned trip, permitted status | ✗ |
| Confirm/dispute delivered water | Own, Delivered only | ✗ | ✗ | ✗ | ✗ |
| Resolve dispute | ✗ | Own zone | ✗ | ✗ | ✗ |
| Cancel | Own, before filling | ✗ | ✗ | ✗ | ✗ |
| Set hydrant/tanker availability | ✗ | ✗ | Own hydrant/fleet | ✗ | Edit through admin |
| Manage zones/rates/quotas/users | ✗ | ✗ | ✗ | ✗ | ✓ |
| City-wide reports | ✗ | ✗ | ✗ | ✗ | ✓ |

An officer may **read** trips in their zone but cannot assign/change driver. A customer may see their assigned tanker/driver for a booking, but never a list of the driver's other trips.

## Exact status flow

```text
Commercial booking  ────────────────────────> Approved
Subsidised booking ──> Pending ──> Approved   (officer)
                           └──> Rejected
Approved ──> Assigned ──> Filled ──> Arrived ──> Delivered
               (operator)    (operator)  (driver)    (driver)
                                         └────> Failed
                              Filled ────────> Failed
Delivered ──> Confirmed                         (customer)
          └─> Disputed ──> Dispute resolved      (officer action; case closes,
                                                 booking keeps Disputed status)
Pending / Approved / Assigned ──> Cancelled     (customer, before filling)
```

## Demonstrating a full run

- Log in as **officer@demo.test**, review `PL-1001` Pending subsidised booking and approve it (North Karachi).
- Log in as **operator@demo.test**, assign a 1,000-gallon available tanker and one driver to `PL-1001`, then record fill/departure.
- Log in as the **selected driver** and mark Arrived → Delivered. If you assign driver `driver2@demo.test` instead, log in with that driver to perform the trip.
- Log in as **ayesha@demo.test** and Confirm the now Delivered booking, or create a dispute.
- Log in as the officer to resolve any open dispute in North Karachi.

Existing seed examples include `PL-1002` Approved, `PL-1003` Assigned, `PL-1004` Filled, `PL-1005` Delivered, `PL-1006` Disputed, `PL-1007` Confirmed, `PL-1008` Failed. These are synthetic test records.

## Click → Fetch → Render (show these files in viva)

```text
index.html or pages/*.html
    | loads module script
    v
js/app.js                   # checks sessionStorage guard
    | calls getBootstrap()  # shows Loading / Error UI
    v
js/api/api.js               # fetch('./mock-api/*.json') in mock mode
    | returns snapshot
    v
js/ui/<role>.js             # HTML escaped, data-driven cards/tables/buttons
    | user clicks APPROVE
    v
js/app.js                   # opens modal, validates, awaits action()
    v
js/api/api.js               # action(...)  (or POST /actions on real API)
    v
js/api/mock-engine.js       # checks role, status, quota etc (mock only)
    | saves localStorage -> result
    v
js/app.js                   # fetches fresh getBootstrap(), re-renders page
```

**Backend warning:** the mock can reject conflicting assignments *in one browser*, but it cannot lock resources between users or deliver secure per-role filtering. That is why the final requirement specifies transactions and role authorization on the server.
