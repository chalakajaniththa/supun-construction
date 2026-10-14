# Step 3 — Daily Operations

**Goal:** Plan and record the day-to-day work: **allocations without double booking** (with a weekly
Schedule view), the **Daily Entry** screen (attendance, machine usage and fuel, expenses), maintenance,
**purchases/store/issues**, **supplier payments & balances**, and **worker advances**.

## Read first
- `docs/00-OVERVIEW.md` — §2 (Allocation vs Attendance, Hour meter, Main store, Advance), §6 (Workers: WorkerAllocation, Attendance, Advance; Assets: AssetAllocation, AssetUsageLog, MaintenanceRecord; Materials/purchasing/expenses), §7 (Allocation overlap, Store stock, Supplier balance), §8 screens 2, 4, 6, 7, 8.
- `docs/DRIFT-LOG.md` — all entries.
- Codebase: `schema.prisma`, `apps/api/src/common/**` (error mapper — `ALLOCATION_OVERLAP`), one Step-2 module as the pattern (e.g. `modules/workers`), `modules/documents` (receipts link to documents), `seed/sample-data.ts`, `packages/shared/src/schemas/**`, `apps/web/src/components/**` (DataTable, DocumentPanel, inputs), the project/worker/asset/supplier detail pages, `messages/*.json`.

## Tasks

### 3.1 Allocations
- API `allocations` module:
  - `GET /allocations?kind=worker|asset&from=&to=&projectId=&workerId=&assetId=`
  - `POST /allocations/workers`, `POST /allocations/assets` — single or **bulk** (several workers to one project for a date range → one row per day per worker using the default working hours 08:00–17:00 Asia/Colombo, or the given times). Bulk is all-or-nothing: on any overlap return 409 `ALLOCATION_OVERLAP` with **all** the conflicts listed (worker/asset, project, times).
  - `PATCH` (move/resize), `POST /allocations/:id/cancel`. Conflicts are enforced by the DB constraint; map to 409 with conflict details (look up the overlapping row).
  - `GET /allocations/availability?kind=&from=&to=` → which workers/assets are free in the window (for pickers).
- Web **Schedule** page: week view (prev/next/today), toggle Workers | Machines, rows = people/assets (search + filter by skill/category), cells = days, blocks colored per project with time labels (a day can hold several blocks: morning Site A, afternoon Site B). Click an empty cell → create dialog (project, start/end time, notes); click a block → edit/cancel. "Assign team" bulk dialog (project, multiple workers, date range, times). Show overlap errors in a friendly dialog listing the conflicts.
- Project detail → **Team & Machines** tab: current and upcoming allocations, with an "Assign" button.

### 3.2 Daily Entry (most important screen — make it fast and obvious)
- API:
  - `GET /daily-entry?date=&projectId=` → workers allocated to that project that day plus any attendance already recorded for that project/date, assets allocated plus usage logs, and expenses for that project/date.
  - `PUT /daily-entry` → saves attendance rows (upsert by worker+date; a worker can only have one attendance per day — if already marked at another project return 409 `ATTENDANCE_EXISTS_OTHER_PROJECT`), usage logs (hours = endMeter − startMeter when both are given; updates `asset.currentMeter` to the max endMeter), and expenses, **in one transaction**.
  - `GET /daily-entry/copy-from?date=&projectId=` → the previous working day's attendance list for prefill.
  - If a month's payroll is FINALIZED → 409 `PAYROLL_LOCKED` (the check is a no-op until Step 4 creates payroll; implement the check now against `PayrollRun`).
- Web `/daily`: date (default today) + project selector at the top; three clear sections:
  1. **Attendance** — rows: worker, Present / Half day / Absent (big segmented buttons), OT hours, note. "Add worker" picker. "Copy from yesterday". "Mark all present".
  2. **Machines** — rows: asset, start meter (prefilled from current meter), end meter, hours (auto), fuel L, fuel cost, operator.
  3. **Expenses** — inline add rows: category, description, amount, paid by, supplier (optional), receipt upload (uses the documents API, ownerType PROJECT, category RECEIPT).
  - A sticky **Save** bar with an unsaved-changes warning; a success toast; totals for the day (people present, machine hours, expenses Rs.).
- Also standalone lists: **Attendance** (Workers → worker detail → month calendar of attendance) and **Expenses** list (filters: date range, project, category) with add/edit — on the Project → Costs tab placeholder and under a "Expenses" sidebar sub-item under Daily Entry.

### 3.3 Assets: usage & maintenance
- API: `GET /assets/:id/usage`, `GET/POST/PATCH/DELETE /assets/:id/maintenance` (a SERVICE record sets `lastServiceMeter`), `GET /assets/:id/service-status` → { currentMeter, lastServiceMeter, interval, remaining, state OK/DUE_SOON/OVERDUE } (pure calculator + unit tests).
- Web asset detail tabs: Usage log, Maintenance (add record), Allocations, Documents; a service status badge.

### 3.4 Purchases, store & issues, suppliers
- API `purchases`: CRUD for a purchase with lines (each line: material, qty, unit price, project or main store); total computed server-side. `GET /store/stock` (per material: qty, avg cost, value). `POST /store/issues` (material, project, date, qty → unitCost = weighted avg; 409 `INSUFFICIENT_STOCK`). `GET /store/issues`.
- API `suppliers`: `GET /suppliers/:id/statement?from=&to=` (chronological: credit purchases, credit expenses, payments, running balance), `GET /suppliers/balances`, `POST/DELETE /suppliers/:id/payments`.
- Calculators with unit tests: weighted average cost, stock, supplier balance.
- Web: Purchases & Store page tabs — Purchases (list + multi-line form), Store stock, Issues (issue dialog), Materials. Supplier detail → Statement tab + "Add payment". The suppliers list shows the balance owed.

### 3.5 Advances
- API: `GET/POST /workers/:id/advances`, `PATCH` (amount, recoveryPerMonth, reason — only while there are no recoveries), `GET /advances?status=OPEN` (with recovered so far and balance).
- Web: worker detail → Advances tab; Payroll page placeholder shows open advances.

### 3.6 Sample data
About 60 days of history ending today for the ONGOING projects: worker and asset allocations (including one asset that moves between two sites on the same day), attendance consistent with the allocations (some absences, half days, OT), usage logs with plausible meter progression and fuel, ~150 expenses, ~25 purchases (mixed credit/cash, some to the main store), ~15 store issues, supplier payments leaving realistic balances, ~8 advances (some partly recovered later in Step 4). Leave the **current** month's data editable (not locked).

### 3.7 Tests
- API e2e: allocation create/overlap 409 with conflict details/back-to-back OK/cancel frees the slot/bulk all-or-nothing; daily-entry save is transactional (one bad row → nothing saved); attendance at two projects on the same day → 409; meter update; store issue over stock → 409; supplier statement running balance; advances.
- Unit: service status, weighted average, supplier balance, hours from meters.
- Playwright: assign two workers for a week on Schedule → overlap attempt shows an error → Daily Entry for today: mark attendance, enter machine hours, add an expense with a receipt → save → reload shows the data; create a purchase to store → issue to a project → stock decreases; Sinhala smoke check on Daily Entry.

## Acceptance criteria
- [ ] Double-booking a worker or asset is impossible (DB-enforced) and explained clearly in the UI; same-day moves between sites work.
- [ ] Daily Entry saves attendance, machine usage and expenses in one go and is quick to use with the sample data.
- [ ] Stock, issues and supplier balances are correct.
- [ ] Definition of Done (overview §11) satisfied.
- [ ] Drift log updated; commit `feat(step-3): daily operations`.
