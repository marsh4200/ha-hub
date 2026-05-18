const prisma = require('../config/prisma');
const { log } = require('../utils/logger');
const { getIO } = require('./socket');

const TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '90', 10) * 1000;

async function tick() {
  const cutoff = new Date(Date.now() - TIMEOUT);
  const stale = await prisma.client.findMany({
    where: { status: 'ONLINE', OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null }] },
  });

  for (const c of stale) {
    await prisma.client.update({ where: { id: c.id }, data: { status: 'OFFLINE' } });
    await log({
      category: 'client', level: 'WARN',
      message: `Client went offline: ${c.name}`,
      meta: { clientId: c.id, lastSeenAt: c.lastSeenAt },
    });
    try {
      getIO()?.emit('client:update', { id: c.id, name: c.name, status: 'OFFLINE', lastSeenAt: c.lastSeenAt });
      getIO()?.to('admins').emit('notification', { type: 'offline', clientId: c.id, name: c.name, at: new Date() });
    } catch (_) {}
  }
}

function startOfflineWatcher() {
  setInterval(() => tick().catch(e => console.error('watcher error', e)), 15_000);
}

module.exports = { startOfflineWatcher };
