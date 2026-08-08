#!/usr/bin/env bash
# Watches for update requests from the app, runs git pull + rebuild,
# and writes progress to update-state.json so the UI can show a progress bar.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
LOG="/var/log/ha-hub-update.log"

# systemd's StandardOutput=append: already sends stdout to $LOG, so piping
# through `tee -a "$LOG"` as well wrote every single line to the log twice.
# Just print; let the unit do the appending.
log() { echo "[$(date -Iseconds)] $*"; }

# Port the app is published on — needed for the post-restart health check.
# Read from .env so a non-default PORT doesn't make every update "fail".
app_port() {
  local p=""
  [[ -f "$INSTALL_DIR/.env" ]] && p="$(grep -E '^PORT=' "$INSTALL_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
  echo "${p:-8080}"
}

# Locate the data volume.
#
# Previously this grepped every volume on the host for one ending in `_data`
# and took the first hit. On a server running more than one Docker stack that
# is a coin flip — it would happily latch onto some other project's volume,
# find no flag file there, and sit idle forever while the portal showed
# "Queued". So: ask the container itself, and only fall back to name matching
# scoped to this project.
detect_volume() {
  local found=""

  # 1. Ask the running app container what is actually mounted at /app/data.
  local cid
  cid="$(cd "$INSTALL_DIR" 2>/dev/null && docker compose ps -q app 2>/dev/null | head -n1 || true)"
  [[ -z "$cid" ]] && cid="$(docker ps -q --filter 'name=ha-hub-app' | head -n1 || true)"
  if [[ -n "$cid" ]]; then
    found="$(docker inspect "$cid" --format \
      '{{range .Mounts}}{{if and (eq .Type "volume") (eq .Destination "/app/data")}}{{.Name}}{{end}}{{end}}' \
      2>/dev/null || true)"
  fi

  # 2. Fall back to a name match, but anchored to this project so another
  #    stack's volume can never win.
  if [[ -z "$found" ]]; then
    found="$(docker volume ls --format '{{.Name}}' \
      | grep -E '^ha[-_]hub[-_].*ha-hub-data$' | head -n1 || true)"
  fi

  # 3. Last resort — the old loose match, kept so an unusual project name
  #    still works, but only after the precise methods have failed.
  if [[ -z "$found" ]]; then
    found="$(docker volume ls --format '{{.Name}}' \
      | grep -E '_(ha-hub-)?data$|_update-flag$' | head -n1 || true)"
  fi

  [[ -z "$found" ]] && return 1

  VOLUME_NAME="$found"
  DATA_DIR="/var/lib/docker/volumes/${VOLUME_NAME}/_data"
  FLAG_PATH="${DATA_DIR}/update-requested"
  STATE_PATH="${DATA_DIR}/update-state.json"
  return 0
}

# Write progress state the UI can poll
set_state() {
  local status="$1" step="$2" progress="$3" message="$4"
  cat > "$STATE_PATH" <<EOF
{"status":"$status","step":"$step","progress":$progress,"message":"$message","updatedAt":"$(date -Iseconds)"}
EOF
}

run_update() {
  local branch="${UPDATE_BRANCH:-main}"
  local port; port="$(app_port)"

  log "Update requested (branch $branch, volume $VOLUME_NAME)"
  set_state running fetching 10 "Fetching latest code from GitHub"

  cd "$INSTALL_DIR"

  # Reset any local modifications so git pull never aborts
  git fetch --all 2>&1 || true
  git reset --hard "origin/${branch}" 2>&1 || {
    set_state error fetching 10 "git reset failed — check log"
    return 1
  }

  # Restore the executable bit. GitHub web uploads commit mode 100644, so the
  # reset above silently strips +x from every script — including this one, which
  # is how the watcher ends up dead with status=203/EXEC after an update.
  chmod +x scripts/*.sh 2>/dev/null || true

  local NEW_SHA
  NEW_SHA="$(git rev-parse --short HEAD)"
  set_state running building 30 "Building containers (this can take 1-2 min)"

  if ! docker compose --env-file .env build 2>&1; then
    set_state error building 30 "docker compose build failed"
    return 1
  fi

  set_state running restarting 80 "Restarting containers"
  if ! docker compose --env-file .env up -d --force-recreate 2>&1; then
    set_state error restarting 80 "docker compose up failed"
    return 1
  fi

  # The volume can be recreated by `up`, so re-resolve before writing state.
  detect_volume || true

  set_state running verifying 95 "Waiting for API to come back"
  for i in $(seq 1 60); do
    if curl -fsS "http://localhost:${port}/api/health" >/dev/null 2>&1; then
      set_state success done 100 "Update complete — now at $NEW_SHA"
      log "Update complete ($NEW_SHA)"
      return 0
    fi
    sleep 2
  done
  set_state error verifying 95 "API didn't return within 2 min after restart"
  return 1
}

# ── Main loop ──────────────────────────────────────────────────────────────
#
# Wrapped in a function, and called on the last line, so bash parses the entire
# script into memory before executing any of it.
#
# This matters because run_update does `git reset --hard`, which rewrites this
# very file while bash is reading it. Bash reads a script by byte offset, so a
# file that changes length underneath a running shell makes it resume at the
# wrong place — it silently executes a fragment, or hits EOF and exits mid-update.
# The portal then sits at "Waiting for API to come back" forever, because the
# process that was going to write the success state no longer exists.
main() {
  log "watcher started (install dir $INSTALL_DIR)"
  local warned=0
  while true; do
    if ! detect_volume; then
      # Say so once rather than failing silently forever — a silent watcher is
      # exactly what makes the portal sit on "Queued" with no explanation.
      if [[ "$warned" -eq 0 ]]; then
        log "WARNING: could not find the ha-hub data volume — is the stack running? Retrying every 10s."
        warned=1
      fi
      sleep 10
      continue
    fi
    if [[ "$warned" -eq 1 ]]; then
      log "data volume found: $VOLUME_NAME"
      warned=0
    fi
    if [[ -f "$FLAG_PATH" ]]; then
      rm -f "$FLAG_PATH"
      run_update || true
    fi
    sleep 3
  done
}

main "$@"
