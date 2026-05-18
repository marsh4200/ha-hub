// Polls every client URL every 30s and updates ONLINE/OFFLINE status.
// Replaces the need for the heartbeat agent for most users.
const prisma = require('../config/prisma');
const { log } = require('../utils/logger');
const { getIO } = require('./socket');

const INTERVAL = parseInt(process.env.URL_POLL_INTERVAL_SECONDS || '30', 10) * 1000;
const TIMEOUT  = parseInt(process.env.URL_POLL_TIMEOUT_SECONDS  || '10', 10) * 1000;

// Try to extract HA version from /manifest.json or fall back gracefully.
async function probe(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT);
  try {
    // Try the manifest first — small JSON, gives us name/version cheaply
    const manifestUrl = url.replace(/\/+$/, '') + '/manifest.json';
    const r = await fetch(manifestUrl, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'HA-Hub/1.0 (uptime check)' },
    });
    if (r.ok) {
      let version = null;
      try {
        const j = await r.json();
        // HA manifest doesn't expose version, but the root page does in <meta>
        version = j.version || null;
      } catch (_) {}
      return { ok: true, status: r.status, version };
    }
    // 401/403/302 still means "something is responding" → online
    if ([301, 302, 401, 403].includes(r.status)) {
      return { ok: true, status: r.status, version: null };
    }
    // 5xx = service is down behind the tunnel
    return { ok: false, status: r.status, version: null };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : (err.message || 'error') };
  } finally {
    clearTimeout(t);
  }
}

async function checkOne(client) {
  const result = await probe(client.url);
  const wasOnline = client.status === 'ONLINE';
  const isOnline = result.ok;

  const updateData = {
    status: isOnline ? 'ONLINE' : 'OFFLINE',
    lastSeenAt: isOnline ? new Date() : client.lastSeenAt,
  };
  if (isOnline && result.version) updateData.haVersion = result.version;

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: updateData,
  });

  // Log + notify only on transitions
  if (wasOnline && !isOnline) {
    await log({
      category: 'client', level: 'WARN',
      message: `Client went offline: ${client.name}`,
      meta: { clientId: client.id, error: result.error || `HTTP ${result.status}` },
    });
    try {
      getIO()?.to('admins').emit('notification', {
        type: 'offline', clientId: client.id, name: client.name, at: new Date(),
      });
    } catch (_) {}
  } else if (!wasOnline && isOnline) {
    await log({
      category: 'client', level: 'INFO',
      message: `Client back online: ${client.name}`,
      meta: { clientId: client.id },
    });
  }

  try {
    getIO()?.emit('client:update', {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      lastSeenAt: updated.lastSeenAt,
      haVersion: updated.haVersion,
    });
  } catch (_) {}
}

async function tick() {
  const clients = await prisma.client.findMany({ select: { id: true, name: true, url: true, status: true, lastSeenAt: true } });
  // Run probes in parallel with a soft cap
  const chunks = [];
  const SIZE = 10;
  for (let i = 0; i < clients.length; i += SIZE) chunks.push(clients.slice(i, i + SIZE));
  for (const batch of chunks) {
    await Promise.all(batch.map(c => checkOne(c).catch(e => console.error('poll', c.id, e.message))));
  }
}

function startUrlPoller() {
  console.log(`[urlPoller] starting, interval ${INTERVAL/1000}s, timeout ${TIMEOUT/1000}s`);
  // first run after 5s so server has time to settle
  setTimeout(() => { tick().catch(e => console.error(e)); }, 5000);
  setInterval(() => { tick().catch(e => console.error(e)); }, INTERVAL);
}

module.exports = { startUrlPoller };
