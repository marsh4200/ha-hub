const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const prisma = require('../config/prisma');
const { signToken, randomToken, hashToken } = require('../utils/tokens');
const { log } = require('../utils/logger');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: 12 * 60 * 60 * 1000,
};

// GET /api/auth/setup-status — public, used by frontend to decide if wizard should show
async function setupStatus(req, res) {
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  res.json({ needsSetup: adminCount === 0 });
}

// POST /api/auth/setup — only works if there are zero admins
const setupValidators = [
  body('username').isString().trim().isLength({ min: 3, max: 32 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('email').optional({ nullable: true }).isEmail(),
];

async function setup(req, res) {
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount > 0) {
    return res.status(409).json({ error: 'Setup already completed' });
  }
  const { username, password, email } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email: email || null, passwordHash, role: 'ADMIN' },
  });
  await log({ category: 'auth', level: 'AUDIT', message: `Initial admin created: ${username}`, userId: user.id });
  res.status(201).json({ ok: true, username: user.username });
}

// POST /api/auth/login
const loginValidators = [
  body('username').isString().trim().isLength({ min: 1 }),
  body('password').isString().isLength({ min: 1 }),
];

async function login(req, res) {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    await log({ category: 'auth', level: 'WARN', message: `Failed login for ${username}` });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await log({ category: 'auth', level: 'WARN', message: `Bad password for ${username}`, userId: user.id });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ sub: user.id, role: user.role });
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await log({ category: 'auth', level: 'AUDIT', message: `User logged in: ${username}`, userId: user.id });

  res.cookie('token', token, COOKIE_OPTS);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, email: user.email },
  });
}

// POST /api/auth/logout
async function logout(req, res) {
  const token = req.cookies?.token || req.headers.authorization?.slice(7);
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie('token', COOKIE_OPTS);
  if (req.user) {
    await log({ category: 'auth', level: 'AUDIT', message: `User logged out`, userId: req.user.id });
  }
  res.json({ ok: true });
}

// GET /api/auth/me
async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, email: true, role: true, lastLoginAt: true, createdAt: true },
  });
  res.json({ user });
}

// POST /api/auth/change-password
const changePasswordValidators = [
  body('currentPassword').isString().isLength({ min: 1 }),
  body('newPassword').isString().isLength({ min: 8, max: 128 }),
];

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await log({ category: 'auth', level: 'AUDIT', message: 'Password changed', userId: user.id });
  res.json({ ok: true });
}

module.exports = {
  setupStatus,
  setup, setupValidators,
  login, loginValidators,
  logout,
  me,
  changePassword, changePasswordValidators,
};
