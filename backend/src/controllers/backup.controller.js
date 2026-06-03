// Backup upload/download/delete handlers.
// Storage layout: /app/data/backups/<clientId>/backup.tar(.gz)
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const prisma = require('../config/prisma');
const { log } = require('../utils/logger');

const BACKUP_ROOT = process.env.BACKUP_DIR || '/app/data/backups';
const MAX_SIZE   = parseInt(process.env.BACKUP_MAX_SIZE_BYTES || String(800 * 1024 * 1024), 10); // 800 MB

function clientDir(id) { return path.join(BACKUP_ROOT, id); }

async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }

// Magic-byte sniffing: gzip starts 1f 8b; plain tar has "ustar" at offset 257.
function looksLikeTar(buf) {
  if (!buf || buf.length < 2) return false;
  if (buf[0] === 0x1f && buf[1] === 0x8b) return true;            // gzip
  if (buf.length >= 263 && buf.slice(257, 262).toString() === 'ustar') return true;
  return false;
}

async function userCanAccess(user, clientId) {
  if (user.role === 'ADMIN') return true;
  const p = await prisma.permission.findFirst({ where: { userId: user.id, clientId } });
  return !!p;
}

// Resolve a userId → username (best-effort)
async function usernameFor(userId) {
  if (!userId) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return u?.username || null;
}

// GET /api/clients/:id/backup — metadata only (plus the encryption key text)
async function getBackupInfo(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true, name: true,
      backupFilename: true, backupSize: true,
      backupUploadedAt: true, backupUploadedById: true,
      backupKey: true, backupKeyUpdatedAt: true, backupKeyUpdatedById: true,
    },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!await userCanAccess(req.user, id)) return res.status(403).json({ error: 'Forbidden' });

  let backup = null;
  if (client.backupFilename) {
    backup = {
      filename: client.backupFilename,
      size: client.backupSize != null ? Number(client.backupSize) : null,
      uploadedAt: client.backupUploadedAt,
      uploadedBy: await usernameFor(client.backupUploadedById),
    };
  }

  // The emergency encryption key is what's needed to restore the backup, so it's
  // visible to the same people who can access the backup (admin or assigned user).
  let key = null;
  if (client.backupKey != null) {
    key = {
      content: client.backupKey,
      updatedAt: client.backupKeyUpdatedAt,
      updatedBy: await usernameFor(client.backupKeyUpdatedById),
    };
  }

  res.json({ backup, key, maxSize: MAX_SIZE });
}

// Shared finalize: validate a complete tmp file, move it into place as the
// client's backup, update DB + audit log. Returns { backup } or { status, error }.
// Always removes tmpFilePath (on success it's renamed away; on failure it's deleted).
async function finalizeBackupFile({ id, client, tmpFilePath, originalName, userId }) {
  try {
    // 1. Size check
    const stat = await fsp.stat(tmpFilePath);
    if (stat.size > MAX_SIZE) {
      await fsp.unlink(tmpFilePath).catch(() => {});
      return { status: 413, error: `File exceeds ${(MAX_SIZE / 1024 / 1024).toFixed(0)} MB limit` };
    }

    // 2. Magic-byte sniff
    const fh = await fsp.open(tmpFilePath, 'r');
    const buf = Buffer.alloc(512);
    await fh.read(buf, 0, 512, 0);
    await fh.close();
    if (!looksLikeTar(buf)) {
      await fsp.unlink(tmpFilePath).catch(() => {});
      return { status: 400, error: 'File is not a valid .tar or .tar.gz archive' };
    }

    // 3. Determine final filename (preserve extension)
    const original = originalName || 'backup.tar';
    const finalName = original.toLowerCase().endsWith('.gz') ? 'backup.tar.gz' : 'backup.tar';
    const dir = clientDir(id);
    await ensureDir(dir);
    const finalPath = path.join(dir, finalName);

    // 4. Atomic move (overwrites previous backup). Remove the other extension first.
    for (const old of ['backup.tar', 'backup.tar.gz']) {
      if (old !== finalName) await fsp.unlink(path.join(dir, old)).catch(() => {});
    }
    await fsp.rename(tmpFilePath, finalPath);

    // 5. Update DB
    const updated = await prisma.client.update({
      where: { id },
      data: {
        backupFilename: original,
        backupSize: BigInt(stat.size),
        backupUploadedAt: new Date(),
        backupUploadedById: userId,
      },
      select: { backupFilename: true, backupSize: true, backupUploadedAt: true },
    });

    await log({
      category: 'client', level: 'AUDIT',
      message: `Backup uploaded for ${client.name}: ${original} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`,
      userId, meta: { clientId: id },
    });

    return {
      backup: {
        filename: updated.backupFilename,
        size: Number(updated.backupSize),
        uploadedAt: updated.backupUploadedAt,
      },
    };
  } catch (err) {
    await fsp.unlink(tmpFilePath).catch(() => {});
    throw err;
  }
}

