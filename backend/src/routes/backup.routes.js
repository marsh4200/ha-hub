const router = require('express').Router({ mergeParams: true });
const fsp = require('fs/promises');
const multer = require('multer');
const c = require('../controllers/backup.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const TMP_DIR = process.env.BACKUP_TMP_DIR || '/app/data/tmp';
fsp.mkdir(TMP_DIR, { recursive: true }).catch(() => {});

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: c.MAX_SIZE,   // 800 MB
    files: 1,
    fields: 5,
  },
});

// Chunked-upload parts: capped at 95 MB so each request clears the ~100 MB proxy limit.
const CHUNK_MAX = parseInt(process.env.BACKUP_CHUNK_MAX_BYTES || String(95 * 1024 * 1024), 10);
const chunkUpload = multer({
  dest: TMP_DIR,
  limits: { fileSize: CHUNK_MAX, files: 1, fields: 10 },
});

router.use(requireAuth);

// Read endpoints — admin or assigned user
router.get('/', c.getBackupInfo);
router.get('/download', c.downloadBackup);

// Mutating endpoints — admin only
router.post('/', requireRole('ADMIN'), upload.single('backup'), c.uploadBackup);
router.delete('/', requireRole('ADMIN'), c.deleteBackup);

// Chunked upload (large files behind a proxy body-size cap) — admin only
router.post('/chunk', requireRole('ADMIN'), chunkUpload.single('chunk'), c.uploadChunk);
router.post('/chunk/complete', requireRole('ADMIN'), c.completeChunkedUpload);
router.post('/chunk/abort', requireRole('ADMIN'), c.abortChunkedUpload);

// Emergency encryption key (text) — read via GET '/', write/delete admin only
router.put('/key', requireRole('ADMIN'), c.setBackupKey);
router.delete('/key', requireRole('ADMIN'), c.deleteBackupKey);

// Multer error handler (file too large, etc.) — must be after the routes
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large (max ${(c.MAX_SIZE / 1024 / 1024).toFixed(0)} MB)` });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
