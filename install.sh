#!/usr/bin/env bash
# HA-Hub one-line installer for Ubuntu 22.04+
# Usage:
#   bash <(curl -sSL https://raw.githubusercontent.com/YOUR_USER/ha-hub/main/install.sh)
set -Eeuo pipefail

# ====== Config (override via env) ======
REPO_URL="${HAHUB_REPO:-https://github.com/YOUR_USER/ha-hub.git}"
BRANCH="${HAHUB_BRANCH:-main}"
INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
DEPLOY_MODE="${HAHUB_MODE:-}"             # docker | native | (prompt)
PORT="${HAHUB_PORT:-8080}"
NONINTERACTIVE="${HAHUB_NONINTERACTIVE:-0}"

# ====== Pretty output ======
C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'

info()  { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()    { echo "${C_GREEN}✓${C_OFF} $*"; }
warn()  { echo "${C_YELLOW}!${C_OFF} $*"; }
err()   { echo "${C_RED}✗${C_OFF} $*" >&2; }
step()  { echo; echo "${C_BOLD}${C_BLUE}── $* ──${C_OFF}"; }

# ====== Rollback ======
ROLLBACK_CMDS=()
add_rollback() { ROLLBACK_CMDS+=("$1"); }
run_rollback() {
  warn "Installation failed — rolling back…"
  for ((i=${#ROLLBACK_CMDS[@]}-1; i>=0; i--)); do
    eval "${ROLLBACK_CMDS[i]}" || true
  done
  err "Rollback complete. See messages above."
}
trap 'run_rollback' ERR

# ====== Pre-flight ======
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
  if [[ $EUID -ne 0 ]]; then
    err "Please run as root (use: sudo bash …)"; exit 1
  fi
}

detect_ubuntu() {
  if [[ ! -f /etc/os-release ]]; then err "Unsupported OS"; exit 1; fi
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    warn "This installer is tuned for Ubuntu (${ID:-unknown} detected). Continuing — your mileage may vary."
  fi
  local major="${VERSION_ID%%.*}"
  if [[ -n "${VERSION_ID:-}" && "$major" -lt 22 ]]; then
    err "Ubuntu 22.04 or newer required (found $VERSION_ID)."; exit 1
  fi
  ok "OS: ${PRETTY_NAME:-$ID $VERSION_ID}"
}

ask_mode() {
  if [[ -n "$DEPLOY_MODE" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]]; then DEPLOY_MODE="docker"; return; fi
  echo
  echo "Choose deployment mode:"
  echo "  1) Docker Compose  (recommended — fully isolated)"
  echo "  2) Native          (PM2 + system PostgreSQL + Node.js)"
  read -rp "Selection [1]: " sel
  case "${sel:-1}" in
    1) DEPLOY_MODE="docker" ;;
    2) DEPLOY_MODE="native" ;;
    *) err "Invalid choice"; exit 1 ;;
  esac
}

apt_update_once() {
  if [[ -z "${_APT_UPDATED:-}" ]]; then
    info "Updating apt index…"
    DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null
    _APT_UPDATED=1
  fi
}

apt_install() {
  apt_update_once
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@" >/dev/null
}

ensure_basics() {
  step "Installing base packages"
  apt_install ca-certificates curl gnupg git ufw openssl
  ok "Base packages ready"
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Docker + compose plugin already installed"
    return
  fi
  step "Installing Docker Engine + compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  local codename; codename="$(. /etc/os-release; echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt_update_once
  apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed"
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local v; v="$(node -v | sed 's/v//' | cut -d. -f1)"
    if [[ "$v" -ge 20 ]]; then ok "Node.js $(node -v) already installed"; return; fi
  fi
  step "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt_install nodejs
  ok "Node.js $(node -v) installed"
}

ensure_postgres() {
  if command -v psql >/dev/null 2>&1 && systemctl is-active --quiet postgresql; then
    ok "PostgreSQL already running"
  else
    step "Installing PostgreSQL"
    apt_install postgresql postgresql-contrib
    systemctl enable --now postgresql
    ok "PostgreSQL installed"
  fi

  local DBNAME="hahub" DBUSER="hahub"
  if [[ -z "${HAHUB_DB_PASS:-}" ]]; then HAHUB_DB_PASS="$(openssl rand -hex 16)"; fi

  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DBUSER'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER ROLE $DBUSER WITH PASSWORD '$HAHUB_DB_PASS';" >/dev/null
  else
    sudo -u postgres psql -c "CREATE ROLE $DBUSER LOGIN PASSWORD '$HAHUB_DB_PASS';" >/dev/null
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE $DBNAME OWNER $DBUSER;" >/dev/null
  fi
  ok "Database $DBNAME ready"
}

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then ok "PM2 already installed"; return; fi
  step "Installing PM2"
  npm install -g pm2 >/dev/null
  ok "PM2 installed"
}

