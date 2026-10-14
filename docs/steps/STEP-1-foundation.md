# Step 1 — Foundation

**Goal:** A running, tested skeleton that every later step builds on: the monorepo, all Docker services,
the **complete** database schema, auth, i18n (EN/SI), the app shell, settings, the audit log, the storage
service, the test harness and the base seed. After this step the owner can log in, switch language,
see an empty dashboard shell and change settings and password.

## Read first
- `docs/00-OVERVIEW.md` — all of it (this step sets up everything it describes).
- `docs/DRIFT-LOG.md` — should be empty apart from the template.
- Codebase: the repo is empty apart from `docs/`. Run `ls -la` to confirm.

## Tasks

### 1.1 Repo & tooling
- `git init` (if not already a repo). Add `.gitignore` (node_modules, dist, .next, .env, coverage, playwright artefacts, `apps/web/e2e/screenshots`), `.editorconfig`, `.nvmrc` (24), and root `package.json` with `packageManager: pnpm@<current>`.
- `pnpm-workspace.yaml`: `apps/*`, `packages/*`.
- Check current stable versions with `npm view` (next, @nestjs/core, prisma, next-intl, @tanstack/react-query, tailwindcss, zod, playwright, …) and **pin exact versions**. Record them in the drift log under "Versions".
- Root scripts: `dev` (dev infra + api + web in parallel), `build`, `typecheck`, `lint`, `test`, `test:e2e:api`, `test:e2e:web`, `format`.
- Shared ESLint (flat config) + Prettier.

### 1.2 `packages/shared`
- `enums.ts`: every enum from the data model, as `as const` arrays + zod enums + TS types.
- `schemas/`: zod schemas for auth (login, change password), settings, and a pagination query. Later steps add more.
- `money.ts`: helpers to validate decimal strings (`^-?\d+(\.\d{1,2})?$`), quantities (3 dp).
- Build with **tsup** (ESM + CJS + d.ts). Both apps depend on `@sc/shared: workspace:*`.

### 1.3 API (`apps/api`) — NestJS
- Scaffold with Nest CLI conventions (no sample controllers left over). Config via `@nestjs/config` + a zod-validated env schema: `DATABASE_URL, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, GOTENBERG_URL, SEED_SAMPLE_DATA, TZ=Asia/Colombo`.
- **Prisma 7**: `prisma.config.ts`, `@prisma/adapter-pg`, a `PrismaService` (global module).
- **Implement the FULL schema from overview §6** in `schema.prisma` (all models, enums, relations, indexes, unique constraints, `@db.Decimal(14,2)`/`(14,3)`, `@db.Date` for calendar days, `@db.Timestamptz` for allocations).
- Initial migration, then a second migration via `--create-only` with raw SQL:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE "WorkerAllocation" ADD CONSTRAINT worker_alloc_no_overlap
    EXCLUDE USING gist ("workerId" WITH =, tstzrange("startAt","endAt",'[)') WITH &&)
    WHERE (status <> 'CANCELLED');
  ALTER TABLE "AssetAllocation" ADD CONSTRAINT asset_alloc_no_overlap
    EXCLUDE USING gist ("assetId" WITH =, tstzrange("startAt","endAt",'[)') WITH &&)
    WHERE (status <> 'CANCELLED');
  ALTER TABLE "WorkerAllocation" ADD CONSTRAINT worker_alloc_range CHECK ("endAt" > "startAt");
  ALTER TABLE "AssetAllocation" ADD CONSTRAINT asset_alloc_range CHECK ("endAt" > "startAt");
  ```
  (Adjust the table and column names to whatever Prisma actually generates.) Add a test proving that an overlapping insert fails with `23P01`, and that back-to-back allocations (10:00–12:00, 12:00–14:00) are allowed.
- `common/`:
  - `ZodValidationPipe`, a global exception filter producing `{statusCode, message, code, details}`, a Prisma error mapper (P2002 → 409 `DUPLICATE`, P2025 → 404, `23P01` → 409 `ALLOCATION_OVERLAP`).
  - `money` utils (decimal.js), a JSON serialization interceptor converting `Decimal` → string.
  - Pagination helper.
  - **AuditInterceptor** writing `AuditLog` for mutating requests.
  - **StorageService** (S3 via `@aws-sdk/client-s3`, `forcePathStyle: true`): `ensureBucket()`, `putObject(stream|buffer)`, `getObjectStream`, `deleteObject`, `headObject`. The bucket is created on module init.
- `modules/auth`: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`. argon2 hashing, JWT in an httpOnly cookie `sc_session` (SameSite=Lax; Secure only when `COOKIE_SECURE=true`). Global `JwtAuthGuard` + `@Public()`. Simple login rate limit (in-memory, 10/min).
- `modules/settings`: `GET /settings`, `PATCH /settings/:key` (zod-validated per key, defaults from overview §6).
- `modules/audit`: `GET /audit?entity=&entityId=` (paginated).
- `GET /health` (public): DB ping + S3 ping.
- `seed/base.ts`: idempotent. Creates the admin from env if missing and default settings if missing. `seed/sample-data.ts`: stub now (company settings only); later steps extend it. `seed/index.ts` runs base, then sample when `SEED_SAMPLE_DATA=true` and there are no projects.
- Container entrypoint: `prisma migrate deploy && node dist/seed/index.js && node dist/main.js`.

