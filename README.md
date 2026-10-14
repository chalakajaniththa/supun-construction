# Supun Construction — business management system

Projects, workers, machines, daily site records, payroll, billing and documents for a small
contractor in Polonnaruwa. English and Sinhala.

> The owner-friendly install & user guide arrives in Step 6. The plan lives in `docs/`
> (start with `docs/00-OVERVIEW.md`, then `docs/DRIFT-LOG.md`).

## Run it (Mac, with Docker Desktop)

Double-click `scripts/start.command`. It creates `.env` with random secrets on the first run,
builds and starts everything, and opens http://localhost:3000. Log in with `admin` / `admin123`,
then change the password in **Settings → Password**.

`scripts/stop.command` stops it (data is kept); `scripts/update.command` pulls the latest version
and rebuilds.

## Develop

```bash
pnpm install                 # also builds packages/shared
pnpm dev:infra               # postgres :5433, SeaweedFS :8334, Gotenberg :3002
pnpm --filter @sc/api db:deploy && pnpm --filter @sc/api db:seed
pnpm dev                     # API :4000 + web :3000
```

Checks: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm test:e2e:api`
(dev infra), `pnpm test:e2e:web` (full Docker stack on :3000).
