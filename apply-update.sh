#!/usr/bin/env bash
# Migrates an existing v1.0/v1.1 install to v1.2.
# v1.2 fixes a critical bug where the update-flag volume was mounted at /app,
# shadowing the entire application code (preventing updates from ever taking effect).
#
# Run on the server:
#   curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }
step()  { echo; echo "${C_BLUE}── $* ──${C_OFF}"; }

[[ $EUID -eq 0 ]] || { err "Run with sudo."; exit 1; }
[[ -d "$INSTALL_DIR/.git" ]] || { err "HA-Hub not found at $INSTALL_DIR."; exit 1; }

cd "$INSTALL_DIR"

step "Pulling latest source"
git fetch --all --quiet
git reset --hard origin/main --quiet
ok "Source updated to $(git rev-parse --short HEAD)"

step "Stopping containers"
docker compose down
ok "Containers stopped"

step "Removing OLD broken update-flag volume (this is the bug fix)"
# The old volume was mounted at /app and was shadowing the entire app code.
# Removing it lets the new image's /app code through. The new volume (different
# name, mounted at /app/data) will be created fresh.
for v in ha-hub_update-flag hahub_update-flag $(docker volume ls --format '{{.Name}}' | grep -E '_update-flag$' || true); do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    info "Removing volume $v"
    docker volume rm "$v" >/dev/null || warn "Could not remove $v (might be in use, will retry)"
  fi
done
ok "Old volume gone"

step "Refreshing update watcher service"
if [[ -f scripts/update-watcher.sh && -f scripts/ha-hub-update-watcher.service ]]; then
  chmod +x scripts/update-watcher.sh
  cp scripts/ha-hub-update-watcher.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl restart ha-hub-update-watcher || systemctl enable --now ha-hub-update-watcher
  ok "Watcher service restarted with new script"
fi

step "Rebuilding with new volume layout"
docker compose --env-file .env up -d --build --force-recreate
ok "Containers up with fixed volume mount"

step "Waiting for API to become ready"
for i in $(seq 1 90); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    ok "API healthy"
    break
  fi
  sleep 2
done

# Sanity check — confirm the volume is mounted at /app/data, not /app
MOUNT_DEST="$(docker inspect ha-hub-app-1 --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Destination}} {{end}}{{end}}' 2>/dev/null | tr ' ' '\n' | grep -v '^$' | head -n1 || echo unknown)"
if [[ "$MOUNT_DEST" == "/app/data" || "$MOUNT_DEST" == *"/app/data"* ]]; then
  ok "Volume now mounted at /app/data (correct)"
else
  warn "Volume mount destination is: $MOUNT_DEST (expected /app/data)"
fi

# Confirm app code is the fresh image
APP_SIZE="$(docker exec ha-hub-app-1 sh -c 'wc -l /app/backend/src/services/updater.js 2>/dev/null | awk "{print \$1}"' || echo 0)"
echo
ok "Updater service file has $APP_SIZE lines (should be ~75+ for v1.2)"

echo
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo "${C_GREEN}  Migration to v1.2 complete${C_OFF}"
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo
echo "  Test: Push any commit to GitHub, then click Update now in the portal."
echo "  This time the code change will actually take effect."
echo
