const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const prisma = require('../config/prisma');
const { log } = require('../utils/logger');

const PUBLIC = { id: true, username: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true };

async function list(req, res) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { ...PUBLIC, permissions: { select: { clientId: true } } },
  });
  res.json({
    users: users.map(u => ({ ...u, clientIds: u.permissions.map(p => p.clientId), permissions: undefined })),
  });
}

const createValidators = [
  body('username').isString().trim().isLength({ min: 3, max: 32 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('email').optional({ nullable: true }).isEmail(),
  body('role').optional().isIn(['ADMIN', 'USER']),
  body('clientIds').optional().isArray(),
];

async function create(req, res) {
  const { username, password, email, role = 'USER', clientIds = [] } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username, email: email || null, passwordHash, role,
      permissions: { create: clientIds.map(cid => ({ clientId: cid })) },
    },
    select: PUBLIC,
  });
  await log({ category: 'user', level: 'AUDIT', message: `User created: ${username} (${role})`, userId: req.user.id });
  res.status(201).json({ user });
}

const updateValidators = [
  param('id').isString(),
  body('email').optional({ nullable: true }).isEmail(),
  body('role').optional().isIn(['ADMIN', 'USER']),
  body('active').optional().isBoolean(),
  body('password').optional().isString().isLength({ min: 8, max: 128 }),
  body('clientIds').optional().isArray(),
];

async function update(req, res) {
  const { id } = req.params;
  const data = {};
  for (const k of ['email', 'role', 'active']) if (req.body[k] !== undefined) data[k] = req.body[k];
  if (req.body.password) data.passwordHash = await bcrypt.hash(req.body.password, 12);

  // Prevent removing the last admin
  if (data.role === 'USER' || data.active === false) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === 'ADMIN') {
      const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', active: true, NOT: { id } } });
      if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot demote or disable the last active admin' });
    }
  }

  if (Array.isArray(req.body.clientIds)) {
    await prisma.$transaction([
      prisma.permission.deleteMany({ where: { userId: id } }),
      prisma.permission.createMany({ data: req.body.clientIds.map(cid => ({ userId: id, clientId: cid })) }),
    ]);
  }

  const user = await prisma.user.update({ where: { id }, data, select: PUBLIC });
  await log({ category: 'user', level: 'AUDIT', message: `User updated: ${user.username}`, userId: req.user.id });
  res.json({ user });
}

async function remove(req, res) {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', NOT: { id } } });
    if (otherAdmins === 0) return res.status(400).json({ error: 'Cannot delete the last admin' });
  }
  await prisma.user.delete({ where: { id } });
  await log({ category: 'user', level: 'AUDIT', message: `User deleted: ${target.username}`, userId: req.user.id });
  res.json({ ok: true });
}

module.exports = { list, create, createValidators, update, updateValidators, remove };
