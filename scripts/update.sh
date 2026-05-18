#!/usr/bin/env bash
# Updates HA-Hub to the latest commit on the current branch.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
cd "$INSTALL_DIR"

C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_OFF=$'\033[0m'
info() { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()   { echo "${C_GREEN}✓${C_OFF} $*"; }

info "Pulling latest source"
git fetch --all --quiet
git reset --hard "@{u}" --quiet
ok "Source updated to $(git rev-parse --short HEAD)"

# Auto-detect deployment mode
if [[ -f docker-compose.yml ]] && docker compose ps >/dev/null 2>&1 && [[ -n "$(docker compose ps -q 2>/dev/null)" ]]; then
  info "Rebuilding Docker containers"
  docker compose --env-file .env up -d --build
  ok "Containers updated"
else
  info "Installing backend deps"
  ( cd backend && npm ci --omit=dev --silent && npx prisma generate >/dev/null )

  info "Building frontend"
  ( cd frontend && npm ci --silent && npm run build --silent )

  info "Applying migrations"
  ( cd backend && npx prisma migrate deploy )

  info "Restarting PM2"
  pm2 restart ha-hub-api --update-env
  ok "Service restarted"
fi

ok "Update complete"
