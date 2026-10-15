# Drift Log

> **Purpose:** each implementation session starts fresh with no memory. This file carries everything the
> next session must know that is **not** already in `docs/00-OVERVIEW.md` or in the step file: deviations from
> the plan, decisions made, versions pinned, gotchas, unfinished items, and commands that work.
>
> **Rules**
> - Read the whole log before starting a step. **The drift log wins over the overview and the step files.**
> - Append a new section at the end of each step, using the template below. Never rewrite earlier sections;
>   if an earlier decision changes, add a new entry that says so.
> - Be concrete: file paths, names, commands. Keep each entry short.

## Status

| Step | Status | Date | Commit |
|---|---|---|---|
| 1 — Foundation | ✅ Done | 2026-10-14 | bbd7eaa |
| 2 — Master data & documents | ✅ Done | 2026-10-15 | 411fde4 |
| 3 — Daily operations | ✅ Done | 2026-10-15 | feba827 |
| 4 — Money | ✅ Done | 2026-10-15 | (see below) |
| 5 — Dashboard, reminders & reports | ⬜ Not started | | |
| 6 — Backup, packaging & polish | ⬜ Not started | | |

(Status values: ⬜ Not started · 🟨 In progress / partial · ✅ Done)

---

## Template (copy for each step)

```markdown
## Step N — <name> (<YYYY-MM-DD>)

**Result:** ✅ Done | 🟨 Partial (what is missing)

### Versions pinned (Step 1, and any later upgrades)
- next x.y.z, @nestjs/core x.y.z, prisma x.y.z, …

### Deviations from the plan
- <What the plan said> → <what was done instead> — <why>. Files: `…`

### Decisions made (not specified by the plan)
- …

### Schema changes (migrations added in this step)
- `<migration_name>`: …

### Gotchas / things the next step must know
- …

### Useful commands
- Dev infra: `…`  · API e2e: `…`  · Playwright: `…`

### Test summary
- Unit: N passed · API e2e: N passed · Playwright: N passed

### Unfinished / known issues (carry over)
- [ ] …

### Needs human (cannot be done by the agent)
- …
```

---

<!-- Step entries go below this line -->

## Step 1 — Foundation (2026-10-14)

**Result:** ✅ Done

