# HA-Hub v1.11.0 — Read live data from each site, and a rebuilt interface

Two changes: HA-Hub can now talk to each client's Home Assistant directly using a
long-lived access token, and the whole interface has been rebuilt around what
that new data makes possible.

---

## 1. Home Assistant access tokens

Each site gets an **optional** long-lived access token. With one saved, HA-Hub
reads real data from that Home Assistant instead of guessing from an HTTP probe.

### What it reads

| Reading | Source |
| --- | --- |
| Home Assistant version | `/api/config` → `version`, corrected from the core update entity |
| Site name, time zone, run state | `/api/config` |
| Integration count | `/api/config` → `components[]` |
| Entity count | `/api/states` |
| Unavailable entities | `/api/states`, entities sitting in `unavailable` |
| Automation count | `/api/states`, `automation.*` domain |
| Pending updates | `/api/states`, every `update.*` entity that is `on` |
| Installed → latest version | `update.*` entity attributes |
| Response time | measured per call |

Pending updates cover **everything** Home Assistant tracks — core, operating
system, supervisor, and every HACS integration. So the dashboard can tell you
*"Kloof House is on 2026.7.3, 2026.8.0 is out, plus 2 integration updates"*
without you opening the site.

### Adding a token

1. On the client's Home Assistant, open your **profile** → **Security** tab →
   scroll to **Long-lived access tokens** → **Create token**.
2. In HA-Hub, go to **Manage → edit the site**, paste it into
   **Home Assistant access token**, and press **Test connection**.
3. The test reports the version and site name it found *before* you save, so a
   typo or a wrong URL shows up immediately rather than silently doing nothing.

Sites with no token keep working exactly as before, on plain URL polling.

### How the token is protected

A long-lived access token is a **full-admin credential for that client's home**,
not a read-only key. It is treated accordingly:

- **Encrypted at rest** with AES-256-GCM. The database stores a
  `v1.<iv>.<tag>.<ciphertext>` envelope, never the token.
- **Never sent to the browser.** The API strips it on every response; the UI only
  ever receives a masked hint (`••••••a1b2c3`).
- **Never logged, never exported.** Audit entries record only whether a token is
  present, not its value.
- **Write-only in the UI.** Leaving the field blank on save keeps the existing
  token — an empty box cannot silently wipe a working one. Removing a token is a
  separate, explicit action.
- **Server-side only.** All calls happen from the HA-Hub backend, so there is no
  CORS involvement and the token never travels from a browser.

The encryption key is derived from your existing `JWT_SECRET`, so **upgrading
needs no `.env` edit** — `install.sh` preserves an existing `.env`, and a
mandatory new variable would have broken every existing install. If you ever
rotate `JWT_SECRET`, stored tokens become unreadable; that is handled as a
`DECRYPT_FAILED` status with a prompt to paste the token again, not as a crash.

### Security fix found along the way

`GET /api/system/export` was returning whole `Client` rows with no field
selection, which means it was **already exporting the agent `apiToken` in plain
text** — and would have exported the new encrypted HA token too. Both are now
explicitly stripped. If you have downloaded an export previously, treat the agent
tokens in it as exposed and rotate them.

### Polling behaviour

Two cadences, so richer data doesn't mean heavier load:

- **Liveness, every 30 s** — `GET /api/` with the token. This is a genuinely
  better online check than the old URL probe: the old one only proved Cloudflare
  answered, this proves Home Assistant itself is alive behind the tunnel.
- **Detail, every 5 min** — `/api/config` + `/api/states`.

Sites that fail repeatedly are backed off geometrically (capped at 10 cycles) so
one dead tunnel can't slow the sweep for everyone else. A **Check now** button on
each site forces an immediate full sweep.

### A 401 is not "offline"

If Home Assistant rejects the token it has still *answered* — the site is up and
the token is wrong. Reporting that as **Offline** would send you chasing a dead
tunnel when the actual fix is a new token. A rejected token now shows the site as
online with a **Token rejected** warning instead.

---

## 2. Rebuilt interface

### Triage, as layout

The dashboard's job is to tell you which sites need you, so it sorts itself that
way: anything broken or waiting floats into a **Needs attention** band at the
top, everything healthy sits below under **All good**. Every card carries a
coloured left rail — red offline, amber needs attention, green healthy — so
running your eye down the rail is the fastest read of the whole fleet.

A site counts as needing attention when it is offline, its token was rejected, it
has updates pending, it has entities sitting unavailable, or Home Assistant is
still starting up.

### Elsewhere

- **Version chips** turn amber and show the jump — `2026.7.3 → 2026.8.0` — when
  an update is waiting. Expanding a site lists every pending update by name with
  its version pair.
