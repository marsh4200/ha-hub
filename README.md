# HA-Hub — Home Assistant Multi-Tenant Management Platform

A self-hosted central dashboard for managing multiple remote Home Assistant instances exposed via Cloudflare Tunnel. **HA-Hub does not proxy Home Assistant** — it stores URLs, monitors status via lightweight agent heartbeats, and provides user/permission management. Clicking a client opens the HA URL directly in the user's browser.

## Features

- 🔐 First-run admin setup wizard
- 👥 Multi-user with role-based permissions (admin / user)
- 🏠 Add / edit / delete / tag / group Home Assistant clients
- 📡 30-second heartbeat from a tiny Python agent on each HA box
- 🟢 Real-time online/offline status via Socket.IO
- 🔔 Offline notifications + audit logs
- 🌙 Modern dark React + Tailwind UI, mobile-friendly
- 📜 Swagger/OpenAPI docs at `/api/docs`
- 🐳 Docker Compose **or** native PM2 deployment
- 🛡️ Helmet, rate limiting, CSRF, bcrypt, JWT, input validation
- 💾 Backup / restore / export scripts
- 🚀 One-line Ubuntu installer

## One-Line Install (Ubuntu 22.04+)

```bash
bash <(curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/install.sh)
```
## Update existing install
```bash
bashcurl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

After install, open `http://YOUR_SERVER:8080` to create the first admin.

## Manual install / Docker / agent setup

See [docs/INSTALL.md](docs/INSTALL.md), [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md), and [docs/AGENT.md](docs/AGENT.md).

## License

MIT
