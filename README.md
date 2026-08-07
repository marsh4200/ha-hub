# HA-Hub — Home Assistant Multi-Tenant Management Platform

A self-hosted central dashboard for managing multiple remote Home Assistant instances exposed via Cloudflare Tunnel. **HA-Hub does not proxy Home Assistant** — it stores URLs, polls each site for status, optionally reads live data from each site's REST API, and provides user/permission management. Clicking a site opens its URL directly in the user's browser.

## Features

- 🔑 **Reads live data from each Home Assistant** via an optional long-lived access
  token — version, pending updates, entity counts, unavailable entities,
  integrations and automations. Token stored AES-256-GCM encrypted, never sent to
  the browser. See [README-v1.11.md](README-v1.11.md).
- 🎯 Dashboard sorts itself by what needs attention — offline, updates pending,
  entities unavailable, token rejected
- 🔐 First-run admin setup wizard
- 👥 Multi-user with role-based permissions (admin / user)
- 🏠 Add / edit / delete / tag / group Home Assistant sites
- 🟢 Real-time online/offline status via Socket.IO, backed by 30-second polling
- 📡 Optional Python heartbeat agent for richer host-level info
- 🔔 Offline notifications + audit logs
- 🌙 Dark React + Tailwind UI with mobile bottom navigation
- 📜 Swagger/OpenAPI docs at `/api/docs`
- 🐳 Docker Compose **or** native PM2 deployment
- 🛡️ Helmet, rate limiting, CSRF, bcrypt, JWT, input validation
- 💾 Backup / restore / export scripts
- 🚀 One-line Ubuntu installer

## One-Line Install (Ubuntu 22.04+)

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/install.sh | sudo bash
```
## Update existing install
```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```
After install, open `http://YOUR_SERVER:8080` to create the first admin.

## Manual install / Docker / agent setup

See [docs/INSTALL.md](docs/INSTALL.md), [docs/HA-TOKEN.md](docs/HA-TOKEN.md), [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md), and [docs/AGENT.md](docs/AGENT.md).

## License

MIT
