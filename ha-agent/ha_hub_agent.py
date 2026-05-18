#!/usr/bin/env python3
"""
HA-Hub heartbeat agent.

Sends a POST to <HUB_URL>/api/heartbeat every 30 seconds with hostname,
HA version and uptime. Authenticates with X-Client-Token.

Configure via env vars:
  HAHUB_URL      e.g. https://hub.mydomain.com
  HAHUB_TOKEN    the API token shown when the client was created
  HAHUB_INTERVAL seconds (default 30)
"""
import json
import os
import platform
import socket
import sys
import time
import urllib.request
import urllib.error

HUB_URL  = os.environ.get("HAHUB_URL", "").rstrip("/")
TOKEN    = os.environ.get("HAHUB_TOKEN", "")
INTERVAL = int(os.environ.get("HAHUB_INTERVAL", "30"))

if not HUB_URL or not TOKEN:
    print("HAHUB_URL and HAHUB_TOKEN must be set", file=sys.stderr)
    sys.exit(2)


def ha_version():
    # 1. env var if running inside HA Core
    v = os.environ.get("HA_VERSION") or os.environ.get("HOMEASSISTANT_VERSION")
    if v:
        return v
    # 2. read from /config/.HA_VERSION (standard HA install location)
    for p in ("/config/.HA_VERSION", "/root/.homeassistant/.HA_VERSION"):
        try:
            with open(p) as f:
                return f.read().strip()
        except OSError:
            pass
    return None


def uptime_seconds():
    try:
        with open("/proc/uptime") as f:
            return int(float(f.read().split()[0]))
    except OSError:
        return None


def send_once():
    payload = {
        "hostname": socket.gethostname(),
        "ha_version": ha_version(),
        "uptime": uptime_seconds(),
        "platform": platform.platform(),
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{HUB_URL}/api/heartbeat",
        data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Client-Token": TOKEN,
            "User-Agent": "ha-hub-agent/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status


def main():
    print(f"[ha-hub-agent] reporting to {HUB_URL} every {INTERVAL}s")
    while True:
        try:
            status = send_once()
            if status >= 400:
                print(f"[ha-hub-agent] HTTP {status}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            print(f"[ha-hub-agent] HTTP {e.code}: {e.reason}", file=sys.stderr)
        except Exception as e:
            print(f"[ha-hub-agent] error: {e}", file=sys.stderr)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
