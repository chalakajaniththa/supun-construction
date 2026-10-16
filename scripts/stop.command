#!/bin/bash
# Supun Construction — STOP. Double-click this file on the Mac. Your data is kept.
set -uo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

ensure_docker
bold "Stopping Supun Construction…"
docker compose stop || fail "Could not stop the system."
bold "Stopped. Your data is safe. Double-click start.command to start again."
pause_if_double_clicked
