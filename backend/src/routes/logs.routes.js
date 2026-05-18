const router = require('express').Router();
const prisma = require('../config/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize || '50', 10)));
  const where = {};
  if (req.query.category) where.category = String(req.query.category);
  if (req.query.level) where.level = String(req.query.level);

  const [total, items] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      include: { user: { select: { username: true } } },
    }),
  ]);

  res.json({ total, page, pageSize, items });
});

router.delete('/', async (req, res) => {
  const olderThanDays = Math.max(1, parseInt(req.query.olderThanDays || '30', 10));
  const cutoff = new Date(Date.now() - olderThanDays * 86400000);
  const r = await prisma.log.deleteMany({ where: { createdAt: { lt: cutoff } } });
  res.json({ deleted: r.count });
});

module.exports = router;
