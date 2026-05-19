#!/usr/bin/env bash
# HA-Hub migration / update script — protects .env, handles dirty git tree,
# fixes the volume-shadow bug from v1.1, and installs the in-portal updater.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
ENV_FILE="$INSTALL_DIR/.env"
BACKUP_DIR="$(mktemp -d)"

C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }
step()  { echo; echo "${C_BLUE}── $* ──${C_OFF}"; }

[[ $EUID -eq 0 ]] || { err "Run with sudo."; exit 1; }
[[ -d "$INSTALL_DIR/.git" ]] || { err "HA-Hub not found at $INSTALL_DIR."; exit 1; }

trap 'rm -rf "$BACKUP_DIR"' EXIT

cd "$INSTALL_DIR"

step "Protecting .env file"
if [[ -f "$ENV_FILE" ]]; then
  cp -p "$ENV_FILE" "$BACKUP_DIR/.env.backup"
  ok ".env backed up"
else
  warn ".env does not exist — will generate a fresh one"
fi

step "Force-resetting local git tree"
git fetch --all --quiet
git reset --hard origin/main --quiet
ok "Source reset to $(git rev-parse --short HEAD)"

step "Restoring .env"
if [[ -f "$BACKUP_DIR/.env.backup" ]]; then
  cp -p "$BACKUP_DIR/.env.backup" "$ENV_FILE"
  chmod 644 "$ENV_FILE"
  ok ".env restored"
else
  info "Generating fresh .env with random secrets"
  IP="$(hostname -I | awk '{print $1}')"
  cat > "$ENV_FILE" <<EOF
PORT=8080
PUBLIC_URL=http://${IP}:8080
POSTGRES_USER=hahub
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=hahub
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=12h
COOKIE_SECURE=false
HEARTBEAT_TIMEOUT_SECONDS=90
URL_POLL_INTERVAL_SECONDS=30
URL_POLL_TIMEOUT_SECONDS=10
CORS_ORIGIN=*
UPDATE_REPO=https://github.com/marsh4200/ha-hub.git
UPDATE_BRANCH=main
EOF
  chmod 644 "$ENV_FILE"
  ok ".env generated"
fi

if [[ ! -s "$ENV_FILE" ]]; then
  err ".env is empty after restore — aborting"
  exit 1
fi

step "Stopping containers"
docker compose down >/dev/null 2>&1 || true
ok "Containers stopped"

step "Removing broken old volumes (if any)"
for v in $(docker volume ls --format '{{.Name}}' | grep -E '_update-flag$' || true); do
  info "Removing volume: $v"
  docker volume rm "$v" >/dev/null 2>&1 || warn "Could not remove $v"
done
ok "Old volumes cleared"

step "Refreshing watcher service"
if [[ -f scripts/update-watcher.sh && -f scripts/ha-hub-update-watcher.service ]]; then
  chmod +x scripts/update-watcher.sh
  cp scripts/ha-hub-update-watcher.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl restart ha-hub-update-watcher 2>/dev/null || systemctl enable --now ha-hub-update-watcher
  ok "Watcher running with new script"
fi

step "Rebuilding image (1-2 min)"
docker compose build --no-cache app
ok "Image built"

step "Starting containers"
docker compose up -d --force-recreate
ok "Containers up"

step "Waiting for API"
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 || echo 8080)"
for i in $(seq 1 90); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    ok "API healthy"
    break
  fi
  sleep 2
done

step "Verification"
MOUNT="$(docker inspect ha-hub-app-1 --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Destination}} {{end}}{{end}}' 2>/dev/null || echo unknown)"
if echo "$MOUNT" | grep -q "/app/data"; then
  ok "Volume mounted at /app/data ✓"
else
  warn "Volume: $MOUNT (expected /app/data)"
fi

V_IN_CONTAINER="$(docker exec ha-hub-app-1 cat /app/VERSION 2>/dev/null || echo MISSING)"
if [[ "$V_IN_CONTAINER" != "MISSING" ]]; then
  ok "VERSION in container: $V_IN_CONTAINER ✓"
else
  warn "VERSION file missing"
fi

IP="$(hostname -I | awk '{print $1}')"
echo
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo "${C_GREEN}  Update complete${C_OFF}"
echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
echo
echo "  Open: http://${IP}:${PORT}"
echo "  Future updates: Settings → Updates → Update now"
echo
