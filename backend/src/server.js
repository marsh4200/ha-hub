require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const { initSocket } = require('./services/socket');
const { startOfflineWatcher } = require('./services/offlineWatcher');
const { startUrlPoller } = require('./services/urlPoller');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || true,
  credentials: true,
}));
app.use(compression());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

BigInt.prototype.toJSON = function () { return Number(this); };

// JSON body parser — small limit. Multipart uploads bypass this.
app.use(express.json({ limit: '2mb' }));

// Rate limiting — but exempt backup uploads/downloads (they can be slow & large)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => /\/api\/clients\/.+\/backup/.test(req.path),
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup', authLimiter);

// Don't time out long uploads (default 2 min is too short for 800 MB on slow links)
server.requestTimeout = 30 * 60 * 1000;       // 30 min
server.headersTimeout = 31 * 60 * 1000;
server.timeout = 0;                            // no idle socket timeout

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/clients', require('./routes/clients.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/heartbeat', require('./routes/heartbeat.routes'));
app.use('/api/logs', require('./routes/logs.routes'));
app.use('/api/system', require('./routes/system.routes'));

const frontendDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDir));
app.get(/^\/(?!api).*/, (req, res, next) => {
  res.sendFile(path.join(frontendDir, 'index.html'), (err) => err && next());
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

initSocket(server);
startOfflineWatcher();
startUrlPoller();

const PORT = parseInt(process.env.PORT || '4000', 10);
server.listen(PORT, () => {
  console.log(`HA-Hub API listening on :${PORT}`);
});
