const prisma = require('../config/prisma');

async function log({ level = 'INFO', category, message, meta, userId }) {
  try {
    await prisma.log.create({
      data: { level, category, message, meta: meta || undefined, userId: userId || null },
    });
  } catch (err) {
    // Never throw from logger
    console.error('[logger] failed:', err.message);
  }
  if (level === 'ERROR' || level === 'WARN') {
    console[level === 'ERROR' ? 'error' : 'warn'](`[${category}] ${message}`);
  }
}

module.exports = { log };
