# Step 5 — Dashboard, Reminders & Reports

**Goal:** A **simple, calm dashboard**, **reminders** for expiring documents/bonds, service due and project
deadlines, and **all reports in PDF and Excel** (correct Sinhala rendering). Finish with a complete Sinhala
translation pass.

## Read first
- `docs/00-OVERVIEW.md` — §1 UX principles, §7 Reminders + Project health, §8 screen 1 (Dashboard), 10 (Reports), top bar, §9 Reports table, §6 Notification.
- `docs/DRIFT-LOG.md` — all entries.
- Codebase: `schema.prisma` (Notification, DocumentVersion.expiryDate, Bond, Asset meters, Project dates); `modules/costing` (health), `modules/billing` (finance summary), `modules/payroll`, `modules/assets` (service status), `modules/documents`, `modules/suppliers` (statement), `modules/expenses`; the web layout (top bar bell), the dashboard placeholder, `messages/*.json`; the docker-compose `gotenberg` service.

## Tasks

### 5.1 Reminders / notifications
- `modules/reminders`: `ReminderScanner` service (pure functions per rule + a DB runner), scheduled daily at 06:00 Asia/Colombo with `@nestjs/schedule` and run once on startup. Rules from overview §7. Upsert by `dedupeKey` (e.g. `doc:{documentId}:{versionId}:{threshold}`), auto-resolve when the condition clears. Severity: expired/overdue = DANGER, ≤7 days = WARNING, ≤30 days = INFO.
- API: `GET /notifications?status=open|all` (unresolved first, by severity then due date), `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/count`, `POST /reminders/run` (manual trigger).
- Web: the bell shows the unread count (poll every 60 s) → a dropdown with the latest 8 + "See all" → a `/notifications` page with filters. Each item links to the entity (asset → documents tab, etc.). Titles are translated from `titleKey` + params.
- Optional email digest: if `SMTP_HOST` etc. are set in `.env`, send one daily summary email (nodemailer) to `company.email`; otherwise skip silently. Document it in `.env.example`.

### 5.2 Dashboard
- API `GET /dashboard` (one call): KPIs { activeProjects, workersOnSiteToday (attendance PRESENT/HALF today, else allocations today), spentThisMonth (all actual costs this month across categories), moneyToReceive (Σ receivables) }, attention list (top 8 open notifications + health flags + backup status placeholder; Step 6 fills backup), active projects with health triples, and a small "last 6 months spend vs received" series.
- Web `/dashboard` — **keep it simple**: greeting + date; 4 large KPI cards; "Needs attention" list with colored dots and plain sentences ("Insurance of JCB AST-001 expires in 5 days"); the active projects table with `ProgressTriple`; one small bar chart (spend vs received, 6 months); quick action buttons (Daily Entry, Add expense, Upload document). No clutter, generous spacing, and it works at 1280px.

### 5.3 Reports engine
- `modules/reports`: `ReportService.render(reportId, params, format, locale)`.
  - **PDF**: Handlebars templates in `src/reports/templates/` + a shared layout (header: company name, address, CIDA grade, logo if present; title; filters; generated at; page numbers in the footer). Embed **Noto Sans + Noto Sans Sinhala** as base64 `@font-face` (font files in `reports/templates/fonts/`, OFL licence file included). POST the HTML to Gotenberg `/forms/chromium/convert/html` (A4, margins, landscape for wide reports), stream the PDF back.
  - **Excel**: exceljs — styled header row, number formats (`#,##0.00`), frozen header, totals row, auto column widths, a sheet per section where useful.
  - Translations for report labels come from the same `messages/*.json` (copy or share them via `packages/shared` — choose one and record it in the drift log).
- Implement **R1–R11** from overview §9 using the existing services (no duplicated calculations). Endpoints `GET /reports/:reportId?format=pdf|xlsx&...params` → file download with a sensible filename (`project-cost_PRJ-2026-001_2026-10.pdf`).
- Web `/reports`: a grid of report cards (icon, name, one-line description) → each opens a side panel with the needed filters (project, month, date range, worker, asset, supplier, days ahead) and **Download PDF / Download Excel** buttons. Enable the placeholder export buttons from Step 4 (payroll page, project tabs, supplier statement, IPC print).

### 5.4 Sinhala translation pass
- Review **every** key in `si.json` for natural, simple Sinhala that a contractor would understand; keep technical loanwords (JCB, BOQ, IPC, EPF, ETF) in English. Check the layout in Sinhala on every page (longer strings, wrapping, button widths) and fix any overflow.
- Add a note at the top of the README section on translations: "Sinhala text should be reviewed by a native speaker; edit `apps/web/messages/si.json`".

### 5.5 Tests
- Unit: each reminder rule (thresholds, expired, auto-resolve, dedupe), dashboard KPI calculator, report data builders (totals equal the source services).
- API e2e: reminders run creates the expected notifications from the sample-like fixtures; read/read-all; every report endpoint returns 200 with the right content type for pdf and xlsx (PDF starts with `%PDF`; the xlsx opens with exceljs and has the expected header row); a Sinhala-locale PDF renders (non-empty; check the text layer contains a Sinhala string if feasible).
- Playwright: the dashboard shows 4 KPIs, attention items and projects; the bell count matches the list; open a notification → lands on the entity; download R1 PDF and R2 Excel (assert the download event and file size > 0); the dashboard in Sinhala; visual check screenshots at 1280 and 1440.

## Acceptance criteria
- [ ] The dashboard is simple, correct and fast (< 1 s API with the sample data).
- [ ] Expiring documents/bonds, service due and deadlines appear as reminders and disappear when resolved (e.g. upload a renewed insurance version).
- [ ] All 11 reports download in their formats; Sinhala PDFs render correctly (no boxes or broken glyphs — verify by viewing a screenshot of the PDF).
- [ ] Definition of Done (overview §11) satisfied.
- [ ] Drift log updated; commit `feat(step-5): dashboard, reminders and reports`.
