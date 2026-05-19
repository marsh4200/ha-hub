const router = require('express').Router();
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { readState, currentCommit, checkRemote, requestUpdate } = require('../services/updater');

router.get('/stats', requireAuth, async (req, res) => {
  const where = req.user.role === 'ADMIN'
    ? {}
    : { permissions: { some: { userId: req.user.id } } };
  const [total, online, offline, unknown] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.count({ where: { ...where, status: 'ONLINE' } }),
    prisma.client.count({ where: { ...where, status: 'OFFLINE' } }),
    prisma.client.count({ where: { ...where, status: 'UNKNOWN' } }),
  ]);
  const userCount = req.user.role === 'ADMIN' ? await prisma.user.count() : null;
  res.json({ total, online, offline, unknown, userCount });
});

router.get('/export', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const [users, clients, permissions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, active: true, createdAt: true } }),
    prisma.client.findMany(),
    prisma.permission.findMany(),
  ]);
  const sanitizedClients = clients.map(c => ({ ...c, uptime: c.uptime != null ? Number(c.uptime) : null }));
  res.setHeader('Content-Disposition', `attachment; filename=ha-hub-export-${Date.now()}.json`);
  res.json({ exportedAt: new Date(), users, clients: sanitizedClients, permissions });
});

router.get('/update/status', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const local = await currentCommit();
  const state = readState();
  const repo = process.env.UPDATE_REPO || 'https://github.com/marsh4200/ha-hub.git';
  res.json({ local, state, repo });
});

router.get('/update/check', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const repo = process.env.UPDATE_REPO || 'https://github.com/marsh4200/ha-hub.git';
  const result = await checkRemote(repo);
  if (result.error) return res.json({ error: result.error, repo });
  res.json({ ...result, repo });
});

router.post('/update', requireAuth, requireRole('ADMIN'), async (req, res) => {
  // Refuse if already up to date (unless forced)
  if (!req.body?.force) {
    const repo = process.env.UPDATE_REPO || 'https://github.com/marsh4200/ha-hub.git';
    const check = await checkRemote(repo);
    if (check && !check.error && check.upToDate) {
      return res.status(200).json({
        ok: false,
        upToDate: true,
        version: check.localVersion,
        message: `Already up to date with version ${check.localVersion}`,
      });
    }
  }

  const result = requestUpdate();
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true, message: 'Update requested. The portal will restart shortly.' });
});

module.exports = router;
