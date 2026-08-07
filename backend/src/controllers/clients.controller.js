const { body, param } = require('express-validator');
const prisma = require('../config/prisma');
const { randomToken } = require('../utils/tokens');
const { encryptSecret, decryptSecret, tokenHint, maskFromHint } = require('../utils/crypto');
const { log } = require('../utils/logger');
const ha = require('../services/haClient');
const { refreshClient } = require('../services/statusPoller');

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

/**
 * Shape a client for the wire. The encrypted HA token is stripped here and
 * never leaves the server — the browser only ever sees a masked hint.
 */
function sanitize(c) {
  if (!c) return c;
  const { haToken, haTokenHint, ...rest } = c;
  return {
    ...rest,
    uptime: c.uptime != null ? Number(c.uptime) : null,
    backupSize: c.backupSize != null ? Number(c.backupSize) : null,
    hasHaToken: !!haToken,
    haTokenMask: maskFromHint(haTokenHint),
  };
}

const LIST_SELECT = {
  id: true, name: true, slug: true, url: true, haVersion: true, hostname: true,
  uptime: true, status: true, lastSeenAt: true, notes: true, group: true,
  tags: true, createdAt: true, updatedAt: true,
  backupFilename: true, backupSize: true, backupUploadedAt: true,
  // v1.11
  haToken: true, haTokenHint: true, haTokenStatus: true, haTokenCheckedAt: true,
  locationName: true, timeZone: true, haState: true,
  entityCount: true, unavailableCount: true, integrationCount: true, automationCount: true,
  updateAvailable: true, latestVersion: true, pendingUpdates: true,
  latencyMs: true, lastDetailAt: true, haDetails: true,
};

async function list(req, res) {
  const where =
    req.user.role === 'ADMIN'
      ? {}
      : { permissions: { some: { userId: req.user.id } } };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    select: LIST_SELECT,
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
  body('haToken').optional({ nullable: true }).isString().isLength({ max: 2048 }),
];

async function create(req, res) {
  const { name, url, notes, group, tags, haToken } = req.body;
  let slug = slugify(name);
  let suffix = 0;
  while (await prisma.client.findUnique({ where: { slug: suffix ? `${slug}-${suffix}` : slug } })) suffix++;
  if (suffix) slug = `${slug}-${suffix}`;
  const apiToken = randomToken(32);

  const data = {
    name, slug, url,
    notes: notes || null,
    group: group || null,
    tags: tags || [],
    apiToken,
  };

  const trimmed = typeof haToken === 'string' ? haToken.trim() : '';
  if (trimmed) {
    data.haToken = encryptSecret(trimmed);
    data.haTokenHint = tokenHint(trimmed);
    data.haTokenSetAt = new Date();
    data.haTokenStatus = null;
  }

  const client = await prisma.client.create({ data });
  await log({
    category: 'client', level: 'AUDIT',
    message: `Client created: ${name}`,
    userId: req.user.id,
    meta: { clientId: client.id, haToken: !!trimmed },
  });

  // Pull real data straight away so the card isn't blank while the operator watches.
  if (trimmed) refreshClient(client.id).catch(() => {});

  res.status(201).json({ client: sanitize(client) });
}

const updateValidators = [
  param('id').isString(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 64 }),
  body('url').optional().isURL({ require_protocol: true }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('group').optional({ nullable: true }).isString().isLength({ max: 64 }),
  body('tags').optional().isArray(),
  body('haToken').optional({ nullable: true }).isString().isLength({ max: 2048 }),
];

