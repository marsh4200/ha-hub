# HA-Hub v1.4.0 — Live UI + persistent login during updates

## What's new

🟢 **Live dashboard.** "Last seen 5s ago" now ticks every second. Status changes appear instantly via Socket.IO, plus a 10s safety-net refresh in case the socket gets disconnected. No more F5.

🔐 **No logout during updates.** When you click "Update now", the app remembers an update is in progress. While the container restarts (~30s), any failed API calls or 401s are *ignored* instead of kicking you out. Once the API comes back, the page automatically reloads on the same login.

🔄 **Auto-reload on success.** When the watcher reports `status: success`, the page reloads itself 3 seconds later — no clicking required.

## Files

| File | Status |
| --- | --- |
| `frontend/src/main.jsx` | wraps app in UpdateProvider |
| `frontend/src/context/UpdateContext.jsx` | **NEW** — global update state |
| `frontend/src/services/api.js` | doesn't kick out during updates |
| `frontend/src/hooks/useSocket.js` | infinite reconnect attempts |
| `frontend/src/hooks/useNow.js` | **NEW** — 1-second ticker |
| `frontend/src/pages/Dashboard.jsx` | live timestamps + 10s safety refresh |
| `frontend/src/pages/Settings.jsx` | uses global update context, auto-reload |
| `VERSION` | 1.4.0 |

## Deploy

Same one-command flow — make sure these files are pushed to GitHub first, then on the server:

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

After it finishes:
- Refresh once → log in
- Click Settings → Updates — version should be 1.4.0
- On GitHub, bump VERSION to 1.4.1, commit
- Click Check → see new commit → click Update now
- **Watch the progress bar go 10 → 30 → 80 → 95 → 100, then the page reloads itself**
- You're still logged in, version now shows 1.4.1 ✨
