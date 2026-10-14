# Supun Construction — Business Management System (Overview)

> **Every implementation session reads this file first.** It is the single source of truth for
> *what* we are building and *how*. If reality had to differ, the difference is recorded in
> `docs/DRIFT-LOG.md` — and the drift log wins over this file.

---

## 1. Product summary

**Client:** Supun Construction — a small local contractor in Polonnaruwa, Sri Lanka. Does government
tenders and private work: roads, school buildings, other buildings.

**User:** The owner, who has very little computer experience. He runs it on **his MacBook**
(Apple Silicon, arm64) using Docker. There is **one login (admin)**.

**Goal:** Replace notebooks with a simple system that:
- records day-to-day work (attendance, machine usage, expenses, purchases)
- keeps project, worker, asset and company documents, with version history
- schedules workers and machines across sites without double-booking
- calculates salaries (daily-paid and permanent with EPF/ETF), project costs, progress and contractor billing
- reminds about expiring insurance, licences and bonds
- produces simple reports (PDF + Excel)
- backs up every day to Google Drive

**UX principles (non-negotiable):**
1. **Simple first.** Few clicks, big readable text, plain words, no jargon in the UI. The dashboard is calm and minimal.
2. **English by default, Sinhala switchable** (toggle in the top bar, remembered in a cookie). Every UI string goes through i18n. No hard-coded strings.
3. **Daily Entry is the heart.** One screen where he picks a date + site and records attendance, machine hours/fuel and expenses quickly.
4. **Nothing is lost.** Soft deletes, an audit log, document version history, daily backups.
5. **Money is exact.** Decimals only, never JS floats, for money and quantities.
6. **Ships with sample data** so the owner can explore it immediately (a "Reset sample data" option exists).

---

## 2. Domain glossary (construction, Sri Lanka)

| Term | Meaning in this system |
|---|---|
| **Project** | A contract/site. Type: ROAD, BUILDING, SCHOOL_BUILDING, BRIDGE_CULVERT, IRRIGATION, OTHER. Source: GOVERNMENT_TENDER or PRIVATE. |
| **Client** | Who pays. E.g. a Provincial Council, Pradeshiya Sabha, a school development society, or a private person/company. |
| **Contract value** | Agreed price of the work (sum of the BOQ, plus approved variations). |
| **Budget** | The owner's *internal* expected cost, split by category (LABOUR, MATERIALS, EQUIPMENT, SUBCONTRACT, OVERHEAD, OTHER). Profit ≈ contract value − actual cost. |
| **BOQ (Bill of Quantities)** | List of work items: item no, description, unit (m, m², m³, nos, kg, LS…), quantity, rate, amount. Government work is billed against it. |
| **Measurement / progress** | Quantity completed per BOQ item up to a date. **Physical progress % = Σ(done qty × rate) / Σ(BOQ qty × rate).** |
| **Variation (VO)** | An approved change to the work: adds or changes BOQ items, changes the contract value. |
| **Extension of Time (EOT)** | An approved new completion date. Keep the history. |
| **IPC / Progress Bill** | Interim Payment Certificate (government) or Progress Bill (private). Gross work done to date − previously certified = this bill's gross; then retention, advance recovery and other deductions → net payable. |
| **Retention** | % held back from each bill (default 10%, capped at 5% of the contract value; both configurable per project). Released later, usually half at completion and half after the defects liability period. |
| **Mobilization advance** | An advance paid by the client at the start (e.g. up to 20% of the contract), recovered as a % of each IPC until fully recovered. |
| **Bond / Guarantee** | Bank guarantees with an expiry date: BID_BOND, PERFORMANCE_BOND, ADVANCE_PAYMENT_GUARANTEE, RETENTION_GUARANTEE. These need reminders. |
| **Defects liability period (DLP)** | The period after completion; retention is released at the end of it. |
| **CIDA grading** | The contractor's registration with the Construction Industry Development Authority (formerly ICTAD). A **company document** with an expiry date. |
| **Asset** | A machine, vehicle or tool: JCB/backhoe, excavator, tipper, cab/crew-cab, tractor, roller, concrete mixer, water bowser, compactor, generator, tools. |
| **Hour meter** | Machines are serviced by engine hours, not by date. Usage logs record start/end hour-meter readings. |
| **Vehicle documents** | Revenue licence, insurance, emission test certificate, fitness certificate. All have expiry dates and need reminders. |
| **Worker types** | `DAILY` (temporary, paid per day worked) and `PERMANENT` (monthly salary, EPF/ETF). Skills: MASON, CARPENTER, HELPER/LABOURER, MACHINE_OPERATOR, DRIVER, STEEL_FIXER, ELECTRICIAN, PLUMBER, SUPERVISOR, OTHER. |
| **NIC** | National Identity Card number (old: 9 digits + V/X, new: 12 digits). |
| **Advance (salary loan)** | Money given to a worker before payday. Recovered from wages, in instalments or in full. |
| **EPF / ETF** | Permanent staff: EPF employee 8%, EPF employer 12%, ETF employer 3%, all on gross earnings excluding OT. The rates are **settings**, not constants. |
| **Allocation** | A **plan**: worker or asset X is assigned to project Y from date-time A to B. Must never overlap for the same worker or asset. |
| **Attendance / Usage** | What **actually** happened. Salaries and costs are always calculated from actuals, never from allocations. |
| **Main store** | Materials bought but not yet sent to a site. Issuing from the store to a project moves the cost to that project. |

