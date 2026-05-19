#!/usr/bin/env bash
# HA-Hub one-line installer for Ubuntu 22.04+
set -Eeuo pipefail

REPO_URL="${HAHUB_REPO:-https://github.com/marsh4200/ha-hub.git}"
BRANCH="${HAHUB_BRANCH:-main}"
INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
PORT="${HAHUB_PORT:-8080}"
ENV_FILE="$INSTALL_DIR/.env"

C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'; C_OFF=$'\033[0m'

info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }
step()  { echo; echo "${C_BOLD}${C_BLUE}── $* ──${C_OFF}"; }

banner() {
cat <<'EOF'
  _   _    _      _   _       _
 | | | |  / \    | | | |_   _| |__
 | |_| | / _ \   | |_| | | | | '_ \
 |  _  |/ ___ \  |  _  | |_| | |_) |
 |_| |_/_/   \_\ |_| |_|\__,_|_.__/
   Home Assistant multi-tenant manager
EOF
}

require_root() {
  if [[ $EUID -ne 0 ]]; then err "Run with sudo."; exit 1; fi
}

detect_ubuntu() {
  [[ -f /etc/os-release ]] || { err "Unsupported OS"; exit 1; }
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    warn "Tuned for Ubuntu — detected ${ID:-unknown}. Continuing."
  fi
  local major="${VERSION_ID%%.*}"
  if [[ -n "${VERSION_ID:-}" && "$major" -lt 22 ]]; then
    err "Ubuntu 22.04 or newer required (found $VERSION_ID)."; exit 1
  fi
  ok "OS: ${PRETTY_NAME:-$ID $VERSION_ID}"
}

apt_refresh() {
  info "Refreshing apt index…"
  DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@" >/dev/null
}

ensure_basics() {
  step "Installing base packages"
  apt_refresh
  apt_install ca-certificates curl gnupg git ufw openssl
  ok "Base packages ready"
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker already installed"
    return
  fi
  step "Installing Docker Engine + compose plugin"

  rm -f /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.gpg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  local codename arch
  codename="$(. /etc/os-release; echo "$VERSION_CODENAME")"
  arch="$(dpkg --print-architecture)"
  echo "deb [arch=$arch signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list

  info "Refreshing apt with Docker repo…"
  DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null

  apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed"
}

clone_repo() {
  step "Fetching HA-Hub source"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing checkout found — updating"
    git -C "$INSTALL_DIR" fetch --all --quiet
    git -C "$INSTALL_DIR" checkout "$BRANCH" --quiet
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" --quiet
    ok "Source updated to $(git -C "$INSTALL_DIR" rev-parse --short HEAD)"
  else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" --quiet
    ok "Source cloned"
  fi
}

write_env() {
  step "Configuring .env"
  if [[ -f "$ENV_FILE" ]]; then
    info "Existing .env detected — keeping it"
    chmod 644 "$ENV_FILE"
    ok ".env preserved"
    return
  fi

  local IP JWT DBPASS
  IP="$(hostname -I | awk '{print $1}')"
  JWT="$(openssl rand -hex 64)"
  DBPASS="$(openssl rand -hex 16)"

  cat > "$ENV_FILE" <<EOF
PORT=$PORT
PUBLIC_URL=http://${IP}:${PORT}
POSTGRES_USER=hahub
POSTGRES_PASSWORD=$DBPASS
POSTGRES_DB=hahub
JWT_SECRET=$JWT
JWT_EXPIRES_IN=12h
COOKIE_SECURE=false
HEARTBEAT_TIMEOUT_SECONDS=90
URL_POLL_INTERVAL_SECONDS=30
URL_POLL_TIMEOUT_SECONDS=10
CORS_ORIGIN=*
UPDATE_REPO=$REPO_URL
UPDATE_BRANCH=$BRANCH
EOF
  chmod 644 "$ENV_FILE"

  if [[ ! -s "$ENV_FILE" ]]; then
    err ".env was not written — aborting"; exit 1
  fi
  ok ".env generated with random secrets"
}

