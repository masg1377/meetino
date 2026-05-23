#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Meetino — issue Let's Encrypt certs for all three vhosts.
#
# Prerequisite: DNS A records for DOMAIN / API_DOMAIN / LIVEKIT_DOMAIN
# (and TURN_DOMAIN, if you're issuing for TURN-TLS) point at SERVER_IP.
# Port 80 must be reachable from the public internet for HTTP-01.
#
# Strategy: webroot, NOT standalone, so we don't have to stop nginx.
# Nginx already serves /.well-known/acme-challenge from /var/www/acme
# (see infra/docker/nginx/conf.d/00-acme.conf).
#
# Run once during initial setup. After that, renewal is handled by the
# `certbot renew --quiet` cron entry described in README.production.md.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/docker/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.production"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "✗ ${ENV_FILE} not found." >&2
  exit 1
fi

read_env() { grep -E "^$1=" "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' || true; }

DOMAIN="$(read_env DOMAIN)"
API_DOMAIN="$(read_env API_DOMAIN)"
LIVEKIT_DOMAIN="$(read_env LIVEKIT_DOMAIN)"
TURN_DOMAIN="$(read_env TURN_DOMAIN)"
SSL_EMAIL="$(read_env SSL_EMAIL)"

for v in DOMAIN API_DOMAIN LIVEKIT_DOMAIN SSL_EMAIL; do
  [[ -n "${!v:-}" ]] || { echo "✗ ${v} is empty in ${ENV_FILE}" >&2; exit 1; }
done

# TURN cert is optional. If you want TURN-TLS, set TURN_DOMAIN as well.
DOMAINS=( "${DOMAIN}" "${API_DOMAIN}" "${LIVEKIT_DOMAIN}" )
if [[ -n "${TURN_DOMAIN:-}" && "${TURN_DOMAIN}" != "turn.meetino.example.com" ]]; then
  DOMAINS+=( "${TURN_DOMAIN}" )
fi

DC=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

echo "→ Issuing certs for: ${DOMAINS[*]}"

for d in "${DOMAINS[@]}"; do
  echo
  echo "→ Requesting cert for ${d}"
  "${DC[@]}" run --rm --profile ssl certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/acme \
    --email "${SSL_EMAIL}" \
    --agree-tos --no-eff-email \
    --non-interactive \
    --keep-until-expiring \
    -d "${d}"
done

echo
echo "→ Reloading nginx so it picks up the new certs"
"${DC[@]}" exec nginx nginx -s reload || true

echo "✓ Done."
