#!/bin/bash
# Supun Construction — UPDATE. Double-click this file on the Mac.
# Downloads the latest version and rebuilds. Your data is kept.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
printf '\nUpdated. Opening the app…\n'
WEB_PORT="$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2 || true)"
open "http://localhost:${WEB_PORT:-3000}" 2>/dev/null || true
