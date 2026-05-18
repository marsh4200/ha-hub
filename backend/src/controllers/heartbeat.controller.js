const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { log } = require('../utils/logger');
const { getIO } = require('../services/socket');

const heartbeatValidators = [
  body('hostname').optional().isString().isLength({ max: 128 }),
  body('ha_version').optional().isString().isLength({ max: 32 }),
  body('uptime').optional().isInt({ min: 0 }),
];

async function heartbeat(req, res) {
  const c = req.client; // populated by requireClientToken
  const { hostname, ha_version, uptime } = req.body || {};

  const wasOffline = c.status !== 'ONLINE';
  const updated = await prisma.client.update({
    where: { id: c.id },
    data: {
      status: 'ONLINE',
      lastSeenAt: new Date(),
      hostname: hostname ?? c.hostname,
      haVersion: ha_version ?? c.haVersion,
      uptime: uptime != null ? BigInt(uptime) : c.uptime,
    },
  });

  if (wasOffline) {
    await log({ category: 'client', level: 'INFO', message: `Client back online: ${c.name}`, meta: { clientId: c.id } });
  }

  const payload = {
    id: updated.id,
    name: updated.name,
    status: updated.status,
    lastSeenAt: updated.lastSeenAt,
    hostname: updated.hostname,
    haVersion: updated.haVersion,
    uptime: updated.uptime != null ? Number(updated.uptime) : null,
  };
  try {
    getIO()?.emit('client:update', payload);
  } catch (_) {}

  res.json({ ok: true, interval: 30 });
}

module.exports = { heartbeat, heartbeatValidators };
