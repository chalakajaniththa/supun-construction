#!/bin/bash
# Supun Construction — START. Double-click this file on the Mac.
# First time: creates .env with fresh random secrets (and your backup password), builds and
# starts everything (takes several minutes), then opens the app in your browser.
set -uo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

ensure_docker
ensure_env
show_backup_password_once

bold "Starting Supun Construction… (the first time takes several minutes)"
docker compose up -d --build || fail "Could not start. Is another program using port $(env_value WEB_PORT)? See README → Troubleshooting."

if wait_ready 900; then
  bold "Opening $(web_url) — log in with your username and password."
  open_url "$(web_url)"
  info "You can close this window. The system keeps running in the background."
  exit 0
fi
pause_if_double_clicked
exit 1
