#!/bin/bash
# Supun Construction — START. Double-click this file on the Mac.
# First time: creates .env with fresh random secrets, builds and starts everything.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

if ! command -v docker >/dev/null 2>&1; then
  say "Docker Desktop is not installed. Please install it from https://www.docker.com/products/docker-desktop/ and try again."
  read -r -p "Press Enter to close…" _
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  say "Starting Docker Desktop… (this can take a minute)"
  open -a Docker >/dev/null 2>&1 || true
  for _ in $(seq 1 120); do
    docker info >/dev/null 2>&1 && break
    sleep 3
  done
fi

if [ ! -f .env ]; then
  say "First start: creating settings file (.env) with new random passwords…"
  cp .env.example .env
  for key in POSTGRES_PASSWORD JWT_SECRET S3_ACCESS_KEY S3_SECRET_KEY; do
    value="$(openssl rand -hex 24)"
    sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
  done
  rm -f .env.bak
fi

say "Starting Supun Construction… (the first time takes several minutes)"
docker compose up -d --build

WEB_PORT="$(grep -E '^WEB_PORT=' .env | cut -d= -f2 || true)"
WEB_PORT="${WEB_PORT:-3000}"
say "Waiting for the system to be ready…"
for _ in $(seq 1 200); do
  if curl -fsS "http://localhost:${WEB_PORT}/login" >/dev/null 2>&1; then
    say "Ready! Opening http://localhost:${WEB_PORT}"
    open "http://localhost:${WEB_PORT}"
    exit 0
  fi
  sleep 3
done
say "The system did not start in time. Run: docker compose logs api web"
exit 1
