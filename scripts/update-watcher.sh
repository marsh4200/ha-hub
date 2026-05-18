#!/usr/bin/env bash
# Watches for update requests from the app, runs git pull + rebuild,
# and writes progress to update-state.json so the UI can show a progress bar.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
LOG="/var/log/ha-hub-update.log"

# Auto-detect the data volume
detect_volume() {
  local found
  found="$(docker volume ls --format '{{.Name}}' | grep -E '_(ha-hub-)?data$|_update-flag$' | head -n 1 || true)"
  if [[ -z "$found" ]]; then return 1; fi
  VOLUME_NAME="$found"
  DATA_DIR="/var/lib/docker/volumes/${VOLUME_NAME}/_data"
  FLAG_PATH="${DATA_DIR}/update-requested"
  STATE_PATH="${DATA_DIR}/update-state.json"
}

# Write progress state the UI can poll
set_state() {
  local status="$1" step="$2" progress="$3" message="$4"
  cat > "$STATE_PATH" <<EOF
{"status":"$status","step":"$step","progress":$progress,"message":"$message","updatedAt":"$(date -Iseconds)"}
EOF
}

run_update() {
  echo "[$(date -Iseconds)] Update requested" | tee -a "$LOG"
  set_state running fetching 10 "Fetching latest code from GitHub"

  cd "$INSTALL_DIR"

  # Reset any local modifications so git pull never aborts
  git fetch --all 2>&1 | tee -a "$LOG" || true
  git reset --hard origin/main 2>&1 | tee -a "$LOG" || {
    set_state error fetching 10 "git reset failed — check log"
    return 1
  }

  local NEW_SHA
  NEW_SHA="$(git rev-parse --short HEAD)"
  set_state running building 30 "Building containers (this can take 1-2 min)"

  if ! docker compose --env-file .env build 2>&1 | tee -a "$LOG"; then
    set_state error building 30 "docker compose build failed"
    return 1
  fi

  set_state running restarting 80 "Restarting containers"
  if ! docker compose --env-file .env up -d --force-recreate 2>&1 | tee -a "$LOG"; then
    set_state error restarting 80 "docker compose up failed"
    return 1
  fi

  set_state running verifying 95 "Waiting for API to come back"
  for i in $(seq 1 60); do
    if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
      set_state success done 100 "Update complete — now at $NEW_SHA"
      echo "[$(date -Iseconds)] Update complete ($NEW_SHA)" | tee -a "$LOG"
      return 0
    fi
    sleep 2
  done
  set_state error verifying 95 "API didn't return within 2 min after restart"
  return 1
}

# Main loop
echo "[$(date -Iseconds)] watcher started" | tee -a "$LOG"
while true; do
  if ! detect_volume; then
    sleep 10
    continue
  fi
  if [[ -f "$FLAG_PATH" ]]; then
    rm -f "$FLAG_PATH"
    run_update || true
  fi
  sleep 3
done