clone_repo() {
  step "Fetching HA-Hub source"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing checkout found — pulling latest"
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
  local JWT; JWT="$(openssl rand -hex 64)"
  local DBPASS; DBPASS="$(openssl rand -hex 16)"
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
CORS_ORIGIN=*
EOF
  chmod 600 "$INSTALL_DIR/.env"
  ok ".env generated"
}

write_env_native() {
  step "Writing backend/.env"
  local JWT; JWT="$(openssl rand -hex 64)"
  cat > "$INSTALL_DIR/backend/.env" <<EOF
NODE_ENV=production
PORT=4000
PUBLIC_URL=http://$(hostname -I | awk '{print $1}'):$PORT
DATABASE_URL=postgresql://hahub:$HAHUB_DB_PASS@localhost:5432/hahub
JWT_SECRET=$JWT
JWT_EXPIRES_IN=12h
COOKIE_SECURE=false
HEARTBEAT_TIMEOUT_SECONDS=90
CORS_ORIGIN=*
EOF
  chmod 600 "$INSTALL_DIR/backend/.env"
  ok "backend/.env generated"
}

build_native() {
  step "Installing backend dependencies"
  ( cd "$INSTALL_DIR/backend" && npm ci --omit=dev --silent )
  ( cd "$INSTALL_DIR/backend" && npx prisma generate >/dev/null )
  ok "Backend ready"

  step "Building frontend"
  ( cd "$INSTALL_DIR/frontend" && npm ci --silent && npm run build --silent )
  ok "Frontend built"

  step "Running database migrations"
  ( cd "$INSTALL_DIR/backend" && npx prisma migrate deploy )
  ok "Migrations applied"
}

start_native() {
  step "Starting with PM2"
  cd "$INSTALL_DIR"
  # Run on the user-facing port directly
  PORT="$PORT" pm2 start ecosystem.config.js --update-env
  pm2 save
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  add_rollback "pm2 delete ha-hub-api || true"
  ok "PM2 process started"
}

start_docker() {
  step "Building and starting containers"
  cd "$INSTALL_DIR"
  docker compose --env-file .env up -d --build
  add_rollback "cd '$INSTALL_DIR' && docker compose down -v || true"
  ok "Containers running"
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
  for i in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then ok "API healthy"; return 0; fi
    sleep 2
  done
  warn "API didn't respond on $url within 2 minutes — check logs"
  return 1
}

finish() {
  local IP; IP="$(hostname -I | awk '{print $1}')"
  echo
  echo "${C_BOLD}${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo "${C_BOLD}${C_GREEN}  HA-Hub is installed!${C_OFF}"
  echo "${C_BOLD}${C_GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_OFF}"
  echo
  echo "  Open in browser:  ${C_BOLD}http://${IP}:${PORT}${C_OFF}"
  echo "  You'll be prompted to create the first admin account."
  echo
  echo "  Install dir:      $INSTALL_DIR"
  echo "  Deploy mode:      $DEPLOY_MODE"
  echo "  API docs:         http://${IP}:${PORT}/api/docs"
  echo
  if [[ "$DEPLOY_MODE" == "docker" ]]; then
    echo "  Logs:    cd $INSTALL_DIR && docker compose logs -f"
    echo "  Stop:    cd $INSTALL_DIR && docker compose down"
  else
    echo "  Logs:    pm2 logs ha-hub-api"
    echo "  Restart: pm2 restart ha-hub-api"
  fi
  echo
  echo "  Update:    bash $INSTALL_DIR/scripts/update.sh"
  echo "  Backup:    bash $INSTALL_DIR/scripts/backup.sh"
  echo "  Uninstall: bash $INSTALL_DIR/scripts/uninstall.sh"
  echo
  trap - ERR    # disable rollback on success
}

main() {
  banner
  require_root
  detect_ubuntu
  ask_mode
  ensure_basics

  if [[ "$DEPLOY_MODE" == "docker" ]]; then
    ensure_docker
    clone_repo
    write_env_docker
    start_docker
  else
    ensure_node
    ensure_postgres
    ensure_pm2
    clone_repo
    write_env_native
    build_native
    start_native
  fi

  configure_firewall
  wait_healthy || true
  finish
}

main "$@"
