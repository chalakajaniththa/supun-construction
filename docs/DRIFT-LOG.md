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
| 3 — Daily operations | ⬜ Not started | | |
| 4 — Money | ⬜ Not started | | |
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
