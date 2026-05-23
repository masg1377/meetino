#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Meetino — safe production redeploy
#
# Pipeline:
#   1) git pull            — fast-forward only; abort on merge conflict
#   2) backup-postgres.sh  — known-good snapshot before migrations
#   3) docker compose build — rebuild api + web images
#   4) prisma migrate deploy  (one-shot container)
#   5) docker compose up -d --no-deps --build api web   (rolling-ish)
#   6) nginx reload         — picks up any new vhost configs
#   7) smoke check          — hits /api/health/ready
#
# Run this from the repo root on the VPS as the user who owns the code.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="infra/docker/docker-compose.prod.yml"
ENV_FILE=".env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found. Aborting." >&2
  exit 1
fi

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1/api/health/ready}"
DC=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. git pull ──────────────────────────────────────────────
step "Pulling latest changes"
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree has local changes. Stash or commit before deploying."
fi
git fetch --all --prune
git pull --ff-only

# ── 2. backup ────────────────────────────────────────────────
step "Backing up Postgres"
./scripts/backup-postgres.sh

# ── 3. build ─────────────────────────────────────────────────
step "Building api + web images"
"${DC[@]}" build api web

# ── 4. migrate ───────────────────────────────────────────────
step "Running Prisma migrations"
# Use the api image we just built; --rm so the container is disposable.
"${DC[@]}" run --rm \
  --entrypoint sh \
  api -c "cd /app/apps/api && node_modules/.bin/prisma migrate deploy --schema=src/prisma/schema.prisma"

# ── 5. restart ───────────────────────────────────────────────
step "Recreating api + web"
"${DC[@]}" up -d --no-deps api web

step "Reloading nginx"
if "${DC[@]}" ps nginx | grep -q 'Up'; then
  "${DC[@]}" exec nginx nginx -s reload || warn "nginx reload failed (will retry on next deploy)"
fi

# ── 6. smoke check ──────────────────────────────────────────
step "Smoke-testing API readiness"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 5 "${API_HEALTH_URL}" >/dev/null; then
    ok "API ready at ${API_HEALTH_URL}"
    break
  fi
  echo "  …waiting (${i}/10)"
  sleep 3
  if [[ "$i" == "10" ]]; then
    die "API never became ready. Check 'docker compose logs api'."
  fi
done

ok "Deploy finished. Take a manual peek at the room to confirm media works."
