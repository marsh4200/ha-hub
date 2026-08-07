// HA-Hub v1.11 — status poller.
//
// Supersedes the old urlPoller. Two cadences:
//
//   Liveness (default 30s)  — is the site up?
//       token present → GET /api/  (proves Home Assistant itself answered)
//       no token      → HTTP probe of the URL (proves *something* answered)
//
//   Detail (default 300s)   — what is the site running?
//       token only. Reads /api/config + /api/states for version, entity counts,
//       unavailable entities and pending updates.
//
// A site that fails repeatedly is backed off so one dead tunnel can't slow the
// sweep for everyone else.

const prisma = require('../config/prisma');
const { log } = require('../utils/logger');
const { getIO } = require('./socket');
const { decryptSecret } = require('../utils/crypto');
const ha = require('./haClient');

const LIVENESS_INTERVAL = parseInt(process.env.URL_POLL_INTERVAL_SECONDS || '30', 10) * 1000;
const LIVENESS_TIMEOUT = parseInt(process.env.URL_POLL_TIMEOUT_SECONDS || '10', 10) * 1000;
const DETAIL_INTERVAL = parseInt(process.env.HA_DETAIL_INTERVAL_SECONDS || '300', 10) * 1000;
const CONCURRENCY = parseInt(process.env.POLL_CONCURRENCY || '8', 10);
const MAX_BACKOFF_CYCLES = 10;

// clientId -> { fails, skip }
const backoff = new Map();

function shouldSkip(id) {
  const b = backoff.get(id);
  if (!b || b.skip <= 0) return false;
  b.skip -= 1;
  return true;
}

function noteFailure(id) {
  const b = backoff.get(id) || { fails: 0, skip: 0 };
  b.fails += 1;
  // 1st–2nd failure: no delay. Then back off geometrically, capped.
  b.skip = b.fails <= 2 ? 0 : Math.min(2 ** (b.fails - 2), MAX_BACKOFF_CYCLES);
  backoff.set(id, b);
}

function noteSuccess(id) {
  backoff.delete(id);
}