**Currency:** LKR, shown as `Rs. 1,250,000.00`. **Timezone:** `Asia/Colombo`. **Dates:** shown as `14 Oct 2026`.

---

## 3. Architecture

```
┌──────────────────────── MacBook (Docker Compose, project "supun") ────────────────────────┐
│                                                                                           │
│  web  (Next.js, :3000, the only port published, bound to 127.0.0.1)                       │
│    └── /api/*  ──rewrite──►  api (NestJS, :4000, internal)                                │
│                                ├── postgres (PostgreSQL 18, volume pgdata)                │
│                                ├── seaweedfs (S3 API :8333, volume seaweed_data)          │
│                                ├── gotenberg (HTML → PDF, Chromium; Sinhala fonts)        │
│                                └── @nestjs/schedule jobs (reminders)                      │
│                                                                                           │
│  backup (alpine: pg_dump + rclone + restic + supercronic)                                 │
│     nightly + on demand: pg_dump + mirror S3 bucket → restic repo → rclone → Google Drive │
│     also keeps a local restic repo (volume backup_local) so backups work without Drive    │
│     writes results into table backup_runs; reads backup_requests ("Backup now")           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

- The browser only talks to **web**. Next.js rewrites `/api/:path*` to `http://api:4000/:path*`, so auth
  cookies are same-origin and the API is never exposed.
- **All images must be multi-arch (arm64 + amd64)**, because the target is an Apple Silicon Mac.
- On start, the `api` container runs `prisma migrate deploy`. It then seeds the admin user and settings if they
  are missing, and seeds sample data if `SEED_SAMPLE_DATA=true` **and** the DB has no projects.
- Owner's workflow: `git pull && docker compose up -d --build` (wrapped in `scripts/update.command`).

---

## 4. Tech stack & key decisions

