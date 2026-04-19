require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const app = express();

// Reduce fingerprinting surface
app.disable('x-powered-by');

// Render runs behind a reverse proxy; trust it so req.ip is the real client IP.
// Without this, rate limiting can bucket many users together and cause false throttling.
app.set('trust proxy', 1);

// ==============================
// SECURITY MIDDLEWARE
// ==============================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true, preload: true }
    : false,
}));

// CORS — allow frontend
const allowedOrigins = [
  'https://solnuv.com',
  'https://www.solnuv.com',
  process.env.FRONTEND_URL,
  'http://localhost:3000', // local dev
].filter(Boolean);

// Regex patterns for dynamic origins (Vercel preview deployments)
const allowedOriginPatterns = [
  /^https:\/\/sol-nuv-main(-[a-z0-9]+)*(-emmanuelnwanja[^.]*)?\.vercel\.app$/,
  /^https:\/\/([a-z0-9-]+\.)?solnuv\.com$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (allowedOriginPatterns.some(p => p.test(origin))) return callback(null, true);
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==============================
// RATE LIMITING
// ==============================
// Key rate limits by authenticated user when possible so teammates behind a
// single NAT / office IP and multi-tab users don't share one bucket. Parsing
// the JWT without verifying is safe here because this key is only used for
// bucketing — auth is still enforced by authMiddleware.
function rateLimitKey(req) {
  const header = req.headers && req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (payload && typeof payload.sub === 'string' && payload.sub.length > 0) {
          return `u:${payload.sub}`;
        }
      } catch {
        /* fall through to IP */
      }
    }
  }
  return `ip:${req.ip}`;
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 600, // ~40 req/min average — headroom for multi-tab users
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: (req) => {
    // Skip rate limiting for public read-only endpoints
    const publicPaths = [
      '/api/design-reports/shared/',
      '/api/public/',
      '/api/blog/',
      '/api/faq/',
      '/api/contact/',
      '/api/analytics/pageview',
      // calculator degradation is used as live preview during project drafting
      '/api/calculator/degradation',
    ];
    return publicPaths.some(p => req.path.startsWith(p));
  },
});

const authSensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
  keyGenerator: rateLimitKey,
});

const pollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Allow frequent polling for notifications, etc.
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
});

app.use(globalLimiter);

// Higher limit for polling / UI-critical read endpoints. These are hit on
// every dashboard visit and navigation; share the more generous per-minute
// bucket so a normal multi-tab session does not exhaust the 15-minute global.
app.use('/api/auth/notifications', pollingLimiter);
app.use('/api/dashboard/leaderboard', pollingLimiter);
app.use('/api/dashboard', pollingLimiter);
app.use('/api/calculator/saved', pollingLimiter);

// ==============================
// BODY PARSING
// ==============================
// Paystack webhook needs raw body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(compression());

// ==============================
// LOGGING
// ==============================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// ==============================
// APPLY AUTH RATE LIMITS
// ==============================
// Limit only high-risk auth endpoints (OTP / reset flows), not profile/session checks.
app.use('/api/auth/password-reset', authSensitiveLimiter);
app.use('/api/auth/phone-verification', authSensitiveLimiter);

// ==============================
// ROUTES
// ==============================
app.use('/api', require('./routes/index'));

// ==============================
// 404 HANDLER
// ==============================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ==============================
// GLOBAL ERROR HANDLER
// ==============================
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'Not allowed by CORS' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
