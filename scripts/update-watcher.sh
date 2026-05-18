#!/usr/bin/env bash
# Watches the update-flag volume for an "update requested" signal from the app,
# then runs git pull + docker compose build & restart.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
VOLUME_NAME="$(basename "$INSTALL_DIR")_update-flag"
# Docker compose names volumes like "<projectname>_update-flag" where projectname = dir name
FLAG_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-requested"
STATE_PATH="/var/lib/docker/volumes/${VOLUME_NAME}/_data/update-state.json"
LOG="/var/log/ha-hub-update.log"

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
  if ! docker compose --env-file .env up -d --build 2>&1 | tee -a "$LOG"; then
    write_state "error" "docker compose build failed"
    return 1
  fi

  write_state "success" "Update complete"
  echo "[$(date -Iseconds)] Update complete" | tee -a "$LOG"
}

# Main loop
while true; do
  if [[ -f "$FLAG_PATH" ]]; then
    rm -f "$FLAG_PATH"
    run_update || true
  fi
  sleep 5
done