### 1.4 Web (`apps/web`) — Next.js
- App Router, TypeScript, Tailwind, **shadcn/ui** initialised (button, input, label, card, dialog, dropdown-menu, select, table, tabs, badge, toast/sonner, form, popover, calendar, sheet, skeleton, separator, tooltip).
- `next.config`: `output: 'standalone'`, rewrites `/api/:path*` → `${API_INTERNAL_URL}/:path*`, next-intl plugin.
- **next-intl without routing**: `src/i18n/request.ts` reads the cookie `NEXT_LOCALE` (validated: `en`|`si`, default `en`). A `setLocale` server action. `<html lang>` set from the locale. Fonts: Noto Sans + Noto Sans Sinhala via `next/font/google`, applied as a font stack.
- `messages/en.json`, `messages/si.json`: namespaces `common`, `nav`, `auth`, `settings`, `enums`, `errors`, `dashboard`. Write natural Sinhala (simple everyday words a contractor uses; English loanwords such as "JCB", "BOQ", "IPC" stay in English).
- `src/lib/api-client.ts`: a fetch wrapper (`credentials: 'include'`, JSON, maps error codes to i18n `errors.*`, redirects to `/login` on 401). TanStack Query provider. `format.ts`: `formatMoney` (Rs.), `formatQty`, `formatDate` (Asia/Colombo).
- Middleware: no `sc_session` cookie → redirect to `/login` (except `/login`, static files and `/api`).
- **Layout** `(app)/layout.tsx`: sidebar with all nav items from overview §8 (pages not built yet show a friendly "Coming soon" placeholder), top bar with company name, EN | සිං toggle, bell (placeholder), user menu (change password, logout). Responsive (sheet sidebar under 1024px).
- Pages: `/login` (big, simple), `/dashboard` (placeholder cards), `/settings` (company info form, payroll rates, reminder days, billing defaults, change password). A banner when the admin password is still the default.
- Reusable components now: `DataTable` (TanStack Table: search, pagination, empty state, loading skeleton), `MoneyInput`, `DateInput`, `ConfirmDialog`, `StatusChip`, `PageHeader`.

### 1.5 Docker
- `docker/api.Dockerfile` and `docker/web.Dockerfile`: multi-stage, `node:24-slim` (arm64 + amd64), pnpm via corepack, build context = repo root, non-root user. Web uses standalone output.
- `docker/seaweedfs/`: run SeaweedFS single-node with S3 enabled (`weed server -s3` or `weed mini` — verify against the pinned image's docs) with `-dir=/data`. Credentials come from a `s3.json` rendered at container start from `S3_ACCESS_KEY`/`S3_SECRET_KEY` (a small entrypoint script). Healthcheck on the S3 port.
- `docker-compose.yml` (project name `supun`): `postgres` (18-alpine, volume at `/var/lib/postgresql`, healthcheck `pg_isready`), `seaweedfs`, `gotenberg` (pinned `gotenberg/gotenberg:8.x`), `api` (depends_on healthy), `web` (port `127.0.0.1:${WEB_PORT:-3000}:3000`). All `restart: unless-stopped`. Leave a placeholder comment where the `backup` service goes (Step 6).
- `docker-compose.dev.yml` (project `supun-dev`): postgres on 5433 (creates DBs `supun_dev` and `supun_test` via an init script), seaweedfs on 8334, gotenberg on 3002.
- `.env.example` with every variable documented. `scripts/start.command` (macOS double-click): `cd` to the repo, create `.env` from the example with random `JWT_SECRET`/S3 keys/DB password (`openssl rand -hex 24`) if missing, `docker compose up -d --build`, wait for health, `open http://localhost:3000`. Also `stop.command` and `update.command` (`git pull` + up --build). `chmod +x` them.

### 1.6 Tests
- API unit: env schema, money utils, the Prisma error mapper.
- API e2e (`test/`): helpers to reset the test DB (`prisma migrate reset --force` once per run + truncate per file), log in and get the cookie. Cover: login OK/fail, a protected route without the cookie → 401, change password, settings get/patch validation, health, **the allocation overlap constraint** (raw insert via Prisma), and the audit log written on PATCH.
- Web: Vitest for `format.ts` and an **i18n key-parity test**. Playwright config (`baseURL` http://localhost:3000) with specs: login → dashboard; switch to Sinhala → nav labels change and the choice persists after reload; settings save; logout.

## Acceptance criteria
- [ ] `pnpm install && pnpm -r build` works from clean.
- [ ] All tests in §1.6 pass; typecheck and lint are clean.
- [ ] `docker compose down -v && docker compose up -d --build` → all services healthy, migrations applied, admin seeded, login works at http://localhost:3000 with `admin` / `admin123` (from `.env.example`).
- [ ] The language toggle works and persists; no hard-coded strings.
- [ ] The full schema from overview §6 exists; the exclusion constraints are verified by a test.
- [ ] Uploading through `StorageService` works against SeaweedFS (covered by an e2e test using a temporary key).
- [ ] `docs/DRIFT-LOG.md` updated (versions, decisions, deviations); git commit `feat(step-1): foundation`.
