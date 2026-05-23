#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Meetino — render the nginx *.conf.template files using
# values from .env.production.
#
# Run once during initial setup, and again whenever you change a
# DOMAIN / API_DOMAIN / LIVEKIT_DOMAIN. After running:
#
#   docker compose -f infra/docker/docker-compose.prod.yml exec nginx nginx -t
#   docker compose -f infra/docker/docker-compose.prod.yml exec nginx nginx -s reload
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.production"
CONF_DIR="${REPO_ROOT}/infra/docker/nginx/conf.d"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found. Copy from .env.production.example first." >&2
  exit 1
fi

# Pull just the keys we substitute. Anything unset stays empty (then we
# fail loudly below if a template still has the placeholder).
read_env() {
  grep -E "^$1=" "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true
}
DOMAIN="$(read_env DOMAIN)"
API_DOMAIN="$(read_env API_DOMAIN)"
LIVEKIT_DOMAIN="$(read_env LIVEKIT_DOMAIN)"

for v in DOMAIN API_DOMAIN LIVEKIT_DOMAIN; do
  if [[ -z "${!v:-}" ]]; then
    echo "✗ ${v} is empty in ${ENV_FILE}" >&2
    exit 1
  fi
done

shopt -s nullglob
for tpl in "${CONF_DIR}"/*.conf.template; do
  out="${tpl%.template}"
  echo "→ Rendering $(basename "$tpl") → $(basename "$out")"
  DOMAIN="${DOMAIN}" \
  API_DOMAIN="${API_DOMAIN}" \
  LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN}" \
    envsubst '${DOMAIN} ${API_DOMAIN} ${LIVEKIT_DOMAIN}' < "${tpl}" > "${out}"
done

echo "✓ Done. Now reload nginx."
