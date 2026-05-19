# HA-Hub v1.6.0 — Idle auto-logout

## What's new

🕒 **Auto-logout after 4 minutes of inactivity** with a 30-second warning popup.

- Mouse, keyboard, scroll, touch all count as activity
- Background dashboard refreshes do NOT count (so leaving the tab open will still log you out)
- At 3:30, popup appears: "You're about to be logged out — in Xs"
- Click the popup or move your mouse → resets the timer
- At 4:00, redirects to `/login?reason=idle` and shows "You were signed out due to inactivity"
- Pauses during active updates (no surprise logout while waiting for a rebuild)

## Files

| File | Status |
| --- | --- |
| `frontend/src/hooks/useIdleLogout.js` | **NEW** — timer + activity listeners |
| `frontend/src/components/IdleWarning.jsx` | **NEW** — countdown popup |
| `frontend/src/components/Layout.jsx` | **CHANGED** — mounts `<IdleWarning/>` for logged-in users |
| `frontend/src/pages/Login.jsx` | **CHANGED** — shows the "idle logout" notice |
| `VERSION` | 1.6.0 |

## Deploy

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

Or use the in-portal button.

## Test it

1. Log in
2. Don't touch anything for 3.5 minutes
3. Popup appears with 30s countdown
4. Either click "Stay logged in" → timer resets, OR wait → auto-logout at 4 min mark
5. Login page shows the amber notice
