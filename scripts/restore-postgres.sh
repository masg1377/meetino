#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Meetino — Postgres restore
#
# WARNING: this DROPS and recreates the database before restoring.
# Make a fresh backup first if there's anything you want to keep.
#
# Usage:
#   ./scripts/restore-postgres.sh path/to/meetino_YYYY-MM-DD_HH-mm-ss.dump
#
# Steps:
#   1. Stop the API + web (so no connections hold the DB open).
#   2. Drop + recreate the target database.
#   3. pg_restore from the dump file.
#   4. Restart API + web.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <dump-file>" >&2
  exit 2
fi

DUMP_FILE="$1"
if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "✗ Dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found." >&2
  exit 1
fi

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_USER="${POSTGRES_USER:-meetino}"
POSTGRES_DB="${POSTGRES_DB:-meetino}"

cat <<EOF
⚠  About to OVERWRITE database '${POSTGRES_DB}' from:
   ${DUMP_FILE}

This will:
  - stop meetino_api and meetino_web
  - DROP DATABASE ${POSTGRES_DB};
  - CREATE DATABASE ${POSTGRES_DB};
  - pg_restore the dump
  - restart api/web

Press Enter to continue, Ctrl-C to abort.
EOF
read -r _

echo "→ Stopping api + web..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop api web

echo "→ Dropping and recreating database..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d postgres -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE \"${POSTGRES_DB}\";"

echo "→ Restoring..."
# `--clean --if-exists` keeps the restore idempotent.
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_restore \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-owner \
    --clean --if-exists \
    --verbose \
  < "${DUMP_FILE}"

echo "→ Starting api + web..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" start api web

echo "✓ Restore complete. Run /api/health/ready in a minute to confirm."
