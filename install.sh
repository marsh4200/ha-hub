#!/usr/bin/env bash
# HA-Hub one-line installer for Ubuntu 22.04+
set -Eeuo pipefail

REPO_URL="${HAHUB_REPO:-https://github.com/marsh4200/ha-hub.git}"
BRANCH="${HAHUB_BRANCH:-main}"
INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
DEPLOY_MODE="${HAHUB_MODE:-}"
PORT="${HAHUB_PORT:-8080}"
NONINTERACTIVE="${HAHUB_NONINTERACTIVE:-0}"

C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'; C_OFF=$'\033[0m'

info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }
step()  { echo; echo "${C_BOLD}${C_BLUE}── $* ──${C_OFF}"; }

ROLLBACK_CMDS=()
add_rollback() { ROLLBACK_CMDS+=("$1"); }
run_rollback() {
  warn "Installation failed — rolling back…"
  for ((i=${#ROLLBACK_CMDS[@]}-1; i>=0; i--)); do
    eval "${ROLLBACK_CMDS[i]}" || true
  done
  err "Rollback complete."
}
trap 'run_rollback' ERR

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
  if [[ $EUID -ne 0 ]]; then err "Please run as root (use: sudo bash …)"; exit 1; fi
}

detect_ubuntu() {
  if [[ ! -f /etc/os-release ]]; then err "Unsupported OS"; exit 1; fi
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    warn "Tuned for Ubuntu (${ID:-unknown} detected). Continuing."
  fi
  local major="${VERSION_ID%%.*}"
  if [[ -n "${VERSION_ID:-}" && "$major" -lt 22 ]]; then
    err "Ubuntu 22.04 or newer required (found $VERSION_ID)."; exit 1
  fi
  ok "OS: ${PRETTY_NAME:-$ID $VERSION_ID}"
}

ask_mode() {
  if [[ -n "$DEPLOY_MODE" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]] || [[ ! -t 0 ]]; then
    info "Defaulting to Docker mode"
    DEPLOY_MODE="docker"
    return
  fi
  echo
  echo "Choose deployment mode:"
  echo "  1) Docker Compose  (recommended)"
  echo "  2) Native"
  read -rp "Selection [1]: " sel
  case "${sel:-1}" in
    1) DEPLOY_MODE="docker" ;;
    2) DEPLOY_MODE="native" ;;
    *) err "Invalid choice"; exit 1 ;;
  esac
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
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
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
    git -C "$INSTALL_DIR" fetch --all --quiet
    git -C "$INSTALL_DIR" checkout "$BRANCH" --quiet
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" --quiet
  else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" --quiet
    add_rollback "rm -rf '$INSTALL_DIR'"
  fi
  ok "Source ready at $INSTALL_DIR"
}

write_env_docker() {
  step "Writing .env"
  local JWT DBPASS
  JWT="$(openssl rand -hex 64)"
  DBPASS="$(openssl rand -hex 16)"
  cat > "$INSTALL_DIR/.env" <<EOF
PORT=$PORT
PUBLIC_URL=http://$(hostname -I | awk '{print $1}'):$PORT
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
  chmod 600 "$INSTALL_DIR/.env"
  ok ".env generated"
}

start_docker() {
  step "Building and starting containers"
  cd "$INSTALL_DIR"
  docker compose --env-file .env up -d --build
  add_rollback "cd '$INSTALL_DIR' && docker compose down -v || true"
  ok "Containers running"
}

install_update_watcher() {
  if [[ -f "$INSTALL_DIR/scripts/ha-hub-update-watcher.service" && -f "$INSTALL_DIR/scripts/update-watcher.sh" ]]; then
    step "Installing update watcher"
    chmod +x "$INSTALL_DIR/scripts/update-watcher.sh"
    cp "$INSTALL_DIR/scripts/ha-hub-update-watcher.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now ha-hub-update-watcher >/dev/null 2>&1 || systemctl restart ha-hub-update-watcher
    ok "Update watcher running"
  fi
}

configure_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then return; fi
  step "Configuring UFW"
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow "$PORT"/tcp >/dev/null 2>&1 || true
  if ! ufw status | grep -q "Status: active"; then
    yes | ufw enable >/dev/null 2>&1 || true
  fi
  ok "Firewall: port $PORT open"
}

wait_healthy() {
  step "Waiting for HA-Hub to become ready"
  local url="http://localhost:$PORT/api/health"
  for i in $(seq 1 90); do
    if curl -fsS "$url" >/dev/null 2>&1; then ok "API healthy"; return 0; fi
    sleep 2
  done
  warn "API didn't respond on $url within 3 min — check logs"
  return 1
}

finish() {
  local IP; IP="$(hostname -I | awk '{print $1}')"
  echo
  echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo "${C_GREEN}  HA-Hub is installed!${C_OFF}"
  echo "${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo
  echo "  Open: http://${IP}:${PORT}"
  echo "  Logs: cd $INSTALL_DIR && docker compose logs -f"
  echo "  Updates: Portal → Settings → Updates → Update now"
  echo
  trap - ERR
}

main() {
  banner
  require_root
  detect_ubuntu
  ask_mode
  ensure_basics
  ensure_docker
  clone_repo
  write_env_docker
  start_docker
  install_update_watcher
  configure_firewall
  wait_healthy || true
  finish
}

main "$@"
