const { Server } = require('socket.io');
const { verifyToken } = require('../utils/tokens');
const prisma = require('../config/prisma');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/, '');
      if (!token) return next(new Error('Missing token'));
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) return next(new Error('Invalid user'));
      socket.user = { id: user.id, role: user.role, username: user.username };
      next();
    } catch (e) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'ADMIN') socket.join('admins');
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
