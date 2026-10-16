#!/bin/bash
# Supun Construction — UPDATE. Double-click this file on the Mac.
# Downloads the latest version, rebuilds and restarts. Your data is kept; database changes are
# applied automatically when the app starts.
set -uo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

ensure_docker
bold "Downloading the latest version…"
git pull --ff-only || fail "Could not download the update (no internet, or files were changed here). Ask your helper."
ensure_env
show_backup_password_once

bold "Rebuilding and restarting… (this can take several minutes)"
docker compose up -d --build --remove-orphans || fail "The update could not be started. See README → Troubleshooting."
if wait_ready 900; then
  bold "Updated! Opening $(web_url)"
  open_url "$(web_url)"
  exit 0
fi
pause_if_double_clicked
exit 1
