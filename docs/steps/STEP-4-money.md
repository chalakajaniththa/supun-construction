# Step 4 — Money: Payroll, Project Costing & Contractor Finance

**Goal:** Correct numbers. **Monthly payroll** (daily-paid + permanent with EPF/ETF, OT, advances,
finalize/lock), **project actual cost vs budget & health**, and the contractor finance side: **BOQ &
progress, variations, EOT, IPC/progress bills, retention, mobilization advance, client payments, bonds**.

## Read first
- `docs/00-OVERVIEW.md` — §2 glossary (BOQ, IPC, Retention, Mobilization advance, Bond, EPF/ETF), §6 (Projects: ExtensionOfTime, BoqItem, BoqMeasurement, Variation, PaymentCertificate, ClientPayment, Bond; Payroll), **§7 all rules** (implement exactly; any change → drift log), §8 screens 3 and 9.
- `docs/DRIFT-LOG.md` — all entries.
- Codebase: `schema.prisma`; `modules/workers` (`getRateOn`), `modules/attendance` / `daily-entry`, `modules/advances`, `modules/expenses`, `modules/purchases` + store, `modules/assets` usage, `modules/projects`; `seed/sample-data.ts`; the project detail page and its tabs; the payroll placeholder page; `packages/shared/src/schemas`; `messages/*.json`.

## Tasks

### 4.1 Payroll
- Pure calculator `modules/payroll/calc/payroll.calculator.ts`: input = the worker, the month's attendance, rates by date, settings, open advances → output = a `PayrollLine` shape + breakdown per project (days, labour cost). **Table-driven unit tests**: daily full/half days, a rate change mid-month, OT with and without `otHourlyRate`, permanent with no-pay days, EPF/ETF rounding (round each to 2 dp, half-up), an advance larger than pay (deduction capped so net ≥ 0, remainder stays open), a worker who joined or left mid-month, an empty month.
- API: `POST /payroll/runs` {year, month} → creates or regenerates a DRAFT (replaces lines). `GET /payroll/runs`, `GET /payroll/runs/:id` (lines + totals: gross, net, EPF 8/12, ETF 3, employer cost). `PATCH /payroll/runs/:id/lines/:lineId` (advanceDeduction, otherDeductions + note; recompute net). `POST /payroll/runs/:id/finalize` (transaction: set attendance.payrollRunId, create AdvanceRecovery rows, mark advances RECOVERED when the balance is 0, status FINALIZED). `POST /payroll/runs/:id/reopen` (only the latest finalized run; reverses the recoveries; confirmation in the UI). Turn on the `PAYROLL_LOCKED` check from Step 3.
- Web `/payroll`: month picker → "Generate" → table (worker, type, days, OT, basic, OT pay, gross, EPF 8%, advance, other, **net**) with inline edit of deductions in DRAFT, totals footer, employer cost summary (EPF 12%, ETF 3%), "Finalize" with confirmation, a status chip. Worker detail → "Payslips" tab (list of lines). (PDF/Excel exports come in Step 5 — add the buttons as disabled placeholders now.)

### 4.2 Project costing & health
- Pure calculators `modules/costing/calc/*`: actual cost by category for a project and date range (overview §7), budget variance, health (time %, budget %, physical %, flags). Labour uses finalized payroll lines' project breakdown where available, otherwise estimates from rates (flag `estimated: true`). Unit tests for each category and each flag.
- API: `GET /projects/:id/costs?from=&to=` → { byCategory: [{category, budget, actual, variance, pct}], total, entries (paginated by category) }, `GET /projects/:id/health`, `GET /projects/health` (all active, used by the dashboard in Step 5).
- Web project detail: **Overview** tab shows the `ProgressTriple` (time / budget / physical) + flags + a budget-vs-actual table; **Costs** tab shows per-category totals + entries (labour by worker, materials, equipment, expenses) with a date-range filter.

