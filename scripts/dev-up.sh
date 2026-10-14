#!/bin/bash
# Developer helper: start the dev infrastructure (postgres :5433, SeaweedFS :8334, Gotenberg :3002).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.dev.yml up -d --wait
