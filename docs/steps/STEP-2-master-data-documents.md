# Step 2 — Master Data & Versioned Documents

**Goal:** The owner can manage **clients, projects (basic info + budget), workers (+ rate history),
assets, suppliers and materials**, and attach **documents with version history** to any of them and to
the company. Expiry dates on document versions are stored (reminders come in Step 5).

## Read first
- `docs/00-OVERVIEW.md` — §2 glossary, §4 conventions, §6 data model (Parties, Projects [basic fields only], Documents, Workers [Worker, WorkerRate], Assets [Asset only], Materials), §8 screens 3, 5, 6, 8, 11.
- `docs/DRIFT-LOG.md` — **all entries** (Step 1 decisions affect everything).
- Codebase: `apps/api/prisma/schema.prisma`, `apps/api/src/common/**`, `apps/api/src/modules/settings` (pattern to copy), `apps/api/src/seed/**`, `apps/api/test/helpers*`, `packages/shared/src/**`, `apps/web/src/components/**`, `apps/web/src/lib/**`, `apps/web/src/app/(app)/settings` (form pattern), `apps/web/messages/*.json`, `apps/web/e2e/*`.

## Tasks

### 2.1 API modules (CRUD + search + pagination + soft delete + audit)
For each: zod schemas in `packages/shared/src/schemas/<entity>.ts`, controller, service, e2e tests.
- **clients** — `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`. Filter by type.
- **projects** — the same CRUD for the basic fields (code auto-generated `PRJ-YYYY-NNN`, unique). Filters: status, type, source, clientId, search. `PUT /projects/:id/budget` (upsert all category lines at once). `GET /projects/:id` returns the client, budget lines and total budget. Contract fields (retention %, advance…) are editable here; defaults come from `billing` settings.
- **workers** — CRUD (code `W-NNNN`), NIC validation (old `^\d{9}[VvXx]$` or new `^\d{12}$`, optional, unique when present). `GET/POST /workers/:id/rates` (rate history, effectiveFrom unique per worker). `GET /workers/:id` includes the current rate. A shared helper `getRateOn(workerId, date)` (used by later steps) with a unit test.
- **assets** — CRUD (code `AST-NNN`), filters by category/status. Meter fields; `isVehicle` drives which document categories the UI suggests.
- **suppliers** — CRUD (code `SUP-NNN`), filter by type.
- **materials** — CRUD (simple catalog, unit, category, Sinhala name).
- **documents**:
  - `GET /documents?ownerType=&ownerId=&category=&search=&expiring=30` (includes the current version)
  - `POST /documents` (multipart: metadata + file → creates the Document and version 1)
  - `POST /documents/:id/versions` (multipart: file + note + issueDate + expiryDate → versionNo+1, becomes current)
  - `GET /documents/:id` (with all versions, newest first), `PATCH /documents/:id` (title, category, description)
  - `GET /documents/:id/versions/:versionId/download` (streams from S3; `?inline=1` for preview, with the correct Content-Type and Content-Disposition with a safe filename)
  - `POST /documents/:id/versions/:versionId/restore` (copies an old version forward as a new current version — history is never rewritten)
  - `DELETE /documents/:id` → soft delete (files are kept)
  - Uploads: stream to S3 (no full buffering for big files), compute sha256, limit 50 MB (env `MAX_UPLOAD_MB`), allow pdf, images (jpg/png/webp/heic), office docs, dwg/dxf, zip. Reject others with `UNSUPPORTED_FILE_TYPE`.
  - Validate that the owner exists (ownerType + ownerId), except COMPANY.

### 2.2 Web screens
Use the shared `DataTable` and form patterns. Every list has search, filters, an empty state with an "Add" button, and soft-delete with confirmation.
- **Projects**: list + create/edit form (sections: basic, contract, dates) + detail page with tabs. Build now: **Overview** (info, budget editor table by category with a total) and **Documents**. Other tabs show "Coming soon" (built in Steps 3–4).
- **Clients**: simple list + dialog form (reachable from Projects → "Manage clients" and from Settings).
- **Workers**: list (code, name, skill, type, current rate, active) + form + detail (profile, rate history with "Add new rate", Documents tab).
- **Assets**: list (code, name, category, reg no, status, doc-expiry badge placeholder) + form + detail (info, Documents tab).
- **Suppliers**: list + form + detail (info; statement tab placeholder for Step 3).
- **Materials**: under Purchases & Store → "Materials" tab (list + dialog).
- **Documents page**: tabs "Company documents" (ownerType COMPANY) and "All documents" (global search: owner, category, expiring filter).
- **`DocumentPanel` component** (reused on every detail page): table of documents (title, category, current version, uploaded date, expiry badge: red expired / orange ≤30 days / green), "Upload document" dialog (drag and drop, category, title, issue/expiry dates, note), "Upload new version", "History" drawer (all versions with download/preview/restore), image/PDF preview in a dialog (iframe for PDF, img for images). Suggest categories based on the owner (vehicle → REVENUE_LICENCE, INSURANCE, EMISSION_TEST, FITNESS_CERTIFICATE…).
- Add all new strings to `en.json` and `si.json`.

### 2.3 Sample data (extend `seed/sample-data.ts`)
Per overview §10: clients, 6 projects with budgets, 25 workers with rate history (some had a raise last month), 12 assets, ~8 suppliers (cement dealer, hardware shop, sand/metal supplier, fuel station, tyre shop, a subcontractor…), ~20 materials. Documents: generate tiny PDFs/PNGs at seed time (e.g. with `pdf-lib` and a 1×1 PNG buffer) — vehicle licences/insurance with varied expiries (some expired, some ≤7 days, some ≤30 days, most fine), at least one document with **3 versions**, project plans/contracts, a CIDA registration company document, and NIC copies for a few workers.

### 2.4 Tests
- API e2e: CRUD + validation + soft delete for each module; document upload → new version → history order → download bytes equal to the upload (sha256) → restore creates version N+1 → soft delete hides it; file type and size rejection; NIC validation; budget upsert; `getRateOn` around rate change dates.
- Playwright: create a project with a budget; create a worker and add a rate; create an asset and upload an insurance doc, then a new version → history shows 2; Sinhala smoke check on the Workers list.

## Acceptance criteria
- [ ] All CRUD screens work end to end with the sample data visible after `docker compose down -v && docker compose up -d --build`.
- [ ] Document versioning works: upload, new version, history, preview, download, restore; files live in SeaweedFS.
- [ ] Definition of Done (overview §11) satisfied.
- [ ] Drift log updated; commit `feat(step-2): master data and versioned documents`.
