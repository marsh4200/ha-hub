# Home Assistant access tokens

HA-Hub can read live data out of each client's Home Assistant — version, entity
counts, and pending updates — using a long-lived access token. This is
**optional per site**. Sites without a token still show online/offline as before.

---

## What you get

Without a token, HA-Hub polls the site's URL. That proves *something* answered
behind the Cloudflare Tunnel — usually Cloudflare itself.

With a token, HA-Hub asks Home Assistant directly and gets back:

- The Home Assistant version, and whether a newer one is out
- Every pending update by name — core, OS, supervisor, and each HACS integration
- Entity count, and how many entities are sitting `unavailable`
- Integration and automation counts
- The site's own name, time zone, and whether HA is running or still starting
- A real response time

The online check also becomes trustworthy: an authenticated `GET /api/` proves
Home Assistant itself is alive, not just that the tunnel resolved.

---

## Creating the token

On the **client's** Home Assistant:

1. Click your user name at the bottom of the sidebar to open your profile.
2. Open the **Security** tab.
3. Scroll to the bottom, to **Long-lived access tokens**.
4. Click **Create token**, give it a name like `HA-Hub`, and copy the value.

The token is shown **once**. It does not expire, and it inherits the permissions
of the account that created it.

> Consider creating a dedicated Home Assistant user for HA-Hub rather than using
> your own account, so you can revoke it independently. Note that Home Assistant
> has no read-only user role — any account's token is an admin-capable
> credential — which is why HA-Hub encrypts it and never exposes it to the
> browser.

---

## Adding it to HA-Hub

1. **Manage → edit the site** (or **Add site** when creating a new one).
2. Paste the token into **Home Assistant access token**.
3. Click **Test connection**.

The test tells you the version and site name it found, so a wrong URL or a
mistyped token fails visibly instead of silently doing nothing. Then save.

Within a few seconds the site's card fills in with real data. If it doesn't,
press **Check now** on the site row.

---

## Replacing or removing a token

- **Replace** — edit the site, press **Replace**, paste the new value, save.
- **Remove** — edit the site and press the bin icon next to the masked token.
  HA-Hub clears the token and all derived readings, and falls back to URL
  polling.

Leaving the token field blank when saving keeps whatever is already stored — an
empty box will never wipe a working token.

---

## How it's stored

- Encrypted with **AES-256-GCM** before it touches the database.
- The key is derived from your `JWT_SECRET` (or `TOKEN_ENCRYPTION_KEY` if you
  set one).
- Never returned by the API, never written to logs, never included in an export.
- The UI only ever sees the last six characters, as `••••••a1b2c3`.

All Home Assistant calls happen from the HA-Hub server, never from a browser.

---

## Statuses you might see

| Status | Meaning | Fix |
| --- | --- | --- |
| *(none)* | Working normally | — |
| **Token rejected** | Home Assistant returned 401/403 | The token was deleted or the user disabled. Create a new one. |
| **Token unreadable** | Stored token can't be decrypted | `JWT_SECRET` or `TOKEN_ENCRYPTION_KEY` changed. Paste the token again. |
| **Site unreachable** | Couldn't connect at all | Tunnel or HA is down — this is a site problem, not a token problem. |

A rejected token does **not** mark the site offline. Home Assistant answered, so
the site is up; only the credential is wrong.

---

## Tuning

All optional, all with sensible defaults:

```bash
HA_DETAIL_INTERVAL_SECONDS=300   # full /api/states sweep cadence
HA_API_TIMEOUT_SECONDS=15        # per-request timeout
POLL_CONCURRENCY=8               # sites probed in parallel
URL_POLL_INTERVAL_SECONDS=30     # liveness cadence (existing variable)
```

Raise `HA_DETAIL_INTERVAL_SECONDS` if you have many large sites — `/api/states`
returns every entity, so it is the expensive call. The 30-second liveness ping is
cheap and unaffected.

---

## Troubleshooting

**Test says "Response was not JSON"** — the URL points at something that isn't
Home Assistant, or a Cloudflare Access login page is intercepting the request. If
the site sits behind Cloudflare Access, add a service-token bypass policy for the
HA-Hub server, or exclude `/api/*` from the Access policy.

**Test times out but the site opens fine in a browser** — the HA-Hub server
can't reach the hostname even though your browser can. Check DNS and egress from
the HA-Hub box: `curl -I https://client1.mydomain.com`.

**Version shows but entity counts don't** — `/api/config` succeeded and
`/api/states` didn't, usually a timeout on a very large instance. Raise
`HA_API_TIMEOUT_SECONDS`.
