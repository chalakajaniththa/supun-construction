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
| 2 — Master data & documents | ⬜ Not started | | |
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
