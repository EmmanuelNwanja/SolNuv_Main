require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`✅ SolNuv API running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Frontend URL: ${process.env.FRONTEND_URL}`);

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

module.exports = server;