require('dotenv').config();
const dns = require('dns').promises;
const { URL } = require('url');
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

function parseHost(input) {
  if (!input) return null;
  try {
    return new URL(input).hostname || null;
  } catch {
    return null;
  }
}

async function runStartupNetworkDiagnostics() {
  const providerBase = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const hosts = [
    parseHost(process.env.RENDER_EXTERNAL_URL),
    parseHost(process.env.SUPABASE_URL),
    parseHost(providerBase),
    'api.groq.com',
    'power.larc.nasa.gov',
    'nominatim.openstreetmap.org',
  ].filter(Boolean);

  const uniqueHosts = [...new Set(hosts)];
  for (const host of uniqueHosts) {
    try {
      const addresses = await dns.lookup(host, { all: true });
      logger.info('Startup DNS lookup ok', {
        host,
        addresses: addresses.map((a) => `${a.address}/${a.family}`),
      });
    } catch (err) {
      logger.warn('Startup DNS lookup failed', {
        host,
        message: err.message,
        code: err.code || null,
        errno: err.errno || null,
      });
    }
  }
}

const server = app.listen(PORT, () => {
  logger.info(`✅ SolNuv API running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Frontend URL: ${process.env.FRONTEND_URL}`);
  runStartupNetworkDiagnostics().catch((err) => {
    logger.warn('Startup network diagnostics failed', { message: err.message });
  });

  // Start cron jobs safely — guard against import issues
  if (process.env.NODE_ENV !== 'test') {
    try {
      const schedulerModule = require('./services/schedulerService');
      const startScheduler = schedulerModule.startScheduler || schedulerModule.default;
      if (typeof startScheduler === 'function') {
        startScheduler();
        logger.info('⏰ Cron scheduler started (8AM WAT daily)');
      } else {
        logger.warn('⚠️  Scheduler not started — startScheduler is not a function. Cron jobs will not run.');
      }
    } catch (err) {
      logger.warn('⚠️  Scheduler failed to load:', err.message);
    }
  }
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle timeout errors gracefully
process.on('timeout', () => {
  logger.warn('Process timeout detected');
});

module.exports = server;