// POST /api/clients/:id/backup — single-shot multipart upload (admin only).
// Used for files under the proxy limit; larger files use the chunked endpoints below.
async function uploadBackup(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (expected field "backup")' });

  const result = await finalizeBackupFile({
    id, client,
    tmpFilePath: req.file.path,
    originalName: req.file.originalname,
    userId: req.user.id,
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, backup: result.backup });
}

// ---- Chunked upload (for files larger than the proxy's request-body cap) ----
// The browser slices the tar into <100 MB parts so each request clears Cloudflare;
// the server stages them per uploadId, then concatenates + finalizes.
const CHUNK_ROOT = process.env.BACKUP_CHUNK_DIR || path.join(process.env.BACKUP_TMP_DIR || '/app/data/tmp', 'chunks');

function safeUploadId(s) {
  return typeof s === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(s) ? s : null;
}
function stagingDir(uploadId) { return path.join(CHUNK_ROOT, uploadId); }

async function dirSize(dir) {
  let total = 0;
  const names = await fsp.readdir(dir).catch(() => []);
  for (const n of names) {
    const s = await fsp.stat(path.join(dir, n)).catch(() => null);
    if (s?.isFile()) total += s.size;
  }
  return total;
}

// POST /api/clients/:id/backup/chunk  (admin) — one part of a chunked upload.
// multipart fields: uploadId, index, total, chunk(file)
async function uploadChunk(req, res) {
  const { id } = req.params;
  const tmpPath = req.file?.path;
  try {
    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) { if (tmpPath) await fsp.unlink(tmpPath).catch(() => {}); return res.status(404).json({ error: 'Client not found' }); }
    if (!req.file) return res.status(400).json({ error: 'No chunk uploaded (expected field "chunk")' });

    const uploadId = safeUploadId(req.body?.uploadId);
    const index = parseInt(req.body?.index, 10);
    const total = parseInt(req.body?.total, 10);
    if (!uploadId) { await fsp.unlink(tmpPath).catch(() => {}); return res.status(400).json({ error: 'Invalid uploadId' }); }
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(total) || total < 1 || total > 100000 || index >= total) {
      await fsp.unlink(tmpPath).catch(() => {});
      return res.status(400).json({ error: 'Invalid chunk index/total' });
    }

    const dir = stagingDir(uploadId);
    await ensureDir(dir);

    // Guard cumulative size against MAX_SIZE
    const existing = await dirSize(dir);
    const incoming = (await fsp.stat(tmpPath)).size;
    if (existing + incoming > MAX_SIZE) {
      await fsp.unlink(tmpPath).catch(() => {});
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
      return res.status(413).json({ error: `Upload exceeds ${(MAX_SIZE / 1024 / 1024).toFixed(0)} MB limit` });
    }

    await fsp.rename(tmpPath, path.join(dir, `${index}.part`));
    res.json({ ok: true, index });
  } catch (err) {
    if (tmpPath) await fsp.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// POST /api/clients/:id/backup/chunk/complete  (admin)
// body JSON: { uploadId, filename, total }
async function completeChunkedUpload(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const uploadId = safeUploadId(req.body?.uploadId);
  const total = parseInt(req.body?.total, 10);
  const filename = req.body?.filename;
  if (!uploadId) return res.status(400).json({ error: 'Invalid uploadId' });
  if (!Number.isInteger(total) || total < 1) return res.status(400).json({ error: 'Invalid total' });

  const dir = stagingDir(uploadId);
  // Verify every chunk is present
  for (let i = 0; i < total; i++) {
    try { await fsp.access(path.join(dir, `${i}.part`)); }
    catch { return res.status(400).json({ error: `Missing chunk ${i} of ${total} — please re-upload` }); }
  }

  // Concatenate parts in order into a single tmp file
  const assembled = path.join(CHUNK_ROOT, `${uploadId}.assembled`);
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(assembled);
      out.on('error', reject);
      (async () => {
        for (let i = 0; i < total; i++) {
          await new Promise((res2, rej2) => {
            const rs = fs.createReadStream(path.join(dir, `${i}.part`));
            rs.on('error', rej2);
            rs.on('end', res2);
            rs.pipe(out, { end: false });
          });
        }
        out.end();
      })().catch(reject);
      out.on('finish', resolve);
    });

    const result = await finalizeBackupFile({
      id, client, tmpFilePath: assembled, originalName: filename, userId: req.user.id,
    });
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true, backup: result.backup });
  } catch (err) {
    await fsp.unlink(assembled).catch(() => {});
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

// POST /api/clients/:id/backup/chunk/abort  (admin) — discard a staged upload
async function abortChunkedUpload(req, res) {
  const uploadId = safeUploadId(req.body?.uploadId);
  if (uploadId) await fsp.rm(stagingDir(uploadId), { recursive: true, force: true }).catch(() => {});
  res.json({ ok: true });
}

// GET /api/clients/:id/backup/download
async function downloadBackup(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!await userCanAccess(req.user, id)) return res.status(403).json({ error: 'Forbidden' });
  if (!client.backupFilename) return res.status(404).json({ error: 'No backup stored for this client' });

  // Find which extension was actually written
  const dir = clientDir(id);
  let fileOnDisk = null;
  for (const candidate of ['backup.tar.gz', 'backup.tar']) {
    try { await fsp.access(path.join(dir, candidate)); fileOnDisk = candidate; break; } catch (_) {}
  }
  if (!fileOnDisk) {
    return res.status(410).json({ error: 'Backup metadata exists but the file is missing on disk' });
  }

  const fullPath = path.join(dir, fileOnDisk);
  // Use the originally-uploaded filename for the download
  const downloadName = client.backupFilename;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);

  const stat = await fsp.stat(fullPath);
  res.setHeader('Content-Length', String(stat.size));

  await log({
    category: 'client', level: 'INFO',
    message: `Backup downloaded for ${client.name}`,
    userId: req.user.id, meta: { clientId: id },
  });

  fs.createReadStream(fullPath).pipe(res);
}

