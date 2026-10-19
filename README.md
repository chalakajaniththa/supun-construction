# Supun Construction — business management system

A simple system for running a construction business: projects, workers, machines, daily site
records, salaries, bills, documents and reminders — in **English and Sinhala**. It runs on your
own MacBook. Your data stays on your computer, and is backed up every night (optionally also to
your Google Drive).

- [1. What this is](#1-what-this-is)
- [2. Install on a MacBook](#2-install-on-a-macbook)
- [3. Daily use](#3-daily-use)
- [4. Sinhala / English](#4-sinhala--english)
- [5. Updating](#5-updating)
- [6. Backups](#6-backups)
- [7. Troubleshooting](#7-troubleshooting)
- [8. For developers](#8-for-developers)

---

## 1. What this is

| Area                   | What you can do                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**          | Active projects, workers on site today, money spent this month, money to receive, and a short "Needs attention" list.                  |
| **Daily Entry**        | For one day and one site: who came to work, machine hours and fuel, and small expenses — one Save button.                              |
| **Projects**           | Contract details, budget vs actual cost, BOQ and progress, bills (IPC) and payments, variations, extensions of time, bonds, documents. |
| **Schedule**           | Plan which worker or machine goes to which site. Double bookings are refused.                                                          |
| **Workers / Machines** | Profiles, pay rates, attendance, advances, payslips, hour meters, services and repairs, vehicle papers.                                |
| **Purchases & store**  | Purchases, the main store, issuing materials to sites, supplier balances.                                                              |
| **Payroll**            | Salaries for daily and permanent staff (EPF/ETF), advance recovery, payslips.                                                          |
| **Reports**            | PDF and Excel reports (costs, salaries, attendance, machines, expenses, suppliers, bills, expiries, monthly summary).                  |
| **Reminders**          | Insurance, licences, bonds, machine services and project deadlines — before they are due.                                              |
| **Backups**            | Every night at 23:00, on this computer and (if connected) on Google Drive.                                                             |

The system comes with **sample data** (a fictional company around Polonnaruwa) so you can try
everything at once. When you are ready to use it for real, you can delete the sample data
(see [Reset data](#reset-data-start-for-real-or-load-the-sample-again)).

---

## 2. Install on a MacBook

> **Installing on any computer (Mac, Windows or Linux) from the published images?** Follow
> [docs/INSTALL.md](docs/INSTALL.md) — one command installs Docker's part and starts the system.
> The steps below build the system from this source folder on a Mac.

You need: a MacBook with Apple Silicon (M1 or newer) or Intel, about 10 GB of free space, and an
internet connection for the first start.

### Step 1 — Install Docker Desktop (once)

1. Open <https://www.docker.com/products/docker-desktop/> and click **Download for Mac – Apple
   Silicon** (or **Intel chip** on an older Mac).
2. Open the downloaded file and drag **Docker** into **Applications**.
3. Open **Docker** from Applications. Accept the terms. You can skip signing in.
4. Wait until the whale icon in the top menu bar stops moving. Docker is ready.
5. Optional but recommended: Docker → Settings → General → tick **Start Docker Desktop when you
   sign in to your computer**.

### Step 2 — Get the program (once)

Your helper copies the **supun-construction** folder onto your Mac (for example into your
Documents folder), or downloads it with `git clone`.

### Step 3 — Start it

1. Open the **supun-construction** folder, then the **scripts** folder.
2. Double-click **start.command**.
   - The first time, macOS may say it cannot open it. Then **right-click** (or Control-click) the
     file → **Open** → **Open**. You only need to do this once.
3. A black Terminal window opens. **The first start takes 5–15 minutes** (it builds everything).
4. **The first time it shows your BACKUP PASSWORD. Write it down on paper and keep it safe.**
   Without it, backups cannot be restored. (It is also saved in the file `.env` in the folder.)
5. When it is ready, your browser opens **http://localhost:3000**.

### Step 4 — Log in and change the password

- Username: **admin** — Password: **admin123**
- Then go to **Settings → Password** and choose your own password. A yellow banner reminds you
  until you do.

To stop the system: double-click **scripts/stop.command** (your data is kept). To start again:
**scripts/start.command** (later starts take less than a minute). You can also just leave it
running — it starts again by itself when Docker Desktop starts.

---

## 3. Daily use

The most important screen is **Daily Entry** (left menu).

1. Pick the **date** (today is already chosen) and the **site** (project).
2. **Attendance:** workers planned for this site are already listed. Click **Present**, **Half
   day**, **Absent** or **Leave** for each — or **Mark all present**. Type overtime hours if any.
   **Copy from last day** fills in the same as the last working day.
3. **Machines:** pick a machine, type the hour-meter reading at the end of the day (hours are
   counted for you), and fuel litres / cost.
4. **Expenses:** add a row for each small expense (meals, transport, …). You can attach a photo
   of the receipt.
5. Press **Save** at the bottom. That's it.

**Help inside the system:** click **User guide** in the left menu (or the **?** button at the top
of any page) for step-by-step help with pictures, in English and Sinhala. Type a word such as
"salary" or "insurance" in its search box to find how to do something.

Other everyday tasks:

- **Upload a document** (insurance, licence, contract…): open the project / machine / worker →
  **Documents** → **Upload**. When you renew insurance, use **New version** on the old document
  and enter the new expiry date — the reminder disappears by itself.
- **Salaries:** **Payroll** → choose the month → **Calculate** → check → **Finalize** → download
  **Payslips (PDF)**.
- **Bills:** project → **Bills & payments** → **New bill** (the system calculates retention and
  advance recovery) → mark it **Submitted**, **Certified** → **Record payment** when paid.
- **Reminders:** the bell at the top shows how many things need attention.

---

## 4. Sinhala / English

Click **EN | සිං** at the top right. The system remembers your choice. Reports (PDF / Excel)
come out in the language you are using.

---

## 5. Updating

When your helper tells you there is a new version:

1. Double-click **scripts/update.command**.
2. It downloads the new version, rebuilds and restarts (a few minutes). Your data is kept;
   database changes are applied automatically.
3. The browser opens when it is ready.

---

## 6. Backups

### What is backed up, and when

- **Everything**: the whole database (all records) and all uploaded documents.
- **Every night at 23:00**. If the Mac was off or asleep at 23:00, a backup is made as soon as the
  system starts again (when the last one is older than 24 hours).
- **Back up now** any time: **Settings → Backup → Back up now**.
- Backups are kept smartly: one per day for 7 days, one per week for 4 weeks, one per month for
  12 months.
- They are **encrypted** (locked) with your **backup password**.

The small icon with a coloured dot at the top of every page shows the backup status:
**green** = fine, **orange** = the last backup is more than 36 hours old (or Google Drive did not
accept it), **red** = the last backup failed, or there was none for 3 days. Click it to see
details. Problems also appear in the dashboard's "Needs attention" list.

> ### ⚠️ Keep your backup password safe
>
> The backup password was shown the first time you started the system. It is also in the file
> `.env` (the line `RESTIC_PASSWORD=…`). **Write it on paper and keep it with your important
> papers.** Without it, nobody — not even your helper — can restore a backup. Never change it
> in `.env` after backups exist.

### Connect Google Drive (strongly recommended)

Backups on this computer do not help if the computer is lost, stolen or broken. Connect Google
Drive so every backup is also stored there — from inside the app:

1. On **the computer where the system runs**, open **Settings → Backup**.
2. Press **Connect Google Drive**, then **Open the Google sign-in**.
3. **Choose the Google account** for the backups. If Google says **"Google hasn't verified this
   app"**, click **Advanced**, then **Go to rclone (unsafe)**, then **Continue / Allow**. (rclone
   is the free, widely used backup tool inside this system. It only gets access to the files it
   creates itself — not to your other Drive files.)
4. The page says **"Success!"** — close it. Settings → Backup now says **Connected**.
5. Press **Back up now**. When it finishes, "Saved to" shows **This computer and Google Drive**.
   In Google Drive you will see a folder **SupunConstructionBackup** (the files inside are
   encrypted; that is normal).

**Disconnect Google Drive** on the same card stops new backups going to Drive (the ones already
there stay).

_For your helper:_ the sign-in runs in the backup container (`docker/backup/gdrive-link.sh`); Google
answers on `127.0.0.1:53682`, which the `backup` service publishes, so the browser must be on the
same computer. The connection is saved in `config/rclone/rclone.conf` (never committed to git)
with the `drive.file` scope. The old way still works: `scripts/setup-gdrive.command`, or on a
computer without a browser `rclone authorize "drive" "eyJzY29wZSI6ImRyaXZlLmZpbGUifQ"` elsewhere,
then `scripts/setup-gdrive.command --token '<the token JSON it prints>'`.
Optional — **your own Google client ID** (better rate limits than rclone's shared one): create an
OAuth client of type _Desktop app_ in Google Cloud Console (enable the Google Drive API), put
`GDRIVE_CLIENT_ID=` and `GDRIVE_CLIENT_SECRET=` in `.env`, run `docker compose up -d backup`,
then connect again.

### Restore a backup

Restoring **replaces all current data** with the backup. Ask your helper if you are unsure.

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Type `cd ` (with a space), drag the **supun-construction** folder into the window, press Enter.
3. Type `scripts/restore.sh` and press Enter (for Google Drive: `scripts/restore.sh --from gdrive`).
4. It lists the backups with their dates. Type the **ID** of the one you want (first column), or
   just press Enter for the latest.
5. Type **RESTORE** to confirm. The app stops, the data is put back, and the app starts again.

### Restore on a new computer

1. Install Docker Desktop and copy the program folder (section 2).
2. Run **start.command** once (it creates a new `.env` and new sample data).
3. Open `.env` in TextEdit and replace the value after `RESTIC_PASSWORD=` with **your old backup
   password**. Save.
4. Double-click **start.command** again (it applies the password).
5. Connect Google Drive (Settings → Backup) with the **same Google account** as before.
6. Run `scripts/restore.sh --from gdrive` (see above) and choose the latest backup.

---

## 7. Troubleshooting

| Problem                                                      | What to do                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Docker Desktop is not installed" / "did not start"          | Install or open **Docker** from Applications, wait until the whale icon is still, then double-click **start.command** again.                                                                                                                          |
| The browser says "This site can't be reached"                | The system is still starting (wait a minute) or stopped — double-click **start.command**.                                                                                                                                                             |
| "Port is already allocated" / another program uses port 3000 | Open `.env`, change `WEB_PORT=3000` to e.g. `WEB_PORT=3010`, start again and open http://localhost:3010.                                                                                                                                              |
| Open it from a phone or another computer on the same Wi-Fi   | In `.env` change `WEB_BIND=127.0.0.1` to `WEB_BIND=0.0.0.0` and start again. On the phone open `http://<the Mac's IP address>:3000` (System Settings → Wi-Fi → Details shows the IP). Only do this on a trusted home/office Wi-Fi.                    |
| Backup dot is red or orange                                  | **Settings → Backup** says what is wrong and what to do. Usually **Back up now** fixes it.                                                                                                                                                            |
| "The backup service is not running"                          | Double-click **start.command** (it starts all parts again).                                                                                                                                                                                           |
| Forgot the login password                                    | Ask your helper: in Terminal, in the folder, run `docker compose exec postgres psql -U supun -d supun -c "DELETE FROM \"User\";"` then `docker compose restart api` — the login becomes `admin` / `admin123` (or `ADMIN_PASSWORD` from `.env`) again. |
| It is slow or the Mac is full                                | Docker → Settings → Resources: give it at least 4 GB memory. Free some disk space.                                                                                                                                                                    |

### Reset data (start for real, or load the sample again)

**Settings → Reset data** has two buttons; both ask you to type **RESET** and your **login
password**:

- **Start empty…** — deletes the sample data and every record, so you can start real use. The
  sample data does not come back on the next start.
- **Load sample data…** — deletes every record and loads the sample company again (practice).

Both keep your login, settings, change history and **all backups** (history, backups on this
computer and on Google Drive, and the Google Drive connection). Make a backup first if you want
to keep anything.

To start **empty** on a new install without the sample data at all: set `SEED_SAMPLE_DATA=false`
in `.env` before the very first start (the install scripts ask you).

---

## 8. For developers

**Stack:** pnpm monorepo — `apps/api` (NestJS 12, Prisma 7, PostgreSQL 18), `apps/web` (Next.js 16,
Tailwind, shadcn/ui, TanStack Query, next-intl), `packages/shared` (zod schemas, enums, money/time
helpers). SeaweedFS (S3) stores documents, Gotenberg renders PDFs, the `backup` container
(`docker/backup/`: pg_dump + rclone + restic + supercronic) makes the backups.

**Read first:** [`docs/00-OVERVIEW.md`](docs/00-OVERVIEW.md), then [`docs/DRIFT-LOG.md`](docs/DRIFT-LOG.md)
(it records every deviation and decision; it wins over the plan).

```bash
pnpm install                 # also builds packages/shared
pnpm dev:infra               # postgres :5433, SeaweedFS :8334, Gotenberg :3002, backup service
pnpm --filter @sc/api db:deploy && pnpm --filter @sc/api db:seed
pnpm dev                     # API :4000 + web :3000
```

**Checks:** `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r test` (unit) · `pnpm test:e2e:api`
(dev infra) · `pnpm test:e2e:web` (Playwright against the full Docker stack on :3000) ·
`scripts/test-backup-restore.sh` (real backup → change → restore → verify, against the full stack).

**Published images (GHCR):** `.github/workflows/images.yml` builds `api`, `web`, `backup` and
`seaweedfs` for amd64 + arm64 on every push to `main` (`latest`) and on `v*` tags; end users install
them with `deploy/docker-compose.yml` and `deploy/install.sh` / `install.ps1` —
see [docs/INSTALL.md](docs/INSTALL.md).

**Full stack:** `docker compose up -d --build --wait` (project `supun`; everything comes from
`.env`, see `.env.example`). Logs: `docker compose logs -f api backup`. A manual backup from the
command line: `docker compose exec backup run-backup MANUAL`.

**Layout:** `apps/api/src/modules/<feature>` (pure calculators in `calc/` with unit tests),
`apps/api/src/seed` (base + sample data), `apps/web/src/app/(app)/<page>`, `apps/web/src/components`,
`apps/web/messages/{en,si}.json` (all screen text; same keys in both), `apps/web/e2e` (Playwright),
`docker/` (Dockerfiles, backup scripts), `scripts/` (Mac scripts).

### User guide (in the app)

The guide at `/guide` lives in `apps/web/src/components/guide/guide-content.ts` (English and
Sinhala side by side; `[[ns.key]]` shows a screen label from `messages/*.json`, `(1)` matches the
numbered red marks on a picture). Its screenshots are in `apps/web/public/guide/{en,si}/*.webp`.
After a screen changes, make them again against the running app with the sample data (needs
ImageMagick):

```bash
GUIDE_SHOTS=1 pnpm --filter @sc/web exec playwright test guide-screenshots
```

A unit test checks that every label, link and picture the guide uses exists in both languages.

### Translations

> Sinhala text should be reviewed by a native speaker; edit `apps/web/messages/si.json`.

All screen text lives in `apps/web/messages/en.json` and `si.json` (same keys in both). Reports and
reminder e-mails use the same files.