> At the start of Step 1, check the current stable versions (`npm view <pkg> version`) and pin exact
> versions. Record anything that differs from below in the drift log.

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | **pnpm workspaces** | `apps/api`, `apps/web`, `packages/shared`. Node **24 LTS**. |
| Backend | **NestJS (latest major, v12 as of 2026)** | Modular, one module per feature. |
| ORM | **Prisma 7** with `@prisma/adapter-pg` | `prisma.config.ts`, explicit generator output. Exclusion constraints and other DB-only features are added as **raw SQL inside migrations** (`migrate dev --create-only`, then edit). |
| DB | **PostgreSQL 18** (`postgres:18-alpine`) | Note: PG 18 images use `/var/lib/postgresql` as the volume mount point (PGDATA is versioned under it). Extension `btree_gist`. |
| Validation | **zod** schemas in `packages/shared`, used by the API (a custom `ZodValidationPipe`) and the web forms (react-hook-form + zodResolver). |
| Frontend | **Next.js (latest 16.x)**, App Router, `output: 'standalone'` | Mostly client components with **TanStack Query** for data. Server Actions only for the locale cookie. |
| UI | **Tailwind CSS + shadcn/ui** (+ lucide icons) | Clean, large, high-contrast. Font: **Noto Sans + Noto Sans Sinhala** via `next/font`. Charts: **recharts** (few, simple). |
| i18n | **next-intl without i18n routing**, locale from cookie `NEXT_LOCALE` (`en` default, `si`) | `apps/web/messages/en.json`, `si.json`. A unit test ensures both files have identical key sets. |
| Auth | Single admin. **argon2** password hash, **JWT in an httpOnly, SameSite=Lax cookie**, 7-day expiry | Login page; change-password screen; banner while the default password is still in use. Global guard; `@Public()` decorator for login/health. |
| File storage | **SeaweedFS** (`chrislusf/seaweedfs`, pinned tag) in single-node mode with S3 enabled and credentials from a config file generated from `.env` | API uses `@aws-sdk/client-s3` with `forcePathStyle: true`. Bucket `supun-docs`, created on API start if missing. Never public: the API streams downloads. |
| PDF | **Gotenberg** container (Chromium HTML→PDF) | The API renders HTML (Handlebars templates) and POSTs it to Gotenberg. Embed **Noto Sans Sinhala** as `@font-face` (base64) in the templates so Sinhala renders correctly. |
| Excel | **exceljs** | |
| Jobs | **@nestjs/schedule** | Daily 06:00 Asia/Colombo reminder scan; also runs on API start. |
| Decimal math | **decimal.js** in the API (Prisma `Decimal`) | Money is serialized to JSON as a **string** with 2 decimals; quantities as strings with up to 3 decimals. |
| Tests | API: **Jest** unit + e2e (supertest) against a real Postgres test DB. Web: **Vitest** for utils, **Playwright** e2e against the full compose stack. |
| Lint/format | ESLint + Prettier (repo root config), `tsc --noEmit` typecheck in every package. |
| Backup | **restic + rclone** (Google Drive remote) + `pg_dump -Fc`, scheduled with **supercronic** | See Step 6. |

### Conventions
- **IDs:** UUID (`@default(uuid())`). **Human codes** where useful: `PRJ-2026-001`, `W-0001`, `AST-001`, `SUP-001`, `IPC-<project code>-01`.
- **Timestamps:** `createdAt`, `updatedAt` on every table. **Soft delete:** `deletedAt` on master data (projects, clients, workers, assets, suppliers, documents, materials). List endpoints exclude deleted rows by default.
- **Audit log:** a Nest interceptor records every POST/PATCH/PUT/DELETE: entity, entityId, action, a JSON diff summary, and the timestamp.
- **API style:** REST, JSON, plural nouns: `GET /projects?search=&status=&page=&pageSize=`. Paginated response: `{ items, total, page, pageSize }`. Errors: `{ statusCode, message, code?, details? }`. Domain errors use stable `code`s (e.g. `ALLOCATION_OVERLAP`, `PAYROLL_LOCKED`) that the web translates.
- **Dates:** `DATE` columns for calendar days (attendance, expense date). `timestamptz` for allocations. Any "today" or month boundary is computed in **Asia/Colombo**.
- **Enums:** defined once in `packages/shared` (as const arrays + zod enums) and mirrored by Prisma enums. Labels come from i18n (`enums.projectType.ROAD`).
- **Folders:** API `src/modules/<feature>/{<feature>.module.ts, .controller.ts, .service.ts, *.spec.ts}`; pure calculators in `src/modules/<feature>/calc/*.ts` with thorough unit tests. Web: `src/app/(app)/<feature>/...`, shared components in `src/components`.
- **No hard-coded UI strings**, even for errors and empty states.
- **Git:** commit at the end of each step (conventional message, e.g. `feat(step-3): daily operations`). Never commit `.env`.

---

## 5. Repository layout (target)

