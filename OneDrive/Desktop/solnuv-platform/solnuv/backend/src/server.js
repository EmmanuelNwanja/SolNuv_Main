require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { startScheduler } = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`✅ SolNuv API running on port ${PORT}`);
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   Frontend URL: ${process.env.FRONTEND_URL}`);

  // Start cron jobs
  if (process.env.NODE_ENV !== 'test') {
    startScheduler();
    logger.info('⏰ Cron scheduler started (8AM WAT daily)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
});

module.exports = server;
