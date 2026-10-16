#!/bin/bash
# Supun Construction — CONNECT GOOGLE DRIVE for backups. Double-click this file on the Mac.
# A Google sign-in page opens in your browser; sign in and press "Allow". Done.
# Advanced: scripts/setup-gdrive.command --token '<token JSON from rclone authorize>'
set -uo pipefail
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

TOKEN=""
if [ "${1:-}" = "--token" ]; then TOKEN="${2:-}"; [ -n "$TOKEN" ] || fail "--token needs the token text"; fi

ensure_docker
ensure_env
bold "Connecting Google Drive for backups"
info "1. A Google page opens in your browser. Choose the Google account for the backups."
info "2. If Google says \"Google hasn't verified this app\", click \"Advanced\" → \"Go to rclone (unsafe)\"."
info "   (rclone is the free backup tool this system uses; it can only see the files it creates.)"
info "3. Click \"Continue\" / \"Allow\". The page then says \"Success!\" — come back to this window."

docker compose up -d --wait postgres >/dev/null 2>&1 || true

# A sign-in window that was closed half-way may have left its helper running.
docker rm -f supun-gdrive-setup >/dev/null 2>&1 || true
PUBLISH=(-p 127.0.0.1:53682:53683)
[ -n "$TOKEN" ] && PUBLISH=()

opened=0
docker compose run --rm --no-deps -T --name supun-gdrive-setup "${PUBLISH[@]}" \
  -e GDRIVE_TOKEN="$TOKEN" \
  --entrypoint /usr/local/bin/gdrive-setup.sh backup 2>&1 |
  while IFS= read -r line; do
    case "$line" in
      *"Failed to open browser"*) printf '%s\n' "Opening the Google sign-in page in your browser…" ;;
      *) printf '%s\n' "$line" ;;
    esac
    case "$line" in
      *http://127.0.0.1:53682/auth*)
        if [ $opened -eq 0 ]; then
          url="$(printf '%s' "$line" | grep -o 'http://127.0.0.1:53682/auth[^ ]*' | head -n 1)"
          [ -n "$url" ] && open_url "$url"
          opened=1
        fi
        ;;
    esac
  done
rc=$?
if [ $rc -ne 0 ]; then
  fail "Google Drive was not connected. You can try again, or ask your helper (README → Backups)."
fi
bold "Done. The next backup is also saved to Google Drive. To test it now: Settings → Backup → \"Back up now\"."
pause_if_double_clicked
