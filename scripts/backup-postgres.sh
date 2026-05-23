#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Meetino — Postgres backup
#
# Runs `pg_dump --format=custom` against the postgres container and
# writes a timestamped archive to `infra/docker/backups/`. The custom
# format compresses well and is restorable with `pg_restore`.
#
# Usage:
#   ./scripts/backup-postgres.sh            # creates meetino_YYYY-MM-DD_HH-mm-ss.dump
#   ./scripts/backup-postgres.sh /path      # writes to /path instead
#
# Retention: by default we keep the 14 most-recent dumps. Override with
#   MEETINO_BACKUP_KEEP=30 ./scripts/backup-postgres.sh
#
# We do NOT push to any cloud — copy the backups off-server manually
# (rsync, scp, restic-to-private-server) per the security checklist.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.production"
BACKUP_DIR="${1:-${REPO_ROOT}/infra/docker/backups}"
KEEP="${MEETINO_BACKUP_KEEP:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found. Create it from .env.production.example first." >&2
  exit 1
fi

# Pull POSTGRES_USER + POSTGRES_DB out of the env file so we don't have
# to source it (sourcing untrusted env files is asking for trouble).
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true)"
POSTGRES_USER="${POSTGRES_USER:-meetino}"
POSTGRES_DB="${POSTGRES_DB:-meetino}"

mkdir -p "${BACKUP_DIR}"

TS="$(date +%Y-%m-%d_%H-%M-%S)"
OUTFILE="${BACKUP_DIR}/meetino_${TS}.dump"

echo "→ Dumping database '${POSTGRES_DB}' as user '${POSTGRES_USER}' → ${OUTFILE}"

# `--no-owner` makes the dump easier to restore into a fresh DB that
# might have a different owning role.
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_dump \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=custom \
  --no-owner \
  --compress=6 \
  > "${OUTFILE}"

SIZE="$(du -h "${OUTFILE}" | cut -f1)"
echo "✓ Wrote ${OUTFILE} (${SIZE})"

# Retention. Keep the N newest *.dump files; remove the rest.
if [[ "${KEEP}" -gt 0 ]]; then
  CANDIDATES=( $(ls -1t "${BACKUP_DIR}"/meetino_*.dump 2>/dev/null || true) )
  TOTAL="${#CANDIDATES[@]}"
  if (( TOTAL > KEEP )); then
    PRUNE=( "${CANDIDATES[@]:KEEP}" )
    echo "→ Pruning $((TOTAL - KEEP)) old dump(s) (keeping ${KEEP})"
    for f in "${PRUNE[@]}"; do
      echo "  - $(basename "$f")"
      rm -f -- "$f"
    done
  fi
fi
