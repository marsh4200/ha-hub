#!/usr/bin/env bash
# Removes HA-Hub. Does NOT remove Docker, Node.js, or PostgreSQL system packages.
set -Eeuo pipefail

INSTALL_DIR="${HAHUB_DIR:-/opt/ha-hub}"
C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'; C_GREEN=$'\033[32m'; C_OFF=$'\033[0m'

echo "${C_YELLOW}!${C_OFF} This will remove HA-Hub from $INSTALL_DIR."
read -rp "Also delete the database? [y/N] " dropdb
read -rp "Continue? [y/N] " go
[[ "${go,,}" == "y" ]] || { echo "Aborted."; exit 0; }

if [[ -d "$INSTALL_DIR" ]]; then
  if [[ -f "$INSTALL_DIR/docker-compose.yml" ]] && docker compose -f "$INSTALL_DIR/docker-compose.yml" ps -q 2>/dev/null | grep -q .; then
    echo "${C_YELLOW}➜${C_OFF} Stopping containers"
    if [[ "${dropdb,,}" == "y" ]]; then
      ( cd "$INSTALL_DIR" && docker compose down -v )
    else
      ( cd "$INSTALL_DIR" && docker compose down )
    fi
  fi
fi

pm2 delete ha-hub-api >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true

if [[ "${dropdb,,}" == "y" ]] && command -v psql >/dev/null 2>&1; then
  echo "${C_YELLOW}➜${C_OFF} Dropping database"
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS hahub;" >/dev/null || true
  sudo -u postgres psql -c "DROP ROLE IF EXISTS hahub;" >/dev/null || true
fi

if [[ -d "$INSTALL_DIR" ]]; then
  echo "${C_RED}➜${C_OFF} Removing $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"
fi

echo "${C_GREEN}✓${C_OFF} HA-Hub uninstalled."