```
supun-construction/
├── apps/
│   ├── api/
│   │   ├── prisma/ (schema.prisma, migrations/, prisma.config.ts)
│   │   ├── src/
│   │   │   ├── main.ts, app.module.ts
│   │   │   ├── common/   (prisma, storage, auth, zod pipe, audit, money, pagination, errors)
│   │   │   ├── modules/  (auth, settings, clients, projects, documents, workers, assets,
│   │   │   │              suppliers, materials, allocations, attendance, asset-usage, expenses,
│   │   │   │              purchases, payroll, costing, boq, billing, bonds, reminders,
│   │   │   │              dashboard, reports, backup, audit)
│   │   │   ├── seed/     (base.ts, sample-data.ts)
│   │   │   └── reports/templates/ (*.hbs, fonts/)
│   │   └── test/ (e2e *.e2e-spec.ts, helpers)
│   └── web/
│       ├── src/app/(auth)/login, src/app/(app)/{dashboard,daily,projects,workers,assets,
│       │   schedule,purchases,suppliers,payroll,reports,documents,settings}
│       ├── src/components/ (ui/ = shadcn, layout/, forms/, data-table/, documents/)
│       ├── src/lib/ (api-client.ts, format.ts, query-keys.ts)
│       ├── src/i18n/ (request.ts, actions.ts)
│       ├── messages/ (en.json, si.json)
│       └── e2e/ (Playwright specs)
├── packages/shared/ (src/enums.ts, src/schemas/*.ts, src/index.ts) — built with tsup
├── docker/
│   ├── api.Dockerfile, web.Dockerfile
│   ├── seaweedfs/ (entrypoint that renders s3.json from env)
│   └── backup/ (Dockerfile, crontab, backup.sh, restore.sh, worker.sh)
├── scripts/ (start.command, update.command, stop.command, setup-gdrive.sh, restore.sh, dev-up.sh)
├── docker-compose.yml        # full stack (what the owner runs)
├── docker-compose.dev.yml    # infra only for dev/tests: postgres :5433, seaweedfs :8334, gotenberg :3002
├── .env.example
├── README.md                 # owner-friendly install & use guide
└── docs/ (this plan)
```

---

## 6. Data model (contract — implemented fully in Step 1)

> Field lists are the minimum. Add sensible extras (`notes`, `createdAt`, …) freely. Any rename or
> removal must be logged in the drift log. M = Decimal(14,2) money, Q = Decimal(14,3) quantity.

**System**
- `User` (id, username unique, passwordHash, mustChangePassword bool, lastLoginAt)
- `Setting` (key unique, value JSON). Keys: `company` {name, address, phone, email, cidaGrade, logoDocId}, `payroll` {epfEmployeePct 8, epfEmployerPct 12, etfEmployerPct 3, workingDaysPerMonth 26, otMultiplier 1.5, permanentOtDivisor 240, dailyStandardHours 8}, `reminders` {daysBefore [30,14,7]}, `billing` {defaultRetentionPct 10, defaultRetentionCapPct 5}
- `AuditLog` (entity, entityId, action, summary JSON, createdAt)
- `Notification` (type, severity INFO/WARNING/DANGER, titleKey, params JSON, entityType, entityId, dueDate, readAt, resolvedAt, dedupeKey unique)
- `BackupRun` (startedAt, finishedAt, status RUNNING/SUCCESS/FAILED, trigger SCHEDULED/MANUAL, sizeBytes, destination LOCAL/GDRIVE/BOTH, message)
- `BackupRequest` (requestedAt, pickedAt)

**Parties**
- `Client` (name, type GOVERNMENT/PRIVATE, contactPerson, phone, email, address, notes)
- `Supplier` (code, name, type MATERIAL/HARDWARE/FUEL/SUBCONTRACTOR/EQUIPMENT_HIRE/OTHER, phone, address, notes)

**Projects**
- `Project` (code, name, type, source, clientId, location, description, contractValue M, contractNo, tenderNo, startDate, plannedEndDate, revisedEndDate?, actualEndDate?, status PLANNING/ONGOING/ON_HOLD/COMPLETED/CANCELLED, retentionPct, retentionCapPct, advanceAmount M, advanceRecoveryPct, dlpMonths, progressPct? (manual, used when no BOQ), siteSupervisorWorkerId?)
- `ProjectBudgetLine` (projectId, category, amount M, notes) — unique (projectId, category)
- `ExtensionOfTime` (projectId, previousEndDate, newEndDate, approvedDate, reference, reason)
- `BoqItem` (projectId, itemNo, description, unit, quantity Q, rate M, sortOrder, variationId?)
- `BoqMeasurement` (boqItemId, date, cumulativeQty Q, notes) — the progress up to that date
- `Variation` (projectId, number, title, date, status PENDING/APPROVED/REJECTED, amountChange M, notes)
- `PaymentCertificate` (projectId, number, periodFrom, periodTo, cumulativeWorkDone M, previousCertified M, grossThisBill M, retentionDeducted M, advanceRecovered M, otherDeductions M, otherDeductionsNote, netPayable M, status DRAFT/SUBMITTED/CERTIFIED/PAID, submittedDate, certifiedDate)
- `ClientPayment` (projectId, certificateId?, date, amount M, method CASH/CHEQUE/BANK_TRANSFER, reference, kind IPC_PAYMENT/ADVANCE/RETENTION_RELEASE/OTHER)
- `Bond` (projectId, type, bank, referenceNo, amount M, issueDate, expiryDate, status ACTIVE/RELEASED/EXPIRED, notes)