### Versions pinned (exact, in package.json / compose)
- Runtime: Node 24 (`.nvmrc` 24, Docker `node:24.21.0-slim`), **pnpm 10.34.6** (`packageManager`), TypeScript **6.0.3**
- API: @nestjs/* **12.1.3** (config 12.0.1, jwt 12.0.3, cli 12.0.8), prisma / @prisma/client / @prisma/adapter-pg **7.10.0**, pg 8.23.1, zod 4.6.7, decimal.js 10.6.0, argon2 0.45.1, @aws-sdk/client-s3 3.1151.0, cookie-parser 1.4.7, dotenv 18.0.8, vitest 5.0.4, supertest 7.3.1
- Web: next **16.4.0**, react 19.3.0, next-intl 4.14.9, @tanstack/react-query 5.104.2, @tanstack/react-table **9.3.1**, tailwindcss 4.3.3 (+ @tailwindcss/turbopack), shadcn 4.21.5 (style `radix-nova`, radix-ui 1.8.1, `cn` 0.4.0), react-hook-form 7.90.0 + @hookform/resolvers 5.9.1, lucide-react 1.57.0, sonner 2.0.8, react-day-picker 10.0.2, @playwright/test 1.64.1
- Shared: tsup 8.5.1, zod 4.6.7
- Tooling: eslint **9.39.5**, typescript-eslint 8.71.2, prettier 3.9.10, eslint-config-next 16.4.0
- Images: `postgres:18.6-alpine`, `chrislusf/seaweedfs:4.48`, `gotenberg/gotenberg:8.37.0-chromium`, `node:24.21.0-slim`

### Deviations from the plan
- **API tests use Vitest, not Jest** — NestJS 12 is ESM-only (`"type": "module"`) and its CLI scaffolds Vitest; Jest+ESM is fragile. Decorator metadata works under Vitest 5 without SWC (verified: DI resolves in e2e). Unit: `apps/api/vitest.config.ts` (`src/**/*.spec.ts`), e2e: `vitest.config.e2e.ts` (`test/**/*.e2e-spec.ts`). The API is ESM: **relative imports need `.js` extensions**.
- **e2e DB reset: `prisma migrate deploy` once per run + `TRUNCATE` per file** instead of `prisma migrate reset --force` — Prisma 7 refuses `migrate reset` when it detects an AI agent (needs explicit human consent). Deploy is non-destructive; `resetDb()` in `apps/api/test/helpers.ts` truncates every table and re-runs the base seed. Global setup refuses any DB URL not containing `/supun_test`.
- **Next.js 16 renamed `middleware` → `proxy`**: the auth redirect is `apps/web/src/proxy.ts` (exported `proxy()`).
- **pnpm 10.34.6 instead of the newest 12.x** — pnpm 12 is a 7-week-old major (Rust rewrite); 10.x is the maintained line that was installed and is proven with corepack.
- **ESLint 9.39.5 instead of 10.x** — `eslint-config-next` 16.4 pulls plugins (react, import, jsx-a11y) whose peer range stops at ESLint 9.
- **TypeScript 6.0.3 instead of 7.0** — typescript-eslint (<6.1) and the Nest CLI (~6.0) do not support TS 7 yet. tsup's d.ts build needs `ignoreDeprecations: '6.0'` (`packages/shared/tsup.config.ts`).
- `prisma.config.ts` lives at `apps/api/prisma.config.ts` (Prisma looks in the package root), not in `prisma/`. Its datasource URL falls back to `''` so `prisma generate` works without `DATABASE_URL` (Docker build).
- SeaweedFS runs as **`weed mini`** (single process: master+volume+filer+S3) via `docker/seaweedfs/entrypoint.sh`, which renders `/etc/seaweedfs/s3.json` from `S3_ACCESS_KEY`/`S3_SECRET_KEY` and passes `-s3.config`. Healthcheck: `GET :8333/healthz`.
- Gotenberg uses the slimmer `-chromium` variant (no LibreOffice; we only do HTML→PDF and embed fonts ourselves).
- Worker skill enum value is **`HELPER`** (the glossary said "HELPER/LABOURER"; the label is "Helper / labourer").
- Dates in the UI are always `14 Oct 2026` (en-GB format) in both languages, as the overview specifies.

### Decisions made (not specified by the plan)
- **Schema extras:** `User.usingDefaultPassword` (drives the "change the default password" banner; set false on change-password); `AuditLog.username` + `updatedAt`; `notes` on Project/Worker/Asset/PaymentCertificate/ClientPayment; `Notification.type` is a plain `String` (types defined in Step 5); `Worker.photoDocId → Document` and `Expense.receiptDocumentId → Document` are real FKs; `Asset.registrationNo` and `Worker.nic` are unique (nullable).
- Percentages are `Decimal(7,4)`; `Project.startDate`/`plannedEndDate` are required.
- `BackupRun`/`BackupRequest` map to tables **`backup_runs` / `backup_requests` with snake_case columns** (`started_at`, `finished_at`, `size_bytes`, `requested_at`, `picked_at`, …) so the Step 6 shell scripts can write plain SQL.
- Cascades only for child rows (budget lines, EOT, BOQ items/measurements, variations, certificates, client payments, bonds, document versions, purchase lines, payroll lines, recoveries); everything else is `Restrict` (soft delete is the norm).
- Prisma generator: `prisma-client`, output `apps/api/src/generated/prisma` (git-ignored; `build`/`typecheck` run `prisma generate`), `moduleFormat=esm`, `importFileExtension=js`. Import from `../generated/prisma/client.js`.
- **Settings values:** percentages / multipliers are decimal **strings** (`"8"`, `"1.5"`); integer settings are numbers; `reminders.daysBefore` is de-duplicated and sorted descending. `PATCH /settings/:key` **merges** the body over the current value then validates the whole value; unknown key → 404 `UNKNOWN_SETTING`.
- JSON money: the serializer turns every Prisma Decimal into a string with **2 dp, or 3 dp if the value has 3** (`decimalToJson`, `apps/api/src/common/money/money.ts`). BigInt → string.
- Login rate limit counts **failed** attempts only (10/min per IP; success resets). `trust proxy` = loopback/private ranges (requests come through the Next rewrite).
- Audit: `AuditInterceptor` writes the row **before** the response is sent (awaited), redacts keys matching `pass|secret|token|hash`, skips login/logout (`@SkipAudit()`), names entities via `@AuditEntity('Setting')` (fallback: singularised first URL segment) and can override the action (`@AuditAction('UPDATE')` on change-password).
- Error codes live in `packages/shared/src/errors.ts`; the web translates `errors.<CODE>`; form validation messages are codes translated from `errors.validation.<CODE>` (`useValidationMessage`).
- Sample seed: Step 1 only sets the sample company details, and **only on a brand-new DB** (when the base seed has just created the `company` setting) so the owner's edits are never overwritten on restart.
- Web: light theme only (`next-themes` not used), base font-size 17px, brand colours in `apps/web/src/app/globals.css` (`--primary` blue, `--brand-accent` amber, `--success`, `--warning`). `cacheComponents` is **off** (pages are dynamic; data is client-side via TanStack Query).
- `DataTable` (`apps/web/src/components/data-table/data-table.tsx`) is server-driven: the parent passes `data/total/page/pageSize/onPageChange/search/onSearchChange`; TanStack Table v9 (`useTable` + `tableFeatures({})`) only renders. Column type: `DataTableColumn<T>`.
- shadcn components import `cn` from `@/lib/utils`, which re-exports shadcn's official `cn` package. `input`/`textarea`/`select` were changed to `text-base` (no `md:text-sm`) for readability.
- Mac scripts: `scripts/start.command` (creates `.env` with `openssl rand -hex 24` secrets, `up -d --build`, waits, opens the browser), `stop.command` (`compose stop`, keeps data), `update.command` (`git pull --ff-only` + rebuild), `dev-up.sh`.

### Schema changes (migrations added in this step)
- `20261014170309_init`: the full data model from overview §6 (37 tables, 34 enums).
- `20261014170323_allocation_exclusion_constraints`: `btree_gist`, `worker_alloc_no_overlap` / `asset_alloc_no_overlap` (EXCLUDE … `tstzrange(startAt,endAt,'[)')` WHERE `status <> 'CANCELLED'`), `worker_alloc_range` / `asset_alloc_range` CHECK `endAt > startAt`.

### Gotchas / things the next step must know
- **Never `pkill -f` a pattern that also appears in your own shell command line** — it kills the shell running it.
- Prisma 7: `migrate dev` no longer runs `generate`; run `pnpm --filter @sc/api prisma generate` after schema edits. With the pg driver adapter, raw DB errors are found by `findPgCode()` (handles `meta.code`, `driverAdapterError.cause.originalCode`, nested `cause`). Overlap → 409 `ALLOCATION_OVERLAP` via the global filter, so services can just let the error bubble up.
- Do **not** run `prisma migrate reset` as an agent (blocked). To rebuild the dev DB, `docker compose -f docker-compose.dev.yml down -v` (project `supun-dev`) then `up -d --wait` and `pnpm --filter @sc/api db:deploy`.
- Next rewrites are resolved at **build time**: the web Docker build gets `API_INTERNAL_URL=http://api:4000` as a build arg; dev defaults to `http://localhost:4000`.
- Don't import constants from a `'use client'` module into a server component (you get a client reference) — see `apps/web/src/app/(app)/settings/settings-tabs.ts`.
- `react-hooks/set-state-in-effect` is an error in eslint-config-next 16: sync props→state with the "adjust state during render" pattern (see `settings-view.tsx`).
- next-intl: the locale comes from the `NEXT_LOCALE` cookie (`src/i18n/request.ts`); the toggle calls the `setLocale` server action then `router.refresh()`. Enum labels: `enums.<lowerCamelEnumName>.<VALUE>` — the parity test fails if any shared enum value has no label.
- Every new page under `src/app/(app)/` must render a `PageHeader` (it provides `data-testid="page-title"`, used by the Playwright visual spec).
- The web e2e specs need the full stack on :3000 (`docker compose up -d --build`); they change and restore the company phone and reminder days.
- Placeholder pages ("Coming soon"): daily, projects, schedule, workers, assets, purchases, suppliers, payroll, reports, documents — replace them in later steps. The dashboard shows placeholder cards (Step 5 fills them). The bell is a placeholder (Step 5).
- Not installed yet (add when needed): `@nestjs/schedule` (Step 5), `exceljs`, `handlebars`, `recharts`.

