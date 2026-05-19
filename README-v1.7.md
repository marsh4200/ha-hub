# HA-Hub v1.7.0 — Fixed update banner showing wrong version

## The bug it fixes

After clicking Update Now, the green banner used to say "Update complete — running version 1.5.0" even though you'd actually updated to 1.6.0. The banner was reading the version from before the rebuild finished, so it always showed the OLD version.

## How v1.7 fixes it

Before the update starts, the page stashes "I was on version X.Y.Z" in localStorage. After the page reloads, it compares stashed version vs. current API version. Banner now shows:

> ✨ Update complete — **v1.6.0 → v1.7.0**

Bonus: if you forget to bump VERSION in the same commit, the versions match → banner doesn't show (correct behavior: nothing actually changed).

## Files

| File | Status |
| --- | --- |
| `frontend/src/pages/Settings.jsx` | **CHANGED** — stashes before-version, compares after reload |
| `VERSION` | 1.7.0 |

## Deploy

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

Or use the in-portal Update button.
