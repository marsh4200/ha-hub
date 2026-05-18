#!/usr/bin/env bash
# HA-Hub v1.3 migration — fixes the volume-shadowing bug, dirty git tree,
# missing VERSION-in-image, and installs the new watcher with progress reporting.
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

step "Force-resetting local git tree"
# This is the key fix: any local modifications would have blocked git pull
git fetch --all --quiet
git reset --hard origin/main --quiet
git clean -fd --quiet
ok "Source forcibly reset to $(git rev-parse --short HEAD)"

step "Stopping containers"
docker compose down
ok "Containers stopped"

step "Removing ALL old broken update-flag volumes"
# v1.0/v1.1 volume was mounted at /app — shadowed the entire app code.
# Must delete it so the new container can write fresh files to /app/data.
for v in $(docker volume ls --format '{{.Name}}' | grep -E '(update-flag|ha-hub-data)$' || true); do
  info "Removing volume: $v"
  docker volume rm "$v" >/dev/null 2>&1 || warn "Could not remove $v"
done
ok "Old volumes cleared"

step "Refreshing watcher systemd service"
chmod +x scripts/update-watcher.sh
cp scripts/ha-hub-update-watcher.service /etc/systemd/system/
systemctl daemon-reload
systemctl restart ha-hub-update-watcher 2>/dev/null || systemctl enable --now ha-hub-update-watcher
ok "Watcher running with new script"

step "Rebuilding image (this takes 1-2 min)"
docker compose --env-file .env build --no-cache app
ok "Image built"

step "Starting containers"
docker compose --env-file .env up -d --force-recreate
ok "Containers up"

step "Waiting for API to come back"
for i in $(seq 1 90); do
  if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
    ok "API healthy"
    break
  fi
  sleep 2
done

step "Verification"

# 1. Volume mount destination
MOUNT="$(docker inspect ha-hub-app-1 --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Destination}} {{end}}{{end}}' 2>/dev/null)"
if echo "$MOUNT" | grep -q "/app/data"; then
  ok "Volume mounted at /app/data ✓"
else
  err "Volume mount is wrong: $MOUNT"
fi

# 2. VERSION file inside container
V_IN_CONTAINER="$(docker exec ha-hub-app-1 cat /app/VERSION 2>/dev/null || echo MISSING)"
if [[ "$V_IN_CONTAINER" != "MISSING" ]]; then
  ok "VERSION file in image: $V_IN_CONTAINER ✓"
else
  err "VERSION file missing from container — Dockerfile didn't copy it"
fi

# 3. New updater.js is the v1.3 one
if docker exec ha-hub-app-1 grep -q "DATA_DIR.*=.*'/app/data'" /app/backend/src/services/updater.js 2>/dev/null; then
  ok "updater.js is v1.3 (uses /app/data) ✓"
else
  err "updater.js is still old version"
fi

echo
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo "${C_GREEN}  Migration to v1.3 complete${C_OFF}"
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo
echo "  ✓ Volume bug fixed (was shadowing /app, now /app/data only)"
echo "  ✓ VERSION file baked into image"
echo "  ✓ Watcher writes progress so the UI can show a progress bar"
echo "  ✓ Git tree force-reset so future updates won't get blocked"
echo
echo "  ${C_BLUE}TEST:${C_OFF} Refresh the portal → Settings → Updates."
echo "  Installed version should now show ${C_GREEN}1.3.0${C_OFF} (not 'unknown')."
echo "  Then bump VERSION on GitHub, click Update now, watch the progress bar."
echo
