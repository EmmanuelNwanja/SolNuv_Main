require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const app = express();

// ==============================
// SECURITY MIDDLEWARE
// ==============================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser / server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (allowedOriginPatterns.some(p => p.test(origin))) return callback(null, true);
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ==============================
// RATE LIMITING
// ==============================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
});

app.use(globalLimiter);

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
app.use('/api/auth', authLimiter);

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
app.use((err, req, res, next) => {
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
