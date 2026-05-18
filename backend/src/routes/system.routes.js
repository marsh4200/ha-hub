const router = require('express').Router();
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

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

// JSON export of clients + users + permissions (admin)
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

module.exports = router;
