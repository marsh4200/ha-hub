#!/usr/bin/env bash
# Force an update from the host, bypassing the in-portal watcher entirely.
# Also clears any stuck "Queued" / "running" state so the portal unsticks.
#
#   sudo ./scripts/force-update.sh
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
BRANCH="${UPDATE_BRANCH:-main}"
cd "$INSTALL_DIR"

C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_YEL=$'\033[33m'; C_OFF=$'\033[0m'
info() { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()   { echo "${C_GREEN}✓${C_OFF} $*"; }
warn() { echo "${C_YEL}!${C_OFF} $*"; }

# ── Clear stuck state ──────────────────────────────────────────────────────
# requestUpdate() refuses to queue anything while status is "requested" or
# "running", so a half-finished update locks the button out permanently until
# these files are gone. Missing files read as idle, so deleting is enough.
clear_state() {
  local cid vol dir
  cid="$(docker compose ps -q app 2>/dev/null | head -n1 || true)"
  [[ -z "$cid" ]] && cid="$(docker ps -aq --filter 'name=ha-hub-app' | head -n1 || true)"
  if [[ -n "$cid" ]]; then
    vol="$(docker inspect "$cid" --format \
      '{{range .Mounts}}{{if and (eq .Type "volume") (eq .Destination "/app/data")}}{{.Name}}{{end}}{{end}}' \
      2>/dev/null || true)"
  fi
  [[ -z "${vol:-}" ]] && vol="$(docker volume ls --format '{{.Name}}' | grep -E '^ha[-_]hub[-_].*ha-hub-data$' | head -n1 || true)"
  if [[ -z "$vol" ]]; then
    warn "Couldn't find the data volume — skipping state cleanup"
    return 0
  fi
  dir="/var/lib/docker/volumes/${vol}/_data"
  rm -f "${dir}/update-requested" "${dir}/update-state.json"
  ok "Cleared stuck update state in $vol"
}

clear_state

info "Pulling latest source (branch $BRANCH)"
git fetch --all --quiet
git reset --hard "origin/${BRANCH}" --quiet
chmod +x scripts/*.sh 2>/dev/null || true
ok "Source now at $(git rev-parse --short HEAD) — version $(cat VERSION 2>/dev/null || echo unknown)"

# Keep the unit file in sync — it now runs the watcher through bash so a
# stripped executable bit can never kill it again.
if [[ -f scripts/ha-hub-update-watcher.service ]]; then
  cp scripts/ha-hub-update-watcher.service /etc/systemd/system/ 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true
  systemctl restart ha-hub-update-watcher 2>/dev/null || true
  ok "Watcher service refreshed"
fi

info "Rebuilding and restarting containers"
docker compose --env-file .env up -d --build
ok "Containers rebuilt"

clear_state

PORT="$(grep -E '^PORT=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
PORT="${PORT:-8080}"
info "Waiting for the API on port $PORT"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    ok "API is up — update complete"
    exit 0
  fi
  sleep 2
done
warn "API didn't answer within 2 minutes. Check: docker compose logs -f app"
exit 1
