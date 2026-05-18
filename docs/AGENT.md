# Home Assistant Agent

Each Home Assistant instance needs a lightweight agent that posts heartbeats to HA-Hub every 30 seconds. Until heartbeats start arriving, the client shows as `UNKNOWN`; if they stop for 90 seconds it flips to `OFFLINE`.

## 1. Get the API token

In the HA-Hub portal, go to **Clients → Add client** (or **Rotate token** on an existing one). The token is shown **once** — copy it.

## 2. Install the agent

Three options, pick whichever fits your setup.

### Option A — systemd service (Linux / Supervised HA / Core install)

```bash
sudo mkdir -p /opt/ha-hub-agent
sudo curl -fsSL https://raw.githubusercontent.com/YOUR_USER/ha-hub/main/ha-agent/ha_hub_agent.py \
  -o /opt/ha-hub-agent/ha_hub_agent.py

sudo curl -fsSL https://raw.githubusercontent.com/YOUR_USER/ha-hub/main/ha-agent/ha-hub-agent.service \
  -o /etc/systemd/system/ha-hub-agent.service

# Edit the service to set HAHUB_URL and HAHUB_TOKEN
sudo systemctl edit --full ha-hub-agent.service

sudo systemctl daemon-reload
sudo systemctl enable --now ha-hub-agent.service
sudo systemctl status ha-hub-agent.service
```

### Option B — HA `command_line` sensor (no extra service)

Drop `ha_hub_agent.py` into `/config/` and add to `configuration.yaml`:

```yaml
shell_command:
  hahub_heartbeat: >
    HAHUB_URL=https://hub.mydomain.com HAHUB_TOKEN=YOUR_TOKEN
    python3 /config/ha_hub_agent.py

automation:
  - alias: HA-Hub heartbeat
    trigger:
      - platform: time_pattern
        seconds: "/30"
    action:
      - service: shell_command.hahub_heartbeat
```

> The bundled script runs in a loop by default. For HA's automation-driven mode you can wrap `send_once()` in a `--once` flag — see the source.

### Option C — Docker sidecar

```bash
docker run -d --name ha-hub-agent --restart=unless-stopped \
  -e HAHUB_URL=https://hub.mydomain.com \
  -e HAHUB_TOKEN=YOUR_TOKEN \
  -v /opt/ha-hub-agent:/agent \
  python:3.12-alpine python /agent/ha_hub_agent.py
```

## 3. Verify

Within ~30 seconds the dashboard should show the client as **online** with hostname, HA version and uptime populated.

## Troubleshooting

- `HTTP 401 Invalid client token` — the token in your env doesn't match what's stored. Use **Rotate token** in the portal and update the agent.
- `HTTP 429` — you're hitting rate limits. Default is 300 reqs / 15 min per IP, which easily handles a 30-second heartbeat — check for runaway processes.
- Client stays **UNKNOWN** — agent can't reach the hub. Test with `curl -H "X-Client-Token: …" -X POST https://hub.mydomain.com/api/heartbeat -H "Content-Type: application/json" -d '{}'`.
