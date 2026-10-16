#!/bin/bash
# Supun Construction — RESTORE a backup. Run in Terminal from this folder:
#   scripts/restore.sh                       (from this computer's backups, asks which one)
#   scripts/restore.sh --from gdrive         (from Google Drive)
#   scripts/restore.sh --snapshot 1a2b3c4d   (a given backup; default: the latest)
#   scripts/restore.sh --latest --yes        (no questions — used by the automated test)
# It stops the app, puts back the database and the document files, and starts the app again.
set -uo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

FROM=local
SNAPSHOT=""
YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --snapshot) SNAPSHOT="${2:-}"; shift 2 ;;
    --latest) SNAPSHOT=latest; shift ;;
    --yes) YES=1; shift ;;
    -h | --help) sed -n '2,8p' "$0"; exit 0 ;;
    *) fail "Unknown option: $1 (see scripts/restore.sh --help)" ;;
  esac
done
case "$FROM" in local | gdrive) ;; *) fail "--from must be local or gdrive" ;; esac

ensure_docker
[ -f .env ] || fail "There is no .env here. If this is a new computer, see README → \"Restore on a new computer\"."
docker compose up -d --wait backup >/dev/null 2>&1 || docker compose up -d backup || fail "The backup service could not be started."

bold "Backups available ($FROM):"
docker compose exec -T backup restore.sh --from "$FROM" --list || fail "Could not read the backups. Is RESTIC_PASSWORD in .env the right one?"

if [ -z "$SNAPSHOT" ]; then
  printf '\nType the ID of the backup to restore (first column), or press Enter for the latest: '
  read -r SNAPSHOT || true
  SNAPSHOT="${SNAPSHOT:-latest}"
fi

if [ "$YES" -ne 1 ]; then
  warn "This REPLACES everything in the system (all records and documents) with backup \"$SNAPSHOT\".
Anything entered after that backup was made will be lost."
  printf 'Type RESTORE to continue: '
  read -r answer || true
  [ "$answer" = "RESTORE" ] || fail "Cancelled — nothing was changed."
fi

bold "Stopping the app…"
docker compose stop web api
restart_app() {
  bold "Starting the app again…"
  docker compose start api web
}
trap restart_app EXIT

bold "Restoring… (this can take a few minutes)"
if ! docker compose exec -T backup restore.sh --from "$FROM" --snapshot "$SNAPSHOT" --yes; then
  fail "The restore did not finish. The app is being started again; check the messages above."
fi

trap - EXIT
restart_app
wait_ready 600 && bold "Restore finished. Opening $(web_url)" && open_url "$(web_url)"
