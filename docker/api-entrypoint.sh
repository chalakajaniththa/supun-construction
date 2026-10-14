#!/bin/sh
# API container start: apply migrations, seed (idempotent), then run the API.
set -e
echo "[api] applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy
echo "[api] seeding (admin, settings, sample data if enabled)…"
node dist/seed/index.js
echo "[api] starting…"
exec node dist/main.js
