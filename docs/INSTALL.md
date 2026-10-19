# Install Supun Construction on a computer

This guide sets up the system on **one computer** (Mac, Windows or Linux). The computer keeps all
the data; the system is opened in a web browser at **http://localhost:3000**. No programming
knowledge is needed — copy each command exactly as shown.

- [1. What you need](#1-what-you-need)
- [2. Install Docker](#2-install-docker) — [Mac](#mac) · [Windows](#windows) · [Linux](#linux)
- [3. Install the system](#3-install-the-system)
- [4. First login](#4-first-login)
- [5. Sample data, or start for real](#5-sample-data-or-start-for-real)
- [6. Backups and Google Drive](#6-backups-and-google-drive)
- [7. Start, stop and update](#7-start-stop-and-update)
- [8. Restore a backup](#8-restore-a-backup)
- [9. Open it from a phone](#9-open-it-from-a-phone)
- [10. Problems](#10-problems)
- [11. For the maintainer: publishing new versions](#11-for-the-maintainer-publishing-new-versions)

---

## 1. What you need

- A computer that stays on during the working day: **Mac** (Apple chip or Intel), **Windows 10/11**
  (64-bit), or **Linux** (Ubuntu, Debian, Fedora…).
- At least **8 GB of memory** and **15 GB of free disk space**.
- An **internet connection** for the installation and updates (the system itself works offline).

---

## 2. Install Docker

The system runs inside **Docker**, a free program that keeps all its parts together. Install it once.

### Mac

1. Open <https://www.docker.com/products/docker-desktop/> and download **Docker Desktop for Mac**
   — choose **Apple Silicon** (M1, M2, M3, M4 …) or **Intel chip** ( → About This Mac shows
   which one you have).
2. Open the downloaded `Docker.dmg` and drag **Docker** into **Applications**.
3. Open **Docker** from Applications, accept the terms (you can skip signing in).
4. Wait until the whale icon in the top menu bar stops moving.
5. Recommended: Docker → **Settings → General** → tick **Start Docker Desktop when you sign in**.

### Windows

1. Open **PowerShell as administrator** (Start menu → type `PowerShell` → right-click →
   **Run as administrator**) and run:

   ```powershell
   wsl --install
   ```

   Restart the computer when it asks. (This turns on the Linux support Docker needs. If it says
   WSL is already installed, continue.)
2. Download **Docker Desktop for Windows** from <https://www.docker.com/products/docker-desktop/>
   and run the installer. Keep **Use WSL 2** ticked.
3. Open **Docker Desktop** from the Start menu, accept the terms (you can skip signing in).
4. Wait until the bottom-left corner says **Engine running**.
5. Recommended: Docker Desktop → **Settings → General** → tick
   **Start Docker Desktop when you sign in to your computer**.

### Linux

Ubuntu, Debian, Fedora and most others — run in a terminal:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER
```

```bash
sudo systemctl enable --now docker
```

Then **log out and log in again** (so your user may use Docker). Check that it works:

```bash
docker compose version
```

---

## 3. Install the system

Run **one** command. It creates the folder **supun-construction** in your home folder, downloads
the system and starts it.

**Mac or Linux** — open **Terminal** (Mac: Applications → Utilities → Terminal) and run:

```bash
curl -fsSL https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main/deploy/install.sh | bash
```

**Windows** — open **PowerShell** (normal, not administrator) and run:

```powershell
irm https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main/deploy/install.ps1 | iex
```

During the first installation it asks two things:

1. **"Load the SAMPLE data … to practise first? [Y/n]"**
   - Press **Enter** (yes) to get a made-up company with projects, workers and machines — good for
     learning. You can delete it later with one button (see [section 5](#5-sample-data-or-start-for-real)).
   - Type **n** to start with an empty system for real use.
2. It shows your **BACKUP PASSWORD**. **Write it on paper and keep it safe** (with your important
   papers). Without it no backup can ever be restored — not even from Google Drive. It is also
   saved in the file `.env` in the **supun-construction** folder.

The first download takes **5–15 minutes**. When it says **"Supun Construction is running"**, the
browser opens **http://localhost:3000**.

<details>
<summary>Install by hand (without the script)</summary>

1. Make a folder, for example `supun-construction`, and open a terminal in it.
2. Download [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) into it.
3. Create a file `.env` next to it with the content of [`deploy/env.example`](../deploy/env.example)
   and replace every `change-me-…` value with a long random text (for example from
   `openssl rand -hex 24`). Keep `RESTIC_PASSWORD` safe — it is the backup password.
4. Run `docker compose pull` and then `docker compose up -d --wait`.
</details>

---

## 4. First login

1. Open **http://localhost:3000** (bookmark it).
2. Username **admin**, password **admin123**.
3. Go to **Settings → Password** and choose your own password. A yellow banner reminds you until
   you do. Write the new password down too.

The **User guide** in the left menu (and the **?** button at the top) explains every screen, with
pictures, in English and Sinhala.

---

## 5. Sample data, or start for real

**Settings → Reset data** has two buttons. Both need you to type **RESET** and your **login
password**, and both delete ALL projects, workers, machines, daily records, salaries, bills and
documents. They **never touch the backups**: the backup history, the backups on this computer
and on Google Drive, and the Google Drive connection all stay. Your login, password and settings
stay too.

| Button | Use it when |
| --- | --- |
| **Start empty…** | You have finished practising and want to enter your real company. The system becomes empty and the sample data never comes back by itself. |
| **Load sample data…** | You want the made-up company again, for practice or training someone. |

Tip: press **Settings → Backup → Back up now** first if you might want the old data back.

---

## 6. Backups and Google Drive

- The system makes a **backup every night at 23:00** (and when it starts, if the last one is
  older than a day). Backups are locked with your backup password.
- **Settings → Backup** shows the state; the small dot at the top of every page is **green**
  when all is well. **Back up now** makes one at once.
- **Connect Google Drive** (strongly recommended — a backup only on this computer is lost with the
  computer):
  1. On **the computer where the system is installed**, open **Settings → Backup**.
  2. Press **Connect Google Drive**, then **Open the Google sign-in**.
  3. Choose the Google account for the backups. If Google says the app is not verified, click
     **Advanced → Go to rclone (unsafe)**, then **Continue / Allow**. (rclone is the free backup
     tool inside the system; it can only see the files it creates.)
  4. When the page says **Success**, close it. Settings → Backup now says **Connected**.
  5. Press **Back up now** — "Saved to" shows **This computer and Google Drive**, and your Drive has
     a folder **SupunConstructionBackup** (its files are locked; that is normal).

---

## 7. Start, stop and update

The system starts by itself whenever Docker starts (with the computer, if you ticked "Start Docker
Desktop when you sign in"). The commands below are run in the **supun-construction** folder:

| | Mac / Linux (Terminal) | Windows (PowerShell) |
| --- | --- | --- |
| Go to the folder | `cd ~/supun-construction` | `cd $env:USERPROFILE\supun-construction` |
| Stop | `docker compose stop` | `docker compose stop` |
| Start | `docker compose up -d` | `docker compose up -d` |
| See if it runs | `docker compose ps` | `docker compose ps` |
| **Update** to the newest version | run the install command from [section 3](#3-install-the-system) again | run the install command again |

Updating keeps all data; database changes are applied automatically. To stay on a fixed version,
set `SC_VERSION=1.2.0` (for example) in `.env` instead of `latest`.

---

## 8. Restore a backup

Restoring **replaces all current data** with the backup. Ask your helper if you are unsure.
In the **supun-construction** folder:

1. List the backups (`--from local` for this computer, `--from gdrive` for Google Drive):

   ```bash
   docker compose exec backup restore.sh --from local --list
   ```

2. Stop the app, restore the one you want (`latest`, or the ID from the first column), start again:

   ```bash
   docker compose stop web api
   ```

   ```bash
   docker compose exec backup restore.sh --from local --snapshot latest --yes
   ```

   ```bash
   docker compose start api web
   ```

**On a new computer:** install Docker and the system ([sections 2–3](#2-install-docker), answer
**n** to the sample data). Open `.env` in the **supun-construction** folder with a text editor,
replace the value after `RESTIC_PASSWORD=` with **your old backup password**, save, and run
`docker compose up -d`. Connect Google Drive with the **same Google account** (section 6), then
restore with `--from gdrive` as above.

---

## 9. Open it from a phone

Only on a trusted home or office Wi-Fi: open `.env`, change `WEB_BIND=127.0.0.1` to
`WEB_BIND=0.0.0.0`, and run `docker compose up -d`. On the phone open
`http://<this computer's IP address>:3000`. (Connecting Google Drive still has to be done on the
computer itself.)

---

## 10. Problems

| Problem | What to do |
| --- | --- |
| "Docker is not running" | Open Docker Desktop and wait until it is ready (Linux: `sudo systemctl start docker`), then try again. |
| The browser says "This site can't be reached" | The system is still starting (wait a minute) or stopped — run `docker compose up -d` in the folder. |
| "port is already allocated" | Another program uses port 3000. In `.env` set `WEB_PORT=3010`, run `docker compose up -d`, open http://localhost:3010. |
| Backup dot is red or orange | Open **Settings → Backup**: it says what is wrong. Usually **Back up now** fixes it. |
| "The backup service is not running" | Run `docker compose up -d` in the folder. If it stays, look at `docker compose logs backup`. |
| Google Drive: "Connect" does nothing / page cannot be opened | Do it in a browser **on the computer that runs the system**, and check nothing else uses port 53682. |
| Forgot the login password | In the folder run `docker compose exec postgres psql -U supun -d supun -c "DELETE FROM \"User\";"` then `docker compose restart api`. The login is `admin` / `admin123` again (your data is kept). |
| Slow, or the computer is full | Docker Desktop → Settings → Resources: give it at least 4 GB of memory; free some disk space. |

To **remove** the system completely (this also deletes all data and the backups on this
computer!): `docker compose down -v`, then delete the folder.

---

## 11. For the maintainer: publishing new versions

The GitHub Actions workflow [`.github/workflows/images.yml`](../.github/workflows/images.yml)
builds four images for **amd64 and arm64** and pushes them to the GitHub Container Registry:

```
ghcr.io/chalakajaniththa/supun-construction-api
ghcr.io/chalakajaniththa/supun-construction-web
ghcr.io/chalakajaniththa/supun-construction-backup
ghcr.io/chalakajaniththa/supun-construction-seaweedfs
```

- Every push to **main** publishes the tag **latest** (and the short commit id).
- A release: `git tag v1.2.0 && git push origin v1.2.0` publishes **1.2.0** and **1.2** as well.
- It can also be started by hand: GitHub → **Actions → Images → Run workflow**.
- The first time, open each package on GitHub (your profile → **Packages**) → **Package settings**
  and check **Change visibility → Public**, so computers can pull without logging in. (If you keep
  them private, each computer needs `docker login ghcr.io` with a GitHub token that has
  `read:packages`.)
- Users update with the install command again (or `docker compose pull && docker compose up -d`).

Developers working from the source code still use the root `docker-compose.yml`
(`docker compose up -d --build`, or `scripts/start.command` on the Mac) — see the README.
