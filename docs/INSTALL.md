# Installation

## One-line install (recommended)

On a fresh Ubuntu 22.04+ server:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/YOUR_USER/ha-hub/main/install.sh)
```

You'll be asked to choose:

1. **Docker** — runs the app + PostgreSQL in containers (recommended).
2. **Native** — installs Node.js 20 + PostgreSQL + PM2 on the host.

When it finishes, open `http://YOUR_SERVER:8080` and the first-run wizard will create your admin account.

### Environment overrides

```bash
HAHUB_MODE=docker HAHUB_PORT=9000 HAHUB_NONINTERACTIVE=1 \
  bash <(curl -sSL https://raw.githubusercontent.com/YOUR_USER/ha-hub/main/install.sh)
```

Vars: `HAHUB_REPO`, `HAHUB_BRANCH`, `HAHUB_DIR`, `HAHUB_MODE` (docker|native), `HAHUB_PORT`, `HAHUB_NONINTERACTIVE`.

---

## Manual Docker install

```bash
git clone https://github.com/YOUR_USER/ha-hub.git /opt/ha-hub
cd /opt/ha-hub
cp .env.example .env
# edit .env — set JWT_SECRET and POSTGRES_PASSWORD
docker compose up -d --build
```

Open `http://localhost:8080`.

---

## Manual native install

```bash
# Prereqs: Node.js 20, PostgreSQL 14+, PM2 (npm i -g pm2)
git clone https://github.com/YOUR_USER/ha-hub.git /opt/ha-hub
cd /opt/ha-hub

# Backend
cd backend
cp .env.example .env
# edit .env (DATABASE_URL, JWT_SECRET, …)
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy

# Frontend
cd ../frontend
npm ci
npm run build

# Start
cd ..
PORT=8080 pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Day-2 ops

| Task     | Command                                                       |
| -------- | ------------------------------------------------------------- |
| Update   | `bash /opt/ha-hub/scripts/update.sh`                          |
| Backup   | `bash /opt/ha-hub/scripts/backup.sh`                          |
| Restore  | `gunzip < ha-hub-X.sql.gz \| docker compose exec -T db psql -U hahub` |
| Logs     | `docker compose logs -f` or `pm2 logs ha-hub-api`             |
| API docs | `http://YOUR_SERVER:8080/api/docs`                            |

### Schedule daily backups

```bash
sudo crontab -e
# 0 3 * * * /opt/ha-hub/scripts/backup.sh >/var/log/ha-hub-backup.log 2>&1
```

---

## Putting the portal behind Cloudflare Tunnel

The portal itself can also be exposed via Cloudflare Tunnel — same pattern as your HA instances:

```yaml
# ~/.cloudflared/config.yml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /root/.cloudflared/<YOUR_TUNNEL_ID>.json
ingress:
  - hostname: hub.mydomain.com
    service: http://localhost:8080
  - service: http_status:404
```

When you do this, also set in `.env`:

```
PUBLIC_URL=https://hub.mydomain.com
COOKIE_SECURE=true
CORS_ORIGIN=https://hub.mydomain.com
```

then restart.
