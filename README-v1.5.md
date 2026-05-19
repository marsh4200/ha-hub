# HA-Hub v1.5.0 — Cleaner update UX

## What's new

✅ **"Update complete — running version X.Y.Z"** banner shows for 5s after the auto-reload, then fades away
✅ **"Already up to date — version X.Y.Z"** message when you click Update Now and you're already on the latest
✅ **Progress bar hidden when idle** — only shows during an actual update
✅ **Latest version shown** next to the installed version on the Updates card, with ✓ if up to date
✅ Server refuses to start a rebuild if you're already on the latest version (saves 2 minutes of pointless rebuild)

## Files

| File | Status |
| --- | --- |
| `backend/src/services/updater.js` | **CHANGED** — fetches remote `VERSION` from raw.githubusercontent.com and compares |
| `backend/src/routes/system.routes.js` | **CHANGED** — `/update/check` returns `upToDate` flag, `/update` refuses when up to date |
| `frontend/src/pages/Settings.jsx` | **CHANGED** — banner after reload, up-to-date message, hide progress when idle |
| `frontend/src/index.css` | **CHANGED** — added fade-in animation |
| `VERSION` | 1.5.0 |

## Deploy

Upload to GitHub, then on the server:

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

Or use the in-portal button — both work.

## How "up to date" detection works

When you click **Check for updates**, the backend fetches `https://raw.githubusercontent.com/marsh4200/ha-hub/main/VERSION` and compares it to the `VERSION` file baked into your container. If they match → `upToDate: true`.

So whenever you push code changes, **remember to bump VERSION** in the same commit. Otherwise the update will silently not detect that there's new code.