**Documents (generic, versioned)**
- `Document` (ownerType COMPANY/PROJECT/ASSET/WORKER/SUPPLIER/CLIENT, ownerId?, category, title, description, currentVersionId?, deletedAt)
  - category enum: PLAN_DRAWING, CONTRACT, BOQ, PHOTO, INVOICE, RECEIPT, LETTER, ESTIMATE, REVENUE_LICENCE, INSURANCE, EMISSION_TEST, FITNESS_CERTIFICATE, REGISTRATION_BOOK, NIC_COPY, CERTIFICATE, CIDA_REGISTRATION, BOND_COPY, OTHER
- `DocumentVersion` (documentId, versionNo, storageKey, fileName, mimeType, sizeBytes, sha256, issueDate?, expiryDate?, note, uploadedAt)
  - **The expiry of the *current* version drives reminders** (renewing insurance = uploading a new version with a new expiry).
  - Storage key: `documents/{documentId}/v{versionNo}-{uuid}-{safeFileName}`. Files are never overwritten.

**Workers**
- `Worker` (code, fullName, nameSinhala?, nic unique?, phone, address, dateOfBirth?, skill, type DAILY/PERMANENT, joinedDate, leftDate?, active, epfNo?, bankName?, bankAccountNo?, emergencyContact?, photoDocId?)
- `WorkerRate` (workerId, effectiveFrom DATE, dailyRate M?, monthlySalary M?, otHourlyRate M?) — the rate on a day is the latest row with effectiveFrom ≤ that day
- `WorkerAllocation` (workerId, projectId, startAt timestamptz, endAt timestamptz, notes, status PLANNED/CANCELLED) — **EXCLUDE overlap per worker where status <> 'CANCELLED'**
- `Attendance` (workerId, date, projectId?, status PRESENT/HALF_DAY/ABSENT/LEAVE, otHours Q, notes, payrollRunId?) — unique (workerId, date). Locked once its payroll run is finalized.
- `Advance` (workerId, date, amount M, reason, recoveryPerMonth M?, status OPEN/RECOVERED)
- `AdvanceRecovery` (advanceId, payrollLineId, amount M)

**Assets**
- `Asset` (code, name, category JCB_BACKHOE/EXCAVATOR/TIPPER/CAB/TRACTOR/ROLLER/CONCRETE_MIXER/WATER_BOWSER/COMPACTOR/GENERATOR/TOOL/OTHER, make, model, registrationNo?, chassisNo?, engineNo?, yearOfManufacture?, purchaseDate?, purchaseCost M?, ownership OWNED/HIRED_IN, status AVAILABLE/IN_USE/UNDER_REPAIR/DISPOSED, meterType HOURS/KM/NONE, currentMeter Q, serviceIntervalMeter Q?, lastServiceMeter Q?, internalRatePerHour M?, internalRatePerDay M?, isVehicle bool)
- `AssetAllocation` (assetId, projectId, startAt, endAt, operatorWorkerId?, notes, status PLANNED/CANCELLED) — **EXCLUDE overlap per asset where status <> 'CANCELLED'**
- `AssetUsageLog` (assetId, projectId?, date, startMeter Q?, endMeter Q?, hoursUsed Q, fuelLitres Q?, fuelCost M?, operatorWorkerId?, notes)
- `MaintenanceRecord` (assetId, date, type SERVICE/REPAIR/TYRE/OTHER, description, meterReading Q?, cost M, supplierId?, nextServiceMeter Q?)

**Materials, purchasing, expenses**
- `Material` (name, nameSinhala?, unit, category CEMENT/SAND/AGGREGATE/STEEL/BRICKS_BLOCKS/TIMBER/HARDWARE/FUEL/OTHER)
- `Purchase` (supplierId, date, invoiceNo, paymentType CASH/CREDIT, notes, total M) + `PurchaseLine` (purchaseId, materialId, quantity Q, unitPrice M, amount M, projectId? — null = main store)
- `MaterialIssue` (materialId, projectId, date, quantity Q, unitCost M — weighted average store cost at issue time, notes)
- `SupplierPayment` (supplierId, date, amount M, method, reference, notes)
- `Expense` (date, projectId?, assetId?, category FUEL/TRANSPORT/MEALS/EQUIPMENT_HIRE/SUBCONTRACT/SMALL_TOOLS/UTILITIES/PERMITS_FEES/REPAIRS/OFFICE/OTHER, description, amount M, paidBy CASH/BANK/CREDIT, supplierId?, receiptDocumentId?)

