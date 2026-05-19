# HA-Hub v1.8.0 — Per-client backups

## What's new

📦 **Upload, store and download a backup `.tar` / `.tar.gz` per client**, up to 800 MB.

- **One backup per client** — uploading a new one warns you and overwrites the old
- **Admins** can upload, replace, and delete
- **Admins + assigned users** can download
- **Magic-byte sniffing** validates the file is really a tar archive
- **Upload progress bar** in the UI
- **Streamed download** — no memory spikes for large files
- **Audit-logged** — every upload / download / delete is recorded in the Logs page
- **Backups survive container rebuilds** — stored on a persistent Docker volume

## UI

### On the Clients page (admin)
- Click the **chevron** or **📦 icon** on any client row to expand it
- See the current backup info (filename, size, who uploaded, when)
- Buttons: **Download**, **Replace…**, **Delete**
- If a backup already exists, clicking "Replace" pops a confirmation:
  > ⚠️ Your existing backup will be replaced. Download it first if you want to keep it.

### On the Dashboard (any user)
- Each client card with a stored backup shows a small **📦 ↓ Backup** link
- Click → downloads directly

## Files

| File | Status |
| --- | --- |
| `backend/package.json` | **CHANGED** — adds `multer` |
| `backend/prisma/schema.prisma` | **CHANGED** — adds 4 backup columns |
| `backend/prisma/migrations/20260519000000_add_backup/migration.sql` | **NEW** — DB migration |
| `backend/src/server.js` | **CHANGED** — extended request timeout for large uploads, exempts backup endpoints from rate limit |
| `backend/src/controllers/clients.controller.js` | **CHANGED** — exposes backup fields, cleans up files on delete |
| `backend/src/controllers/backup.controller.js` | **NEW** — handles upload/download/delete/info |
| `backend/src/routes/clients.routes.js` | **CHANGED** — mounts backup sub-router |
| `backend/src/routes/backup.routes.js` | **NEW** — multer + route definitions |
| `backend/src/routes/system.routes.js` | **CHANGED** — new `/system/backup-usage` admin endpoint |
| `frontend/src/components/BackupCard.jsx` | **NEW** — upload/download/delete UI w/ progress bar |
| `frontend/src/pages/Clients.jsx` | **CHANGED** — expandable rows showing backup card |
| `frontend/src/pages/Dashboard.jsx` | **CHANGED** — download backup icon on client cards |
| `VERSION` | 1.8.0 |

## Storage

Files live at `/app/data/backups/<clientId>/backup.tar(.gz)` inside the app container, which is on the persistent `ha-hub-data` volume. So:

- ✅ Survives container restarts and rebuilds
- ✅ Survives `docker compose down`
- ❌ Wiped if you `docker volume rm ha-hub_ha-hub-data`

To inspect on the host:
```bash
sudo ls -la /var/lib/docker/volumes/ha-hub_ha-hub-data/_data/backups/
```

## Deploy

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

Or use the in-portal Update button.

The migration auto-runs on container startup (via `npx prisma migrate deploy` in the CMD).

## Test it

1. Upload a Home Assistant backup tar from any HA instance
2. Verify upload progress bar runs
3. After upload, see the backup info populated
4. Click Download → file downloads correctly
5. Click Replace with a new file → see the warning dialog
6. Click "Download existing first" → old file downloads, then upload proceeds
7. As a non-admin user, log in → see download link on dashboard card, but no upload/delete

## ⚠️ Heads-up for the future

If you ever put the portal behind **Cloudflare Tunnel itself**, note that Cloudflare's free tier has a **100 MB upload limit**. You'd hit that before the 800 MB app-side limit. Solutions: keep the portal on direct LAN access, or upgrade Cloudflare, or upload through a side channel.
