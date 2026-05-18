#!/usr/bin/env bash
# Watches the update-flag volume for an "update requested" signal from the app,
# then runs git pull + docker compose build & restart.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
# FIX v1.2: volume renamed in docker-compose.yml so name is now stable.
VOLUME_NAME="ha-hub_ha-hub-update-flag"
FLAG_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-requested"
STATE_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-state.json"
LOG="/var/log/ha-hub-update.log"

# Auto-detect actual volume name in case Docker Compose uses a different project name
detect_volume() {
  local found
  found="$(docker volume ls --format '{{.Name}}' | grep 'update-flag' | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    VOLUME_NAME="$found"
    FLAG_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-requested"
    STATE_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-state.json"
  fi
}

write_state() {
  local status="$1" msg="$2"
  cat > "$STATE_PATH" <<EOF
{"status":"$status","message":"$msg","updatedAt":"$(date -Iseconds)"}
EOF
}

run_update() {
  echo "[$(date -Iseconds)] Update requested" | tee -a "$LOG"
  write_state "running" "Pulling latest code..."

  cd "$INSTALL_DIR"
  if ! git pull --ff-only 2>&1 | tee -a "$LOG"; then
    write_state "error" "git pull failed"
    return 1
  fi

  write_state "running" "Rebuilding containers..."
  # --force-recreate ensures the new image actually runs even if compose thinks nothing changed
  if ! docker compose --env-file .env up -d --build --force-recreate 2>&1 | tee -a "$LOG"; then
    write_state "error" "docker compose build failed"
    return 1
  fi

  write_state "success" "Update complete"
  echo "[$(date -Iseconds)] Update complete" | tee -a "$LOG"
}

# Main loop
while true; do
  detect_volume
  if [[ -f "$FLAG_PATH" ]]; then
    rm -f "$FLAG_PATH"
    run_update || true
  fi
  sleep 5
done
