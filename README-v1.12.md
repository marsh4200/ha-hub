# HA-Hub v1.12.0 — "Needs attention" now means something

v1.11 put live Home Assistant data on the dashboard and then treated all of it as
a problem. Any site with a pending update, or with a few entities sitting
unavailable, was pushed into **Needs attention** with an amber rail.

In practice that meant almost every site was amber almost all the time, because:

- Home Assistant ships an update roughly every month, so every site is
  perpetually one version behind something.
- Every real installation carries unavailable entities. A bulb switched off at
  the wall. A phone that left the property. An integration whose cloud service
  retired two years ago and whose entities will never come back.

Neither of those is a fault, and a warning that is always on is not a warning.

---

## What changed

### 1. Unavailable entities no longer signal anything

They no longer count toward triage, no longer colour the rail, and no longer
appear on the dashboard card at all. The count is still collected and still
visible where you'd go looking for it — expand a site on **Manage sites** and
it's there under the entity totals, as a plain number with no tone attached.

The dashboard card now shows exactly the three readings you actually scan:
entities, integrations, automations.

### 2. Updates are information, not a problem

A site with an update pending is online and healthy. It now says so.

- The version chip is **cyan**, not amber, and reads `2026.7.3 ↗ 2026.8.0`.
- The rail is cyan.
- The site sits in its own **Update available** band, labelled *online and
  healthy*, between "Needs attention" and "All good".
- The fleet bar carries a separate **N to update** count alongside the attention
  count, plus its own filter pill.

### 3. "Needs attention" is now a short list

A site lands there only when someone genuinely has to do something:

| Band | Rail | Meaning |
| --- | --- | --- |
| `down` | red | Offline. |
| `warn` | amber | Token rejected, token unreadable, or HA stopping / not running. |
| `info` | cyan | Online and healthy, with an update available. |
| `live` | green | Online and quiet. |
| `idle` | grey | Never checked yet. |

Home Assistant reporting `STARTING` is treated as information rather than a
fault — it resolves itself within a minute, and flagging it just produces a
false alarm every time a site reboots.

### 4. Fleet bar reads better at a glance

When nothing is broken the bar now says **All healthy** in green instead of
silently omitting the attention count.

---

## Code

The triage model in `frontend/src/lib/format.js` is now three separate
functions instead of one overloaded one:

```js
triage(c)   // 'down' | 'warn' | 'info' | 'live' | 'idle'  — the band
faults(c)   // real problems, rendered red/amber
notes(c)    // worth knowing, rendered cyan, never affects the band
```

`needsAction(c)` is the single predicate the dashboard filters and sorts on, so
the definition of "needs attention" lives in one place. `triageReasons(c)` is
kept as a flat `faults + notes` list for compatibility.

New styles: `.chip-info`, `.chip-quiet`, `.rail-info`.

## Upgrading

Frontend only — no schema change, no migration, no backend behaviour change. The
`unavailableCount` column is still populated exactly as before; only its
interpretation changed.

```bash
cd /opt/ha-hub && ./scripts/update.sh
```

Or Settings → Check for updates → Update.

---

## Also in 1.12: update watcher fixes

**The watcher could latch onto the wrong Docker volume.** `detect_volume` grepped
every volume on the host for one ending in `_data` and took the first match. On a
server running more than one Docker stack that is a coin flip — it would pick some
other project's volume, find no flag file there, and sit idle forever while the
portal showed *"Queued — waiting for watcher to pick up"* at 0%.

It now asks the running `app` container what is actually mounted at `/app/data`,
falls back to a project-anchored name match, and only then to the old loose match.

**Other watcher fixes:**

- The health check read a hardcoded port 8080. It now reads `PORT` from `.env`, so
  a non-default port no longer makes every update report failure at 95%.
- `git reset --hard origin/main` ignored `UPDATE_BRANCH`. It now honours it.
- A watcher that cannot find its volume logs a warning once instead of failing
  silently, which is what made this hard to diagnose.
- The volume is re-resolved after `docker compose up`, in case it was recreated.

**New: `scripts/force-update.sh`** — updates from the host, bypassing the watcher,
and clears any stuck state. Needed because `requestUpdate()` refuses to queue while
status is `requested` or `running`, so a half-finished update locks the in-portal
button out permanently until the state file is removed.

```bash
sudo /opt/ha-hub/scripts/force-update.sh
```

### The watcher died with status=203/EXEC

The unit file used a bare `ExecStart=/opt/ha-hub/scripts/update-watcher.sh`.

Files uploaded to GitHub through the web UI are committed mode `100644`, so the
executable bit does not survive a `git reset --hard`. The very first successful
in-portal update therefore stripped `+x` from the watcher, systemd failed to exec
it on the next restart, and every subsequent update request sat at
*"Queued — waiting for watcher to pick up"* — with the failure recorded only in
`systemctl status`, not in the update log the portal shows.

Two changes so it cannot recur:

- The unit now runs `ExecStart=/bin/bash /opt/ha-hub/scripts/update-watcher.sh`,
  making the executable bit irrelevant.
- `update-watcher.sh`, `update.sh` and `apply-update.sh` all `chmod +x scripts/*.sh`
  immediately after the git reset.

### The watcher rewrote itself mid-update

`run_update` calls `git reset --hard`, which overwrites `update-watcher.sh` while
bash is still reading it. Bash reads a script by byte offset, so a file that
changes length underneath a running shell resumes at the wrong place — it either
executes a fragment or hits EOF and exits partway through the update.

The containers rebuild and restart fine, but the process that was going to write
the success state is gone, so the portal sits on *"Waiting for API to come back"*
at 95% forever even though the site is healthy.

The whole loop is now wrapped in `main()` and called on the last line, so bash
parses the entire script into memory before executing any of it.

Also: `StandardOutput=append:` in the unit already sends stdout to
`/var/log/ha-hub-update.log`, and every log line was *also* piped through
`tee -a "$LOG"` — which is why every entry in that log appeared twice. The tee
calls are gone.
