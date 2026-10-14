#!/bin/bash
# Supun Construction — STOP. Double-click this file on the Mac. Your data is kept.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose stop
printf '\nStopped. Your data is safe. Double-click start.command to start again.\n'
