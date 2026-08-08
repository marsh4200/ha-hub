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