**Payroll**
- `PayrollRun` (year, month, status DRAFT/FINALIZED, finalizedAt) — unique (year, month)
- `PayrollLine` (payrollRunId, workerId, workerType, daysWorked Q, halfDays, otHours Q, basicPay M, otPay M, grossPay M, epfEmployee M, epfEmployer M, etfEmployer M, advanceDeduction M, otherDeductions M, netPay M, breakdown JSON — per project days & cost)

---

## 7. Core business rules (calculators — unit-test all of these)

**Allocation overlap:** rejected by the DB exclusion constraint. The API maps the Postgres error
`23P01` to HTTP 409 `ALLOCATION_OVERLAP` and includes the conflicting allocation. `endAt > startAt` is enforced.

**Daily worker pay (per month):** for each attendance day: PRESENT = 1 day, HALF_DAY = 0.5.
`basicPay = Σ(dayFraction × dailyRate on that date)`. `otPay = Σ(otHours × otRate)`, where otRate =
the worker's `otHourlyRate` or else `dailyRate / dailyStandardHours × otMultiplier`. No EPF/ETF for DAILY workers.

**Permanent worker pay (per month):** `basicPay = monthlySalary − noPayDays × (monthlySalary / workingDaysPerMonth)`.
No-pay days = ABSENT days on working days, i.e. Mon–Sat excluding days marked LEAVE. Keep it simple: count
ABSENT records only. `otPay = otHours × (monthlySalary / permanentOtDivisor) × otMultiplier`. EPF/ETF
are computed on `basicPay` (excluding OT): employee 8% deducted; employer 12% + ETF 3% are employer cost.

**Net pay:** `gross − epfEmployee − advanceDeduction − otherDeductions`. The advance deduction is the open
advances' `recoveryPerMonth` (or the remaining balance if smaller), editable in the DRAFT run.