- **One fleet bar** replaces the four identical stat boxes. You read "mostly
  green with a red sliver" before you read any number. Its segments double as
  filters, alongside a **Needs attention** filter.
- **Palette built on Home Assistant's own cyan** rather than a generic dashboard
  blue — these are HA sites, so the colour is grounded in the subject.
- **Space Grotesk** for interface type, **JetBrains Mono** with tabular figures
  for every numeric readout, so versions, counts and latencies line up column to
  column.
- **Bottom navigation on mobile.** This gets checked from a phone more than a
  desktop, so the primary destinations sit under your thumb instead of behind a
  hamburger menu.
- Skeleton loaders while data arrives, `prefers-reduced-motion` respected,
  visible keyboard focus, and horizontal scroll on the admin tables so they work
  on a narrow screen.
- Search now also matches version numbers and site location names.
- Copy rewritten throughout: "Sites" rather than "Clients", "Needs attention"
  rather than "Offline: 3", and errors that say what to do rather than only what
  failed.

---

## Upgrading

Nothing to configure. The new database columns apply automatically —
`prisma migrate deploy` already runs on container start.

```bash
curl -sSL https://raw.githubusercontent.com/marsh4200/ha-hub/main/apply-update.sh | sudo bash
```

Or use **Settings → Updates → Update now** in the portal.

After it comes back up, existing sites keep polling as before. Add tokens one at
a time as you get to each site — there is no rush and no all-or-nothing switch.

---

## New environment variables (all optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `HA_DETAIL_INTERVAL_SECONDS` | `300` | How often to pull the full `/api/states` sweep |
| `HA_API_TIMEOUT_SECONDS` | `15` | Per-request timeout against a client's HA |
| `POLL_CONCURRENCY` | `8` | How many sites are probed in parallel |
| `TOKEN_ENCRYPTION_KEY` | derived from `JWT_SECRET` | Key token encryption independently of `JWT_SECRET` |

Every one of these has a working default, so **nothing needs adding to `.env`** —
on a fresh install or an upgrade. Existing variables are unchanged;
`URL_POLL_INTERVAL_SECONDS` and `URL_POLL_TIMEOUT_SECONDS` still control the
liveness cadence.

> Setting `TOKEN_ENCRYPTION_KEY` on an install that already has saved tokens will
> make those tokens unreadable — they will show as **Token unreadable** and need
> pasting again. Set it before adding tokens, or leave it alone.

---

## New API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/clients/:id/ha-token/test` | Verify a token. Send `{ haToken }` to test before saving, or omit it to test the stored one. |
| `DELETE` | `/api/clients/:id/ha-token` | Remove the token and clear derived data. |
| `POST` | `/api/clients/:id/refresh` | Force an immediate full sweep of one site. |

All three are admin-only. `POST` and `PATCH` on `/api/clients` now also accept an
optional `haToken` field.

---

## Files changed

**New**

```
backend/src/utils/crypto.js                      AES-256-GCM for stored tokens
backend/src/services/haClient.js                 Home Assistant REST client
backend/src/services/statusPoller.js             replaces urlPoller.js
backend/prisma/migrations/20260807000000_add_ha_api/
frontend/src/lib/format.js                       formatting + triage rules
frontend/src/components/ClientCard.jsx
frontend/src/components/FleetBar.jsx
frontend/src/components/VersionChip.jsx
frontend/src/components/HaTokenField.jsx
```

**Removed**

```
backend/src/services/urlPoller.js                superseded by statusPoller.js
```

**Modified**

```
VERSION                                          1.11.0
backend/package.json, frontend/package.json      1.11.0
backend/prisma/schema.prisma                     18 new Client columns
backend/src/controllers/clients.controller.js    token save/test/clear/refresh
backend/src/routes/clients.routes.js             3 new endpoints
backend/src/routes/system.routes.js              stats + export secret fix
backend/src/server.js                            poller swap
frontend/tailwind.config.js                      palette + type scale
frontend/index.html                              fonts
frontend/src/index.css                           design system
frontend/src/components/Layout.jsx               bottom nav
frontend/src/components/StatusBadge.jsx
frontend/src/components/BackupCard.jsx           palette only
frontend/src/pages/Dashboard.jsx                 rebuilt
frontend/src/pages/Clients.jsx                   rebuilt
frontend/src/pages/Users.jsx                     restyled
frontend/src/pages/Logs.jsx                      restyled
frontend/src/pages/Settings.jsx                  palette only
frontend/src/pages/Login.jsx                     restyled
frontend/src/pages/Setup.jsx                     restyled
```
