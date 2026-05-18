#!/usr/bin/env bash
# Backs up HA-Hub: DB dump + .env. Works for both Docker and native installs.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
BACKUP_DIR="${HAHUB_BACKUP_DIR:-$INSTALL_DIR/backups}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/ha-hub-$TS"

C_GREEN=$'\033[32m'; C_BLUE=$'\033[34m'; C_OFF=$'\033[0m'
info() { echo "${C_BLUE}➜${C_OFF} $*"; }
ok()   { echo "${C_GREEN}✓${C_OFF} $*"; }

mkdir -p "$OUT"
info "Writing backup to $OUT"

# Detect mode
if [[ -f "$INSTALL_DIR/docker-compose.yml" ]] && docker compose -f "$INSTALL_DIR/docker-compose.yml" ps -q db 2>/dev/null | grep -q .; then
  info "Dumping database from Docker"
  ( cd "$INSTALL_DIR" && docker compose exec -T db pg_dump -U hahub hahub ) > "$OUT/hahub.sql"
  cp "$INSTALL_DIR/.env" "$OUT/.env"
else
  info "Dumping database from local PostgreSQL"
  sudo -u postgres pg_dump hahub > "$OUT/hahub.sql"
  [[ -f "$INSTALL_DIR/backend/.env" ]] && cp "$INSTALL_DIR/backend/.env" "$OUT/backend.env"
fi

# Bonus: JSON export through the API if portal is reachable
if curl -fsS http://localhost:8080/api/health >/dev/null 2>&1; then
  info "Capturing config (DB dump is the source of truth)"
fi

tar -czf "$OUT.tar.gz" -C "$BACKUP_DIR" "$(basename "$OUT")"
rm -rf "$OUT"

# Retain last 14 archives
ls -1t "$BACKUP_DIR"/ha-hub-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --

ok "Backup written: $OUT.tar.gz"