install_update_watcher() {
  if [[ ! -f "$INSTALL_DIR/scripts/update-watcher.sh" ]]; then
    warn "Watcher script not in repo — in-portal Update button won't work"
    return
  fi
  step "Installing in-portal update watcher"
  chmod +x "$INSTALL_DIR/scripts/update-watcher.sh"
  cp "$INSTALL_DIR/scripts/ha-hub-update-watcher.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now ha-hub-update-watcher 2>/dev/null || systemctl restart ha-hub-update-watcher
  ok "Update watcher running"
}

start_docker() {
  step "Building image (this can take 2-3 min on first run)"
  cd "$INSTALL_DIR"
  docker compose build app
  ok "Image built"

  step "Starting containers"
  docker compose up -d --force-recreate
  ok "Containers up"
}

configure_firewall() {
  command -v ufw >/dev/null 2>&1 || return
  step "Configuring UFW"
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow "$PORT"/tcp >/dev/null 2>&1 || true
  if ! ufw status | grep -q "Status: active"; then
    yes | ufw enable >/dev/null 2>&1 || true
  fi
  ok "Firewall: port $PORT open"
}

wait_healthy() {
  step "Waiting for HA-Hub to become ready (up to 3 minutes)"
  local url="http://localhost:$PORT/api/health"

  for i in $(seq 1 60); do
    local status
    status="$(docker inspect -f '{{.State.Status}}' ha-hub-app-1 2>/dev/null || echo missing)"
    if [[ "$status" == "running" ]]; then break; fi
    sleep 2
  done

  for i in $(seq 1 90); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "API healthy"
      return 0
    fi
    sleep 2
  done

  warn "API didn't respond within 3 minutes"
  warn "Check logs: cd $INSTALL_DIR && docker compose logs --tail 50 app"
  return 1
}

verify_install() {
  step "Verifying installation"
  local app_status db_status mount v

  app_status="$(docker inspect -f '{{.State.Status}}' ha-hub-app-1 2>/dev/null || echo missing)"
  db_status="$(docker inspect -f '{{.State.Status}}' ha-hub-db-1 2>/dev/null || echo missing)"

  [[ "$app_status" == "running" ]] && ok "App container: running ✓" || err "App container: $app_status"
  [[ "$db_status"  == "running" ]] && ok "DB container: running ✓"  || err "DB container: $db_status"

  mount="$(docker inspect ha-hub-app-1 --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Destination}} {{end}}{{end}}' 2>/dev/null || echo unknown)"
  if echo "$mount" | grep -q "/app/data"; then
    ok "Volume mount: /app/data ✓"
  else
    warn "Volume mount: $mount (expected /app/data)"
  fi

  v="$(docker exec ha-hub-app-1 cat /app/VERSION 2>/dev/null || echo MISSING)"
  if [[ "$v" != "MISSING" ]]; then
    ok "Installed version: $v ✓"
  else
    warn "VERSION file missing from container"
  fi
}

finish() {
  local IP; IP="$(hostname -I | awk '{print $1}')"
  echo
  echo "${C_BOLD}${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo "${C_BOLD}${C_GREEN}  HA-Hub installed successfully!${C_OFF}"
  echo "${C_BOLD}${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo
  echo "  Open in browser:  ${C_BOLD}http://${IP}:${PORT}${C_OFF}"
  echo "  You'll be prompted to create the first admin account."
  echo
  echo "  Install dir:      $INSTALL_DIR"
  echo "  API docs:         http://${IP}:${PORT}/api/docs"
  echo
  echo "  Logs:    cd $INSTALL_DIR && docker compose logs -f"
  echo "  Stop:    cd $INSTALL_DIR && docker compose down"
  echo
  echo "  ${C_BOLD}Future updates:${C_OFF} Settings → Updates → Update now"
  echo
}

main() {
  banner
  require_root
  detect_ubuntu
  ensure_basics
  ensure_docker
  clone_repo
  write_env
  install_update_watcher
  start_docker
  configure_firewall
  wait_healthy || true
  verify_install
  finish
}

main "$@"
