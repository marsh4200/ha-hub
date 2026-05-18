# Cloudflare Tunnel + HA-Hub

## The model

HA-Hub never proxies your Home Assistant traffic. Each HA instance keeps its own Cloudflare Tunnel (`client1.mydomain.com`, `client2.mydomain.com` …), and the portal just stores URLs and shows status. When a user clicks a card, their browser opens that URL **directly** — same as bookmarking it.

```
Browser ──► hub.mydomain.com  (HA-Hub portal)
       │
       └──► client1.mydomain.com  (Home Assistant, separate tunnel)
```

This means:

- Auth, sessions, websockets, video streams etc. all stay direct to HA.
- The portal has zero bandwidth cost from HA traffic.
- If the portal is down, HA still works.

## Exposing each HA instance (you've already done this)

On the box running HA, in `~/.cloudflared/config.yml`:

```yaml
tunnel: <HA_TUNNEL_ID>
credentials-file: /root/.cloudflared/<HA_TUNNEL_ID>.json
ingress:
  - hostname: client1.mydomain.com
    service: http://localhost:8123
  - service: http_status:404
```

Then in HA's `configuration.yaml` (required because HA is now behind a proxy):

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
```

## Exposing the HA-Hub portal (optional)

If you want the portal reachable outside your LAN, give it its own hostname:

```yaml
# on the HA-Hub server
tunnel: <HUB_TUNNEL_ID>
credentials-file: /root/.cloudflared/<HUB_TUNNEL_ID>.json
ingress:
  - hostname: hub.mydomain.com
    service: http://localhost:8080
  - service: http_status:404
```

Then in HA-Hub's `.env`:

```
PUBLIC_URL=https://hub.mydomain.com
COOKIE_SECURE=true
CORS_ORIGIN=https://hub.mydomain.com
```

…and restart (`docker compose up -d` or `pm2 restart ha-hub-api`).

## Agent ↔ Hub heartbeat path

The HA agent posts to `${HAHUB_URL}/api/heartbeat`. Since the HA box is already running `cloudflared` for inbound traffic, it can simply hit `https://hub.mydomain.com` for outbound — no extra config needed.

## Cloudflare Access (optional hardening)

If you want zero-trust SSO in front of either the portal or HA itself, add a Cloudflare Access policy to each hostname. HA-Hub's own JWT auth still works behind it — Access just adds an outer layer.