/** Unauthenticated probe — the pre-v1.11 behaviour, kept for tokenless clients. */
async function probeUrl(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), LIVENESS_TIMEOUT);
  try {
    const target = String(url).replace(/\/+$/, '') + '/manifest.json';
    const r = await fetch(target, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'HA-Hub/1.11 (uptime check)' },
    });
    // 401/403/30x still means something is alive behind the tunnel.
    if (r.ok || [301, 302, 401, 403].includes(r.status)) {
      return { ok: true, status: r.status };
    }
    return { ok: false, error: `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Timed out' : (err.message || 'Connection failed') };
  } finally {
    clearTimeout(timer);
  }
}

function emit(event, payload, room) {
  try {
    const io = getIO();
    if (!io) return;
    if (room) io.to(room).emit(event, payload);
    else io.emit(event, payload);
  } catch (_) { /* socket not ready */ }
}

async function checkOne(client, { withDetail }) {
  const token = client.haToken ? decryptSecret(client.haToken) : null;
  const hasStoredToken = !!client.haToken;
  const decryptFailed = hasStoredToken && !token;

  const data = {};
  let isOnline = false;
  let failReason = null;

  if (token) {
    const wantDetail = withDetail ||
      !client.lastDetailAt ||
      (Date.now() - new Date(client.lastDetailAt).getTime()) >= DETAIL_INTERVAL;

    if (wantDetail) {
      const r = await ha.collect(client.url, token);
      // A 401 means Home Assistant answered — the site is up, the token is
      // wrong. Calling that OFFLINE would send someone chasing a dead tunnel
      // when the real fix is a new token.
      isOnline = r.ok || r.authFailed;
      failReason = r.error;

      if (r.ok) {
        Object.assign(data, {
          haVersion: r.version ?? client.haVersion,
          locationName: r.locationName,
          timeZone: r.timeZone,
          haState: r.haState,
          integrationCount: r.integrationCount,
          entityCount: r.entityCount,
          unavailableCount: r.unavailableCount,
          automationCount: r.automationCount,
          updateAvailable: !!r.updateAvailable,
          latestVersion: r.latestVersion,
          pendingUpdates: r.pendingUpdates,
          haDetails: { updates: r.updates, domains: r.domains, personCount: r.personCount },
          lastDetailAt: new Date(),
          haTokenStatus: 'OK',
          haTokenCheckedAt: new Date(),
          latencyMs: r.latencyMs ?? null,
        });
      } else if (r.authFailed) {
        data.haTokenStatus = 'UNAUTHORIZED';
        data.haTokenCheckedAt = new Date();
      }
    } else {
      const r = await ha.ping(client.url, token);
      isOnline = r.ok || r.authFailed;   // see note above
      failReason = r.error;
      data.latencyMs = r.latencyMs ?? null;
      if (r.ok) {
        data.haTokenStatus = 'OK';
        data.haTokenCheckedAt = new Date();
      } else if (r.authFailed) {
        data.haTokenStatus = 'UNAUTHORIZED';
        data.haTokenCheckedAt = new Date();
      }
    }
  } else {
    const r = await probeUrl(client.url);
    isOnline = r.ok;
    failReason = r.error;
    if (decryptFailed) data.haTokenStatus = 'DECRYPT_FAILED';
  }

  const wasOnline = client.status === 'ONLINE';
  data.status = isOnline ? 'ONLINE' : 'OFFLINE';
  if (isOnline) data.lastSeenAt = new Date();

  if (isOnline) noteSuccess(client.id);
  else noteFailure(client.id);

  const updated = await prisma.client.update({ where: { id: client.id }, data });

  if (wasOnline && !isOnline) {
    await log({
      category: 'client', level: 'WARN',
      message: `Client went offline: ${client.name}`,
      meta: { clientId: client.id, reason: failReason || 'unreachable' },
    });
    emit('notification', { type: 'offline', clientId: client.id, name: client.name, at: new Date() }, 'admins');
  } else if (!wasOnline && isOnline) {
    await log({
      category: 'client', level: 'INFO',
      message: `Client back online: ${client.name}`,
      meta: { clientId: client.id },
    });
  }

  emit('client:update', {
    id: updated.id,
    name: updated.name,
    status: updated.status,
    lastSeenAt: updated.lastSeenAt,
    haVersion: updated.haVersion,
    latestVersion: updated.latestVersion,
    updateAvailable: updated.updateAvailable,
    pendingUpdates: updated.pendingUpdates,
    entityCount: updated.entityCount,
    unavailableCount: updated.unavailableCount,
    integrationCount: updated.integrationCount,
    locationName: updated.locationName,
    haState: updated.haState,
    latencyMs: updated.latencyMs,
    haTokenStatus: updated.haTokenStatus,
  });

  return updated;
}

const SELECT = {
  id: true, name: true, url: true, status: true, lastSeenAt: true,
  haVersion: true, haToken: true, lastDetailAt: true,
};

async function tick() {
  const clients = await prisma.client.findMany({ select: SELECT });
  const due = clients.filter(c => !shouldSkip(c.id));

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(c =>
      checkOne(c, { withDetail: false }).catch(e =>
        console.error('[poller]', c.name, e.message)
      )
    ));
  }
}

/** Force an immediate full refresh of one client — used by the Refresh button. */
async function refreshClient(id) {
  const client = await prisma.client.findUnique({ where: { id }, select: SELECT });
  if (!client) return null;
  backoff.delete(id);
  return checkOne(client, { withDetail: true });
}

function startStatusPoller() {
  console.log(
    `[poller] liveness ${LIVENESS_INTERVAL / 1000}s · detail ${DETAIL_INTERVAL / 1000}s · concurrency ${CONCURRENCY}`
  );
  setTimeout(() => tick().catch(e => console.error('[poller]', e)), 5000);
  setInterval(() => tick().catch(e => console.error('[poller]', e)), LIVENESS_INTERVAL);
}

module.exports = { startStatusPoller, refreshClient, probeUrl };
