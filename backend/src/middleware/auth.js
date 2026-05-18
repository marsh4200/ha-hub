const { verifyToken } = require('../utils/tokens');
const prisma = require('../config/prisma');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return res.status(401).json({ error: 'Unauthorized' });

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// For HA agents — authenticated by client API token, not user JWT
async function requireClientToken(req, res, next) {
  const token =
    req.headers['x-client-token'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
  if (!token) return res.status(401).json({ error: 'Missing client token' });

  const client = await prisma.client.findUnique({ where: { apiToken: token } });
  if (!client) return res.status(401).json({ error: 'Invalid client token' });

  req.client = client;
  next();
}

module.exports = { requireAuth, requireRole, requireClientToken };