async function update(req, res) {
  const { id } = req.params;
  const data = {};
  for (const k of ['name', 'url', 'notes', 'group', 'tags']) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }

  // A blank/absent haToken means "leave the stored one alone" — the field is
  // write-only in the UI, so an empty box must not silently wipe a good token.
  // Removing a token is an explicit DELETE on its own endpoint.
  const incoming = typeof req.body.haToken === 'string' ? req.body.haToken.trim() : '';
  let tokenChanged = false;
  if (incoming) {
    data.haToken = encryptSecret(incoming);
    data.haTokenHint = tokenHint(incoming);
    data.haTokenSetAt = new Date();
    data.haTokenStatus = null;
    data.haTokenCheckedAt = null;
    tokenChanged = true;
  }

  const client = await prisma.client.update({ where: { id }, data });
  await log({
    category: 'client', level: 'AUDIT',
    message: `Client updated: ${client.name}${tokenChanged ? ' (token replaced)' : ''}`,
    userId: req.user.id,
    meta: { clientId: client.id },
  });

  if (tokenChanged) refreshClient(client.id).catch(() => {});

  res.json({ client: sanitize(client) });
}

async function remove(req, res) {
  const { id } = req.params;
  const client = await prisma.client.delete({ where: { id } });
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
  await log({ category: 'client', level: 'AUDIT', message: `Agent token rotated`, userId: req.user.id, meta: { clientId: client.id } });
  res.json({ apiToken });
}

/* ─── v1.11: Home Assistant long-lived access token ─────────────────────── */

/**
 * Verify a token against the client's Home Assistant.
 * Accepts a token in the body to test *before* saving, otherwise tests the
 * stored one.
 */
async function testHaToken(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, haToken: true },
  });
  if (!client) return res.status(404).json({ error: 'Not found' });

  const candidate = typeof req.body?.haToken === 'string' ? req.body.haToken.trim() : '';
  const token = candidate || decryptSecret(client.haToken);

  if (!token) {
    return res.status(400).json({
      ok: false,
      error: client.haToken
        ? 'The stored token could not be decrypted. Paste it again to re-save it.'
        : 'No token saved for this client yet.',
    });
  }

  const result = await ha.verify(client.url, token);

  // Only record status when testing what's actually stored.
  if (!candidate) {
    await prisma.client.update({
      where: { id },
      data: {
        haTokenStatus: result.ok ? 'OK' : (result.authFailed ? 'UNAUTHORIZED' : 'UNREACHABLE'),
        haTokenCheckedAt: new Date(),
      },
    }).catch(() => {});
  }

  if (!result.ok) {
    return res.json({
      ok: false,
      authFailed: !!result.authFailed,
      error: result.authFailed
        ? 'Home Assistant rejected this token. Create a new one in HA under your profile, Security tab, Long-lived access tokens.'
        : (result.error || 'Could not reach Home Assistant.'),
    });
  }

  res.json({
    ok: true,
    version: result.version,
    locationName: result.locationName,
    timeZone: result.timeZone,
    haState: result.haState,
    integrationCount: result.integrationCount,
    latencyMs: result.latencyMs,
  });
}

async function clearHaToken(req, res) {
  const { id } = req.params;
  const client = await prisma.client.update({
    where: { id },
    data: {
      haToken: null, haTokenHint: null, haTokenSetAt: null,
      haTokenStatus: null, haTokenCheckedAt: null,
      entityCount: null, unavailableCount: null, integrationCount: null,
      automationCount: null, updateAvailable: false, latestVersion: null,
      pendingUpdates: null, haDetails: null, lastDetailAt: null,
      locationName: null, timeZone: null, haState: null,
    },
  });
  await log({
    category: 'client', level: 'AUDIT',
    message: `Home Assistant token removed: ${client.name}`,
    userId: req.user.id, meta: { clientId: id },
  });
  res.json({ client: sanitize(client) });
}

/** Force an immediate poll of one client. */
async function refresh(req, res) {
  const { id } = req.params;
  try {
    const updated = await refreshClient(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ client: sanitize(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Refresh failed' });
  }
}

module.exports = {
  list, get,
  create, createValidators,
  update, updateValidators,
  remove,
  rotateToken,
  testHaToken, clearHaToken, refresh,
};
