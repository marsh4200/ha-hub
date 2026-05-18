# HA-Hub v1.2.0 — CRITICAL FIX

## What this fixes

🐛 **Critical bug:** In v1.1 the Docker volume for update flags was mounted at `/app`, which **shadowed the entire application code**. Symptoms:

- Update button says "Update complete" but no code changes ever take effect
- `Installed version: unknown` in the Updates panel
- All updates appear to work but the running code is stale

## What's in this zip

| File | Status |
| --- | --- |
| `docker-compose.yml` | **CHANGED** — volume now mounts at `/app/data`, renamed to `ha-hub-update-flag` |
| `backend/src/services/updater.js` | **CHANGED** — uses `/app/data/` paths + robust VERSION reading |
| `backend/src/routes/system.routes.js` | unchanged from v1.1 (included for completeness) |
| `scripts/update-watcher.sh` | **CHANGED** — auto-detects volume name |
| `apply-update.sh` | **CHANGED** — now removes the broken old volume |
| `VERSION` | **CHANGED** — 1.2.0 |

## How to deploy

### Step 1 — Upload to GitHub

Drag-drop each file into `marsh4200/ha-hub` matching the folder structure. Or git clone + commit + push if you have git locally.

### Step 2 — Migrate your server (ONE command)

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

This will:
- Pull the new code
- **Stop containers & delete the broken old volume** (this is the critical fix)
- Rebuild with the corrected mount layout
- Restart the watcher service with the new script
- Verify the volume is now at `/app/data` (not `/app`)
- Print a confirmation

### Step 3 — Test the update button end-to-end

Once migrated, you can verify it actually applies code changes:

1. Edit any file in your GitHub repo (e.g. bump `VERSION` to `1.2.1`)
2. Commit & push
3. In the portal: Settings → Updates → **Check for updates** → see new commit
4. Click **Update now**
5. Wait ~2 min, refresh
6. Settings → Updates should now show `Installed version: 1.2.1`

If the version reflects your change, **the entire pipeline works for real**. 🎉

## Why this happened

The original volume `update-flag:/app` was intended to share a tiny file between container and host. But mounting any volume on top of `/app` overlays the directory — the container's first start copies its baked-in `/app` into the empty volume, and from then on **the volume is the source of truth, not the new image's code**. Every "update" rebuilt the image but the running container still used the old code from the persisted volume.

The v1.2 fix uses `/app/data/` as the mount point — a sub-directory that doesn't conflict with any code paths.
