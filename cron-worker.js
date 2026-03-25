// Mark this as the cron worker process BEFORE importing cron modules
process.env.CRON_WORKER = 'true';

// Use dynamic imports to ensure CRON_WORKER is set before cron modules load
const { logger } = await import('./src/utils/logger.js');
const chalk = (await import('chalk')).default;

logger.info(chalk.bold.green('Cron Worker Process Starting...'));

// Import all cron jobs - they will auto-start on import
await import('./src/cron/gatherAllData.js');
await import('./src/cron/notifyCron.js');
await import('./src/cron/calculationCron.js');
await import('./src/cron/pendingPayout.js');
await import('./src/cron/checkNetbalance.js');
await import('./src/cron/successRatioCron.js');

logger.info(chalk.bold.green('All cron jobs initialized successfully'));

// Graceful shutdown handler
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  logger.info(chalk.bold.yellow(`Cron Worker received ${signal} - shutting down gracefully...`));
  
  try {
    // Flush logger
      // Flush logger before exit (must be the last logger interaction)
      await logger.close();
    
      // logger.info(chalk.bold.green('Cron Worker shutdown complete'));
    process.exit(0);
  } catch (error) {
    logger.error('Error during cron worker shutdown:', error);
    process.exit(1);
  }
}

// Process event handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Just log errors without crashing - let individual crons handle their errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in Cron Worker:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in Cron Worker:', { reason, promise });
});
