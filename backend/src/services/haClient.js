// HA-Hub v1.11 — Home Assistant REST API client.
//
// Talks to a client's Home Assistant using a long-lived access token. All calls
// happen server-side, so there is no CORS involvement and the token never
// reaches a browser.
//
// Endpoints used:
//   GET /api/          — cheap authenticated ping; proves HA itself is alive,
//                        not merely that Cloudflare answered.
//   GET /api/config    — version, location_name, time_zone, state, components[]
//   GET /api/states    — every entity; gives counts, unavailable entities, and
//                        the update.* entities that carry installed/latest version.

const DEFAULT_TIMEOUT = parseInt(process.env.HA_API_TIMEOUT_SECONDS || '15', 10) * 1000;
const UA = 'HA-Hub/1.11 (fleet monitor)';

function normaliseBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Single authenticated request. Never throws — always resolves to a result
 * object so callers can branch on `authFailed` vs `unreachable`.
 */
async function haFetch(baseUrl, path, token, timeoutMs = DEFAULT_TIMEOUT) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${normaliseBase(baseUrl)}${path}`, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
    });
    const latencyMs = Date.now() - started;

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, authFailed: true, latencyMs, error: 'Token rejected by Home Assistant' };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs, error: `HTTP ${res.status}` };
    }

    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      return { ok: false, status: res.status, latencyMs, error: 'Response was not JSON — is this URL really Home Assistant?' };
    }
    return { ok: true, status: res.status, latencyMs, json };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err.name === 'AbortError' ? 'Timed out' : (err.message || 'Connection failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Cheap authenticated liveness check. */
async function ping(url, token) {
  const r = await haFetch(url, '/api/', token, Math.min(DEFAULT_TIMEOUT, 10000));
  return {
    ok: r.ok,
    authFailed: !!r.authFailed,
    latencyMs: r.latencyMs,
    error: r.error || null,
  };
}

/** Validate a token and return the friendly bits, without pulling all states. */
async function verify(url, token) {
  const cfg = await haFetch(url, '/api/config', token);
  if (!cfg.ok) {
    return {
      ok: false,
      authFailed: !!cfg.authFailed,
      error: cfg.error || 'Could not read /api/config',
      latencyMs: cfg.latencyMs,
    };
  }
  const c = cfg.json || {};
  return {
    ok: true,
    latencyMs: cfg.latencyMs,
    version: c.version || null,
    locationName: c.location_name || null,
    timeZone: c.time_zone || null,
    haState: c.state || null,
    integrationCount: Array.isArray(c.components) ? c.components.length : null,
  };
}

/**
 * Read an update.* entity into a tidy shape.
 * In HA an update entity is `on` when an update is pending.
 */
function readUpdateEntity(e) {
  const a = e.attributes || {};
  return {
    entityId: e.entity_id,
    title: a.title || a.friendly_name || e.entity_id.replace(/^update\./, ''),
    installed: a.installed_version || null,
    latest: a.latest_version || null,
    pending: e.state === 'on',
    skipped: a.skipped_version || null,
  };
}

/**
 * Full detail sweep: config + states. This is the expensive one, so the poller
 * runs it on a slower cadence than the liveness ping.
 */
async function collect(url, token) {
  const cfg = await haFetch(url, '/api/config', token);
  if (!cfg.ok) {
    return {
      ok: false,
      authFailed: !!cfg.authFailed,
      error: cfg.error || 'Could not read /api/config',
      latencyMs: cfg.latencyMs,
    };
  }

  const c = cfg.json || {};
  const out = {
    ok: true,
    authFailed: false,
    latencyMs: cfg.latencyMs,
    version: c.version || null,
    locationName: c.location_name || null,
    timeZone: c.time_zone || null,
    haState: c.state || null,
    integrationCount: Array.isArray(c.components) ? c.components.length : null,
    entityCount: null,
    unavailableCount: null,
    automationCount: null,
    personCount: null,
    updateAvailable: false,
    latestVersion: null,
    pendingUpdates: 0,
    updates: [],
    domains: {},
    error: null,
  };

  const states = await haFetch(url, '/api/states', token, DEFAULT_TIMEOUT * 2);
  if (!states.ok || !Array.isArray(states.json)) {
    // Config worked, states didn't. Still a useful result — keep what we have.
    out.error = states.error || 'Could not read /api/states';
    return out;
  }

  const all = states.json;
  const domains = {};
  let unavailable = 0;
  const updates = [];

  for (const e of all) {
    const id = e.entity_id || '';
    const domain = id.split('.')[0];
    if (domain) domains[domain] = (domains[domain] || 0) + 1;

    if (e.state === 'unavailable') unavailable++;
    if (domain === 'update') updates.push(readUpdateEntity(e));
  }

  const pending = updates.filter(u => u.pending);
  const core = updates.find(u => u.entityId === 'update.home_assistant_core_update');

  out.entityCount = all.length;
  out.unavailableCount = unavailable;
  out.automationCount = domains.automation || 0;
  out.personCount = domains.person || 0;
  out.domains = domains;
  out.updates = pending
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, 40); // keep the JSON column bounded
  out.pendingUpdates = pending.length;
  out.updateAvailable = pending.length > 0;

  // Prefer the core update entity's own version pair — it's authoritative and
  // more current than /api/config during a partially-applied upgrade.
  if (core?.installed) out.version = core.installed;
  if (core?.pending && core.latest) out.latestVersion = core.latest;

  return out;
}

module.exports = { ping, verify, collect, haFetch, normaliseBase };