// DELETE /api/clients/:id/backup (admin only, enforced by route)
async function deleteBackup(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const dir = clientDir(id);
  for (const candidate of ['backup.tar', 'backup.tar.gz']) {
    await fsp.unlink(path.join(dir, candidate)).catch(() => {});
  }
  // Try to remove the now-empty dir
  await fsp.rmdir(dir).catch(() => {});

  await prisma.client.update({
    where: { id },
    data: {
      backupFilename: null,
      backupSize: null,
      backupUploadedAt: null,
      backupUploadedById: null,
    },
  });

  await log({
    category: 'client', level: 'AUDIT',
    message: `Backup deleted for ${client.name}`,
    userId: req.user.id, meta: { clientId: id },
  });

  res.json({ ok: true });
}

// Max length for the stored key text (an HA emergency key is short; this is a sane guard)
const MAX_KEY_LEN = parseInt(process.env.BACKUP_KEY_MAX_CHARS || '8192', 10);

// PUT /api/clients/:id/backup/key — set/replace the emergency encryption key (admin only)
async function setBackupKey(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  let content = req.body?.content;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Expected a JSON body with a string "content" field' });
  }
  content = content.trim();
  if (!content) return res.status(400).json({ error: 'Encryption key text cannot be empty' });
  if (content.length > MAX_KEY_LEN) {
    return res.status(413).json({ error: `Key text too long (max ${MAX_KEY_LEN} characters)` });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: {
      backupKey: content,
      backupKeyUpdatedAt: new Date(),
      backupKeyUpdatedById: req.user.id,
    },
    select: { backupKeyUpdatedAt: true },
  });

  await log({
    category: 'client', level: 'AUDIT',
    message: `Backup encryption key ${client.backupKey ? 'updated' : 'added'} for ${client.name}`,
    userId: req.user.id, meta: { clientId: id },
  });

  res.json({
    ok: true,
    key: {
      content,
      updatedAt: updated.backupKeyUpdatedAt,
      updatedBy: req.user.username,
    },
  });
}

// DELETE /api/clients/:id/backup/key (admin only)
async function deleteBackupKey(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  await prisma.client.update({
    where: { id },
    data: {
      backupKey: null,
      backupKeyUpdatedAt: null,
      backupKeyUpdatedById: null,
    },
  });

  await log({
    category: 'client', level: 'AUDIT',
    message: `Backup encryption key deleted for ${client.name}`,
    userId: req.user.id, meta: { clientId: id },
  });

  res.json({ ok: true });
}

// GET /api/system/backup-usage (admin only)
async function getUsage(req, res) {
  let totalBytes = 0;
  let count = 0;
  try {
    const dirs = await fsp.readdir(BACKUP_ROOT).catch(() => []);
    for (const d of dirs) {
      for (const f of ['backup.tar', 'backup.tar.gz']) {
        try {
          const s = await fsp.stat(path.join(BACKUP_ROOT, d, f));
          totalBytes += s.size;
          count++;
        } catch (_) {}
      }
    }
  } catch (_) {}
  res.json({ totalBytes, count, maxPerFileBytes: MAX_SIZE });
}

module.exports = { getBackupInfo, uploadBackup, uploadChunk, completeChunkedUpload, abortChunkedUpload, downloadBackup, deleteBackup, setBackupKey, deleteBackupKey, getUsage, MAX_SIZE };
