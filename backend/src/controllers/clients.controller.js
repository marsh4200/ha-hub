const { body, param } = require('express-validator');
const prisma = require('../config/prisma');
const { randomToken } = require('../utils/tokens');
const { log } = require('../utils/logger');

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function sanitize(c) {
  if (!c) return c;
  return {
    ...c,
    uptime: c.uptime != null ? Number(c.uptime) : null,
    backupSize: c.backupSize != null ? Number(c.backupSize) : null,
  };
}

async function list(req, res) {
  const where =
    req.user.role === 'ADMIN'
      ? {}
      : { permissions: { some: { userId: req.user.id } } };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true, url: true, haVersion: true, hostname: true,
      uptime: true, status: true, lastSeenAt: true, notes: true, group: true,
      tags: true, createdAt: true, updatedAt: true,
      backupFilename: true, backupSize: true, backupUploadedAt: true,
    },
  });
  res.json({ clients: clients.map(sanitize) });
}

async function get(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: req.user.role === 'ADMIN'
      ? { permissions: { include: { user: { select: { id: true, username: true } } } } }
      : undefined,
  });
  if (!client) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN') {
    const allowed = await prisma.permission.findFirst({ where: { userId: req.user.id, clientId: id } });
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    delete client.apiToken;
  }
  res.json({ client: sanitize(client) });
}

const createValidators = [
  body('name').isString().trim().isLength({ min: 1, max: 64 }),
  body('url').isURL({ require_protocol: true }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('group').optional({ nullable: true }).isString().isLength({ max: 64 }),
  body('tags').optional().isArray(),
];

async function create(req, res) {
  const { name, url, notes, group, tags } = req.body;
  let slug = slugify(name);
  let suffix = 0;
  while (await prisma.client.findUnique({ where: { slug: suffix ? `${slug}-${suffix}` : slug } })) suffix++;
  if (suffix) slug = `${slug}-${suffix}`;
  const apiToken = randomToken(32);

  const client = await prisma.client.create({
    data: { name, slug, url, notes: notes || null, group: group || null, tags: tags || [], apiToken },
  });
  await log({ category: 'client', level: 'AUDIT', message: `Client created: ${name}`, userId: req.user.id, meta: { clientId: client.id } });
  res.status(201).json({ client: sanitize(client) });
}

const updateValidators = [
  param('id').isString(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 64 }),
  body('url').optional().isURL({ require_protocol: true }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('group').optional({ nullable: true }).isString().isLength({ max: 64 }),
  body('tags').optional().isArray(),
];

async function update(req, res) {
  const { id } = req.params;
  const data = {};
  for (const k of ['name', 'url', 'notes', 'group', 'tags']) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }
  const client = await prisma.client.update({ where: { id }, data });
  await log({ category: 'client', level: 'AUDIT', message: `Client updated: ${client.name}`, userId: req.user.id, meta: { clientId: client.id } });
  res.json({ client: sanitize(client) });
}

async function remove(req, res) {
  const { id } = req.params;
  const client = await prisma.client.delete({ where: { id } });
  // Also clean up any backup files on disk
  const fsp = require('fs/promises');
  const path = require('path');
  const backupDir = path.join(process.env.BACKUP_DIR || '/app/data/backups', id);
  for (const f of ['backup.tar', 'backup.tar.gz']) {
    await fsp.unlink(path.join(backupDir, f)).catch(() => {});
  }
  await fsp.rmdir(backupDir).catch(() => {});

  await log({ category: 'client', level: 'AUDIT', message: `Client deleted: ${client.name}`, userId: req.user.id, meta: { clientId: client.id } });
  res.json({ ok: true });
}

async function rotateToken(req, res) {
  const { id } = req.params;
  const apiToken = randomToken(32);
  const client = await prisma.client.update({ where: { id }, data: { apiToken } });
  await log({ category: 'client', level: 'AUDIT', message: `Token rotated`, userId: req.user.id, meta: { clientId: client.id } });
  res.json({ apiToken });
}

module.exports = {
  list, get,
  create, createValidators,
  update, updateValidators,
  remove,
  rotateToken,
};
