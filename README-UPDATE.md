# HA-Hub v1.1.0 update bundle

Drop these files into your `ha-hub` repo on GitHub (the folders match exactly).

## What's in this bundle

| File | New / Changed |
| --- | --- |
| `backend/src/services/urlPoller.js` | **NEW** — polls every client URL every 30s for online/offline |
| `backend/src/services/updater.js` | **NEW** — backend support for the in-portal update button |
| `backend/src/server.js` | **CHANGED** — wires in the URL poller |
| `backend/src/routes/system.routes.js` | **CHANGED** — adds `/api/system/update*` endpoints |
| `frontend/src/pages/Clients.jsx` | **CHANGED** — token now optional, hidden behind "Advanced" |
| `frontend/src/pages/Settings.jsx` | **CHANGED** — new "Updates" card with check/update buttons |
| `docker-compose.yml` | **CHANGED** — adds the shared `update-flag` volume |
| `scripts/update-watcher.sh` | **NEW** — host-side watcher for the update button |
| `scripts/ha-hub-update-watcher.service` | **NEW** — systemd unit for the watcher |
| `VERSION` | **CHANGED** — bumped to 1.1.0 |

## How to deploy (one-time setup for the update button)

### Step 1 — Upload the files to GitHub

Easiest way: drag-and-drop.

1. Go to https://github.com/marsh4200/ha-hub
2. For each folder in this zip:
   - Navigate to the matching folder on GitHub
   - Click **Add file → Upload files**
   - Drag the file(s) from the zip
   - Commit (will overwrite existing files of the same name)

Or, if you prefer the terminal on your computer:

```bash
# Unzip into your local clone of the repo
unzip ha-hub-v1.1.0-update.zip -d /tmp/update
cp -r /tmp/update/* /path/to/your/local/ha-hub/
cd /path/to/your/local/ha-hub
git add .
git commit -m "v1.1.0: URL polling + in-portal updates"
git push
```

### Step 2 — On your server (only required once)

```bash
cd /opt/ha-hub
sudo git pull
sudo chmod +x scripts/update-watcher.sh

# Install the watcher as a systemd service so the "Update now" button works
sudo cp scripts/ha-hub-update-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ha-hub-update-watcher

# Rebuild
sudo docker compose down
sudo docker compose --env-file .env up -d --build
```

Wait ~2 minutes, refresh the portal.

### From now on

Push commits to GitHub → click **Settings → Updates → Update now** in the portal. 🎉
