#!/usr/bin/env bash
# HA-Hub one-command updater.
# Pulls latest from GitHub, installs the in-portal update watcher (if needed),
# rebuilds, and restarts everything.
#
# Usage on the server:
#   curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }

[[ $EUID -eq 0 ]] || { err "Please run with sudo."; exit 1; }
[[ -d "$INSTALL_DIR/.git" ]] || { err "HA-Hub not found at $INSTALL_DIR. Run install.sh first."; exit 1; }

cd "$INSTALL_DIR"

info "Pulling latest source from GitHub"
git fetch --all --quiet
git reset --hard origin/main --quiet
ok "Source updated to $(git rev-parse --short HEAD)"

# Install / refresh the update-watcher systemd service (idempotent)
if [[ -f scripts/ha-hub-update-watcher.service && -f scripts/update-watcher.sh ]]; then
  info "Installing in-portal update watcher"
  chmod +x scripts/update-watcher.sh
  cp scripts/ha-hub-update-watcher.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now ha-hub-update-watcher >/dev/null 2>&1 || systemctl restart ha-hub-update-watcher
  ok "Update watcher running"
fi

info "Rebuilding containers"
docker compose --env-file .env up -d --build
ok "Containers up"

# Wait for health
info "Waiting for API to become ready"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    ok "API healthy"
    break
  fi
  sleep 2
done

PORT_BIND="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo 8080)"
IP="$(hostname -I | awk '{print $1}')"
echo
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo "${C_GREEN}  HA-Hub updated successfully${C_OFF}"
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo
echo "  Open:  http://${IP}:${PORT_BIND}"
echo "  From now on you can update via Settings → Updates → Update now"
echo
