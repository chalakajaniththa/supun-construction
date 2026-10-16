#!/bin/bash
# Shared helpers for the Mac scripts (*.command). Sourced, never run directly.
# Keep it compatible with macOS's built-in bash 3.2 (no associative arrays, no ${x,,}).

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ROOT="$(pwd)"
export ROOT
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-supun}"

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
info() { printf '%s\n' "$1"; }
warn() { printf '\n\033[33m%s\033[0m\n' "$1"; }
fail() {
  printf '\n\033[31m%s\033[0m\n' "$1"
  pause_if_double_clicked
  exit 1
}

# Keep the Terminal window open when the script was double-clicked in Finder.
pause_if_double_clicked() {
  if [ -t 0 ] && [ -z "${SC_NO_PAUSE:-}" ]; then
    read -r -p "Press Enter to close this window…" _ || true
  fi
}

is_mac() { [ "$(uname -s)" = "Darwin" ]; }

open_url() {
  [ -n "${SC_NO_OPEN:-}" ] && return 0
  if is_mac; then open "$1" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true
  fi
}

# Docker installed and running (starts Docker Desktop on the Mac and waits up to ~3 minutes).
ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker Desktop is not installed.
Install it from https://www.docker.com/products/docker-desktop/ (choose \"Apple Silicon\"), open it once, then try again."
  fi
  if docker info >/dev/null 2>&1; then return 0; fi
  bold "Docker is not running — starting Docker Desktop… (this can take a minute)"
  if is_mac; then open -a Docker >/dev/null 2>&1 || true; fi
  local i=0
  while [ $i -lt 60 ]; do
    if docker info >/dev/null 2>&1; then info "Docker is running."; return 0; fi
    sleep 3
    i=$((i + 1))
  done
  fail "Docker Desktop did not start. Open \"Docker\" from your Applications folder, wait until the whale icon in the top bar stops moving, then double-click this file again."
}

env_value() {
  # env_value KEY → the value from .env (empty when missing)
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2-
}

random_secret() { openssl rand -hex 24; }

set_env_value() {
  # set_env_value KEY VALUE — replaces the line or appends it
  if grep -qE "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}

NEW_BACKUP_PASSWORD=""

# Creates .env with fresh random secrets on the first start; adds settings that newer versions
# need (e.g. RESTIC_PASSWORD) to an existing .env without touching anything else.
ensure_env() {
  if [ ! -f .env ]; then
    bold "First start: creating the settings file (.env) with new random passwords…"
    cp .env.example .env
    local key
    for key in POSTGRES_PASSWORD JWT_SECRET S3_ACCESS_KEY S3_SECRET_KEY RESTIC_PASSWORD; do
      set_env_value "$key" "$(random_secret)"
    done
    NEW_BACKUP_PASSWORD="$(env_value RESTIC_PASSWORD)"
  fi
  local current
  current="$(env_value RESTIC_PASSWORD)"
  if [ -z "$current" ] || [ "$current" = "change-me-backup-password-0123456789" ]; then
    set_env_value RESTIC_PASSWORD "$(random_secret)"
    NEW_BACKUP_PASSWORD="$(env_value RESTIC_PASSWORD)"
  fi
  chmod 600 .env 2>/dev/null || true
  mkdir -p config/rclone
}

show_backup_password_once() {
  [ -n "$NEW_BACKUP_PASSWORD" ] || return 0
  bold "IMPORTANT — your backup password:"
  printf '\n    \033[1;33m%s\033[0m\n\n' "$NEW_BACKUP_PASSWORD"
  info "Write it down on paper and keep it somewhere safe."
  info "Without this password your backups can NOT be restored (not even from Google Drive)."
  info "It is also saved in the file .env in this folder."
  if [ -t 0 ] && [ -z "${SC_NO_PAUSE:-}" ]; then
    read -r -p "Press Enter when you have written it down…" _ || true
  fi
}

web_url() {
  local port
  port="$(env_value WEB_PORT)"
  printf 'http://localhost:%s' "${port:-3000}"
}

# Waits until every service is healthy and the login page answers (default 10 minutes).
wait_ready() {
  local timeout="${1:-600}" waited=0 url
  url="$(web_url)"
  bold "Waiting for the system to be ready…"
  while [ $waited -lt "$timeout" ]; do
    if curl -fsS -o /dev/null "$url/login" 2>/dev/null; then
      info "Ready."
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
    if [ $((waited % 30)) -eq 0 ]; then info "  still starting… ($waited s)"; fi
  done
  warn "The system did not become ready within $((timeout / 60)) minutes."
  info "Status of the parts:"
  docker compose ps
  info "Details: docker compose logs --tail 50 api web"
  return 1
}