### Useful commands
- Verified from a clean clone: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r typecheck` all succeed.
- Install: `pnpm install` (root `postinstall` builds `packages/shared`)
- Dev infra: `pnpm dev:infra` (= `docker compose -f docker-compose.dev.yml up -d --wait`) → postgres `localhost:5433` (user/pass `supun`/`supun`, DBs `supun_dev`, `supun_test`), S3 `localhost:8334`, Gotenberg `localhost:3002`
- Dev DB: `pnpm --filter @sc/api db:deploy && pnpm --filter @sc/api db:seed`; new migration: `pnpm --filter @sc/api prisma migrate dev --name <name>` (add `--create-only` for raw SQL)
- Run: `pnpm dev` (API :4000 with `apps/api/.env`, web :3000); `.claude/launch.json` has `api` (built dist) and `web` configs
- Checks: `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r test` · `pnpm format:check`
- API e2e: `pnpm test:e2e:api` (needs dev infra)
- Full stack: `docker compose down -v && docker compose up -d --build --wait`; logs `docker compose logs api`
- Playwright: `pnpm --filter @sc/web exec playwright install chromium` once, then `pnpm test:e2e:web` (screenshots in `apps/web/e2e/screenshots/`)

### Test summary
- Unit: 144 passed (shared 21 · api 99 · web 24 — incl. i18n key parity, enum-label coverage, shared↔Prisma enum sync)
- API e2e: 36 passed (auth 10 · settings + audit 14 · allocation overlap 7 · storage 4 · health 1) against dev infra
- Playwright: 13 passed against the fresh Docker stack (auth 4 · i18n 2 · settings 5 · visual EN/SI at 1280 & 1440px 2)

### Unfinished / known issues (carry over)
- [ ] The company logo (`company.logoDocId`) has no UI yet — needs documents (Step 2).
- [ ] `DataTable`, `MoneyInput`, `DateInput`, `ConfirmDialog`, `StatusChip` exist but are not used by a real page yet (first users in Step 2).
- [ ] API node_modules in the image is ~420 MB (Prisma CLI is needed at runtime for `migrate deploy`); could be slimmed in Step 6.

### Needs human (cannot be done by the agent)
- Nothing for Step 1. (Real Google Drive credentials are a Step 6 item.)

## Step 2 — Master data & documents (2026-10-15)

**Result:** ✅ Done

### Versions pinned (added in this step)
- API: `busboy` 1.6.0 (+ `@types/busboy` 1.5.5), `@aws-sdk/lib-storage` 3.1151.0 (same version as client-s3). No web deps added (the `Switch` UI component was written by hand from radix-ui).

### Deviations from the plan
- **Placeholder files are generated without `pdf-lib`**: `apps/api/src/seed/files.ts` writes a minimal valid PDF (correct xref, unit-tested) and a PNG with `node:zlib` (`deflateSync` + `crc32`). No new dependency, nothing binary in git.
- **Commit message** is `feat(step-2): master data & documents` (the wording the orchestrating session asked for; the step file said "… and versioned documents").
- Clients have no nav item: they live at `/projects/clients` (button "Manage clients" on Projects) and in **Settings → Clients** (new settings tab `clients`); both render `ClientsManager`.
- `GET /documents/:id/download` (current version) was added next to the per-version download — meant for the company logo / worker photo later.
- `DELETE /workers/:id/rates/:rateId` was added (to remove a mistyped rate; the last rate can't be removed → 409 `CONFLICT`).

### Decisions made (not specified by the plan)
- **Codes**: `nextCode()` (`apps/api/src/common/codes/codes.ts`) = MAX of the numeric suffix for the prefix (regex, soft-deleted rows included, so codes are never reused) + 1; `withCodeRetry()` retries on a unique violation of `code`. **Project code year = the project's start-date year** (`PRJ-<start year>-NNN`), so the sample culvert is `PRJ-2025-001`. Widths: `W-0001`, `AST-001`, `SUP-001`; they grow past the width (`SUP-1000`).
- **Shared schema helpers** (`packages/shared/src/schemas/common.ts`): optional form fields accept `''`/`null` → stored as `null`; `undefined` stays `undefined` so PATCH never clears untouched fields. Never use `.default()` in create schemas (it would leak into `.partial()` updates) — defaults are applied in services. Zod 4 can't `.partial()` a refined object, so each entity has a plain `…Fields` object, then `create = fields.superRefine()`, `update = fields.partial().superRefine()`. The API re-checks merged dates on PATCH (`projectDateIssues`).
- Non-nullable numeric columns cleared in a PATCH fall back to defaults (contract value / advance → 0, retention → billing settings, dlpMonths → 12, currentMeter → 0).
- **Field-level server errors** use `details: [{ path, message }]` with an i18n validation code as `message`, also for 409s: `NIC_TAKEN`, `REG_NO_TAKEN`, `RATE_DATE_TAKEN` (code `DUPLICATE`), `NOT_FOUND` for an unknown clientId / supervisor (400 `VALIDATION_FAILED`). The web's `applyServerErrors` now applies field details for any error code.
- New error codes: `UNSUPPORTED_FILE_TYPE` (400), `FILE_TOO_LARGE` (413, `details.maxMb`), `FILE_REQUIRED` (400), `OWNER_NOT_FOUND` (400), `CLIENT_HAS_PROJECTS` (409 — a client with non-deleted projects can't be deleted).
- **NIC** is normalised (no spaces, upper-case V/X) before validation/storage; uniqueness is checked against all workers incl. soft-deleted ones (the DB index is global).
- **Asset registration numbers** are upper-cased; unique like NIC. `GET /assets` returns `nextExpiry` = earliest expiry of the current versions of the asset's non-deleted documents (the list's "Papers" badge is real, not a placeholder). `VEHICLE_CATEGORIES` (JCB, tipper, cab, tractor, bowser) switch "is a vehicle" on in the new-asset form.
- **Workers**: `POST /workers` takes the starting pay (`dailyRate` for DAILY / `monthlySalary` for PERMANENT required, `otHourlyRate` optional) and creates the first `WorkerRate` effective from `joinedDate`. `currentRate` in list/detail = rate in force **today (Asia/Colombo)**; future-dated rates show as "Upcoming". `WorkersService.getRateOn(workerId, 'YYYY-MM-DD')` (DB) + pure `pickRateOn(rates, day)` (`modules/workers/rates.ts`) for Steps 3–4. Soft-deleting a worker also sets `active=false`.
- **Budget**: `PUT /projects/:id/budget` body `{ lines: [{category, amount, notes?}] }` is the *full* set — categories left out are deleted. `GET /projects/:id/budget` also exists. Lines are returned in `BUDGET_CATEGORIES` order with `total`.
- **Documents**:
  - Multipart is parsed with busboy directly in `modules/documents/multipart.ts` (no multer). The file part must be named `file`; it is piped through a sha256/byte counter straight into `StorageService.uploadStream()` (lib-storage multipart, 5 MB parts) — never buffered. Type is decided by the **file extension** (`ALLOWED_FILE_TYPES` in shared; the stored/served Content-Type comes from that map, not from the browser). Size limit `MAX_UPLOAD_MB` (env, default 50) via busboy `fileSize`; over the limit the S3 upload is aborted and the object deleted.
  - Metadata fields are validated **after** the stream (field order doesn't matter); on any failure the stored object is deleted, so nothing half-created remains.
  - Storage key: `documents/{documentId}/v{versionNo}-{uuid}-{safeFileName}`; `safeFileName` keeps ASCII word chars (Sinhala names become `file.pdf` in the key; the real name stays in `fileName`).
  - Restore = S3 `CopyObject` to a new key + a new version with `restoredFromVersionNo` (new column). Downloads stream from S3 with `Content-Disposition` (ASCII fallback + RFC 5987 `filename*`), `nosniff`, `ETag` = sha256; `?inline=1` is honoured only for PDF / JPG / PNG / WEBP.
  - `GET /documents?expiring=N` = current version expires on or before today+N (so already-expired ones are included), sorted by expiry. `search` matches title, description, current file name **and owner name/code/registration no.** (ids looked up per owner table first). List items carry `ownerName`, `ownerCode`, `currentVersion` (without `storageKey`) and `versionCount`.
  - Owner must exist and not be deleted (COMPANY has `ownerId = null`). Soft delete keeps the files.
- **Expiry badge**: `expiryStatus()` in shared — red `EXPIRED` (before today), orange `SOON` (≤ 30 days, inclusive), green otherwise; uses today in Asia/Colombo.
- **Category suggestions**: `suggestedDocumentCategories(ownerType, {isVehicle})` / `orderedDocumentCategories()` in shared; the upload dialog lists suggested ones first.
- Audit entities: `Client`, `Project`, `ProjectBudget` (PUT budget), `Worker`, `WorkerRate`, `Asset`, `Supplier`, `Material`, `Document` (multipart bodies are not in `summary.body`; the audit row still has path/params/status).
- **Web patterns** (reuse them in later steps):
  - `hooks/use-resource.ts`: `useList / useDetail / useCreate / useUpdate / useRemove / useInvalidate` keyed by resource name (`queryKeys.list/detail/sub`); `hooks/use-list-state.ts` (page, debounced search, filters → back to page 1).
  - `components/forms/fields.tsx`: `TextField / NumberField / TextareaField / MoneyField / DateField / SelectField / SwitchField` (react-hook-form `useController`; values are strings). Destructure `{ ref, value, onChange, onBlur } = field` — the React-Compiler lint rule `react-hooks/refs` errors on `field.ref`/`field.value` access otherwise.
  - `forms/enum-select.tsx`: `EnumSelect`, `EnumFilter` (toolbar filter with an "All …" option), `useEnumLabel()`.
  - `EntityPicker` (searchable popover over any resource), `InfoList`, `EmptyState`, `DeleteButton` (confirm + toast), `detail-page.tsx` (`DetailState`, `DetailTabs`, `ComingSoonPanel`, `BackButton`, `EditButton`), `forms/form-card.tsx` (`FormSection`, `FormActions`).
  - `components/documents/*`: `DocumentPanel` (one owner), `DocumentTable` (`showOwner` for the global list), `UploadDocumentDialog`, `NewVersionDialog`, `HistorySheet`, `PreviewDialog`, `ExpiryBadge`, `FileDrop`. Uploads use XHR (`lib/upload.ts`) for a progress bar.
  - `DataTable.emptyMessage` accepts a node (EmptyState with an "Add" button); data cells are `whitespace-normal` (shadcn's default nowrap overflowed at 1280px) — add `whitespace-nowrap` to money/date/code cells explicitly.
  - Detail pages are client components that render their own `PageHeader` (loading/error states too). Tabs for later steps show `ComingSoonPanel`.
  - Dashboard "Upload document" → `/documents?upload=1` (opens the company upload dialog). `/documents?expiring=30` opens "All documents" pre-filtered (for Step 5 reminders).
  - Purchases page opens on the **Materials** tab (purchases/store tabs are placeholders until Step 3).

### Schema changes (migrations added in this step)
- `20261014215746_document_version_restored_from`: `DocumentVersion.restoredFromVersionNo INTEGER NULL`.

### Gotchas / things the next step must know
- **Next.js caps proxied request bodies at 10 MB when `src/proxy.ts` exists — even though its matcher excludes `/api`.** Uploads > 10 MB were cut and the API saw "Upload aborted". Fixed with `experimental.proxyClientMaxBodySize: '60mb'` and `experimental.proxyTimeout: 300_000` in `apps/web/next.config.ts`. Verified: a 21 MB file round-trips through :3000 with the same sha256. Keep it ≥ MAX_UPLOAD_MB + a little.
- The seed (`node dist/seed/index.js`) builds a `StorageService` from `new ConfigService(env)` and uploads ~60 placeholder files; the sample seed runs only when there are no projects. `seedSampleData(prisma, { fresh, storage?, today? })` — `today` makes it testable (`test/sample-data.e2e-spec.ts`).
- The sample seed sets `uploadedAt` of older versions to past days but all versions are uploaded "now" in S3.
- Running `next dev` rewrites `apps/web/next-env.d.ts`; `git checkout` it before committing.
- Port 3000 is shared by the Docker web and `pnpm dev` web: `docker compose stop web` before `preview_start web`.
- The browser pane / headless Chromium don't render PDFs inside the preview iframe (grey box); the request itself is 200 with `inline` disposition. Images preview fine.
- Playwright: Radix selects are picked with `selectOption(page, label, option)`; dates with `pickDate(page, label, date, monthsBack)` which clicks `button[data-day="dd/mm/yyyy"]` (en-GB test locale) — see `e2e/helpers.ts`. The visual spec now has a 300 s timeout (40+ screenshots).
- Not done here (carried over): company logo upload in Settings, worker photo (`photoDocId`) UI.

### Useful commands
- Same as Step 1. Seed sample data into the dev DB: `pnpm --filter @sc/api db:seed` (only when it has no projects).
- One e2e file: `pnpm --filter @sc/api exec vitest run --config ./vitest.config.e2e.ts test/documents.e2e-spec.ts`; one Playwright spec: `pnpm --filter @sc/web exec playwright test e2e/master-data.spec.ts`.

### Test summary
- Unit: 222 passed (shared 65 · api 127 · web 30)
- API e2e: 79 passed (Step 1: 36 · master data 26 · documents 10 · sample seed 7) against dev infra
- Playwright: 18 passed against a fresh `docker compose down -v && up -d --build --wait` stack (Step 1: 13 — `auth` "returns to the requested page" now expects the real Projects page instead of "Coming soon" · master data 5); screenshots EN/SI at 1280 & 1440 px for every list, form and detail page

### Unfinished / known issues (carry over)
- [ ] Company logo (`company.logoDocId`) and worker photo (`Worker.photoDocId`) still have no UI (the documents API is ready: upload as COMPANY / WORKER, then `GET /documents/:id/download?inline=1`).
- [ ] Supplier "Statement", project tabs (BOQ, bills, variations, bonds, costs, team), worker attendance/advances/payslips, asset usage/maintenance/bookings are `ComingSoonPanel` placeholders (Steps 3–4).
- [ ] Soft-deleted workers/assets still hold their NIC / registration number (global unique index) — re-adding the same person gives `NIC_TAKEN`; restore/undelete UI could come in Step 6.
- [ ] API node_modules size (from Step 1).

### Needs human (cannot be done by the agent)
- Nothing for Step 2.

## Step 3 — Daily operations (2026-10-15)

**Result:** ✅ Done

### Versions pinned
- No new dependencies (API or web).

### Deviations from the plan
- **No schema change / no migration** — the Step 1 model already had everything (allocations, attendance, usage, maintenance, purchases, issues, supplier payments, advances).
- **`PATCH /allocations/:id` / `POST /allocations/:id/cancel`** look the id up in `WorkerAllocation` first, then `AssetAllocation` (ids are UUIDs, no kind in the URL).
- **Hours from meters only for HOURS meters.** For KM meters `endMeter − startMeter` is the distance (km) and `hoursUsed` is typed (or 0); NONE meters type the hours. Shared helper `usageFromMeters()` / `subtractQty()` (exact, no floats) in `packages/shared/src/schemas/operations.ts`, used by API and the Daily Entry form.
- **"Copy from yesterday"** = the most recent earlier day (within 31 days) that has attendance for this project (not strictly "yesterday"; Sundays/holidays have none). Button label "Copy from last day".
- **Daily Entry offers LEAVE** as a 4th status button (needed for permanent staff); the step file listed Present/Half/Absent.
- Documents page (Step 2) tweaks to fit 1280px in Sinhala: the all-owners list no longer shows the "Uploaded" column, file names cap at `max-w-52`, version label and expiry badge may wrap (`ExpiryBadge wrap`).
- `DeleteButton` got `iconOnly`; `EntityPicker` shrinks in grid cells (`min-w-0 flex-1`) and its search box has `data-testid="picker-search"`.

### Decisions made (not specified by the plan)
- **Time:** Asia/Colombo is a fixed +05:30 (no DST) → `packages/shared/src/time.ts`: `colomboInstant(day,'HH:mm')`, `colomboDay`, `colomboTime`, `colomboDayRange`, `shiftDay`, `daysBetween`, `mondayOf`, `monthRange`, `DEFAULT_WORK_START/END` (08:00/17:00). Times in the API/UI are "HH:mm"; `endTime > startTime` (no overnight bookings).
- **Allocations API:** `POST /allocations/workers` `{workerIds[], projectId, fromDate, toDate?, startTime, endTime, skipSundays?, notes}` (assets: `assetIds[]`, `operatorWorkerId?`) → one row per day per resource, max 62 days. Conflicts are looked up **before** inserting (so all are listed), inserted with `createManyAndReturn` in a transaction; a racing 23P01 re-runs the lookup. 409 `ALLOCATION_OVERLAP` `details.conflicts: AllocationConflict[]` (resource name/code, project, existing start/end, requested start/end). Pure calcs: `modules/allocations/calc/slots.ts` (`buildSlots`, `overlaps`, `findConflicts`). `GET /allocations?kind=&from=&to=` (days, Colombo; `includeCancelled=true` optional) returns a plain array. `GET /allocations/availability?kind=&fromDate=&toDate=&startTime=&endTime=&skipSundays=` → `{free, busy:[{…, projects[]}]}` (active workers / not-disposed assets).
- **Daily Entry API:** `GET /daily-entry?date&projectId` → `{date, project, locked, workers[], usage[], expenses[]}`; rows = planned (allocation overlapping that Colombo day) ∪ already recorded. `PUT /daily-entry` is the **full set** for that project+day: attendance upserted by (worker, day), rows left out deleted; usage logs/expenses updated by `id`, new ones created, missing ones deleted. All in one transaction (`timeout 30s`). Row errors use paths like `expenses.1.supplierId`. Attendance already at **another non-null project** that day → 409 `ATTENDANCE_EXISTS_OTHER_PROJECT` `details.conflicts[{workerName, projectName…}]`; attendance with `projectId = null` is simply taken over. `asset.currentMeter = max(current, endMeter)` (never goes back). `GET /attendance?workerId|projectId&from&to` → `{items, summary}`.
- **Payroll lock:** `common/payroll/payroll-lock.ts` (`lockedMonths`, `assertNotLocked`) — a FINALIZED `PayrollRun` for the month → 409 `PAYROLL_LOCKED`; `GET /daily-entry` returns `locked`. Step 4 must call `assertNotLocked` from any other attendance-editing path.
- **Expenses:** `/expenses` CRUD (hard delete — not master data; audit log keeps the trace), list has `totalAmount`; CREDIT needs a supplier (`SUPPLIER_REQUIRED_FOR_CREDIT`). Receipts = documents (ownerType PROJECT, or COMPANY when no project; category RECEIPT) uploaded by `components/daily/receipt-button.tsx`.
- **Assets:** `GET /assets/:id/usage` (paginated + `totals`), `GET /assets/:id/service-status` (`calc/service-status.ts`: used = current − last service; OVERDUE ≥ interval, DUE_SOON ≥ 90%, NOT_TRACKED without meter/interval/last service), `/assets/:id/maintenance` CRUD. A SERVICE record sets `lastServiceMeter` (reading, or current meter); a reading above the meter moves the meter forward; editing/deleting a SERVICE record recomputes from the latest remaining SERVICE record (left unchanged if none).
- **Purchases & store:** `/purchases` CRUD (PATCH with `lines` replaces all lines); line amount = round(qty × price) and total computed server-side (`calc/stock.ts`). `GET /store/stock` (`purchasedQty, issuedQty, stock, averageCost, value`, `totalValue`), `GET/POST /store/issues`, `DELETE /store/issues/:id` ("undo"). **Average cost** = Σamount/Σqty of store purchase lines (all-time for the stock value; up to the issue date for an issue's `unitCost`, falling back to all-time). Stock changes are serialised with `pg_advisory_xact_lock(hashtext(materialId))`. Over-issue → 409 `INSUFFICIENT_STOCK` `details.available`; editing/deleting a store purchase that would leave negative stock → same 409.
- **Suppliers:** `GET /suppliers` items carry `balance`; `GET /suppliers/balances`; `GET /suppliers/:id/statement?from&to` (`calc/balance.ts` `buildStatement`: opening balance from earlier items, same-day order purchase → expense → payment, running balance); `POST/DELETE /suppliers/:id/payments`. Only CREDIT purchases and CREDIT expenses count.
- **Advances:** `GET /advances?status&workerId` (+`totalBalance`), `GET/POST /workers/:id/advances`, `PATCH/DELETE …/:advanceId` only while there are no recoveries (409 `ADVANCE_HAS_RECOVERIES`). `recovered`/`balance` come from `AdvanceRecovery` rows (Step 4 creates them). `recoveryPerMonth` empty = recover all at once; must be ≤ amount.
- New error codes: `ATTENDANCE_EXISTS_OTHER_PROJECT`, `ADVANCE_HAS_RECOVERIES`. New validation codes: `INVALID_TIME, END_TIME_BEFORE_START, RANGE_TOO_LONG, TOO_MANY, DUPLICATE_WORKER, END_METER_BEFORE_START, SUPPLIER_REQUIRED_FOR_CREDIT, NO_LINES, RECOVERY_MORE_THAN_AMOUNT, PICK_SOMEONE`.
- Audit entities: `WorkerAllocation`, `AssetAllocation`, `Allocation` (patch/cancel), `DailyEntry`, `Expense`, `MaintenanceRecord`, `Purchase`, `MaterialIssue`, `SupplierPayment`, `Advance`.
- **Web:**
  - `/schedule` (`components/schedule/*`): week grid, Workers | Machines toggle, skill/category filter, project colours (`lib/project-colors.ts`, hash of project id), click empty cell → `AllocationDialog`, click block → edit/cancel, "Assign team/machines" → `AssignDialog` (availability list with Busy/Free), overlaps → `ConflictDialog` (`overlapConflicts(err)`).
  - `/daily` (`components/daily/daily-entry-view.tsx`): date + project in the URL (`?date=&project=`), last project remembered in localStorage (`daily.projectId`, try/catch). The form is plain React state; after a save the parent bumps a `version` key so the form restarts from the saved data. Sticky save bar (`lg:left-64` = sidebar width), unsaved warning + `beforeunload`. A usage row is only sent when it has an id or any of end meter / hours / fuel; an attendance row only with a status.
  - `/daily/expenses` (sidebar sub-item: `NavItem.sub`, Daily Entry uses `exact`), also the Project → Costs tab (`ExpensesList projectId`). Dashboard "Add expense" → `/daily/expenses?add=1`.
  - Project → Team & Machines (`projects/project-team.tsx`), Worker → Attendance calendar / Advances, Asset → Usage / Service & repairs (with service badge, also in the asset header) / Bookings, Supplier → Statement + Add payment, list "We owe" column, Purchases & Store tabs `purchases | store | issues | materials` (default now `purchases`), Payroll page = notice + open advances.
  - `hooks/use-resource.ts`: new resources + `useApi(resource, path, params)` for non-list endpoints (invalidated with the resource name).
- **Sample data** (`apps/api/src/seed/sample-operations.ts`, deterministic PRNG seeded by `today`): teams per ONGOING project (road / school / house), allocations Mon–Sat for the last 60 days **and the next 7 days**, JCB 2 (AST-002) at the road in the morning and the house in the afternoon on Mon/Wed/Fri, driver W-0024 splits on Saturdays; attendance up to **yesterday** (none today, so Daily Entry is ready to try) with ~6% half days, absences, leave for permanent staff, ~22% OT; usage logs whose meters end exactly at each asset's current meter; service states vary (JCB 1 / Tipper 1 due soon, roller overdue); ~145 expenses (weekly credit machine hire and electrical subcontract, double-cab petrol on credit), 6 with receipt PDFs; 25 purchases, 17 store issues (never more than in stock), 12 supplier payments (balances ≥ 0), 8 open advances, maintenance records. `seedSampleData` now also returns supplier and material ids.

### Schema changes (migrations added in this step)
- None.

### Gotchas / things the next step must know
- Payroll (Step 4): attendance is written only by `PUT /daily-entry`; add `assertNotLocked()` to anything else that writes attendance, and set `Attendance.payrollRunId` on finalize. The sample has **no** payroll runs yet and no advance recoveries — Step 4 must add "one finalized month + current month draft" to the seed (the overview's sample spec).
- Costing (Step 4): fuel cost lives on usage logs (`fuelCost`); FUEL expenses are separate (e.g. double-cab petrol, `projectId = null`). Equipment for KM vehicles = days × `internalRatePerDay`; `hoursUsed` on KM logs is typed working hours, not distance.
- shadcn `TableCell`/`TableHead` are `whitespace-nowrap`; in narrow tables add `whitespace-normal`. The visual spec now also fails on **clipped tables** (`[data-slot=table-container]` wider than its box).
- Seeded projects get today's allocations; Playwright flows create their own project/workers/material (stamped names) via `page.request` so they never clash with seeded bookings. Pickers: use `getByTestId('picker-search')` (placeholder is translated).
- Next dev: the API preview (`.claude/launch.json` "api") runs the **built** dist — rebuild + restart after API changes.

### Useful commands
- One spec: `pnpm --filter @sc/api exec vitest run --config ./vitest.config.e2e.ts test/daily-operations.e2e-spec.ts` · `pnpm --filter @sc/web exec playwright test e2e/daily-operations.spec.ts`
- Rebuild only the web container: `docker compose up -d --build --wait web`
- Reset dev DB with fresh sample data: `docker compose -f docker-compose.dev.yml down -v && pnpm dev:infra && pnpm --filter @sc/api db:deploy && pnpm --filter @sc/api db:seed`

### Test summary
- Unit: 281 passed (shared 87 · api 164 · web 30) — new: Colombo time helpers, meters/hours, step-3 schemas, slots/overlap, service status, weighted average/stock, supplier balance/statement
- API e2e: 100 passed (Step 1–2: 79 · daily operations 20 · sample seed +1)
- Playwright: 24 passed against a fresh `docker compose down -v && up -d --build --wait` stack (earlier 18 · daily operations 6: schedule bulk assign + overlap dialog, Daily Entry save/reload with receipt, purchase → store → issue, supplier statement + payment, Sinhala smoke); visual spec covers every new page and **every detail tab** in EN/SI at 1280/1440 px

### Unfinished / known issues (carry over)
- [ ] Schedule rows come from `GET /workers|/assets?pageSize=100` (enough for this business; paging needed beyond 100).
- [ ] Changing date/project in Daily Entry with unsaved edits discards them silently (only page unload warns).
- [ ] Carried from Step 2: company logo / worker photo UI, NIC re-use after soft delete, API image size.

### Needs human (cannot be done by the agent)
- Nothing for Step 3.


## Step 4 — Money (2026-10-15)

**Result:** ✅ Done

### Versions pinned (added in this step)
- API: `exceljs` **4.4.0** (BOQ import from .xlsx now; Step 5 reuses it for Excel reports). No web deps added.

### Deviations from the plan
- **BOQ import is two calls**: `POST /projects/:id/boq/import/preview` (multipart, field `file`, `.csv` or `.xlsx`, ≤ 5 MB, read into memory by `common/upload/read-small-file.ts`) → `{rows, validCount, errorCount, total}` with per-field validation codes; then `POST /projects/:id/boq/import` `{rows, replace?}` with the confirmed rows (JSON). A header row is optional (columns matched by name: Item No / Description / Unit / Qty|Quantity / Rate, else by position); heading rows (no unit, qty and rate) and blank rows are skipped; "Rs." and thousands separators are stripped. `replace: true` is refused with 409 `BOQ_HAS_PROGRESS` once any measurement exists. The JSON body limit was raised to 2 MB (`app.setup.ts`, `useBodyParser('json', { limit: '2mb' })`).
- **"Record progress" for several items** = `POST /projects/:id/progress {date, items:[{boqItemId, cumulativeQty}], notes?}` (all-or-nothing) in addition to the per-item `POST /boq/:itemId/measurements`. A measurement on the same date is replaced (unique `(boqItemId, date)`).
- **Payroll line editing is a dialog** (pencil next to the worker's name) instead of inline cells — the 10-column salary sheet only fits 1280 px (also in Sinhala) that way. Half days are no longer shown under the day count (days already show .5).
- **Audit actions**: finalize/reopen are logged as `UPDATE` on `PayrollRun` (the `AuditAction` enum only has CREATE/UPDATE/DELETE; the path tells which).
- Sample data (Step 2/3 values changed for the Step 4 story): school budget EQUIPMENT 1.6 M → **4.8 M**, house manual progress 45 % → **50 %**; `test/sample-data.e2e-spec.ts` now expects **39** purchases (14 earlier cash purchases added) and **7** open advances (one fully recovered by last month's payroll).

### Decisions made (not specified by the plan)
- **Payroll calculator** (`modules/payroll/calc/payroll.calculator.ts`):
  - OT is only paid on PRESENT / HALF_DAY days. A day without a rate pays 0 and sets `missingRate`.
  - PERMANENT: the salary is the rate in force on the month's last day (or the leaving day). **Joining / leaving mid-month**: the Mon–Sat days of the month before `joinedDate` / after `leftDate` are added to the no-pay days (same per-day rate as absences). Basic never goes below 0.
  - Rounding: daily basic and OT are summed exactly and rounded once; EPF 8 / EPF 12 / ETF 3 are each rounded half-up to 2 dp on the rounded basic.
  - **Advances**: due = each open advance's `recoveryPerMonth` (or its whole balance), capped at its balance; the deduction is capped so net ≥ 0 (room = gross − EPF 8 % − other deductions). Allocation to advances: instalments first (oldest advance first), then — if more is deducted — the remaining balances oldest first (`allocateAdvanceDeduction`). An edited deduction may exceed the instalments but not the total open balance (400 `DEDUCTION_MORE_THAN_BALANCE`); net < 0 → 400 `NET_BELOW_ZERO`.
  - **Breakdown** (`PayrollLine.breakdown` = `[{projectId|null, days, otHours, cost}]`): DAILY → cost = pay of those days (Σ = gross); PERMANENT → gross + EPF 12 % + ETF 3 % split by attendance days (PRESENT 1 / HALF 0.5); days without a project → `projectId: null` (overhead); no attendance at all → one overhead entry. Rounding differences go to the biggest entry so Σ cost is exact.
- **Payroll API** (`modules/payroll`): `GET /payroll/runs?year=&month=` (summaries + totals), `POST /payroll/runs {year, month}` (create or regenerate the DRAFT; manually entered *other deductions + note* are kept, advance deductions recalculated), `GET /payroll/runs/:id` (lines + totals incl. `employerCost`, `stale`, `canReopen`), `PATCH /payroll/runs/:id/lines/:lineId`, `POST …/finalize`, `POST …/reopen`, `GET /workers/:id/payslips`. Lines: every worker with attendance in the month + every active, non-deleted PERMANENT worker employed that month; DAILY workers with gross 0 get no line.
  - **Stale drafts**: `PayrollRun.sourceHash` = sha256 of the month's attendance + all pay rates + open advances (≤ month end) at generation. `GET` reports `stale: true` when it changed; `finalize` → 409 **`PAYROLL_STALE`** ("Calculate again" first).
  - Finalize (one transaction): attendance of the month gets `payrollRunId`, `AdvanceRecovery` rows are created, advances whose balance reaches 0 become RECOVERED, status FINALIZED. Attendance edits are then 409 `PAYROLL_LOCKED` (the Step 3 check). Reopen only the latest FINALIZED month (409 `PAYROLL_REOPEN_NOT_LATEST`), reverses recoveries (advances → OPEN), clears `payrollRunId`. Regenerating/editing a finalized month → 409 `PAYROLL_NOT_DRAFT`.
  - Known limit: a DRAFT for month M does not see deductions of an earlier month that is still a DRAFT (balances come from finalized recoveries only).
- **Costing** (`modules/costing/calc/costing.ts`, `health.ts`):
  - Expense → budget category: FUEL, EQUIPMENT_HIRE, REPAIRS → EQUIPMENT; SUBCONTRACT → SUBCONTRACT; UTILITIES, OFFICE, PERMITS_FEES → OVERHEAD; TRANSPORT, MEALS, SMALL_TOOLS, OTHER → OTHER (`EXPENSE_TO_BUDGET`). Maintenance records are not project costs.
  - LABOUR is one entry per worker. Days in a FINALIZED month use that line's breakdown cost for the project spread evenly over its project days (exact for whole months); other days are estimated (DAILY: rate + OT; PERMANENT: salary / workingDaysPerMonth × 1.15 (EPF 12 + ETF 3) + OT) and flagged `estimated`.
  - EQUIPMENT per usage log: hours × `internalRatePerHour`, else one day × `internalRatePerDay` (no hourly rate), plus `fuelCost` as its own entry, plus the mapped expenses.
  - `GET /projects/:id/costs?from&to&category&page&pageSize` → `byCategory` (all 6, with budget/actual/variance/pct/estimated/count), `total`, `estimated`, `entries` (paginated, for `category`, default LABOUR). Category totals are Σ of the rounded entries (e2e checks this).
  - Health: time % = (today − start) / (current end − start), clamped, COMPLETED = 100; budget % = all-time actual / total budget (null without a budget); physical % = BOQ (as of today) else manual `progressPct` else 0 (`physicalSource` BOQ/MANUAL/NONE). Flags use `> 15` points (`HEALTH_FLAG_THRESHOLD`); COMPLETED projects are never BEHIND_SCHEDULE. `GET /projects/:id/health`, `GET /projects/health` (= not COMPLETED/CANCELLED; routes live in `ProjectsController`, `health` declared before `:id`).
- **BOQ progress**: items of a variation that is not APPROVED are listed but `excluded` from totals and from IPC work done. Out-of-order measurements (below an earlier / above a later one) → 409 `MEASUREMENT_OUT_OF_ORDER` `details.items`; above the BOQ quantity is allowed with `warnings: ['OVER_QUANTITY']`. Items with measurements cannot be deleted (409 `BOQ_HAS_PROGRESS`); a variation with BOQ items cannot be deleted (409 `CONFLICT`).
- **Variations / EOT**: variation numbers are per project (max + 1). Effective contract value = contract value + Σ APPROVED `amountChange`. EOT: `previousEndDate` = the project's current end at creation; after every EOT create/update/delete the project's `revisedEndDate` = the latest EOT's `newEndDate` (by approvedDate, then createdAt) or null. All recorded EOTs count as approved.
- **IPC** (`modules/billing/calc/ipc.calculator.ts`):
  - `previousCertified` = Σ gross of all earlier bills (= the previous cumulative). **Retention cap = effective contract value (incl. approved variations) × retentionCapPct** (the glossary defines contract value that way). Retention / advance recovery are never negative (a negative gross deducts nothing).
  - One DRAFT at a time (409 `DRAFT_BILL_EXISTS`); `periodTo` must be after the previous bill's (400 `BEFORE_PREVIOUS_BILL`); `periodFrom` defaults to the previous `periodTo` + 1 (or project start). `PATCH` only for DRAFT (409 `CERTIFICATE_NOT_DRAFT`): `cumulativeWorkDone` value = manual override, `''`/null = back to measured, omitted = keep. `POST …/certificates/preview` = the wizard's calculation without saving.
  - Status: DRAFT → SUBMITTED → CERTIFIED → PAID, plus SUBMITTED → DRAFT for the latest bill without payments (`CERTIFICATE_TRANSITIONS` in shared). PAID needs Σ IPC payments linked to the bill ≥ net (409 `CERTIFICATE_NOT_PAID_IN_FULL`); deleting a payment that leaves a PAID bill short moves it back to CERTIFIED. Payments cannot point at a DRAFT bill (400 `BILL_NOT_SUBMITTED`).
  - Finance summary: receivable = Σ net of SUBMITTED/CERTIFIED/**PAID** bills − Σ IPC payments (PAID included so its payments cancel out); retention held = Σ retention of those bills − Σ RETENTION_RELEASE; advance recovered = Σ advanceRecovered of those bills; `advanceReceived` = Σ ADVANCE payments. Bill code `IPC-<project code>-NN` is computed (`certificateCode`), not stored.
- **Bonds**: `/projects/:id/bonds` CRUD, `GET /bonds?expiringWithin=N&status=` (ACTIVE expiring ≤ today + N, expired included). Bond copies are PROJECT documents with category BOND_COPY; `DocumentPanel` got a `category` prop (filters the list and pre-selects the upload category) used on the Bonds tab.
- New error codes: `PAYROLL_NOT_DRAFT, PAYROLL_STALE, PAYROLL_REOPEN_NOT_LATEST, BOQ_HAS_PROGRESS, MEASUREMENT_OUT_OF_ORDER, DRAFT_BILL_EXISTS, CERTIFICATE_NOT_DRAFT, CERTIFICATE_STATUS_INVALID, CERTIFICATE_NOT_PAID_IN_FULL, CERTIFICATE_HAS_PAYMENTS, IMPORT_FILE_INVALID`. New validation codes: `DEDUCTION_MORE_THAN_BALANCE, NET_BELOW_ZERO, BEFORE_PREVIOUS_BILL, BILL_NOT_SUBMITTED` (+ `NOT_FOUND`, `DUPLICATE` labels under `errors.validation`).
- Audit entities: `PayrollRun`, `PayrollLine`, `BoqItem`, `BoqMeasurement`, `Variation`, `ExtensionOfTime`, `PaymentCertificate`, `ClientPayment`, `Bond`. Previews (BOQ import, bill) are `@SkipAudit()`.
- Shared: `packages/shared/src/schemas/payroll.ts`, `finance.ts` (schemas + DTO types + `HEALTH_FLAGS`, `CERTIFICATE_TRANSITIONS`, `BOQ_IMPORT_COLUMNS`). `common/projects/require-project.ts` (`requireProject`, `fieldError`) for the new services.
- **Web**:
  - `/payroll` (`components/payroll/payroll-view.tsx`): month arrows, Calculate / Calculate again / Finalize / Open again (ConfirmDialogs), stale warning, salary sheet with totals footer, employer-cost card (gross, EPF 12 %, ETF 3 %, total), disabled PDF/Excel buttons (Step 5), open advances below. Worker → Payslips tab (`payslips-panel.tsx`).
  - Project tabs: Overview → `ProjectHealthPanel` (`ProgressTriple` + `HealthFlags` in `components/progress-triple.tsx`, budget-vs-actual table, manual progress slider for PRIVATE projects without a BOQ); BOQ & progress (`project-boq.tsx`: grid with per-item bars, add/edit item, import preview dialog, record-progress dialog, measurement history); Bills & payments (`project-bills.tsx`: summary cards, bills table with next-status buttons, "New bill" wizard with `CalculationSteps`, payment dialog); Variations & time (`project-variations.tsx`); Bonds (`project-bonds.tsx`); Costs (`project-costs.tsx`: date range, category cards, paginated entries, the Step 3 expenses list below).
  - `components/forms/dialog-form.tsx`: `useDialogForm` (plain state + server field errors) and `DialogButtons`. **`FormField` translates error codes itself — pass the raw code as `error.message`, never a translated string** (otherwise it shows "Please check this value").
  - All project finance queries are cached under the `projects` resource (`useApi('projects', …)`), so `invalidate('projects')` refreshes every tab; payroll uses the new `payroll` resource.
- **Sample data** (`seed/sample-finance.ts`, runs after `seedOperations`, uses the real `BoqService` / `BillingService` / `PayrollService` so numbers match the app): BOQs — road 25 items + 2 items of approved variation V1 (extra pipe culvert), school 35, culvert 12 (fully measured), drain 9; BOQ totals equal the contract values (provisional-sum item absorbs rounding). Drain: pending variation + **one EOT** (on hold, end moved to +150 days). Bills: road IPC-01 PAID, IPC-02 CERTIFIED (unpaid → receivable), school IPC-01 SUBMITTED, culvert 3 bills PAID with half the retention released. Mobilization advances paid for road and school (road partly recovered). Bonds: road performance bond expiring in **20 days** (+ its copy as a BOND_COPY document) and an advance payment guarantee, school released bid bond + performance bond, drain performance bond. 14 cash purchases + 18 expenses dated **before** the 60-day history (road, drain, culvert) so the story is: road healthy (~52 % done / ~50 % spent), **school BEHIND_SCHEDULE**, **drain OVER_BUDGET** (+ cost ahead of progress), house healthy. **Last month FINALIZED** (25 lines, recovers part of the advances); the current month is left for the owner to calculate.

### Schema changes (migrations added in this step)
- `20261015151831_payroll_note_and_source_hash`: `PayrollLine.otherDeductionsNote TEXT NULL`, `PayrollRun.generatedAt TIMESTAMPTZ NULL`, `PayrollRun.sourceHash TEXT NULL`.

### Gotchas / things the next step must know
- Dashboard (Step 5): use `GET /projects/health` (active projects with bars + flags) and `GET /projects/:id/finance-summary` (receivable) — "Money to receive" = Σ `receivable`. "Spent this month" can reuse `CostingService.compute(project, from, to)`.
- Reminders (Step 5): `GET /bonds?expiringWithin=N` already exists; bond copies are PROJECT documents with category BOND_COPY and their own expiry.
- Reports (Step 5): payroll totals/lines from `GET /payroll/runs/:id`; payslips from `GET /workers/:id/payslips`; IPC printout from `GET /projects/:id/certificates/:certId` (`calculation` has every step). The disabled "Payslips (PDF)" / "Salary sheet (Excel)" buttons on `/payroll` are placeholders to wire up.
- The salary sheet is exactly as wide as the 1280 px content area in Sinhala — adding a column needs another layout (e.g. move a column into a sub-line).
- `TableCell` in a `TableFooter` is `whitespace-nowrap` by default: a long footer label widens the whole first column.
- Nest DI does not work under `tsx` (no decorator metadata) — to run a quick script that needs services, `pnpm --filter @sc/api build` and run it from `dist/`.
- The web Docker build needs internet: `next/font/google` downloads Noto Sans / Noto Sans Sinhala at build time (a network outage fails `pnpm --filter @sc/web build` inside Docker with "Error while requesting resource"; just retry).
- Running the seed's finance part needs `today`; tests pin `TODAY = '2026-10-15'` and assert the story flags at that date (time % grows by about 0.4 points a day for the school, so the flags are only guaranteed on the seed day ± a few days).

### Useful commands
- One API e2e file: `pnpm --filter @sc/api exec vitest run --config ./vitest.config.e2e.ts test/money.e2e-spec.ts`
- One Playwright spec: `pnpm --filter @sc/web exec playwright test e2e/money.spec.ts`
- Calculator tests only: `pnpm --filter @sc/api exec vitest run src/modules/payroll src/modules/costing src/modules/boq src/modules/billing`

### Test summary
- Unit: 380 passed (shared 87 · api 263 · web 30) — new: payroll calculator 34, IPC + finance summary 12, BOQ progress + measurements 20, BOQ import (CSV/XLSX) 6, costing + health 27
- API e2e: 115 passed (Steps 1–3: 100 · money 14 · sample seed +1 step-4 story test)
- Playwright: 28 passed against a fresh `docker compose down -v && up -d --build --wait` stack (Steps 1–3: 24 · money 4: payroll deduction edit, BOQ CSV import → record progress → new bill with the calculation checked → submit/certify → part payment lowers "money to receive", Sinhala payroll smoke). The visual spec now also opens the sample **road** project (typed into the list search — the list does not read `?search=` from the URL) so every Step 4 tab is checked in EN/SI at 1280/1440 px.

### Unfinished / known issues (carry over)
- [ ] Payroll exports (payslips PDF, salary sheet Excel, EPF/ETF summary) — buttons are disabled placeholders until Step 5.
- [ ] A draft for a month does not account for advance deductions of an earlier month that is still a draft (only finalized recoveries reduce balances).
- [ ] Carried from Steps 2–3: company logo / worker photo UI, NIC re-use after soft delete, schedule rows capped at 100, Daily Entry date change with unsaved edits, API image size.

### Needs human (cannot be done by the agent)
- Nothing for Step 4.
