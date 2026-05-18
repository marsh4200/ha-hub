# HA-Hub v1.3.0 — Real fix + progress bar

## What was broken in v1.1/v1.2

1. 🐛 **Volume shadowed the app code.** `update-flag` was mounted at `/app` so the container ran stale code from the persisted volume, not the freshly-built image.
2. 🐛 **VERSION wasn't in the Docker image.** Dockerfile only copied `backend/` and `frontend/dist/` — never the root `VERSION` file. Hence "Installed version: unknown".
3. 🐛 **Dirty git tree blocked updates.** Manual edits to `update-watcher.sh` on the server made `git pull` abort.
4. 🐛 **No progress feedback.** Button said "Update requested" and froze.

## v1.3 fixes

| Fix | File |
| --- | --- |
| Volume mounted at `/app/data` instead of `/app` | `docker-compose.yml` |
| `VERSION` and `scripts/` copied into image | `Dockerfile` |
| Watcher writes step-by-step progress (`{status, step, progress, message}`) | `scripts/update-watcher.sh` |
| UI polls progress every 2s and shows a progress bar | `frontend/src/pages/Settings.jsx` |
| Migration `git reset --hard` before pulling so dirty trees self-heal | `apply-update.sh` |
| `updater.js` uses `/app/data/` paths | `backend/src/services/updater.js` |

## Deploy

### Step 1 — Upload these files to GitHub

Drag-drop into `marsh4200/ha-hub` matching folder structure. Overwrite existing.

### Step 2 — One command on the server

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

This handles everything: force-resets the dirty git tree, removes the broken old volume, rebuilds with the new layout, verifies everything.

### Step 3 — Verify in the portal

After ~2 min, refresh and go to **Settings → Updates**:

- ✅ **Installed version** should now show `1.3.0` (not `unknown`)
- ✅ **Update now** button should show a **live progress bar** with step messages

### Step 4 — Final end-to-end test

1. Edit `VERSION` on GitHub: change to `1.3.1`, commit
2. Portal → **Check for updates** → see the new commit
3. Click **Update now** → watch the progress bar go through: Fetching (10%) → Building (30%) → Restarting (80%) → Verifying (95%) → Success (100%)
4. Refresh → Installed version should now be `1.3.1` ✨

If the version actually changes, the entire pipeline works for real and all future updates will be one click.
