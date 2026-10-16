#!/bin/bash
# Automated backup → change → restore test against the running full stack (http://localhost:3000).
# FOR DEVELOPERS: it adds a test client + document, makes a real backup, changes the data,
# restores the latest LOCAL backup (scripts/restore.sh --latest --yes) and checks that the data
# and the file are back. Afterwards it deletes the test client and document again.
#   scripts/test-backup-restore.sh
# Needs: curl, jq, sha256sum or shasum, a running stack with the backup service.
set -euo pipefail
export SC_NO_PAUSE=1
# shellcheck source=scripts/lib.sh
. "$(dirname "$0")/lib.sh"

BASE="$(web_url)/api"
USER_NAME="${TEST_ADMIN_USERNAME:-$(env_value ADMIN_USERNAME)}"
USER_PASS="${TEST_ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
JAR="$(mktemp)"
TMP="$(mktemp -d)"
trap 'rm -rf "$JAR" "$TMP"' EXIT

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
api() { curl -fsS -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' "$@"; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
check() { if [ "$2" = "$3" ]; then printf '  ✓ %s\n' "$1"; else printf '  ✗ %s: expected "%s", got "%s"\n' "$1" "$3" "$2"; exit 1; fi; }

wait_backup() {
  # wait_backup <ISO time before the request> — until a run that started after it has finished
  local since="$1" i=0 status
  while [ $i -lt 120 ]; do
    status="$(api "$BASE/backup/status")"
    if [ "$(jq -r '.running or .pending' <<<"$status")" = "false" ]; then
      local started
      started="$(jq -r '.lastRun.startedAt // ""' <<<"$status")"
      if [[ "$started" > "$since" ]]; then
        jq -r '.lastRun.status' <<<"$status"
        return 0
      fi
    fi
    sleep 3
    i=$((i + 1))
  done
  echo TIMEOUT
}

step "log in"
api -o /dev/null "$BASE/auth/login" -d "$(jq -n --arg u "$USER_NAME" --arg p "$USER_PASS" '{username:$u,password:$p}')"

STAMP="$(date +%s)"
NAME="Restore test $STAMP"
step "create test data: client \"$NAME\" + a company document"
CLIENT_ID="$(api "$BASE/clients" -d "$(jq -n --arg n "$NAME" '{name:$n,type:"PRIVATE"}')" | jq -r .id)"
printf '%%PDF-1.4\n%% restore test %s\n%%%%EOF\n' "$STAMP" >"$TMP/restore-test.pdf"
ORIGINAL_SHA="$(sha "$TMP/restore-test.pdf")"
DOC_ID="$(curl -fsS -b "$JAR" "$BASE/documents" \
  -F ownerType=COMPANY -F category=OTHER -F "title=Restore test $STAMP" \
  -F "file=@$TMP/restore-test.pdf;type=application/pdf" | jq -r .id)"
check "client created" "$([ -n "$CLIENT_ID" ] && echo yes)" yes
check "document created" "$([ -n "$DOC_ID" ] && echo yes)" yes

step "Backup now (through the app)"
SINCE="$(date -u +%Y-%m-%dT%H:%M:%S)"
api -o /dev/null -X POST "$BASE/backup/run"
check "backup finished" "$(wait_backup "$SINCE")" SUCCESS
check "status is green" "$(api "$BASE/backup/status" | jq -r .state)" OK

step "change the data after the backup"
api -o /dev/null -X PATCH "$BASE/clients/$CLIENT_ID" -d '{"name":"CHANGED AFTER BACKUP"}'
KEY="$(docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' \
  <<<"SELECT \"storageKey\" FROM \"DocumentVersion\" WHERE \"documentId\" = '$DOC_ID'")"
docker compose exec -T backup bash -c ". /usr/local/lib/backup/lib.sh && rclone deletefile \"store:\$S3_BUCKET/$KEY\""
check "client renamed" "$(api "$BASE/clients/$CLIENT_ID" | jq -r .name)" "CHANGED AFTER BACKUP"
GONE_CODE="$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/documents/$DOC_ID/download")"
check "file is gone" "$([ "$GONE_CODE" != 200 ] && echo yes)" yes

step "restore the latest local backup"
"$ROOT/scripts/restore.sh" --latest --yes

step "check the data is back"
api -o /dev/null "$BASE/auth/login" -d "$(jq -n --arg u "$USER_NAME" --arg p "$USER_PASS" '{username:$u,password:$p}')"
check "client name restored" "$(api "$BASE/clients/$CLIENT_ID" | jq -r .name)" "$NAME"
curl -fsS -b "$JAR" -o "$TMP/downloaded.pdf" "$BASE/documents/$DOC_ID/download"
check "file restored (same sha256)" "$(sha "$TMP/downloaded.pdf")" "$ORIGINAL_SHA"
check "the restored backup run is not stuck as RUNNING" \
  "$(api "$BASE/backup/runs?pageSize=100" | jq '[.items[] | select(.status == "RUNNING")] | length')" 0

step "clean up the test data"
api -o /dev/null -X DELETE "$BASE/documents/$DOC_ID"
api -o /dev/null -X DELETE "$BASE/clients/$CLIENT_ID"

printf '\n\033[1;32mRESTORE TEST PASSED\033[0m\n'