**Payroll lifecycle:** generate DRAFT (recalculates; repeatable) → review/edit deductions → FINALIZE
(locks the month's attendance, creates AdvanceRecovery rows, closes fully-recovered advances). Attendance
edits in a finalized month → 409 `PAYROLL_LOCKED`.

**Project actual cost** (any date range, by category):
- LABOUR: daily workers = Σ attendance on that project × the rate (+ OT). Permanent workers = their month's
  gross + employer EPF/ETF, split across projects by their attendance days; days without a project → overhead
  (shown separately, not added to a project).
  *Before payroll is finalized, labour is an estimate from rates* (show an "estimated" tag).
- MATERIALS: purchase lines delivered to the project + material issues to the project.
- EQUIPMENT: Σ usage hours × asset `internalRatePerHour` (or days × `internalRatePerDay` when there is no hourly
  rate) + fuel cost on usage logs + expenses in category EQUIPMENT_HIRE/FUEL for that project.
- SUBCONTRACT / OTHER: expenses by category on that project.
- Compare with the budget lines → variance and % used.

**Project health (dashboard & project page):** three bars: **Time elapsed %** (today vs start→current end
date), **Budget used %**, **Physical progress %** (BOQ). Flag:
- `OVER_BUDGET` when budget used > 100%.
- `COST_AHEAD_OF_PROGRESS` when budget used − physical progress > 15 points.
- `BEHIND_SCHEDULE` when time elapsed − physical progress > 15 points.
- If a project has no BOQ, physical progress falls back to the manual `Project.progressPct`.

**IPC calculation:** `cumulativeWorkDone` defaults to Σ(latest measurement ≤ periodTo × rate) and is editable.
`grossThisBill = cumulativeWorkDone − previousCertified` (the sum of earlier certificates' cumulative).
`retention = min(grossThisBill × retentionPct, cap − retentionSoFar)` where cap = contractValue × retentionCapPct.
`advanceRecovered = min(grossThisBill × advanceRecoveryPct, advanceAmount − recoveredSoFar)`.
`net = gross − retention − advanceRecovered − otherDeductions`.
Receivable = Σ net of CERTIFIED/SUBMITTED certificates − Σ IPC payments. Retention held = Σ retention − Σ RETENTION_RELEASE payments.

**Store stock:** stock = Σ purchase lines with projectId null − Σ issues. Issue unit cost = weighted average of
store purchases to date. Prevent issuing more than in stock (409 `INSUFFICIENT_STOCK`).

**Supplier balance:** Σ CREDIT purchases + Σ CREDIT expenses with that supplier − Σ supplier payments.

**Reminders** (daily job + on start), deduplicated by `dedupeKey`:
- current document version expiring within the configured days, or already expired
- ACTIVE bonds expiring
- assets where `currentMeter − lastServiceMeter ≥ serviceIntervalMeter × 0.9` (service due soon) or ≥ 100% (overdue)
- projects whose current end date is within 14 days and status ONGOING
- a notification is auto-resolved when its condition clears (e.g. a new version with a later expiry)

---

## 8. Screens (web)

Top bar: company name, **EN | සිං** toggle, notification bell (count), backup status dot, logout.
Sidebar (icons + labels, collapsible on small screens):

1. **Dashboard** — keep it calm and simple:
   - 4 KPI cards: Active projects · Workers on site today · Spent this month · Money to receive
   - "Needs attention" list (max 8, link to "see all"): expiring docs/bonds, service due, over-budget projects, last backup failed or older than 36h
   - Active projects table: name, client, 3 thin progress bars (time / budget / physical), status chip
   - Quick action buttons: **Daily Entry**, Add expense, Upload document
2. **Daily Entry** — date picker (default today) + project picker. Tabs or sections:
   (a) Attendance: workers allocated to this project that day are pre-listed; add others; Present/Half/Absent + OT hours; "Copy from yesterday" button.
   (b) Machines: allocated assets pre-listed; start/end meter → hours auto-calculated; fuel litres & cost.
   (c) Expenses: quick add rows.
   One **Save** saves everything.
3. **Projects** — list (filters: status, type, source) → project detail with tabs: Overview (info + health + budget vs actual) · BOQ & Progress · Bills (IPC) & Payments · Variations & EOT · Bonds · Costs (breakdown & entries) · Team & Machines (allocations) · Documents.
4. **Schedule** — week view: rows = workers or assets (toggle), columns = days, blocks = allocations colored by project. Click a block to add or edit. Overlaps are shown as a friendly error.
5. **Workers** — list (type/skill/active filters) → detail: profile, rate history, attendance calendar (month), advances, payslips, documents.
6. **Assets** — list → detail: info, meter & service status, usage log, maintenance, allocations, documents (with expiry badges).
7. **Purchases & Store** — purchases list/form, store stock, issue to project, materials catalog.
8. **Suppliers** — list with balances → detail: statement (purchases, payments), add payment.
9. **Payroll** — month picker → generate/review draft → finalize → payslips PDF, payroll sheet Excel, EPF/ETF summary.
10. **Reports** — a simple list of report cards; each has a few filters + PDF / Excel buttons.
11. **Documents** — company documents (CIDA registration etc.) + a global search across all documents, with an expiry filter.
12. **Settings** — company info & logo, payroll rates, reminder days, billing defaults, change password, backup (status, history, "Backup now", Google Drive connection status), "Reset sample data" (with a typed confirmation).

Reusable components: `DataTable` (search, pagination, empty state), `MoneyInput`, `DateInput`, `EntityPicker`
(searchable select), `DocumentPanel` (list, upload, new version, history, download, preview images/PDF),
`ConfirmDialog`, `StatusChip`, `ProgressTriple` (three bars).

---

## 9. Reports (Step 5)

| # | Report | Formats |
|---|---|---|
| R1 | Project cost summary (budget vs actual by category + entries) | PDF, Excel |
| R2 | Monthly payroll sheet | PDF, Excel |
| R3 | Payslips (one per worker per page) | PDF |
| R4 | EPF/ETF contribution summary (month) | PDF, Excel |
| R5 | Worker attendance (month grid) | PDF, Excel |
| R6 | Asset utilisation (hours, fuel, cost by project; maintenance) | PDF, Excel |
| R7 | Expenses (date range, by category/project) | PDF, Excel |
| R8 | Supplier statement & balances | PDF, Excel |
| R9 | IPC / Progress bill printout | PDF |
| R10 | Expiry report (documents & bonds, next N days) | PDF, Excel |
| R11 | Monthly business summary (received, spent, per project, receivables, retention held) | PDF, Excel |

PDF header: company name, address, CIDA grade, report title, filters, generated date. Language = the current UI locale.

---

## 10. Sample data (realistic, clearly fictional, Polonnaruwa area)

- Company: "Supun Construction (Pvt) Ltd", Polonnaruwa. Admin `admin` / `admin123` (`mustChangePassword` stays false for the sample, but a banner suggests changing it).
- Clients: a sample Provincial Road Development office (government), a sample Pradeshiya Sabha (government), a school development society (government), a private client (person), a private company.
- Projects (6): a ~2.4 km rural road rehabilitation, Hingurakgoda (govt, ONGOING, with BOQ, 2 IPCs, bonds); a 2-storey school classroom block, Medirigiriya (govt, ONGOING, BOQ, 1 IPC); a box culvert (govt, COMPLETED, retention held); a private two-storey house, Kaduruwela (private, ONGOING, no BOQ, manual progress); a small shop building (private, PLANNING); a drain improvement (govt, ON_HOLD).
- 25 workers (18 DAILY at Rs. 2,800–4,500/day by skill, 7 PERMANENT at Rs. 55,000–120,000/month). Realistic Sinhala names with Sinhala spellings.
- 12 assets: 2 JCB backhoes, 1 excavator, 2 tippers, 1 double cab, 1 roller, 2 concrete mixers, 1 water bowser, 1 generator, 1 vibrator/compactor. Vehicle documents with expiries spread so that some are **expired**, some due **within 7 / 30 days** and most are fine.
- About 60 days of history ending "today": allocations, attendance, usage logs, expenses, purchases, issues, supplier payments, advances, **one finalized payroll month** and the current month in draft.
- Placeholder files: tiny generated PDFs/PNGs (made at seed time; no binaries in git).

---

## 11. Testing standards & Definition of Done (every step)

A step is **done** only when ALL of these pass:
1. `pnpm -r typecheck`, `pnpm -r lint`, and `pnpm -r test` (unit) are green.
2. API e2e tests for the step's endpoints are green, against the dev infra (`docker compose -f docker-compose.dev.yml up -d`, DB `supun_test`, reset per test file).
3. **Calculators** (payroll, costing, IPC, stock, health flags, overlap mapping) have table-driven unit tests, including edge cases (month boundaries, half days, rate change mid-month, retention cap reached, advance fully recovered).
4. The **full stack** builds and starts from clean: `docker compose down -v && docker compose up -d --build`. All healthchecks are healthy, migrations apply, the sample seed loads, and `http://localhost:3000` shows the login page.
5. **Playwright** e2e specs for the step's main user flows pass against the running full stack (login → do the thing → see the result). Include at least one Sinhala-locale smoke check per step.
6. Manual sanity check via a browser (Claude's browser tools or Playwright screenshots in `apps/web/e2e/screenshots/`, git-ignored): pages render, no console errors, layout fine at 1280px and at 1440px (MacBook).
7. `en.json` and `si.json` have identical keys (test). No hard-coded strings in new UI.
8. The sample seed is extended for the step's modules (the owner must see realistic data everywhere).
9. `docs/DRIFT-LOG.md` is updated, and a git commit is made.

---

## 12. Step plan

| Step | File | Scope |
|---|---|---|
| 1 | `docs/steps/STEP-1-foundation.md` | Monorepo, Docker (all services), full Prisma schema + migrations + exclusion constraints, auth, i18n, app shell, settings, audit log, storage service, test harness, base seed |
| 2 | `docs/steps/STEP-2-master-data-documents.md` | Clients, Projects (basic + budget lines), Workers (+rates), Assets, Suppliers, Materials, **Documents with versioning** (all owners), Company documents |
| 3 | `docs/steps/STEP-3-daily-operations.md` | Allocations + Schedule view, **Daily Entry** (attendance, usage, expenses), maintenance, purchases/store/issues, supplier payments & balances, advances |
| 4 | `docs/steps/STEP-4-money.md` | Payroll (daily + permanent, EPF/ETF, advances, finalize), project costing & health, BOQ & progress, variations/EOT, IPC & client payments, retention, bonds |
| 5 | `docs/steps/STEP-5-dashboard-reminders-reports.md` | Dashboard, reminders/notifications, all reports (PDF via Gotenberg + Excel), full Sinhala pass |
| 6 | `docs/steps/STEP-6-backup-packaging-polish.md` | Backup container (restic + rclone → Google Drive), restore, Mac scripts, full realistic sample data, README/user guide, full regression & polish |