### 4.3 BOQ, progress, variations, EOT
- API: BOQ CRUD (`/projects/:id/boq`), **CSV/Excel import** of BOQ items (columns: itemNo, description, unit, quantity, rate; preview → confirm), measurements (`POST /boq/:itemId/measurements` {date, cumulativeQty} — cannot exceed the item quantity without a warning flag; cannot go backwards in date order), `GET /projects/:id/progress?asOf=` → per item: qty, done, %, amount done; total physical %.
- Variations: CRUD; APPROVED adds `amountChange` to the effective contract value and can own BOQ items (`variationId`). EOT: CRUD; the latest approved EOT sets `revisedEndDate`.
- Web project tabs: **BOQ & Progress** (editable grid, import, "Record progress" dialog for a date with multiple items, per-item progress bars); **Variations & EOT**. Private projects without a BOQ get a simple "Progress %" slider on Overview (`progressPct`).

### 4.4 Bills (IPC), payments, retention, advance, bonds
- Pure calculator `billing/calc/ipc.calculator.ts` per overview §7 with unit tests: first bill, a later bill, retention cap reached mid-bill, advance fully recovered, other deductions, a manual cumulative override.
- API: `GET/POST /projects/:id/certificates` (POST computes a DRAFT from progress up to periodTo; fields editable while DRAFT), `PATCH`, `POST .../:certId/status` (DRAFT→SUBMITTED→CERTIFIED→PAID; PAID requires payments ≥ net), `GET/POST/DELETE /projects/:id/payments` (kinds per §6), `GET /projects/:id/finance-summary` → contract value (incl. variations), certified to date, received, **receivable**, retention held, advance given/recovered/balance.
- Bonds: CRUD under `/projects/:id/bonds` + `GET /bonds?expiringWithin=`; bond copies are uploaded via the DocumentPanel (category BOND_COPY).
- Web project tabs: **Bills & Payments** (finance summary cards, certificates table with status chips, "New bill" wizard showing the calculation step by step, payments list + "Record payment"), **Bonds** (table with expiry badges, documents).

### 4.5 Sample data
- The previous month's payroll **FINALIZED** (consistent with attendance; recovers part of some advances); the current month left for the owner to generate.
- BOQs for the 4 government projects (road: ~25 items — site clearance, excavation, sub-base, ABC base, DBST/asphalt, culverts, drains, road marking; school: ~30 items — excavation, rubble foundation, DPC, brickwork, RCC columns/beams/slab, roofing, plaster, doors/windows, painting, electrical, plumbing). Measurements at realistic dates; one variation approved; one EOT.
- IPCs: road IPC-01 PAID, IPC-02 CERTIFIED (unpaid → receivable); school IPC-01 SUBMITTED; the completed culvert with retention held. Mobilization advance on the road project, partly recovered.
- Bonds: a performance bond expiring in ~20 days, an advance payment guarantee, a released bid bond.
- Project numbers should tell a story: one project over budget, one behind schedule, others healthy.

### 4.6 Tests
- Unit tests above (payroll, costing, health, IPC, BOQ progress) — aim for full branch coverage of the calculators.
- API e2e: generate → edit → finalize → attendance edit blocked → reopen; costs endpoint totals equal the sum of the entries; BOQ import; IPC sequence across 3 bills with retention cap; finance summary; bond CRUD.
- Playwright: generate the current month's payroll, edit an advance deduction, check the net changes; record BOQ progress then create a new bill and check the computed values shown; record a payment → receivable decreases; Sinhala smoke check on the Payroll page.

## Acceptance criteria
- [ ] Payroll numbers match hand calculations in the unit tests; finalize locks attendance.
- [ ] Project cost, budget variance and health flags are correct and visible.
- [ ] BOQ → progress → IPC → payment → receivable/retention flow works end to end.
- [ ] Definition of Done (overview §11) satisfied.
- [ ] Drift log updated; commit `feat(step-4): payroll, costing and contractor finance`.
