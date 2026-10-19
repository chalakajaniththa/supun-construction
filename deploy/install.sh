#!/usr/bin/env bash
# Supun Construction — install or update on a Mac or Linux computer (needs Docker).
#
#   curl -fsSL https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main/deploy/install.sh | bash
#
# It creates the folder ~/supun-construction (or the folder given as SC_DIR), downloads the
# docker-compose.yml, creates .env with fresh random secrets on the first run (and asks whether to
# load the sample data), pulls the images and starts everything. Running it again updates the
# system to the newest version and keeps all data.
set -euo pipefail

REPO_RAW="${SC_REPO_RAW:-https://raw.githubusercontent.com/chalakajaniththa/supun-construction/main}"
DIR="${SC_DIR:-$HOME/supun-construction}"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
fail() {
  printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}
# Questions are read from the keyboard even when this script comes through "curl … | bash".
ask() {
  local answer=""
  if [ -r /dev/tty ]; then read -r -p "$1" answer </dev/tty || true; fi
  printf '%s' "$answer"
}
random_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24; else
    LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 48
  fi
}
open_url() {
  if command -v open >/dev/null 2>&1; then open "$1" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true; fi
}

bold "Supun Construction — install / update"

command -v docker >/dev/null 2>&1 ||
  fail "Docker is not installed. Install Docker first (see docs/INSTALL.md), then run this again."
docker compose version >/dev/null 2>&1 ||
  fail "\"docker compose\" is missing. Install Docker Desktop, or the Docker Compose plugin on Linux."
docker info >/dev/null 2>&1 ||
  fail "Docker is not running. Open Docker Desktop (or run: sudo systemctl start docker) and try again."

mkdir -p "$DIR"
cd "$DIR"
info "Folder: $DIR"

bold "Downloading the newest setup file…"
curl -fsSL "$REPO_RAW/deploy/docker-compose.yml" -o docker-compose.yml.new ||
  fail "Could not download docker-compose.yml. Check the internet connection."
mv docker-compose.yml.new docker-compose.yml

FIRST=0
if [ ! -f .env ]; then
  FIRST=1
  bold "First installation"
  sample="$(ask '  Load the SAMPLE data (a made-up company) to practise first? [Y/n] ')"
  case "$sample" in [nN]*) SEED=false ;; *) SEED=true ;; esac
  BACKUP_PASSWORD="$(random_secret)"
  umask 077
  cat >.env <<ENV
# Supun Construction — settings for docker compose (created by install.sh on $(date '+%Y-%m-%d')).
# Keep this file safe: it holds the passwords of this installation.

# Image version (latest, or a release like 1.2.0)
SC_VERSION=latest

# First login (change the password in Settings → Password after logging in)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Web: http://localhost:3000. WEB_BIND=0.0.0.0 lets phones on the same Wi-Fi open it.
WEB_PORT=3000
WEB_BIND=127.0.0.1
COOKIE_SECURE=false

# Database, file storage and login cookie (random)
POSTGRES_USER=supun
POSTGRES_DB=supun
POSTGRES_PASSWORD=$(random_secret)
JWT_SECRET=$(random_secret)
S3_ACCESS_KEY=$(random_secret)
S3_SECRET_KEY=$(random_secret)
S3_BUCKET=supun-docs

# BACKUP PASSWORD — write it on paper! Without it no backup can ever be restored.
RESTIC_PASSWORD=$BACKUP_PASSWORD
BACKUP_SCHEDULE=0 23 * * *
GDRIVE_FOLDER=SupunConstructionBackup
GDRIVE_CLIENT_ID=
GDRIVE_CLIENT_SECRET=

# true = load the sample data on the first start (Settings → Reset data can remove it later)
SEED_SAMPLE_DATA=$SEED
ENV
  printf '\n\033[1;33m  ┌──────────────────────────────────────────────────────────────┐\n'
  printf '  │ YOUR BACKUP PASSWORD — WRITE IT DOWN ON PAPER AND KEEP IT SAFE │\n'
  printf '  │ %-60s │\n' "$BACKUP_PASSWORD"
  printf '  │ (it is also in %-45s │\n' "$DIR/.env)"
  printf '  └──────────────────────────────────────────────────────────────┘\033[0m\n'
  ask '  Press Enter when you have written it down… ' >/dev/null
fi

bold "Downloading the system (the first time this takes a few minutes)…"
docker compose pull || fail "Could not download the images. Check the internet connection."

bold "Starting…"
docker compose up -d --wait --remove-orphans || fail "The system did not start. See: docker compose logs"

PORT="$(grep -E '^WEB_PORT=' .env | cut -d= -f2)"
URL="http://localhost:${PORT:-3000}"
bold "Supun Construction is running: $URL"
if [ "$FIRST" = 1 ]; then
  info "Log in with:  admin  /  admin123   — then change the password (Settings → Password)."
fi
info "Stop:    cd \"$DIR\" && docker compose stop"
info "Start:   cd \"$DIR\" && docker compose up -d"
info "Update:  run this install command again."
open_url "$URL"
